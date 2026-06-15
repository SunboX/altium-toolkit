// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getDisplayText, getField, parseBoolean, parseNumericField, toColor } =
    ParserUtils

/**
 * Preserves auxiliary schematic code-symbol records as a read-only sidecar.
 */
export class SchematicCodeSymbolParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.code-symbols.a1'

    /**
     * Parses code-symbol family records from schematic records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }[]} records Parsed records.
     * @returns {{ schema: string, summary: object, symbols: object[], entries: object[], texts: object[], markers: object[] } | null}
     */
    static parse(records) {
        const symbols = records
            .map((record) =>
                SchematicCodeSymbolParser.#parseSymbolRecord(record)
            )
            .filter(Boolean)
        const symbolLookup =
            SchematicCodeSymbolParser.#buildSymbolLookup(symbols)
        const entries = records
            .map((record) =>
                SchematicCodeSymbolParser.#parseEntryRecord(
                    record,
                    symbolLookup
                )
            )
            .filter(Boolean)
        const texts = records
            .map((record) =>
                SchematicCodeSymbolParser.#parseTextRecord(record, symbolLookup)
            )
            .filter(Boolean)
        const markers = records
            .map((record) =>
                SchematicCodeSymbolParser.#parseMarkerRecord(record)
            )
            .filter(Boolean)

        if (
            !symbols.length &&
            !entries.length &&
            !texts.length &&
            !markers.length
        ) {
            return null
        }

        SchematicCodeSymbolParser.#attachChildKeys(symbols, entries, texts)

        return {
            schema: SchematicCodeSymbolParser.SCHEMA_ID,
            summary: {
                symbolCount: symbols.length,
                entryCount: entries.length,
                textCount: texts.length,
                markerCount: markers.length
            },
            symbols: symbols.map((symbol) =>
                SchematicCodeSymbolParser.#publicSymbol(symbol)
            ),
            entries,
            texts,
            markers
        }
    }

    /**
     * Parses one `RECORD=220` code symbol.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }} record Parsed record.
     * @returns {object | null}
     */
    static #parseSymbolRecord(record) {
        if (getField(record.fields, 'RECORD') !== '220') {
            return null
        }

        const indexInSheet = parseNumericField(record.fields, 'IndexInSheet')
        const stableIndex =
            indexInSheet === null ? record.recordIndex : indexInSheet
        const routines = SchematicCodeSymbolParser.#parseRoutineRows(
            record.fields
        )
        const internalMemory = SchematicCodeSymbolParser.#parseInternalMemory(
            record.fields
        )
        const externalMemory =
            SchematicCodeSymbolParser.#parseExternalMemoryRows(record.fields)

        return {
            key: 'schematic-code-symbol-' + stableIndex,
            recordKey: SchematicCodeSymbolParser.#recordKey(record),
            recordId: 'record-' + stableIndex,
            x: parseNumericField(record.fields, 'Location.X') || 0,
            y: parseNumericField(record.fields, 'Location.Y') || 0,
            width: parseNumericField(record.fields, 'XSize') || 0,
            height: parseNumericField(record.fields, 'YSize') || 0,
            color: toColor(record.fields.Color, '#2c3134'),
            fill: toColor(record.fields.AreaColor, '#f6f0d8'),
            isSolid: parseBoolean(record.fields.IsSolid),
            ...(getField(record.fields, 'SymbolType')
                ? { symbolType: getField(record.fields, 'SymbolType') }
                : {}),
            ...(getField(record.fields, 'UniqueID') ||
            getField(record.fields, 'UniqueId')
                ? {
                      uniqueId:
                          getField(record.fields, 'UniqueID') ||
                          getField(record.fields, 'UniqueId')
                  }
                : {}),
            ...(routines.length ? { routines } : {}),
            ...(Object.keys(internalMemory).length ? { internalMemory } : {}),
            ...(externalMemory.length ? { externalMemory } : {}),
            entryKeys: [],
            textKeys: [],
            sourceRecordIndex: record.recordIndex,
            indexInSheet
        }
    }

    /**
     * Parses one `RECORD=221` code symbol entry.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }} record Parsed record.
     * @param {Map<string, object>} symbolLookup Symbol lookup by owner index.
     * @returns {object | null}
     */
    static #parseEntryRecord(record, symbolLookup) {
        if (getField(record.fields, 'RECORD') !== '221') {
            return null
        }

        const indexInSheet = parseNumericField(record.fields, 'IndexInSheet')
        const stableIndex =
            indexInSheet === null ? record.recordIndex : indexInSheet
        const ownerIndex = getField(record.fields, 'OwnerIndex')
        const parentSymbol = symbolLookup.get(ownerIndex)
        const side = SchematicCodeSymbolParser.#resolveSide(
            parseNumericField(record.fields, 'Side')
        )
        const distance = SchematicCodeSymbolParser.#parseEntryDistance(
            record.fields
        )
        const point = parentSymbol
            ? SchematicCodeSymbolParser.#resolveEntryPoint(
                  parentSymbol,
                  side,
                  distance
              )
            : null
        const entryType = parseNumericField(record.fields, 'EntryType')
        const style = parseNumericField(record.fields, 'Style')
        const textFontId = parseNumericField(record.fields, 'TextFontID')
        const dataWidth = parseNumericField(record.fields, 'DataWidth')

        return {
            key: 'schematic-code-entry-' + stableIndex,
            recordKey: SchematicCodeSymbolParser.#recordKey(record),
            ...(parentSymbol ? { ownerSymbolKey: parentSymbol.key } : {}),
            ...(ownerIndex ? { ownerIndex } : {}),
            ...(getField(record.fields, 'Name')
                ? { name: getField(record.fields, 'Name') }
                : {}),
            ...(getField(record.fields, 'DataIdentifier')
                ? {
                      dataIdentifier: getField(record.fields, 'DataIdentifier')
                  }
                : {}),
            ...(getField(record.fields, 'DataType')
                ? { dataType: getField(record.fields, 'DataType') }
                : {}),
            ...(dataWidth !== null ? { dataWidth } : {}),
            side,
            direction: SchematicCodeSymbolParser.#resolveDirection(
                parseNumericField(record.fields, 'IOType')
            ),
            ...(entryType !== null ? { entryType } : {}),
            ...(style !== null ? { style } : {}),
            ...(point ? { x: point.x, y: point.y } : {}),
            color: toColor(record.fields.Color, '#2c3134'),
            fill: toColor(record.fields.AreaColor, '#f6f0d8'),
            textColor: toColor(
                record.fields.TextColor || record.fields.Color,
                '#2c3134'
            ),
            ...(textFontId !== null ? { textFontId } : {}),
            ...(getField(record.fields, 'ParentRoutine')
                ? { parentRoutine: getField(record.fields, 'ParentRoutine') }
                : {}),
            ...(parseBoolean(record.fields.OwnerIndexAdditionalList)
                ? { ownerIndexAdditionalList: true }
                : {})
        }
    }

    /**
     * Parses one `RECORD=222` or `RECORD=223` text row.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }} record Parsed record.
     * @param {Map<string, object>} symbolLookup Symbol lookup by owner index.
     * @returns {object | null}
     */
    static #parseTextRecord(record, symbolLookup) {
        const recordType = getField(record.fields, 'RECORD')
        if (recordType !== '222' && recordType !== '223') {
            return null
        }

        const indexInSheet = parseNumericField(record.fields, 'IndexInSheet')
        const stableIndex =
            indexInSheet === null ? record.recordIndex : indexInSheet
        const ownerIndex = getField(record.fields, 'OwnerIndex')
        const parentSymbol = symbolLookup.get(ownerIndex)
        const x = parseNumericField(record.fields, 'Location.X')
        const y = parseNumericField(record.fields, 'Location.Y')
        const fontId = parseNumericField(record.fields, 'FontID')

        return {
            key: 'schematic-code-text-' + stableIndex,
            recordKey: SchematicCodeSymbolParser.#recordKey(record),
            ...(parentSymbol ? { ownerSymbolKey: parentSymbol.key } : {}),
            ...(ownerIndex ? { ownerIndex } : {}),
            kind: recordType === '222' ? 'title' : 'source',
            text: getDisplayText(record.fields),
            ...(x !== null ? { x } : {}),
            ...(y !== null ? { y } : {}),
            ...(fontId !== null ? { fontId } : {}),
            color: toColor(record.fields.Color, '#2c3134')
        }
    }

    /**
     * Parses one `RECORD=210` marker row.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }} record Parsed record.
     * @returns {object | null}
     */
    static #parseMarkerRecord(record) {
        if (getField(record.fields, 'RECORD') !== '210') {
            return null
        }

        const indexInSheet = parseNumericField(record.fields, 'IndexInSheet')
        const stableIndex =
            indexInSheet === null ? record.recordIndex : indexInSheet
        const x = parseNumericField(record.fields, 'Location.X')
        const y = parseNumericField(record.fields, 'Location.Y')

        return {
            key: 'schematic-code-marker-' + stableIndex,
            recordKey: SchematicCodeSymbolParser.#recordKey(record),
            recordId: 'record-' + stableIndex,
            ...(getField(record.fields, 'Name')
                ? { name: getField(record.fields, 'Name') }
                : {}),
            ...(x !== null ? { x } : {}),
            ...(y !== null ? { y } : {}),
            color: toColor(record.fields.Color, '#2c3134'),
            ...(getField(record.fields, 'OwnerPartID') ||
            getField(record.fields, 'OwnerPartId')
                ? {
                      ownerPartId:
                          getField(record.fields, 'OwnerPartID') ||
                          getField(record.fields, 'OwnerPartId')
                  }
                : {})
        }
    }

    /**
     * Parses indexed exported routine metadata.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @returns {object[]}
     */
    static #parseRoutineRows(fields) {
        const count = SchematicCodeSymbolParser.#resolveIndexedRowCount(
            fields,
            'ExportedRoutineCount',
            /^(?:RoutineName|InterfaceMode|DataWidth|AddressWidth|Scope|Mau|NoWait|IsLinked)(\d+)$/u
        )
        const rows = []

        for (let index = 0; index < count; index += 1) {
            const row = {
                index,
                ...(getField(fields, 'RoutineName' + index)
                    ? { name: getField(fields, 'RoutineName' + index) }
                    : {})
            }
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'interfaceMode',
                fields,
                'InterfaceMode' + index
            )
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'dataWidth',
                fields,
                'DataWidth' + index
            )
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'addressWidth',
                fields,
                'AddressWidth' + index
            )
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'scope',
                fields,
                'Scope' + index
            )
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'mau',
                fields,
                'Mau' + index
            )
            SchematicCodeSymbolParser.#assignBooleanField(
                row,
                'noWait',
                fields,
                'NoWait' + index
            )
            SchematicCodeSymbolParser.#assignBooleanField(
                row,
                'isLinked',
                fields,
                'IsLinked' + index
            )

            if (Object.keys(row).length > 1) {
                rows.push(row)
            }
        }

        return rows
    }

    /**
     * Parses code-symbol internal memory summary fields.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @returns {object}
     */
    static #parseInternalMemory(fields) {
        const row = {}
        SchematicCodeSymbolParser.#assignNumericField(
            row,
            'count',
            fields,
            'InternalMemoryCount'
        )
        SchematicCodeSymbolParser.#assignNumericField(
            row,
            'size',
            fields,
            'InternalMemorySize'
        )
        SchematicCodeSymbolParser.#assignNumericField(
            row,
            'interfaceMode',
            fields,
            'InternalMemoryInterface'
        )
        SchematicCodeSymbolParser.#assignNumericField(
            row,
            'dataWidth',
            fields,
            'InternalMemoryDataWidth'
        )
        SchematicCodeSymbolParser.#assignNumericField(
            row,
            'addressWidth',
            fields,
            'InternalMemoryAddressWidth'
        )

        return row
    }

    /**
     * Parses indexed external memory metadata.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @returns {object[]}
     */
    static #parseExternalMemoryRows(fields) {
        const count = SchematicCodeSymbolParser.#resolveIndexedRowCount(
            fields,
            'ExternalMemoryCount',
            /^ExternalMemory_(?:Name|Interface|DataWidth|AddressWidth|Scope|Mau|IsReserved)(\d+)$/u
        )
        const rows = []

        for (let index = 0; index < count; index += 1) {
            const row = {
                index,
                ...(getField(fields, 'ExternalMemory_Name' + index)
                    ? {
                          name: getField(fields, 'ExternalMemory_Name' + index)
                      }
                    : {})
            }
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'interfaceMode',
                fields,
                'ExternalMemory_Interface' + index
            )
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'dataWidth',
                fields,
                'ExternalMemory_DataWidth' + index
            )
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'addressWidth',
                fields,
                'ExternalMemory_AddressWidth' + index
            )
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'scope',
                fields,
                'ExternalMemory_Scope' + index
            )
            SchematicCodeSymbolParser.#assignNumericField(
                row,
                'mau',
                fields,
                'ExternalMemory_Mau' + index
            )
            SchematicCodeSymbolParser.#assignBooleanField(
                row,
                'isReserved',
                fields,
                'ExternalMemory_IsReserved' + index
            )

            if (Object.keys(row).length > 1) {
                rows.push(row)
            }
        }

        return rows
    }

    /**
     * Resolves indexed row count from an explicit count or discovered fields.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {string} countKey Explicit count field.
     * @param {RegExp} pattern Indexed field matcher with an index capture.
     * @returns {number}
     */
    static #resolveIndexedRowCount(fields, countKey, pattern) {
        const explicitCount = parseNumericField(fields, countKey)
        let discoveredCount = 0

        for (const key of Object.keys(fields || {})) {
            const match = key.match(pattern)
            if (!match) continue
            const index = Number(match[1])
            if (Number.isInteger(index)) {
                discoveredCount = Math.max(discoveredCount, index + 1)
            }
        }

        return Math.max(explicitCount || 0, discoveredCount)
    }

    /**
     * Adds a numeric field to a row when present.
     * @param {object} row Target row.
     * @param {string} property Public property.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {string} fieldName Native field name.
     * @returns {void}
     */
    static #assignNumericField(row, property, fields, fieldName) {
        const value = parseNumericField(fields, fieldName)
        if (value !== null) {
            row[property] = value
        }
    }

    /**
     * Adds a boolean field to a row when the source field exists.
     * @param {object} row Target row.
     * @param {string} property Public property.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {string} fieldName Native field name.
     * @returns {void}
     */
    static #assignBooleanField(row, property, fields, fieldName) {
        if (getField(fields, fieldName)) {
            row[property] = parseBoolean(fields[fieldName])
        }
    }

    /**
     * Builds a lookup that tolerates owner-index variants.
     * @param {{ key: string, sourceRecordIndex: number, indexInSheet: number | null }[]} symbols Parsed symbols.
     * @returns {Map<string, object>}
     */
    static #buildSymbolLookup(symbols) {
        const lookup = new Map()

        for (const symbol of symbols) {
            const candidateKeys = new Set([
                String(symbol.sourceRecordIndex),
                String(symbol.sourceRecordIndex + 1)
            ])

            if (symbol.indexInSheet !== null) {
                candidateKeys.add(String(symbol.indexInSheet))
                candidateKeys.add(String(symbol.indexInSheet + 1))
            }

            for (const key of candidateKeys) {
                lookup.set(key, symbol)
            }
        }

        return lookup
    }

    /**
     * Attaches entry and text references to parent symbols.
     * @param {object[]} symbols Parsed symbols.
     * @param {object[]} entries Parsed entries.
     * @param {object[]} texts Parsed texts.
     * @returns {void}
     */
    static #attachChildKeys(symbols, entries, texts) {
        const symbolsByKey = new Map(
            symbols.map((symbol) => [symbol.key, symbol])
        )

        for (const entry of entries) {
            const symbol = symbolsByKey.get(entry.ownerSymbolKey)
            if (symbol) {
                symbol.entryKeys.push(entry.key)
            }
        }

        for (const text of texts) {
            const symbol = symbolsByKey.get(text.ownerSymbolKey)
            if (symbol) {
                symbol.textKeys.push(text.key)
            }
        }
    }

    /**
     * Removes internal lookup metadata from a public symbol row.
     * @param {object} symbol Internal symbol row.
     * @returns {object}
     */
    static #publicSymbol(symbol) {
        const { sourceRecordIndex, indexInSheet, ...publicSymbol } = symbol
        return publicSymbol
    }

    /**
     * Parses an entry distance field and optional fractional companion.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @returns {number}
     */
    static #parseEntryDistance(fields) {
        const whole = parseNumericField(fields, 'DistanceFromTop') || 0
        const fraction = parseNumericField(fields, 'DistanceFromTop_FRAC1') || 0
        const sign = whole < 0 ? -1 : 1

        return whole * 10 + (fraction / 100000) * sign
    }

    /**
     * Resolves an entry point on the parent symbol perimeter.
     * @param {{ x: number, y: number, width: number, height: number }} parentSymbol Parent symbol.
     * @param {'left' | 'right' | 'top' | 'bottom'} side Symbol side.
     * @param {number} distance Distance from the side origin.
     * @returns {{ x: number, y: number }}
     */
    static #resolveEntryPoint(parentSymbol, side, distance) {
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
     * Resolves a side code into a public side label.
     * @param {number | null} side Native side code.
     * @returns {'left' | 'right' | 'top' | 'bottom'}
     */
    static #resolveSide(side) {
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
     * Resolves an I/O code into a public direction label.
     * @param {number | null} ioType Native I/O code.
     * @returns {'unspecified' | 'output' | 'input' | 'bidirectional'}
     */
    static #resolveDirection(ioType) {
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

    /**
     * Builds a stable schematic record key.
     * @param {{ recordIndex?: number }} record Parsed record.
     * @returns {string}
     */
    static #recordKey(record) {
        return 'schematic-record-' + String(record?.recordIndex ?? 0)
    }
}
