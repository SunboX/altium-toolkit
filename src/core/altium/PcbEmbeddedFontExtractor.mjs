// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { Unzlib } from 'fflate'
import { PcbFontMetricsParser } from './PcbFontMetricsParser.mjs'

/**
 * Extracts zlib-compressed embedded font payloads from PCB compound streams.
 */
export class PcbEmbeddedFontExtractor {
    static #BASE64_ALPHABET =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

    static #CANDIDATE_STREAM_NAMES = [
        'EmbeddedFonts6/Data',
        'EmbeddedFonts/Data',
        'Library/EmbeddedFonts'
    ]

    /**
     * Extracts embedded fonts from known PcbDoc and PcbLib stream names.
     * @param {Map<string, Uint8Array>} streams
     * @returns {{ fonts: { index: number, name: string, style: string, fileName: string, sourceStream: string, format: string, mimeType: string, byteCount: number, compressedByteCount: number, payloadBase64: string, metrics: Record<string, number | string> }[] }}
     */
    static extractFromStreams(streams) {
        const fonts = []

        for (const streamName of PcbEmbeddedFontExtractor
            .#CANDIDATE_STREAM_NAMES) {
            const bytes = streams.get(streamName)
            if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
                continue
            }

            fonts.push(
                ...PcbEmbeddedFontExtractor.extractFromBytes(bytes, streamName)
            )
        }

        return {
            fonts: PcbEmbeddedFontExtractor.#dedupeFonts(fonts).map(
                (font, index) => ({
                    ...font,
                    index
                })
            )
        }
    }

    /**
     * Extracts embedded fonts from one raw EmbeddedFonts stream.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @param {string} [sourceStream]
     * @returns {{ index: number, name: string, style: string, fileName: string, sourceStream: string, format: string, mimeType: string, byteCount: number, compressedByteCount: number, payloadBase64: string, metrics: Record<string, number | string> }[]}
     */
    static extractFromBytes(bytes, sourceStream = 'EmbeddedFonts6/Data') {
        const normalizedBytes = PcbEmbeddedFontExtractor.#toUint8Array(bytes)
        const fonts = []
        let offset = 0

        while (offset < normalizedBytes.byteLength) {
            const record = PcbEmbeddedFontExtractor.#readFontRecordAt(
                normalizedBytes,
                offset,
                sourceStream,
                fonts.length
            )

            if (!record) {
                break
            }

            fonts.push(record.font)
            offset = record.nextOffset
        }

        return fonts
    }

    /**
     * Reads one embedded-font record at the current stream offset.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {string} sourceStream
     * @param {number} index
     * @returns {{ font: { index: number, name: string, style: string, fileName: string, sourceStream: string, format: string, mimeType: string, byteCount: number, compressedByteCount: number, payloadBase64: string, metrics: Record<string, number | string> }, nextOffset: number } | null}
     */
    static #readFontRecordAt(bytes, offset, sourceStream, index) {
        const familyField = PcbEmbeddedFontExtractor.#readUtf16FieldAt(
            bytes,
            offset
        )
        if (!familyField) {
            return null
        }

        const alternateField = PcbEmbeddedFontExtractor.#readUtf16FieldAt(
            bytes,
            familyField.nextOffset
        )
        const styleField = alternateField
            ? PcbEmbeddedFontExtractor.#readUtf16FieldAt(
                  bytes,
                  alternateField.nextOffset
              )
            : null
        if (!alternateField || !styleField) {
            return null
        }

        const zlibOffset = PcbEmbeddedFontExtractor.#findZlibHeaderOffset(
            bytes,
            styleField.nextOffset
        )
        if (zlibOffset < 0) {
            return null
        }

        const payload = PcbEmbeddedFontExtractor.#inflateZlibPayloadAt(
            bytes,
            zlibOffset
        )
        if (!payload) {
            return null
        }

        const compressedBytes = bytes.subarray(
            zlibOffset,
            payload.compressedEnd
        )
        const payloadBytes = payload.bytes
        const metadata = PcbEmbeddedFontExtractor.#normalizeFontMetadata(
            familyField.text,
            alternateField.text,
            styleField.text
        )
        const metrics = PcbFontMetricsParser.parse(payloadBytes)

        return {
            font: {
                index,
                name: metadata.name,
                style: metadata.style,
                fileName: PcbEmbeddedFontExtractor.#buildFileName(
                    metadata.name,
                    metadata.style
                ),
                sourceStream,
                format: metrics.format || 'unknown',
                mimeType: PcbEmbeddedFontExtractor.#resolveMimeType(
                    metrics.format
                ),
                byteCount: payloadBytes.byteLength,
                compressedByteCount: compressedBytes.byteLength,
                payloadBase64:
                    PcbEmbeddedFontExtractor.#bytesToBase64(payloadBytes),
                metrics
            },
            nextOffset: payload.compressedEnd
        }
    }

    /**
     * Reads one little-endian length-prefixed UTF-16LE string field.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {{ text: string, nextOffset: number } | null}
     */
    static #readUtf16FieldAt(bytes, offset) {
        if (offset + 4 > bytes.byteLength) {
            return null
        }

        const byteLength = new DataView(
            bytes.buffer,
            bytes.byteOffset + offset,
            4
        ).getUint32(0, true)
        const textOffset = offset + 4
        const textEnd = textOffset + byteLength

        if (byteLength < 0 || textEnd > bytes.byteLength) {
            return null
        }

        return {
            text: new TextDecoder('utf-16le')
                .decode(bytes.subarray(textOffset, textEnd))
                .replace(/\u0000+$/gu, '')
                .trim(),
            nextOffset: textEnd
        }
    }

    /**
     * Finds a zlib stream header shortly after the font metadata fields.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static #findZlibHeaderOffset(bytes, offset) {
        const end = Math.min(bytes.byteLength - 1, offset + 256)

        for (let cursor = offset; cursor < end; cursor += 1) {
            if (
                PcbEmbeddedFontExtractor.#isLikelyZlibHeader(
                    bytes[cursor],
                    bytes[cursor + 1]
                )
            ) {
                return cursor
            }
        }

        return -1
    }

    /**
     * Returns true when two bytes look like a zlib header.
     * @param {number} compressionMethod
     * @param {number} flags
     * @returns {boolean}
     */
    static #isLikelyZlibHeader(compressionMethod, flags) {
        return (
            (Number(compressionMethod) & 0x0f) === 8 &&
            ((Number(compressionMethod) << 8) + Number(flags)) % 31 === 0
        )
    }

    /**
     * Inflates one zlib payload and returns its exact stream boundary.
     * @param {Uint8Array} bytes
     * @param {number} zlibOffset
     * @returns {{ bytes: Uint8Array, compressedEnd: number } | null}
     */
    static #inflateZlibPayloadAt(bytes, zlibOffset) {
        const input = bytes.subarray(zlibOffset)
        const chunks = []
        let inflater

        try {
            inflater = new Unzlib((chunk) => {
                chunks.push(chunk)
            })
            inflater.push(input, false)
        } catch {
            return null
        }

        if (!Number(inflater?.s?.f || 0)) {
            return null
        }

        const payloadBytes = PcbEmbeddedFontExtractor.#concatBytes(chunks)
        const compressedByteCount =
            PcbEmbeddedFontExtractor.#resolveCompressedByteCount(
                input,
                inflater,
                payloadBytes
            )

        if (compressedByteCount <= 2) {
            return null
        }

        return {
            bytes: payloadBytes,
            compressedEnd: zlibOffset + compressedByteCount
        }
    }

    /**
     * Resolves the zlib stream length from fflate's remaining input buffer.
     * @param {Uint8Array} input
     * @param {Unzlib} inflater
     * @param {Uint8Array} payloadBytes
     * @returns {number}
     */
    static #resolveCompressedByteCount(input, inflater, payloadBytes) {
        const remainingByteCount = Number(inflater?.p?.byteLength || 0)
        if (remainingByteCount < 4) {
            return -1
        }

        const baseByteCount = input.byteLength - remainingByteCount + 4
        const checksum = PcbEmbeddedFontExtractor.#adler32(payloadBytes)

        // fflate can leave the final consumed deflate byte in `p` when the
        // stream ends mid-byte, so validate both adjacent boundary candidates.
        for (const compressedByteCount of [baseByteCount, baseByteCount + 1]) {
            if (
                PcbEmbeddedFontExtractor.#hasZlibChecksumAt(
                    input,
                    compressedByteCount,
                    checksum
                )
            ) {
                return compressedByteCount
            }
        }

        return -1
    }

    /**
     * Returns true when a candidate zlib boundary ends with the checksum.
     * @param {Uint8Array} input
     * @param {number} compressedByteCount
     * @param {number} checksum
     * @returns {boolean}
     */
    static #hasZlibChecksumAt(input, compressedByteCount, checksum) {
        if (compressedByteCount < 6 || compressedByteCount > input.byteLength) {
            return false
        }

        const checksumOffset = compressedByteCount - 4
        const actualChecksum = new DataView(
            input.buffer,
            input.byteOffset + checksumOffset,
            4
        ).getUint32(0, false)

        return actualChecksum === checksum
    }

    /**
     * Computes the Adler-32 checksum used by zlib trailers.
     * @param {Uint8Array} bytes
     * @returns {number}
     */
    static #adler32(bytes) {
        const modulo = 65521
        let low = 1
        let high = 0

        for (let offset = 0; offset < bytes.byteLength; offset += 5552) {
            const end = Math.min(offset + 5552, bytes.byteLength)
            for (let index = offset; index < end; index += 1) {
                low += bytes[index]
                high += low
            }
            low %= modulo
            high %= modulo
        }

        return ((high << 16) | low) >>> 0
    }

    /**
     * Concatenates inflated output chunks.
     * @param {Uint8Array[]} chunks
     * @returns {Uint8Array}
     */
    static #concatBytes(chunks) {
        if (chunks.length === 1) {
            return chunks[0]
        }

        const bytes = new Uint8Array(
            chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
        )
        let offset = 0

        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return bytes
    }

    /**
     * Normalizes family/style metadata from the embedded-font record fields.
     * @param {string} family
     * @param {string} alternateFamily
     * @param {string} explicitStyle
     * @returns {{ name: string, style: string }}
     */
    static #normalizeFontMetadata(family, alternateFamily, explicitStyle) {
        const inferredStyle =
            PcbEmbeddedFontExtractor.#normalizeStyle(explicitStyle) ||
            PcbEmbeddedFontExtractor.#inferStyle([family, alternateFamily])
        const alternate = String(alternateFamily || '').trim()
        const baseFamily = String(family || alternate || 'Embedded Font').trim()
        const name =
            alternate &&
            inferredStyle !== 'Regular' &&
            PcbEmbeddedFontExtractor.#nameContainsStyle(
                baseFamily,
                inferredStyle
            )
                ? alternate
                : baseFamily

        return {
            name: PcbEmbeddedFontExtractor.#trimStyleSuffix(
                name,
                inferredStyle
            ),
            style: inferredStyle
        }
    }

    /**
     * Normalizes a style field into one of the public style labels.
     * @param {string} style
     * @returns {'Regular' | 'Bold' | 'Italic' | 'Bold Italic' | ''}
     */
    static #normalizeStyle(style) {
        const normalized = String(style || '')
            .trim()
            .toLowerCase()

        if (!normalized || normalized === 'regular') {
            return ''
        }

        const isBold = normalized.includes('bold')
        const isItalic =
            normalized.includes('italic') || normalized.includes('oblique')

        if (isBold && isItalic) return 'Bold Italic'
        if (isBold) return 'Bold'
        if (isItalic) return 'Italic'

        return 'Regular'
    }

    /**
     * Infers a font style from family-name hints when the style field is empty.
     * @param {string[]} names
     * @returns {'Regular' | 'Bold' | 'Italic' | 'Bold Italic'}
     */
    static #inferStyle(names) {
        const normalized = names.join(' ').toLowerCase()
        const isBold = normalized.includes('bold')
        const isItalic =
            normalized.includes('italic') || normalized.includes('oblique')

        if (isBold && isItalic) return 'Bold Italic'
        if (isBold) return 'Bold'
        if (isItalic) return 'Italic'

        return 'Regular'
    }

    /**
     * Returns true when a family name already carries the style suffix.
     * @param {string} name
     * @param {string} style
     * @returns {boolean}
     */
    static #nameContainsStyle(name, style) {
        const normalizedName = String(name || '').toLowerCase()
        return String(style || '')
            .toLowerCase()
            .split(/\s+/u)
            .every((part) => normalizedName.includes(part))
    }

    /**
     * Removes an inferred style suffix from a family name.
     * @param {string} name
     * @param {string} style
     * @returns {string}
     */
    static #trimStyleSuffix(name, style) {
        if (style === 'Regular') {
            return name
        }

        const pattern = new RegExp(
            '\\s+' +
                String(style || '')
                    .trim()
                    .replace(/\s+/gu, '\\s+') +
                '$',
            'iu'
        )

        return String(name || 'Embedded Font')
            .replace(pattern, '')
            .trim()
    }

    /**
     * Creates a stable public filename for an embedded font payload.
     * @param {string} name
     * @param {string} style
     * @returns {string}
     */
    static #buildFileName(name, style) {
        const suffix =
            style && style !== 'Regular' ? '-' + style.replace(/\s+/gu, '') : ''
        return (
            String(name || 'Embedded Font')
                .replace(/[\\/:*?"<>|]/gu, '_')
                .trim() +
            suffix +
            '.ttf'
        )
    }

    /**
     * Resolves a browser-safe font MIME type.
     * @param {string | undefined} format
     * @returns {string}
     */
    static #resolveMimeType(format) {
        if (format === 'opentype') {
            return 'font/otf'
        }

        if (format === 'truetype') {
            return 'font/ttf'
        }

        return 'application/octet-stream'
    }

    /**
     * Deduplicates repeated font records.
     * @param {{ name: string, style: string, compressedByteCount: number, payloadBase64: string }[]} fonts
     * @returns {object[]}
     */
    static #dedupeFonts(fonts) {
        const seenKeys = new Set()
        const deduped = []

        for (const font of fonts) {
            const key = [
                font.name,
                font.style,
                font.compressedByteCount,
                font.payloadBase64
            ].join('\u0000')

            if (seenKeys.has(key)) {
                continue
            }

            seenKeys.add(key)
            deduped.push(font)
        }

        return deduped
    }

    /**
     * Encodes bytes as base64 in both browser and Node runtimes.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #bytesToBase64(bytes) {
        if (typeof Buffer === 'function' && typeof Buffer.from === 'function') {
            return Buffer.from(bytes).toString('base64')
        }

        return PcbEmbeddedFontExtractor.#bytesToBase64Portable(bytes)
    }

    /**
     * Encodes bytes as base64 without relying on Node APIs.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #bytesToBase64Portable(bytes) {
        const alphabet = PcbEmbeddedFontExtractor.#BASE64_ALPHABET
        const groupBuffer = new Array(4096)
        const outputChunks = []
        let groupIndex = 0
        let byteIndex = 0

        for (; byteIndex + 2 < bytes.byteLength; byteIndex += 3) {
            const value =
                (bytes[byteIndex] << 16) |
                (bytes[byteIndex + 1] << 8) |
                bytes[byteIndex + 2]
            groupBuffer[groupIndex] =
                alphabet[(value >> 18) & 63] +
                alphabet[(value >> 12) & 63] +
                alphabet[(value >> 6) & 63] +
                alphabet[value & 63]
            groupIndex += 1

            if (groupIndex === groupBuffer.length) {
                outputChunks.push(groupBuffer.join(''))
                groupIndex = 0
            }
        }

        if (byteIndex < bytes.byteLength) {
            const hasSecondByte = byteIndex + 1 < bytes.byteLength
            const value =
                (bytes[byteIndex] << 16) |
                ((hasSecondByte ? bytes[byteIndex + 1] : 0) << 8)
            groupBuffer[groupIndex] =
                alphabet[(value >> 18) & 63] +
                alphabet[(value >> 12) & 63] +
                (hasSecondByte ? alphabet[(value >> 6) & 63] : '=') +
                '='
            groupIndex += 1
        }

        if (groupIndex > 0) {
            outputChunks.push(groupBuffer.slice(0, groupIndex).join(''))
        }

        return outputChunks.join('')
    }

    /**
     * Normalizes byte-like input into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes || new ArrayBuffer(0))
    }
}
