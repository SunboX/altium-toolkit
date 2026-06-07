// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils

/**
 * Normalizes printable PCB polygon records into renderable polygon rows.
 */
export class PcbPolygonRecordParser {
    /**
     * Parses polygon rows from printable records.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} records Printable records.
     * @returns {object[]}
     */
    static parse(records) {
        return (records || [])
            .filter(
                (record) =>
                    record.sourceStream === 'Polygons6/Data' &&
                    getField(record.fields, 'KIND0')
            )
            .map((record, index) =>
                PcbPolygonRecordParser.#normalize(record.fields, index)
            )
            .filter((polygon) => polygon.segments.length > 0)
    }

    /**
     * Normalizes one printable polygon row.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @param {number} index Fallback row index.
     * @returns {object}
     */
    static #normalize(fields, index) {
        const outline = AltiumLayoutParser.parseBoardOutline(fields)
        return PcbPolygonRecordParser.#stripEmpty({
            layer: getField(fields, 'LAYER') || 'UNKNOWN',
            polygonIndex: PcbPolygonRecordParser.#firstNumber(fields, [
                'POLYGONINDEX',
                'POLYGON_INDEX',
                'INDEX'
            ]),
            subpolygonIndex: PcbPolygonRecordParser.#firstNumber(fields, [
                'SUBPOLYINDEX',
                'SUBPOLYGONINDEX',
                'SUB_POLYGON_INDEX'
            ]),
            unionIndex: PcbPolygonRecordParser.#firstNumber(fields, [
                'UNIONINDEX',
                'UNION_INDEX'
            ]),
            isCutout: PcbPolygonRecordParser.#firstBoolean(fields, [
                'ISCUTOUT',
                'IS_CUTOUT',
                'CUTOUT'
            ]),
            realizationKind:
                getField(fields, 'POLYGONKIND') ||
                getField(fields, 'POURKIND') ||
                '',
            sourceRecordIndex: index,
            segments: outline.segments
        })
    }

    /**
     * Reads the first numeric field from a list of native aliases.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @param {string[]} keys Candidate keys.
     * @returns {number | undefined}
     */
    static #firstNumber(fields, keys) {
        for (const key of keys) {
            const value = parseNumericField(fields, key)
            if (value !== null) {
                return value
            }
        }

        return undefined
    }

    /**
     * Reads the first boolean field from a list of native aliases.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @param {string[]} keys Candidate keys.
     * @returns {boolean | undefined}
     */
    static #firstBoolean(fields, keys) {
        for (const key of keys) {
            if (getField(fields, key)) {
                return parseBoolean(fields[key])
            }
        }

        return undefined
    }

    /**
     * Removes empty optional fields while preserving zero and false.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) return entryValue.length > 0
                return (
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
                )
            })
        )
    }
}
