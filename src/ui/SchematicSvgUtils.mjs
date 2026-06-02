// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Shared SVG and markup formatting helpers.
 */
export class SchematicSvgUtils {
    /**
     * Escapes user-facing markup.
     * @param {string} value
     * @returns {string}
     */
    static escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }

    /**
     * Formats a concise numeric attribute.
     * @param {number} value
     * @returns {string}
     */
    static formatNumber(value) {
        return Number(value).toFixed(2).replace(/\.00$/, '')
    }

    /**
     * Converts bottom-left schematic coordinates into SVG coordinates.
     * @param {number} sheetHeight
     * @param {number} value
     * @returns {number}
     */
    static projectSchematicY(sheetHeight, value) {
        return Number(sheetHeight) - Number(value)
    }

    /**
     * Creates one escaped SVG text element.
     * @param {string} className
     * @param {number} x
     * @param {number} y
     * @param {string} text
     * @param {string} color
     * @param {'start' | 'end' | 'middle'} anchor
     * @param {{ fontSize?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, rotation?: number, segments?: { text: string, overline?: boolean }[] }} [options]
     * @returns {string}
     */
    static createSvgText(className, x, y, text, color, anchor, options = {}) {
        const hasSegments = Array.isArray(options.segments)
            ? options.segments.some((segment) => segment?.text)
            : false
        const hasPlainText =
            text !== undefined && text !== null && String(text).length > 0
        if (!hasSegments && !hasPlainText) return ''

        return (
            '<text class="' +
            SchematicSvgUtils.escapeHtml(className) +
            '" x="' +
            SchematicSvgUtils.formatNumber(x) +
            '" y="' +
            SchematicSvgUtils.formatNumber(y) +
            '" fill="' +
            SchematicSvgUtils.escapeHtml(color) +
            '" text-anchor="' +
            SchematicSvgUtils.escapeHtml(anchor) +
            '"' +
            SchematicSvgUtils.#buildSvgTextStyleAttributes(x, y, options) +
            '>' +
            SchematicSvgUtils.#buildSvgTextContent(text, options.segments) +
            '</text>'
        )
    }

    /**
     * Returns only the trailing file segment for footer display.
     * @param {string | undefined} fileName
     * @returns {string}
     */
    static basename(fileName) {
        if (!fileName) return ''
        const parts = String(fileName).split(/[\\/]/)
        return parts.at(-1) || ''
    }

    /**
     * Formats the current date like Altium's default title block.
     * @returns {string}
     */
    static buildCurrentDateValue() {
        const today = new Date()
        const month = String(today.getMonth() + 1)
        const day = String(today.getDate()).padStart(2, '0')
        return month + '/' + day + '/' + today.getFullYear()
    }

    /**
     * Creates optional inline SVG text attributes for typography and rotation.
     * @param {number} x
     * @param {number} y
     * @param {{ fontSize?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, rotation?: number }} options
     * @returns {string}
     */
    static #buildSvgTextStyleAttributes(x, y, options) {
        let attributes = ''

        if (options.fontSize) {
            attributes +=
                ' font-size="' +
                SchematicSvgUtils.escapeHtml(
                    SchematicSvgUtils.formatNumber(options.fontSize)
                ) +
                '"'
        }

        if (options.fontFamily) {
            attributes +=
                ' font-family="' +
                SchematicSvgUtils.escapeHtml(options.fontFamily) +
                '"'
        }

        if (options.fontWeight) {
            attributes +=
                ' font-weight="' +
                SchematicSvgUtils.escapeHtml(String(options.fontWeight)) +
                '"'
        }

        if (options.fontStyle && options.fontStyle !== 'normal') {
            attributes +=
                ' font-style="' +
                SchematicSvgUtils.escapeHtml(options.fontStyle) +
                '"'
        }

        if (options.rotation) {
            attributes +=
                ' transform="rotate(' +
                SchematicSvgUtils.escapeHtml(
                    SchematicSvgUtils.formatNumber(options.rotation)
                ) +
                ' ' +
                SchematicSvgUtils.escapeHtml(
                    SchematicSvgUtils.formatNumber(x)
                ) +
                ' ' +
                SchematicSvgUtils.escapeHtml(
                    SchematicSvgUtils.formatNumber(y)
                ) +
                ')"'
        }

        return attributes
    }

    /**
     * Builds escaped text or segmented tspan markup for one SVG text element.
     * @param {string} text
     * @param {{ text: string, overline?: boolean }[] | undefined} segments
     * @returns {string}
     */
    static #buildSvgTextContent(text, segments) {
        if (
            Array.isArray(segments) &&
            segments.some((segment) => segment?.text)
        ) {
            return segments
                .filter((segment) => segment?.text)
                .map(
                    (segment) =>
                        '<tspan text-decoration="' +
                        SchematicSvgUtils.escapeHtml(
                            segment.overline ? 'overline' : 'none'
                        ) +
                        '">' +
                        SchematicSvgUtils.escapeHtml(segment.text) +
                        '</tspan>'
                )
                .join('')
        }

        return SchematicSvgUtils.escapeHtml(text)
    }
}
