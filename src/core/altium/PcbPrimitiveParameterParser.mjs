// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Decodes Altium PrimitiveParameters/Data sidecar records.
 */
export class PcbPrimitiveParameterParser {
    /**
     * Parses length-prefixed primitive parameter records.
     * @param {Uint8Array | ArrayBuffer | undefined} dataBytes
     * @returns {{ groups: { primitiveId: string, id: string, appurtenance: string, variantGuid: string, declaredCount: number | null, parameters: Record<string, string>, records: Record<string, string>[] }[], byPrimitiveId: Record<string, Record<string, string>> }}
     */
    static parse(dataBytes) {
        const bytes = PcbPrimitiveParameterParser.#toUint8Array(dataBytes)
        const groups = []
        const groupsByPrimitiveId = new Map()
        let currentGroup = null
        let offset = 0

        while (offset + 4 <= bytes.byteLength) {
            const recordLength = PcbPrimitiveParameterParser.#readUint32(
                bytes,
                offset
            )
            offset += 4

            if (recordLength < 0 || offset + recordLength > bytes.byteLength) {
                break
            }

            const recordBytes = bytes.subarray(offset, offset + recordLength)
            offset += recordLength

            const fields =
                PcbPrimitiveParameterParser.#parseRecordFields(recordBytes)
            if (!Object.keys(fields).length) {
                continue
            }

            const primitiveId = fields.PRIMITIVEID || ''
            if (primitiveId) {
                currentGroup = PcbPrimitiveParameterParser.#groupForPrimitiveId(
                    primitiveId,
                    fields,
                    groups,
                    groupsByPrimitiveId
                )
                currentGroup.records.push(fields)
                continue
            }

            if (currentGroup) {
                PcbPrimitiveParameterParser.#appendParameterRecord(
                    currentGroup,
                    fields
                )
            }
        }

        return {
            groups,
            byPrimitiveId:
                PcbPrimitiveParameterParser.#buildPrimitiveParameterLookup(
                    groups
                )
        }
    }

    /**
     * Returns an existing group or creates one for a primitive unique ID.
     * @param {string} primitiveId
     * @param {Record<string, string>} fields
     * @param {{ primitiveId: string, id: string, appurtenance: string, variantGuid: string, declaredCount: number | null, parameters: Record<string, string>, records: Record<string, string>[] }[]} groups
     * @param {Map<string, { primitiveId: string, id: string, appurtenance: string, variantGuid: string, declaredCount: number | null, parameters: Record<string, string>, records: Record<string, string>[] }>} groupsByPrimitiveId
     * @returns {{ primitiveId: string, id: string, appurtenance: string, variantGuid: string, declaredCount: number | null, parameters: Record<string, string>, records: Record<string, string>[] }}
     */
    static #groupForPrimitiveId(
        primitiveId,
        fields,
        groups,
        groupsByPrimitiveId
    ) {
        if (!groupsByPrimitiveId.has(primitiveId)) {
            const group = {
                primitiveId,
                id: '',
                appurtenance: '',
                variantGuid: '',
                declaredCount: null,
                parameters: {},
                records: []
            }
            groupsByPrimitiveId.set(primitiveId, group)
            groups.push(group)
        }

        const group = groupsByPrimitiveId.get(primitiveId)
        PcbPrimitiveParameterParser.#mergeGroupFields(group, fields)

        return group
    }

    /**
     * Merges group-level metadata fields into one primitive parameter group.
     * @param {{ id: string, appurtenance: string, variantGuid: string, declaredCount: number | null }} group
     * @param {Record<string, string>} fields
     */
    static #mergeGroupFields(group, fields) {
        group.id = fields.ID || group.id
        group.appurtenance = fields.APPURTENANCE || group.appurtenance
        group.variantGuid = fields.VARIANTGUID || group.variantGuid

        const declaredCount = Number(fields.COUNT)
        if (Number.isInteger(declaredCount) && declaredCount > 0) {
            group.declaredCount = declaredCount
        }
    }

    /**
     * Appends one name/value parameter record to a group.
     * @param {{ parameters: Record<string, string>, records: Record<string, string>[] }} group
     * @param {Record<string, string>} fields
     */
    static #appendParameterRecord(group, fields) {
        const name = fields.NAME || ''

        if (name) {
            group.parameters[name] = fields.VALUE || ''
        }

        group.records.push(fields)
    }

    /**
     * Builds a plain-object lookup keyed by primitive unique ID.
     * @param {{ primitiveId: string, parameters: Record<string, string> }[]} groups
     * @returns {Record<string, Record<string, string>>}
     */
    static #buildPrimitiveParameterLookup(groups) {
        const byPrimitiveId = {}

        for (const group of groups) {
            byPrimitiveId[group.primitiveId] = { ...group.parameters }
        }

        return byPrimitiveId
    }

    /**
     * Parses one pipe-delimited primitive parameter record.
     * @param {Uint8Array} bytes
     * @returns {Record<string, string>}
     */
    static #parseRecordFields(bytes) {
        const text = new TextDecoder()
            .decode(bytes)
            .replace(/\u0000/gu, '')
            .replace(/\r\n?/gu, '\n')
            .trim()
        const fields = {}

        for (const segment of text.split('|')) {
            const candidate = segment.trim()
            const separatorIndex = candidate.indexOf('=')

            if (separatorIndex <= 0) {
                continue
            }

            const key = candidate.slice(0, separatorIndex).trim()
            if (!key) {
                continue
            }

            fields[key] = candidate.slice(separatorIndex + 1).trim()
        }

        return fields
    }

    /**
     * Reads one little-endian unsigned integer from a byte view.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static #readUint32(bytes, offset) {
        return new DataView(
            bytes.buffer,
            bytes.byteOffset + offset,
            4
        ).getUint32(0, true)
    }

    /**
     * Normalizes one byte-like input into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer | undefined} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        if (!bytes) {
            return new Uint8Array(0)
        }

        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes)
    }
}
