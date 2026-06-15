// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzlibSync } from 'fflate'
import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Extracts schematic preview thumbnail payloads from OLE-backed schematics.
 */
export class SchematicThumbnailParser {
    /**
     * Parses thumbnail metadata from a schematic document buffer.
     * @param {ArrayBuffer} arrayBuffer Source file bytes.
     * @returns {{ thumbnails: object[], diagnostics: object[] }}
     */
    static parse(arrayBuffer) {
        let oleDocument

        try {
            oleDocument = OleCompoundDocument.fromArrayBuffer(arrayBuffer)
        } catch {
            return { thumbnails: [], diagnostics: [] }
        }

        return SchematicThumbnailParser.parseOleDocument(oleDocument)
    }

    /**
     * Parses thumbnail metadata from an OLE compound document.
     * @param {OleCompoundDocument} oleDocument Parsed OLE document.
     * @returns {{ thumbnails: object[], diagnostics: object[] }}
     */
    static parseOleDocument(oleDocument) {
        const diagnostics = []
        const thumbnails = []

        for (const streamName of oleDocument.listStreams()) {
            if (!SchematicThumbnailParser.#isPreviewStream(streamName)) {
                continue
            }

            const thumbnail = SchematicThumbnailParser.#parsePreviewStream(
                streamName,
                oleDocument.getStream(streamName),
                diagnostics
            )
            if (thumbnail) {
                thumbnails.push(thumbnail)
            }
        }

        return { thumbnails, diagnostics }
    }

    /**
     * Returns true when one stream name can contain schematic preview data.
     * @param {string} streamName OLE stream path.
     * @returns {boolean}
     */
    static #isPreviewStream(streamName) {
        return (
            String(streamName || '')
                .split('/')
                .at(-1)
                ?.toLowerCase() === 'preview'
        )
    }

    /**
     * Parses one preview stream.
     * @param {string} sourceStream OLE stream path.
     * @param {Uint8Array} bytes Stream bytes.
     * @param {object[]} diagnostics Diagnostic sink.
     * @returns {object | null}
     */
    static #parsePreviewStream(sourceStream, bytes, diagnostics) {
        const fields = SchematicThumbnailParser.#parsePreviewFields(bytes)
        const width = SchematicThumbnailParser.#positiveInteger(
            fields.LargeImageWidth
        )
        const height = SchematicThumbnailParser.#positiveInteger(
            fields.LargeImageHeight
        )
        const compressedBytes = SchematicThumbnailParser.#hexToBytes(
            fields.LargeImage
        )

        if (!width || !height || !compressedBytes) {
            diagnostics.push(
                SchematicThumbnailParser.#diagnostic(
                    sourceStream,
                    'schematic.thumbnail.preview-metadata',
                    'Schematic preview metadata was incomplete.'
                )
            )
            return null
        }

        let pixelBytes
        try {
            pixelBytes = unzlibSync(compressedBytes)
        } catch {
            diagnostics.push(
                SchematicThumbnailParser.#diagnostic(
                    sourceStream,
                    'schematic.thumbnail.preview-zlib',
                    'Schematic preview thumbnail payload could not be decompressed.'
                )
            )
            return null
        }

        if (pixelBytes.length < width * height * 4) {
            diagnostics.push(
                SchematicThumbnailParser.#diagnostic(
                    sourceStream,
                    'schematic.thumbnail.preview-size',
                    'Schematic preview thumbnail payload was shorter than its declared dimensions.'
                )
            )
            return null
        }

        return {
            kind: 'large-preview',
            width,
            height,
            mimeType: 'image/png',
            dataBase64: SchematicThumbnailParser.#encodeBase64(
                SchematicThumbnailParser.#encodePreviewPng(
                    width,
                    height,
                    pixelBytes
                )
            ),
            sourceStream,
            pixelFormat: 'bgra32'
        }
    }

    /**
     * Parses key-value fields from the `[Preview]` section.
     * @param {Uint8Array} bytes Stream bytes.
     * @returns {Record<string, string>}
     */
    static #parsePreviewFields(bytes) {
        const text = new TextDecoder('windows-1252').decode(bytes)
        const fields = {}
        let inPreviewSection = false

        for (const rawLine of text.split(/\r?\n/u)) {
            const line = rawLine.trim()
            if (!line || line.startsWith(';') || line.startsWith('#')) {
                continue
            }

            const sectionMatch = line.match(/^\[([^\]]+)\]$/u)
            if (sectionMatch) {
                inPreviewSection =
                    sectionMatch[1].trim().toLowerCase() === 'preview'
                continue
            }

            if (!inPreviewSection) {
                continue
            }

            const separatorIndex = line.indexOf('=')
            if (separatorIndex <= 0) {
                continue
            }

            fields[line.slice(0, separatorIndex).trim()] = line
                .slice(separatorIndex + 1)
                .trim()
        }

        return fields
    }

    /**
     * Parses a positive integer field.
     * @param {string | undefined} value Raw value.
     * @returns {number | null}
     */
    static #positiveInteger(value) {
        const parsed = Number.parseInt(String(value || ''), 10)
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null
    }

    /**
     * Decodes a hexadecimal byte string.
     * @param {string | undefined} value Hexadecimal payload.
     * @returns {Uint8Array | null}
     */
    static #hexToBytes(value) {
        const hex = String(value || '').replace(/\s+/gu, '')
        if (!hex || hex.length % 2 || /[^0-9a-f]/iu.test(hex)) {
            return null
        }

        const bytes = new Uint8Array(hex.length / 2)
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Number.parseInt(
                hex.slice(index * 2, index * 2 + 2),
                16
            )
        }

        return bytes
    }

    /**
     * Encodes BGRX/BGRA preview pixels into a PNG payload.
     * @param {number} width Pixel width.
     * @param {number} height Pixel height.
     * @param {Uint8Array} pixels Source pixels.
     * @returns {Uint8Array}
     */
    static #encodePreviewPng(width, height, pixels) {
        const rowStride = width * 4
        const raw = new Uint8Array((rowStride + 1) * height)

        for (let y = 0; y < height; y += 1) {
            const sourceY = height - y - 1
            const rowOffset = y * (rowStride + 1)
            raw[rowOffset] = 0

            for (let x = 0; x < width; x += 1) {
                const sourceOffset = (sourceY * width + x) * 4
                const targetOffset = rowOffset + 1 + x * 4
                raw[targetOffset] = pixels[sourceOffset + 2]
                raw[targetOffset + 1] = pixels[sourceOffset + 1]
                raw[targetOffset + 2] = pixels[sourceOffset]
                raw[targetOffset + 3] = pixels[sourceOffset + 3] || 255
            }
        }

        return SchematicThumbnailParser.#concatByteArrays([
            Uint8Array.from(PNG_SIGNATURE),
            SchematicThumbnailParser.#pngChunk(
                'IHDR',
                SchematicThumbnailParser.#pngHeader(width, height)
            ),
            SchematicThumbnailParser.#pngChunk(
                'IDAT',
                SchematicThumbnailParser.#zlibStore(raw)
            ),
            SchematicThumbnailParser.#pngChunk('IEND', new Uint8Array())
        ])
    }

    /**
     * Builds PNG IHDR chunk data.
     * @param {number} width Pixel width.
     * @param {number} height Pixel height.
     * @returns {Uint8Array}
     */
    static #pngHeader(width, height) {
        const header = new Uint8Array(13)
        const view = new DataView(header.buffer)

        view.setUint32(0, width, false)
        view.setUint32(4, height, false)
        header[8] = 8
        header[9] = 6

        return header
    }

    /**
     * Builds one PNG chunk.
     * @param {string} type Four-byte chunk type.
     * @param {Uint8Array} data Chunk data.
     * @returns {Uint8Array}
     */
    static #pngChunk(type, data) {
        const typeBytes = new TextEncoder().encode(type)
        const chunk = new Uint8Array(12 + data.length)
        const view = new DataView(chunk.buffer)

        view.setUint32(0, data.length, false)
        chunk.set(typeBytes, 4)
        chunk.set(data, 8)
        view.setUint32(
            8 + data.length,
            SchematicThumbnailParser.#crc32(
                SchematicThumbnailParser.#concatByteArrays([typeBytes, data])
            ),
            false
        )

        return chunk
    }

    /**
     * Encodes raw scanlines as a stored zlib stream.
     * @param {Uint8Array} bytes Raw scanline bytes.
     * @returns {Uint8Array}
     */
    static #zlibStore(bytes) {
        const blockCount = Math.max(1, Math.ceil(bytes.length / 65535))
        const output = new Uint8Array(2 + blockCount * 5 + bytes.length + 4)
        const view = new DataView(output.buffer)
        let outputOffset = 0
        let inputOffset = 0

        output[outputOffset] = 0x78
        output[outputOffset + 1] = 0x01
        outputOffset += 2

        for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
            const remaining = bytes.length - inputOffset
            const blockLength = Math.min(remaining, 65535)
            output[outputOffset] = blockIndex === blockCount - 1 ? 0x01 : 0x00
            view.setUint16(outputOffset + 1, blockLength, true)
            view.setUint16(outputOffset + 3, 0xffff ^ blockLength, true)
            outputOffset += 5
            output.set(
                bytes.slice(inputOffset, inputOffset + blockLength),
                outputOffset
            )
            outputOffset += blockLength
            inputOffset += blockLength
        }

        view.setUint32(
            outputOffset,
            SchematicThumbnailParser.#adler32(bytes),
            false
        )

        return output
    }

    /**
     * Computes an Adler-32 checksum.
     * @param {Uint8Array} bytes Bytes to checksum.
     * @returns {number}
     */
    static #adler32(bytes) {
        let a = 1
        let b = 0

        for (const byte of bytes) {
            a = (a + byte) % 65521
            b = (b + a) % 65521
        }

        return ((b << 16) | a) >>> 0
    }

    /**
     * Computes a PNG-compatible CRC-32 checksum.
     * @param {Uint8Array} bytes Bytes to checksum.
     * @returns {number}
     */
    static #crc32(bytes) {
        let crc = 0xffffffff

        for (const byte of bytes) {
            crc ^= byte
            for (let bit = 0; bit < 8; bit += 1) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
            }
        }

        return (crc ^ 0xffffffff) >>> 0
    }

    /**
     * Concatenates byte arrays.
     * @param {Uint8Array[]} chunks Byte arrays.
     * @returns {Uint8Array}
     */
    static #concatByteArrays(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const output = new Uint8Array(totalLength)
        let offset = 0

        for (const chunk of chunks) {
            output.set(chunk, offset)
            offset += chunk.length
        }

        return output
    }

    /**
     * Encodes one byte array as base64 in browser and Node runtimes.
     * @param {Uint8Array} bytes Source bytes.
     * @returns {string}
     */
    static #encodeBase64(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64')
        }

        let binary = ''
        for (const byte of bytes) {
            binary += String.fromCharCode(byte)
        }

        return btoa(binary)
    }

    /**
     * Builds one parser diagnostic.
     * @param {string} sourceStream Source stream name.
     * @param {string} code Stable diagnostic code.
     * @param {string} message User-facing diagnostic message.
     * @returns {{ code: string, severity: string, sourceStream: string, message: string }}
     */
    static #diagnostic(sourceStream, code, message) {
        return {
            code,
            severity: 'warning',
            sourceStream,
            message
        }
    }
}
