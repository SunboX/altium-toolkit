// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbLayerGroups } from '../core/altium/PcbLayerGroups.mjs'

/**
 * Resolves normalized layer identity for convergence-owned PCB rendering.
 */
export class PcbConvergenceLayerModel {
    /**
     * Resolves distinct layer descriptors from stack and primitive metadata.
     * @param {object} documentModel PCB document.
     * @returns {object[]}
     */
    static resolve(documentModel) {
        const pcb = documentModel?.pcb || {}
        const layers = [...(pcb.layers || []), ...(pcb.primitiveLayers || [])]
        const descriptors = []
        const identities = new Set()

        for (const layer of layers) {
            const descriptor = PcbConvergenceLayerModel.#descriptor(layer)
            const identity = descriptor.layerKey || descriptor.displayName
            if (!identity || identities.has(identity)) continue
            identities.add(identity)
            descriptors.push(descriptor)
        }
        return descriptors
    }

    /**
     * Builds layer lookup maps for primitive and text matching.
     * @param {object} documentModel PCB document.
     * @returns {{ byId: Map<number, object>, byName: Map<string, object>, layers: object[] }}
     */
    static buildLookup(documentModel) {
        const layers = PcbConvergenceLayerModel.resolve(documentModel)
        const byId = new Map()
        const byName = new Map()
        for (const layer of layers) {
            for (const id of [layer.layerId, layer.legacyLayerId]) {
                if (Number.isInteger(id) && !byId.has(id)) byId.set(id, layer)
            }
            byName.set(
                PcbConvergenceLayerModel.normalize(layer.displayName),
                layer
            )
        }
        return { byId, byName, layers }
    }

    /**
     * Resolves the known layer for one primitive.
     * @param {object} primitive Primitive record.
     * @param {{ byId: Map<number, object>, byName: Map<string, object> }} lookup Layer lookup.
     * @returns {object | null}
     */
    static layerForPrimitive(primitive, lookup) {
        for (const value of [primitive?.layerId, primitive?.layerCode]) {
            const id = Number(value)
            if (Number.isInteger(id) && lookup.byId.has(id)) {
                return lookup.byId.get(id)
            }
        }
        const name = PcbConvergenceLayerModel.normalize(
            primitive?.layerName || primitive?.layer || primitive?.side
        )
        return name ? lookup.byName.get(name) || null : null
    }

    /**
     * Returns all stable aliases for one layer descriptor.
     * @param {object | null} layer Layer descriptor.
     * @returns {string[]}
     */
    static aliases(layer) {
        if (!layer) return []
        return [
            layer.layerKey,
            layer.displayName,
            layer.layerId,
            layer.legacyLayerId,
            Number.isInteger(layer.layerId) ? 'L' + layer.layerId : '',
            Number.isInteger(layer.legacyLayerId)
                ? 'L' + layer.legacyLayerId
                : ''
        ]
            .map(PcbConvergenceLayerModel.normalize)
            .filter(Boolean)
    }

    /**
     * Returns true for mechanical and documentation drawing layers.
     * @param {object} layer Layer descriptor.
     * @returns {boolean}
     */
    static isDrawingLayer(layer) {
        const text = [layer?.displayName, layer?.role]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        return /(mechanical|assembly|\basm\b|fabrication|\bfab\b|drawing|dimension|documentation|document|notes?|courtyard|crtyd)/u.test(
            text
        )
    }

    /**
     * Returns true when one drawing layer belongs to the requested side.
     * @param {object} layer Layer descriptor.
     * @param {'top' | 'bottom'} side Board side.
     * @returns {boolean}
     */
    static isDrawingLayerForSide(layer, side) {
        if (!PcbConvergenceLayerModel.isDrawingLayer(layer)) return false
        const text = [layer?.displayName, layer?.role]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        const compact = text.replace(/[^a-z0-9]+/gu, '')
        const bottom =
            /\bbottom\b|\bbot\b|botside|backassembly|bassembly|bcrtyd/u.test(
                text
            ) || compact.includes('assemblybottom')
        const top =
            /\btop\b|frontassembly|fassembly|fcrtyd/u.test(text) ||
            compact.includes('assemblytop')

        if (bottom && !top) return side === 'bottom'
        if (top && !bottom) return side === 'top'
        return true
    }

    /**
     * Normalizes one semantic layer alias.
     * @param {unknown} value Raw alias.
     * @returns {string}
     */
    static normalize(value) {
        return String(value ?? '')
            .trim()
            .toUpperCase()
    }

    /**
     * Builds one normalized descriptor.
     * @param {object} layer Source layer.
     * @returns {object}
     */
    static #descriptor(layer) {
        const layerId = PcbConvergenceLayerModel.#firstInteger([
            layer?.layerId,
            layer?.id,
            layer?.index,
            layer?.number
        ])
        const legacyLayerId = PcbConvergenceLayerModel.#firstInteger([
            layer?.legacyLayerId,
            layer?.legacyId
        ])
        const displayName = String(
            layer?.displayName || layer?.name || layer?.label || ''
        )
        return {
            layerId,
            legacyLayerId,
            layerKey: Number.isInteger(layerId)
                ? 'L' + layerId
                : PcbConvergenceLayerModel.normalize(displayName),
            displayName,
            role:
                layer?.role ||
                layer?.layerRole ||
                PcbConvergenceLayerModel.#inferRole(
                    displayName,
                    legacyLayerId ?? layerId
                )
        }
    }

    /**
     * Resolves a broad layer role.
     * @param {string} name Layer name.
     * @param {number | undefined} layerId Layer id.
     * @returns {string}
     */
    static #inferRole(name, layerId) {
        if (PcbLayerGroups.isMechanical(layerId)) return 'mechanical'
        if (PcbLayerGroups.isOverlay(layerId)) return 'overlay'
        if (PcbLayerGroups.isCopper(layerId)) return 'copper'
        const normalized = name.toLowerCase()
        if (/mechanical|dimension|drawing/u.test(normalized)) {
            return 'mechanical'
        }
        if (/assembly|\basm\b/u.test(normalized)) return 'assembly'
        if (/notes?|document|courtyard|crtyd/u.test(normalized)) {
            return 'documentation'
        }
        return 'other'
    }

    /**
     * Returns the first integer in a value list.
     * @param {unknown[]} values Candidate values.
     * @returns {number | undefined}
     */
    static #firstInteger(values) {
        for (const value of values) {
            const number = Number(value)
            if (Number.isInteger(number)) return number
        }
        return undefined
    }
}
