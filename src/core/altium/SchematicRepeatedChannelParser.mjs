// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField } = ParserUtils

/**
 * Parses schematic repeated-channel declarations and derived net aliases.
 */
export class SchematicRepeatedChannelParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.repeated-channels.a1'

    /**
     * Parses repeated-channel rooms and sheet-entry aliases.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Schematic records.
     * @returns {object | null}
     */
    static parse(records) {
        const sheetSymbols = (records || []).filter(
            (record) => getField(record.fields, 'RECORD') === '15'
        )
        const sheetEntries = (records || []).filter(
            (record) => getField(record.fields, 'RECORD') === '16'
        )
        const rooms = sheetSymbols
            .map((record) => SchematicRepeatedChannelParser.#room(record))
            .filter(Boolean)
        const netAliases = rooms.flatMap((room) =>
            SchematicRepeatedChannelParser.#netAliases(
                room,
                sheetEntries.filter(
                    (entry) =>
                        getField(entry.fields, 'OwnerIndex') === room.ownerIndex
                )
            )
        )

        if (!rooms.length && !netAliases.length) {
            return null
        }

        return {
            schema: SchematicRepeatedChannelParser.SCHEMA_ID,
            rooms: rooms.map(({ ownerIndex, ...room }) => room),
            netAliases
        }
    }

    /**
     * Parses one repeated sheet-symbol declaration.
     * @param {object} record Sheet-symbol record.
     * @returns {object | null}
     */
    static #room(record) {
        const repeat = SchematicRepeatedChannelParser.#parseRepeatRange(
            getField(record.fields, 'Name') ||
                getField(record.fields, 'SheetName') ||
                getField(record.fields, 'Designator')
        )
        if (!repeat) {
            return null
        }

        const indexInSheet =
            parseNumericField(record.fields, 'IndexInSheet') ??
            record.recordIndex ??
            0
        const designatorTemplate =
            getField(record.fields, 'Designator') ||
            '$ChannelPrefix$ChannelIndex'
        const instances = []

        for (
            let index = repeat.startIndex;
            index <= repeat.endIndex;
            index += 1
        ) {
            const alpha = SchematicRepeatedChannelParser.#alpha(index)
            const channelPrefix = repeat.channelName
            const designator = SchematicRepeatedChannelParser.#formatDesignator(
                designatorTemplate,
                {
                    channelPrefix,
                    channelIndex: index,
                    channelAlpha: alpha
                }
            )

            instances.push({
                index,
                alpha,
                channelPrefix,
                designator,
                hierarchyPath: designator
            })
        }

        return {
            key: 'repeated-channel-' + String(indexInSheet),
            sheetSymbolKey: SchematicRepeatedChannelParser.#recordKey(record),
            ownerIndex: String(indexInSheet),
            channelName: repeat.channelName,
            startIndex: repeat.startIndex,
            endIndex: repeat.endIndex,
            designatorTemplate,
            instances
        }
    }

    /**
     * Builds aliases for repeated sheet entries.
     * @param {object} room Repeated-channel room.
     * @param {object[]} sheetEntries Child sheet-entry records.
     * @returns {object[]}
     */
    static #netAliases(room, sheetEntries) {
        return (sheetEntries || [])
            .map((entry) => {
                const repeatEntry =
                    SchematicRepeatedChannelParser.#parseRepeatEntryName(
                        getField(entry.fields, 'Name')
                    )
                if (!repeatEntry) {
                    return null
                }

                return {
                    key:
                        'repeated-channel-net-' +
                        String(entry.recordIndex ?? 0),
                    sheetEntryKey:
                        SchematicRepeatedChannelParser.#recordKey(entry),
                    sheetSymbolKey: room.sheetSymbolKey,
                    baseName: repeatEntry,
                    aliases: room.instances.map(
                        (instance) => instance.hierarchyPath + '/' + repeatEntry
                    ),
                    hierarchyPaths: room.instances.map(
                        (instance) => instance.hierarchyPath
                    )
                }
            })
            .filter(Boolean)
    }

    /**
     * Parses `REPEAT(name, start, end)`.
     * @param {string} value Raw repeat string.
     * @returns {{ channelName: string, startIndex: number, endIndex: number } | null}
     */
    static #parseRepeatRange(value) {
        const match = String(value || '').match(
            /^REPEAT\s*\(\s*([^,]+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/i
        )
        if (!match) {
            return null
        }

        const startIndex = Number.parseInt(match[2], 10)
        const endIndex = Number.parseInt(match[3], 10)
        if (
            !Number.isInteger(startIndex) ||
            !Number.isInteger(endIndex) ||
            endIndex < startIndex
        ) {
            return null
        }

        return {
            channelName: match[1].trim(),
            startIndex,
            endIndex
        }
    }

    /**
     * Parses `REPEAT(name)` sheet-entry aliases.
     * @param {string} value Raw sheet-entry name.
     * @returns {string}
     */
    static #parseRepeatEntryName(value) {
        const match = String(value || '').match(
            /^REPEAT\s*\(\s*([^)]+?)\s*\)$/i
        )
        return match ? match[1].trim() : ''
    }

    /**
     * Resolves a channel designator template.
     * @param {string} template Designator template.
     * @param {{ channelPrefix: string, channelIndex: number, channelAlpha: string }} tokens Channel tokens.
     * @returns {string}
     */
    static #formatDesignator(template, tokens) {
        return String(template || '')
            .replaceAll('$ChannelPrefix', tokens.channelPrefix)
            .replaceAll('$ChannelIndex', String(tokens.channelIndex))
            .replaceAll('$ChannelAlpha', tokens.channelAlpha)
    }

    /**
     * Converts one-based channel indexes into spreadsheet-style letters.
     * @param {number} index One-based index.
     * @returns {string}
     */
    static #alpha(index) {
        let value = Math.max(Number(index) || 1, 1)
        let output = ''

        while (value > 0) {
            value -= 1
            output = String.fromCharCode(65 + (value % 26)) + output
            value = Math.floor(value / 26)
        }

        return output
    }

    /**
     * Builds a stable schematic record key.
     * @param {object} record Schematic record.
     * @returns {string}
     */
    static #recordKey(record) {
        return 'schematic-record-' + String(record?.recordIndex ?? 0)
    }
}
