// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds metadata-only inventories for native OLE streams.
 */
export class NativeStreamInventoryBuilder {
    static SCHEMA_ID = 'altium-toolkit.native-stream-inventory.a1'

    /**
     * Builds a native stream inventory from a compound-document stream map.
     * @param {Map<string, Uint8Array>} streams Native stream map.
     * @param {{ source?: string, consumedStreamNames?: Iterable<string>, knownStreamNames?: Iterable<string>, consumersByStreamName?: Map<string, string> | Record<string, string> }} [options] Inventory options.
     * @returns {{ schema: string, summary: object, streams: object[] }}
     */
    static buildFromStreams(streams, options = {}) {
        const consumedStreamNames = new Set(options.consumedStreamNames || [])
        const knownStreamNames = new Set(options.knownStreamNames || [])
        const consumersByStreamName = NativeStreamInventoryBuilder.#consumerMap(
            options.consumersByStreamName
        )
        const rows = [...(streams || new Map()).entries()]
            .map(([sourceStream, bytes]) =>
                NativeStreamInventoryBuilder.#streamRow(sourceStream, bytes, {
                    source: options.source || '',
                    consumedStreamNames,
                    knownStreamNames,
                    consumersByStreamName
                })
            )
            .sort((left, right) =>
                left.sourceStream.localeCompare(right.sourceStream)
            )

        return {
            schema: NativeStreamInventoryBuilder.SCHEMA_ID,
            summary: NativeStreamInventoryBuilder.#summary(rows),
            streams: rows
        }
    }

    /**
     * Builds one metadata-only stream row.
     * @param {string} sourceStream Stream path.
     * @param {Uint8Array} bytes Stream payload.
     * @param {object} options Row options.
     * @returns {object}
     */
    static #streamRow(sourceStream, bytes, options) {
        const streamBytes =
            bytes instanceof Uint8Array ? bytes : new Uint8Array()
        const known = options.knownStreamNames.has(sourceStream)
        const consumed = options.consumedStreamNames.has(sourceStream)
        const { sourceStorage, leafName } =
            NativeStreamInventoryBuilder.#pathParts(sourceStream)

        return NativeStreamInventoryBuilder.#stripUndefined({
            source: options.source || undefined,
            sourceStream,
            sourceStorage,
            leafName,
            byteLength: streamBytes.byteLength,
            known,
            consumed,
            classification: NativeStreamInventoryBuilder.#classification(
                known,
                consumed,
                streamBytes.byteLength
            ),
            consumedBy:
                options.consumersByStreamName.get(sourceStream) || undefined,
            checksum: {
                algorithm: 'fnv1a32',
                value: NativeStreamInventoryBuilder.#fnv1a32(streamBytes)
            }
        })
    }

    /**
     * Builds aggregate counters for inventory rows.
     * @param {object[]} rows Stream rows.
     * @returns {object}
     */
    static #summary(rows) {
        return {
            streamCount: rows.length,
            knownStreamCount: rows.filter((row) => row.known).length,
            unknownStreamCount: rows.filter((row) => !row.known).length,
            consumedStreamCount: rows.filter((row) => row.consumed).length,
            unconsumedStreamCount: rows.filter((row) => !row.consumed).length,
            emptyStreamCount: rows.filter((row) => row.byteLength === 0).length,
            byteCount: rows.reduce(
                (total, row) => total + Number(row.byteLength || 0),
                0
            )
        }
    }

    /**
     * Classifies one stream by parser knowledge and consumption status.
     * @param {boolean} known Whether the stream name is recognized.
     * @param {boolean} consumed Whether a parser or inventory consumed it.
     * @param {number} byteLength Stream byte length.
     * @returns {string}
     */
    static #classification(known, consumed, byteLength) {
        if (byteLength === 0) {
            return known ? 'known-empty' : 'unknown-empty'
        }
        if (known && consumed) return 'known-consumed'
        if (known) return 'known-unconsumed'
        if (consumed) return 'unknown-consumed'
        return 'unknown-opaque'
    }

    /**
     * Splits a native stream path into storage and leaf names.
     * @param {string} sourceStream Stream path.
     * @returns {{ sourceStorage: string, leafName: string }}
     */
    static #pathParts(sourceStream) {
        const parts = String(sourceStream || '')
            .split('/')
            .filter((part) => part !== '')

        if (parts.length <= 1) {
            return {
                sourceStorage: '',
                leafName: parts[0] || ''
            }
        }

        return {
            sourceStorage: parts.slice(0, -1).join('/'),
            leafName: parts.at(-1) || ''
        }
    }

    /**
     * Normalizes optional consumer metadata.
     * @param {Map<string, string> | Record<string, string> | undefined} value Consumer map.
     * @returns {Map<string, string>}
     */
    static #consumerMap(value) {
        if (value instanceof Map) return value
        if (!value || typeof value !== 'object') return new Map()
        return new Map(Object.entries(value))
    }

    /**
     * Computes a stable FNV-1a checksum.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {string}
     */
    static #fnv1a32(bytes) {
        let hash = 0x811c9dc5

        for (const value of bytes) {
            hash ^= value
            hash = Math.imul(hash, 0x01000193) >>> 0
        }

        return hash.toString(16).padStart(8, '0')
    }

    /**
     * Removes undefined fields from a row.
     * @param {object} row Source row.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
