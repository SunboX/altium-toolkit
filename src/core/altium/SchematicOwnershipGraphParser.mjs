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
     * @returns {{ schema: string, records: object[], hierarchy: object[], recordsByRecordIndex: Record<string, object>, recordsByIndexInSheet: Record<string, object>, childrenByParentKey: Record<string, object[]>, parentsByChildKey: Record<string, object> }}
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
            hierarchy: SchematicOwnershipGraphParser.#hierarchy(
                entries,
                parentsByChildKey
            ),
            recordsByRecordIndex:
                SchematicOwnershipGraphParser.#recordsByRecordIndex(entries),
            recordsByIndexInSheet:
                SchematicOwnershipGraphParser.#recordsByIndexInSheet(entries),
            childrenByParentKey,
            parentsByChildKey
        }
    }

    /**
     * Builds a nested public hierarchy from resolved parent links.
     * @param {object[]} entries Record sidecar rows.
     * @param {Record<string, { parentKey: string }>} parentsByChildKey Resolved parent links.
     * @returns {object[]}
     */
    static #hierarchy(entries, parentsByChildKey) {
        const entriesByKey = new Map(entries.map((entry) => [entry.key, entry]))
        const childrenByParentKey = new Map()
        const childKeys = new Set()

        for (const [childKey, parentLink] of Object.entries(
            parentsByChildKey
        )) {
            const child = entriesByKey.get(childKey)
            const parent = entriesByKey.get(parentLink.parentKey)

            if (!child || !parent) {
                continue
            }

            childKeys.add(childKey)
            if (!childrenByParentKey.has(parent.key)) {
                childrenByParentKey.set(parent.key, [])
            }

            childrenByParentKey.get(parent.key).push(child)
        }

        return entries
            .filter((entry) => !childKeys.has(entry.key))
            .map((entry) =>
                SchematicOwnershipGraphParser.#hierarchyNode(
                    entry,
                    childrenByParentKey
                )
            )
    }

    /**
     * Builds one nested hierarchy node.
     * @param {object} entry Record sidecar row.
     * @param {Map<string, object[]>} childrenByParentKey Child rows by parent key.
     * @returns {object}
     */
    static #hierarchyNode(entry, childrenByParentKey) {
        return {
            ...SchematicOwnershipGraphParser.#publicRecord(entry),
            children: (childrenByParentKey.get(entry.key) || []).map((child) =>
                SchematicOwnershipGraphParser.#hierarchyNode(
                    child,
                    childrenByParentKey
                )
            )
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
            text: getField(record?.fields, 'Text'),
            fields: SchematicOwnershipGraphParser.#publicFields(record?.fields)
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
            text: entry.text,
            fields: entry.fields
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
     * Indexes records by parser record index.
     * @param {object[]} entries Record sidecar rows.
     * @returns {Record<string, object>}
     */
    static #recordsByRecordIndex(entries) {
        const index = {}

        for (const entry of entries) {
            index[String(entry.recordIndex)] =
                SchematicOwnershipGraphParser.#publicRecord(entry)
        }

        return index
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
     * Copies source fields into a stable plain object for read-only consumers.
     * @param {Record<string, string | string[]> | undefined} fields Source fields.
     * @returns {Record<string, string | string[]>}
     */
    static #publicFields(fields) {
        if (!fields || typeof fields !== 'object') {
            return {}
        }

        return Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
                key,
                Array.isArray(value) ? [...value] : value
            ])
        )
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
