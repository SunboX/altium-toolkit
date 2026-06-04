// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds a generic inventory for embedded payload streams.
 */
export class EmbeddedFileInventoryBuilder {
    static SCHEMA_ID = 'altium-toolkit.embedded-files.a1'

    /**
     * Builds an embedded-file inventory from a stream map.
     * @param {Map<string, Uint8Array>} streams Compound-document streams.
     * @param {{ skipStreamNames?: Iterable<string> }} [options] Inventory options.
     * @returns {{ schema: string, files: object[], diagnostics: object[] }}
     */
    static buildFromStreams(streams, options = {}) {
        const skipStreamNames = new Set(options.skipStreamNames || [])
        const files = []
        const diagnostics = []

        for (const [sourceStream, bytes] of streams || []) {
            if (
                skipStreamNames.has(sourceStream) ||
                !EmbeddedFileInventoryBuilder.#isEmbeddedPayloadStream(
                    sourceStream
                )
            ) {
                continue
            }

            if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
                diagnostics.push({
                    code: 'embedded-file.empty',
                    severity: 'warning',
                    sourceStream,
                    message: 'Embedded payload stream was empty.'
                })
                continue
            }

            files.push(
                EmbeddedFileInventoryBuilder.#fileRecord(sourceStream, bytes)
            )
        }

        return {
            schema: EmbeddedFileInventoryBuilder.SCHEMA_ID,
            files: files.sort((left, right) =>
                left.sourceStream.localeCompare(right.sourceStream)
            ),
            diagnostics: diagnostics.sort((left, right) =>
                left.sourceStream.localeCompare(right.sourceStream)
            )
        }
    }

    /**
     * Returns true when a stream name represents a payload-style embedded file.
     * @param {string} sourceStream Stream name.
     * @returns {boolean}
     */
    static #isEmbeddedPayloadStream(sourceStream) {
        const normalized = String(sourceStream || '')
        if (/\/(?:Data|Header)$/i.test(normalized)) {
            return false
        }

        return (
            /^(EmbeddedFiles|Embedded|Attachments|Images?)\//i.test(
                normalized
            ) ||
            /^Models\/\d+$/i.test(normalized) ||
            /\.[A-Za-z0-9]{2,8}$/.test(normalized)
        )
    }

    /**
     * Builds one file inventory row.
     * @param {string} sourceStream Stream name.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {object}
     */
    static #fileRecord(sourceStream, bytes) {
        return {
            sourceStream,
            name: EmbeddedFileInventoryBuilder.#basename(sourceStream),
            format: EmbeddedFileInventoryBuilder.#format(sourceStream, bytes),
            byteLength: bytes.byteLength,
            checksum: {
                algorithm: 'fnv1a32',
                value: EmbeddedFileInventoryBuilder.#fnv1a32(bytes)
            }
        }
    }

    /**
     * Resolves the payload basename from a stream path.
     * @param {string} sourceStream Stream name.
     * @returns {string}
     */
    static #basename(sourceStream) {
        return (
            String(sourceStream || '')
                .split('/')
                .filter(Boolean)
                .pop() || ''
        )
    }

    /**
     * Classifies payload format from extension, magic bytes, and text probes.
     * @param {string} sourceStream Stream name.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {string}
     */
    static #format(sourceStream, bytes) {
        const lower =
            EmbeddedFileInventoryBuilder.#basename(sourceStream).toLowerCase()

        if (
            lower.endsWith('.png') ||
            EmbeddedFileInventoryBuilder.#hasPrefix(
                bytes,
                [0x89, 0x50, 0x4e, 0x47]
            )
        ) {
            return 'png'
        }
        if (
            lower.endsWith('.jpg') ||
            lower.endsWith('.jpeg') ||
            EmbeddedFileInventoryBuilder.#hasPrefix(bytes, [0xff, 0xd8, 0xff])
        ) {
            return 'jpeg'
        }
        if (
            lower.endsWith('.gif') ||
            EmbeddedFileInventoryBuilder.#asciiPrefix(bytes).startsWith('GIF')
        ) {
            return 'gif'
        }
        if (
            lower.endsWith('.bmp') ||
            EmbeddedFileInventoryBuilder.#asciiPrefix(bytes).startsWith('BM')
        ) {
            return 'bmp'
        }
        if (
            lower.endsWith('.svg') ||
            EmbeddedFileInventoryBuilder.#trimmedText(bytes).startsWith('<svg')
        ) {
            return 'svg'
        }
        if (
            lower.endsWith('.step') ||
            lower.endsWith('.stp') ||
            EmbeddedFileInventoryBuilder.#trimmedText(bytes).startsWith(
                'ISO-10303-21'
            )
        ) {
            return 'step'
        }
        if (lower.endsWith('.sldprt') || lower.endsWith('.sldasm')) {
            return 'solidworks'
        }
        if (lower.endsWith('.x_t') || lower.endsWith('.xmt_txt')) {
            return 'parasolid-text'
        }
        if (lower.endsWith('.x_b') || lower.endsWith('.xmt_bin')) {
            return 'parasolid-binary'
        }
        if (
            lower.endsWith('.pdf') ||
            EmbeddedFileInventoryBuilder.#asciiPrefix(bytes).startsWith('%PDF')
        ) {
            return 'pdf'
        }
        if (EmbeddedFileInventoryBuilder.#isLikelyText(bytes)) {
            return 'text'
        }

        return 'binary'
    }

    /**
     * Returns true when bytes start with a prefix.
     * @param {Uint8Array} bytes Payload bytes.
     * @param {number[]} prefix Prefix bytes.
     * @returns {boolean}
     */
    static #hasPrefix(bytes, prefix) {
        return prefix.every((value, index) => bytes[index] === value)
    }

    /**
     * Decodes a short ASCII prefix.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {string}
     */
    static #asciiPrefix(bytes) {
        return new TextDecoder('latin1').decode(bytes.slice(0, 8))
    }

    /**
     * Decodes and trims a text probe.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {string}
     */
    static #trimmedText(bytes) {
        return new TextDecoder('utf-8', { fatal: false })
            .decode(bytes.slice(0, Math.min(bytes.byteLength, 256)))
            .trim()
    }

    /**
     * Returns true when a payload is printable enough to treat as text.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {boolean}
     */
    static #isLikelyText(bytes) {
        let printable = 0
        const length = Math.min(bytes.byteLength, 256)

        for (let index = 0; index < length; index += 1) {
            const value = bytes[index]
            if (
                value === 0x09 ||
                value === 0x0a ||
                value === 0x0d ||
                (value >= 0x20 && value <= 0x7e)
            ) {
                printable += 1
            }
        }

        return length > 0 && printable / length >= 0.9
    }

    /**
     * Computes an FNV-1a 32-bit checksum.
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
}
