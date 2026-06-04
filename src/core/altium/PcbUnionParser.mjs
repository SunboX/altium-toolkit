// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbSidecarRecordParser } from './PcbSidecarRecordParser.mjs'

/**
 * Decodes PCB user-union and smart-union sidecar streams.
 */
export class PcbUnionParser {
    static #OBJECT_ID_TO_COLLECTION = {
        1: 'arcs',
        2: 'pads',
        3: 'vias',
        4: 'tracks',
        5: 'texts',
        6: 'fills',
        11: 'regions'
    }

    /**
     * Extracts user and smart union records from a stream map.
     * @param {Map<string, Uint8Array>} streams
     * @returns {{ userUnions: object[], smartUnions: object[], byIndex: Record<string, object>, smartByIndex: Record<string, object>, membersByPrimitiveKey: Record<string, object[]> }}
     */
    static extractFromStreams(streams) {
        const userUnions = PcbUnionParser.#parseUserUnions(
            streams.get('UnionNames/Data')
        )
        const smartUnions = PcbUnionParser.#parseSmartUnions(
            streams.get('SmartUnions/Data')
        )

        return PcbUnionParser.#buildLookups(userUnions, smartUnions)
    }

    /**
     * Adds smart-union memberships to decoded primitives in place.
     * @param {Record<string, object[]>} binaryPrimitives
     * @param {{ smartUnions?: object[] }} unions
     */
    static attachToPrimitives(binaryPrimitives, unions) {
        if (!binaryPrimitives || !Array.isArray(unions?.smartUnions)) {
            return
        }

        for (const smartUnion of unions.smartUnions) {
            for (const member of smartUnion.members || []) {
                const collectionName =
                    PcbUnionParser.#OBJECT_ID_TO_COLLECTION[
                        member.primitiveObjectId
                    ]
                const collection = binaryPrimitives[collectionName]
                const primitive = Array.isArray(collection)
                    ? collection[member.primitiveIndex]
                    : null

                if (!primitive) {
                    continue
                }

                primitive.unionMemberships = primitive.unionMemberships || []
                primitive.unionMemberships.push(
                    PcbUnionParser.#publicMembership(smartUnion)
                )
            }
        }
    }

    /**
     * Parses UnionNames/Data entries.
     * @param {Uint8Array | undefined} bytes
     * @returns {object[]}
     */
    static #parseUserUnions(bytes) {
        return PcbSidecarRecordParser.parseLengthPrefixedRecords(
            bytes,
            'UnionNames/Data'
        )
            .map((record) => PcbUnionParser.#normalizeUserUnion(record))
            .filter(Boolean)
    }

    /**
     * Parses SmartUnions/Data entries.
     * @param {Uint8Array | undefined} bytes
     * @returns {object[]}
     */
    static #parseSmartUnions(bytes) {
        return PcbSidecarRecordParser.parseLengthPrefixedRecords(
            bytes,
            'SmartUnions/Data'
        )
            .map((record) => PcbUnionParser.#normalizeSmartUnion(record))
            .filter(Boolean)
    }

    /**
     * Normalizes one user-union record.
     * @param {{ fields: Record<string, string>, sourceStream: string, recordIndex: number }} record
     * @returns {object}
     */
    static #normalizeUserUnion(record) {
        const index =
            PcbSidecarRecordParser.parseInteger(
                PcbSidecarRecordParser.firstField(record.fields, [
                    'UNIONINDEX',
                    'INDEX'
                ])
            ) ?? record.recordIndex

        return {
            index,
            name: PcbSidecarRecordParser.firstField(record.fields, ['NAME']),
            sourceStream: record.sourceStream,
            fields: record.fields
        }
    }

    /**
     * Normalizes one smart-union record.
     * @param {{ fields: Record<string, string>, sourceStream: string, recordIndex: number }} record
     * @returns {object}
     */
    static #normalizeSmartUnion(record) {
        const index =
            PcbSidecarRecordParser.parseInteger(
                PcbSidecarRecordParser.firstField(record.fields, [
                    'UNIONINDEX',
                    'SMARTUNIONINDEX',
                    'INDEX'
                ])
            ) ?? record.recordIndex
        const type = PcbUnionParser.#parseType(record.fields)

        return {
            index,
            name: PcbSidecarRecordParser.firstField(record.fields, ['NAME']),
            type,
            typeName: PcbUnionParser.#smartUnionTypeName(type),
            sourceStream: record.sourceStream,
            members: PcbUnionParser.#parseMembers(record.fields),
            fields: record.fields
        }
    }

    /**
     * Parses a smart-union type value.
     * @param {Record<string, string>} fields
     * @returns {number | string}
     */
    static #parseType(fields) {
        const value = PcbSidecarRecordParser.firstField(fields, [
            'UNIONTYPE',
            'TYPE',
            'SMARTUNIONTYPE'
        ])
        const parsed = PcbSidecarRecordParser.parseInteger(value)

        return parsed === null ? value : parsed
    }

    /**
     * Parses member primitive references from numbered sidecar fields.
     * @param {Record<string, string>} fields
     * @returns {{ primitiveObjectId: number, primitiveIndex: number }[]}
     */
    static #parseMembers(fields) {
        const members = []
        const memberNumbers = new Set()

        for (const key of Object.keys(fields)) {
            const match = key.match(/^PRIMITIVEOBJECTID(\d+)$/u)
            if (match) {
                memberNumbers.add(match[1])
            }
        }

        for (const memberNumber of [...memberNumbers].sort(
            (left, right) => Number(left) - Number(right)
        )) {
            const primitiveObjectId = PcbSidecarRecordParser.parseInteger(
                fields['PRIMITIVEOBJECTID' + memberNumber]
            )
            const primitiveIndex = PcbSidecarRecordParser.parseInteger(
                fields['PRIMITIVEINDEX' + memberNumber]
            )

            if (
                Number.isInteger(primitiveObjectId) &&
                Number.isInteger(primitiveIndex)
            ) {
                members.push({ primitiveObjectId, primitiveIndex })
            }
        }

        if (!members.length) {
            members.push(...PcbUnionParser.#parseFlatMembers(fields))
        }

        return members
    }

    /**
     * Parses flat primitive member fields used by compact fake fixtures.
     * @param {Record<string, string>} fields
     * @returns {{ primitiveObjectId: number, primitiveIndex: number }[]}
     */
    static #parseFlatMembers(fields) {
        const primitiveObjectId = PcbSidecarRecordParser.parseInteger(
            PcbSidecarRecordParser.firstField(fields, [
                'PRIMITIVEOBJECTID',
                'OBJECTID'
            ])
        )
        const primitiveIndexes = String(
            PcbSidecarRecordParser.firstField(fields, [
                'PRIMITIVEINDEXES',
                'PRIMITIVEINDEX'
            ])
        )
            .split(/[;,\s]+/u)
            .map((value) => PcbSidecarRecordParser.parseInteger(value))
            .filter(Number.isInteger)

        if (!Number.isInteger(primitiveObjectId)) {
            return []
        }

        return primitiveIndexes.map((primitiveIndex) => ({
            primitiveObjectId,
            primitiveIndex
        }))
    }

    /**
     * Builds union lookups.
     * @param {object[]} userUnions
     * @param {object[]} smartUnions
     * @returns {{ userUnions: object[], smartUnions: object[], byIndex: Record<string, object>, smartByIndex: Record<string, object>, membersByPrimitiveKey: Record<string, object[]> }}
     */
    static #buildLookups(userUnions, smartUnions) {
        const byIndex = {}
        const smartByIndex = {}
        const membersByPrimitiveKey = {}

        for (const union of userUnions) {
            byIndex[String(union.index)] = union
        }

        for (const smartUnion of smartUnions) {
            smartByIndex[String(smartUnion.index)] = smartUnion
            for (const member of smartUnion.members || []) {
                const key =
                    member.primitiveObjectId + ':' + member.primitiveIndex
                membersByPrimitiveKey[key] = membersByPrimitiveKey[key] || []
                membersByPrimitiveKey[key].push(smartUnion)
            }
        }

        return {
            userUnions,
            smartUnions,
            byIndex,
            smartByIndex,
            membersByPrimitiveKey
        }
    }

    /**
     * Returns the public membership shape attached to primitives.
     * @param {object} smartUnion
     * @returns {object}
     */
    static #publicMembership(smartUnion) {
        return {
            index: smartUnion.index,
            name: smartUnion.name,
            type: smartUnion.type,
            typeName: smartUnion.typeName,
            sourceStream: smartUnion.sourceStream
        }
    }

    /**
     * Maps known smart-union type ids to stable labels.
     * @param {number | string} type
     * @returns {string}
     */
    static #smartUnionTypeName(type) {
        if (typeof type === 'string' && type) {
            return type
        }

        return (
            {
                1: 'drill-table',
                2: 'via-stitching',
                3: 'layer-stack-table',
                4: 'length-tuning',
                5: 'metadata-ole-object',
                6: 'via-shielding',
                9: 'rectangle'
            }[Number(type)] || 'unknown'
        )
    }
}
