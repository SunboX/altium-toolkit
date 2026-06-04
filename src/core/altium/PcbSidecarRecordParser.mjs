// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PrintableTextDecoder } from './PrintableTextDecoder.mjs'

/**
 * Decodes length-prefixed pipe-delimited PCB sidecar records.
 */
export class PcbSidecarRecordParser {
    /**
     * Parses one sidecar stream into field records.
     * @param {Uint8Array | ArrayBuffer | undefined} dataBytes
     * @param {string} sourceStream
     * @returns {{ fields: Record<string, string>, sourceStream: string, recordIndex: number }[]}
     */
    static parseLengthPrefixedRecords(dataBytes, sourceStream) {
        const bytes = PcbSidecarRecordParser.toUint8Array(dataBytes)
        const records = []
        let offset = 0

        while (offset + 4 <= bytes.byteLength) {
            const recordLength = PcbSidecarRecordParser.readUint32(
                bytes,
                offset
            )
            offset += 4

            if (recordLength <= 0 || offset + recordLength > bytes.byteLength) {
                break
            }

            const recordBytes = bytes.subarray(offset, offset + recordLength)
            offset += recordLength

            records.push({
                fields: PcbSidecarRecordParser.parseRecordFields(recordBytes),
                sourceStream,
                recordIndex: records.length
            })
        }

        return records
    }

    /**
     * Parses one pipe-delimited field record.
     * @param {Uint8Array} bytes
     * @returns {Record<string, string>}
     */
    static parseRecordFields(bytes) {
        const text = PrintableTextDecoder.decodeBytes(bytes)
            .replace(/\u0000/gu, '')
            .replace(/\r\n?/gu, '\n')
            .trim()
        const fields = {}

        for (const line of text.split('\n')) {
            for (const segment of line.split('|')) {
                const candidate = segment.trim()
                const separatorIndex = candidate.indexOf('=')

                if (separatorIndex <= 0) {
                    continue
                }

                const key = candidate
                    .slice(0, separatorIndex)
                    .trim()
                    .toUpperCase()
                if (!key) {
                    continue
                }

                fields[key] = candidate.slice(separatorIndex + 1).trim()
            }
        }

        return fields
    }

    /**
     * Returns one field value using the first matching key.
     * @param {Record<string, string>} fields
     * @param {string[]} keys
     * @returns {string}
     */
    static firstField(fields, keys) {
        for (const key of keys) {
            const value = fields[String(key).toUpperCase()]
            if (value !== undefined && value !== '') {
                return value
            }
        }

        return ''
    }

    /**
     * Parses one integer-like field value.
     * @param {string | undefined} value
     * @returns {number | null}
     */
    static parseInteger(value) {
        const parsed = Number(String(value ?? '').trim())
        return Number.isInteger(parsed) ? parsed : null
    }

    /**
     * Parses one numeric field value, including simple unit suffixes.
     * @param {string | undefined} value
     * @returns {number | null}
     */
    static parseNumber(value) {
        const match = String(value ?? '')
            .trim()
            .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i)

        if (!match) {
            return null
        }

        const parsed = Number(match[0])
        return Number.isFinite(parsed) ? parsed : null
    }

    /**
     * Parses an Altium boolean token.
     * @param {string | undefined} value
     * @returns {boolean | null}
     */
    static parseBoolean(value) {
        const normalized = String(value ?? '')
            .trim()
            .toUpperCase()

        if (['T', 'TRUE', '1', 'YES'].includes(normalized)) {
            return true
        }
        if (['F', 'FALSE', '0', 'NO'].includes(normalized)) {
            return false
        }

        return null
    }

    /**
     * Reads one little-endian unsigned integer from a byte view.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static readUint32(bytes, offset) {
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
    static toUint8Array(bytes) {
        if (!bytes) {
            return new Uint8Array(0)
        }

        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes)
    }
}
