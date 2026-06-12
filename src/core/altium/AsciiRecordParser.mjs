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
        let pendingPrefix = ''

        for (const runBytes of runs) {
            const run = AsciiRecordParser.#bytesToBinaryString(runBytes)
            const chunks = run.split(
                /(?=\|(?:HEADER|RECORD|UNICODE|SELECTION|KIND)=)/g
            )

            for (const chunk of chunks) {
                const candidate = chunk.trim()
                if (!AsciiRecordParser.#isRecordCandidate(candidate)) {
                    if (
                        AsciiRecordParser.#isRecordFieldPrefixFragment(
                            candidate
                        )
                    ) {
                        pendingPrefix += candidate
                    }
                    continue
                }

                const headerPrefix =
                    AsciiRecordParser.#extractHeaderFieldPrefix(candidate)
                if (headerPrefix) {
                    pendingPrefix += headerPrefix
                    continue
                }

                if (!AsciiRecordParser.#hasRecordMarker(candidate)) {
                    pendingPrefix += candidate
                    continue
                }

                records.push(
                    AsciiRecordParser.#parseRecord(pendingPrefix + candidate)
                )
                pendingPrefix = ''
            }
        }

        if (pendingPrefix) {
            records.push(AsciiRecordParser.#parseRecord(pendingPrefix))
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
     * Returns true when a short printable fragment contains fields that belong
     * to the next record marker in the same run.
     * @param {string} candidate
     * @returns {boolean}
     */
    static #isRecordFieldPrefixFragment(candidate) {
        if (!candidate.startsWith('|')) return false
        if (!candidate.includes('=')) return false
        if (AsciiRecordParser.#hasRecordMarker(candidate)) return false

        const segments = candidate.split('|').filter(Boolean)
        return segments.every((segment) => {
            const separatorIndex = segment.indexOf('=')
            return separatorIndex > 0
        })
    }

    /**
     * Returns true when a printable fragment contains its marker field.
     * @param {string} candidate
     * @returns {boolean}
     */
    static #hasRecordMarker(candidate) {
        return /(?:^|\|)(?:HEADER|RECORD|UNICODE|SELECTION|KIND)=/.test(
            candidate
        )
    }

    /**
     * Extracts schematic sheet fields that trail a schematic header before the
     * first record.
     * @param {string} candidate
     * @returns {string}
     */
    static #extractHeaderFieldPrefix(candidate) {
        if (!candidate.startsWith('|HEADER=')) {
            return ''
        }

        const segments = candidate.split('|').filter(Boolean)
        if (segments.length <= 1) {
            return ''
        }
        const headerValue = segments[0].slice('HEADER='.length)
        if (!/^Schematic Document$/i.test(headerValue)) {
            return ''
        }

        return '|' + segments.slice(1).join('|')
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
            const isUtf8Field = rawKey.startsWith('%UTF8%')
            const value = AsciiRecordParser.#decodeFieldValue(
                AsciiRecordParser.#trimAscii(segment.slice(separatorIndex + 1)),
                isUtf8Field ? 'utf-8' : ''
            )
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

        return {
            raw,
            fields: AsciiRecordParser.#createCaseInsensitiveFields(fields)
        }
    }

    /**
     * Wraps parsed fields so consumers can read native records regardless of
     * whether the printable stream used upper, lower, or mixed-case keys.
     * @param {Record<string, string | string[]>} fields
     * @returns {Record<string, string | string[]>}
     */
    static #createCaseInsensitiveFields(fields) {
        const normalizedKeyIndex =
            AsciiRecordParser.#buildCaseInsensitiveFieldIndex(fields)

        return new Proxy(fields, {
            get(target, property, receiver) {
                if (typeof property !== 'string' || property in target) {
                    return Reflect.get(target, property, receiver)
                }

                const normalizedKey = normalizedKeyIndex.get(
                    property.toLowerCase()
                )
                return normalizedKey
                    ? Reflect.get(target, normalizedKey, receiver)
                    : undefined
            },
            has(target, property) {
                if (typeof property !== 'string' || property in target) {
                    return Reflect.has(target, property)
                }

                return normalizedKeyIndex.has(property.toLowerCase())
            }
        })
    }

    /**
     * Builds a lookup from lower-case field names to their source key.
     * @param {Record<string, string | string[]>} fields
     * @returns {Map<string, string>}
     */
    static #buildCaseInsensitiveFieldIndex(fields) {
        const normalizedKeyIndex = new Map()

        for (const key of Object.keys(fields)) {
            const normalizedKey = key.toLowerCase()
            if (!normalizedKeyIndex.has(normalizedKey)) {
                normalizedKeyIndex.set(normalizedKey, key)
            }
        }

        return normalizedKeyIndex
    }

    /**
     * Decodes one pipe-delimited field value from the byte-preserving run
     * string. Plain ASCII is already decoded by construction and can avoid
     * byte-array allocation plus TextDecoder fallback probing.
     * @param {string} value Byte-preserving field value.
     * @param {string} preferredEncoding Optional preferred decoder encoding.
     * @returns {string}
     */
    static #decodeFieldValue(value, preferredEncoding) {
        if (!AsciiRecordParser.#hasExtendedByte(value)) {
            return value
        }

        return PrintableTextDecoder.decodeBytes(
            AsciiRecordParser.#binaryStringToBytes(value),
            { encoding: preferredEncoding || undefined }
        )
    }

    /**
     * Converts one binary string into bytes without altering byte values.
     * @param {string} value
     * @returns {Uint8Array}
     */
    static #binaryStringToBytes(value) {
        const bytes = new Uint8Array(value.length)

        for (let index = 0; index < value.length; index += 1) {
            bytes[index] = value.charCodeAt(index) & 0xff
        }

        return bytes
    }

    /**
     * Returns true when the byte-preserving string contains non-ASCII bytes.
     * @param {string} value Field value.
     * @returns {boolean}
     */
    static #hasExtendedByte(value) {
        for (let index = 0; index < value.length; index += 1) {
            if (value.charCodeAt(index) > 0x7f) return true
        }

        return false
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
