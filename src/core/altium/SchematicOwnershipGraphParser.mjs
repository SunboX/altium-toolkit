// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField } = ParserUtils

/**
 * Builds a read-only ownership graph from schematic record owner indexes.
 */
export class SchematicOwnershipGraphParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.ownership.a1'

    /**
     * Parses record parent/child links from raw schematic records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Schematic records.
     * @returns {{ schema: string, records: object[], recordsByIndexInSheet: Record<string, object>, childrenByParentKey: Record<string, object[]>, parentsByChildKey: Record<string, object> }}
     */
    static parse(records) {
        const entries = (records || []).map((record, fallbackIndex) =>
            SchematicOwnershipGraphParser.#recordEntry(record, fallbackIndex)
        )
        const ownerLookup =
            SchematicOwnershipGraphParser.#buildOwnerLookup(entries)
        const childrenByParentKey = {}
        const parentsByChildKey = {}

        for (const entry of entries) {
            if (!entry.ownerIndex) {
                continue
            }

            const parent = ownerLookup.get(entry.ownerIndex)
            if (!parent || parent.key === entry.key) {
                continue
            }

            if (!childrenByParentKey[parent.key]) {
                childrenByParentKey[parent.key] = []
            }

            childrenByParentKey[parent.key].push(
                SchematicOwnershipGraphParser.#childDescriptor(entry)
            )
            parentsByChildKey[entry.key] = {
                parentKey: parent.key,
                ownerIndex: entry.ownerIndex
            }
        }

        return {
            schema: SchematicOwnershipGraphParser.SCHEMA_ID,
            records: entries.map((entry) =>
                SchematicOwnershipGraphParser.#publicRecord(entry)
            ),
            recordsByIndexInSheet:
                SchematicOwnershipGraphParser.#recordsByIndexInSheet(entries),
            childrenByParentKey,
            parentsByChildKey
        }
    }

    /**
     * Normalizes one raw schematic record into a sidecar row.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} record Source record.
     * @param {number} fallbackIndex Fallback record index.
     * @returns {object}
     */
    static #recordEntry(record, fallbackIndex) {
        const recordIndex = Number.isInteger(record?.recordIndex)
            ? record.recordIndex
            : fallbackIndex
        const indexInSheet = parseNumericField(record?.fields, 'IndexInSheet')

        return {
            key: 'schematic-record-' + recordIndex,
            recordIndex,
            recordType: getField(record?.fields, 'RECORD'),
            indexInSheet,
            ownerIndex: getField(record?.fields, 'OwnerIndex'),
            uniqueId:
                getField(record?.fields, 'UniqueID') ||
                getField(record?.fields, 'UniqueId'),
            name: getField(record?.fields, 'Name'),
            text: getField(record?.fields, 'Text')
        }
    }

    /**
     * Builds tolerant owner-index lookup keys for record parents.
     * @param {object[]} entries Record sidecar rows.
     * @returns {Map<string, object>}
     */
    static #buildOwnerLookup(entries) {
        const lookup = new Map()

        for (const entry of entries) {
            for (const key of SchematicOwnershipGraphParser.#ownerKeys(entry)) {
                if (!lookup.has(key)) {
                    lookup.set(key, entry)
                }
            }
        }

        return lookup
    }

    /**
     * Returns candidate owner-index keys for one record.
     * @param {object} entry Record sidecar row.
     * @returns {string[]}
     */
    static #ownerKeys(entry) {
        const keys = new Set([
            String(entry.recordIndex),
            String(entry.recordIndex + 1)
        ])

        if (Number.isInteger(entry.indexInSheet)) {
            keys.add(String(entry.indexInSheet))
            keys.add(String(entry.indexInSheet + 1))
        }

        return [...keys]
    }

    /**
     * Builds a compact public record row.
     * @param {object} entry Internal record row.
     * @returns {object}
     */
    static #publicRecord(entry) {
        return SchematicOwnershipGraphParser.#stripEmpty({
            key: entry.key,
            recordIndex: entry.recordIndex,
            recordType: entry.recordType,
            indexInSheet: entry.indexInSheet,
            ownerIndex: entry.ownerIndex,
            uniqueId: entry.uniqueId,
            name: entry.name,
            text: entry.text
        })
    }

    /**
     * Builds a compact child descriptor for grouped owner lists.
     * @param {object} entry Internal record row.
     * @returns {object}
     */
    static #childDescriptor(entry) {
        return SchematicOwnershipGraphParser.#stripEmpty({
            key: entry.key,
            recordIndex: entry.recordIndex,
            recordType: entry.recordType,
            ownerIndex: entry.ownerIndex,
            indexInSheet: entry.indexInSheet,
            name: entry.name
        })
    }

    /**
     * Indexes records by native IndexInSheet values.
     * @param {object[]} entries Record sidecar rows.
     * @returns {Record<string, object>}
     */
    static #recordsByIndexInSheet(entries) {
        const index = {}

        for (const entry of entries) {
            if (Number.isInteger(entry.indexInSheet)) {
                index[String(entry.indexInSheet)] =
                    SchematicOwnershipGraphParser.#publicRecord(entry)
            }
        }

        return index
    }

    /**
     * Drops empty object fields while preserving numeric zero.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) =>
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
            )
        )
    }
}
