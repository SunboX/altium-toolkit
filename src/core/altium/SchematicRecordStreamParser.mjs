// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AsciiRecordParser } from './AsciiRecordParser.mjs'

/**
 * Parses schematic stream records from native framed streams or printable runs.
 */
export class SchematicRecordStreamParser {
    /**
     * Parses one schematic stream into record objects.
     * @param {ArrayBuffer} arrayBuffer Stream bytes.
     * @returns {{ raw: string, fields: Record<string, string | string[]> }[]}
     */
    static parse(arrayBuffer) {
        return SchematicRecordStreamParser.parseWithOpaqueRecords(arrayBuffer)
            .records
    }

    /**
     * Parses one schematic stream and preserves unmodelled native frames.
     * @param {ArrayBuffer} arrayBuffer Stream bytes.
     * @param {{ source?: string, sourceStorage?: string, sourceStream?: string }} [options]
     * @returns {{ records: { raw: string, fields: Record<string, string | string[]> }[], opaqueRecords: object[] }}
     */
    static parseWithOpaqueRecords(arrayBuffer, options = {}) {
        const framedRecords = SchematicRecordStreamParser.#parseFramedRecords(
            arrayBuffer,
            options
        )

        if (framedRecords) {
            return framedRecords
        }

        return {
            records: AsciiRecordParser.parse(arrayBuffer),
            opaqueRecords: []
        }
    }

    /**
     * Parses length-prefixed native records when the full stream validates as
     * framed schematic data.
     * @param {ArrayBuffer} arrayBuffer Stream bytes.
     * @param {{ source?: string, sourceStorage?: string, sourceStream?: string }} options Parser metadata.
     * @returns {{ records: { raw: string, fields: Record<string, string | string[]> }[], opaqueRecords: object[] } | null}
     */
    static #parseFramedRecords(arrayBuffer, options) {
        const bytes = new Uint8Array(arrayBuffer)
        const records = []
        const opaqueRecords = []
        let offset = 0
        let recordIndex = 0

        while (offset < bytes.byteLength) {
            if (offset + 4 > bytes.byteLength) {
                return null
            }

            const payloadLength = bytes[offset] | (bytes[offset + 1] << 8)
            const separatorByte = bytes[offset + 2]
            const recordType = bytes[offset + 3]
            const payloadStart = offset + 4
            const payloadEnd = payloadStart + payloadLength

            if (
                payloadLength <= 0 ||
                separatorByte !== 0 ||
                payloadEnd > bytes.byteLength
            ) {
                return null
            }

            if (recordType === 0) {
                if (bytes[payloadEnd - 1] !== 0) {
                    return null
                }

                const raw = SchematicRecordStreamParser.#bytesToBinaryString(
                    bytes.subarray(payloadStart, payloadEnd - 1)
                )

                if (raw.trim()) {
                    records.push(AsciiRecordParser.parseRecord(raw))
                }
            } else {
                opaqueRecords.push(
                    SchematicRecordStreamParser.#opaqueRecord(
                        bytes.subarray(payloadStart, payloadEnd),
                        recordType,
                        recordIndex,
                        options
                    )
                )
            }

            offset = payloadEnd
            recordIndex += 1
        }

        return records.length || opaqueRecords.length
            ? { records, opaqueRecords }
            : null
    }

    /**
     * Builds one opaque framed-record metadata row.
     * @param {Uint8Array} bytes Raw payload bytes.
     * @param {number} frameType Native frame type byte.
     * @param {number} recordIndex Zero-based frame index.
     * @param {{ source?: string, sourceStorage?: string, sourceStream?: string }} options Parser metadata.
     * @returns {object}
     */
    static #opaqueRecord(bytes, frameType, recordIndex, options) {
        return SchematicRecordStreamParser.#stripUndefined({
            source: options.source || 'schdoc',
            sourceStorage: options.sourceStorage,
            sourceStream: options.sourceStream,
            frameType,
            recordIndex,
            byteLength: bytes.byteLength,
            rawBase64: SchematicRecordStreamParser.#bytesToBase64(bytes)
        })
    }

    /**
     * Converts bytes into a byte-preserving string.
     * @param {Uint8Array} bytes Source bytes.
     * @returns {string}
     */
    static #bytesToBinaryString(bytes) {
        let value = ''

        for (const byte of bytes) {
            value += String.fromCharCode(byte)
        }

        return value
    }

    /**
     * Encodes bytes as base64 without depending on Node globals.
     * @param {Uint8Array} bytes Source bytes.
     * @returns {string}
     */
    static #bytesToBase64(bytes) {
        const alphabet =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        let output = ''

        for (let index = 0; index < bytes.byteLength; index += 3) {
            const first = bytes[index]
            const second = bytes[index + 1]
            const third = bytes[index + 2]
            const hasSecond = index + 1 < bytes.byteLength
            const hasThird = index + 2 < bytes.byteLength
            const value =
                (first << 16) |
                ((hasSecond ? second : 0) << 8) |
                (hasThird ? third : 0)

            output += alphabet[(value >> 18) & 0x3f]
            output += alphabet[(value >> 12) & 0x3f]
            output += hasSecond ? alphabet[(value >> 6) & 0x3f] : '='
            output += hasThird ? alphabet[value & 0x3f] : '='
        }

        return output
    }

    /**
     * Removes undefined values from an object.
     * @param {object} row Row to strip.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
