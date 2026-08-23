// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const {
    getDisplayText,
    getField,
    parseBoolean,
    parseNumericField,
    parseSchematicLineWidth,
    toColor
} = ParserUtils

/**
 * Parses schematic harness connector records into a first-class read model.
 */
export class SchematicHarnessParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.harness.a1'

    /**
     * Parses harness connectors, entries, type labels, and signal harnesses.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Schematic records.
     * @returns {object | null}
     */
    static parse(records) {
        const connectors = (records || [])
            .filter((record) => getField(record.fields, 'RECORD') === '215')
            .map((record) => SchematicHarnessParser.#connector(record, records))
        const signalHarnesses = (records || [])
            .filter((record) => getField(record.fields, 'RECORD') === '218')
            .map((record) => SchematicHarnessParser.#signalHarness(record))
            .filter(Boolean)

        if (!connectors.length && !signalHarnesses.length) {
            return null
        }

        return {
            schema: SchematicHarnessParser.SCHEMA_ID,
            connectors,
            signalHarnesses,
            bundleLinks: SchematicHarnessParser.#bundleLinks(
                connectors,
                signalHarnesses
            )
        }
    }

    /**
     * Parses one harness connector and its owned children.
     * @param {object} record Connector record.
     * @param {object[]} records All records.
     * @returns {object}
     */
    static #connector(record, records) {
        const ownerKeys = new Set(SchematicHarnessParser.#ownerKeys(record))
        const ownedChildren = SchematicHarnessParser.#ownedChildren(
            record,
            records,
            ownerKeys
        )
        const entries = ownedChildren
            .filter(
                (candidate) => getField(candidate.fields, 'RECORD') === '216'
            )
            .map((entry) => SchematicHarnessParser.#entry(entry))
        const typeLabelRecord = ownedChildren.find(
            (candidate) => getField(candidate.fields, 'RECORD') === '217'
        )
        const indexInSheet = parseNumericField(record.fields, 'IndexInSheet')
        const connectorKey =
            'harness-connector-' + String(indexInSheet ?? record.recordIndex)

        return SchematicHarnessParser.#stripEmpty({
            key: connectorKey,
            recordKey: SchematicHarnessParser.#recordKey(record),
            recordId: SchematicHarnessParser.#recordId(record),
            x: parseNumericField(record.fields, 'Location.X') || 0,
            y: parseNumericField(record.fields, 'Location.Y') || 0,
            width: parseNumericField(record.fields, 'XSize') || 0,
            height: parseNumericField(record.fields, 'YSize') || 0,
            side: SchematicHarnessParser.#side(
                parseNumericField(record.fields, 'Side')
            ),
            primaryConnectionPosition:
                parseNumericField(record.fields, 'PrimaryConnectionPosition') ||
                0,
            lineWidth: parseSchematicLineWidth(record.fields),
            color: toColor(record.fields.Color, '#000000'),
            fill: toColor(record.fields.AreaColor, '#ffffff'),
            entries,
            typeLabel: typeLabelRecord
                ? SchematicHarnessParser.#typeLabel(typeLabelRecord)
                : null
        })
    }

    /**
     * Parses one harness entry.
     * @param {object} record Entry record.
     * @returns {object}
     */
    static #entry(record) {
        return SchematicHarnessParser.#stripEmpty({
            key: 'harness-entry-' + String(record.recordIndex ?? 0),
            recordKey: SchematicHarnessParser.#recordKey(record),
            name: getField(record.fields, 'Name'),
            side: SchematicHarnessParser.#side(
                parseNumericField(record.fields, 'Side')
            ),
            distanceFromTop: SchematicHarnessParser.#distanceFromTop(
                record.fields
            ),
            harnessType: getField(record.fields, 'HarnessType'),
            textStyle: SchematicHarnessParser.#textStyle(
                getField(record.fields, 'TextStyle')
            ),
            textColor: toColor(record.fields.TextColor, '#000000')
        })
    }

    /**
     * Parses one harness type label.
     * @param {object} record Type-label record.
     * @returns {object}
     */
    static #typeLabel(record) {
        return SchematicHarnessParser.#stripEmpty({
            key: 'harness-type-' + String(record.recordIndex ?? 0),
            recordKey: SchematicHarnessParser.#recordKey(record),
            text: getDisplayText(record.fields),
            x: parseNumericField(record.fields, 'Location.X') || 0,
            y: parseNumericField(record.fields, 'Location.Y') || 0,
            color: toColor(record.fields.Color, '#000000')
        })
    }

    /**
     * Parses one signal harness polyline.
     * @param {object} record Signal-harness record.
     * @returns {object | null}
     */
    static #signalHarness(record) {
        const points = SchematicHarnessParser.#points(record.fields)
        if (points.length < 2) {
            return null
        }

        return SchematicHarnessParser.#stripEmpty({
            key: 'signal-harness-' + String(record.recordIndex ?? 0),
            recordKey: SchematicHarnessParser.#recordKey(record),
            points,
            color: toColor(record.fields.Color, '#9fc5e8'),
            lineWidth: parseSchematicLineWidth(record.fields)
        })
    }

    /**
     * Builds high-level bundle links between connectors and signal harnesses.
     * @param {object[]} connectors Connector rows.
     * @param {object[]} signalHarnesses Signal harness rows.
     * @returns {object[]}
     */
    static #bundleLinks(connectors, signalHarnesses) {
        return (connectors || []).map((connector, index) =>
            SchematicHarnessParser.#stripEmpty({
                key: 'harness-bundle-' + index,
                connectorKey: connector.key,
                harnessType:
                    connector.typeLabel?.text ||
                    connector.entries?.find((entry) => entry.harnessType)
                        ?.harnessType,
                entries: (connector.entries || []).map((entry) => entry.name),
                signalHarnessKeys: (signalHarnesses || []).map(
                    (signalHarness) => signalHarness.key
                )
            })
        )
    }

    /**
     * Converts harness-entry distance fields into mils.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @returns {number}
     */
    static #distanceFromTop(fields) {
        const whole = parseNumericField(fields, 'DistanceFromTop') || 0
        const fraction = parseNumericField(fields, 'DistanceFromTop_Frac1') || 0
        return Number((whole * 10 + fraction / 100000).toFixed(4))
    }

    /**
     * Resolves explicit children and consecutive additional-list children.
     * @param {object} connector Connector record.
     * @param {object[]} records All schematic records.
     * @param {Set<string>} ownerKeys Valid explicit owner keys.
     * @returns {object[]}
     */
    static #ownedChildren(connector, records, ownerKeys) {
        const sourceRecords = records || []
        const children = sourceRecords.filter((candidate) => {
            const recordType = getField(candidate.fields, 'RECORD')
            return (
                (recordType === '216' || recordType === '217') &&
                ownerKeys.has(getField(candidate.fields, 'OwnerIndex'))
            )
        })
        const connectorPosition = sourceRecords.indexOf(connector)

        for (
            let index = connectorPosition + 1;
            connectorPosition >= 0 && index < sourceRecords.length;
            index += 1
        ) {
            const candidate = sourceRecords[index]
            const recordType = getField(candidate.fields, 'RECORD')
            if (recordType !== '216' && recordType !== '217') {
                break
            }
            if (
                getField(candidate.fields, 'OwnerIndex') ||
                !parseBoolean(
                    getField(candidate.fields, 'OwnerIndexAdditionalList')
                )
            ) {
                break
            }
            if (!children.includes(candidate)) {
                children.push(candidate)
            }
        }

        return children
    }

    /**
     * Parses point-list fields.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @returns {{ x: number, y: number }[]}
     */
    static #points(fields) {
        const count = parseNumericField(fields, 'LocationCount') || 0
        const points = []

        for (let index = 1; index <= count; index += 1) {
            const x = parseNumericField(fields, 'X' + index)
            const y = parseNumericField(fields, 'Y' + index)
            if (x === null || y === null) {
                continue
            }
            points.push({ x, y })
        }

        return points
    }

    /**
     * Resolves side codes.
     * @param {number | null} value Side code.
     * @returns {'left' | 'right' | 'top' | 'bottom'}
     */
    static #side(value) {
        switch (value) {
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
     * Resolves text-style labels.
     * @param {string} value Raw text-style value.
     * @returns {string}
     */
    static #textStyle(value) {
        const normalized = String(value || '').toLowerCase()
        if (normalized === '1' || normalized === 'abbreviated') {
            return 'abbreviated'
        }
        if (normalized === '2' || normalized === 'short') {
            return 'short'
        }
        return 'full'
    }

    /**
     * Builds owner lookup keys for a connector record.
     * @param {object} record Connector record.
     * @returns {string[]}
     */
    static #ownerKeys(record) {
        const recordIndex = Number(record?.recordIndex)
        const indexInSheet = parseNumericField(record?.fields, 'IndexInSheet')
        const keys = new Set()

        if (Number.isInteger(recordIndex)) {
            keys.add(String(recordIndex))
            keys.add(String(recordIndex + 1))
        }
        if (Number.isInteger(indexInSheet)) {
            keys.add(String(indexInSheet))
            keys.add(String(indexInSheet + 1))
        }

        return [...keys]
    }

    /**
     * Builds a stable record id.
     * @param {object} record Source record.
     * @returns {string}
     */
    static #recordId(record) {
        const indexInSheet = parseNumericField(record?.fields, 'IndexInSheet')
        return 'record-' + String(indexInSheet ?? record?.recordIndex ?? 0)
    }

    /**
     * Builds a stable record key.
     * @param {object} record Source record.
     * @returns {string}
     */
    static #recordKey(record) {
        return 'schematic-record-' + String(record?.recordIndex ?? 0)
    }

    /**
     * Removes empty fields while preserving false and zero.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) {
                    return entryValue.length > 0
                }
                return (
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
                )
            })
        )
    }
}
