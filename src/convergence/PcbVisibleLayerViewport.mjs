// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbConvergenceLayerModel } from './PcbConvergenceLayerModel.mjs'

/**
 * Replaces PCB viewport bounds with bounds rendered from visible layers.
 */
export class PcbVisibleLayerViewport {
    /**
     * Applies visible-layer viewBox bounds while retaining original SVG markup.
     * @param {string} markup Complete SVG panel markup.
     * @param {object} documentModel PCB document.
     * @param {{ hiddenLayers?: (string | number)[] }} options Render options.
     * @param {(documentModel: object, options: object) => string} renderHistorical Historical render callback.
     * @returns {string}
     */
    static apply(markup, documentModel, options, renderHistorical) {
        const hidden = new Set(
            (Array.isArray(options?.hiddenLayers) ? options.hiddenLayers : [])
                .map(PcbConvergenceLayerModel.normalize)
                .filter(Boolean)
        )
        if (!hidden.size || !documentModel?.pcb) return markup

        const filteredDocument = PcbVisibleLayerViewport.#filterDocument(
            documentModel,
            hidden
        )
        const filteredMarkup = renderHistorical(filteredDocument, {
            ...options,
            hiddenLayers: undefined
        })
        const viewBox = filteredMarkup.match(
            /<svg class="pcb-svg" viewBox="([^"]+)"/u
        )?.[1]
        if (!viewBox) return markup

        return markup.replace(
            /(<svg class="pcb-svg"[^>]*\sviewBox=")[^"]+("[^>]*>)/u,
            '$1' + viewBox + '$2'
        )
    }

    /**
     * Creates a shallow document clone with hidden-layer primitives removed.
     * @param {object} documentModel Source document.
     * @param {Set<string>} hidden Hidden layer aliases.
     * @returns {object}
     */
    static #filterDocument(documentModel, hidden) {
        const pcb = documentModel.pcb
        const lookup = PcbConvergenceLayerModel.buildLookup(documentModel)
        const visible = (primitive) =>
            !PcbVisibleLayerViewport.#isHidden(primitive, lookup, hidden)
        const nearBoard = (component) =>
            PcbVisibleLayerViewport.#isComponentNearBoard(
                component,
                pcb.boardOutline
            )
        const filterKeys = [
            'polygons',
            'fills',
            'tracks',
            'arcs',
            'regions',
            'shapeBasedRegions',
            'vias',
            'pads',
            'texts',
            'dimensions'
        ]
        const filteredPcb = { ...pcb }
        for (const key of filterKeys) {
            filteredPcb[key] = (pcb[key] || []).filter(visible)
        }
        filteredPcb.components = (pcb.components || []).filter(
            (component) => visible(component) && nearBoard(component)
        )
        return { ...documentModel, pcb: filteredPcb }
    }

    /**
     * Returns true when one primitive belongs to a hidden layer.
     * @param {object} primitive Primitive record.
     * @param {object} lookup Layer lookup.
     * @param {Set<string>} hidden Hidden aliases.
     * @returns {boolean}
     */
    static #isHidden(primitive, lookup, hidden) {
        const layer = PcbConvergenceLayerModel.layerForPrimitive(
            primitive,
            lookup
        )
        const aliases = [
            ...PcbConvergenceLayerModel.aliases(layer),
            primitive?.layer,
            primitive?.layerName,
            primitive?.layerId,
            primitive?.layerCode
        ]
            .map(PcbConvergenceLayerModel.normalize)
            .filter(Boolean)
        return aliases.some((alias) => hidden.has(alias))
    }

    /**
     * Returns true for placements near enough to affect a board-first fit.
     * @param {object} component Component placement.
     * @param {object} outline Board outline.
     * @returns {boolean}
     */
    static #isComponentNearBoard(component, outline) {
        const x = Number(component?.x)
        const y = Number(component?.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return true
        const minX = Number(outline?.minX || 0)
        const minY = Number(outline?.minY || 0)
        const maxX = minX + Number(outline?.widthMil || 0)
        const maxY = minY + Number(outline?.heightMil || 0)
        const tolerance = 240
        return (
            x >= minX - tolerance &&
            x <= maxX + tolerance &&
            y >= minY - tolerance &&
            y <= maxY + tolerance
        )
    }
}
