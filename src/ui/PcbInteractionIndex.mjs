// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbInteractionGeometry } from './PcbInteractionGeometry.mjs'
import { PcbInteractionItemRegistry } from './PcbInteractionItemRegistry.mjs'
import { PcbInteractionSourceMetadata } from './PcbInteractionSourceMetadata.mjs'

const TYPE_PRIORITY = {
    track: 100,
    pad: 90,
    via: 80,
    component: 50,
    text: 30,
    zone: 10
}

const PLURAL_TYPE_KEYS = {
    component: 'components',
    pad: 'pads',
    text: 'footprint-text',
    track: 'tracks',
    via: 'vias',
    zone: 'zones'
}

/**
 * Builds and queries selectable PCB items.
 */
export class PcbInteractionIndex {
    /**
     * Builds all selectable items for a PCB document.
     * @param {object} documentModel Toolkit document model.
     * @returns {object[]}
     */
    static build(documentModel) {
        const pcb = documentModel?.pcb || {}
        const context = PcbInteractionIndex.#context(pcb)

        return PcbInteractionIndex.#defaultRegistry()
            .extract(documentModel, context)
            .map((item, index) =>
                PcbInteractionIndex.#normalizeItem(item, index)
            )
            .filter(Boolean)
    }

    /**
     * Returns all hit candidates at the requested point.
     * @param {object} documentModel Toolkit document model.
     * @param {{ x?: unknown, y?: unknown }} point Hit-test point.
     * @param {object} [options] Hit-test options.
     * @returns {object[]}
     */
    static hitTest(documentModel, point, options = {}) {
        return PcbInteractionIndex.hitTestItems(
            PcbInteractionIndex.build(documentModel),
            point,
            options
        )
    }

    /**
     * Returns hit candidates from an already-built interaction item list.
     * @param {object[]} items Built interaction items.
     * @param {{ x?: unknown, y?: unknown }} point Hit-test point.
     * @param {object} [options] Hit-test options.
     * @returns {object[]}
     */
    static hitTestItems(items, point, options = {}) {
        const visibility = PcbInteractionIndex.#visibilityContext(options)
        const tolerance = Number(options?.tolerance) || 0

        return (Array.isArray(items) ? items : [])
            .filter((item) =>
                PcbInteractionIndex.#isVisibleCandidate(item, visibility)
            )
            .filter((item) =>
                PcbInteractionGeometry.containsPoint(
                    item.geometry,
                    point,
                    tolerance
                )
            )
            .sort(PcbInteractionIndex.#compareCandidates)
    }

    /**
     * Picks the highest-priority candidate at the requested point.
     * @param {object} documentModel Toolkit document model.
     * @param {{ x?: unknown, y?: unknown }} point Hit-test point.
     * @param {object} [options] Hit-test options.
     * @returns {object | null}
     */
    static pick(documentModel, point, options = {}) {
        return (
            PcbInteractionIndex.hitTest(documentModel, point, options)[0] ||
            null
        )
    }

    /**
     * Creates extraction context for one PCB model.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #context(pcb) {
        const components = Array.isArray(pcb.components) ? pcb.components : []
        const componentsById = new Map()
        for (const component of components) {
            const componentIndex = Number(component?.componentIndex)
            if (
                Number.isInteger(componentIndex) &&
                !componentsById.has(componentIndex)
            ) {
                // Explicit identities take precedence, retaining the first row.
                componentsById.set(componentIndex, component)
            }
        }

        return {
            components,
            componentsById,
            layerNameFor: PcbInteractionSourceMetadata.layerNameResolver(pcb)
        }
    }

    /**
     * Creates the default item extractor registry.
     * @returns {PcbInteractionItemRegistry}
     */
    static #defaultRegistry() {
        return PcbInteractionItemRegistry.create()
            .register('zones', PcbInteractionIndex.#extractZones)
            .register('tracks', PcbInteractionIndex.#extractTracks)
            .register('pads', PcbInteractionIndex.#extractPads)
            .register('vias', PcbInteractionIndex.#extractVias)
            .register('components', PcbInteractionIndex.#extractComponents)
            .register('footprint-text', PcbInteractionIndex.#extractTexts)
    }

    /**
     * Extracts selectable copper zones.
     * @param {object} documentModel Toolkit document model.
     * @param {object} context Extraction context.
     * @returns {object[]}
     */
    static #extractZones(documentModel, context) {
        const pcb = documentModel?.pcb || {}
        const zones = PcbInteractionSourceMetadata.zoneSources(pcb)

        return zones
            .map((zone, index) => {
                const geometry = PcbInteractionIndex.#zoneGeometry(zone)
                if (!geometry) return null

                return {
                    id: PcbInteractionIndex.#itemId('zone', zone, index),
                    type: 'zone',
                    label: PcbInteractionIndex.#label('Zone', index),
                    layerKeys: PcbInteractionIndex.#layerKeys(zone, context),
                    netName: PcbInteractionIndex.#netName(zone),
                    side: PcbInteractionIndex.#sideForLayer(zone, context),
                    geometry,
                    source: zone
                }
            })
            .filter(Boolean)
    }

    /**
     * Extracts selectable tracks.
     * @param {object} documentModel Toolkit document model.
     * @param {object} context Extraction context.
     * @returns {object[]}
     */
    static #extractTracks(documentModel, context) {
        const tracks = Array.isArray(documentModel?.pcb?.tracks)
            ? documentModel.pcb.tracks
            : []

        return tracks.map((track, index) => ({
            id: PcbInteractionIndex.#itemId('track', track, index),
            type: 'track',
            label: PcbInteractionIndex.#label('Track', index),
            layerKeys: PcbInteractionIndex.#layerKeys(track, context),
            netName: PcbInteractionIndex.#netName(track),
            side: PcbInteractionIndex.#sideForLayer(track, context),
            geometry: PcbInteractionGeometry.segment(
                { x: track.x1, y: track.y1 },
                { x: track.x2, y: track.y2 },
                Math.max(0.5, Number(track.width) / 2 || 0.5)
            ),
            source: track
        }))
    }

    /**
     * Extracts selectable pads.
     * @param {object} documentModel Toolkit document model.
     * @param {object} context Extraction context.
     * @returns {object[]}
     */
    static #extractPads(documentModel, context) {
        const pads = Array.isArray(documentModel?.pcb?.pads)
            ? documentModel.pcb.pads
            : []

        return pads.map((pad, index) => {
            const component = PcbInteractionIndex.#componentForPad(pad, context)

            return {
                id: PcbInteractionIndex.#itemId('pad', pad, index),
                type: 'pad',
                label: PcbInteractionIndex.#padLabel(pad, index),
                layerKeys: PcbInteractionIndex.#layerKeys(pad, context),
                netName: PcbInteractionIndex.#netName(pad),
                componentKey: PcbInteractionIndex.#componentKey(component),
                componentId: PcbInteractionIndex.#componentKey(component),
                side: PcbInteractionIndex.#sideForLayer(pad, context),
                geometry: PcbInteractionGeometry.rotatedRectangle({
                    x: pad.x,
                    y: pad.y,
                    width: PcbInteractionIndex.#padWidth(pad),
                    height: PcbInteractionIndex.#padHeight(pad),
                    rotation: pad.rotation
                }),
                source: pad
            }
        })
    }

    /**
     * Extracts selectable vias.
     * @param {object} documentModel Toolkit document model.
     * @returns {object[]}
     */
    static #extractVias(documentModel) {
        const vias = Array.isArray(documentModel?.pcb?.vias)
            ? documentModel.pcb.vias
            : []

        return vias.map((via, index) => ({
            id: PcbInteractionIndex.#itemId('via', via, index),
            type: 'via',
            label: PcbInteractionIndex.#label('Via', index),
            layerKeys: [],
            netName: PcbInteractionIndex.#netName(via),
            side: 'both',
            geometry: PcbInteractionGeometry.circle(
                { x: via.x, y: via.y },
                Math.max(0.5, Number(via.diameter) / 2 || 0.5)
            ),
            source: via
        }))
    }

    /**
     * Extracts selectable component body estimates.
     * @param {object} documentModel Toolkit document model.
     * @returns {object[]}
     */
    static #extractComponents(documentModel) {
        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []

        return components.map((component, index) => {
            const size = PcbInteractionIndex.#componentSize(component)
            return {
                id: PcbInteractionIndex.#itemId('component', component, index),
                type: 'component',
                label: PcbInteractionIndex.#componentKey(component),
                componentKey: PcbInteractionIndex.#componentKey(component),
                componentId: PcbInteractionIndex.#componentKey(component),
                layerKeys: [],
                side:
                    String(component?.layer || '').toUpperCase() === 'BOTTOM'
                        ? 'back'
                        : 'front',
                geometry: PcbInteractionGeometry.rotatedRectangle({
                    x: component.x,
                    y: component.y,
                    width: size.width,
                    height: size.height,
                    rotation: component.rotation
                }),
                source: component
            }
        })
    }

    /**
     * Extracts selectable footprint text.
     * @param {object} documentModel Toolkit document model.
     * @param {object} context Extraction context.
     * @returns {object[]}
     */
    static #extractTexts(documentModel, context) {
        const texts = Array.isArray(documentModel?.pcb?.texts)
            ? documentModel.pcb.texts
            : []

        return texts
            .filter((text) => text?.visible !== false)
            .map((text, index) => {
                const component = PcbInteractionIndex.#componentForPad(
                    text,
                    context
                )
                const height = Math.max(1, Number(text?.height) || 1)
                const width =
                    Math.max(1, String(text?.text || '').length) * height * 0.6

                return {
                    id: PcbInteractionIndex.#itemId('text', text, index),
                    type: 'text',
                    label: String(text?.text || 'Text'),
                    layerKeys: PcbInteractionIndex.#layerKeys(text, context),
                    componentKey: PcbInteractionIndex.#componentKey(component),
                    componentId: PcbInteractionIndex.#componentKey(component),
                    side: PcbInteractionIndex.#sideForLayer(text, context),
                    geometry: PcbInteractionGeometry.rotatedRectangle({
                        x: text.x,
                        y: text.y,
                        width,
                        height,
                        rotation: text.rotation
                    }),
                    source: text
                }
            })
    }

    /**
     * Builds geometry for a zone-like object.
     * @param {object} zone Zone-like object.
     * @returns {object | null}
     */
    static #zoneGeometry(zone) {
        const kind = PcbInteractionSourceMetadata.zoneGeometryKind(zone)
        if (kind === 'points') {
            return PcbInteractionGeometry.polygon(zone.points)
        }
        if (kind === 'segments') {
            return PcbInteractionGeometry.polygon(
                zone.segments.map((segment) => ({
                    x: segment.x1,
                    y: segment.y1
                }))
            )
        }
        if (kind === 'bounds') {
            return PcbInteractionGeometry.bounds({
                minX: Math.min(Number(zone.x1), Number(zone.x2)),
                minY: Math.min(Number(zone.y1), Number(zone.y2)),
                maxX: Math.max(Number(zone.x1), Number(zone.x2)),
                maxY: Math.max(Number(zone.y1), Number(zone.y2))
            })
        }

        return null
    }

    /**
     * Normalizes item metadata.
     * @param {object | null} item Extracted item.
     * @param {number} index Stable item order.
     * @returns {object | null}
     */
    static #normalizeItem(item, index) {
        if (!item || typeof item !== 'object' || !item.geometry) return null

        return {
            priority: TYPE_PRIORITY[item.type] || 0,
            order: index,
            bounds: PcbInteractionGeometry.boundsFor(item.geometry),
            ...item
        }
    }

    /**
     * Normalizes visibility filters once for the current hit test.
     * @param {object} options Hit-test options.
     * @returns {object}
     */
    static #visibilityContext(options) {
        return {
            side: PcbInteractionIndex.#normalizeSide(options?.side),
            hiddenObjects: new Set(
                (Array.isArray(options?.hiddenObjects)
                    ? options.hiddenObjects
                    : []
                ).map(String)
            ),
            hiddenLayers: new Set(
                (Array.isArray(options?.hiddenLayers)
                    ? options.hiddenLayers
                    : []
                ).map(String)
            )
        }
    }

    /**
     * Returns whether an item is visible under normalized hit-test filters.
     * @param {object} item Interaction item.
     * @param {object} visibility Normalized visibility filters.
     * @returns {boolean}
     */
    static #isVisibleCandidate(item, visibility) {
        const { side, hiddenObjects, hiddenLayers } = visibility
        if (item.side !== 'both' && item.side !== side) return false

        if (
            hiddenObjects.has(item.objectKey) ||
            hiddenObjects.has(PLURAL_TYPE_KEYS[item.type] || item.type)
        ) {
            return false
        }

        return (
            !item.layerKeys?.length ||
            item.layerKeys.some((layerKey) => !hiddenLayers.has(layerKey))
        )
    }

    /**
     * Compares candidates by priority and stable extraction order.
     * @param {object} first First item.
     * @param {object} second Second item.
     * @returns {number}
     */
    static #compareCandidates(first, second) {
        return second.priority - first.priority || first.order - second.order
    }

    /**
     * Resolves physical layer keys for an item.
     * @param {object} item Source item.
     * @param {object} context Extraction context.
     * @returns {string[]}
     */
    static #layerKeys(item, context) {
        return context.layerNameFor(item).filter(Boolean)
    }

    /**
     * Resolves the board side from the primary layer.
     * @param {object} item Source item.
     * @param {object} context Extraction context.
     * @returns {'front' | 'back' | 'both'}
     */
    static #sideForLayer(item, context) {
        const layerKey = PcbInteractionIndex.#layerKeys(item, context)[0] || ''
        const normalized = layerKey.toLowerCase()
        if (normalized.includes('bottom')) return 'back'
        if (normalized.includes('top')) return 'front'

        return 'both'
    }

    /**
     * Resolves a component for a pad-like primitive.
     * @param {object} primitive Primitive.
     * @param {object} context Extraction context.
     * @returns {object | null}
     */
    static #componentForPad(primitive, context) {
        const componentIndex = Number(primitive?.componentIndex)
        if (!Number.isInteger(componentIndex)) return null

        const explicitMatch = context.componentsById.get(componentIndex)
        if (explicitMatch) return explicitMatch

        if (componentIndex < 0 || componentIndex >= context.components.length) {
            return null
        }
        return context.components[componentIndex] || null
    }

    /**
     * Resolves a stable component key.
     * @param {object | null} component Component.
     * @returns {string}
     */
    static #componentKey(component) {
        return String(component?.designator || component?.id || '').trim()
    }

    /**
     * Resolves a pad display label.
     * @param {object} pad Pad.
     * @param {number} index Pad index.
     * @returns {string}
     */
    static #padLabel(pad, index) {
        const name = String(pad?.name || pad?.number || '').trim()
        return name || PcbInteractionIndex.#label('Pad', index)
    }

    /**
     * Resolves a net name from common primitive fields.
     * @param {object} item Primitive.
     * @returns {string}
     */
    static #netName(item) {
        return String(item?.netName || item?.net || '').trim()
    }

    /**
     * Resolves a pad width.
     * @param {object} pad Pad.
     * @returns {number}
     */
    static #padWidth(pad) {
        return Math.max(
            1,
            Number(pad?.sizeTopX) ||
                Number(pad?.sizeMidX) ||
                Number(pad?.sizeBottomX) ||
                Number(pad?.width) ||
                1
        )
    }

    /**
     * Resolves a pad height.
     * @param {object} pad Pad.
     * @returns {number}
     */
    static #padHeight(pad) {
        return Math.max(
            1,
            Number(pad?.sizeTopY) ||
                Number(pad?.sizeMidY) ||
                Number(pad?.sizeBottomY) ||
                Number(pad?.height) ||
                PcbInteractionIndex.#padWidth(pad)
        )
    }

    /**
     * Resolves a footprint body estimate for interaction.
     * @param {object} component Component.
     * @returns {{ width: number, height: number }}
     */
    static #componentSize(component) {
        const pattern = String(component?.pattern || '').toUpperCase()
        if (pattern.includes('QFN') || pattern.includes('QFP')) {
            return { width: 180, height: 180 }
        }
        if (pattern.includes('SOT')) return { width: 140, height: 90 }
        if (pattern.includes('0805')) return { width: 92, height: 48 }
        if (pattern.includes('0603')) return { width: 72, height: 36 }
        if (pattern.includes('0402')) return { width: 52, height: 28 }
        return { width: 96, height: 60 }
    }

    /**
     * Builds a stable fallback id.
     * @param {string} type Item type.
     * @param {object} source Source primitive.
     * @param {number} index Item index.
     * @returns {string}
     */
    static #itemId(type, source, index) {
        return String(source?.id || source?.uuid || `${type}:${index}`)
    }

    /**
     * Builds a fallback label.
     * @param {string} base Label base.
     * @param {number} index Item index.
     * @returns {string}
     */
    static #label(base, index) {
        return `${base} ${index + 1}`
    }

    /**
     * Normalizes side input.
     * @param {unknown} side Side input.
     * @returns {'front' | 'back'}
     */
    static #normalizeSide(side) {
        return side === 'bottom' || side === 'back' ? 'back' : 'front'
    }
}
