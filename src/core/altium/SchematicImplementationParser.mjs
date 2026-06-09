// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getDisplayText, parseBoolean, parseNumericField } = ParserUtils

/**
 * Parses schematic implementation/model-link records into a read-only model.
 */
export class SchematicImplementationParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.implementations.a1'

    /**
     * Parses implementation lists, model links, map definers, and parameters.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Schematic records.
     * @returns {object | null}
     */
    static parse(records) {
        const components = SchematicImplementationParser.#componentRows(records)
        const listsByIndex =
            SchematicImplementationParser.#implementationLists(records)
        const childrenByOwner =
            SchematicImplementationParser.#implementationChildrenByOwner(
                records
            )
        const implementations = (records || [])
            .filter(
                (record) =>
                    SchematicImplementationParser.#field(
                        record.fields,
                        'RECORD'
                    ) === '45'
            )
            .map((record) =>
                SchematicImplementationParser.#implementation(
                    record,
                    components,
                    listsByIndex,
                    childrenByOwner
                )
            )
            .filter(Boolean)

        if (!implementations.length) {
            return null
        }

        return {
            schema: SchematicImplementationParser.SCHEMA_ID,
            components: SchematicImplementationParser.#componentLinks(
                components,
                implementations
            ),
            implementations
        }
    }

    /**
     * Builds normalized schematic component rows for implementation linking.
     * @param {object[]} records Schematic records.
     * @returns {object[]}
     */
    static #componentRows(records) {
        return (records || [])
            .filter(
                (record) =>
                    SchematicImplementationParser.#field(
                        record.fields,
                        'RECORD'
                    ) === '1'
            )
            .map((record) => {
                const indexInSheet = parseNumericField(
                    record.fields,
                    'IndexInSheet'
                )
                return {
                    indexInSheet,
                    componentKey:
                        'schematic-component-' +
                        String(indexInSheet ?? record.recordIndex ?? 0),
                    recordKey: SchematicImplementationParser.#recordKey(record),
                    uniqueId: SchematicImplementationParser.#field(
                        record.fields,
                        'UniqueID'
                    ),
                    libReference:
                        SchematicImplementationParser.#field(
                            record.fields,
                            'LibReference'
                        ) ||
                        SchematicImplementationParser.#field(
                            record.fields,
                            'DesignItemId'
                        )
                }
            })
    }

    /**
     * Builds implementation-list rows keyed by native sheet indexes.
     * @param {object[]} records Schematic records.
     * @returns {Map<string, object>}
     */
    static #implementationLists(records) {
        const lists = new Map()

        for (const record of records || []) {
            if (
                SchematicImplementationParser.#field(
                    record.fields,
                    'RECORD'
                ) !== '44'
            ) {
                continue
            }

            const indexInSheet = parseNumericField(
                record.fields,
                'IndexInSheet'
            )
            if (indexInSheet === null) {
                continue
            }

            lists.set(String(indexInSheet), {
                key: 'schematic-implementation-list-' + indexInSheet,
                recordKey: SchematicImplementationParser.#recordKey(record),
                ownerIndex: SchematicImplementationParser.#field(
                    record.fields,
                    'OwnerIndex'
                )
            })
        }

        return lists
    }

    /**
     * Parses one implementation record.
     * @param {object} record Implementation record.
     * @param {object[]} components Component rows.
     * @param {Map<string, object>} listsByIndex Implementation lists.
     * @param {Map<string, { recordType: string, record: object }[]>} childrenByOwner Implementation child rows by owner index.
     * @returns {object | null}
     */
    static #implementation(record, components, listsByIndex, childrenByOwner) {
        const indexInSheet =
            parseNumericField(record.fields, 'IndexInSheet') ??
            record.recordIndex ??
            0
        const ownerIndex = SchematicImplementationParser.#field(
            record.fields,
            'OwnerIndex'
        )
        const ownerList = listsByIndex.get(ownerIndex) || null
        const ownerComponent = SchematicImplementationParser.#componentForOwner(
            ownerIndex,
            ownerList,
            components
        )

        return SchematicImplementationParser.#stripEmpty({
            key: 'schematic-implementation-' + String(indexInSheet),
            recordKey: SchematicImplementationParser.#recordKey(record),
            ownerComponentKey: ownerComponent?.componentKey || '',
            ownerListKey: ownerList?.key || '',
            modelName: SchematicImplementationParser.#field(
                record.fields,
                'ModelName'
            ),
            modelType: SchematicImplementationParser.#normalizeToken(
                SchematicImplementationParser.#field(record.fields, 'ModelType')
            ),
            description: SchematicImplementationParser.#field(
                record.fields,
                'Description'
            ),
            isCurrent: parseBoolean(
                SchematicImplementationParser.#field(record.fields, 'IsCurrent')
            ),
            targetLibraries: SchematicImplementationParser.#targetLibraries(
                record.fields
            ),
            searchPaths: SchematicImplementationParser.#searchPaths(
                record.fields
            ),
            mapDefiners: SchematicImplementationParser.#mapDefiners(
                childrenByOwner,
                indexInSheet
            ),
            parameters: SchematicImplementationParser.#parameters(
                childrenByOwner,
                indexInSheet
            )
        })
    }

    /**
     * Resolves the owning component for an implementation record.
     * @param {string} ownerIndex Implementation owner index.
     * @param {object | null} ownerList Implementation-list row.
     * @param {object[]} components Component rows.
     * @returns {object | null}
     */
    static #componentForOwner(ownerIndex, ownerList, components) {
        const direct = (components || []).find(
            (component) => String(component.indexInSheet) === ownerIndex
        )
        if (direct) {
            return direct
        }

        return (
            (components || []).find(
                (component) =>
                    ownerList &&
                    String(component.indexInSheet) === ownerList.ownerIndex
            ) || null
        )
    }

    /**
     * Builds component-level implementation-key rows.
     * @param {object[]} components Component rows.
     * @param {object[]} implementations Implementation rows.
     * @returns {object[]}
     */
    static #componentLinks(components, implementations) {
        return (components || [])
            .map((component) =>
                SchematicImplementationParser.#stripEmpty({
                    componentKey: component.componentKey,
                    recordKey: component.recordKey,
                    uniqueId: component.uniqueId,
                    libReference: component.libReference,
                    implementationKeys: implementations
                        .filter(
                            (implementation) =>
                                implementation.ownerComponentKey ===
                                component.componentKey
                        )
                        .map((implementation) => implementation.key)
                })
            )
            .filter((component) => component.implementationKeys?.length)
    }

    /**
     * Parses indexed target-library fields from one implementation.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @returns {object[]}
     */
    static #targetLibraries(fields) {
        const count =
            parseNumericField(fields, 'DatafileCount') ??
            SchematicImplementationParser.#countIndexedFields(
                fields,
                'ModelDatafileEntity'
            )
        const libraries = []

        for (let index = 0; index < count; index += 1) {
            const entity = SchematicImplementationParser.#field(
                fields,
                'ModelDatafileEntity' + index
            )
            const kind = SchematicImplementationParser.#normalizeToken(
                SchematicImplementationParser.#field(
                    fields,
                    'ModelDatafileKind' + index
                )
            )

            if (!entity && !kind) {
                continue
            }

            libraries.push(
                SchematicImplementationParser.#stripEmpty({
                    index,
                    entity,
                    kind,
                    fileName: SchematicImplementationParser.#libraryFileName(
                        entity,
                        kind
                    )
                })
            )
        }

        return libraries
    }

    /**
     * Parses indexed search-path fields.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @returns {string[]}
     */
    static #searchPaths(fields) {
        const count =
            parseNumericField(fields, 'SearchPathCount') ??
            SchematicImplementationParser.#countIndexedFields(
                fields,
                'SearchPath'
            )
        const paths = []

        for (let index = 0; index < count; index += 1) {
            const value = SchematicImplementationParser.#field(
                fields,
                'SearchPath' + index
            )
            if (value) {
                paths.push(value)
            }
        }

        for (const key of ['SearchPath', 'LibraryPath', 'Path']) {
            const value = SchematicImplementationParser.#field(fields, key)
            if (value && !paths.includes(value)) {
                paths.push(value)
            }
        }

        return paths
    }

    /**
     * Parses map-definer child records for one implementation.
     * @param {Map<string, { recordType: string, record: object }[]>} childrenByOwner Implementation child rows by owner index.
     * @param {number} implementationIndex Implementation index.
     * @returns {object[]}
     */
    static #mapDefiners(childrenByOwner, implementationIndex) {
        return SchematicImplementationParser.#ownedImplementationChildren(
            childrenByOwner,
            implementationIndex
        )
            .filter((row) => row.recordType === '47')
            .map((row) => row.record)
            .map((record) =>
                SchematicImplementationParser.#stripEmpty({
                    recordKey: SchematicImplementationParser.#recordKey(record),
                    designatorInterface: SchematicImplementationParser.#field(
                        record.fields,
                        'DesIntf'
                    ),
                    implementationDesignators:
                        SchematicImplementationParser.#implementationDesignators(
                            record.fields
                        )
                })
            )
    }

    /**
     * Parses implementation parameter child records.
     * @param {Map<string, { recordType: string, record: object }[]>} childrenByOwner Implementation child rows by owner index.
     * @param {number} implementationIndex Implementation index.
     * @returns {object[]}
     */
    static #parameters(childrenByOwner, implementationIndex) {
        return SchematicImplementationParser.#ownedImplementationChildren(
            childrenByOwner,
            implementationIndex
        )
            .filter((row) => row.recordType === '48' || row.recordType === '41')
            .map((row) => row.record)
            .map((record) =>
                SchematicImplementationParser.#stripEmpty({
                    recordKey: SchematicImplementationParser.#recordKey(record),
                    name: SchematicImplementationParser.#field(
                        record.fields,
                        'Name'
                    ),
                    value:
                        getDisplayText(record.fields) ||
                        SchematicImplementationParser.#field(
                            record.fields,
                            'Value'
                        )
                })
            )
    }

    /**
     * Indexes implementation child rows by owner index once per parse.
     * @param {object[]} records Schematic records.
     * @returns {Map<string, { recordType: string, record: object }[]>}
     */
    static #implementationChildrenByOwner(records) {
        const rowsByOwner = new Map()

        for (const record of records || []) {
            const recordType = SchematicImplementationParser.#field(
                record.fields,
                'RECORD'
            )
            if (
                recordType !== '47' &&
                recordType !== '48' &&
                recordType !== '41'
            ) {
                continue
            }

            const ownerIndex = SchematicImplementationParser.#field(
                record.fields,
                'OwnerIndex'
            )
            if (!ownerIndex) {
                continue
            }

            if (!rowsByOwner.has(ownerIndex)) {
                rowsByOwner.set(ownerIndex, [])
            }

            rowsByOwner.get(ownerIndex).push({ recordType, record })
        }

        return rowsByOwner
    }

    /**
     * Returns pre-indexed child rows for one implementation.
     * @param {Map<string, { recordType: string, record: object }[]>} childrenByOwner Implementation child rows by owner index.
     * @param {number} implementationIndex Implementation index.
     * @returns {{ recordType: string, record: object }[]}
     */
    static #ownedImplementationChildren(childrenByOwner, implementationIndex) {
        return childrenByOwner.get(String(implementationIndex)) || []
    }

    /**
     * Parses indexed implementation designator fields from a map definer.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @returns {string[]}
     */
    static #implementationDesignators(fields) {
        const count =
            parseNumericField(fields, 'DesImpCount') ??
            SchematicImplementationParser.#countIndexedFields(fields, 'DesImp')
        const designators = []

        for (let index = 0; index < count; index += 1) {
            const value = SchematicImplementationParser.#field(
                fields,
                'DesImp' + index
            )
            if (value) {
                designators.push(value)
            }
        }

        return designators
    }

    /**
     * Counts fields with an indexed prefix.
     * @param {Record<string, string | string[]>} fields Record fields.
     * @param {string} prefix Prefix before numeric index.
     * @returns {number}
     */
    static #countIndexedFields(fields, prefix) {
        const normalizedPrefix = prefix.toLowerCase()

        return Object.keys(fields || {}).filter((key) =>
            key.toLowerCase().startsWith(normalizedPrefix)
        ).length
    }

    /**
     * Builds an inferred file name from library entity and kind.
     * @param {string} entity Library entity.
     * @param {string} kind Library kind.
     * @returns {string}
     */
    static #libraryFileName(entity, kind) {
        if (!entity) {
            return ''
        }

        if (/\.[^.]+$/.test(entity)) {
            return entity
        }

        const extension =
            {
                pcblib: 'PcbLib',
                schlib: 'SchLib',
                intlib: 'IntLib',
                sim: 'SimModel'
            }[kind] || kind

        return extension ? entity + '.' + extension : entity
    }

    /**
     * Returns a lower-case token.
     * @param {string} value Raw token.
     * @returns {string}
     */
    static #normalizeToken(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
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
     * Reads one field case-insensitively.
     * @param {Record<string, string | string[]> | undefined} fields Record fields.
     * @param {string} key Requested key.
     * @returns {string}
     */
    static #field(fields, key) {
        const direct = ParserUtils.getField(fields, key)
        if (direct) {
            return direct
        }

        const normalizedKey = String(key || '').toLowerCase()
        const matchedKey = Object.keys(fields || {}).find(
            (fieldKey) => fieldKey.toLowerCase() === normalizedKey
        )

        return matchedKey ? ParserUtils.getField(fields, matchedKey) : ''
    }

    /**
     * Drops empty optional fields while keeping explicit booleans and arrays.
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
