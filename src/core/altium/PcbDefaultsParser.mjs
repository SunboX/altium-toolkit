// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField, toColor } = ParserUtils

/**
 * Builds read-only PCB and footprint-library default metadata.
 */
export class PcbDefaultsParser {
    static SCHEMA_ID = 'altium-toolkit.pcb.defaults.a1'

    /**
     * Parses a defaults read model from one field bag.
     * @param {Record<string, string | string[]> | undefined} fields Source fields.
     * @param {string} source Defaults source label.
     * @returns {object | null}
     */
    static parse(fields, source) {
        const board = PcbDefaultsParser.#stripEmpty({
            defaultFontName: PcbDefaultsParser.#firstField(fields, [
                'DEFAULTFONTNAME',
                'FONTNAME',
                'TEXTFONTNAME'
            ]),
            units: PcbDefaultsParser.#firstField(fields, [
                'UNITS',
                'BOARDUNITS',
                'MEASUREMENTUNITS'
            ])
        })
        const primitiveStyles = PcbDefaultsParser.#stripEmpty({
            trackWidthMil: PcbDefaultsParser.#firstNumber(fields, [
                'TRACKWIDTH',
                'DEFAULTTRACKWIDTH',
                'ROUTINGWIDTH'
            ]),
            viaHoleSizeMil: PcbDefaultsParser.#firstNumber(fields, [
                'VIAHOLESIZE',
                'VIAHOLE',
                'DEFAULTVIAHOLESIZE'
            ]),
            viaDiameterMil: PcbDefaultsParser.#firstNumber(fields, [
                'VIADIAMETER',
                'VIASIZE',
                'DEFAULTVIADIAMETER'
            ])
        })
        const maskPaste = PcbDefaultsParser.#stripEmpty({
            solder: PcbDefaultsParser.#stripEmpty({
                expansionMil: PcbDefaultsParser.#firstNumber(fields, [
                    'SOLDERMASKEXPANSION',
                    'SOLDERMASKEXPANSION_DEFAULT',
                    'MASKEXPANSION'
                ])
            }),
            paste: PcbDefaultsParser.#stripEmpty({
                expansionMil: PcbDefaultsParser.#firstNumber(fields, [
                    'PASTEMASKEXPANSION',
                    'PASTEMASKEXPANSION_DEFAULT',
                    'PASTEEXPANSION'
                ])
            })
        })
        const clearances = PcbDefaultsParser.#stripEmpty({
            defaultClearanceMil: PcbDefaultsParser.#firstNumber(fields, [
                'CLEARANCE',
                'DEFAULTCLEARANCE',
                'MINCLEARANCE'
            ])
        })
        const colors = PcbDefaultsParser.#stripEmpty({
            defaultColor: PcbDefaultsParser.#firstColor(fields, [
                'DEFAULTCOLOR',
                'COLOR'
            ]),
            solderMaskTopColor: PcbDefaultsParser.#firstColor(fields, [
                'SOLDERMASKTOPCOLOR',
                'TOPSOLDERMASKCOLOR',
                'CFG3D.TOPSOLDERMASKCOLOR'
            ]),
            solderMaskBottomColor: PcbDefaultsParser.#firstColor(fields, [
                'SOLDERMASKBOTTOMCOLOR',
                'BOTTOMSOLDERMASKCOLOR',
                'CFG3D.BOTTOMSOLDERMASKCOLOR'
            ])
        })
        const defaults = PcbDefaultsParser.#stripEmpty({
            schema: PcbDefaultsParser.SCHEMA_ID,
            source,
            board,
            primitiveStyles,
            maskPaste,
            clearances,
            colors
        })

        return Object.keys(defaults).length > 2 ? defaults : null
    }

    /**
     * Returns the first populated field value.
     * @param {Record<string, string | string[]> | undefined} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {string}
     */
    static #firstField(fields, keys) {
        for (const key of keys) {
            const value = getField(fields, key)
            if (value) return value
        }

        return ''
    }

    /**
     * Returns the first parsed numeric field.
     * @param {Record<string, string | string[]> | undefined} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {number | undefined}
     */
    static #firstNumber(fields, keys) {
        for (const key of keys) {
            const value = parseNumericField(fields, key)
            if (value !== null) return value
        }

        return undefined
    }

    /**
     * Returns the first parsed color field.
     * @param {Record<string, string | string[]> | undefined} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {string}
     */
    static #firstColor(fields, keys) {
        for (const key of keys) {
            if (getField(fields, key)) return toColor(fields[key], '')
        }

        return ''
    }

    /**
     * Removes empty properties from one object.
     * @param {Record<string, unknown>} object Source object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(object) {
        const result = {}

        for (const [key, value] of Object.entries(object || {})) {
            if (value === undefined || value === null || value === '') {
                continue
            }
            if (
                typeof value === 'object' &&
                !Array.isArray(value) &&
                Object.keys(value).length === 0
            ) {
                continue
            }
            result[key] = value
        }

        return result
    }
}
