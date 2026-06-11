// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzlibSync } from 'fflate'
import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'
import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils
const BMP_HEADER_LENGTH = 54
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_SCHEMA_MIME_TYPE = 'image/png'
const NATIVE_IMAGE_CLASS_MIME_TYPES = new Map([
    ['TdxPNGImage', 'image/png'],
    ['TPNGImage', 'image/png'],
    ['TJPEGImage', 'image/jpeg'],
    ['TJPGImage', 'image/jpeg'],
    ['TdxJPEGImage', 'image/jpeg'],
    ['TGIFImage', 'image/gif'],
    ['TdxGIFImage', 'image/gif'],
    ['TSVGImage', 'image/svg+xml'],
    ['TdxSVGImage', 'image/svg+xml'],
    ['TWebPImage', 'image/webp'],
    ['TdxWebPImage', 'image/webp']
])

/**
 * Normalizes embedded and external schematic image records.
 */
export class SchematicImageParser {
    /**
     * Parses schematic image records and resolves embedded payloads when the
     * file is an OLE container.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }[]} records
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ images: { x: number, y: number, cornerX: number, cornerY: number, fileName: string, embedded: boolean, keepAspect: boolean, mimeType: string, dataBase64: string, renderOrder: number, diagnosticState: string }[], diagnostics: { severity: 'info' | 'warning', message: string }[] }}
     */
    static parseSchematicImages(records, arrayBuffer) {
        const diagnostics = []
        const imageRecords = records.filter(
            (record) => getField(record.fields, 'RECORD') === '30'
        )
        let oleDocument = null

        if (
            imageRecords.some((record) =>
                SchematicImageParser.#isEmbedded(record.fields)
            )
        ) {
            try {
                oleDocument = OleCompoundDocument.fromArrayBuffer(arrayBuffer)
            } catch {
                oleDocument = null
            }
        }

        const packedStorageImages = oleDocument
            ? SchematicImageParser.#indexPackedStorageImages(oleDocument)
            : SchematicImageParser.#createPackedStorageImageIndex()
        const images = imageRecords
            .map((record) =>
                SchematicImageParser.#parseSchematicImageRecord(
                    record,
                    oleDocument,
                    packedStorageImages,
                    diagnostics
                )
            )
            .filter(Boolean)

        return { images, diagnostics }
    }

    /**
     * Returns true when one record requests an embedded image payload.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static #isEmbedded(fields) {
        return parseBoolean(fields.EmbedImage || fields.EMBEDIMAGE)
    }

    /**
     * Normalizes one image placement record.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }} record
     * @param {OleCompoundDocument | null} oleDocument
     * @param {{ byPath: Map<string, Uint8Array>, byBaseName: Map<string, Uint8Array | null> }} packedStorageImages
     * @param {{ severity: 'info' | 'warning', message: string }[]} diagnostics
     * @returns {{ x: number, y: number, cornerX: number, cornerY: number, fileName: string, embedded: boolean, keepAspect: boolean, mimeType: string, dataBase64: string, renderOrder: number, diagnosticState: string, ownerIndex?: string } | null}
     */
    static #parseSchematicImageRecord(
        record,
        oleDocument,
        packedStorageImages,
        diagnostics
    ) {
        const x = parseNumericField(record.fields, 'Location.X')
        const y = parseNumericField(record.fields, 'Location.Y')
        const cornerX = parseNumericField(record.fields, 'Corner.X')
        const cornerY = parseNumericField(record.fields, 'Corner.Y')

        if (x === null || y === null || cornerX === null || cornerY === null) {
            return null
        }

        const fileName =
            getField(record.fields, 'FileName') ||
            getField(record.fields, 'FILENAME')
        const embedded = SchematicImageParser.#isEmbedded(record.fields)
        const keepAspect = parseBoolean(
            record.fields.KeepAspect || record.fields.KEEPASPECT
        )
        const renderOrder =
            parseNumericField(record.fields, 'IndexInSheet') ??
            record.recordIndex
        let mimeType = ''
        let dataBase64 = ''
        let sourceMimeType = ''
        let nativeClass = ''
        let hasAlpha = false
        let diagnosticState = embedded ? 'missing-embedded-payload' : 'external'

        if (embedded && fileName && oleDocument) {
            const streamBytes = SchematicImageParser.#resolveEmbeddedImageBytes(
                fileName,
                oleDocument,
                packedStorageImages
            )

            if (streamBytes) {
                const decoded =
                    SchematicImageParser.#decodeEmbeddedImagePayload(
                        streamBytes,
                        fileName
                    )
                mimeType = decoded.mimeType
                sourceMimeType = decoded.sourceMimeType
                nativeClass = decoded.nativeClass
                hasAlpha = decoded.hasAlpha
                dataBase64 = SchematicImageParser.#encodeBase64(decoded.bytes)
                diagnosticState = 'embedded'
            } else {
                diagnostics.push({
                    severity: 'warning',
                    message:
                        'Embedded schematic image payload could not be resolved for ' +
                        fileName +
                        '.'
                })
            }
        } else if (embedded) {
            diagnostics.push({
                severity: 'warning',
                message:
                    'Embedded schematic image payload could not be resolved for ' +
                    (fileName || 'unnamed image') +
                    '.'
            })
        }

        const image = {
            x,
            y,
            cornerX,
            cornerY,
            fileName,
            embedded,
            keepAspect,
            mimeType,
            dataBase64,
            renderOrder,
            diagnosticState,
            ...(getField(record.fields, 'OwnerIndex')
                ? { ownerIndex: getField(record.fields, 'OwnerIndex') }
                : {})
        }

        if (sourceMimeType && sourceMimeType !== mimeType) {
            image.sourceMimeType = sourceMimeType
        }
        if (nativeClass) {
            image.nativeClass = nativeClass
        }
        if (hasAlpha) {
            image.hasAlpha = true
        }

        return image
    }

    /**
     * Resolves an embedded image payload from direct OLE streams or packed
     * Altium icon storage.
     * @param {string} fileName Image file name from the schematic record.
     * @param {OleCompoundDocument} oleDocument Parsed OLE container.
     * @param {{ byPath: Map<string, Uint8Array>, byBaseName: Map<string, Uint8Array | null> }} packedStorageImages
     * @returns {Uint8Array | null}
     */
    static #resolveEmbeddedImageBytes(
        fileName,
        oleDocument,
        packedStorageImages
    ) {
        try {
            return oleDocument.getStream(fileName)
        } catch {
            return SchematicImageParser.#findPackedStorageImage(
                fileName,
                packedStorageImages
            )
        }
    }

    /**
     * Creates an empty packed-storage image index.
     * @returns {{ byPath: Map<string, Uint8Array>, byBaseName: Map<string, Uint8Array | null> }}
     */
    static #createPackedStorageImageIndex() {
        return {
            byPath: new Map(),
            byBaseName: new Map()
        }
    }

    /**
     * Reads Altium's packed schematic image storage stream.
     * @param {OleCompoundDocument} oleDocument Parsed OLE container.
     * @returns {{ byPath: Map<string, Uint8Array>, byBaseName: Map<string, Uint8Array | null> }}
     */
    static #indexPackedStorageImages(oleDocument) {
        try {
            return SchematicImageParser.#parsePackedStorageImages(
                oleDocument.getStream('Storage')
            )
        } catch {
            return SchematicImageParser.#createPackedStorageImageIndex()
        }
    }

    /**
     * Parses Altium's compact icon-storage records into decoded image bytes.
     * @param {Uint8Array} bytes Packed storage stream bytes.
     * @returns {{ byPath: Map<string, Uint8Array>, byBaseName: Map<string, Uint8Array | null> }}
     */
    static #parsePackedStorageImages(bytes) {
        const index = SchematicImageParser.#createPackedStorageImageIndex()
        if (!(bytes instanceof Uint8Array) || bytes.byteLength < 16) {
            return index
        }

        const view = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
        )
        const headerLength = view.getUint32(0, true)
        if (headerLength <= 0 || 4 + headerLength > bytes.byteLength) {
            return index
        }

        const headerText = new TextDecoder('windows-1252').decode(
            bytes.subarray(4, 4 + headerLength)
        )
        if (!headerText.includes('Icon storage')) {
            return index
        }

        let offset = 4 + headerLength
        if (bytes[offset] === 0) {
            offset += 1
        }

        while (offset + 10 <= bytes.byteLength) {
            while (offset < bytes.byteLength && bytes[offset] === 0) {
                offset += 1
            }
            if (offset + 10 > bytes.byteLength) {
                break
            }

            const entryLength =
                bytes[offset] |
                (bytes[offset + 1] << 8) |
                (bytes[offset + 2] << 16)
            const parsedEntry =
                SchematicImageParser.#parsePackedStorageImageEntry(
                    bytes,
                    view,
                    offset
                )

            if (parsedEntry) {
                SchematicImageParser.#addPackedStorageImage(
                    index,
                    parsedEntry.fileName,
                    parsedEntry.bytes
                )
                offset = parsedEntry.nextOffset
                continue
            }

            offset += Math.max(entryLength + 3, 1)
        }

        return index
    }

    /**
     * Parses one packed icon-storage entry.
     * @param {Uint8Array} bytes Storage stream bytes.
     * @param {DataView} view Storage stream view.
     * @param {number} offset Entry offset.
     * @returns {{ fileName: string, bytes: Uint8Array, nextOffset: number } | null}
     */
    static #parsePackedStorageImageEntry(bytes, view, offset) {
        const entryStart = offset + 3
        if (entryStart + 3 > bytes.byteLength) {
            return null
        }

        const pathLength = bytes[entryStart + 2]
        const pathOffset = entryStart + 3
        const compressedLengthOffset = pathOffset + pathLength
        const compressedOffset = compressedLengthOffset + 4

        if (pathLength <= 0 || compressedLengthOffset + 4 > bytes.byteLength) {
            return null
        }

        const compressedLength = view.getUint32(compressedLengthOffset, true)
        const compressedEnd = compressedOffset + compressedLength
        if (
            compressedLength <= 0 ||
            compressedEnd > bytes.byteLength ||
            !SchematicImageParser.#looksLikeZlibStream(bytes, compressedOffset)
        ) {
            return null
        }

        try {
            return {
                fileName: SchematicImageParser.#decodePackedImagePath(
                    bytes.subarray(pathOffset, compressedLengthOffset)
                ),
                bytes: unzlibSync(
                    bytes.subarray(compressedOffset, compressedEnd)
                ),
                nextOffset: compressedEnd
            }
        } catch {
            return null
        }
    }

    /**
     * Adds one decoded image to path and unique-basename lookup indexes.
     * @param {{ byPath: Map<string, Uint8Array>, byBaseName: Map<string, Uint8Array | null> }} index Packed-storage index.
     * @param {string} fileName Image path.
     * @param {Uint8Array} bytes Image bytes.
     */
    static #addPackedStorageImage(index, fileName, bytes) {
        const normalizedPath =
            SchematicImageParser.#normalizeImageLookupPath(fileName)
        if (!normalizedPath) {
            return
        }

        index.byPath.set(normalizedPath, bytes)

        const baseName =
            SchematicImageParser.#imageLookupBaseName(normalizedPath)
        if (!baseName) {
            return
        }

        if (
            index.byBaseName.has(baseName) &&
            index.byBaseName.get(baseName) !== bytes
        ) {
            index.byBaseName.set(baseName, null)
            return
        }

        index.byBaseName.set(baseName, bytes)
    }

    /**
     * Finds one packed-storage image by full path or unique basename.
     * @param {string} fileName Requested image path.
     * @param {{ byPath: Map<string, Uint8Array>, byBaseName: Map<string, Uint8Array | null> }} index Packed-storage image index.
     * @returns {Uint8Array | null}
     */
    static #findPackedStorageImage(fileName, index) {
        const normalizedPath =
            SchematicImageParser.#normalizeImageLookupPath(fileName)
        if (!normalizedPath) {
            return null
        }

        const directMatch = index.byPath.get(normalizedPath)
        if (directMatch) {
            return directMatch
        }

        const baseName =
            SchematicImageParser.#imageLookupBaseName(normalizedPath)
        return index.byBaseName.get(baseName) || null
    }

    /**
     * Decodes a packed-storage path string.
     * @param {Uint8Array} bytes Path bytes.
     * @returns {string}
     */
    static #decodePackedImagePath(bytes) {
        return new TextDecoder('windows-1252')
            .decode(bytes)
            .replace(/\0+$/u, '')
    }

    /**
     * Checks whether bytes at an offset resemble a zlib stream.
     * @param {Uint8Array} bytes Source bytes.
     * @param {number} offset Candidate offset.
     * @returns {boolean}
     */
    static #looksLikeZlibStream(bytes, offset) {
        if (offset + 2 > bytes.byteLength || bytes[offset] !== 0x78) {
            return false
        }

        return ((bytes[offset] << 8) + bytes[offset + 1]) % 31 === 0
    }

    /**
     * Normalizes image paths for cross-platform lookup.
     * @param {string} fileName Image path.
     * @returns {string}
     */
    static #normalizeImageLookupPath(fileName) {
        return String(fileName || '')
            .replace(/\\+/gu, '/')
            .replace(/\/+/gu, '/')
            .toLowerCase()
    }

    /**
     * Returns the final path segment from a normalized image lookup path.
     * @param {string} normalizedPath Normalized path.
     * @returns {string}
     */
    static #imageLookupBaseName(normalizedPath) {
        const parts = normalizedPath.split('/')
        return parts[parts.length - 1] || ''
    }

    /**
     * Chooses the browser-facing image payload from one embedded stream.
     * @param {Uint8Array} bytes Embedded image stream bytes.
     * @param {string} fileName Image file name from the schematic record.
     * @returns {{ bytes: Uint8Array, mimeType: string, sourceMimeType: string, nativeClass: string, hasAlpha: boolean }}
     */
    static #decodeEmbeddedImagePayload(bytes, fileName) {
        const sourceMimeType =
            SchematicImageParser.#inferMimeType(fileName) ||
            SchematicImageParser.#detectMimeType(bytes)
        const bmpInfo = SchematicImageParser.#parseBmpInfo(bytes)
        const nativePayload = SchematicImageParser.#extractNativePayload(
            bytes,
            bmpInfo
        )

        if (nativePayload) {
            return {
                bytes: nativePayload.bytes,
                mimeType: nativePayload.mimeType,
                sourceMimeType,
                nativeClass: nativePayload.nativeClass,
                hasAlpha: false
            }
        }

        if (
            bmpInfo &&
            SchematicImageParser.#bmpHasMeaningfulAlpha(bytes, bmpInfo)
        ) {
            const rgba = SchematicImageParser.#decodeBmpRgba(bytes, bmpInfo)

            return {
                bytes: SchematicImageParser.#encodePngRgba(
                    bmpInfo.width,
                    bmpInfo.height,
                    rgba
                ),
                mimeType: PNG_SCHEMA_MIME_TYPE,
                sourceMimeType: sourceMimeType || 'image/bmp',
                nativeClass: '',
                hasAlpha: true
            }
        }

        return {
            bytes,
            mimeType: sourceMimeType,
            sourceMimeType: '',
            nativeClass: '',
            hasAlpha: false
        }
    }

    /**
     * Extracts a native image payload following a BMP preview when present.
     * @param {Uint8Array} bytes Embedded image stream bytes.
     * @param {{ fileSize: number } | null} bmpInfo Parsed BMP preview info.
     * @returns {{ nativeClass: string, mimeType: string, bytes: Uint8Array } | null}
     */
    static #extractNativePayload(bytes, bmpInfo) {
        const previewLength = Number(bmpInfo?.fileSize || 0)
        if (
            !Number.isInteger(previewLength) ||
            previewLength <= 0 ||
            previewLength + 2 >= bytes.length
        ) {
            return null
        }

        const classLength = Number(bytes[previewLength])
        const nativeStart = previewLength + 1 + classLength
        if (
            classLength <= 0 ||
            nativeStart >= bytes.length ||
            nativeStart > bytes.length
        ) {
            return null
        }

        const nativeClass = new TextDecoder('windows-1252').decode(
            bytes.slice(previewLength + 1, nativeStart)
        )
        const nativeBytes = bytes.slice(nativeStart)
        const mimeType =
            NATIVE_IMAGE_CLASS_MIME_TYPES.get(nativeClass) ||
            SchematicImageParser.#detectMimeType(nativeBytes)

        if (!mimeType || !nativeBytes.length) {
            return null
        }

        return { nativeClass, mimeType, bytes: nativeBytes }
    }

    /**
     * Parses basic uncompressed BMP metadata.
     * @param {Uint8Array} bytes Image bytes.
     * @returns {{ width: number, height: number, topDown: boolean, bitsPerPixel: number, pixelOffset: number, rowStride: number, fileSize: number } | null}
     */
    static #parseBmpInfo(bytes) {
        if (
            !bytes ||
            bytes.length < BMP_HEADER_LENGTH ||
            bytes[0] !== 0x42 ||
            bytes[1] !== 0x4d
        ) {
            return null
        }

        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length)
        const fileSize = view.getUint32(2, true) || bytes.length
        const pixelOffset = view.getUint32(10, true)
        const dibHeaderSize = view.getUint32(14, true)
        const width = view.getInt32(18, true)
        const rawHeight = view.getInt32(22, true)
        const planes = view.getUint16(26, true)
        const bitsPerPixel = view.getUint16(28, true)
        const compression = view.getUint32(30, true)

        if (
            dibHeaderSize < 40 ||
            width <= 0 ||
            rawHeight === 0 ||
            planes !== 1 ||
            compression !== 0 ||
            ![24, 32].includes(bitsPerPixel)
        ) {
            return null
        }

        const height = Math.abs(rawHeight)
        const rowStride = Math.ceil((width * (bitsPerPixel / 8)) / 4) * 4
        if (pixelOffset + rowStride * height > bytes.length) {
            return null
        }

        return {
            width,
            height,
            topDown: rawHeight < 0,
            bitsPerPixel,
            pixelOffset,
            rowStride,
            fileSize: Math.min(fileSize, bytes.length)
        }
    }

    /**
     * Checks whether a 32-bit BMP contains usable alpha-channel data.
     * @param {Uint8Array} bytes BMP bytes.
     * @param {{ width: number, height: number, bitsPerPixel: number, pixelOffset: number, rowStride: number }} bmpInfo Parsed BMP info.
     * @returns {boolean}
     */
    static #bmpHasMeaningfulAlpha(bytes, bmpInfo) {
        if (bmpInfo.bitsPerPixel !== 32) {
            return false
        }

        let hasTransparentPixel = false
        let hasVisiblePixel = false

        for (let y = 0; y < bmpInfo.height; y += 1) {
            const rowOffset = bmpInfo.pixelOffset + y * bmpInfo.rowStride
            for (let x = 0; x < bmpInfo.width; x += 1) {
                const alpha = bytes[rowOffset + x * 4 + 3]
                if (alpha < 255) {
                    hasTransparentPixel = true
                }
                if (alpha > 0) {
                    hasVisiblePixel = true
                }
            }
        }

        return hasTransparentPixel && hasVisiblePixel
    }

    /**
     * Converts an uncompressed BMP payload into top-down RGBA pixels.
     * @param {Uint8Array} bytes BMP bytes.
     * @param {{ width: number, height: number, topDown: boolean, bitsPerPixel: number, pixelOffset: number, rowStride: number }} bmpInfo Parsed BMP info.
     * @returns {Uint8Array}
     */
    static #decodeBmpRgba(bytes, bmpInfo) {
        const rgba = new Uint8Array(bmpInfo.width * bmpInfo.height * 4)
        const bytesPerPixel = bmpInfo.bitsPerPixel / 8

        for (let y = 0; y < bmpInfo.height; y += 1) {
            const sourceRow = bmpInfo.topDown ? y : bmpInfo.height - y - 1
            const sourceOffset =
                bmpInfo.pixelOffset + sourceRow * bmpInfo.rowStride
            const targetOffset = y * bmpInfo.width * 4

            for (let x = 0; x < bmpInfo.width; x += 1) {
                const source = sourceOffset + x * bytesPerPixel
                const target = targetOffset + x * 4
                rgba[target] = bytes[source + 2]
                rgba[target + 1] = bytes[source + 1]
                rgba[target + 2] = bytes[source]
                rgba[target + 3] =
                    bmpInfo.bitsPerPixel === 32 ? bytes[source + 3] : 255
            }
        }

        return rgba
    }

    /**
     * Encodes RGBA pixels into a minimal PNG payload.
     * @param {number} width Pixel width.
     * @param {number} height Pixel height.
     * @param {Uint8Array} rgba Top-down RGBA pixels.
     * @returns {Uint8Array}
     */
    static #encodePngRgba(width, height, rgba) {
        const scanlineLength = width * 4 + 1
        const raw = new Uint8Array(scanlineLength * height)

        for (let y = 0; y < height; y += 1) {
            const rowOffset = y * scanlineLength
            raw[rowOffset] = 0
            raw.set(
                rgba.slice(y * width * 4, (y + 1) * width * 4),
                rowOffset + 1
            )
        }

        return SchematicImageParser.#concatByteArrays([
            Uint8Array.from(PNG_SIGNATURE),
            SchematicImageParser.#pngChunk(
                'IHDR',
                SchematicImageParser.#pngHeader(width, height)
            ),
            SchematicImageParser.#pngChunk(
                'IDAT',
                SchematicImageParser.#zlibStore(raw)
            ),
            SchematicImageParser.#pngChunk('IEND', new Uint8Array())
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
        header[10] = 0
        header[11] = 0
        header[12] = 0

        return header
    }

    /**
     * Builds a PNG chunk.
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
            SchematicImageParser.#crc32(
                SchematicImageParser.#concatByteArrays([typeBytes, data])
            ),
            false
        )

        return chunk
    }

    /**
     * Encodes raw scanlines as a zlib stream using stored deflate blocks.
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
            SchematicImageParser.#adler32(bytes),
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
     * Infers a MIME type from one file name.
     * @param {string} fileName
     * @returns {string}
     */
    static #inferMimeType(fileName) {
        const normalized = String(fileName || '').toLowerCase()

        if (normalized.endsWith('.bmp')) return 'image/bmp'
        if (normalized.endsWith('.gif')) return 'image/gif'
        if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
            return 'image/jpeg'
        }
        if (normalized.endsWith('.png')) return 'image/png'
        if (normalized.endsWith('.svg')) return 'image/svg+xml'
        if (normalized.endsWith('.tif') || normalized.endsWith('.tiff')) {
            return 'image/tiff'
        }

        return ''
    }

    /**
     * Detects common image MIME types from byte signatures.
     * @param {Uint8Array} bytes Image bytes.
     * @returns {string}
     */
    static #detectMimeType(bytes) {
        if (!bytes || bytes.length < 4) {
            return ''
        }

        if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
            return 'image/png'
        }
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
            return 'image/jpeg'
        }
        if (
            bytes[0] === 0x47 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x38
        ) {
            return 'image/gif'
        }
        if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
            return 'image/bmp'
        }
        if (
            bytes.length >= 12 &&
            bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46 &&
            bytes[8] === 0x57 &&
            bytes[9] === 0x45 &&
            bytes[10] === 0x42 &&
            bytes[11] === 0x50
        ) {
            return 'image/webp'
        }

        const textPrefix = new TextDecoder('utf-8', { fatal: false })
            .decode(bytes.slice(0, Math.min(bytes.length, 128)))
            .trimStart()
        if (textPrefix.startsWith('<svg') || textPrefix.startsWith('<?xml')) {
            return 'image/svg+xml'
        }

        return ''
    }

    /**
     * Encodes one byte array as base64 in both browser and test environments.
     * @param {Uint8Array} bytes
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
}
