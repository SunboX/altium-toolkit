// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils

/**
 * Renders normalized schematic image placements.
 */
export class SchematicImageRenderer {
    /**
     * Builds markup for embedded schematic images and unresolved placeholders.
     * @param {{ x: number, y: number, cornerX: number, cornerY: number, mimeType?: string, dataBase64?: string, diagnosticState?: string, keepAspect?: boolean }[]} images
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
     * @param {{ x: number, y: number, cornerX: number, cornerY: number }} image
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildPlaceholderMarkup(image, sheetHeight) {
        const bounds = SchematicImageRenderer.#resolveBounds(image, sheetHeight)
        const stroke = SchematicColorResolver.resolveColor(
            '#c0c0c0',
            '--schematic-note-border-color'
        )

        return (
            '<g class="schematic-image-placeholder">' +
            '<rect x="' +
            formatNumber(bounds.x) +
            '" y="' +
            formatNumber(bounds.y) +
            '" width="' +
            formatNumber(bounds.width) +
            '" height="' +
            formatNumber(bounds.height) +
            '" fill="none" stroke="' +
            escapeHtml(stroke) +
            '" stroke-width="1" />' +
            '<line x1="' +
            formatNumber(bounds.x) +
            '" y1="' +
            formatNumber(bounds.y) +
            '" x2="' +
            formatNumber(bounds.x + bounds.width) +
            '" y2="' +
            formatNumber(bounds.y + bounds.height) +
            '" stroke="' +
            escapeHtml(stroke) +
            '" stroke-width="1" />' +
            '<line x1="' +
            formatNumber(bounds.x) +
            '" y1="' +
            formatNumber(bounds.y + bounds.height) +
            '" x2="' +
            formatNumber(bounds.x + bounds.width) +
            '" y2="' +
            formatNumber(bounds.y) +
            '" stroke="' +
            escapeHtml(stroke) +
            '" stroke-width="1" />' +
            '</g>'
        )
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
