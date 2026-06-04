// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getDisplayText, getField, parseBoolean, parseNumericField, toColor } =
    ParserUtils

/**
 * Parses cross-sheet connector records into a first-class schematic sidecar.
 */
export class SchematicCrossSheetConnectorParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.cross-sheet-connectors.a1'

    /**
     * Parses cross-sheet connector records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Schematic records.
     * @returns {object | null}
     */
    static parse(records) {
        const connectors = (records || [])
            .filter((record) =>
                SchematicCrossSheetConnectorParser.#isCrossSheetConnector(
                    record
                )
            )
            .map((record) =>
                SchematicCrossSheetConnectorParser.#connector(record)
            )
            .filter(Boolean)

        if (!connectors.length) {
            return null
        }

        return {
            schema: SchematicCrossSheetConnectorParser.SCHEMA_ID,
            connectors
        }
    }

    /**
     * Returns true when a record is tagged as a cross-sheet connector.
     * @param {object} record Schematic record.
     * @returns {boolean}
     */
    static #isCrossSheetConnector(record) {
        if (getField(record?.fields, 'RECORD') !== '17') {
            return false
        }

        return (
            parseBoolean(record.fields.IsCrossSheetConnector) ||
            parseBoolean(record.fields.CrossSheetConnector) ||
            parseBoolean(record.fields.ISCROSSSHEETCONNECTOR) ||
            parseBoolean(record.fields.IsOffSheetConnector)
        )
    }

    /**
     * Parses one cross-sheet connector record.
     * @param {object} record Schematic record.
     * @returns {object | null}
     */
    static #connector(record) {
        const x = parseNumericField(record.fields, 'Location.X')
        const y = parseNumericField(record.fields, 'Location.Y')

        if (x === null || y === null) {
            return null
        }

        const indexInSheet =
            parseNumericField(record.fields, 'IndexInSheet') ??
            record.recordIndex ??
            0
        const name =
            getDisplayText(record.fields) || getField(record.fields, 'Name')

        return SchematicCrossSheetConnectorParser.#stripEmpty({
            key: 'cross-sheet-connector-' + String(indexInSheet),
            recordKey: SchematicCrossSheetConnectorParser.#recordKey(record),
            recordId: 'record-' + String(indexInSheet),
            name,
            x,
            y,
            style: SchematicCrossSheetConnectorParser.#style(
                parseNumericField(record.fields, 'Style') ??
                    parseNumericField(record.fields, 'Orientation') ??
                    0
            ),
            color: toColor(record.fields.Color, '#000000')
        })
    }

    /**
     * Resolves a connector style code.
     * @param {number} value Style code.
     * @returns {'left' | 'right' | 'top' | 'bottom'}
     */
    static #style(value) {
        switch (Number(value)) {
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
     * Builds a stable schematic record key.
     * @param {object} record Schematic record.
     * @returns {string}
     */
    static #recordKey(record) {
        return 'schematic-record-' + String(record?.recordIndex ?? 0)
    }

    /**
     * Drops empty optional fields.
     * @param {Record<string, unknown>} value Source object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value).filter(([, entry]) => {
                if (Array.isArray(entry)) {
                    return entry.length > 0
                }
                return entry !== null && entry !== undefined && entry !== ''
            })
        )
    }
}
