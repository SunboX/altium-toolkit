// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

const SECTOR_BYTE_LENGTH = 512

/**
 * Builds OLE-backed schematic files whose logical `FileHeader` stream does not
 * follow the physical sector order.
 */
class SplitSchematicOleFactory {
    /**
     * Creates one OLE document with a `FileHeader` record split mid-field
     * across non-adjacent sectors.
     * @returns {ArrayBuffer}
     */
    static createDocumentBuffer() {
        const { prefix, suffix } =
            SplitSchematicOleFactory.#buildSplitFileHeaderParts()
        const totalSectorCount = 5
        const bytes = new Uint8Array(
            SECTOR_BYTE_LENGTH * (totalSectorCount + 1)
        )
        const dataView = new DataView(bytes.buffer)

        SplitSchematicOleFactory.#writeHeader(dataView)
        SplitSchematicOleFactory.#writeFatSector(dataView)
        SplitSchematicOleFactory.#writeDirectorySector(
            dataView,
            prefix.length + suffix.length
        )
        SplitSchematicOleFactory.#writeJunkSector(bytes)
        bytes.set(new TextEncoder().encode(prefix), SECTOR_BYTE_LENGTH * 3)
        bytes.set(new TextEncoder().encode(suffix), SECTOR_BYTE_LENGTH * 5)

        return bytes.buffer
    }

    /**
     * Builds two stream parts with the first part ending at the `C` in
     * `COLOR`, matching sector-boundary splits seen in native containers.
     * @returns {{ prefix: string, suffix: string }}
     */
    static #buildSplitFileHeaderParts() {
        const beforeFiller =
            '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=240|CustomY=160|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=15|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=41|Name=Padding|Text='
        const afterFiller =
            '|IsHidden=T' +
            '|RECORD=4|Location.X=100|Text=SPARROW TITLE|OwnerPartId=-1' +
            '|IndexInSheet=7|C'
        const fillerLength =
            SECTOR_BYTE_LENGTH - beforeFiller.length - afterFiller.length

        assert.ok(fillerLength > 0)

        return {
            prefix: beforeFiller + 'A'.repeat(fillerLength) + afterFiller,
            suffix: 'OLOR=8388608|Location.Y=115|FontID=2'
        }
    }

    /**
     * Writes the OLE header.
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
     * Writes one FAT sector whose `FileHeader` chain jumps over a junk sector.
     * @param {DataView} dataView
     */
    static #writeFatSector(dataView) {
        const offset = SECTOR_BYTE_LENGTH
        const entries = [-3, -2, 4, -2, -2]

        for (let index = 0; index < 128; index += 1) {
            dataView.setInt32(offset + index * 4, entries[index] ?? -1, true)
        }
    }

    /**
     * Writes a root storage and one `FileHeader` stream entry.
     * @param {DataView} dataView
     * @param {number} fileHeaderByteLength
     */
    static #writeDirectorySector(dataView, fileHeaderByteLength) {
        const offset = SECTOR_BYTE_LENGTH * 2
        const entries = [
            SplitSchematicOleFactory.#createDirectoryEntryBytes({
                name: 'Root Entry',
                type: 5,
                startSector: -2,
                streamSize: 0,
                child: 1
            }),
            SplitSchematicOleFactory.#createDirectoryEntryBytes({
                name: 'FileHeader',
                type: 2,
                startSector: 2,
                streamSize: fileHeaderByteLength
            }),
            new Uint8Array(128),
            new Uint8Array(128)
        ]

        for (let index = 0; index < entries.length; index += 1) {
            new Uint8Array(dataView.buffer, offset + index * 128, 128).set(
                entries[index]
            )
        }
    }

    /**
     * Builds one OLE directory entry.
     * @param {{ name: string, type: number, startSector: number, streamSize: number, child?: number }} options
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
        dataView.setInt32(68, -1, true)
        dataView.setInt32(72, -1, true)
        dataView.setInt32(76, options.child ?? -1, true)
        dataView.setInt32(116, options.startSector, true)
        dataView.setBigUint64(120, BigInt(options.streamSize), true)

        return bytes
    }

    /**
     * Writes non-record bytes into the physical sector skipped by the stream
     * chain.
     * @param {Uint8Array} bytes
     */
    static #writeJunkSector(bytes) {
        const offset = SECTOR_BYTE_LENGTH * 4

        for (let index = 0; index < SECTOR_BYTE_LENGTH; index += 1) {
            bytes[offset + index] = index % 251
        }
    }
}

/**
 * Verifies OLE-backed schematics parse the logical `FileHeader` stream so
 * records split across physical sectors keep their complete fields.
 */
test('parseAltiumArrayBuffer reads schematic records from the FileHeader stream', () => {
    const documentModel = AltiumParser.parseArrayBuffer(
        'stream-split.SchDoc',
        SplitSchematicOleFactory.createDocumentBuffer()
    )
    const recoveredText = documentModel.schematic.texts.find(
        (text) => text.text === 'SPARROW TITLE'
    )

    assert.ok(recoveredText)
    assert.equal(recoveredText.x, 100)
    assert.equal(recoveredText.y, 115)
    assert.equal(recoveredText.color, '#000080')
    assert.equal(recoveredText.fontSize, 15)
    assert.equal(recoveredText.fontWeight, 700)
})
