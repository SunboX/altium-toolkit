// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbSvgRenderer as LegacyPcbSvgRenderer } from '../ui/PcbSvgRenderer.mjs'
import { PcbDrawingTextComposite } from './PcbDrawingTextComposite.mjs'
import { PcbVisibleLayerViewport } from './PcbVisibleLayerViewport.mjs'

/**
 * Renders native Altium PCB models through the preserved historical renderer
 * while applying convergence-owned copper grouping semantics.
 */
export class PcbSvgRenderer {
    static #SUBSURFACE_GROUP = '<g class="pcb-copper pcb-copper--subsurface">'
    static #SURFACE_GROUP = '<g class="pcb-copper pcb-copper--surface">'
    static #FOOTPRINT_GROUP = '<g class="pcb-footprints">'

    /**
     * Renders one native Altium PCB document as SVG markup.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @param {Record<string, any>} [options] Historical renderer options.
     * @returns {string} Rendered SVG panel markup.
     */
    static render(documentModel, options = {}) {
        const historicalMarkup = LegacyPcbSvgRenderer.render(
            documentModel,
            options
        )
        const drawingMarkup = PcbDrawingTextComposite.apply(
            historicalMarkup,
            documentModel,
            options
        )
        const markup = PcbVisibleLayerViewport.apply(
            drawingMarkup,
            documentModel,
            options,
            (filteredDocument, filteredOptions) =>
                LegacyPcbSvgRenderer.render(filteredDocument, filteredOptions)
        )
        const subsurfacePadIndexes = PcbSvgRenderer.#subsurfacePadIndexes(
            documentModel,
            options
        )
        if (subsurfacePadIndexes.size === 0) return markup

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
     * @returns {Set<number>} Stable pad indexes.
     */
    static #subsurfacePadIndexes(documentModel, options) {
        if (options?.layerView) return new Set()

        const indexes = new Set()
        for (const [index, pad] of (documentModel?.pcb?.pads || []).entries()) {
            if (pad?.copperRenderGroup === 'subsurface') {
                indexes.add(index)
            }
        }
        return indexes
    }

    /**
     * Moves contextual pad groups into the same SVG group as contextual traces
     * with one forward scan and one final markup reconstruction.
     * @param {string} markup Historical renderer markup.
     * @param {Set<number>} padIndexes Stable pad indexes to relocate.
     * @returns {string} Copper-group-aware markup.
     */
    static #movePadsToSubsurfaceGroup(markup, padIndexes) {
        const subsurfaceStart = markup.indexOf(PcbSvgRenderer.#SUBSURFACE_GROUP)
        const surfaceStart = markup.indexOf(PcbSvgRenderer.#SURFACE_GROUP)
        const surfaceEnd = markup.indexOf(
            PcbSvgRenderer.#FOOTPRINT_GROUP,
            surfaceStart
        )
        if (
            subsurfaceStart < 0 ||
            surfaceStart <= subsurfaceStart ||
            surfaceEnd <= surfaceStart
        ) {
            return markup
        }

        const subsurfaceClose = markup.lastIndexOf('</g>', surfaceStart)
        if (subsurfaceClose < subsurfaceStart) return markup

        const partition = PcbSvgRenderer.#partitionSurfacePads(
            markup,
            surfaceStart,
            surfaceEnd,
            padIndexes
        )
        if (!partition.subsurfacePadMarkup) return markup

        return (
            markup.slice(0, subsurfaceClose) +
            partition.subsurfacePadMarkup +
            markup.slice(subsurfaceClose, surfaceStart) +
            partition.surfaceMarkup +
            markup.slice(surfaceEnd)
        )
    }

    /**
     * Partitions selected top-level pad groups from one surface-group span.
     * @param {string} markup Complete historical renderer markup.
     * @param {number} start Surface-group start offset.
     * @param {number} end Surface-group end offset.
     * @param {Set<number>} padIndexes Stable pad indexes to relocate.
     * @returns {{ surfaceMarkup: string, subsurfacePadMarkup: string }}
     */
    static #partitionSurfacePads(markup, start, end, padIndexes) {
        const surfaceFragments = []
        const subsurfacePadFragments = []
        const padGroupPattern =
            /<g class="pcb-pad\b[^"]*"[^>]*data-element-key="pcb-pad-(\d+)"[^>]*>/gu
        let cursor = start
        padGroupPattern.lastIndex = start

        for (
            let match = padGroupPattern.exec(markup);
            match && match.index < end;
            match = padGroupPattern.exec(markup)
        ) {
            const groupEnd = PcbSvgRenderer.#groupEnd(
                markup,
                padGroupPattern.lastIndex,
                end
            )
            if (groupEnd < 0) break

            if (padIndexes.has(Number(match[1]))) {
                surfaceFragments.push(markup.slice(cursor, match.index))
                subsurfacePadFragments.push(markup.slice(match.index, groupEnd))
                cursor = groupEnd
            }
            padGroupPattern.lastIndex = groupEnd
        }

        surfaceFragments.push(markup.slice(cursor, end))
        return {
            surfaceMarkup: surfaceFragments.join(''),
            subsurfacePadMarkup: subsurfacePadFragments.join('')
        }
    }

    /**
     * Finds the matching close for one renderer-owned pad group.
     * @param {string} markup Complete historical renderer markup.
     * @param {number} contentStart Offset immediately after the pad open tag.
     * @param {number} limit Exclusive end of the surface-group span.
     * @returns {number} Offset immediately after the matching close, or -1.
     */
    static #groupEnd(markup, contentStart, limit) {
        const groupTagPattern = /<g\b[^>]*>|<\/g>/gu
        let depth = 1
        groupTagPattern.lastIndex = contentStart

        for (
            let match = groupTagPattern.exec(markup);
            match && match.index < limit;
            match = groupTagPattern.exec(markup)
        ) {
            depth += match[0] === '</g>' ? -1 : 1
            if (depth === 0) return groupTagPattern.lastIndex
        }
        return -1
    }
}
