// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getDisplayText, getField, parseBoolean, parseNumericField } =
    ParserUtils

/**
 * Builds a read-only sidecar for schematic template metadata.
 */
export class SchematicTemplateParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.template.a1'

    /**
     * Parses template identity and owned schematic records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Schematic records.
     * @param {{ fields?: Record<string, string | string[]> } | undefined} sheetRecord Sheet record.
     * @param {{ fonts?: object, titleBlock?: object }} sheet Normalized sheet.
     * @returns {object | null}
     */
    static parse(records, sheetRecord, sheet) {
        const templateRecord =
            (records || []).find(
                (record) => getField(record.fields, 'RECORD') === '39'
            ) || null
        const identity = SchematicTemplateParser.#identity(
            sheetRecord?.fields,
            templateRecord
        )
        const ownedRecords = templateRecord
            ? SchematicTemplateParser.#ownedRecords(records, templateRecord)
            : []

        if (
            !identity.fileName &&
            !identity.recordId &&
            ownedRecords.length === 0
        ) {
            return null
        }

        return {
            schema: SchematicTemplateParser.SCHEMA_ID,
            identity,
            ownedRecordKeys: ownedRecords.map((record) =>
                SchematicTemplateParser.#recordKey(record)
            ),
            ownedGraphics: SchematicTemplateParser.#ownedGraphics(ownedRecords),
            fonts: sheet?.fonts || {},
            missingParameters:
                SchematicTemplateParser.#missingParameters(records),
            titleBlock: sheet?.titleBlock || {}
        }
    }

    /**
     * Builds template identity fields from sheet and template records.
     * @param {Record<string, string | string[]> | undefined} fields Sheet fields.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number } | null} templateRecord Template record.
     * @returns {object}
     */
    static #identity(fields, templateRecord) {
        return SchematicTemplateParser.#stripEmpty({
            showGraphics: parseBoolean(fields?.ShowTemplateGraphics),
            fileName: getField(fields, 'TemplateFileName'),
            vaultGuid: getField(fields, 'TemplateVaultGUID'),
            itemGuid: getField(fields, 'TemplateItemGUID'),
            revisionGuid: getField(fields, 'TemplateRevisionGUID'),
            vaultHrid: getField(fields, 'TemplateVaultHRID'),
            revisionHrid: getField(fields, 'TemplateRevisionHRID'),
            recordId: templateRecord
                ? SchematicTemplateParser.#semanticRecordId(templateRecord)
                : '',
            name: getField(templateRecord?.fields, 'Name'),
            uniqueId:
                getField(templateRecord?.fields, 'UniqueID') ||
                getField(templateRecord?.fields, 'UniqueId')
        })
    }

    /**
     * Returns records owned by the template record.
     * @param {object[]} records Schematic records.
     * @param {object} templateRecord Template owner record.
     * @returns {object[]}
     */
    static #ownedRecords(records, templateRecord) {
        const ownerKeys = new Set(
            SchematicTemplateParser.#ownerKeys(templateRecord)
        )

        return (records || []).filter(
            (record) =>
                record !== templateRecord &&
                ownerKeys.has(getField(record.fields, 'OwnerIndex'))
        )
    }

    /**
     * Builds grouped owned record keys by primitive family.
     * @param {object[]} ownedRecords Template-owned records.
     * @returns {object}
     */
    static #ownedGraphics(ownedRecords) {
        const groups = {
            lines: [],
            polygons: [],
            rectangles: [],
            ellipses: [],
            arcs: [],
            texts: [],
            images: []
        }

        for (const record of ownedRecords) {
            const key = SchematicTemplateParser.#recordKey(record)
            switch (getField(record.fields, 'RECORD')) {
                case '4':
                case '28':
                case '41':
                    groups.texts.push(key)
                    break
                case '7':
                    groups.polygons.push(key)
                    break
                case '8':
                    groups.ellipses.push(key)
                    break
                case '11':
                case '12':
                    groups.arcs.push(key)
                    break
                case '14':
                case '225':
                    groups.rectangles.push(key)
                    break
                case '30':
                    groups.images.push(key)
                    break
                default:
                    groups.lines.push(key)
                    break
            }
        }

        return groups
    }

    /**
     * Collects unresolved equals-prefixed placeholders.
     * @param {object[]} records Schematic records.
     * @returns {string[]}
     */
    static #missingParameters(records) {
        const metadata = SchematicTemplateParser.#metadata(records)
        const missing = []

        for (const record of records || []) {
            const text = getDisplayText(record.fields).trim()
            const match = text.match(/^=([A-Za-z0-9_.-]+)$/u)
            if (!match) {
                continue
            }
            const parameterName = match[1]
            if (!metadata.has(parameterName.toLowerCase())) {
                missing.push(parameterName)
            }
        }

        return [...new Set(missing)].sort((left, right) =>
            left.localeCompare(right)
        )
    }

    /**
     * Builds a lowercase metadata-name set.
     * @param {object[]} records Schematic records.
     * @returns {Set<string>}
     */
    static #metadata(records) {
        const metadata = new Set()

        for (const record of records || []) {
            const name = getField(record.fields, 'Name').trim()
            const value = getDisplayText(record.fields).trim()
            if (name && value && value !== '*') {
                metadata.add(name.toLowerCase())
            }
        }

        return metadata
    }

    /**
     * Builds owner lookup keys for one record.
     * @param {object} record Schematic record.
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
     * Builds the public semantic record id.
     * @param {object} record Schematic record.
     * @returns {string}
     */
    static #semanticRecordId(record) {
        const indexInSheet = parseNumericField(record?.fields, 'IndexInSheet')
        return 'record-' + String(indexInSheet ?? record?.recordIndex ?? 0)
    }

    /**
     * Builds a stable internal record key.
     * @param {object} record Schematic record.
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
