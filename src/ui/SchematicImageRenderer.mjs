// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'
import { SchematicPowerDiagramImageProcessor } from './SchematicPowerDiagramImageProcessor.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils
const MISSING_IMAGE_WRAP_SAFETY_FACTOR = 0.96
const BLUEPRINT_IMAGE_FILTER_ID = 'schematic-blueprint-image-filter'

/**
 * Renders normalized schematic image placements.
 */
export class SchematicImageRenderer {
    /**
     * Builds markup for embedded schematic images and unresolved placeholders.
     * @param {{ x: number, y: number, cornerX: number, cornerY: number, fileName?: string, mimeType?: string, dataBase64?: string, diagnosticState?: string, keepAspect?: boolean }[]} images
     * @param {number} sheetHeight
     * @param {{ colorizeImages?: boolean, colorize_images?: boolean }} options Image render options.
     * @returns {string}
     */
    static buildMarkup(images, sheetHeight, options = {}) {
        const renderOptions =
            SchematicImageRenderer.#normalizeRenderOptions(options)
        const imageMarkup = images
            .map((image) =>
                image.dataBase64 && image.mimeType
                    ? SchematicImageRenderer.#buildEmbeddedImageMarkup(
                          image,
                          sheetHeight,
                          renderOptions
                      )
                    : SchematicImageRenderer.#buildPlaceholderMarkup(
                          image,
                          sheetHeight
                      )
            )
            .join('')

        return (
            SchematicImageRenderer.#buildImageFilterMarkup(
                images,
                renderOptions
            ) + imageMarkup
        )
    }

    /**
     * Normalizes image renderer options.
     * @param {{ colorizeImages?: boolean, colorize_images?: boolean }} options Raw options.
     * @returns {{ colorizeImages: boolean }}
     */
    static #normalizeRenderOptions(options) {
        return {
            colorizeImages:
                options?.colorizeImages === true ||
                options?.colorize_images === true
        }
    }

    /**
     * Builds any SVG filters needed by the embedded image set.
     * @param {{ x: number, y: number, cornerX: number, cornerY: number, fileName?: string, mimeType?: string, dataBase64?: string }[]} images
     * @param {{ colorizeImages: boolean }} options Normalized render options.
     * @returns {string}
     */
    static #buildImageFilterMarkup(images, options) {
        if (!options.colorizeImages) return ''

        const hasDiagramImage = (images || []).some(
            (image) =>
                image?.dataBase64 &&
                image?.mimeType &&
                SchematicImageRenderer.#isDiagramImage(image) &&
                !SchematicImageRenderer.#isPowerDiagramImage(image)
        )

        if (!hasDiagramImage) return ''

        return (
            '<defs>' +
            SchematicImageRenderer.#buildBlueprintImageFilterMarkup() +
            '</defs>'
        )
    }

    /**
     * Builds one embedded SVG image node.
     * @param {{ x: number, y: number, cornerX: number, cornerY: number, fileName?: string, mimeType: string, dataBase64: string, keepAspect?: boolean }} image
     * @param {number} sheetHeight
     * @param {{ colorizeImages: boolean }} options Normalized render options.
     * @returns {string}
     */
    static #buildEmbeddedImageMarkup(image, sheetHeight, options) {
        const bounds = SchematicImageRenderer.#resolveBounds(image, sheetHeight)
        const isDiagramImage = SchematicImageRenderer.#isDiagramImage(image)
        const isPowerDiagramImage =
            SchematicImageRenderer.#isPowerDiagramImage(image)
        const colorizeImage = options.colorizeImages
        const dataBase64 =
            colorizeImage && isPowerDiagramImage
                ? SchematicPowerDiagramImageProcessor.process(image)
                : image.dataBase64

        return (
            '<image class="' +
            escapeHtml(
                isPowerDiagramImage
                    ? 'schematic-embedded-image schematic-embedded-image--power-diagram'
                    : isDiagramImage
                      ? 'schematic-embedded-image schematic-embedded-image--diagram'
                      : 'schematic-embedded-image'
            ) +
            '" x="' +
            formatNumber(bounds.x) +
            '" y="' +
            formatNumber(bounds.y) +
            '" width="' +
            formatNumber(bounds.width) +
            '" height="' +
            formatNumber(bounds.height) +
            '" preserveAspectRatio="' +
            escapeHtml(image.keepAspect === false ? 'none' : 'xMidYMid meet') +
            '"' +
            (colorizeImage && isDiagramImage && !isPowerDiagramImage
                ? ' filter="url(#' +
                  escapeHtml(BLUEPRINT_IMAGE_FILTER_ID) +
                  ')"'
                : '') +
            ' href="' +
            escapeHtml('data:' + image.mimeType + ';base64,' + dataBase64) +
            '" />'
        )
    }

    /**
     * Builds a filter that maps black diagram artwork to the schematic blue
     * ink while keeping white backgrounds white.
     * @returns {string}
     */
    static #buildBlueprintImageFilterMarkup() {
        return (
            '<filter id="' +
            escapeHtml(BLUEPRINT_IMAGE_FILTER_ID) +
            '" color-interpolation-filters="sRGB">' +
            '<feColorMatrix type="matrix" values="' +
            '1 0 0 0 0 ' +
            '0 0.431 0 0 0.569 ' +
            '0 0 0.325 0 0.675 ' +
            '0 0 0 1 0' +
            '" />' +
            '</filter>'
        )
    }

    /**
     * Identifies recovered diagram artwork by explicit file naming.
     * @param {{ fileName?: string, mimeType?: string }} image
     * @returns {boolean}
     */
    static #isDiagramImage(image) {
        return /diagram/i.test(String(image?.fileName || ''))
    }

    /**
     * Identifies recovered power-diagram PNG artwork for selective palette
     * processing.
     * @param {{ fileName?: string, mimeType?: string }} image
     * @returns {boolean}
     */
    static #isPowerDiagramImage(image) {
        return (
            image?.mimeType === 'image/png' &&
            /power/i.test(String(image?.fileName || ''))
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
