// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

const { createSvgText, formatNumber } = SchematicSvgUtils

/**
 * Renders schematic border zone labels and separators.
 */
export class SchematicSheetZoneRenderer {
    /**
     * Builds the border zone labels around the sheet frame.
     * @param {number} width
     * @param {number} height
     * @param {number} margin
     * @param {{ borderOn?: boolean, xZones?: number, yZones?: number }} sheet
     * @returns {string}
     */
    static buildMarkup(width, height, margin, sheet) {
        if (!sheet?.borderOn) return ''

        const xZones = Math.max(Number(sheet?.xZones || 0), 1)
        const yZones = Math.max(Number(sheet?.yZones || 0), 1)
        const innerWidth = Math.max(width - margin * 2, 10)
        const innerHeight = Math.max(height - margin * 2, 10)
        const separator = (x1, y1, x2, y2) =>
            '<line class="sheet-zone-separator" x1="' +
            formatNumber(x1) +
            '" y1="' +
            formatNumber(y1) +
            '" x2="' +
            formatNumber(x2) +
            '" y2="' +
            formatNumber(y2) +
            '" />'
        let markup = ''

        for (let index = 1; index < xZones; index += 1) {
            const x = margin + (innerWidth * index) / xZones

            markup +=
                separator(x, 0, x, margin) +
                separator(x, height - margin, x, height)
        }

        for (let index = 0; index < xZones; index += 1) {
            const label = String(index + 1)
            const x = margin + (innerWidth * (index + 0.5)) / xZones

            markup +=
                createSvgText(
                    'sheet-zone-label',
                    x,
                    margin - 6,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-zone-label',
                    x,
                    height - 4,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                )
        }

        for (let index = 1; index < yZones; index += 1) {
            const y = margin + (innerHeight * index) / yZones

            markup +=
                separator(0, y, margin, y) +
                separator(width - margin, y, width, y)
        }

        for (let index = 0; index < yZones; index += 1) {
            const label = String.fromCharCode(65 + index)
            const y = margin + (innerHeight * (index + 0.5)) / yZones

            markup +=
                createSvgText(
                    'sheet-zone-label',
                    8,
                    y + 2,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-zone-label',
                    width - 8,
                    y + 2,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                )
        }

        return markup
    }
}
