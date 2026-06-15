// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

/**
 * Parses schematic hyperlink records into a normalized read model.
 */
export class SchematicHyperlinkParser {
    /**
     * Parses hyperlink records from indexed schematic records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Indexed schematic records.
     * @param {{ fonts?: Record<string, { size?: number, family?: string, bold?: boolean, italic?: boolean }> }} [sheet] Resolved sheet metadata.
     * @returns {object[]}
     */
    static parse(records, sheet = {}) {
        return (records || [])
            .filter(
                (record) =>
                    ParserUtils.getField(record.fields, 'RECORD') === '226'
            )
            .map((record, index) =>
                SchematicHyperlinkParser.#parseRecord(record, index, sheet)
            )
            .filter(Boolean)
    }

    /**
     * Parses one hyperlink record.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} record Indexed schematic record.
     * @param {number} fallbackIndex Fallback source order.
     * @param {{ fonts?: Record<string, { size?: number, family?: string, bold?: boolean, italic?: boolean }> }} sheet Resolved sheet metadata.
     * @returns {object | null}
     */
    static #parseRecord(record, fallbackIndex, sheet) {
        const fields = record.fields || {}
        const text = ParserUtils.getDisplayText(fields)
        const url = ParserUtils.getField(fields, 'URL')
        if (!text && !url) return null

        const indexInSheet = ParserUtils.parseNumericField(
            fields,
            'IndexInSheet'
        )
        const fontId = ParserUtils.getField(fields, 'FontID')
        const font = SchematicHyperlinkParser.#font(sheet, fontId)
        const orientation = ParserUtils.parseNumericField(fields, 'Orientation')

        return SchematicHyperlinkParser.#stripUndefined({
            key:
                'schematic-hyperlink-' +
                String(indexInSheet ?? record.recordIndex ?? fallbackIndex),
            recordKey: SchematicHyperlinkParser.#recordKey(record),
            indexInSheet: indexInSheet ?? undefined,
            ownerIndex: ParserUtils.getField(fields, 'OwnerIndex') || undefined,
            ownerPartId:
                ParserUtils.parseNumericField(fields, 'OwnerPartID') ??
                undefined,
            uniqueId: ParserUtils.getField(fields, 'UniqueID') || undefined,
            text: text || undefined,
            url: url || undefined,
            x: ParserUtils.parseNumericField(fields, 'Location.X') ?? 0,
            y: ParserUtils.parseNumericField(fields, 'Location.Y') ?? 0,
            fontId: fontId || undefined,
            fontSize: font.size,
            fontFamily: font.family,
            fontWeight: font.bold ? 700 : 400,
            fontStyle: font.italic ? 'italic' : undefined,
            color: ParserUtils.toColor(fields.Color, '#000000'),
            areaColor: ParserUtils.toColor(fields.AreaColor, undefined),
            orientation: orientation ?? undefined,
            rotation:
                orientation === null || orientation === undefined
                    ? undefined
                    : orientation * 90,
            justification:
                ParserUtils.parseNumericField(fields, 'Justification') ??
                undefined,
            isNotAccessible:
                ParserUtils.parseBoolean(
                    fields.IsNotAccesible ?? fields.IsNotAccessible
                ) || undefined
        })
    }

    /**
     * Resolves one schematic font descriptor.
     * @param {{ fonts?: Record<string, { size?: number, family?: string, bold?: boolean, italic?: boolean }> }} sheet Resolved sheet metadata.
     * @param {string} fontId Font identifier.
     * @returns {{ size: number, family: string, bold: boolean, italic: boolean }}
     */
    static #font(sheet, fontId) {
        const font = sheet?.fonts?.[fontId] || {}
        return {
            size: Number.isFinite(font.size) ? font.size : 10,
            family: font.family || 'Arial',
            bold: Boolean(font.bold),
            italic: Boolean(font.italic)
        }
    }

    /**
     * Builds a stable source record key.
     * @param {{ recordIndex?: number }} record Indexed schematic record.
     * @returns {string}
     */
    static #recordKey(record) {
        return 'schematic-record-' + String(record?.recordIndex ?? 0)
    }

    /**
     * Removes undefined values from one object.
     * @param {object} value Object to clean.
     * @returns {object}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value).filter(([, entry]) => entry !== undefined)
        )
    }
}
