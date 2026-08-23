// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbTextPrimitiveRenderer } from '../ui/PcbTextPrimitiveRenderer.mjs'
import { PcbConvergenceLayerModel } from './PcbConvergenceLayerModel.mjs'

/**
 * Adds side-correct drawing annotations outside the board-only text clip.
 */
export class PcbDrawingTextComposite {
    /**
     * Adds mechanical and documentation text to rendered PCB markup.
     * @param {string} markup Historical renderer markup.
     * @param {object} documentModel PCB document.
     * @param {{ side?: 'top' | 'bottom' }} [options] Render options.
     * @returns {string}
     */
    static apply(markup, documentModel, options = {}) {
        const pcb = documentModel?.pcb
        if (!pcb) return markup
        const side = options?.side === 'bottom' ? 'bottom' : 'top'
        const lookup = PcbConvergenceLayerModel.buildLookup(documentModel)
        const drawingLayers = lookup.layers.filter((layer) =>
            PcbConvergenceLayerModel.isDrawingLayerForSide(layer, side)
        )
        if (!drawingLayers.length) return markup

        const selectorLayers = drawingLayers
            .filter((layer) => Number.isInteger(layer.layerId))
            .map((layer) => ({
                layerId: layer.layerId,
                name: 'Top Overlay'
            }))
        const texts = PcbTextPrimitiveRenderer.select(
            selectorLayers,
            pcb.texts || [],
            'top'
        )
        if (!texts.length) return markup

        const textMarkup = PcbTextPrimitiveRenderer.render(texts, {
            semanticContext: PcbDrawingTextComposite.#semanticContext(
                pcb,
                lookup
            )
        })
        return PcbDrawingTextComposite.#insertDrawingGroup(markup, textMarkup)
    }

    /**
     * Builds the public semantic context consumed by the historical text
     * primitive renderer.
     * @param {object} pcb PCB model.
     * @param {{ byId: Map<number, object> }} lookup Layer lookup.
     * @returns {object}
     */
    static #semanticContext(pcb, lookup) {
        return {
            layersById: lookup.byId,
            primitiveIndexes: {
                texts: new Map(
                    (pcb.texts || []).map((text, index) => [text, index])
                )
            },
            netByIndex: new Map(
                (pcb.nets || []).map((net) => [Number(net.netIndex), net])
            ),
            netClassNamesByNetName: new Map(),
            componentsByIndex: new Map(
                (pcb.components || []).map((component) => [
                    Number(component.componentIndex),
                    component
                ])
            )
        }
    }

    /**
     * Inserts one un-clipped group immediately after the ordinary text group.
     * @param {string} markup SVG panel markup.
     * @param {string} textMarkup Drawing text markup.
     * @returns {string}
     */
    static #insertDrawingGroup(markup, textMarkup) {
        const start = markup.indexOf('<g class="pcb-texts"')
        if (start < 0) return markup
        const openEnd = markup.indexOf('>', start)
        const end = PcbDrawingTextComposite.#groupEnd(markup, openEnd + 1)
        if (openEnd < 0 || end < 0) return markup
        const openTag = markup.slice(start, openEnd + 1)
        const transform = openTag.match(/\stransform="[^"]*"/u)?.[0] || ''
        const group =
            '<g class="pcb-drawing-texts"' +
            transform +
            '>' +
            textMarkup +
            '</g>'
        return markup.slice(0, end) + group + markup.slice(end)
    }

    /**
     * Finds the offset after the matching close tag for one SVG group.
     * @param {string} markup SVG markup.
     * @param {number} contentStart Group content offset.
     * @returns {number}
     */
    static #groupEnd(markup, contentStart) {
        const pattern = /<g\b[^>]*>|<\/g>/gu
        let depth = 1
        pattern.lastIndex = contentStart
        for (
            let match = pattern.exec(markup);
            match;
            match = pattern.exec(markup)
        ) {
            depth += match[0].startsWith('</') ? -1 : 1
            if (depth === 0) return pattern.lastIndex
        }
        return -1
    }
}
