// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders PCB barcode text primitives as deterministic SVG bar groups.
 */
export class PcbBarcodeTextRenderer {
    static #DEFAULT_MODULE_WIDTH = 2
    static #DEFAULT_HEIGHT_RATIO = 1.8
    static #CAPTION_RATIO = 0.34

    static #CODE39_PATTERNS = new Map([
        ['0', '101001101101'],
        ['1', '110100101011'],
        ['2', '101100101011'],
        ['3', '110110010101'],
        ['4', '101001101011'],
        ['5', '110100110101'],
        ['6', '101100110101'],
        ['7', '101001011011'],
        ['8', '110100101101'],
        ['9', '101100101101'],
        ['A', '110101001011'],
        ['B', '101101001011'],
        ['C', '110110100101'],
        ['D', '101011001011'],
        ['E', '110101100101'],
        ['F', '101101100101'],
        ['G', '101010011011'],
        ['H', '110101001101'],
        ['I', '101101001101'],
        ['J', '101011001101'],
        ['K', '110101010011'],
        ['L', '101101010011'],
        ['M', '110110101001'],
        ['N', '101011010011'],
        ['O', '110101101001'],
        ['P', '101101101001'],
        ['Q', '101010110011'],
        ['R', '110101011001'],
        ['S', '101101011001'],
        ['T', '101011011001'],
        ['U', '110010101011'],
        ['V', '100110101011'],
        ['W', '110011010101'],
        ['X', '100101101011'],
        ['Y', '110010110101'],
        ['Z', '100110110101'],
        ['-', '100101011011'],
        ['.', '110010101101'],
        [' ', '100110101101'],
        ['$', '100100100101'],
        ['/', '100100101001'],
        ['+', '100101001001'],
        ['%', '101001001001'],
        ['*', '100101101101']
    ])

    static #CODE128_PATTERNS = [
        '11011001100',
        '11001101100',
        '11001100110',
        '10010011000',
        '10010001100',
        '10001001100',
        '10011001000',
        '10011000100',
        '10001100100',
        '11001001000',
        '11001000100',
        '11000100100',
        '10110011100',
        '10011011100',
        '10011001110',
        '10111001100',
        '10011101100',
        '10011100110',
        '11001110010',
        '11001011100',
        '11001001110',
        '11011100100',
        '11001110100',
        '11101101110',
        '11101001100',
        '11100101100',
        '11100100110',
        '11101100100',
        '11100110100',
        '11100110010',
        '11011011000',
        '11011000110',
        '11000110110',
        '10100011000',
        '10001011000',
        '10001000110',
        '10110001000',
        '10001101000',
        '10001100010',
        '11010001000',
        '11000101000',
        '11000100010',
        '10110111000',
        '10110001110',
        '10001101110',
        '10111011000',
        '10111000110',
        '10001110110',
        '11101110110',
        '11010001110',
        '11000101110',
        '11011101000',
        '11011100010',
        '11011101110',
        '11101011000',
        '11101000110',
        '11100010110',
        '11101101000',
        '11101100010',
        '11100011010',
        '11101111010',
        '11001000010',
        '11110001010',
        '10100110000',
        '10100001100',
        '10010110000',
        '10010000110',
        '10000101100',
        '10000100110',
        '10110010000',
        '10110000100',
        '10011010000',
        '10011000010',
        '10000110100',
        '10000110010',
        '11000010010',
        '11001010000',
        '11110111010',
        '11000010100',
        '10001111010',
        '10100111100',
        '10010111100',
        '10010011110',
        '10111100100',
        '10011110100',
        '10011110010',
        '11110100100',
        '11110010100',
        '11110010010',
        '11011011110',
        '11011110110',
        '11110110110',
        '10101111000',
        '10100011110',
        '10001011110',
        '10111101000',
        '10111100010',
        '11110101000',
        '11110100010',
        '10111011110',
        '10111101110',
        '11101011110',
        '11110101110',
        '11010000100',
        '11010010000',
        '11010011100',
        '1100011101011'
    ]

    /**
     * Renders one barcode text primitive.
     * @param {{ text: string, layerId?: number, barcode?: object }} text Text primitive.
     * @param {{ transform: string, fontSize: number, semanticAttributes: string }} options Render options.
     * @returns {string}
     */
    static render(text, options) {
        const encoding = PcbBarcodeTextRenderer.#encoding(text)
        const layout = PcbBarcodeTextRenderer.#layout(
            text,
            options.fontSize,
            encoding.pattern.length
        )
        const bars = PcbBarcodeTextRenderer.#bars(encoding.pattern, layout)
        const className =
            'pcb-text pcb-text--layer-' +
            SchematicSvgUtils.escapeHtml(String(Number(text.layerId || 0))) +
            ' pcb-text--barcode' +
            (text?.barcode?.inverted ? ' pcb-text--barcode-inverted' : '')
        const background = text?.barcode?.inverted
            ? '<rect class="pcb-barcode__background" x="0" y="0" width="' +
              SchematicSvgUtils.formatNumber(layout.width) +
              '" height="' +
              SchematicSvgUtils.formatNumber(layout.height) +
              '" />'
            : ''
        const caption = text?.barcode?.showText
            ? PcbBarcodeTextRenderer.#caption(text, layout)
            : ''

        return (
            '<g class="' +
            className +
            '" transform="' +
            options.transform +
            '"' +
            options.semanticAttributes +
            ' data-barcode-symbology="' +
            SchematicSvgUtils.escapeHtml(encoding.symbology) +
            '" data-barcode-module-count="' +
            SchematicSvgUtils.escapeHtml(String(encoding.pattern.length)) +
            '"' +
            '>' +
            background +
            '<g class="pcb-barcode__bars" transform="translate(' +
            SchematicSvgUtils.formatNumber(layout.marginX) +
            ' ' +
            SchematicSvgUtils.formatNumber(layout.marginY) +
            ')">' +
            bars +
            '</g>' +
            caption +
            '</g>'
        )
    }

    /**
     * Resolves barcode layout dimensions.
     * @param {{ text: string, height?: number, barcode?: object }} text Text primitive.
     * @param {number} fontSize Resolved text font size.
     * @param {number} patternLength Encoded module count.
     * @returns {{ width: number, height: number, barHeight: number, marginX: number, marginY: number, moduleWidth: number }}
     */
    static #layout(text, fontSize, patternLength) {
        const barcode = text?.barcode || {}
        const moduleWidth = Math.max(
            Number(barcode.minBarWidth) ||
                PcbBarcodeTextRenderer.#DEFAULT_MODULE_WIDTH,
            0.1
        )
        const contentWidth = patternLength * moduleWidth
        const marginX = Math.max(Number(barcode.marginX) || moduleWidth, 0)
        const marginY = Math.max(Number(barcode.marginY) || moduleWidth, 0)
        const width = Math.max(
            Number(barcode.fullWidth) || 0,
            contentWidth + marginX * 2
        )
        const height = Math.max(
            Number(barcode.fullHeight) || 0,
            fontSize * PcbBarcodeTextRenderer.#DEFAULT_HEIGHT_RATIO
        )
        const captionHeight = barcode.showText
            ? fontSize * PcbBarcodeTextRenderer.#CAPTION_RATIO
            : 0

        return {
            width,
            height,
            barHeight: Math.max(height - marginY * 2 - captionHeight, 1),
            marginX,
            marginY,
            moduleWidth:
                contentWidth > 0
                    ? Math.max((width - marginX * 2) / patternLength, 0.1)
                    : moduleWidth
        }
    }

    /**
     * Renders barcode bars.
     * @param {string} pattern Encoded barcode module pattern.
     * @param {{ barHeight: number, moduleWidth: number }} layout Barcode layout.
     * @returns {string}
     */
    static #bars(pattern, layout) {
        const runs = []
        let cursor = 0

        while (cursor < pattern.length) {
            const value = pattern[cursor]
            let length = 1
            while (pattern[cursor + length] === value) {
                length += 1
            }
            if (value === '1') {
                runs.push({ offset: cursor, length })
            }
            cursor += length
        }

        return runs
            .map(
                (run) =>
                    '<rect class="pcb-barcode__bar" x="' +
                    SchematicSvgUtils.formatNumber(
                        run.offset * layout.moduleWidth
                    ) +
                    '" y="0" width="' +
                    SchematicSvgUtils.formatNumber(
                        run.length * layout.moduleWidth
                    ) +
                    '" height="' +
                    SchematicSvgUtils.formatNumber(layout.barHeight) +
                    '" />'
            )
            .join('')
    }

    /**
     * Renders optional human-readable barcode text.
     * @param {{ text: string }} text Text primitive.
     * @param {{ width: number, height: number, marginY: number }} layout Barcode layout.
     * @returns {string}
     */
    static #caption(text, layout) {
        const fontSize = Math.max(layout.height * 0.16, 4)

        return (
            '<text class="pcb-barcode__caption" x="' +
            SchematicSvgUtils.formatNumber(layout.width / 2) +
            '" y="' +
            SchematicSvgUtils.formatNumber(layout.height - layout.marginY) +
            '" font-size="' +
            SchematicSvgUtils.formatNumber(fontSize) +
            '" text-anchor="middle" dominant-baseline="alphabetic">' +
            SchematicSvgUtils.escapeHtml(String(text.text || '')) +
            '</text>'
        )
    }

    /**
     * Encodes one barcode payload.
     * @param {{ text: string, barcode?: object }} text Text primitive.
     * @returns {{ pattern: string, symbology: string }}
     */
    static #encoding(text) {
        const kind = String(text?.barcode?.kindName || '').toLowerCase()
        if (kind === 'code39') {
            return PcbBarcodeTextRenderer.#encodeCode39(text)
        }
        if (kind === 'code128') {
            return PcbBarcodeTextRenderer.#encodeCode128B(text)
        }

        return {
            pattern: PcbBarcodeTextRenderer.#fallbackPattern(text),
            symbology: 'deterministic'
        }
    }

    /**
     * Encodes valid Code 39 content.
     * @param {{ text: string }} text Text primitive.
     * @returns {{ pattern: string, symbology: string }}
     */
    static #encodeCode39(text) {
        const content = String(text?.text || '').toUpperCase()
        const encoded = '*' + content + '*'
        const parts = []

        for (const character of encoded) {
            const pattern =
                PcbBarcodeTextRenderer.#CODE39_PATTERNS.get(character)
            if (!pattern) {
                return {
                    pattern: PcbBarcodeTextRenderer.#fallbackPattern(text),
                    symbology: 'deterministic'
                }
            }
            parts.push(pattern)
        }

        return {
            pattern: parts.join('0'),
            symbology: 'Code 39'
        }
    }

    /**
     * Encodes printable ASCII content as Code 128 set B.
     * @param {{ text: string }} text Text primitive.
     * @returns {{ pattern: string, symbology: string }}
     */
    static #encodeCode128B(text) {
        const values = [104]
        for (const character of String(text?.text || '')) {
            const codePoint = character.codePointAt(0) || 63
            const value =
                codePoint >= 32 && codePoint <= 127 ? codePoint - 32 : 31
            values.push(value)
        }

        let checksum = values[0]
        for (let index = 1; index < values.length; index += 1) {
            checksum += values[index] * index
        }
        values.push(checksum % 103)
        values.push(106)

        return {
            pattern: values
                .map((value) => PcbBarcodeTextRenderer.#CODE128_PATTERNS[value])
                .join(''),
            symbology: 'Code 128B'
        }
    }

    /**
     * Builds a deterministic fallback module pattern for unsupported content.
     * @param {{ text: string }} text Text primitive.
     * @returns {string}
     */
    static #fallbackPattern(text) {
        const value = String(text?.text || '')
        const parts = ['11010010000']
        for (const character of value) {
            parts.push(
                PcbBarcodeTextRenderer.#fallbackCharacterPattern(character)
            )
        }
        parts.push('1100011101011')
        return parts.join('0')
    }

    /**
     * Builds a stable 11-module fallback pattern for one character.
     * @param {string} character Barcode character.
     * @returns {string}
     */
    static #fallbackCharacterPattern(character) {
        const code = character.codePointAt(0) || 0
        const mixed = (code * 1103515245 + 12345) >>> 0
        return mixed.toString(2).padStart(32, '0').slice(0, 11)
    }
}
