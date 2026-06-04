// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Builds tiny OLE-backed schematic files with an embedded image stream.
 */
class SchematicImageOleFactory {
    /**
     * Creates one OLE document containing a `FileHeader` stream and an image
     * payload stream addressed by file name.
     * @param {{ fileHeaderText: string, imageFileName: string, imageBytes: Uint8Array }} options
     * @returns {ArrayBuffer}
     */
    static createDocumentBuffer(options) {
        const sectorByteLength = 512
        const totalSectorCount = 4
        const bytes = new Uint8Array(sectorByteLength * (totalSectorCount + 1))
        const dataView = new DataView(bytes.buffer)

        SchematicImageOleFactory.#writeHeader(dataView)
        SchematicImageOleFactory.#writeFatSector(dataView, sectorByteLength)
        SchematicImageOleFactory.#writeDirectorySector(
            dataView,
            sectorByteLength,
            options.imageFileName,
            options.fileHeaderText.length,
            options.imageBytes.length
        )
        bytes.set(
            new TextEncoder().encode(options.fileHeaderText),
            sectorByteLength * 3
        )
        bytes.set(options.imageBytes, sectorByteLength * 4)

        return bytes.buffer
    }

    /**
     * Writes the OLE file header.
     * @param {DataView} dataView
     */
    static #writeHeader(dataView) {
        dataView.setUint32(0, 0xe011cfd0, true)
        dataView.setUint32(4, 0xe11ab1a1, true)
        dataView.setUint16(24, 0x003e, true)
        dataView.setUint16(26, 0x0003, true)
        dataView.setUint16(28, 0xfffe, true)
        dataView.setUint16(30, 9, true)
        dataView.setUint16(32, 6, true)
        dataView.setUint32(40, 0, true)
        dataView.setUint32(44, 1, true)
        dataView.setInt32(48, 1, true)
        dataView.setUint32(56, 4, true)
        dataView.setInt32(60, -2, true)
        dataView.setUint32(64, 0, true)
        dataView.setInt32(68, -2, true)
        dataView.setUint32(72, 0, true)
        dataView.setInt32(76, 0, true)

        for (let index = 1; index < 109; index += 1) {
            dataView.setInt32(76 + index * 4, -1, true)
        }
    }

    /**
     * Writes one FAT sector.
     * @param {DataView} dataView
     * @param {number} sectorByteLength
     */
    static #writeFatSector(dataView, sectorByteLength) {
        const offset = sectorByteLength
        const entries = [-3, -2, -2, -2]

        for (let index = 0; index < 128; index += 1) {
            dataView.setInt32(offset + index * 4, entries[index] ?? -1, true)
        }
    }

    /**
     * Writes one directory sector containing root, FileHeader, and the image
     * stream.
     * @param {DataView} dataView
     * @param {number} sectorByteLength
     * @param {string} imageFileName
     * @param {number} fileHeaderByteLength
     * @param {number} imageByteLength
     */
    static #writeDirectorySector(
        dataView,
        sectorByteLength,
        imageFileName,
        fileHeaderByteLength,
        imageByteLength
    ) {
        const offset = sectorByteLength * 2
        const entries = [
            SchematicImageOleFactory.#createDirectoryEntryBytes({
                name: 'Root Entry',
                type: 5,
                startSector: -2,
                streamSize: 0,
                child: 1
            }),
            SchematicImageOleFactory.#createDirectoryEntryBytes({
                name: 'FileHeader',
                type: 2,
                startSector: 2,
                streamSize: fileHeaderByteLength,
                rightSibling: 2
            }),
            SchematicImageOleFactory.#createDirectoryEntryBytes({
                name: imageFileName,
                type: 2,
                startSector: 3,
                streamSize: imageByteLength
            }),
            new Uint8Array(128)
        ]

        for (let index = 0; index < entries.length; index += 1) {
            new Uint8Array(dataView.buffer, offset + index * 128, 128).set(
                entries[index]
            )
        }
    }

    /**
     * Builds one standalone OLE directory entry.
     * @param {{ name: string, type: number, startSector: number, streamSize: number, leftSibling?: number, rightSibling?: number, child?: number }} options
     * @returns {Uint8Array}
     */
    static #createDirectoryEntryBytes(options) {
        const bytes = new Uint8Array(128)
        const dataView = new DataView(bytes.buffer)
        const nameBytes = new TextEncoder().encode(
            options.name
                .split('')
                .map((character) => character + '\u0000')
                .join('') + '\u0000\u0000'
        )

        bytes.set(nameBytes.slice(0, 64), 0)
        dataView.setUint16(
            64,
            Math.min((options.name.length + 1) * 2, 64),
            true
        )
        dataView.setUint8(66, options.type)
        dataView.setUint8(67, 1)
        dataView.setInt32(68, options.leftSibling ?? -1, true)
        dataView.setInt32(72, options.rightSibling ?? -1, true)
        dataView.setInt32(76, options.child ?? -1, true)
        dataView.setInt32(116, options.startSector, true)
        dataView.setBigUint64(120, BigInt(options.streamSize), true)

        return bytes
    }
}

/**
 * Verifies OLE-backed schematic image records preserve placement metadata and
 * recover the embedded payload by file name.
 */
test('parseAltiumArrayBuffer recovers embedded schematic images from OLE streams', () => {
    const fileHeaderText =
        '|HEADER=Schematic Document' +
        '|RECORD=31|CustomX=160|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
        '|RECORD=30|IndexInSheet=2|Location.X=20|Location.Y=30|Corner.X=80|Corner.Y=70' +
        '|EmbedImage=T|KeepAspect=T|FileName=glyph.bmp'
    const arrayBuffer = SchematicImageOleFactory.createDocumentBuffer({
        fileHeaderText,
        imageFileName: 'glyph.bmp',
        imageBytes: Uint8Array.from([0x42, 0x4d, 0x10, 0x00, 0x00, 0x00])
    })
    const documentModel = AltiumParser.parseArrayBuffer(
        'embedded-image.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.images, [
        {
            x: 20,
            y: 30,
            cornerX: 80,
            cornerY: 70,
            fileName: 'glyph.bmp',
            embedded: true,
            keepAspect: true,
            mimeType: 'image/bmp',
            dataBase64: 'Qk0QAAAA',
            renderOrder: 2,
            diagnosticState: 'embedded'
        }
    ])
})

/**
 * Verifies embedded image records degrade to diagnostics instead of crashing
 * when the payload stream cannot be resolved from the schematic container.
 */
test('parseAltiumArrayBuffer warns when an embedded schematic image payload is missing', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=160|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=30|IndexInSheet=2|Location.X=20|Location.Y=30|Corner.X=80|Corner.Y=70' +
            '|EmbedImage=T|KeepAspect=T|FileName=missing.bmp'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'missing-image.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.images, [
        {
            x: 20,
            y: 30,
            cornerX: 80,
            cornerY: 70,
            fileName: 'missing.bmp',
            embedded: true,
            keepAspect: true,
            mimeType: '',
            dataBase64: '',
            renderOrder: 2,
            diagnosticState: 'missing-embedded-payload'
        }
    ])
    assert.match(
        documentModel.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join('\n'),
        /embedded schematic image payload/i
    )
})

/**
 * Verifies wrapped schematic image streams prefer the native payload over the
 * BMP preview when a native image class is present.
 */
test('parseAltiumArrayBuffer prefers native schematic image payloads over previews', () => {
    const pngBytes = Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
    ])
    const wrapperBytes = createWrappedNativeImageBytes('TdxPNGImage', pngBytes)
    const fileHeaderText =
        '|HEADER=Schematic Document' +
        '|RECORD=31|CustomX=160|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
        '|RECORD=30|IndexInSheet=2|Location.X=20|Location.Y=30|Corner.X=80|Corner.Y=70' +
        '|EmbedImage=T|KeepAspect=T|FileName=wrapped.bmp'
    const arrayBuffer = SchematicImageOleFactory.createDocumentBuffer({
        fileHeaderText,
        imageFileName: 'wrapped.bmp',
        imageBytes: wrapperBytes
    })
    const documentModel = AltiumParser.parseArrayBuffer(
        'wrapped-image.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.images[0].mimeType, 'image/png')
    assert.equal(documentModel.schematic.images[0].sourceMimeType, 'image/bmp')
    assert.equal(documentModel.schematic.images[0].nativeClass, 'TdxPNGImage')
    assert.equal(
        documentModel.schematic.images[0].dataBase64,
        Buffer.from(pngBytes).toString('base64')
    )
})

/**
 * Verifies 32-bit BMP streams with alpha are converted to browser-friendly PNG
 * payloads rather than being exposed as opaque BMP previews.
 */
test('parseAltiumArrayBuffer converts alpha BMP schematic images to PNG', () => {
    const fileHeaderText =
        '|HEADER=Schematic Document' +
        '|RECORD=31|CustomX=160|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
        '|RECORD=30|IndexInSheet=2|Location.X=20|Location.Y=30|Corner.X=80|Corner.Y=70' +
        '|EmbedImage=T|KeepAspect=T|FileName=alpha.bmp'
    const arrayBuffer = SchematicImageOleFactory.createDocumentBuffer({
        fileHeaderText,
        imageFileName: 'alpha.bmp',
        imageBytes: createAlphaBmpBytes()
    })
    const documentModel = AltiumParser.parseArrayBuffer(
        'alpha-image.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.images[0].mimeType, 'image/png')
    assert.equal(documentModel.schematic.images[0].sourceMimeType, 'image/bmp')
    assert.equal(documentModel.schematic.images[0].hasAlpha, true)
    assert.match(documentModel.schematic.images[0].dataBase64, /^iVBORw0KGgo/u)
})

/**
 * Builds a native-image wrapper with a valid BMP preview.
 * @param {string} nativeClass
 * @param {Uint8Array} nativeBytes
 * @returns {Uint8Array}
 */
function createWrappedNativeImageBytes(nativeClass, nativeBytes) {
    const previewBytes = createOpaqueBmpBytes()
    const classBytes = new TextEncoder().encode(nativeClass)
    const bytes = new Uint8Array(
        previewBytes.byteLength +
            1 +
            classBytes.byteLength +
            nativeBytes.byteLength
    )
    bytes.set(previewBytes, 0)
    bytes[previewBytes.byteLength] = classBytes.byteLength
    bytes.set(classBytes, previewBytes.byteLength + 1)
    bytes.set(nativeBytes, previewBytes.byteLength + 1 + classBytes.byteLength)
    return bytes
}

/**
 * Builds a minimal opaque 24-bit BMP preview.
 * @returns {Uint8Array}
 */
function createOpaqueBmpBytes() {
    return createBmpBytes({
        bitsPerPixel: 24,
        pixels: [0xff, 0xff, 0xff]
    })
}

/**
 * Builds a minimal 32-bit BMP with one transparent and one opaque pixel.
 * @returns {Uint8Array}
 */
function createAlphaBmpBytes() {
    return createBmpBytes({
        bitsPerPixel: 32,
        width: 2,
        pixels: [0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0x00, 0xff]
    })
}

/**
 * Builds a tiny uncompressed BMP payload.
 * @param {{ bitsPerPixel: 24 | 32, width?: number, pixels: number[] }} options
 * @returns {Uint8Array}
 */
function createBmpBytes(options) {
    const width = options.width || 1
    const height = 1
    const bytesPerPixel = options.bitsPerPixel / 8
    const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4
    const pixelOffset = 54
    const fileSize = pixelOffset + rowStride * height
    const bytes = new Uint8Array(fileSize)
    const view = new DataView(bytes.buffer)
    bytes[0] = 0x42
    bytes[1] = 0x4d
    view.setUint32(2, fileSize, true)
    view.setUint32(10, pixelOffset, true)
    view.setUint32(14, 40, true)
    view.setInt32(18, width, true)
    view.setInt32(22, height, true)
    view.setUint16(26, 1, true)
    view.setUint16(28, options.bitsPerPixel, true)
    view.setUint32(34, rowStride * height, true)
    bytes.set(options.pixels, pixelOffset)
    return bytes
}
