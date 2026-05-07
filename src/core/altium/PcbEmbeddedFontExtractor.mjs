// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzlibSync } from 'fflate'
import { PcbFontMetricsParser } from './PcbFontMetricsParser.mjs'

/**
 * Extracts zlib-compressed embedded font payloads from PCB compound streams.
 */
export class PcbEmbeddedFontExtractor {
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

        const compressedEnd = PcbEmbeddedFontExtractor.#findCompressedEnd(
            bytes,
            zlibOffset
        )
        if (compressedEnd <= zlibOffset) {
            return null
        }

        const compressedBytes = bytes.subarray(zlibOffset, compressedEnd)
        const payloadBytes = unzlibSync(compressedBytes)
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
            nextOffset: compressedEnd
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
     * Finds the smallest trailing offset that fully contains a zlib payload.
     * @param {Uint8Array} bytes
     * @param {number} zlibOffset
     * @returns {number}
     */
    static #findCompressedEnd(bytes, zlibOffset) {
        let low = zlibOffset + 2
        let high = bytes.byteLength

        while (low < high) {
            const midpoint = Math.floor((low + high) / 2)
            if (
                PcbEmbeddedFontExtractor.#canInflate(
                    bytes.subarray(zlibOffset, midpoint)
                )
            ) {
                high = midpoint
            } else {
                low = midpoint + 1
            }
        }

        return PcbEmbeddedFontExtractor.#canInflate(
            bytes.subarray(zlibOffset, low)
        )
            ? low
            : -1
    }

    /**
     * Returns true when one byte slice can be inflated as a complete zlib
     * stream.
     * @param {Uint8Array} bytes
     * @returns {boolean}
     */
    static #canInflate(bytes) {
        try {
            unzlibSync(bytes)
            return true
        } catch {
            return false
        }
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
        if (typeof btoa === 'function') {
            let binary = ''
            const chunkSize = 0x8000
            for (
                let offset = 0;
                offset < bytes.byteLength;
                offset += chunkSize
            ) {
                binary += String.fromCharCode(
                    ...bytes.subarray(offset, offset + chunkSize)
                )
            }
            return btoa(binary)
        }

        return Buffer.from(bytes).toString('base64')
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
