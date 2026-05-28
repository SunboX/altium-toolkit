// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils
const MINIMUM_NOTE_TEXT_SIZE = 4

/**
 * Renders boxed schematic notes recovered from Altium note records.
 */
export class SchematicNoteRenderer {
    /**
     * Builds one boxed schematic note/callout with wrapped text rows.
     * @param {{ x: number, y: number, color: string, fontSize?: number, fontFamily?: string, fontWeight?: number, cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }} text
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildMarkup(text, sheetHeight) {
        const left = Math.min(text.x, text.cornerX || text.x)
        const right = Math.max(text.x, text.cornerX || text.x)
        const top = Math.min(
            projectSchematicY(sheetHeight, text.y),
            projectSchematicY(sheetHeight, text.cornerY || text.y)
        )
        const bottom = Math.max(
            projectSchematicY(sheetHeight, text.y),
            projectSchematicY(sheetHeight, text.cornerY || text.y)
        )
        const width = Math.max(right - left, 1)
        const height = Math.max(bottom - top, 1)
        const textMargin = Math.max(Number(text.textMargin || 4), 3)
        const requestedTextSize = Math.max(
            Number(
                SchematicTypography.resolveViewerFontSize(text.fontSize || 8) ||
                    MINIMUM_NOTE_TEXT_SIZE
            ),
            MINIMUM_NOTE_TEXT_SIZE
        )
        const noteFill = SchematicColorResolver.resolveFill(
            text.isSolid === false
                ? 'transparent'
                : text.fill || 'var(--schematic-note-fill-color)',
            '--schematic-note-fill-color'
        )
        const borderColor = SchematicColorResolver.resolveColor(
            text.borderColor || 'var(--schematic-note-border-color)',
            '--schematic-note-border-color'
        )
        const noteStroke = text.showBorder ? borderColor : 'none'
        const noteSourceLines = text.noteLines || []
        const verticalTextMargin =
            SchematicNoteRenderer.#resolveVerticalTextMargin(
                textMargin,
                height,
                requestedTextSize
            )
        const layout = SchematicNoteRenderer.#resolveTextLayout(
            noteSourceLines,
            Math.max(width - textMargin * 2, requestedTextSize),
            Math.max(height - verticalTextMargin * 2, requestedTextSize),
            requestedTextSize,
            SchematicNoteRenderer.#isCompactSingleLineNote(
                noteSourceLines,
                height,
                requestedTextSize
            )
        )
        const noteLines = layout.noteLines
        const textSize = layout.textSize
        const lineHeight = layout.lineHeight
        const textMarkup = noteLines
            .map((line, index) =>
                SchematicNoteRenderer.#buildNoteLineMarkup(
                    line,
                    index,
                    left,
                    right,
                    top,
                    textMargin,
                    verticalTextMargin,
                    lineHeight,
                    textSize,
                    text
                )
            )
            .join('')

        return (
            '<g class="schematic-note">' +
            '<rect class="schematic-note-box" x="' +
            formatNumber(left) +
            '" y="' +
            formatNumber(top) +
            '" width="' +
            formatNumber(width) +
            '" height="' +
            formatNumber(height) +
            '" fill="' +
            escapeHtml(noteFill) +
            '" stroke="' +
            escapeHtml(noteStroke) +
            '" />' +
            textMarkup +
            '</g>'
        )
    }

    /**
     * Resolves wrapped note rows and a fitting text layout for one note box.
     * @param {string[]} noteLines
     * @param {number} maxWidth
     * @param {number} maxHeight
     * @param {number} requestedTextSize
     * @param {boolean} keepSingleLineSize
     * @returns {{ noteLines: string[], textSize: number, lineHeight: number }}
     */
    static #resolveTextLayout(
        noteLines,
        maxWidth,
        maxHeight,
        requestedTextSize,
        keepSingleLineSize = false
    ) {
        if (keepSingleLineSize) {
            const visibleLines = noteLines.filter((line) =>
                String(line || '').trim()
            )

            return {
                noteLines: visibleLines,
                textSize: requestedTextSize,
                lineHeight: SchematicNoteRenderer.#resolveLineHeight(
                    requestedTextSize,
                    maxHeight,
                    0,
                    visibleLines.length
                )
            }
        }

        let textSize = requestedTextSize
        let wrappedLines = []

        for (let attempt = 0; attempt < 6; attempt += 1) {
            wrappedLines = SchematicNoteRenderer.#wrapNoteLines(
                noteLines,
                maxWidth,
                textSize
            )

            const lineHeight = SchematicNoteRenderer.#resolveLineHeight(
                textSize,
                maxHeight,
                0,
                wrappedLines.length
            )
            const requiredHeight =
                wrappedLines.length <= 0
                    ? 0
                    : textSize + lineHeight * (wrappedLines.length - 1)

            if (
                requiredHeight <= maxHeight ||
                textSize <= MINIMUM_NOTE_TEXT_SIZE
            ) {
                return {
                    noteLines: wrappedLines,
                    textSize,
                    lineHeight
                }
            }

            const nextSize = Math.max(
                MINIMUM_NOTE_TEXT_SIZE,
                Math.min(
                    textSize - 0.5,
                    textSize * (maxHeight / requiredHeight)
                )
            )

            if (nextSize >= textSize) {
                break
            }

            textSize = nextSize
        }

        return {
            noteLines: wrappedLines,
            textSize,
            lineHeight: SchematicNoteRenderer.#resolveLineHeight(
                textSize,
                maxHeight,
                0,
                wrappedLines.length
            )
        }
    }

    /**
     * Wraps recovered note rows to the available note-box width.
     * @param {string[]} noteLines
     * @param {number} maxWidth
     * @param {number} textSize
     * @returns {string[]}
     */
    static #wrapNoteLines(noteLines, maxWidth, textSize) {
        return noteLines.flatMap((line) =>
            SchematicNoteRenderer.#wrapSingleLine(line, maxWidth, textSize)
        )
    }

    /**
     * Wraps one visible note row to the available width.
     * @param {string} line
     * @param {number} maxWidth
     * @param {number} textSize
     * @returns {string[]}
     */
    static #wrapSingleLine(line, maxWidth, textSize) {
        const normalizedLine = String(line || '').trim()
        if (!normalizedLine) {
            return []
        }

        if (/^_+$/.test(normalizedLine)) {
            return [normalizedLine]
        }

        if (
            SchematicNoteRenderer.#estimateTextWidth(
                normalizedLine,
                textSize
            ) <= maxWidth
        ) {
            return [normalizedLine]
        }

        const wrappedLines = []
        let currentLine = ''
        const tokens = normalizedLine.match(/\S+\s*/g) || [normalizedLine]

        for (const token of tokens) {
            const trimmedToken = token.trim()
            if (!trimmedToken) {
                continue
            }

            const candidateLine = (currentLine + token).trimEnd()
            if (
                currentLine &&
                SchematicNoteRenderer.#estimateTextWidth(
                    candidateLine,
                    textSize
                ) > maxWidth
            ) {
                wrappedLines.push(currentLine.trimEnd())
                currentLine = ''
            }

            if (
                SchematicNoteRenderer.#estimateTextWidth(
                    trimmedToken,
                    textSize
                ) > maxWidth
            ) {
                const tokenLines = SchematicNoteRenderer.#wrapLongToken(
                    trimmedToken,
                    maxWidth,
                    textSize
                )

                if (currentLine) {
                    wrappedLines.push(currentLine.trimEnd())
                    currentLine = ''
                }

                wrappedLines.push(...tokenLines.slice(0, -1))
                currentLine = tokenLines[tokenLines.length - 1] || ''
                continue
            }

            currentLine = (currentLine + token).trimStart()
        }

        if (currentLine) {
            wrappedLines.push(currentLine.trimEnd())
        }

        return wrappedLines
    }

    /**
     * Checks if a note is a tight one-line callout where Altium preserves the
     * text size even when the note rectangle has little vertical padding.
     * @param {string[]} noteLines
     * @param {number} height
     * @param {number} requestedTextSize
     * @returns {boolean}
     */
    static #isCompactSingleLineNote(noteLines, height, requestedTextSize) {
        const visibleLineCount = noteLines.filter((line) =>
            String(line || '').trim()
        ).length

        return visibleLineCount === 1 && height <= requestedTextSize * 1.5
    }

    /**
     * Reduces vertical padding for short note rectangles so readable text is
     * centered instead of scaled down to satisfy the default margin.
     * @param {number} textMargin
     * @param {number} height
     * @param {number} requestedTextSize
     * @returns {number}
     */
    static #resolveVerticalTextMargin(textMargin, height, requestedTextSize) {
        const centeredMargin = Math.max((height - requestedTextSize) / 2, 0)

        return Math.min(textMargin, centeredMargin)
    }

    /**
     * Splits one oversized token into smaller width-safe fragments.
     * @param {string} token
     * @param {number} maxWidth
     * @param {number} textSize
     * @returns {string[]}
     */
    static #wrapLongToken(token, maxWidth, textSize) {
        const fragments = []
        let currentFragment = ''

        for (const character of token) {
            const candidateFragment = currentFragment + character
            if (
                currentFragment &&
                SchematicNoteRenderer.#estimateTextWidth(
                    candidateFragment,
                    textSize
                ) > maxWidth
            ) {
                fragments.push(currentFragment)
                currentFragment = character
                continue
            }

            currentFragment = candidateFragment
        }

        if (currentFragment) {
            fragments.push(currentFragment)
        }

        return fragments
    }

    /**
     * Approximates rendered note text width for line wrapping.
     * @param {string} text
     * @param {number} textSize
     * @returns {number}
     */
    static #estimateTextWidth(text, textSize) {
        let width = 0

        for (const character of String(text || '')) {
            width +=
                SchematicNoteRenderer.#measureCharacterWidth(character) *
                textSize
        }

        return width
    }

    /**
     * Returns a rough Times New Roman width factor for one character.
     * @param {string} character
     * @returns {number}
     */
    static #measureCharacterWidth(character) {
        if (/\s/.test(character)) return 0.32
        if (/[.,;:!|]/.test(character)) return 0.24
        if (/[()[\]{}]/.test(character)) return 0.32
        if (/[-+/\\]/.test(character)) return 0.36
        if (/[MW@#%&]/.test(character)) return 0.82
        if (/[A-Z]/.test(character)) return 0.62
        if (/[a-z0-9]/.test(character)) return 0.5
        if (/[^ -~]/.test(character)) return 0.92

        return 0.56
    }

    /**
     * Picks a readable line height that still fits inside the note box.
     * @param {number} textSize
     * @param {number} noteHeight
     * @param {number} textMargin
     * @param {number} lineCount
     * @returns {number}
     */
    static #resolveLineHeight(textSize, noteHeight, textMargin, lineCount) {
        const defaultLineHeight = Math.max(textSize * 1.1, textSize + 1)
        if (lineCount <= 1) {
            return defaultLineHeight
        }

        const maxLineHeight =
            (noteHeight - textMargin * 2 - textSize) / (lineCount - 1)

        return Math.max(Math.min(defaultLineHeight, maxLineHeight), textSize)
    }

    /**
     * Builds one rendered line inside a schematic note box.
     * @param {string} line
     * @param {number} index
     * @param {number} left
     * @param {number} right
     * @param {number} top
     * @param {number} horizontalTextMargin
     * @param {number} verticalTextMargin
     * @param {number} lineHeight
     * @param {number} textSize
     * @param {{ color: string, fontFamily?: string, fontWeight?: number }} text
     * @returns {string}
     */
    static #buildNoteLineMarkup(
        line,
        index,
        left,
        right,
        top,
        horizontalTextMargin,
        verticalTextMargin,
        lineHeight,
        textSize,
        text
    ) {
        const x = left + horizontalTextMargin
        const y = top + verticalTextMargin + textSize + index * lineHeight

        if (/^_+$/.test(String(line || '').trim())) {
            return (
                '<line class="schematic-note-rule" x1="' +
                formatNumber(x) +
                '" y1="' +
                formatNumber(y - textSize * 0.35) +
                '" x2="' +
                formatNumber(right - horizontalTextMargin) +
                '" y2="' +
                formatNumber(y - textSize * 0.35) +
                '" stroke="' +
                escapeHtml(
                    SchematicColorResolver.resolveColor(
                        text.color,
                        '--schematic-text-color'
                    )
                ) +
                '" />'
            )
        }

        return (
            '<text class="schematic-note-text" x="' +
            formatNumber(x) +
            '" y="' +
            formatNumber(y) +
            '" fill="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    text.color,
                    '--schematic-text-color'
                )
            ) +
            '" text-anchor="start" font-size="' +
            formatNumber(textSize) +
            '" font-family="' +
            escapeHtml(text.fontFamily || 'Times New Roman') +
            '" font-weight="' +
            formatNumber(text.fontWeight || 400) +
            '" xml:space="preserve">' +
            escapeHtml(line) +
            '</text>'
        )
    }
}
