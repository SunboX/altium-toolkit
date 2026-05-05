// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField, toColor } = ParserUtils

/**
 * Normalizes schematic sheet symbols and sheet entries.
 */
export class SchematicSheetParser {
    /**
     * Parses sheet symbols and their child entries from schematic records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }[]} records
     * @returns {{ sheetSymbols: { x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, ownerIndex?: string, uniqueId: string, renderOrder: number, sourceRecordIndex: number, indexInSheet: number | null }[], sheetEntries: { ownerIndex: string, name: string, side: 'left' | 'right' | 'top' | 'bottom', direction: 'unspecified' | 'output' | 'input' | 'bidirectional', style: number, x: number, y: number, color: string, fill: string, textColor: string, harnessType: string, renderOrder: number }[] }}
     */
    static parse(records) {
        const sheetSymbols = records
            .map((record) =>
                SchematicSheetParser.#parseSheetSymbolRecord(record)
            )
            .filter(Boolean)
        const symbolLookup =
            SchematicSheetParser.#buildSheetSymbolLookup(sheetSymbols)
        const sheetEntries = records
            .map((record) =>
                SchematicSheetParser.#parseSheetEntryRecord(
                    record,
                    symbolLookup
                )
            )
            .filter(Boolean)

        return { sheetSymbols, sheetEntries }
    }

    /**
     * Normalizes one `RECORD=15` sheet symbol.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }} record
     * @returns {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, ownerIndex?: string, uniqueId: string, renderOrder: number, sourceRecordIndex: number, indexInSheet: number | null } | null}
     */
    static #parseSheetSymbolRecord(record) {
        if (getField(record.fields, 'RECORD') !== '15') {
            return null
        }

        const x = parseNumericField(record.fields, 'Location.X')
        const y = parseNumericField(record.fields, 'Location.Y')
        const width = parseNumericField(record.fields, 'XSize')
        const height = parseNumericField(record.fields, 'YSize')

        if (x === null || y === null || width === null || height === null) {
            return null
        }

        const indexInSheet = parseNumericField(record.fields, 'IndexInSheet')

        return {
            x,
            y,
            width,
            height,
            color: toColor(record.fields.Color, '#a44a1b'),
            fill: toColor(record.fields.AreaColor, '#ffe16f'),
            isSolid: parseBoolean(record.fields.IsSolid),
            transparent: parseBoolean(record.fields.Transparent),
            ownerIndex: getField(record.fields, 'OwnerIndex') || undefined,
            uniqueId: getField(record.fields, 'UniqueId'),
            renderOrder: indexInSheet ?? record.recordIndex,
            sourceRecordIndex: record.recordIndex,
            indexInSheet
        }
    }

    /**
     * Builds a lookup that tolerates the owner-index variants found in
     * recovered Altium records.
     * @param {{ sourceRecordIndex: number, indexInSheet: number | null }[]} sheetSymbols
     * @returns {Map<string, any>}
     */
    static #buildSheetSymbolLookup(sheetSymbols) {
        const lookup = new Map()

        for (const sheetSymbol of sheetSymbols) {
            const candidateKeys = new Set([
                String(sheetSymbol.sourceRecordIndex),
                String(sheetSymbol.sourceRecordIndex + 1)
            ])

            if (sheetSymbol.indexInSheet !== null) {
                candidateKeys.add(String(sheetSymbol.indexInSheet))
                candidateKeys.add(String(sheetSymbol.indexInSheet + 1))
            }

            for (const key of candidateKeys) {
                lookup.set(key, sheetSymbol)
            }
        }

        return lookup
    }

    /**
     * Normalizes one `RECORD=16` sheet entry against its parent symbol.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }} record
     * @param {Map<string, { x: number, y: number, width: number, height: number }>} symbolLookup
     * @returns {{ ownerIndex: string, name: string, side: 'left' | 'right' | 'top' | 'bottom', direction: 'unspecified' | 'output' | 'input' | 'bidirectional', style: number, x: number, y: number, color: string, fill: string, textColor: string, harnessType: string, renderOrder: number } | null}
     */
    static #parseSheetEntryRecord(record, symbolLookup) {
        if (getField(record.fields, 'RECORD') !== '16') {
            return null
        }

        const ownerIndex = getField(record.fields, 'OwnerIndex')
        const name = getField(record.fields, 'Name')
        const parentSymbol = symbolLookup.get(ownerIndex)

        if (!ownerIndex || !name || !parentSymbol) {
            return null
        }

        const side = SchematicSheetParser.#resolveSheetEntrySide(
            parseNumericField(record.fields, 'Side')
        )
        const distance = SchematicSheetParser.#parseSheetEntryDistance(
            record.fields
        )
        const point = SchematicSheetParser.#resolveSheetEntryPoint(
            parentSymbol,
            side,
            distance
        )

        return {
            ownerIndex,
            name,
            side,
            direction: SchematicSheetParser.#resolveSheetEntryDirection(
                parseNumericField(record.fields, 'IOType')
            ),
            style: parseNumericField(record.fields, 'Style') || 0,
            x: point.x,
            y: point.y,
            color: toColor(record.fields.Color, '#a44a1b'),
            fill: toColor(record.fields.AreaColor, '#ffe16f'),
            textColor: toColor(
                record.fields.TextColor || record.fields.Color,
                '#2c3134'
            ),
            harnessType: getField(record.fields, 'HarnessType'),
            renderOrder:
                parseNumericField(record.fields, 'IndexInSheet') ??
                record.recordIndex
        }
    }

    /**
     * Parses Altium's `DistanceFromTop` plus optional fractional companion.
     * @param {Record<string, string | string[]>} fields
     * @returns {number}
     */
    static #parseSheetEntryDistance(fields) {
        const whole = parseNumericField(fields, 'DistanceFromTop') || 0
        const fraction = parseNumericField(fields, 'DistanceFromTop_FRAC1') || 0
        const sign = whole < 0 ? -1 : 1

        return whole * 10 + (fraction / 100000) * sign
    }

    /**
     * Resolves one entry point on the parent sheet symbol perimeter.
     * @param {{ x: number, y: number, width: number, height: number }} parentSymbol
     * @param {'left' | 'right' | 'top' | 'bottom'} side
     * @param {number} distance
     * @returns {{ x: number, y: number }}
     */
    static #resolveSheetEntryPoint(parentSymbol, side, distance) {
        switch (side) {
            case 'right':
                return {
                    x: parentSymbol.x + parentSymbol.width,
                    y: parentSymbol.y - distance
                }
            case 'top':
                return {
                    x: parentSymbol.x + distance,
                    y: parentSymbol.y
                }
            case 'bottom':
                return {
                    x: parentSymbol.x + distance,
                    y: parentSymbol.y - parentSymbol.height
                }
            case 'left':
            default:
                return {
                    x: parentSymbol.x,
                    y: parentSymbol.y - distance
                }
        }
    }

    /**
     * Resolves a sheet-entry side code into a readable label.
     * @param {number | null} side
     * @returns {'left' | 'right' | 'top' | 'bottom'}
     */
    static #resolveSheetEntrySide(side) {
        switch (side) {
            case 1:
                return 'right'
            case 2:
                return 'top'
            case 3:
                return 'bottom'
            case 0:
            default:
                return 'left'
        }
    }

    /**
     * Resolves an Altium I/O code into a readable direction label.
     * @param {number | null} ioType
     * @returns {'unspecified' | 'output' | 'input' | 'bidirectional'}
     */
    static #resolveSheetEntryDirection(ioType) {
        switch (ioType) {
            case 1:
                return 'output'
            case 2:
                return 'input'
            case 3:
                return 'bidirectional'
            case 0:
            default:
                return 'unspecified'
        }
    }
}
