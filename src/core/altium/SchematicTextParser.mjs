import { ParserUtils } from './ParserUtils.mjs'

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
     * Builds a font table from the sheet header.
     * @param {Record<string, string | string[]> | undefined} fields
     * @returns {Record<string, { size: number, family: string, bold: boolean, rotation: number }>}
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
                rotation:
                    ParserUtils.parseNumericField(fields, 'Rotation' + index) ||
                    0
            }
        }

        return fonts
    }

    /**
     * Normalizes one schematic text record into a drawable text node.
     * @param {Record<string, string | string[]>} fields
     * @param {Record<string, string>} metadata
     * @param {{ width: number, marginWidth: number }} sheet
     * @param {Record<string, { size: number, family: string, bold: boolean, rotation: number }>} fonts
     * @returns {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, rotation: number, sourceOrientation?: number, isMirrored?: boolean, anchor: 'start' | 'middle' | 'end', powerPortDirection?: 'up' | 'down' | 'left' | 'right', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] } | null}
     */
    static normalizeSchematicTextRecord(fields, metadata, sheet, fonts) {
        const x = ParserUtils.parseNumericField(fields, 'Location.X')
        const y = ParserUtils.parseNumericField(fields, 'Location.Y')
        const hidden = ParserUtils.parseBoolean(fields.IsHidden)
        const name = ParserUtils.getField(fields, 'Name')
        const rawText = ParserUtils.getDisplayText(fields)
        const recordType = ParserUtils.getField(fields, 'RECORD')
        const text = SchematicTextParser.#resolveSchematicTemplateText(
            rawText,
            metadata
        )

        if (hidden || x === null || y === null || !text) {
            return null
        }

        if (
            SchematicTextParser.#shouldSkipSchematicText(
                fields,
                name,
                rawText,
                text,
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
            text,
            color: SchematicTextParser.#resolveSchematicTextColor(
                fields,
                recordType
            ),
            hidden,
            name,
            ownerIndex: ParserUtils.getField(fields, 'OwnerIndex') || undefined,
            recordType,
            style: ParserUtils.parseNumericField(fields, 'Style') || 0,
            fontSize: SchematicTextParser.#toSvgFontSize(font.size),
            fontFamily: font.family,
            fontWeight: font.bold ? 700 : 400,
            rotation,
            sourceOrientation:
                sourceOrientation === null ? undefined : sourceOrientation,
            isMirrored: isMirrored || undefined,
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
     * Extracts footer metadata used for the synthesized title block.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {Record<string, string>} metadata
     * @param {number} sheetWidth
     * @param {Record<string, { size: number, family: string, bold: boolean, rotation: number }>} fonts
     * @returns {{ title: string, revision: string, documentNumber: string, sheetNumber: string, sheetTotal: string, date: string, drawnBy: string, footerHints: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }}
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
     * @param {Record<string, { size: number, family: string, bold: boolean, rotation: number }>} fonts
     * @returns {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number } | null}
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
            fontWeight: font.bold ? 700 : 400
        }
    }

    /**
     * Maps visible footer rows onto title-block fields.
     * @param {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }[]} footerTexts
     * @returns {Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>>}
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
     * @param {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }[]} footerTexts
     * @returns {Array<{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }[]>}
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
     * @param {{ text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }[]} footerTexts
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
     * @param {Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { text: string, x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>>} footerHints
     * @returns {Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>>}
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
     * Returns true when a text record is metadata rather than sheet content.
     * @param {Record<string, string | string[]>} fields
     * @param {string} name
     * @param {string} rawText
     * @param {string} text
     * @param {{ width: number, marginWidth: number }} sheet
     * @returns {boolean}
     */
    static #shouldSkipSchematicText(fields, name, rawText, text, sheet) {
        const normalizedName = String(name || '')
            .trim()
            .toLowerCase()
        const normalizedRawText = String(rawText || '').trim()
        const normalizedText = String(text || '').trim()
        const nonDrawableNames = new Set([
            'kind',
            'subkind',
            'spice prefix',
            'netlist',
            'model',
            'part number',
            'pkg type',
            'description'
        ])

        if (nonDrawableNames.has(normalizedName)) return true
        if (!normalizedText || normalizedText === '*') return true
        if (/^=/.test(normalizedText)) return true
        if (SchematicTextParser.isTitleBlockFooterRecord(fields, sheet.width)) {
            return true
        }
        if (/^=/.test(normalizedRawText)) return true

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

        if (recordType === '17') return 'middle'
        if (explicitAnchor) return explicitAnchor

        return 'start'
    }

    /**
     * Decodes Altium's three-column text justification grid into one
     * horizontal SVG text anchor.
     * @param {Record<string, string | string[]>} fields
     * @returns {'start' | 'middle' | 'end' | null}
     */
    static #resolveSchematicTextJustificationAnchor(fields) {
        const justification = ParserUtils.parseNumericField(
            fields,
            'Justification'
        )

        if (justification === null) {
            return null
        }

        switch (((justification % 3) + 3) % 3) {
            case 1:
                return 'middle'
            case 2:
                return 'end'
            default:
                return 'start'
        }
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
        if (recordType === '25') {
            const orientation = ParserUtils.parseNumericField(
                fields,
                'Orientation'
            )

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
        if (ParserUtils.parseNumericField(fields, 'Orientation') === 1) {
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
     * Returns the default schematic font when no sheet font entry exists.
     * @returns {{ size: number, family: string, bold: boolean, rotation: number }}
     */
    static #defaultSchematicFont() {
        return {
            size: 10,
            family: 'Times New Roman',
            bold: false,
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
     * @param {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, rotation: number, sourceOrientation?: number, isMirrored?: boolean, anchor: 'start' | 'middle' | 'end' }} textRecord
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, rotation: number, sourceOrientation?: number, isMirrored?: boolean, anchor: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }}
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
            isSolid: ParserUtils.parseBoolean(fields.IsSolid),
            showBorder: ParserUtils.parseBoolean(fields.ShowBorder),
            textMargin:
                ParserUtils.parseNumericField(fields, 'TextMargin') || 4,
            noteLines
        }
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
