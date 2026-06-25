// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

/**
 * Helpers for recovering Altium schematic title-block footer metadata.
 */
export class SchematicTitleBlockParser {
    /**
     * Extracts footer metadata used for the synthesized title block.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {Record<string, string>} metadata
     * @param {number} sheetWidth
     * @param {Record<string, { size: number, family: string, bold: boolean, italic?: boolean, rotation: number }>} fonts
     * @returns {{ title: string, revision: string, documentNumber: string, sheetNumber: string, sheetTotal: string, date: string, drawnBy: string, footerHints: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }>> }}
     */
    static extract(records, metadata, sheetWidth, fonts) {
        const footerTexts = records
            .filter((record) =>
                SchematicTitleBlockParser.isFooterRecord(
                    record.fields,
                    sheetWidth
                )
            )
            .map((record) =>
                SchematicTitleBlockParser.#normalizeFooterRecord(
                    record.fields,
                    fonts
                )
            )
            .filter(Boolean)
            .sort((left, right) => right.y - left.y || left.x - right.x)
        const footerHints =
            SchematicTitleBlockParser.#collectFooterHints(footerTexts)
        const numericFooterTexts = footerTexts.filter((record) =>
            /^\d+$/.test(record.text)
        )
        const footerDrawnBy = SchematicTitleBlockParser.#extractDrawnBy(
            footerTexts,
            metadata
        )

        return {
            title:
                SchematicTitleBlockParser.#resolveFooterValue(
                    footerHints.title?.text,
                    metadata
                ) ||
                SchematicTitleBlockParser.#cleanMetadataValue(metadata.title),
            revision:
                SchematicTitleBlockParser.#resolveFooterValue(
                    footerHints.revision?.text,
                    metadata
                ) ||
                SchematicTitleBlockParser.#cleanMetadataValue(
                    metadata.revision
                ),
            documentNumber: SchematicTitleBlockParser.#cleanMetadataValue(
                SchematicTitleBlockParser.#resolveFooterValue(
                    footerHints.documentNumber?.text,
                    metadata
                ) || metadata.documentnumber
            ),
            sheetNumber:
                SchematicTitleBlockParser.#resolveFooterValue(
                    footerHints.sheetNumber?.text,
                    metadata
                ) ||
                numericFooterTexts[0]?.text ||
                SchematicTitleBlockParser.#cleanMetadataValue(
                    metadata.sheetnumber
                ),
            sheetTotal:
                SchematicTitleBlockParser.#resolveFooterValue(
                    footerHints.sheetTotal?.text,
                    metadata
                ) ||
                numericFooterTexts[1]?.text ||
                SchematicTitleBlockParser.#cleanMetadataValue(
                    metadata.sheettotal
                ),
            date: SchematicTitleBlockParser.#cleanMetadataValue(
                metadata.currentdate || metadata.date
            ),
            drawnBy:
                SchematicTitleBlockParser.#cleanMetadataValue(
                    metadata.drawnby
                ) || footerDrawnBy,
            footerHints: SchematicTitleBlockParser.#stripHintText(footerHints)
        }
    }

    /**
     * Returns true when the text primitive belongs to the page footer template.
     * @param {Record<string, string | string[]>} fields
     * @param {number} sheetWidth
     * @returns {boolean}
     */
    static isFooterRecord(fields, sheetWidth) {
        const recordType = ParserUtils.getField(fields, 'RECORD')
        const x = ParserUtils.parseNumericField(fields, 'Location.X')
        const y = ParserUtils.parseNumericField(fields, 'Location.Y')

        return (
            recordType === '4' &&
            x !== null &&
            y !== null &&
            x >= sheetWidth * 0.55 &&
            y <= 100
        )
    }

    /**
     * Normalizes one visible footer text record into a title-block layout hint.
     * @param {Record<string, string | string[]>} fields
     * @param {Record<string, { size: number, family: string, bold: boolean, italic?: boolean, rotation: number }} fonts
     * @returns {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string } | null}
     */
    static #normalizeFooterRecord(fields, fonts) {
        const text = ParserUtils.getDisplayText(fields)
        const x = ParserUtils.parseNumericField(fields, 'Location.X')
        const y = ParserUtils.parseNumericField(fields, 'Location.Y')

        if (!text || x === null || y === null) {
            return null
        }

        const font =
            (fonts || {})[ParserUtils.getField(fields, 'FontID')] ||
            SchematicTitleBlockParser.#defaultFont()

        return {
            text,
            x,
            y,
            color: ParserUtils.toColor(fields.Color, '#2c3134'),
            fontSize: font.size,
            fontFamily: font.family,
            fontWeight: font.bold ? 700 : 400,
            ...(font.italic ? { fontStyle: 'italic' } : {})
        }
    }

    /**
     * Maps visible footer rows onto title-block fields.
     * @param {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }[]} footerTexts
     * @returns {Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }>>}
     */
    static #collectFooterHints(footerTexts) {
        const rows = SchematicTitleBlockParser.#groupRows(footerTexts)
        const topRow = rows[0] || []
        const middleRow = rows.length > 2 ? rows[1] || [] : []
        const sheetRow =
            [...rows]
                .reverse()
                .find(
                    (row) =>
                        row.filter((record) => /^\d+$/.test(record.text))
                            .length >= 2
                ) || []
        const numericSheetRow = sheetRow.filter((record) =>
            /^\d+$/.test(record.text)
        )
        const topRowHasVisibleTitleText = topRow.some(
            (record) => /^\d+$/.test(record.text) === false
        )
        const topRowDataRecords = topRow.filter(
            (record) => !SchematicTitleBlockParser.#isLabelText(record.text)
        )
        const middleRowDataRecords = middleRow.filter(
            (record) => !SchematicTitleBlockParser.#isLabelText(record.text)
        )
        const hints = {}
        const titleHint = SchematicTitleBlockParser.#findSpecialStringHint(
            footerTexts,
            ['title']
        )
        const documentNumberHint =
            SchematicTitleBlockParser.#findSpecialStringHint(footerTexts, [
                'documentnumber'
            ])
        const revisionHint = SchematicTitleBlockParser.#findSpecialStringHint(
            footerTexts,
            ['revision']
        )
        const sheetNumberHint =
            SchematicTitleBlockParser.#findSpecialStringHint(footerTexts, [
                'sheetnumber'
            ])
        const sheetTotalHint = SchematicTitleBlockParser.#findSpecialStringHint(
            footerTexts,
            ['sheettotal']
        )

        if (titleHint) {
            hints.title = titleHint
        }

        if (documentNumberHint) {
            hints.documentNumber = documentNumberHint
        }

        if (revisionHint) {
            hints.revision = revisionHint
        }

        if (sheetNumberHint) {
            hints.sheetNumber = sheetNumberHint
        }

        if (sheetTotalHint) {
            hints.sheetTotal = sheetTotalHint
        }

        if (
            !hints.title &&
            topRowDataRecords.length &&
            topRowHasVisibleTitleText
        ) {
            hints.title = topRowDataRecords[0]
        }

        if (
            !hints.documentNumber &&
            topRowDataRecords.length > 1 &&
            topRowHasVisibleTitleText
        ) {
            hints.documentNumber = topRowDataRecords.at(-1)
        }

        if (!hints.revision && middleRowDataRecords.length) {
            hints.revision = middleRowDataRecords.at(-1)
        }

        if (!hints.sheetNumber && numericSheetRow.length) {
            hints.sheetNumber = numericSheetRow[0]
        }

        if (!hints.sheetTotal && numericSheetRow.length) {
            hints.sheetTotal = numericSheetRow.at(-1)
        }

        return hints
    }

    /**
     * Finds the first footer text that directly references one special string.
     * @param {{ text: string }[]} footerTexts Footer text rows.
     * @param {string[]} names Lowercase special-string names.
     * @returns {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string } | undefined}
     */
    static #findSpecialStringHint(footerTexts, names) {
        const acceptedNames = new Set(names)

        return (footerTexts || []).find((record) =>
            acceptedNames.has(
                SchematicTitleBlockParser.#specialStringName(record.text)
            )
        )
    }

    /**
     * Extracts a direct Altium special-string name from footer text.
     * @param {string} text Footer text.
     * @returns {string}
     */
    static #specialStringName(text) {
        const match = String(text || '')
            .trim()
            .match(/^[.=]([A-Za-z_][\w.-]*)$/u)

        return match ? match[1].toLowerCase() : ''
    }

    /**
     * Returns true for static native title-block label cells.
     * @param {string} text Footer text.
     * @returns {boolean}
     */
    static #isLabelText(text) {
        return /^(title|size|number|revision|date|file|sheet|of|drawn by|project):?$/iu.test(
            String(text || '').trim()
        )
    }

    /**
     * Groups footer texts by their shared baseline row.
     * @param {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }[]} footerTexts
     * @returns {Array<{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }[]>}
     */
    static #groupRows(footerTexts) {
        const tolerance = 8
        const rows = []

        for (const record of footerTexts) {
            const currentRow = rows.at(-1)

            if (
                currentRow &&
                Math.abs(currentRow[0].y - record.y) <= tolerance
            ) {
                currentRow.push(record)
                currentRow.sort((left, right) => left.x - right.x)
                continue
            }

            rows.push([record])
        }

        return rows
    }

    /**
     * Resolves one visible footer placeholder against hidden sheet metadata.
     * @param {string | undefined} text
     * @param {Record<string, string>} metadata
     * @returns {string}
     */
    static #resolveFooterValue(text, metadata) {
        const resolved = SchematicTitleBlockParser.#resolveTemplateText(
            text,
            metadata
        )

        if (String(resolved || '').startsWith('=')) {
            return ''
        }

        return SchematicTitleBlockParser.#cleanMetadataValue(resolved)
    }

    /**
     * Extracts a visible footer `Drawn By` value from the bottom-most footer
     * row when hidden metadata does not provide one.
     * @param {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }[]} footerTexts
     * @param {Record<string, string>} metadata
     * @returns {string}
     */
    static #extractDrawnBy(footerTexts, metadata) {
        const bottomRow =
            SchematicTitleBlockParser.#groupRows(footerTexts).at(-1) || []
        const candidates = bottomRow
            .map((record) =>
                SchematicTitleBlockParser.#resolveFooterValue(
                    record.text,
                    metadata
                )
            )
            .filter(
                (value) => value && /^\d+$/.test(String(value).trim()) === false
            )

        return candidates.at(-1) || ''
    }

    /**
     * Removes the non-rendered text payload from stored footer hints.
     * @param {Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }>>} footerHints
     * @returns {Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }>>}
     */
    static #stripHintText(footerHints) {
        return Object.fromEntries(
            Object.entries(footerHints).map(([key, value]) => {
                const { text: _text, ...hint } = value
                return [key, hint]
            })
        )
    }

    /**
     * Resolves visible title-block placeholders from hidden sheet metadata.
     * @param {string | undefined} text
     * @param {Record<string, string>} metadata
     * @returns {string}
     */
    static #resolveTemplateText(text, metadata) {
        const normalized = String(text || '').trim()
        if (!normalized.startsWith('=')) {
            return normalized
        }

        const replacement = metadata[normalized.slice(1).toLowerCase()]
        return replacement ? replacement : normalized
    }

    /**
     * Normalizes placeholder metadata values.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #cleanMetadataValue(value) {
        return value && value !== '*' ? value : ''
    }

    /**
     * Returns the default schematic font when no sheet font entry exists.
     * @returns {{ size: number, family: string, bold: boolean, italic: boolean, rotation: number }}
     */
    static #defaultFont() {
        return {
            size: 10,
            family: 'Times New Roman',
            bold: false,
            italic: false,
            rotation: 0
        }
    }
}
