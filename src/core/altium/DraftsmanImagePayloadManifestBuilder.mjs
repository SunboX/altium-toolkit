// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic image-payload manifests for Draftsman digest images.
 */
export class DraftsmanImagePayloadManifestBuilder {
    static SCHEMA = 'altium-toolkit.draftsman.image-payloads.a1'

    /**
     * Builds a payload manifest from parsed Draftsman pages.
     * @param {{ index: number, images?: object[] }[]} pages Parsed page rows.
     * @returns {{ schema: string, summary: object, payloads: object[], diagnostics: object[] }}
     */
    static build(pages) {
        const imageRows = DraftsmanImagePayloadManifestBuilder.#imageRows(pages)
        const payloads = []
        const diagnostics = []

        for (const image of imageRows) {
            const bytes =
                DraftsmanImagePayloadManifestBuilder.#payloadBytes(image)
            if (!bytes.length) {
                diagnostics.push(
                    DraftsmanImagePayloadManifestBuilder.#missingPayloadDiagnostic(
                        image
                    )
                )
                continue
            }

            payloads.push(
                DraftsmanImagePayloadManifestBuilder.#payloadRecord(
                    image,
                    bytes
                )
            )
        }

        return {
            schema: DraftsmanImagePayloadManifestBuilder.SCHEMA,
            summary: {
                imageCount: imageRows.length,
                payloadCount: payloads.length,
                diagnosticCount: diagnostics.length
            },
            payloads,
            diagnostics
        }
    }

    /**
     * Flattens page/image rows while preserving page and image indexes.
     * @param {{ index: number, images?: object[] }[]} pages Parsed pages.
     * @returns {object[]}
     */
    static #imageRows(pages) {
        return (pages || []).flatMap((page) =>
            (page.images || []).map((image, index) => ({
                ...image,
                pageIndex: page.index,
                imageIndex: index
            }))
        )
    }

    /**
     * Builds one payload manifest record.
     * @param {object} image Image descriptor.
     * @param {Uint8Array} bytes Payload bytes.
     * @returns {object}
     */
    static #payloadRecord(image, bytes) {
        return DraftsmanImagePayloadManifestBuilder.#stripUndefined({
            pageIndex: image.pageIndex,
            imageId: image.id,
            name: image.name,
            nativeFormat: image.nativeFormat,
            wrapperType:
                image.wrapperType ||
                image.fields?.WrapperType ||
                image.fields?.Wrapper ||
                undefined,
            byteSize: bytes.byteLength,
            checksum: {
                algorithm: 'fnv1a32',
                value: DraftsmanImagePayloadManifestBuilder.#fnv1a32(bytes)
            }
        })
    }

    /**
     * Builds a structured missing-payload diagnostic.
     * @param {object} image Image descriptor.
     * @returns {object}
     */
    static #missingPayloadDiagnostic(image) {
        return DraftsmanImagePayloadManifestBuilder.#stripUndefined({
            code: 'draftsman.image-payload.missing-bytes',
            severity: 'warning',
            pageIndex: image.pageIndex,
            imageId: image.id,
            name: image.name,
            message: 'Draftsman image item did not include payload bytes.'
        })
    }

    /**
     * Extracts base64 payload bytes from known image fields.
     * @param {object} image Image descriptor.
     * @returns {Uint8Array}
     */
    static #payloadBytes(image) {
        const fields = image?.fields || {}
        const value =
            fields.PayloadBase64 ||
            fields.DataBase64 ||
            fields.BytesBase64 ||
            fields.NativePayloadBase64 ||
            fields.BitmapBase64 ||
            ''

        return DraftsmanImagePayloadManifestBuilder.#decodeBase64(value)
    }

    /**
     * Decodes a base64 value without depending on Node-only globals.
     * @param {string} value Base64 text.
     * @returns {Uint8Array}
     */
    static #decodeBase64(value) {
        const normalized = String(value || '').replace(/\s+/gu, '')
        if (!normalized) {
            return new Uint8Array()
        }

        try {
            const binary = globalThis.atob(normalized)
            const bytes = new Uint8Array(binary.length)
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index)
            }
            return bytes
        } catch {
            return new Uint8Array()
        }
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

    /**
     * Removes undefined object fields.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) => entryValue !== undefined
            )
        )
    }
}
