import { unzlibSync } from 'fflate'
import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'

const MISSING_IMAGE_MESSAGE =
    'Embedded schematic image payload could not be resolved for '

/**
 * Recovers Altium schematic image payloads from packed OLE Storage entries.
 */
export class AltiumSchematicPackedImageResolver {
    /**
     * Hydrates missing embedded schematic images from the source SchDoc buffer.
     * @param {object} documentModel Parsed Altium document model.
     * @param {ArrayBuffer} arrayBuffer Source SchDoc buffer.
     * @returns {object}
     */
    static hydrate(documentModel, arrayBuffer) {
        const images = Array.isArray(documentModel?.schematic?.images)
            ? documentModel.schematic.images
            : []
        const missingImages = images.filter((image) =>
            AltiumSchematicPackedImageResolver.#shouldHydrateImage(image)
        )
        if (!missingImages.length) {
            return documentModel
        }

        const storageBytes =
            AltiumSchematicPackedImageResolver.#readStorageBytes(arrayBuffer)
        if (!storageBytes) {
            return documentModel
        }

        const resolvedFileNames = []
        for (const image of missingImages) {
            const imageBytes =
                AltiumSchematicPackedImageResolver.#resolvePackedImageBytes(
                    storageBytes,
                    image.fileName
                )
            if (!imageBytes) {
                continue
            }

            image.mimeType = AltiumSchematicPackedImageResolver.#detectMimeType(
                imageBytes,
                image.fileName
            )
            image.dataBase64 =
                AltiumSchematicPackedImageResolver.#encodeBase64(imageBytes)
            image.diagnosticState = 'embedded'
            resolvedFileNames.push(String(image.fileName || ''))
        }

        if (resolvedFileNames.length) {
            AltiumSchematicPackedImageResolver.#removeResolvedDiagnostics(
                documentModel,
                resolvedFileNames
            )
        }

        return documentModel
    }

    /**
     * Returns whether one image needs packed-storage recovery.
     * @param {object} image Normalized schematic image placement.
     * @returns {boolean}
     */
    static #shouldHydrateImage(image) {
        return (
            image?.embedded === true &&
            !image?.dataBase64 &&
            !image?.mimeType &&
            String(image?.fileName || '').trim() &&
            String(image?.diagnosticState || '') === 'missing-embedded-payload'
        )
    }

    /**
     * Reads the Altium packed image Storage stream from a SchDoc container.
     * @param {ArrayBuffer} arrayBuffer Source SchDoc buffer.
     * @returns {Uint8Array | null}
     */
    static #readStorageBytes(arrayBuffer) {
        try {
            return OleCompoundDocument.fromArrayBuffer(arrayBuffer).getStream(
                'Storage'
            )
        } catch (_error) {
            return null
        }
    }

    /**
     * Resolves decoded image bytes by exact path, normalized path, or basename.
     * @param {Uint8Array} storageBytes Packed Storage stream bytes.
     * @param {string} fileName Image file name from the schematic record.
     * @returns {Uint8Array | null}
     */
    static #resolvePackedImageBytes(storageBytes, fileName) {
        const candidates =
            AltiumSchematicPackedImageResolver.#buildPathCandidates(fileName)

        for (const candidate of candidates.exact) {
            const bytes =
                AltiumSchematicPackedImageResolver.#findPackedImageBytes(
                    storageBytes,
                    candidate,
                    false
                )
            if (bytes) {
                return bytes
            }
        }

        return AltiumSchematicPackedImageResolver.#findPackedImageBytes(
            storageBytes,
            candidates.basename,
            true
        )
    }

    /**
     * Builds direct and basename lookup candidates for one image path.
     * @param {string} fileName Image file name from the schematic record.
     * @returns {{ exact: string[], basename: string }}
     */
    static #buildPathCandidates(fileName) {
        const sourcePath = String(fileName || '').trim()
        const slashPath = sourcePath.replace(/\\+/gu, '/')
        const backslashPath = sourcePath.replace(/\/+/gu, '\\')
        const exact = [
            ...new Set([sourcePath, slashPath, backslashPath])
        ].filter(Boolean)

        return {
            exact,
            basename: slashPath.split('/').filter(Boolean).at(-1) || sourcePath
        }
    }

    /**
     * Finds a valid packed image payload after one path occurrence.
     * @param {Uint8Array} storageBytes Packed Storage stream bytes.
     * @param {string} needle Path text to search for.
     * @param {boolean} requireUnique Whether multiple valid matches are unsafe.
     * @returns {Uint8Array | null}
     */
    static #findPackedImageBytes(storageBytes, needle, requireUnique) {
        const normalizedNeedle = String(needle || '').toLowerCase()
        if (!normalizedNeedle) {
            return null
        }

        const storageText =
            AltiumSchematicPackedImageResolver.#decodeStorageText(storageBytes)
        const normalizedStorageText = storageText.toLowerCase()
        const matches = []
        let searchIndex = 0

        while (searchIndex < normalizedStorageText.length) {
            const matchIndex = normalizedStorageText.indexOf(
                normalizedNeedle,
                searchIndex
            )
            if (matchIndex < 0) {
                break
            }

            const imageBytes =
                AltiumSchematicPackedImageResolver.#decodePayloadAfterPath(
                    storageBytes,
                    matchIndex + normalizedNeedle.length
                )
            if (imageBytes) {
                matches.push(imageBytes)
            }
            searchIndex = matchIndex + Math.max(normalizedNeedle.length, 1)
        }

        if (requireUnique) {
            return matches.length === 1 ? matches[0] : null
        }

        return matches[0] || null
    }

    /**
     * Decodes a single-byte Storage stream as text for path lookup.
     * @param {Uint8Array} storageBytes Packed Storage stream bytes.
     * @returns {string}
     */
    static #decodeStorageText(storageBytes) {
        try {
            return new TextDecoder('windows-1252').decode(storageBytes)
        } catch (_error) {
            return new TextDecoder().decode(storageBytes)
        }
    }

    /**
     * Decodes a zlib image payload whose length follows the stored path.
     * @param {Uint8Array} storageBytes Packed Storage stream bytes.
     * @param {number} pathEndOffset Offset immediately after the path text.
     * @returns {Uint8Array | null}
     */
    static #decodePayloadAfterPath(storageBytes, pathEndOffset) {
        if (pathEndOffset + 6 > storageBytes.byteLength) {
            return null
        }

        const view = new DataView(
            storageBytes.buffer,
            storageBytes.byteOffset,
            storageBytes.byteLength
        )
        const compressedLength = view.getUint32(pathEndOffset, true)
        const compressedOffset = pathEndOffset + 4
        const compressedEnd = compressedOffset + compressedLength
        if (
            compressedLength <= 0 ||
            compressedEnd > storageBytes.byteLength ||
            !AltiumSchematicPackedImageResolver.#looksLikeZlibStream(
                storageBytes,
                compressedOffset
            )
        ) {
            return null
        }

        try {
            return AltiumSchematicPackedImageResolver.#normalizeImageBytes(
                unzlibSync(
                    storageBytes.subarray(compressedOffset, compressedEnd)
                )
            )
        } catch (_error) {
            return null
        }
    }

    /**
     * Checks whether bytes at one offset look like a zlib stream.
     * @param {Uint8Array} bytes Source bytes.
     * @param {number} offset Candidate stream offset.
     * @returns {boolean}
     */
    static #looksLikeZlibStream(bytes, offset) {
        if (offset + 2 > bytes.byteLength || bytes[offset] !== 0x78) {
            return false
        }

        return ((bytes[offset] << 8) + bytes[offset + 1]) % 31 === 0
    }

    /**
     * Trims decoded BMP payloads to their declared file size.
     * @param {Uint8Array} bytes Decoded image bytes.
     * @returns {Uint8Array}
     */
    static #normalizeImageBytes(bytes) {
        if (bytes.byteLength >= 6 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
            const declaredSize = new DataView(
                bytes.buffer,
                bytes.byteOffset,
                bytes.byteLength
            ).getUint32(2, true)
            if (declaredSize > 0 && declaredSize <= bytes.byteLength) {
                return bytes.subarray(0, declaredSize)
            }
        }

        return bytes
    }

    /**
     * Detects a browser-facing MIME type from image bytes.
     * @param {Uint8Array} bytes Image bytes.
     * @param {string} fileName Image file name.
     * @returns {string}
     */
    static #detectMimeType(bytes, fileName) {
        if (
            AltiumSchematicPackedImageResolver.#hasPrefix(bytes, [0x42, 0x4d])
        ) {
            return 'image/bmp'
        }
        if (
            AltiumSchematicPackedImageResolver.#hasPrefix(
                bytes,
                [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
            )
        ) {
            return 'image/png'
        }
        if (
            AltiumSchematicPackedImageResolver.#hasPrefix(
                bytes,
                [0xff, 0xd8, 0xff]
            )
        ) {
            return 'image/jpeg'
        }
        if (
            AltiumSchematicPackedImageResolver.#hasAsciiPrefix(
                bytes,
                'GIF87a'
            ) ||
            AltiumSchematicPackedImageResolver.#hasAsciiPrefix(bytes, 'GIF89a')
        ) {
            return 'image/gif'
        }
        if (
            AltiumSchematicPackedImageResolver.#hasAsciiPrefix(bytes, 'RIFF') &&
            AltiumSchematicPackedImageResolver.#hasAsciiAt(bytes, 'WEBP', 8)
        ) {
            return 'image/webp'
        }

        return AltiumSchematicPackedImageResolver.#inferMimeType(fileName)
    }

    /**
     * Checks whether bytes start with one numeric prefix.
     * @param {Uint8Array} bytes Source bytes.
     * @param {number[]} prefix Expected prefix bytes.
     * @returns {boolean}
     */
    static #hasPrefix(bytes, prefix) {
        return prefix.every((value, index) => bytes[index] === value)
    }

    /**
     * Checks whether bytes start with one ASCII token.
     * @param {Uint8Array} bytes Source bytes.
     * @param {string} text Expected ASCII text.
     * @returns {boolean}
     */
    static #hasAsciiPrefix(bytes, text) {
        return AltiumSchematicPackedImageResolver.#hasAsciiAt(bytes, text, 0)
    }

    /**
     * Checks whether bytes contain one ASCII token at an offset.
     * @param {Uint8Array} bytes Source bytes.
     * @param {string} text Expected ASCII text.
     * @param {number} offset Start offset.
     * @returns {boolean}
     */
    static #hasAsciiAt(bytes, text, offset) {
        return [...String(text || '')].every(
            (character, index) =>
                bytes[offset + index] === character.charCodeAt(0)
        )
    }

    /**
     * Infers a MIME type from a file extension as a last resort.
     * @param {string} fileName Source file name.
     * @returns {string}
     */
    static #inferMimeType(fileName) {
        const normalized = String(fileName || '').toLowerCase()
        if (normalized.endsWith('.png')) return 'image/png'
        if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
            return 'image/jpeg'
        }
        if (normalized.endsWith('.gif')) return 'image/gif'
        if (normalized.endsWith('.bmp')) return 'image/bmp'
        if (normalized.endsWith('.webp')) return 'image/webp'
        if (normalized.endsWith('.svg')) return 'image/svg+xml'
        return 'application/octet-stream'
    }

    /**
     * Encodes bytes into base64 in browser and Node runtimes.
     * @param {Uint8Array} bytes Source bytes.
     * @returns {string}
     */
    static #encodeBase64(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64')
        }

        let binary = ''
        const chunkSize = 0x8000
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(
                ...bytes.subarray(offset, offset + chunkSize)
            )
        }

        return btoa(binary)
    }

    /**
     * Removes stale missing-image diagnostics after successful recovery.
     * @param {object} documentModel Parsed Altium document model.
     * @param {string[]} resolvedFileNames Image file names that were resolved.
     * @returns {void}
     */
    static #removeResolvedDiagnostics(documentModel, resolvedFileNames) {
        if (!Array.isArray(documentModel?.diagnostics)) {
            return
        }

        documentModel.diagnostics = documentModel.diagnostics.filter(
            (diagnostic) =>
                !AltiumSchematicPackedImageResolver.#matchesResolvedDiagnostic(
                    diagnostic,
                    resolvedFileNames
                )
        )
    }

    /**
     * Returns whether one diagnostic belongs to a recovered image.
     * @param {object} diagnostic Parser diagnostic.
     * @param {string[]} resolvedFileNames Image file names that were resolved.
     * @returns {boolean}
     */
    static #matchesResolvedDiagnostic(diagnostic, resolvedFileNames) {
        const message = String(diagnostic?.message || '')
        if (!message.startsWith(MISSING_IMAGE_MESSAGE)) {
            return false
        }

        return resolvedFileNames.some((fileName) =>
            message.includes(String(fileName || ''))
        )
    }
}
