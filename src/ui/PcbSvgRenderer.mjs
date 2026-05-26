// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbArcUtils } from './PcbArcUtils.mjs'
import { PcbEdgeFacingGlyphNormalizer } from './PcbEdgeFacingGlyphNormalizer.mjs'
import { PcbEmbeddedFontFaceRenderer } from './PcbEmbeddedFontFaceRenderer.mjs'
import { PcbFootprintPrimitiveSelector } from './PcbFootprintPrimitiveSelector.mjs'
import { PcbCopperPrimitiveSplitter } from './PcbCopperPrimitiveSplitter.mjs'
import { PcbRegionPrimitiveRenderer } from './PcbRegionPrimitiveRenderer.mjs'
import { PcbTextPrimitiveRenderer } from './PcbTextPrimitiveRenderer.mjs'
import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
/**
 * Renders normalized PCB models into HTML and SVG markup.
 */
export class PcbSvgRenderer {
    static #PAD_SHAPE_RECTANGULAR = 2
    static #PAD_HOLE_SHAPE_SLOT = 2
    static #GENERIC_DETAIL_SEARCH_HALF_EXTENT = 240
    /**
     * Renders a normalized PCB model into HTML and SVG markup.
     * @param {{ summary: { title?: string }, pcb?: { boardOutline: { segments: Array<Record<string, number | string>>, minX: number, minY: number, widthMil: number, heightMil: number }, layers: { name: string }[], primitiveLayers?: { layerId: number, name: string }[], polygons?: { layer?: string, segments: Array<Record<string, number | string>> }[], fills?: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks?: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs?: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[], vias?: { x: number, y: number, diameter: number, holeDiameter: number }[], pads?: { x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number, shapeTop?: number, shapeMid?: number, shapeBottom?: number, rotation?: number, isPlated?: boolean }[], texts?: { text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, visible?: boolean }[], components: { designator: string, x: number, y: number, rotation: number, layer: string, pattern: string }[] } }} documentModel
     * @returns {string}
     */
    static render(documentModel) {
        const pcb = documentModel?.pcb
        if (!pcb) {
            return '<section class="altium-renderer-empty">No PCB entities were recovered from this file.</section>'
        }
        const outline = pcb.boardOutline
        const polygons = pcb.polygons || []
        const fills = pcb.fills || []
        const tracks = pcb.tracks || []
        const arcs = pcb.arcs || []
        const regions = pcb.regions || []
        const shapeBasedRegions = pcb.shapeBasedRegions || []
        const renderedRegions = shapeBasedRegions.length
            ? shapeBasedRegions
            : regions
        const vias = pcb.vias || []
        const pads = pcb.pads || []
        const components = pcb.components.slice(0, 260)
        const stackLayers = Array.isArray(pcb.layers) ? pcb.layers : []
        const primitiveLayers = pcb.primitiveLayers || []
        const displayLayers = stackLayers.length ? stackLayers : primitiveLayers
        const texts = PcbTextPrimitiveRenderer.select(
            primitiveLayers,
            pcb.texts || [],
            'top'
        )
        const copperGroups = PcbCopperPrimitiveSplitter.split(
            polygons,
            fills,
            tracks,
            arcs,
            renderedRegions
        )
        const footprintPrimitives = PcbEdgeFacingGlyphNormalizer.normalize(
            PcbFootprintPrimitiveSelector.select(
                primitiveLayers,
                fills,
                tracks,
                arcs,
                renderedRegions,
                'top'
            ),
            outline
        )
        const path = PcbSvgRenderer.#buildBoardPath(outline.segments)
        const clipPathId = 'pcb-board-clip'
        const viewBox = PcbSvgRenderer.#buildViewBox(
            outline,
            components,
            [
                ...copperGroups.surface.polygons,
                ...copperGroups.subsurface.polygons
            ],
            [
                ...copperGroups.surface.fills,
                ...copperGroups.subsurface.fills,
                ...footprintPrimitives.fills
            ],
            [
                ...copperGroups.surface.tracks,
                ...copperGroups.subsurface.tracks,
                ...footprintPrimitives.tracks
            ],
            [
                ...copperGroups.surface.arcs,
                ...copperGroups.subsurface.arcs,
                ...footprintPrimitives.arcs
            ],
            [
                ...copperGroups.surface.regions,
                ...copperGroups.subsurface.regions,
                ...footprintPrimitives.regions
            ],
            vias,
            pads
        )
        const layerMarkup = displayLayers
            .slice(0, 10)
            .map(
                (layer) =>
                    '<li>' + SchematicSvgUtils.escapeHtml(layer.name) + '</li>'
            )
            .join('')
        const polygonMarkup = (polygonList, visibilityClass) =>
            polygonList
                .map(
                    (polygon) =>
                        '<path class="pcb-polygon pcb-polygon--' +
                        visibilityClass +
                        '" d="' +
                        SchematicSvgUtils.escapeHtml(
                            PcbSvgRenderer.#buildBoardPath(polygon.segments)
                        ) +
                        '" />'
                )
                .join('')
        const fillMarkup = (fillList, visibilityClass) =>
            fillList
                .map((fill) => {
                    const x = Math.min(fill.x1, fill.x2)
                    const y = Math.min(fill.y1, fill.y2)
                    const width = Math.abs(fill.x2 - fill.x1)
                    const height = Math.abs(fill.y2 - fill.y1)

                    return (
                        '<rect class="pcb-fill pcb-fill--' +
                        visibilityClass +
                        '" x="' +
                        SchematicSvgUtils.formatNumber(x) +
                        '" y="' +
                        SchematicSvgUtils.formatNumber(y) +
                        '" width="' +
                        SchematicSvgUtils.formatNumber(width) +
                        '" height="' +
                        SchematicSvgUtils.formatNumber(height) +
                        '" rx="' +
                        SchematicSvgUtils.formatNumber(
                            Math.min(width, height) / 6
                        ) +
                        '" />'
                    )
                })
                .join('')
        const trackMarkup = (trackList, visibilityClass) =>
            trackList
                .map(
                    (track) =>
                        '<line class="pcb-track pcb-track--' +
                        visibilityClass +
                        '" x1="' +
                        SchematicSvgUtils.formatNumber(track.x1) +
                        '" y1="' +
                        SchematicSvgUtils.formatNumber(track.y1) +
                        '" x2="' +
                        SchematicSvgUtils.formatNumber(track.x2) +
                        '" y2="' +
                        SchematicSvgUtils.formatNumber(track.y2) +
                        '" stroke-width="' +
                        SchematicSvgUtils.formatNumber(
                            Math.max(track.width || 0, 1)
                        ) +
                        '" />'
                )
                .join('')
        const arcMarkup = (arcList, visibilityClass) =>
            arcList
                .map((arc) =>
                    PcbArcUtils.buildMarkup(
                        arc,
                        'pcb-arc pcb-arc--' + visibilityClass
                    )
                )
                .join('')
        const regionMarkup = (regionList, visibilityClass) =>
            PcbRegionPrimitiveRenderer.buildMarkup(
                regionList,
                'pcb-region pcb-region--' + visibilityClass
            )
        const viaMarkup = vias
            .map((via) => {
                const ringRadius = Math.max((via.diameter || 0) / 2, 1)
                const holeRadius = Math.max((via.holeDiameter || 0) / 2, 0.6)
                return (
                    '<g class="pcb-via">' +
                    '<circle class="pcb-via__pad" cx="' +
                    SchematicSvgUtils.formatNumber(via.x) +
                    '" cy="' +
                    SchematicSvgUtils.formatNumber(via.y) +
                    '" r="' +
                    SchematicSvgUtils.formatNumber(ringRadius) +
                    '" />' +
                    '<circle class="pcb-via__hole" cx="' +
                    SchematicSvgUtils.formatNumber(via.x) +
                    '" cy="' +
                    SchematicSvgUtils.formatNumber(via.y) +
                    '" r="' +
                    SchematicSvgUtils.formatNumber(holeRadius) +
                    '" />' +
                    '</g>'
                )
            })
            .join('')
        const padMarkup = pads
            .map((pad) => PcbSvgRenderer.#renderPad(pad))
            .join('')
        const footprintFillMarkup = footprintPrimitives.fills
            .map((fill) => {
                const x = Math.min(fill.x1, fill.x2)
                const y = Math.min(fill.y1, fill.y2)
                const width = Math.abs(fill.x2 - fill.x1)
                const height = Math.abs(fill.y2 - fill.y1)
                return (
                    '<rect class="pcb-footprint-fill" x="' +
                    SchematicSvgUtils.formatNumber(x) +
                    '" y="' +
                    SchematicSvgUtils.formatNumber(y) +
                    '" width="' +
                    SchematicSvgUtils.formatNumber(width) +
                    '" height="' +
                    SchematicSvgUtils.formatNumber(height) +
                    '" rx="' +
                    SchematicSvgUtils.formatNumber(
                        Math.min(width, height) / 6
                    ) +
                    '" />'
                )
            })
            .join('')
        const footprintTrackMarkup = footprintPrimitives.tracks
            .map(
                (track) =>
                    '<line class="pcb-footprint-track" x1="' +
                    SchematicSvgUtils.formatNumber(track.x1) +
                    '" y1="' +
                    SchematicSvgUtils.formatNumber(track.y1) +
                    '" x2="' +
                    SchematicSvgUtils.formatNumber(track.x2) +
                    '" y2="' +
                    SchematicSvgUtils.formatNumber(track.y2) +
                    '" stroke-width="' +
                    SchematicSvgUtils.formatNumber(
                        Math.max(track.width || 0, 1)
                    ) +
                    '" />'
            )
            .join('')
        const footprintArcMarkup = footprintPrimitives.arcs
            .map((arc) => PcbArcUtils.buildMarkup(arc, 'pcb-footprint-arc'))
            .join('')
        const footprintRegionMarkup = PcbRegionPrimitiveRenderer.buildMarkup(
            footprintPrimitives.regions,
            'pcb-footprint-region'
        )
        const textMarkup = PcbTextPrimitiveRenderer.render(texts)
        const fontFaceMarkup = PcbEmbeddedFontFaceRenderer.buildMarkup(
            pcb.embeddedFonts || []
        )

        const componentMarkup = components
            .map((component) => {
                const bodyGeometry = PcbSvgRenderer.#footprintSize(
                    component.pattern
                )
                const bodyMarkup = PcbSvgRenderer.#hasAuthoredFootprintDetail(
                    component,
                    footprintPrimitives,
                    pads
                )
                    ? ''
                    : '<rect class="pcb-component__body" x="' +
                      SchematicSvgUtils.formatNumber(-bodyGeometry.width / 2) +
                      '" y="' +
                      SchematicSvgUtils.formatNumber(-bodyGeometry.height / 2) +
                      '" width="' +
                      SchematicSvgUtils.formatNumber(bodyGeometry.width) +
                      '" height="' +
                      SchematicSvgUtils.formatNumber(bodyGeometry.height) +
                      '" rx="' +
                      SchematicSvgUtils.formatNumber(
                          Math.max(bodyGeometry.height / 5, 4)
                      ) +
                      '" />'
                return (
                    '<g class="pcb-component pcb-component--' +
                    SchematicSvgUtils.escapeHtml(
                        component.layer.toLowerCase()
                    ) +
                    '" transform="translate(' +
                    SchematicSvgUtils.formatNumber(component.x) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(component.y) +
                    ') rotate(' +
                    SchematicSvgUtils.formatNumber(component.rotation) +
                    ')">' +
                    bodyMarkup +
                    '</g>'
                )
            })
            .join('')
        return (
            '<section class="svg-panel">' +
            '<header class="svg-panel__header"><h3>' +
            SchematicSvgUtils.escapeHtml(
                documentModel?.summary?.title || 'PCB'
            ) +
            '</h3><p>' +
            components.length +
            ' placements, ' +
            displayLayers.length +
            ' layers</p></header>' +
            '<div class="pcb-layout">' +
            '<aside class="pcb-legend"><h4>Board stack</h4><p>Top-facing composite view</p><ul>' +
            layerMarkup +
            '</ul></aside>' +
            '<svg class="pcb-svg" viewBox="' +
            SchematicSvgUtils.escapeHtml(viewBox) +
            '" preserveAspectRatio="xMidYMid meet" aria-label="PCB view">' +
            '<defs>' +
            fontFaceMarkup +
            '<clipPath id="' +
            clipPathId +
            '"><path d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '" /></clipPath></defs>' +
            '<path class="board-outline" d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '" />' +
            '<g class="pcb-copper-layers" clip-path="url(#' +
            clipPathId +
            ')">' +
            '<g class="pcb-copper pcb-copper--subsurface">' +
            polygonMarkup(copperGroups.subsurface.polygons, 'subsurface') +
            fillMarkup(copperGroups.subsurface.fills, 'subsurface') +
            regionMarkup(copperGroups.subsurface.regions, 'subsurface') +
            trackMarkup(copperGroups.subsurface.tracks, 'subsurface') +
            arcMarkup(copperGroups.subsurface.arcs, 'subsurface') +
            '</g>' +
            '<g class="pcb-copper pcb-copper--surface">' +
            polygonMarkup(copperGroups.surface.polygons, 'surface') +
            fillMarkup(copperGroups.surface.fills, 'surface') +
            regionMarkup(copperGroups.surface.regions, 'surface') +
            trackMarkup(copperGroups.surface.tracks, 'surface') +
            arcMarkup(copperGroups.surface.arcs, 'surface') +
            padMarkup +
            viaMarkup +
            '</g>' +
            '</g>' +
            '<g class="pcb-footprints">' +
            footprintFillMarkup +
            footprintTrackMarkup +
            footprintArcMarkup +
            footprintRegionMarkup +
            '</g>' +
            '<g class="pcb-texts" clip-path="url(#' +
            clipPathId +
            ')">' +
            textMarkup +
            '</g>' +
            '<path class="board-outline board-outline--stroke" d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '" />' +
            '<g class="pcb-components">' +
            componentMarkup +
            '</g>' +
            '</svg></div></section>'
        )
    }

    /**
     * Builds a best-effort board path from outline segments.
     * @param {Array<Record<string, number | string>>} segments
     * @returns {string}
     */
    static #buildBoardPath(segments) {
        if (!segments.length) {
            return 'M 0 0 L 1000 0 L 1000 600 L 0 600 Z'
        }
        const [first] = segments
        let path =
            'M ' +
            SchematicSvgUtils.formatNumber(first.x1) +
            ' ' +
            SchematicSvgUtils.formatNumber(first.y1)

        for (const segment of segments) {
            if (segment.type === 'arc') {
                const radius = Math.max(Number(segment.radius) || 0, 1)
                const sweep = PcbArcUtils.resolveShortSweepFromCenter(segment)
                path +=
                    ' A ' +
                    SchematicSvgUtils.formatNumber(radius) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(radius) +
                    ' 0 ' +
                    '0' +
                    ' ' +
                    sweep +
                    ' ' +
                    SchematicSvgUtils.formatNumber(segment.x2) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(segment.y2)
                continue
            }
            path +=
                ' L ' +
                SchematicSvgUtils.formatNumber(segment.x2) +
                ' ' +
                SchematicSvgUtils.formatNumber(segment.y2)
        }

        return path + ' Z'
    }

    /**
     * Computes a reasonable viewBox.
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }} outline
     * @param {{ x: number, y: number }[]} components
     * @param {{ segments: Array<Record<string, number | string>> }[]} polygons
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} fills
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} tracks
     * @param {{ x: number, y: number, radius: number, width?: number }[]} arcs
     * @param {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }[]} regions
     * @param {{ x: number, y: number, diameter: number }[]} vias
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number }[]} pads
     * @returns {string}
     */
    static #buildViewBox(
        outline,
        components,
        polygons,
        fills,
        tracks,
        arcs,
        regions,
        vias,
        pads
    ) {
        const xs = [outline.minX, outline.minX + outline.widthMil]
        const ys = [outline.minY, outline.minY + outline.heightMil]
        for (const segment of outline.segments || []) {
            xs.push(Number(segment.x1) || 0, Number(segment.x2) || 0)
            ys.push(Number(segment.y1) || 0, Number(segment.y2) || 0)
        }

        for (const polygon of polygons) {
            for (const segment of polygon.segments || []) {
                xs.push(Number(segment.x1) || 0, Number(segment.x2) || 0)
                ys.push(Number(segment.y1) || 0, Number(segment.y2) || 0)
            }
        }

        for (const fill of fills) {
            xs.push(fill.x1, fill.x2)
            ys.push(fill.y1, fill.y2)
        }

        for (const track of tracks) {
            xs.push(track.x1, track.x2)
            ys.push(track.y1, track.y2)
        }

        for (const arc of arcs) {
            PcbArcUtils.pushExtents(xs, ys, arc)
        }

        for (const region of regions) {
            PcbRegionPrimitiveRenderer.pushExtents(xs, ys, region)
        }

        for (const via of vias) {
            const radius = (via.diameter || 0) / 2
            xs.push(via.x - radius, via.x + radius)
            ys.push(via.y - radius, via.y + radius)
        }
        for (const pad of pads) {
            const size = PcbSvgRenderer.#resolvePadSurfaceSize(pad)
            xs.push(pad.x - size.width / 2, pad.x + size.width / 2)
            ys.push(pad.y - size.height / 2, pad.y + size.height / 2)
        }
        for (const component of components) {
            const bodyGeometry = PcbSvgRenderer.#footprintSize(
                component.pattern
            )
            xs.push(
                component.x - bodyGeometry.width / 2,
                component.x + bodyGeometry.width / 2
            )
            ys.push(
                component.y - bodyGeometry.height / 2,
                component.y + bodyGeometry.height / 2
            )
        }

        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        const maxX = Math.max(...xs)
        const maxY = Math.max(...ys)
        const padding = 240
        return [
            minX - padding,
            minY - padding,
            maxX - minX + padding * 2,
            maxY - minY + padding * 2
        ]
            .map((value) => SchematicSvgUtils.formatNumber(value))
            .join(' ')
    }

    /**
     * Resolves a small footprint-size heuristic and whether the pattern matched
     * a known package family instead of the generic fallback guess.
     * @param {string} pattern
     * @returns {{ width: number, height: number, isRecognized: boolean }}
     */
    static #footprintProfile(pattern) {
        const normalized = String(pattern || '').toUpperCase()
        if (normalized.includes('0402')) {
            return { width: 52, height: 28, isRecognized: true }
        }
        if (normalized.includes('0603')) {
            return { width: 72, height: 36, isRecognized: true }
        }
        if (normalized.includes('0805')) {
            return { width: 92, height: 48, isRecognized: true }
        }
        if (normalized.includes('SOT')) {
            return { width: 140, height: 90, isRecognized: true }
        }
        if (normalized.includes('QFN') || normalized.includes('QFP')) {
            return { width: 180, height: 180, isRecognized: true }
        }
        if (normalized.includes('SC70')) {
            return { width: 110, height: 70, isRecognized: true }
        }

        return { width: 96, height: 60, isRecognized: false }
    }

    /**
     * Returns a small footprint size heuristic for fallback body rendering.
     * @param {string} pattern
     * @returns {{ width: number, height: number }}
     */
    static #footprintSize(pattern) {
        const footprint = PcbSvgRenderer.#footprintProfile(pattern)
        return {
            width: footprint.width,
            height: footprint.height
        }
    }

    /**
     * Builds the local search box used to decide whether a component already
     * has authored pads or outline primitives and therefore should not render
     * a synthetic rounded body.
     * @param {{ x: number, y: number, pattern: string }} component
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    static #footprintDetailBounds(component) {
        const footprint = PcbSvgRenderer.#footprintProfile(component.pattern)
        const halfWidth = footprint.isRecognized
            ? footprint.width / 2 + 36
            : PcbSvgRenderer.#GENERIC_DETAIL_SEARCH_HALF_EXTENT
        const halfHeight = footprint.isRecognized
            ? footprint.height / 2 + 36
            : PcbSvgRenderer.#GENERIC_DETAIL_SEARCH_HALF_EXTENT

        return {
            minX: Number(component.x) - halfWidth,
            maxX: Number(component.x) + halfWidth,
            minY: Number(component.y) - halfHeight,
            maxY: Number(component.y) + halfHeight
        }
    }

    /**
     * Chooses one visible through-hole pad size for top-view rendering.
     * @param {{ sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number }} pad
     * @returns {{ width: number, height: number }}
     */
    static #resolvePadSurfaceSize(pad) {
        const width =
            Number(pad.sizeTopX || pad.sizeMidX || pad.sizeBottomX || 0) ||
            Number(pad.holeDiameter || 0)
        const height =
            Number(pad.sizeTopY || pad.sizeMidY || pad.sizeBottomY || 0) ||
            Number(pad.holeDiameter || 0)

        return {
            width: Math.max(width, Number(pad.holeDiameter || 0), 1),
            height: Math.max(height, Number(pad.holeDiameter || 0), 1)
        }
    }

    /**
     * Renders one through-hole pad as SVG.
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number, shapeTop?: number, rotation?: number, holeShape?: number | null, holeSlotLength?: number | null, holeRotation?: number | null, offsetTopX?: number, offsetTopY?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, cornerRadiusTop?: number | null }} pad
     * @returns {string}
     */
    static #renderPad(pad) {
        const size = PcbSvgRenderer.#resolvePadSurfaceSize(pad)
        const padIsCircular = PcbSvgRenderer.#isCircularPad(pad, size)
        const ringRadius = Math.max(Math.max(size.width, size.height) / 2, 0.6)
        const offsetX = Number(pad.offsetTopX || 0)
        const offsetY = Number(pad.offsetTopY || 0)
        const hasHole = Number(pad.holeDiameter || 0) > 0
        const ringMarkup = padIsCircular
            ? '<circle class="pcb-pad__ring" cx="' +
              SchematicSvgUtils.formatNumber(offsetX) +
              '" cy="' +
              SchematicSvgUtils.formatNumber(offsetY) +
              '" r="' +
              SchematicSvgUtils.formatNumber(ringRadius) +
              '" />'
            : '<rect class="pcb-pad__ring" x="' +
              SchematicSvgUtils.formatNumber(offsetX - size.width / 2) +
              '" y="' +
              SchematicSvgUtils.formatNumber(offsetY - size.height / 2) +
              '" width="' +
              SchematicSvgUtils.formatNumber(size.width) +
              '" height="' +
              SchematicSvgUtils.formatNumber(size.height) +
              '" rx="' +
              SchematicSvgUtils.formatNumber(
                  PcbSvgRenderer.#resolvePadCornerRadius(pad, size)
              ) +
              '" />'
        const holeMarkup = PcbSvgRenderer.#renderPadHole(pad)

        return (
            '<g class="pcb-pad pcb-pad--' +
            (padIsCircular ? 'round' : 'shaped') +
            ' pcb-pad--' +
            (hasHole ? 'through-hole' : 'smd') +
            '" transform="translate(' +
            SchematicSvgUtils.formatNumber(pad.x) +
            ' ' +
            SchematicSvgUtils.formatNumber(pad.y) +
            ') rotate(' +
            SchematicSvgUtils.formatNumber(Number(pad.rotation || 0)) +
            ')">' +
            ringMarkup +
            holeMarkup +
            '</g>'
        )
    }

    /**
     * Renders one pad drill hole as SVG.
     * @param {{ holeDiameter?: number, holeShape?: number | null, holeSlotLength?: number | null, holeRotation?: number | null }} pad
     * @returns {string}
     */
    static #renderPadHole(pad) {
        if (Number(pad.holeDiameter || 0) <= 0) {
            return ''
        }

        const holeDiameter = Math.max(Number(pad.holeDiameter || 0), 1.2)
        const holeRadius = Math.max(holeDiameter / 2, 0.6)

        if (PcbSvgRenderer.#isSlotHole(pad)) {
            const slotLength = Math.max(
                Number(pad.holeSlotLength || 0),
                holeDiameter
            )

            return (
                '<g class="pcb-pad__hole-rotation" transform="rotate(' +
                SchematicSvgUtils.formatNumber(Number(pad.holeRotation || 0)) +
                ')">' +
                '<rect class="pcb-pad__hole pcb-pad__hole--slot" x="' +
                SchematicSvgUtils.formatNumber(-slotLength / 2) +
                '" y="' +
                SchematicSvgUtils.formatNumber(-holeDiameter / 2) +
                '" width="' +
                SchematicSvgUtils.formatNumber(slotLength) +
                '" height="' +
                SchematicSvgUtils.formatNumber(holeDiameter) +
                '" rx="' +
                SchematicSvgUtils.formatNumber(holeRadius) +
                '" />' +
                '</g>'
            )
        }

        return (
            '<circle class="pcb-pad__hole" cx="0" cy="0" r="' +
            SchematicSvgUtils.formatNumber(holeRadius) +
            '" />'
        )
    }

    /**
     * Returns true when one through-hole pad should render as a circular ring.
     * @param {{ shapeTop?: number, hasRoundedRect?: boolean }} pad
     * @param {{ width: number, height: number }} size
     * @returns {boolean}
     */
    static #isCircularPad(pad, size) {
        const effectiveShape = PcbSvgRenderer.#resolvePadShape(pad)

        if (effectiveShape === PcbSvgRenderer.#PAD_SHAPE_RECTANGULAR) {
            return false
        }

        return Math.abs(Number(size.width) - Number(size.height)) < 0.001
    }

    /**
     * Returns true when one component already has authored geometry, either by
     * an explicit component ownership link or by nearby recovered primitives.
     * @param {{ componentIndex?: number | null, x: number, y: number, pattern: string }} component
     * @param {{ fills: { componentIndex?: number | null, x1: number, y1: number, x2: number, y2: number }[], tracks: { componentIndex?: number | null, x1: number, y1: number, x2: number, y2: number }[], arcs: { componentIndex?: number | null, x: number, y: number, radius: number, width?: number }[], regions?: { componentIndex?: number | null, points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }[] }} footprintPrimitives
     * @param {{ componentIndex?: number | null, x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, rotation?: number, offsetTopX?: number, offsetTopY?: number, holeDiameter?: number }[]} pads
     * @returns {boolean}
     */
    static #hasAuthoredFootprintDetail(component, footprintPrimitives, pads) {
        if (
            PcbSvgRenderer.#hasComponentOwnedFootprintDetail(
                component,
                footprintPrimitives,
                pads
            )
        ) {
            return true
        }

        const bounds = PcbSvgRenderer.#footprintDetailBounds(component)

        return (
            (footprintPrimitives.tracks || []).some((track) =>
                PcbSvgRenderer.#trackIntersectsBounds(track, bounds)
            ) ||
            (footprintPrimitives.fills || []).some((fill) =>
                PcbSvgRenderer.#fillIntersectsBounds(fill, bounds)
            ) ||
            (footprintPrimitives.arcs || []).some((arc) =>
                PcbArcUtils.intersectsBounds(arc, bounds)
            ) ||
            (footprintPrimitives.regions || []).some((region) =>
                PcbRegionPrimitiveRenderer.intersectsBounds(region, bounds)
            ) ||
            (pads || []).some((pad) =>
                PcbSvgRenderer.#padIntersectsBounds(pad, bounds)
            )
        )
    }

    /**
     * Returns true when recovered primitives directly reference the component.
     * @param {{ componentIndex?: number | null }} component
     * @param {{ fills?: { componentIndex?: number | null }[], tracks?: { componentIndex?: number | null }[], arcs?: { componentIndex?: number | null }[], regions?: { componentIndex?: number | null }[] }} footprintPrimitives
     * @param {{ componentIndex?: number | null }[]} pads
     * @returns {boolean}
     */
    static #hasComponentOwnedFootprintDetail(
        component,
        footprintPrimitives,
        pads
    ) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isInteger(componentIndex)) {
            return false
        }

        return [
            ...(footprintPrimitives.tracks || []),
            ...(footprintPrimitives.fills || []),
            ...(footprintPrimitives.arcs || []),
            ...(footprintPrimitives.regions || []),
            ...(pads || [])
        ].some(
            (primitive) => Number(primitive?.componentIndex) === componentIndex
        )
    }

    /**
     * Returns true when one recovered pad surface overlaps a component-local
     * search box, which means the footprint already has concrete 2D items.
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, rotation?: number, offsetTopX?: number, offsetTopY?: number, holeDiameter?: number }} pad
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #padIntersectsBounds(pad, bounds) {
        const size = PcbSvgRenderer.#resolvePadSurfaceSize(pad)
        const rotationRadians = (Number(pad.rotation || 0) * Math.PI) / 180
        const boxWidth =
            Math.abs(size.width * Math.cos(rotationRadians)) +
            Math.abs(size.height * Math.sin(rotationRadians))
        const boxHeight =
            Math.abs(size.width * Math.sin(rotationRadians)) +
            Math.abs(size.height * Math.cos(rotationRadians))
        const centerX = Number(pad.x || 0) + Number(pad.offsetTopX || 0)
        const centerY = Number(pad.y || 0) + Number(pad.offsetTopY || 0)
        const minX = centerX - boxWidth / 2
        const maxX = centerX + boxWidth / 2
        const minY = centerY - boxHeight / 2
        const maxY = centerY + boxHeight / 2

        return !(
            maxX < bounds.minX ||
            minX > bounds.maxX ||
            maxY < bounds.minY ||
            minY > bounds.maxY
        )
    }

    /**
     * Returns the visible top-layer pad shape code, including rounded-rect
     * overrides from the optional extension block.
     * @param {{ shapeTop?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null }} pad
     * @returns {number}
     */
    static #resolvePadShape(pad) {
        if (pad.hasRoundedRect && Number.isInteger(pad.roundedRectShapeTop)) {
            return Number(pad.roundedRectShapeTop)
        }
        return Number(pad.shapeTop || 0)
    }

    /**
     * Returns the corner radius for one visible pad ring.
     * @param {{ shapeTop?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, cornerRadiusTop?: number | null }} pad
     * @param {{ width: number, height: number }} size
     * @returns {number}
     */
    static #resolvePadCornerRadius(pad, size) {
        if (
            pad.hasRoundedRect &&
            Number.isFinite(pad.cornerRadiusTop) &&
            Number(pad.cornerRadiusTop) > 0
        ) {
            return (
                Math.min(size.width, size.height) *
                (Number(pad.cornerRadiusTop) / 100)
            )
        }

        if (PcbSvgRenderer.#resolvePadShape(pad) === 1) {
            return Math.min(size.width, size.height) / 2
        }

        return 0
    }

    /**
     * Returns true when one pad hole is a round-ended slot.
     * @param {{ holeShape?: number | null, holeSlotLength?: number | null, holeDiameter?: number }} pad
     * @returns {boolean}
     */
    static #isSlotHole(pad) {
        return (
            Number(pad.holeShape) === PcbSvgRenderer.#PAD_HOLE_SHAPE_SLOT &&
            Number(pad.holeSlotLength || 0) > Number(pad.holeDiameter || 0)
        )
    }

    /**
     * Returns true when one track intersects a component-local search box.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} track
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #trackIntersectsBounds(track, bounds) {
        const minX = Math.min(Number(track.x1), Number(track.x2))
        const maxX = Math.max(Number(track.x1), Number(track.x2))
        const minY = Math.min(Number(track.y1), Number(track.y2))
        const maxY = Math.max(Number(track.y1), Number(track.y2))

        return !(
            maxX < bounds.minX ||
            minX > bounds.maxX ||
            maxY < bounds.minY ||
            minY > bounds.maxY
        )
    }

    /**
     * Returns true when one fill intersects a component-local search box.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} fill
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #fillIntersectsBounds(fill, bounds) {
        const minX = Math.min(Number(fill.x1), Number(fill.x2))
        const maxX = Math.max(Number(fill.x1), Number(fill.x2))
        const minY = Math.min(Number(fill.y1), Number(fill.y2))
        const maxY = Math.max(Number(fill.y1), Number(fill.y2))

        return !(
            maxX < bounds.minX ||
            minX > bounds.maxX ||
            maxY < bounds.minY ||
            minY > bounds.maxY
        )
    }
}
