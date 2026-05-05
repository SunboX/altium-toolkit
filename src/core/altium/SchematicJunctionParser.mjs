// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField, toColor } = ParserUtils

/**
 * Normalizes explicit schematic junction records.
 */
export class SchematicJunctionParser {
    /**
     * Parses authored schematic junction dots from `RECORD=29`.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }[]} records
     * @returns {{ x: number, y: number, color: string, renderOrder: number }[]}
     */
    static parseSchematicJunctions(records) {
        return records
            .map((record) => {
                if (getField(record.fields, 'RECORD') !== '29') {
                    return null
                }

                const x = parseNumericField(record.fields, 'Location.X')
                const y = parseNumericField(record.fields, 'Location.Y')

                if (x === null || y === null) {
                    return null
                }

                return {
                    x,
                    y,
                    color: toColor(record.fields.Color, '#000080'),
                    renderOrder:
                        parseNumericField(record.fields, 'IndexInSheet') ??
                        record.recordIndex
                }
            })
            .filter(Boolean)
    }
}
