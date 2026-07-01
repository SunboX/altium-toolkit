// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

/**
 * Resolves native schematic text orientation flags.
 */
export class SchematicTextOrientationResolver {
    /**
     * Resolves component designator/parameter orientation bit 1 to right
     * anchoring.
     * @param {Record<string, string | string[]>} fields Text record fields.
     * @param {string} recordType Native text record type.
     * @returns {'end' | null}
     */
    static resolveHorizontalAnchor(fields, recordType) {
        if (
            !SchematicTextOrientationResolver.#isComponentTextRecord(recordType)
        ) {
            return null
        }

        const orientation = ParserUtils.parseNumericField(fields, 'Orientation')
        if (!Number.isInteger(orientation)) return null

        return (orientation & 2) === 2 ? 'end' : null
    }

    /**
     * Resolves text vertical anchoring from Altium's justification grid and
     * component text orientation bits.
     * @param {Record<string, string | string[]>} fields Text record fields.
     * @param {string} recordType Native text record type.
     * @returns {'middle' | 'top' | null}
     */
    static resolveVerticalAnchor(fields, recordType) {
        const justificationAnchor =
            SchematicTextOrientationResolver.#resolveJustificationVerticalAnchor(
                fields
            )
        if (justificationAnchor) return justificationAnchor

        return SchematicTextOrientationResolver.resolveHorizontalAnchor(
            fields,
            recordType
        )
            ? 'top'
            : null
    }

    /**
     * Returns true when a text record's orientation encodes a quarter-turn.
     * Component designators and parameters use bit 0; older free labels use
     * the literal orientation-1 value.
     * @param {string} recordType Native text record type.
     * @param {number | null} orientation Native orientation value.
     * @returns {boolean}
     */
    static shouldRotateFromOrientation(recordType, orientation) {
        if (!Number.isInteger(orientation)) {
            return false
        }

        if (
            SchematicTextOrientationResolver.#isComponentTextRecord(recordType)
        ) {
            return (orientation & 1) === 1
        }

        return orientation === 1
    }

    /**
     * Resolves the vertical row from Altium's 3x3 justification grid.
     * @param {Record<string, string | string[]>} fields Text record fields.
     * @returns {'middle' | 'top' | null}
     */
    static #resolveJustificationVerticalAnchor(fields) {
        const justification =
            ParserUtils.parseNumericField(fields, 'Justification') ??
            ParserUtils.parseNumericField(fields, 'Alignment')

        if (!Number.isInteger(justification)) {
            return null
        }

        const normalizedJustification = ((justification % 9) + 9) % 9
        const verticalRow = Math.floor(normalizedJustification / 3)

        if (verticalRow === 1) return 'middle'
        if (verticalRow === 2) return 'top'
        return null
    }

    /**
     * Returns true for component designator and parameter text records.
     * @param {string} recordType Native text record type.
     * @returns {boolean}
     */
    static #isComponentTextRecord(recordType) {
        return recordType === '34' || recordType === '41'
    }
}
