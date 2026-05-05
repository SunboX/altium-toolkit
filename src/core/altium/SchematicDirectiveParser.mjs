// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

/**
 * Helpers for normalized schematic directive primitives.
 */
export class SchematicDirectiveParser {
    /**
     * Normalizes schematic directive records into drawable directive metadata.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, color: string, name: string, orientation: number }[]}
     */
    static parseSchematicDirectives(records) {
        return records
            .map((record) => {
                const x = ParserUtils.parseNumericField(
                    record.fields,
                    'Location.X'
                )
                const y = ParserUtils.parseNumericField(
                    record.fields,
                    'Location.Y'
                )
                const name = ParserUtils.getField(record.fields, 'Name')

                if (x === null || y === null || !name) {
                    return null
                }

                return {
                    x,
                    y,
                    color: ParserUtils.toColor(record.fields.Color, '#ff0000'),
                    name,
                    orientation:
                        ParserUtils.parseNumericField(
                            record.fields,
                            'Orientation'
                        ) || 0
                }
            })
            .filter(Boolean)
    }
}
