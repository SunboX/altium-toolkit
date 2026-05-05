import assert from 'node:assert/strict'
import test from 'node:test'
import { OleCompoundDocument } from '../../src/core/ole/OleCompoundDocument.mjs'
import { OleDirectoryEntry } from '../../src/core/ole/OleDirectoryEntry.mjs'

/**
 * Builds small synthetic OLE compound documents for parser tests.
 */
class OleTestDocumentFactory {
    /**
     * Creates one minimal compound document with one standard stream and one
     * short-stream entry backed by the root storage mini-stream.
     * @returns {ArrayBuffer}
     */
    static createDocumentBuffer() {
        const sectorByteLength = 512
        const totalSectorCount = 5
        const bytes = new Uint8Array(sectorByteLength * (totalSectorCount + 1))
        const dataView = new DataView(bytes.buffer)

        OleTestDocumentFactory.#writeHeader(dataView)
        OleTestDocumentFactory.#writeFatSector(dataView, sectorByteLength)
        OleTestDocumentFactory.#writeDirectorySector(dataView, sectorByteLength)
        OleTestDocumentFactory.#writeMiniStreamSector(bytes, sectorByteLength)
        OleTestDocumentFactory.#writeMiniFatSector(dataView, sectorByteLength)
        OleTestDocumentFactory.#writeStandardStreamSector(
            bytes,
            sectorByteLength
        )

        return bytes.buffer
    }

    /**
     * Builds one standalone directory entry buffer.
     * @param {{ name: string, type: number, startSector: number, streamSize: number, leftSibling?: number, rightSibling?: number, child?: number }} options
     * @returns {Uint8Array}
     */
    static createDirectoryEntryBytes(options) {
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
        // Keep the synthetic document tiny while still exercising both regular
        // and mini-stream routing.
        dataView.setUint32(56, 12, true)
        dataView.setInt32(60, 3, true)
        dataView.setUint32(64, 1, true)
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
        const entries = [-3, -2, -2, -2, -2]

        for (let index = 0; index < 128; index += 1) {
            dataView.setInt32(offset + index * 4, entries[index] ?? -1, true)
        }
    }

    /**
     * Writes one directory sector containing the root storage and two streams.
     * @param {DataView} dataView
     * @param {number} sectorByteLength
     */
    static #writeDirectorySector(dataView, sectorByteLength) {
        const offset = sectorByteLength * 2
        const entries = [
            OleTestDocumentFactory.createDirectoryEntryBytes({
                name: 'Root Entry',
                type: 5,
                startSector: 2,
                streamSize: 64,
                child: 1
            }),
            OleTestDocumentFactory.createDirectoryEntryBytes({
                name: 'StandardStream',
                type: 2,
                startSector: 4,
                streamSize: 13,
                rightSibling: 2
            }),
            OleTestDocumentFactory.createDirectoryEntryBytes({
                name: 'MiniData',
                type: 2,
                startSector: 0,
                streamSize: 9
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
     * Writes the root mini-stream sector contents.
     * @param {Uint8Array} bytes
     * @param {number} sectorByteLength
     */
    static #writeMiniStreamSector(bytes, sectorByteLength) {
        bytes.set(new TextEncoder().encode('mini-data'), sectorByteLength * 3)
    }

    /**
     * Writes one mini FAT sector.
     * @param {DataView} dataView
     * @param {number} sectorByteLength
     */
    static #writeMiniFatSector(dataView, sectorByteLength) {
        const offset = sectorByteLength * 4

        dataView.setInt32(offset, -2, true)

        for (let index = 1; index < 128; index += 1) {
            dataView.setInt32(offset + index * 4, -1, true)
        }
    }

    /**
     * Writes the standard stream sector contents.
     * @param {Uint8Array} bytes
     * @param {number} sectorByteLength
     */
    static #writeStandardStreamSector(bytes, sectorByteLength) {
        bytes.set(
            new TextEncoder().encode('standard-data'),
            sectorByteLength * 5
        )
    }
}

/**
 * Verifies one invalid OLE header is rejected immediately.
 */
test('OleCompoundDocument rejects an invalid header signature', () => {
    assert.throws(
        () => OleCompoundDocument.fromArrayBuffer(new ArrayBuffer(512)),
        /header signature/i
    )
})

/**
 * Verifies directory entry decoding keeps the typed metadata needed by the OLE
 * directory walker.
 */
test('OleDirectoryEntry decodes one directory entry buffer', () => {
    const entry = OleDirectoryEntry.fromBytes(
        OleTestDocumentFactory.createDirectoryEntryBytes({
            name: 'MiniData',
            type: 2,
            startSector: 7,
            streamSize: 9,
            leftSibling: 1,
            rightSibling: 3,
            child: -1
        }),
        2
    )

    assert.equal(entry.id, 2)
    assert.equal(entry.name, 'MiniData')
    assert.equal(entry.type, 2)
    assert.equal(entry.startSector, 7)
    assert.equal(entry.streamSize, 9)
    assert.equal(entry.leftSiblingId, 1)
    assert.equal(entry.rightSiblingId, 3)
})

/**
 * Verifies the OLE parser exposes both standard streams and short streams from
 * one synthetic compound file.
 */
test('OleCompoundDocument lists streams and extracts standard and short data', () => {
    const document = OleCompoundDocument.fromArrayBuffer(
        OleTestDocumentFactory.createDocumentBuffer()
    )
    const decoder = new TextDecoder('utf8')

    assert.equal(document.sectorByteLength, 512)
    assert.equal(document.miniSectorByteLength, 64)
    assert.deepEqual(document.listStreams(), ['MiniData', 'StandardStream'])
    assert.equal(
        decoder.decode(document.getStream('StandardStream')),
        'standard-data'
    )
    assert.equal(decoder.decode(document.getStream('MiniData')), 'mini-data')
})
