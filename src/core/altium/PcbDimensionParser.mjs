// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField } = ParserUtils

/**
 * Normalizes read-only PCB dimension records.
 */
export class PcbDimensionParser {
    /**
     * Parses Dimensions6/Data records into public dimension objects.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @returns {object[]}
     */
    static parse(records) {
        return (records || [])
            .filter((record) => record.sourceStream === 'Dimensions6/Data')
            .map((record, index) =>
                PcbDimensionParser.#normalizeDimension(record.fields, index)
            )
            .filter(Boolean)
    }

    /**
     * Normalizes one dimension record.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {number} index Source record index within the dimensions stream.
     * @returns {object | null}
     */
    static #normalizeDimension(fields, index) {
        const kindCode = PcbDimensionParser.#firstStringField(fields, [
            'DIMENSIONTYPE',
            'DIMENSIONKIND',
            'KIND',
            'TYPE'
        ])
        const references = PcbDimensionParser.#parseReferences(fields)
        const textLocation = PcbDimensionParser.#parsePoint(fields, [
            'TEXTLOCATION',
            'TEXT',
            'LOCATION'
        ])

        if (!kindCode && !references.length && !getField(fields, 'TEXT')) {
            return null
        }

        return {
            dimensionIndex: index,
            kind: PcbDimensionParser.#normalizeKind(kindCode),
            kindCode,
            name: getField(fields, 'NAME'),
            layer: getField(fields, 'LAYER'),
            text: getField(fields, 'TEXT'),
            prefix: getField(fields, 'PREFIX'),
            suffix: PcbDimensionParser.#rawStringField(fields, 'SUFFIX'),
            precision: PcbDimensionParser.#nullableNumber(
                parseNumericField(fields, 'PRECISION')
            ),
            measuredValue: PcbDimensionParser.#nullableNumber(
                PcbDimensionParser.#firstNumericField(fields, [
                    'MEASUREDVALUE',
                    'MEASURED',
                    'VALUE'
                ])
            ),
            angleValue: PcbDimensionParser.#nullableNumber(
                PcbDimensionParser.#firstNumericField(fields, [
                    'ANGLEVALUE',
                    'ANGLE',
                    'MEASUREDANGLE'
                ])
            ),
            unit: PcbDimensionParser.#resolveUnit(fields),
            references,
            textLocation,
            raw: { ...fields }
        }
    }

    /**
     * Parses reference points from indexed field names.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @returns {{ index: number, x: number, y: number }[]}
     */
    static #parseReferences(fields) {
        const references = []

        for (let index = 0; index < 16; index += 1) {
            const point = PcbDimensionParser.#parsePoint(fields, [
                'REFERENCE' + index,
                'REF' + index,
                'POINT' + index
            ])
            if (!point) {
                continue
            }
            references.push({ index, ...point })
        }

        return references
    }

    /**
     * Parses a point from common field prefixes.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string[]} prefixes Candidate field prefixes.
     * @returns {{ x: number, y: number } | null}
     */
    static #parsePoint(fields, prefixes) {
        for (const prefix of prefixes) {
            const x = PcbDimensionParser.#firstNumericField(fields, [
                prefix + '_X',
                prefix + '.X',
                prefix + 'X'
            ])
            const y = PcbDimensionParser.#firstNumericField(fields, [
                prefix + '_Y',
                prefix + '.Y',
                prefix + 'Y'
            ])

            if (x !== null && y !== null) {
                return { x, y }
            }
        }

        return null
    }

    /**
     * Reads the first non-empty string field.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {string}
     */
    static #firstStringField(fields, keys) {
        for (const key of keys) {
            const value = getField(fields, key)
            if (value) {
                return value
            }
        }

        return ''
    }

    /**
     * Reads the first finite numeric field.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {number | null}
     */
    static #firstNumericField(fields, keys) {
        for (const key of keys) {
            const value = parseNumericField(fields, key)
            if (value !== null) {
                return value
            }
        }

        return null
    }

    /**
     * Normalizes a dimension kind code.
     * @param {string} kindCode Raw dimension kind.
     * @returns {string}
     */
    static #normalizeKind(kindCode) {
        const normalized = String(kindCode || '').toLowerCase()
        if (/ang/u.test(normalized)) return 'angular'
        if (/radial|radius/u.test(normalized)) return 'radial'
        if (/datum/u.test(normalized)) return 'datum'
        if (/baseline/u.test(normalized)) return 'baseline'
        if (/ordinate/u.test(normalized)) return 'ordinate'
        return 'linear'
    }

    /**
     * Returns a number when finite, otherwise null.
     * @param {number | null} value Numeric candidate.
     * @returns {number | null}
     */
    static #nullableNumber(value) {
        return Number.isFinite(value) ? value : null
    }

    /**
     * Resolves a display unit from explicit or value-bearing fields.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @returns {string}
     */
    static #resolveUnit(fields) {
        const explicit = PcbDimensionParser.#firstStringField(fields, [
            'UNIT',
            'UNITS'
        ])
        if (explicit) {
            return explicit
        }

        const suffix = getField(fields, 'SUFFIX').trim()
        if (suffix) {
            return suffix
        }

        const measured = getField(fields, 'MEASUREDVALUE')
        const match = measured.match(/[a-zA-Z]+$/u)
        return match ? match[0] : ''
    }

    /**
     * Reads one field without trimming display-significant whitespace.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string} key Field key.
     * @returns {string}
     */
    static #rawStringField(fields, key) {
        const value = fields?.[key]
        if (Array.isArray(value)) {
            return String(value.findLast((entry) => entry !== '') || '')
        }
        return String(value || '')
    }
}
