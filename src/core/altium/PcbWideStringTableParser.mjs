// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Decodes Altium WideStrings6/Data text-table streams.
 */
export class PcbWideStringTableParser {
    /**
     * Parses indexed UTF-16LE string-table records.
     * @param {Uint8Array | ArrayBuffer | undefined} dataBytes
     * @returns {{ entries: { index: number, text: string }[], byIndex: Record<string, string> }}
     */
    static parse(dataBytes) {
        const bytes = PcbWideStringTableParser.#toUint8Array(dataBytes)
        const entries = []
        let offset = 0

        while (offset + 8 <= bytes.byteLength) {
            const index = PcbWideStringTableParser.#readUint32(bytes, offset)
            const byteLength = PcbWideStringTableParser.#readUint32(
                bytes,
                offset + 4
            )
            offset += 8

            if (offset + byteLength > bytes.byteLength) {
                break
            }

            const stringBytes = bytes.subarray(offset, offset + byteLength)
            offset += byteLength

            entries.push({
                index,
                text: PcbWideStringTableParser.#decodeWideString(stringBytes)
            })
        }

        return {
            entries,
            byIndex: PcbWideStringTableParser.#buildWideStringLookup(entries)
        }
    }

    /**
     * Builds a JSON-friendly string lookup keyed by numeric string index.
     * @param {{ index: number, text: string }[]} entries
     * @returns {Record<string, string>}
     */
    static #buildWideStringLookup(entries) {
        const byIndex = {}

        for (const entry of entries) {
            byIndex[entry.index] = entry.text
        }

        return byIndex
    }

    /**
     * Decodes and normalizes one UTF-16LE string-table entry.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #decodeWideString(bytes) {
        if (!bytes.byteLength) {
            return ''
        }

        return new TextDecoder('utf-16le')
            .decode(bytes)
            .replace(/\u0000+$/gu, '')
            .replace(/^[\u0000-\u001f\u007f-\u009f]+/gu, '')
            .trim()
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
