// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds synthetic length-prefixed PCB sidecar streams for parser tests.
 */
export class PcbSidecarTestFactory {
    /**
     * Encodes pipe-delimited sidecar records with little-endian length prefixes.
     * @param {string[]} records
     * @returns {Uint8Array}
     */
    static createLengthPrefixedRecords(records) {
        const encoder = new TextEncoder()
        const encodedRecords = records.map((record) => encoder.encode(record))
        const byteLength = encodedRecords.reduce(
            (sum, record) => sum + 4 + record.byteLength,
            0
        )
        const bytes = new Uint8Array(byteLength)
        const view = new DataView(bytes.buffer)
        let offset = 0

        for (const record of encodedRecords) {
            view.setUint32(offset, record.byteLength, true)
            offset += 4
            bytes.set(record, offset)
            offset += record.byteLength
        }

        return bytes
    }
}
