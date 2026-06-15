// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'
import { SchematicTextRunParser } from './SchematicTextRunParser.mjs'
import { SchematicTextOrientationResolver } from './SchematicTextOrientationResolver.mjs'

/**
 * Helpers for normalized schematic text extraction.
 */
export class SchematicTextParser {
    /**
     * Extracts hidden sheet metadata text values.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Record<string, string>}
     */
    static extractSchematicMetadata(records) {
        const metadata = {}

        for (const record of records) {
            if (ParserUtils.getField(record.fields, 'OwnerIndex')) {
                continue
            }

            const name = ParserUtils.getField(record.fields, 'Name').trim()
            const value = ParserUtils.getDisplayText(record.fields)

            if (!name || !value || value === '*') {
                continue
            }

            metadata[name.toLowerCase()] = value
        }

        return metadata
    }

    /**
     * Extracts owner-local parameter values used by component text templates.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Map<string, Record<string, string>>}
     */
    static extractSchematicOwnerMetadata(records) {
        const ownerMetadata = new Map()

        for (const record of records) {
            const ownerIndex = ParserUtils.getField(record.fields, 'OwnerIndex')
            const name = ParserUtils.getField(record.fields, 'Name').trim()
            const value = ParserUtils.getDisplayText(record.fields)

            if (
                !ownerIndex ||
                !name ||
                !value ||
                value === '*' ||
                String(value).trim().startsWith('=')
            ) {
                continue
            }

            if (!ownerMetadata.has(ownerIndex)) {
                ownerMetadata.set(ownerIndex, {})
            }

            ownerMetadata.get(ownerIndex)[name.toLowerCase()] = value
        }

        return ownerMetadata
    }

    /**
     * Builds a font table from the sheet header.
     * @param {Record<string, string | string[]> | undefined} fields
     * @returns {Record<string, { size: number, family: string, bold: boolean, italic: boolean, rotation: number }>}
     */
    static extractSchematicFonts(fields) {
        const count = ParserUtils.parseNumericField(fields, 'FontIdCount') || 0
        const fonts = {}

        for (let index = 1; index <= count; index += 1) {
            fonts[String(index)] = {
                size:
                    ParserUtils.parseNumericField(fields, 'Size' + index) || 10,
                family: SchematicTextParser.#sanitizeFontFamily(
                    ParserUtils.getField(fields, 'FontName' + index)
                ),
                bold: ParserUtils.parseBoolean(fields?.['Bold' + index]),
                italic: ParserUtils.parseBoolean(fields?.['Italic' + index]),
                rotation:
                    ParserUtils.parseNumericField(fields, 'Rotation' + index) ||
                    0
            }
        }

        return fonts
    }

    /**
     * Extracts deterministic render diagnostics for schematic sheet fonts.
     * @param {Record<string, string | string[]> | undefined} fields
     * @returns {{ schema: string, fontFallbacks: object[] }}
     */
    static extractSchematicFontDiagnostics(fields) {
        const count = ParserUtils.parseNumericField(fields, 'FontIdCount') || 0
        const fontFallbacks = []

        for (let index = 1; index <= count; index += 1) {
            const rawFamily = ParserUtils.getField(fields, 'FontName' + index)
            if (!SchematicTextParser.#needsFontFamilyFallback(rawFamily)) {
                continue
            }

            fontFallbacks.push({
                code: 'schematic.font.family-fallback',
                severity: 'warning',
                fontId: String(index),
                sourceFamily: rawFamily,
                resolvedFamily:
                    SchematicTextParser.#sanitizeFontFamily(rawFamily),
                message:
                    'Schematic font family was missing or malformed and was replaced for deterministic SVG rendering.'
            })
        }

        return {
            schema: 'altium-toolkit.schematic.render-diagnostics.a1',
            fontFallbacks
        }
    }

    /**
     * Normalizes one schematic text record into a drawable text node.
     * @param {Record<string, string | string[]>} fields
     * @param {Record<string, string>} metadata
     * @param {{ width: number, marginWidth: number, titleBlockOn?: boolean }} sheet
     * @param {Record<string, { size: number, family: string, bold: boolean, italic?: boolean, rotation: number }>} fonts
     * @param {Map<string, Record<string, string>>} [ownerMetadata]
     * @returns {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string, rotation: number, sourceOrientation?: number, isMirrored?: boolean, anchor: 'start' | 'middle' | 'end', verticalAnchor?: 'top', powerPortDirection?: 'up' | 'down' | 'left' | 'right', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] } | null}
     */
    static normalizeSchematicTextRecord(
        fields,
        metadata,
        sheet,
        fonts,
        ownerMetadata = new Map()
    ) {
        const x = ParserUtils.parseNumericField(fields, 'Location.X')
        const y = ParserUtils.parseNumericField(fields, 'Location.Y')
        const hidden = ParserUtils.parseBoolean(fields.IsHidden)
        const name = ParserUtils.getField(fields, 'Name')
        const rawText = ParserUtils.getDisplayText(fields)
        const recordType = ParserUtils.getField(fields, 'RECORD')
        const ownerIndex = ParserUtils.getField(fields, 'OwnerIndex')
        const text = SchematicTextParser.#resolveSchematicTemplateText(
            rawText,
            SchematicTextParser.#resolveSchematicTextMetadata(
                ownerIndex,
                metadata,
                ownerMetadata
            )
        )
        const textRuns = SchematicTextRunParser.parseOptionalOverlineRuns(text)

        if (hidden || x === null || y === null || !textRuns.text) {
            return null
        }

        if (
            SchematicTextParser.#shouldSkipSchematicText(
                fields,
                name,
                rawText,
                textRuns.text,
                sheet
            )
        ) {
            return null
        }

        const font =
            fonts[ParserUtils.getField(fields, 'FontID')] ||
            SchematicTextParser.#defaultSchematicFont()
        const rotation = SchematicTextParser.#resolveTextRotation(
            fields,
            font,
            recordType
        )
        const sourceOrientation = ParserUtils.parseNumericField(
            fields,
            'Orientation'
        )
        const isMirrored = ParserUtils.parseBoolean(fields.IsMirrored)
        const textRecord = {
            x,
            y,
            text: textRuns.text,
            textSegments: textRuns.segments,
            color: SchematicTextParser.#resolveSchematicTextColor(
                fields,
                recordType
            ),
            hidden,
            name,
            ownerIndex: ownerIndex || undefined,
            recordType,
            style: ParserUtils.parseNumericField(fields, 'Style') || 0,
            renderOrder:
                ParserUtils.parseNumericField(fields, 'IndexInSheet') ?? 0,
            fontSize: SchematicTextParser.#toSvgFontSize(font.size),
            fontFamily: font.family,
            fontWeight: font.bold ? 700 : 400,
            ...(font.italic ? { fontStyle: 'italic' } : {}),
            rotation,
            sourceOrientation:
                sourceOrientation === null ? undefined : sourceOrientation,
            isMirrored: isMirrored || undefined,
            verticalAnchor:
                SchematicTextOrientationResolver.resolveVerticalAnchor(
                    fields,
                    recordType
                ) || undefined,
            powerPortDirection:
                SchematicTextParser.#resolvePowerPortDirection(
                    fields,
                    recordType
                ) || undefined,
            anchor: SchematicTextParser.#inferTextAnchor(
                fields,
                recordType,
                name,
                text,
                font,
                rotation
            )
        }

        if (SchematicTextParser.#isSchematicNoteRecord(recordType)) {
            return SchematicTextParser.#normalizeSchematicNoteRecord(
                textRecord,
                fields
            )
        }

        return textRecord
    }

    /**
     * Builds a normalized text-frame read model from visible text records.
     * @param {object[]} texts Normalized schematic text records.
     * @returns {object[]}
     */
    static extractSchematicTextFrames(texts) {
        return (texts || [])
            .filter((text) => text?.recordType === '28')
            .map((text) =>
                SchematicTextParser.#normalizeTextFrameContract(text)
            )
    }

    /**
     * Extracts footer metadata used for the synthesized title block.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {Record<string, string>} metadata
     * @param {number} sheetWidth
     * @param {Record<string, { size: number, family: string, bold: boolean, italic?: boolean, rotation: number }>} fonts
     * @returns {{ title: string, revision: string, documentNumber: string, sheetNumber: string, sheetTotal: string, date: string, drawnBy: string, footerHints: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }>> }}
     */
    static extractSchematicTitleBlock(records, metadata, sheetWidth, fonts) {
        const footerTexts = records
            .filter((record) =>
                SchematicTextParser.isTitleBlockFooterRecord(
                    record.fields,
                    sheetWidth
                )
            )
            .map((record) =>
                SchematicTextParser.#normalizeTitleBlockFooterRecord(
                    record.fields,
                    fonts
                )
            )
            .filter(Boolean)
            .sort((left, right) => right.y - left.y || left.x - right.x)
        const footerHints =
            SchematicTextParser.#collectSchematicTitleBlockFooterHints(
                footerTexts
            )
        const numericFooterTexts = footerTexts.filter((record) =>
            /^\d+$/.test(record.text)
        )
        const footerDrawnBy =
            SchematicTextParser.#extractSchematicTitleBlockFooterDrawnBy(
                footerTexts,
                metadata
            )

        return {
            title:
                SchematicTextParser.#resolveTitleBlockFooterValue(
                    footerHints.title?.text,
                    metadata
                ) || SchematicTextParser.#cleanMetadataValue(metadata.title),
            revision:
                SchematicTextParser.#resolveTitleBlockFooterValue(
                    footerHints.revision?.text,
                    metadata
                ) || SchematicTextParser.#cleanMetadataValue(metadata.revision),
            documentNumber: SchematicTextParser.#cleanMetadataValue(
                SchematicTextParser.#resolveTitleBlockFooterValue(
                    footerHints.documentNumber?.text,
                    metadata
                ) || metadata.documentnumber
            ),
            sheetNumber:
                footerHints.sheetNumber?.text ||
                numericFooterTexts[0]?.text ||
                SchematicTextParser.#cleanMetadataValue(metadata.sheetnumber),
            sheetTotal:
                footerHints.sheetTotal?.text ||
                numericFooterTexts[1]?.text ||
                SchematicTextParser.#cleanMetadataValue(metadata.sheettotal),
            date: SchematicTextParser.#cleanMetadataValue(
                metadata.currentdate || metadata.date
            ),
            drawnBy:
                SchematicTextParser.#cleanMetadataValue(metadata.drawnby) ||
                footerDrawnBy,
            footerHints:
                SchematicTextParser.#stripSchematicTitleBlockHintText(
                    footerHints
                )
        }
    }

    /**
     * Returns true when the text primitive belongs to the page footer template.
     * @param {Record<string, string | string[]>} fields
     * @param {number} sheetWidth
     * @returns {boolean}
     */
    static isTitleBlockFooterRecord(fields, sheetWidth) {
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
     * @param {Record<string, { size: number, family: string, bold: boolean, italic?: boolean, rotation: number }>} fonts
     * @returns {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string } | null}
     */
    static #normalizeTitleBlockFooterRecord(fields, fonts) {
        const text = ParserUtils.getDisplayText(fields)
        const x = ParserUtils.parseNumericField(fields, 'Location.X')
        const y = ParserUtils.parseNumericField(fields, 'Location.Y')

        if (!text || x === null || y === null) {
            return null
        }

        const font =
            fonts[ParserUtils.getField(fields, 'FontID')] ||
            SchematicTextParser.#defaultSchematicFont()

        return {
            text,
            x,
            y,
            color: SchematicTextParser.#resolveSchematicTextColor(
                fields,
                ParserUtils.getField(fields, 'RECORD')
            ),
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
    static #collectSchematicTitleBlockFooterHints(footerTexts) {
        const rows = SchematicTextParser.#groupTitleBlockFooterRows(footerTexts)
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
        const hints = {}

        if (topRow.length && topRowHasVisibleTitleText) {
            hints.title = topRow[0]

            if (topRow.length > 1) {
                hints.documentNumber = topRow.at(-1)
            }
        }

        if (middleRow.length) {
            hints.revision = middleRow.at(-1)
        }

        if (numericSheetRow.length) {
            hints.sheetNumber = numericSheetRow[0]
            hints.sheetTotal = numericSheetRow.at(-1)
        }

        return hints
    }

    /**
     * Groups footer texts by their shared baseline row.
     * @param {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }[]} footerTexts
     * @returns {Array<{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }[]>}
     */
    static #groupTitleBlockFooterRows(footerTexts) {
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
    static #resolveTitleBlockFooterValue(text, metadata) {
        const resolved = SchematicTextParser.#resolveSchematicTemplateText(
            text,
            metadata
        )

        if (String(resolved || '').startsWith('=')) {
            return ''
        }

        return SchematicTextParser.#cleanMetadataValue(resolved)
    }

    /**
     * Extracts a visible footer `Drawn By` value from the bottom-most footer
     * row when hidden metadata does not provide one.
     * @param {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string }[]} footerTexts
     * @param {Record<string, string>} metadata
     * @returns {string}
     */
    static #extractSchematicTitleBlockFooterDrawnBy(footerTexts, metadata) {
        const bottomRow =
            SchematicTextParser.#groupTitleBlockFooterRows(footerTexts).at(
                -1
            ) || []
        const candidates = bottomRow
            .map((record) =>
                SchematicTextParser.#resolveTitleBlockFooterValue(
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
    static #stripSchematicTitleBlockHintText(footerHints) {
        return Object.fromEntries(
            Object.entries(footerHints).map(([key, value]) => {
                const { text: _text, ...hint } = value
                return [key, hint]
            })
        )
    }

    /**
     * Resolves visible title-block placeholders from hidden sheet metadata.
     * @param {string} text
     * @param {Record<string, string>} metadata
     * @returns {string}
     */
    static #resolveSchematicTemplateText(text, metadata) {
        const normalized = String(text || '').trim()
        if (!normalized.startsWith('=')) {
            return normalized
        }

        const replacement = metadata[normalized.slice(1).toLowerCase()]
        return replacement ? replacement : normalized
    }

    /**
     * Chooses the parameter map for one text record.
     * @param {string} ownerIndex
     * @param {Record<string, string>} metadata
     * @param {Map<string, Record<string, string>>} ownerMetadata
     * @returns {Record<string, string>}
     */
    static #resolveSchematicTextMetadata(ownerIndex, metadata, ownerMetadata) {
        if (!ownerIndex) {
            return metadata
        }

        return ownerMetadata.get(ownerIndex) || {}
    }

    /**
     * Returns true when a text record is metadata rather than sheet content.
     * @param {Record<string, string | string[]>} fields
     * @param {string} name
     * @param {string} rawText
     * @param {string} text
     * @param {{ width: number, marginWidth: number, titleBlockOn?: boolean }} sheet
     * @returns {boolean}
     */
    static #shouldSkipSchematicText(fields, name, rawText, text, sheet) {
        const normalizedName = String(name || '')
            .trim()
            .toLowerCase()
        const normalizedText = String(text || '').trim()
        const nonDrawableNames = new Set([
            'kind',
            'subkind',
            'spice prefix',
            'netlist',
            'model',
            'part number',
            'pkg type',
            'description',
            'vendor',
            'manufacturer',
            'supplier',
            'ic',
            'pinuniqueid',
            'differentialpair'
        ])

        if (nonDrawableNames.has(normalizedName)) return true
        if (/uniqueid$/i.test(normalizedName)) return true
        if (!normalizedText || normalizedText === '*') return true
        if (
            sheet.titleBlockOn &&
            SchematicTextParser.isTitleBlockFooterRecord(fields, sheet.width)
        ) {
            return true
        }

        return /@designator|initial voltage/i.test(normalizedText)
    }

    /**
     * Picks a visible text anchor from the recovered font metadata.
     * @param {Record<string, string | string[]>} fields
     * @param {string} recordType
     * @param {string} name
     * @param {string} text
     * @param {{ size: number }} font
     * @param {number} rotation
     * @returns {'start' | 'middle' | 'end'}
     */
    static #inferTextAnchor(fields, recordType, name, text, font, rotation) {
        const explicitAnchor =
            SchematicTextParser.#resolveSchematicTextJustificationAnchor(fields)
        const orientationAnchor =
            SchematicTextOrientationResolver.resolveHorizontalAnchor(
                fields,
                recordType
            )

        if (recordType === '17') return 'middle'
        if (orientationAnchor) return orientationAnchor
        if (explicitAnchor) return explicitAnchor
        if (
            SchematicTextParser.#shouldCenterSchematicNoteByDefault(
                fields,
                recordType,
                text
            )
        ) {
            return 'middle'
        }

        return 'start'
    }

    /**
     * Returns true for Altium text frames that encode centered one-line labels
     * without carrying an explicit justification field.
     * @param {Record<string, string | string[]>} fields
     * @param {string} recordType
     * @param {string} text
     * @returns {boolean}
     */
    static #shouldCenterSchematicNoteByDefault(fields, recordType, text) {
        if (recordType !== '209' && recordType !== '28') return false
        if (String(text || '').includes('~1')) return false
        if (
            ParserUtils.parseNumericField(fields, 'Corner.X') === null ||
            ParserUtils.parseNumericField(fields, 'Corner.Y') === null
        ) {
            return false
        }

        if (recordType === '28') {
            return ParserUtils.parseBoolean(fields.WordWrap)
        }

        return (
            ParserUtils.parseBoolean(fields.WordWrap) &&
            ParserUtils.parseBoolean(fields.ClipToRect)
        )
    }

    /**
     * Decodes Altium's three-column text justification grid into one
     * horizontal SVG text anchor.
     * @param {Record<string, string | string[]>} fields
     * @returns {'start' | 'middle' | 'end' | null}
     */
    static #resolveSchematicTextJustificationAnchor(fields) {
        const justification =
            ParserUtils.parseNumericField(fields, 'Justification') ??
            ParserUtils.parseNumericField(fields, 'Alignment')

        if (justification === null) {
            return null
        }

        let anchor = 'start'
        switch (((justification % 3) + 3) % 3) {
            case 1:
                anchor = 'middle'
                break
            case 2:
                anchor = 'end'
                break
            default:
                anchor = 'start'
        }

        if (
            anchor !== 'middle' &&
            ParserUtils.getField(fields, 'RECORD') === '4' &&
            ParserUtils.getField(fields, 'OwnerIndex') &&
            ParserUtils.parseBoolean(fields.IsMirrored) &&
            ParserUtils.parseNumericField(fields, 'Orientation') === 2
        ) {
            return anchor === 'start' ? 'end' : 'start'
        }

        return anchor
    }

    /**
     * Resolves one explicit Altium power-port orientation into a cardinal
     * direction for downstream rendering.
     * @param {Record<string, string | string[]>} fields
     * @param {string} recordType
     * @returns {'up' | 'down' | 'left' | 'right' | null}
     */
    static #resolvePowerPortDirection(fields, recordType) {
        if (recordType !== '17') {
            return null
        }

        const style = ParserUtils.parseNumericField(fields, 'Style')
        const orientation = ParserUtils.parseNumericField(fields, 'Orientation')

        if (style === 4) {
            // Ground power-port symbols use a different rotation baseline than
            // rail ports in recovered Altium samples, with orientation 3
            // corresponding to the standard downward ground symbol.
            switch (orientation) {
                case 1:
                    return 'up'
                case 2:
                    return 'left'
                case 3:
                    return 'down'
                case 0:
                case 4:
                    return 'right'
                default:
                    return null
            }
        }

        switch (orientation) {
            case 1:
                return 'up'
            case 2:
                return 'left'
            case 3:
                return 'right'
            case 0:
            case 4:
                return 'down'
            default:
                return null
        }
    }

    /**
     * Returns true when one record type represents a boxed note/comment.
     * @param {string} recordType
     * @returns {boolean}
     */
    static #isSchematicNoteRecord(recordType) {
        return recordType === '209' || recordType === '28'
    }

    /**
     * Resolves text rotation from font and record metadata.
     * @param {Record<string, string | string[]>} fields
     * @param {{ rotation: number }} font
     * @param {string} recordType
     * @returns {number}
     */
    static #resolveTextRotation(fields, font, recordType) {
        if (recordType === '17') return 0
        const orientation = ParserUtils.parseNumericField(fields, 'Orientation')

        if (recordType === '25') {
            if (orientation === 1 || orientation === 3) {
                return 90
            }
        }

        const explicitRotation = ParserUtils.parseNumericField(
            fields,
            'Rotation'
        )
        if (explicitRotation !== null) return explicitRotation
        if (font.rotation) return font.rotation
        if (
            SchematicTextOrientationResolver.shouldRotateFromOrientation(
                recordType,
                orientation
            )
        ) {
            return 90
        }
        return 0
    }

    /**
     * Coerces malformed font names into a stable browser family.
     * @param {string} family
     * @returns {string}
     */
    static #sanitizeFontFamily(family) {
        const normalized = String(family || '').trim()
        if (!normalized || /["|]/.test(normalized)) {
            return 'Times New Roman'
        }

        return normalized
    }

    /**
     * Returns true when the font family must be replaced for SVG output.
     * @param {string} family Raw font family value.
     * @returns {boolean}
     */
    static #needsFontFamilyFallback(family) {
        const normalized = String(family || '').trim()

        return !normalized || /["|]/.test(normalized)
    }

    /**
     * Returns the default schematic font when no sheet font entry exists.
     * @returns {{ size: number, family: string, bold: boolean, italic: boolean, rotation: number }}
     */
    static #defaultSchematicFont() {
        return {
            size: 10,
            family: 'Times New Roman',
            bold: false,
            italic: false,
            rotation: 0
        }
    }

    /**
     * Resolves the visible text color for one schematic text primitive.
     * @param {Record<string, string | string[]>} fields
     * @param {string} recordType
     * @returns {string}
     */
    static #resolveSchematicTextColor(fields, recordType) {
        if (SchematicTextParser.#isSchematicNoteRecord(recordType)) {
            return ParserUtils.toColor(
                fields.TextColor || fields.Color,
                '#000000'
            )
        }

        return ParserUtils.toColor(fields.Color, '#2c3134')
    }

    /**
     * Converts Altium point sizes into approximate SVG pixels.
     * @param {number} size
     * @returns {number}
     */
    static #toSvgFontSize(size) {
        return Number(size || 10)
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
     * Adds note box metadata to one decoded schematic note record.
     * @param {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string, rotation: number, sourceOrientation?: number, isMirrored?: boolean, anchor: 'start' | 'middle' | 'end' }} textRecord
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, fontStyle?: string, rotation: number, sourceOrientation?: number, isMirrored?: boolean, anchor: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }}
     */
    static #normalizeSchematicNoteRecord(textRecord, fields) {
        const noteLines = SchematicTextParser.#decodeSchematicNoteLines(
            textRecord.text
        )

        return {
            ...textRecord,
            text: noteLines.join('\n'),
            cornerX:
                ParserUtils.parseNumericField(fields, 'Corner.X') ||
                textRecord.x,
            cornerY:
                ParserUtils.parseNumericField(fields, 'Corner.Y') ||
                textRecord.y,
            fill: ParserUtils.toColor(fields.AreaColor, '#eceb94'),
            borderColor: ParserUtils.toColor(
                fields.Color || fields.TextColor,
                '#7b7753'
            ),
            lineWidth: ParserUtils.parseSchematicLineWidth(fields),
            isSolid: ParserUtils.parseBoolean(fields.IsSolid),
            showBorder: ParserUtils.parseBoolean(fields.ShowBorder),
            textMargin:
                ParserUtils.parseNumericField(fields, 'TextMargin') || 4,
            noteLines
        }
    }

    /**
     * Converts one rendered text-frame record into an explicit read model.
     * @param {object} text Normalized text-frame text record.
     * @returns {object}
     */
    static #normalizeTextFrameContract(text) {
        const left = Math.min(Number(text.x || 0), Number(text.cornerX || 0))
        const right = Math.max(Number(text.x || 0), Number(text.cornerX || 0))
        const top = Math.max(Number(text.y || 0), Number(text.cornerY || 0))
        const bottom = Math.min(Number(text.y || 0), Number(text.cornerY || 0))

        return SchematicTextParser.#stripUndefined({
            x: text.x,
            y: text.y,
            cornerX: text.cornerX,
            cornerY: text.cornerY,
            width: right - left,
            height: top - bottom,
            text: text.text,
            alignment: SchematicTextParser.#alignmentFromAnchor(text.anchor),
            borderWidth: text.lineWidth || 1,
            color: text.color,
            borderColor: text.borderColor,
            fill: text.fill,
            isSolid: text.isSolid,
            showBorder: text.showBorder,
            font: {
                size: text.fontSize,
                family: text.fontFamily,
                weight: text.fontWeight,
                ...(text.fontStyle ? { style: text.fontStyle } : {})
            },
            textMargin: text.textMargin,
            renderOrder: text.renderOrder,
            ownerIndex: text.ownerIndex
        })
    }

    /**
     * Converts SVG text-anchor naming to a read-model alignment label.
     * @param {string | undefined} anchor Text anchor.
     * @returns {'left' | 'center' | 'right'}
     */
    static #alignmentFromAnchor(anchor) {
        if (anchor === 'middle') return 'center'
        if (anchor === 'end') return 'right'
        return 'left'
    }

    /**
     * Removes undefined values from one object.
     * @param {object} value Source object.
     * @returns {object}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) => entryValue !== undefined
            )
        )
    }

    /**
     * Decodes Altium note control codes into visible text rows.
     * @param {string} text
     * @returns {string[]}
     */
    static #decodeSchematicNoteLines(text) {
        return String(text || '')
            .replace(/~2/g, '|')
            .split(/~1/g)
            .map((line) => line.replace(/\s+$/g, ''))
            .filter((line) => line.trim())
    }
}
