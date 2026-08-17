// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbSvgRenderer as LegacyPcbSvgRenderer } from '../ui/PcbSvgRenderer.mjs'

/**
 * Renders native Altium PCB models through the preserved historical renderer
 * while applying convergence-owned copper grouping semantics.
 */
export class PcbSvgRenderer {
    static #SUBSURFACE_GROUP = '<g class="pcb-copper pcb-copper--subsurface">'
    static #SURFACE_GROUP = '<g class="pcb-copper pcb-copper--surface">'

    /**
     * Renders one native Altium PCB document as SVG markup.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @param {Record<string, any>} [options] Historical renderer options.
     * @returns {string} Rendered SVG panel markup.
     */
    static render(documentModel, options = {}) {
        const markup = LegacyPcbSvgRenderer.render(documentModel, options)
        const subsurfacePadIndexes = PcbSvgRenderer.#subsurfacePadIndexes(
            documentModel,
            options
        )
        if (subsurfacePadIndexes.length === 0) return markup

        return PcbSvgRenderer.#movePadsToSubsurfaceGroup(
            markup,
            subsurfacePadIndexes
        )
    }

    /**
     * Renders one deterministic SVG entry per physical or primitive layer.
     * Layer exports intentionally preserve the historical layer-only output.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @returns {{ layerId?: number, layerKey: string, displayName: string, role: string, svg: string }[]}
     */
    static renderLayerSvgs(documentModel) {
        return LegacyPcbSvgRenderer.renderLayerSvgs(documentModel)
    }

    /**
     * Finds pad indexes whose copper must share the contextual copper group.
     * Layer-only exports do not use composite surface/subsurface grouping.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @param {Record<string, any>} options Historical renderer options.
     * @returns {number[]} Stable pad indexes.
     */
    static #subsurfacePadIndexes(documentModel, options) {
        if (options?.layerView) return []

        return (documentModel?.pcb?.pads || [])
            .map((pad, index) =>
                pad?.copperRenderGroup === 'subsurface' ? index : -1
            )
            .filter((index) => index >= 0)
    }

    /**
     * Moves contextual pad groups into the same SVG group as contextual traces
     * so the browser composites both primitives with one shared opacity.
     * @param {string} markup Historical renderer markup.
     * @param {number[]} padIndexes Stable pad indexes to relocate.
     * @returns {string} Copper-group-aware markup.
     */
    static #movePadsToSubsurfaceGroup(markup, padIndexes) {
        const subsurfaceStart = markup.indexOf(PcbSvgRenderer.#SUBSURFACE_GROUP)
        const surfaceStart = markup.indexOf(PcbSvgRenderer.#SURFACE_GROUP)
        if (subsurfaceStart < 0 || surfaceStart <= subsurfaceStart) {
            return markup
        }

        const subsurfaceClose = markup.lastIndexOf('</g>', surfaceStart)
        if (subsurfaceClose < subsurfaceStart) return markup

        let remainingMarkup = markup
        const relocatedPads = []
        for (const padIndex of padIndexes) {
            const result = PcbSvgRenderer.#extractPadGroup(
                remainingMarkup,
                padIndex,
                surfaceStart
            )
            if (!result) continue
            remainingMarkup = result.markup
            relocatedPads.push(result.padMarkup)
        }
        if (relocatedPads.length === 0) return markup

        const updatedSurfaceStart = remainingMarkup.indexOf(
            PcbSvgRenderer.#SURFACE_GROUP
        )
        const updatedSubsurfaceClose = remainingMarkup.lastIndexOf(
            '</g>',
            updatedSurfaceStart
        )
        return (
            remainingMarkup.slice(0, updatedSubsurfaceClose) +
            relocatedPads.join('') +
            remainingMarkup.slice(updatedSubsurfaceClose)
        )
    }

    /**
     * Extracts one top-level pad group from the historical surface group.
     * Pad groups contain only leaf SVG shapes, so their first closing group is
     * also the matching closing tag.
     * @param {string} markup Current renderer markup.
     * @param {number} padIndex Stable pad index.
     * @param {number} minimumStart Earliest valid surface-group position.
     * @returns {{ markup: string, padMarkup: string } | null} Extraction result.
     */
    static #extractPadGroup(markup, padIndex, minimumStart) {
        const elementKey = 'data-element-key="pcb-pad-' + padIndex + '"'
        const keyStart = markup.indexOf(elementKey, minimumStart)
        if (keyStart < 0) return null

        const groupStart = markup.lastIndexOf('<g', keyStart)
        const groupEndStart = markup.indexOf('</g>', keyStart)
        if (groupStart < minimumStart || groupEndStart < 0) return null

        const groupEnd = groupEndStart + '</g>'.length
        return {
            markup: markup.slice(0, groupStart) + markup.slice(groupEnd),
            padMarkup: markup.slice(groupStart, groupEnd)
        }
    }
}
