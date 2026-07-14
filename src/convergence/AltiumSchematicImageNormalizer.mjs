// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzlibSync } from 'fflate'

const MAX_SCANLINE_BYTES = 64 * 1024 * 1024
const MINIMUM_VISIBLE_ALPHA_COVERAGE = 0.01
const PNG_SIGNATURE = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
])

/**
 * Adapts historical native schematic-image payloads at the common API boundary.
 */
export class AltiumSchematicImageNormalizer {
    static #alphaCoverageCache = new WeakMap()

    /**
     * Returns a structurally shared document view with unusable historical
     * image payloads replaced by the existing missing-image state.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @returns {Record<string, any>} Original document or normalized view.
     */
    static normalize(documentModel) {
        const images = documentModel?.schematic?.images
        if (!Array.isArray(images) || !images.length) return documentModel

        const diagnostics = Array.isArray(documentModel.diagnostics)
            ? documentModel.diagnostics
            : []
        let normalizedImages = null
        const warnings = []

        for (let index = 0; index < images.length; index += 1) {
            const image = images[index]
            if (
                !AltiumSchematicImageNormalizer.#isInvisibleLegacyImage(image)
            ) {
                continue
            }

            if (!normalizedImages) normalizedImages = images.slice()
            normalizedImages[index] = {
                ...image,
                mimeType: '',
                dataBase64: '',
                diagnosticState: 'unusable-embedded-payload'
            }

            const warning =
                'Embedded schematic image payload is effectively invisible for ' +
                (String(image.fileName || '') || 'unnamed image') +
                '.'
            if (
                !AltiumSchematicImageNormalizer.#hasWarning(
                    diagnostics,
                    warning
                ) &&
                !warnings.some((diagnostic) => diagnostic.message === warning)
            ) {
                warnings.push({ severity: 'warning', message: warning })
            }
        }

        if (!normalizedImages) return documentModel

        return {
            ...documentModel,
            schematic: {
                ...documentModel.schematic,
                images: normalizedImages
            },
            diagnostics: warnings.length
                ? [...diagnostics, ...warnings]
                : documentModel.diagnostics
        }
    }

    /**
     * Returns true only for the precise historical BMP-to-PNG representation
     * whose decoded alpha coverage is below one percent.
     * @param {Record<string, any>} image Native schematic-image row.
     * @returns {boolean} Whether the payload should become a placeholder.
     */
    static #isInvisibleLegacyImage(image) {
        if (
            !image ||
            typeof image !== 'object' ||
            String(image.sourceMimeType || '').toLowerCase() !== 'image/bmp' ||
            String(image.mimeType || '').toLowerCase() !== 'image/png' ||
            image.hasAlpha !== true ||
            String(image.nativeClass || '') !== '' ||
            typeof image.dataBase64 !== 'string' ||
            !image.dataBase64
        ) {
            return false
        }

        const alphaCoverage =
            AltiumSchematicImageNormalizer.#historicalPngAlphaCoverage(image)
        return (
            alphaCoverage !== null &&
            alphaCoverage < MINIMUM_VISIBLE_ALPHA_COVERAGE
        )
    }

    /**
     * Decodes a historical parser-generated PNG and measures normalized alpha.
     * Unknown, malformed, or differently encoded PNG payloads are rejected.
     * @param {Record<string, any>} image Native schematic-image row.
     * @returns {number | null} Normalized alpha coverage or null.
     */
    static #historicalPngAlphaCoverage(image) {
        const cached =
            AltiumSchematicImageNormalizer.#alphaCoverageCache.get(image)
        if (cached?.dataBase64 === image.dataBase64) return cached.coverage

        const coverage =
            AltiumSchematicImageNormalizer.#decodeHistoricalPngAlphaCoverage(
                image.dataBase64
            )
        AltiumSchematicImageNormalizer.#alphaCoverageCache.set(image, {
            dataBase64: image.dataBase64,
            coverage
        })
        return coverage
    }

    /**
     * Parses the exact minimal RGBA8 PNG structure emitted by the historical
     * parser and computes its alpha coverage.
     * @param {string} dataBase64 Base64-encoded PNG bytes.
     * @returns {number | null} Normalized alpha coverage or null.
     */
    static #decodeHistoricalPngAlphaCoverage(dataBase64) {
        const png = AltiumSchematicImageNormalizer.#decodeBase64(dataBase64)
        if (!png || !AltiumSchematicImageNormalizer.#hasPngSignature(png)) {
            return null
        }

        const parsed = AltiumSchematicImageNormalizer.#parseHistoricalPng(png)
        if (!parsed) return null

        const scanlineLength = parsed.width * 4 + 1
        const expectedLength = scanlineLength * parsed.height
        if (
            !Number.isSafeInteger(expectedLength) ||
            expectedLength <= 0 ||
            expectedLength > MAX_SCANLINE_BYTES ||
            !AltiumSchematicImageNormalizer.#isHistoricalStoredZlib(
                parsed.idat,
                expectedLength
            )
        ) {
            return null
        }

        let raw
        try {
            raw = unzlibSync(parsed.idat, {
                out: new Uint8Array(expectedLength)
            })
        } catch {
            return null
        }
        if (
            raw.length !== expectedLength ||
            !AltiumSchematicImageNormalizer.#hasValidAdler32(parsed.idat, raw)
        ) {
            return null
        }

        let alphaTotal = 0
        for (let y = 0; y < parsed.height; y += 1) {
            const rowOffset = y * scanlineLength
            if (raw[rowOffset] !== 0) return null
            for (let x = 0; x < parsed.width; x += 1) {
                alphaTotal += raw[rowOffset + 1 + x * 4 + 3]
            }
        }
        return alphaTotal / (parsed.width * parsed.height * 255)
    }

    /**
     * Parses an exact IHDR, IDAT, IEND PNG sequence and validates chunk CRCs.
     * @param {Uint8Array} png PNG bytes.
     * @returns {{ width: number, height: number, idat: Uint8Array } | null} Parsed PNG facts.
     */
    static #parseHistoricalPng(png) {
        const chunks = []
        let offset = PNG_SIGNATURE.length

        while (offset + 12 <= png.length) {
            const view = new DataView(
                png.buffer,
                png.byteOffset + offset,
                png.length - offset
            )
            const length = view.getUint32(0, false)
            const chunkEnd = offset + 12 + length
            if (chunkEnd > png.length) return null

            const typeBytes = png.subarray(offset + 4, offset + 8)
            const type = String.fromCharCode(...typeBytes)
            const data = png.subarray(offset + 8, offset + 8 + length)
            const expectedCrc = new DataView(
                png.buffer,
                png.byteOffset + offset + 8 + length,
                4
            ).getUint32(0, false)
            if (
                AltiumSchematicImageNormalizer.#crc32(typeBytes, data) !==
                expectedCrc
            ) {
                return null
            }

            chunks.push({ type, data })
            offset = chunkEnd
            if (type === 'IEND') break
        }

        if (
            offset !== png.length ||
            chunks.length !== 3 ||
            chunks[0].type !== 'IHDR' ||
            chunks[1].type !== 'IDAT' ||
            chunks[2].type !== 'IEND' ||
            chunks[0].data.length !== 13 ||
            chunks[2].data.length !== 0
        ) {
            return null
        }

        const header = chunks[0].data
        const headerView = new DataView(
            header.buffer,
            header.byteOffset,
            header.byteLength
        )
        const width = headerView.getUint32(0, false)
        const height = headerView.getUint32(4, false)
        if (
            width <= 0 ||
            height <= 0 ||
            header[8] !== 8 ||
            header[9] !== 6 ||
            header[10] !== 0 ||
            header[11] !== 0 ||
            header[12] !== 0
        ) {
            return null
        }

        return { width, height, idat: chunks[1].data }
    }

    /**
     * Validates the zlib stored-block layout emitted by the historical parser
     * before allocating or inflating its payload.
     * @param {Uint8Array} zlib Zlib stream.
     * @param {number} expectedLength Expected raw byte count.
     * @returns {boolean} Whether the stream has the exact safe stored layout.
     */
    static #isHistoricalStoredZlib(zlib, expectedLength) {
        if (zlib.length < 11 || zlib[0] !== 0x78 || zlib[1] !== 0x01) {
            return false
        }

        const payloadEnd = zlib.length - 4
        let offset = 2
        let decodedLength = 0
        let finalBlock = false

        while (!finalBlock && offset + 5 <= payloadEnd) {
            const header = zlib[offset]
            if (header !== 0x00 && header !== 0x01) return false
            finalBlock = header === 0x01

            const length = zlib[offset + 1] | (zlib[offset + 2] << 8)
            const complement = zlib[offset + 3] | (zlib[offset + 4] << 8)
            if ((length ^ complement) !== 0xffff) return false

            offset += 5
            if (offset + length > payloadEnd) return false
            decodedLength += length
            if (decodedLength > expectedLength) return false
            offset += length
        }

        return (
            finalBlock &&
            offset === payloadEnd &&
            decodedLength === expectedLength
        )
    }

    /**
     * Validates decompressed bytes against the zlib stream's big-endian
     * Adler-32 trailer.
     * @param {Uint8Array} zlib Complete zlib stream.
     * @param {Uint8Array} raw Decompressed bytes.
     * @returns {boolean} Whether the checksum is valid.
     */
    static #hasValidAdler32(zlib, raw) {
        if (!(zlib instanceof Uint8Array) || zlib.length < 4) return false
        const trailerOffset = zlib.length - 4
        const expected = new DataView(
            zlib.buffer,
            zlib.byteOffset + trailerOffset,
            4
        ).getUint32(0, false)
        return AltiumSchematicImageNormalizer.#adler32(raw) === expected
    }

    /**
     * Computes an Adler-32 checksum without external runtime dependencies.
     * @param {Uint8Array} bytes Bytes to checksum.
     * @returns {number} Unsigned Adler-32 value.
     */
    static #adler32(bytes) {
        let a = 1
        let b = 0
        let offset = 0

        while (offset < bytes.length) {
            const end = Math.min(offset + 5552, bytes.length)
            for (; offset < end; offset += 1) {
                a += bytes[offset]
                b += a
            }
            a %= 65521
            b %= 65521
        }

        return ((b << 16) | a) >>> 0
    }

    /**
     * Decodes base64 without depending on Node-only globals.
     * @param {string} dataBase64 Base64 text.
     * @returns {Uint8Array | null} Decoded bytes or null.
     */
    static #decodeBase64(dataBase64) {
        if (dataBase64.length > Math.ceil((MAX_SCANLINE_BYTES * 4) / 3) + 128) {
            return null
        }
        try {
            const binary = globalThis.atob(dataBase64)
            const bytes = new Uint8Array(binary.length)
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index)
            }
            return bytes
        } catch {
            return null
        }
    }

    /**
     * Checks the fixed PNG signature.
     * @param {Uint8Array} bytes Candidate bytes.
     * @returns {boolean} Whether the signature matches.
     */
    static #hasPngSignature(bytes) {
        if (bytes.length < PNG_SIGNATURE.length) return false
        return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
    }

    /**
     * Computes a PNG chunk CRC over its type and data bytes.
     * @param {Uint8Array} typeBytes Four-byte chunk type.
     * @param {Uint8Array} data Chunk data.
     * @returns {number} Unsigned CRC-32.
     */
    static #crc32(typeBytes, data) {
        let crc = 0xffffffff
        for (const bytes of [typeBytes, data]) {
            for (const byte of bytes) {
                crc ^= byte
                for (let bit = 0; bit < 8; bit += 1) {
                    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
                }
            }
        }
        return (crc ^ 0xffffffff) >>> 0
    }

    /**
     * Checks whether a warning already exists without changing diagnostic rows.
     * @param {Record<string, any>[] | undefined} diagnostics Native diagnostics.
     * @param {string} warning Warning text.
     * @returns {boolean} Whether the warning already exists.
     */
    static #hasWarning(diagnostics, warning) {
        return (
            Array.isArray(diagnostics) &&
            diagnostics.some((diagnostic) => diagnostic?.message === warning)
        )
    }
}

Object.freeze(AltiumSchematicImageNormalizer.prototype)
Object.freeze(AltiumSchematicImageNormalizer)
