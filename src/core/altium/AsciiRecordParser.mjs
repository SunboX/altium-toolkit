// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PrintableTextDecoder } from './PrintableTextDecoder.mjs'

/**
 * Converts printable text runs into key/value record objects.
 */
export class AsciiRecordParser {
    /**
     * Parses printable records from a binary buffer.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ raw: string, fields: Record<string, string | string[]> }[]}
     */
    static parse(arrayBuffer) {
        const runs = PrintableTextDecoder.extractRunBytes(arrayBuffer)
        const records = []

        for (const runBytes of runs) {
            const run = AsciiRecordParser.#bytesToBinaryString(runBytes)
            const chunks = run.split(
                /(?=\|(?:HEADER|RECORD|UNICODE|SELECTION|KIND)=)/g
            )

            for (const chunk of chunks) {
                const candidate = chunk.trim()
                if (!AsciiRecordParser.#isRecordCandidate(candidate)) continue
                records.push(AsciiRecordParser.#parseRecord(candidate))
            }
        }

        return records
    }

    /**
     * Returns true when a printable run looks like an Altium record block.
     * @param {string} candidate
     * @returns {boolean}
     */
    static #isRecordCandidate(candidate) {
        if (!candidate.startsWith('|')) return false
        if (!candidate.includes('=')) return false
        return candidate.split('|').length >= 4
    }

    /**
     * Parses one pipe-delimited record into a field object.
     * @param {string} raw
     * @returns {{ raw: string, fields: Record<string, string | string[]> }}
     */
    static #parseRecord(raw) {
        const fields = {}
        const segments = raw
            .replace(/[\r\n]/g, '')
            .split('|')
            .map((segment) => AsciiRecordParser.#trimAscii(segment))
            .filter(Boolean)

        for (const segment of segments) {
            const separatorIndex = segment.indexOf('=')
            if (separatorIndex === -1) continue

            const rawKey = AsciiRecordParser.#trimAscii(
                segment.slice(0, separatorIndex)
            )
            const value = PrintableTextDecoder.decodeBytes(
                AsciiRecordParser.#binaryStringToBytes(
                    AsciiRecordParser.#trimAscii(
                        segment.slice(separatorIndex + 1)
                    )
                ),
                {
                    encoding: rawKey.startsWith('%UTF8%') ? 'utf-8' : undefined
                }
            )
            const isUtf8Field = rawKey.startsWith('%UTF8%')
            const key = rawKey.replace(/^%UTF8%/, '')
            if (!key) continue

            if (isUtf8Field) {
                AsciiRecordParser.#appendFieldValue(
                    fields,
                    'UTF8:' + key,
                    value
                )
            }

            AsciiRecordParser.#appendFieldValue(fields, key, value)
        }

        return { raw, fields }
    }

    /**
     * Converts one binary string into bytes without altering byte values.
     * @param {string} value
     * @returns {Uint8Array}
     */
    static #binaryStringToBytes(value) {
        return Uint8Array.from(value, (character) => character.charCodeAt(0))
    }

    /**
     * Converts one byte array into a binary string without decoding it.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #bytesToBinaryString(bytes) {
        const chunkSize = 0x8000
        let value = ''

        for (let index = 0; index < bytes.length; index += chunkSize) {
            value += String.fromCharCode(
                ...bytes.subarray(index, index + chunkSize)
            )
        }

        return value
    }

    /**
     * Trims ASCII record whitespace without altering encoded field bytes.
     * @param {string} value
     * @returns {string}
     */
    static #trimAscii(value) {
        return value.replace(/^[\t\r\n ]+|[\t\r\n ]+$/g, '')
    }

    /**
     * Appends one parsed field value while preserving duplicates.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @param {string} value
     */
    static #appendFieldValue(fields, key, value) {
        if (!(key in fields)) {
            fields[key] = value
            return
        }

        const previous = fields[key]
        if (Array.isArray(previous)) {
            previous.push(value)
            return
        }

        fields[key] = [previous, value]
    }
}
