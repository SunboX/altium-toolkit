// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves declared PcbLib footprint names to compound-document storage names.
 */
export class PcbLibStorageNameResolver {
    /**
     * Resolves all declared footprint storage names.
     * @param {Map<string, Uint8Array>} streams PcbLib compound streams.
     * @param {string[]} footprintNames Declared footprint names.
     * @param {Record<string, string>} sectionKeys Section-key mapping.
     * @returns {{ resolvedFootprints: { name: string, storageName: string }[], missingFootprints: object[] }}
     */
    static resolveFootprints(streams, footprintNames, sectionKeys) {
        const resolvedFootprints = []
        const missingFootprints = []

        for (const name of footprintNames || []) {
            const candidates = PcbLibStorageNameResolver.#storageCandidates(
                name,
                sectionKeys
            )
            const storageName = PcbLibStorageNameResolver.#resolveStorageName(
                streams,
                candidates
            )

            if (!storageName) {
                missingFootprints.push({
                    footprintName: name,
                    candidates,
                    reason: 'no matching footprint Data stream'
                })
                continue
            }

            resolvedFootprints.push({ name, storageName })
        }

        return { resolvedFootprints, missingFootprints }
    }

    /**
     * Parses an optional SectionKeys stream that maps full footprint names to
     * shortened OLE storage names.
     * @param {Uint8Array | undefined} bytes SectionKeys stream bytes.
     * @returns {Record<string, string>}
     */
    static parseSectionKeys(bytes) {
        if (!bytes || bytes.byteLength < 4) {
            return {}
        }

        const count = PcbLibStorageNameResolver.#readUint32(bytes, 0)
        const entries = {}
        let offset = 4

        for (let index = 0; index < count; index += 1) {
            const fullName = PcbLibStorageNameResolver.#readStringBlockAt(
                bytes,
                offset
            )
            if (!fullName) break
            offset = fullName.nextOffset

            const storageName = PcbLibStorageNameResolver.#readStringBlockAt(
                bytes,
                offset
            )
            if (!storageName) break
            offset = storageName.nextOffset
            entries[fullName.text] = storageName.text
        }

        return entries
    }

    /**
     * Builds candidate OLE storage names for one declared footprint.
     * @param {string} footprintName Declared footprint name.
     * @param {Record<string, string>} sectionKeys Section-key mapping.
     * @returns {string[]}
     */
    static #storageCandidates(footprintName, sectionKeys) {
        return [
            footprintName,
            PcbLibStorageNameResolver.#sanitizeStorageName(footprintName),
            sectionKeys[footprintName],
            PcbLibStorageNameResolver.#sanitizeStorageName(
                footprintName.slice(0, 31)
            )
        ]
            .filter(Boolean)
            .filter(
                (candidate, index, candidates) =>
                    candidates.indexOf(candidate) === index
            )
    }

    /**
     * Resolves the first candidate with a matching Data stream.
     * @param {Map<string, Uint8Array>} streams PcbLib compound streams.
     * @param {string[]} candidates Candidate storage names.
     * @returns {string}
     */
    static #resolveStorageName(streams, candidates) {
        return (
            candidates.find((candidate) => streams.has(candidate + '/Data')) ||
            ''
        )
    }

    /**
     * Sanitizes one footprint name for legacy OLE storage lookup.
     * @param {string} name Footprint name.
     * @returns {string}
     */
    static #sanitizeStorageName(name) {
        return String(name || '')
            .replace(/[<>:"/\\|?*\x00-\x1f]/gu, '_')
            .slice(0, 31)
    }

    /**
     * Reads a little-endian unsigned 32-bit value from one byte array.
     * @param {Uint8Array} bytes Source bytes.
     * @param {number} offset Byte offset.
     * @returns {number}
     */
    static #readUint32(bytes, offset) {
        if (!bytes || offset + 4 > bytes.byteLength) return 0

        return new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
        ).getUint32(offset, true)
    }

    /**
     * Reads one Pascal-style PCB string block from an offset.
     * @param {Uint8Array} bytes Source bytes.
     * @param {number} offset Byte offset.
     * @returns {{ text: string, nextOffset: number } | null}
     */
    static #readStringBlockAt(bytes, offset) {
        if (!bytes || offset + 5 > bytes.byteLength) return null

        const byteLength = PcbLibStorageNameResolver.#readUint32(bytes, offset)
        const stringLength = bytes[offset + 4]
        const textOffset = offset + 5
        const nextOffset = offset + 4 + byteLength

        if (
            byteLength < 1 ||
            textOffset + stringLength > bytes.byteLength ||
            nextOffset > bytes.byteLength
        ) {
            return null
        }

        return {
            text: new TextDecoder('utf-8').decode(
                bytes.subarray(textOffset, textOffset + stringLength)
            ),
            nextOffset
        }
    }
}
