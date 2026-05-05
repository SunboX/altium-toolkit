// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils

/**
 * Renders authored sheet overlay regions into SVG markup.
 */
export class SchematicRegionRenderer {
    /**
     * Builds markup for authored sheet overlay regions.
     * @param {{ x: number, y: number, width: number, height: number, fill: string, renderOrder?: number }[]} regions
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildMarkup(regions, sheetHeight) {
        return regions
            .slice()
            .sort(
                (left, right) =>
                    Number(left?.renderOrder || 0) -
                    Number(right?.renderOrder || 0)
            )
            .map((region) =>
                SchematicRegionRenderer.#buildRegionMarkup(region, sheetHeight)
            )
            .join('')
    }

    /**
     * Builds one authored sheet overlay region.
     * @param {{ x: number, y: number, width: number, height: number, fill: string }} region
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildRegionMarkup(region, sheetHeight) {
        const x = Number(region?.x || 0)
        const width = Math.max(Number(region?.width || 0), 0)
        const height = Math.max(Number(region?.height || 0), 0)
        const y = projectSchematicY(
            sheetHeight,
            Number(region?.y || 0) + height
        )
        const fill = SchematicColorResolver.resolveFill(
            region?.fill,
            '--schematic-fill-light-color',
            true
        )
        const markerPoints = [
            [x + 4, y + 4],
            [x + 16, y + 4],
            [x + 4, y + 16]
        ]

        return (
            '<g class="schematic-region">' +
            '<rect class="schematic-region__fill" x="' +
            formatNumber(x) +
            '" y="' +
            formatNumber(y) +
            '" width="' +
            formatNumber(width) +
            '" height="' +
            formatNumber(height) +
            '" fill="' +
            escapeHtml(fill) +
            '" fill-opacity="0.72" />' +
            '<rect class="schematic-region__border" x="' +
            formatNumber(x) +
            '" y="' +
            formatNumber(y) +
            '" width="' +
            formatNumber(width) +
            '" height="' +
            formatNumber(height) +
            '" fill="none" stroke="var(--schematic-alert-color)" stroke-width="1" />' +
            '<polygon class="schematic-region__marker" points="' +
            escapeHtml(
                markerPoints
                    .map(
                        ([pointX, pointY]) =>
                            formatNumber(pointX) + ',' + formatNumber(pointY)
                    )
                    .join(' ')
            ) +
            '" fill="var(--schematic-alert-color)" fill-opacity="0.25" stroke="var(--schematic-alert-color)" stroke-width="1" />' +
            '</g>'
        )
    }
}
