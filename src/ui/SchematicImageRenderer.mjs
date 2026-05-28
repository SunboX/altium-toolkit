// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils
const MISSING_IMAGE_WRAP_SAFETY_FACTOR = 0.96

/**
 * Renders normalized schematic image placements.
 */
export class SchematicImageRenderer {
    /**
     * Builds markup for embedded schematic images and unresolved placeholders.
     * @param {{ x: number, y: number, cornerX: number, cornerY: number, fileName?: string, mimeType?: string, dataBase64?: string, diagnosticState?: string, keepAspect?: boolean }[]} images
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildMarkup(images, sheetHeight) {
        return images
            .map((image) =>
                image.dataBase64 && image.mimeType
                    ? SchematicImageRenderer.#buildEmbeddedImageMarkup(
                          image,
                          sheetHeight
                      )
                    : SchematicImageRenderer.#buildPlaceholderMarkup(
                          image,
                          sheetHeight
                      )
            )
            .join('')
    }

    /**
     * Builds one embedded SVG image node.
     * @param {{ x: number, y: number, cornerX: number, cornerY: number, mimeType: string, dataBase64: string, keepAspect?: boolean }} image
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildEmbeddedImageMarkup(image, sheetHeight) {
        const bounds = SchematicImageRenderer.#resolveBounds(image, sheetHeight)

        return (
            '<image class="schematic-embedded-image" x="' +
            formatNumber(bounds.x) +
            '" y="' +
            formatNumber(bounds.y) +
            '" width="' +
            formatNumber(bounds.width) +
            '" height="' +
            formatNumber(bounds.height) +
            '" preserveAspectRatio="' +
            escapeHtml(image.keepAspect === false ? 'none' : 'xMidYMid meet') +
            '" href="' +
            escapeHtml(
                'data:' + image.mimeType + ';base64,' + image.dataBase64
            ) +
            '" />'
        )
    }

    /**
     * Builds one placeholder frame when an image payload is unavailable.
     * @param {{ x: number, y: number, cornerX: number, cornerY: number, fileName?: string }} image
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildPlaceholderMarkup(image, sheetHeight) {
        const bounds = SchematicImageRenderer.#resolveBounds(image, sheetHeight)

        return (
            '<g class="schematic-image-placeholder">' +
            '<svg x="' +
            formatNumber(bounds.x) +
            '" y="' +
            formatNumber(bounds.y) +
            '" width="' +
            formatNumber(bounds.width) +
            '" height="' +
            formatNumber(bounds.height) +
            '" overflow="hidden">' +
            SchematicImageRenderer.#buildMissingImageMessageMarkup(
                image,
                bounds
            ) +
            '</svg>' +
            '</g>'
        )
    }

    /**
     * Builds the visible message shown by Altium for unavailable image files.
     * @param {{ fileName?: string }} image
     * @param {{ x: number, y: number, width: number, height: number }} bounds
     * @returns {string}
     */
    static #buildMissingImageMessageMarkup(image, bounds) {
        const padding = Math.min(6, Math.max(bounds.width * 0.08, 2))
        const fontSize = Math.min(8, Math.max(bounds.height / 18, 5))
        const lineHeight = fontSize * 1.18
        const usableWidth = Math.max(bounds.width - padding * 2, 1)
        const lines = SchematicImageRenderer.#buildMissingImageMessageLines(
            image.fileName,
            usableWidth * MISSING_IMAGE_WRAP_SAFETY_FACTOR,
            fontSize
        )
        const textColor = SchematicColorResolver.resolveColor(
            '#2c3134',
            '--schematic-text-color'
        )
        const startX = padding
        const startY = padding + fontSize

        return (
            '<text class="schematic-image-placeholder-message" x="' +
            formatNumber(startX) +
            '" y="' +
            formatNumber(startY) +
            '" fill="' +
            escapeHtml(textColor) +
            '" font-family="Times New Roman" font-size="' +
            formatNumber(fontSize) +
            '">' +
            lines
                .map(
                    (line, index) =>
                        '<tspan x="' +
                        formatNumber(startX) +
                        '" dy="' +
                        formatNumber(index === 0 ? 0 : lineHeight) +
                        '">' +
                        escapeHtml(line) +
                        '</tspan>'
                )
                .join('') +
            '</text>'
        )
    }

    /**
     * Wraps one missing-image message to the image placeholder width.
     * @param {string | undefined} fileName
     * @param {number} width
     * @param {number} fontSize
     * @returns {string[]}
     */
    static #buildMissingImageMessageLines(fileName, width, fontSize) {
        return [
            'Cannot open file',
            ...SchematicImageRenderer.#wrapMissingImageFileName(
                fileName || 'image file',
                width,
                fontSize
            ),
            '. File does not exist.'
        ]
    }

    /**
     * Wraps file names using conservative estimated rendered glyph widths.
     * @param {string} fileName
     * @param {number} width
     * @param {number} fontSize
     * @returns {string[]}
     */
    static #wrapMissingImageFileName(fileName, width, fontSize) {
        const maxWidth = Math.max(Number(width || 0), 1)
        const value = String(fileName || '').trim()
        const lines = []
        let line = ''
        let lineWidth = 0

        for (const character of value) {
            const characterWidth =
                SchematicImageRenderer.#estimateMissingImageCharacterWidth(
                    character,
                    fontSize
                )

            if (line && lineWidth + characterWidth > maxWidth) {
                lines.push(line)
                line = character
                lineWidth = characterWidth
                continue
            }

            line += character
            lineWidth += characterWidth
        }

        if (line) {
            lines.push(line)
        }

        return lines.length ? lines : ['image file']
    }

    /**
     * Estimates one placeholder glyph width for Times-like schematic text.
     * @param {string} character
     * @param {number} fontSize
     * @returns {number}
     */
    static #estimateMissingImageCharacterWidth(character, fontSize) {
        if (/[^\x00-\x7F]/u.test(character)) return fontSize
        if (/[A-Z]/.test(character)) return fontSize * 0.62
        if (/[a-z]/.test(character)) return fontSize * 0.45
        if (/[0-9]/.test(character)) return fontSize * 0.5
        if (/[\\/]/.test(character)) return fontSize * 0.32
        if (/[.:\-_]/.test(character)) return fontSize * 0.28

        return fontSize * 0.35
    }

    /**
     * Resolves one image placement into SVG-space bounds.
     * @param {{ x: number, y: number, cornerX: number, cornerY: number }} image
     * @param {number} sheetHeight
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    static #resolveBounds(image, sheetHeight) {
        const minX = Math.min(Number(image.x), Number(image.cornerX))
        const maxX = Math.max(Number(image.x), Number(image.cornerX))
        const minY = Math.min(Number(image.y), Number(image.cornerY))
        const maxY = Math.max(Number(image.y), Number(image.cornerY))

        return {
            x: minX,
            y: projectSchematicY(sheetHeight, maxY),
            width: maxX - minX,
            height: maxY - minY
        }
    }
}
