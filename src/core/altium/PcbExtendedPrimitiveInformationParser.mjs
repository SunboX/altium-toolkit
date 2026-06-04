// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbSidecarRecordParser } from './PcbSidecarRecordParser.mjs'

/**
 * Decodes extended primitive sidecar records such as mask-expansion overrides.
 */
export class PcbExtendedPrimitiveInformationParser {
    static #SOURCE_STREAM = 'ExtendedPrimitiveInformation/Data'

    static #OBJECT_ID_TO_COLLECTION = {
        1: ['arcs', 'arc'],
        2: ['pads', 'pad'],
        3: ['vias', 'via'],
        4: ['tracks', 'track'],
        5: ['texts', 'text'],
        6: ['fills', 'fill'],
        11: ['regions', 'region']
    }

    /**
     * Parses extended primitive information records.
     * @param {Uint8Array | ArrayBuffer | undefined} dataBytes
     * @param {string} [sourceStream]
     * @returns {{ entries: object[], byPrimitiveIndex: Record<string, object>, byPrimitiveKey: Record<string, object> }}
     */
    static parse(
        dataBytes,
        sourceStream = PcbExtendedPrimitiveInformationParser.#SOURCE_STREAM
    ) {
        const entries = PcbSidecarRecordParser.parseLengthPrefixedRecords(
            dataBytes,
            sourceStream
        )
            .map((record) =>
                PcbExtendedPrimitiveInformationParser.#normalizeRecord(record)
            )
            .filter(Boolean)

        return PcbExtendedPrimitiveInformationParser.#buildLookups(entries)
    }

    /**
     * Adds extended primitive information to matching decoded primitives.
     * @param {Record<string, object[]>} binaryPrimitives
     * @param {{ entries?: object[] }} extendedInformation
     */
    static attachToPrimitives(binaryPrimitives, extendedInformation) {
        if (!binaryPrimitives || !Array.isArray(extendedInformation?.entries)) {
            return
        }

        for (const entry of extendedInformation.entries) {
            const collectionName =
                PcbExtendedPrimitiveInformationParser.#collectionNameForEntry(
                    entry
                )
            const collection = binaryPrimitives[collectionName]

            if (!Array.isArray(collection)) {
                continue
            }

            const primitive = collection[entry.primitiveIndex]
            if (!primitive) {
                continue
            }

            primitive.extendedPrimitiveInformation =
                PcbExtendedPrimitiveInformationParser.#publicEntry(entry)
        }
    }

    /**
     * Normalizes one decoded sidecar record.
     * @param {{ fields: Record<string, string>, sourceStream: string, recordIndex: number }} record
     * @returns {object | null}
     */
    static #normalizeRecord(record) {
        const primitiveIndex = PcbSidecarRecordParser.parseInteger(
            PcbSidecarRecordParser.firstField(record.fields, [
                'PRIMITIVEINDEX',
                'INDEX'
            ])
        )

        if (primitiveIndex === null) {
            return null
        }

        const primitiveObjectId = PcbSidecarRecordParser.parseInteger(
            PcbSidecarRecordParser.firstField(record.fields, [
                'PRIMITIVEOBJECTID',
                'OBJECTID'
            ])
        )
        const objectInfo =
            PcbExtendedPrimitiveInformationParser.#OBJECT_ID_TO_COLLECTION[
                primitiveObjectId
            ] || []
        const type = PcbSidecarRecordParser.firstField(record.fields, ['TYPE'])
        const primitiveType =
            objectInfo[1] ||
            PcbExtendedPrimitiveInformationParser.#normalizePrimitiveType(type)

        return {
            primitiveIndex,
            primitiveObjectId,
            primitiveType,
            type,
            sourceStream: record.sourceStream,
            maskExpansion:
                PcbExtendedPrimitiveInformationParser.#parseMaskExpansion(
                    record.fields
                ),
            fields: record.fields
        }
    }

    /**
     * Parses paste and solder mask-expansion fields.
     * @param {Record<string, string>} fields
     * @returns {{ paste: object, solder: object }}
     */
    static #parseMaskExpansion(fields) {
        const pasteMode = PcbSidecarRecordParser.parseInteger(
            PcbSidecarRecordParser.firstField(fields, [
                'PASTEMASKEXPANSIONMODE',
                'PASTEMASKEXPANSION_MODE'
            ])
        )
        const solderMode = PcbSidecarRecordParser.parseInteger(
            PcbSidecarRecordParser.firstField(fields, [
                'SOLDERMASKEXPANSIONMODE',
                'SOLDERMASKEXPANSION_MODE'
            ])
        )

        return {
            paste: {
                mode: pasteMode,
                source: PcbExtendedPrimitiveInformationParser.#maskExpansionSource(
                    pasteMode
                ),
                manualExpansion: PcbSidecarRecordParser.parseNumber(
                    PcbSidecarRecordParser.firstField(fields, [
                        'PASTEMASKEXPANSION_MANUAL',
                        'PASTEMASKEXPANSIONMANUAL'
                    ])
                )
            },
            solder: {
                mode: solderMode,
                source: PcbExtendedPrimitiveInformationParser.#maskExpansionSource(
                    solderMode
                ),
                manualExpansion: PcbSidecarRecordParser.parseNumber(
                    PcbSidecarRecordParser.firstField(fields, [
                        'SOLDERMASKEXPANSION_MANUAL',
                        'SOLDERMASKEXPANSIONMANUAL'
                    ])
                )
            }
        }
    }

    /**
     * Builds primitive-index lookups.
     * @param {object[]} entries
     * @returns {{ entries: object[], byPrimitiveIndex: Record<string, object>, byPrimitiveKey: Record<string, object> }}
     */
    static #buildLookups(entries) {
        const byPrimitiveIndex = {}
        const byPrimitiveKey = {}

        for (const entry of entries) {
            byPrimitiveIndex[String(entry.primitiveIndex)] = entry
            if (Number.isInteger(entry.primitiveObjectId)) {
                byPrimitiveKey[
                    entry.primitiveObjectId + ':' + entry.primitiveIndex
                ] = entry
            }
        }

        return {
            entries,
            byPrimitiveIndex,
            byPrimitiveKey
        }
    }

    /**
     * Resolves one binary primitive collection for a sidecar entry.
     * @param {object} entry
     * @returns {string}
     */
    static #collectionNameForEntry(entry) {
        const objectInfo =
            PcbExtendedPrimitiveInformationParser.#OBJECT_ID_TO_COLLECTION[
                entry.primitiveObjectId
            ]
        if (objectInfo) {
            return objectInfo[0]
        }

        const primitiveType = String(entry.primitiveType || '').toLowerCase()
        return primitiveType ? primitiveType + 's' : ''
    }

    /**
     * Builds the public primitive-attached entry.
     * @param {object} entry
     * @returns {object}
     */
    static #publicEntry(entry) {
        return {
            primitiveIndex: entry.primitiveIndex,
            primitiveObjectId: entry.primitiveObjectId,
            primitiveType: entry.primitiveType,
            type: entry.type,
            sourceStream: entry.sourceStream,
            maskExpansion: entry.maskExpansion
        }
    }

    /**
     * Maps one mask-expansion mode to the existing source vocabulary.
     * @param {number | null} mode
     * @returns {string}
     */
    static #maskExpansionSource(mode) {
        if (mode === 1) return 'rule'
        if (mode === 2) return 'manual'
        if (mode === 0) return 'default'
        if (mode === null) return 'unknown'

        return 'unknown-' + mode
    }

    /**
     * Normalizes one textual primitive type hint.
     * @param {string} value
     * @returns {string}
     */
    static #normalizePrimitiveType(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^e/iu, '')
            .replace(/object$/iu, '')

        return normalized
    }
}
