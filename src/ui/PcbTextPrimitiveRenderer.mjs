// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders recovered PCB text primitives.
 */
export class PcbTextPrimitiveRenderer {
    /**
     * Selects texts that belong to the requested board-side composite.
     * @param {{ layerId: number, name: string }[]} primitiveLayers
     * @param {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, visible?: boolean }[]} texts
     * @param {'top' | 'bottom'} [side]
     * @returns {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, visible?: boolean }[]}
     */
    static select(primitiveLayers, texts, side = 'top') {
        const layerIds = PcbTextPrimitiveRenderer.#resolveLayerIds(
            primitiveLayers || [],
            side
        )

        return (texts || []).filter((text) => {
            const layerId = Number(text?.layerId)
            return (
                text?.visible !== false &&
                String(text?.text || '').trim() &&
                Number.isInteger(layerId) &&
                layerIds.has(layerId)
            )
        })
    }

    /**
     * Renders selected PCB texts into SVG markup.
     * @param {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number }[]} texts
     * @returns {string}
     */
    static render(texts) {
        return (texts || [])
            .map((text) => PcbTextPrimitiveRenderer.#renderText(text))
            .join('')
    }

    /**
     * Renders one PCB text primitive.
     * @param {{ text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number }} text
     * @returns {string}
     */
    static #renderText(text) {
        const fontSize = Math.max(Number(text.height || 0), 8)
        const rotation = Number(text.rotation || 0)
        const lines = String(text.text || '')
            .replace(/\r\n?/gu, '\n')
            .split('\n')
            .filter((line) => line.length > 0)
        const content = lines.length
            ? PcbTextPrimitiveRenderer.#renderTextLines(lines, fontSize)
            : SchematicSvgUtils.escapeHtml(String(text.text || ''))

        return (
            '<text class="pcb-text pcb-text--layer-' +
            SchematicSvgUtils.escapeHtml(String(Number(text.layerId || 0))) +
            '" transform="translate(' +
            SchematicSvgUtils.formatNumber(Number(text.x || 0)) +
            ' ' +
            SchematicSvgUtils.formatNumber(Number(text.y || 0)) +
            ') rotate(' +
            SchematicSvgUtils.formatNumber(rotation) +
            ')" font-size="' +
            SchematicSvgUtils.formatNumber(fontSize) +
            '" text-anchor="start" dominant-baseline="alphabetic">' +
            content +
            '</text>'
        )
    }

    /**
     * Renders one or more text lines with SVG tspans.
     * @param {string[]} lines
     * @param {number} fontSize
     * @returns {string}
     */
    static #renderTextLines(lines, fontSize) {
        if (lines.length === 1) {
            return SchematicSvgUtils.escapeHtml(lines[0])
        }

        return lines
            .map(
                (line, index) =>
                    '<tspan x="0" dy="' +
                    SchematicSvgUtils.formatNumber(index === 0 ? 0 : fontSize) +
                    '">' +
                    SchematicSvgUtils.escapeHtml(line) +
                    '</tspan>'
            )
            .join('')
    }

    /**
     * Resolves candidate text layer ids from layer names, falling back to
     * standard Altium layer ids when legacy layer metadata is absent.
     * @param {{ layerId: number, name: string }[]} primitiveLayers
     * @param {'top' | 'bottom'} side
     * @returns {Set<number>}
     */
    static #resolveLayerIds(primitiveLayers, side) {
        const matchers = PcbTextPrimitiveRenderer.#resolveLayerMatchers(side)
        const layerIds = new Set(
            primitiveLayers
                .filter((layer) =>
                    matchers.some((matchesLayerName) =>
                        matchesLayerName(layer.name)
                    )
                )
                .map((layer) => Number(layer.layerId))
                .filter((layerId) => Number.isInteger(layerId))
        )

        if (layerIds.size) {
            return layerIds
        }

        return new Set(
            side === 'bottom' ? [32, 34, 36, 38, 73] : [1, 33, 35, 37, 73]
        )
    }

    /**
     * Resolves side-specific layer-name matchers.
     * @param {'top' | 'bottom'} side
     * @returns {((layerName: string) => boolean)[]}
     */
    static #resolveLayerMatchers(side) {
        if (side === 'bottom') {
            return [
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'BOTTOM OVERLAY'
                    ),
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'BOTTOM SOLDER'
                    ),
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'BOTTOM PASTE'
                    ),
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'L4_BOT'
                    ),
                (layerName) =>
                    PcbTextPrimitiveRenderer.#includesLayerName(
                        layerName,
                        'DRILL DRAWING'
                    )
            ]
        }

        return [
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'TOP OVERLAY'
                ),
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'TOP SOLDER'
                ),
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'TOP PASTE'
                ),
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'L1_TOP'
                ),
            (layerName) =>
                PcbTextPrimitiveRenderer.#includesLayerName(
                    layerName,
                    'DRILL DRAWING'
                )
        ]
    }

    /**
     * Returns true when a layer name contains the target token.
     * @param {string} layerName
     * @param {string} needle
     * @returns {boolean}
     */
    static #includesLayerName(layerName, needle) {
        return String(layerName || '')
            .trim()
            .toUpperCase()
            .includes(needle)
    }
}
