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
