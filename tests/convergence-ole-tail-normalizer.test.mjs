// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumOleInputTailNormalizer } from '../src/convergence/AltiumOleInputTailNormalizer.mjs'
import { OleCompoundDocument } from '../src/core/ole/OleCompoundDocument.mjs'

const SECTOR_BYTE_LENGTH = 512
const STREAM_TEXT = 'standard-data'

/**
 * Builds one compact OLE file whose final sector contains a declared stream.
 */
class ConvergenceOleTailTestFactory {
    /**
     * Creates one aligned compound document.
     * @returns {Uint8Array}
     */
    static createDocument() {
        const bytes = new Uint8Array(SECTOR_BYTE_LENGTH * 4)
        const view = new DataView(bytes.buffer)

        ConvergenceOleTailTestFactory.#writeHeader(view)
        ConvergenceOleTailTestFactory.#writeFat(view)
        ConvergenceOleTailTestFactory.#writeDirectory(bytes)
        bytes.set(new TextEncoder().encode(STREAM_TEXT), SECTOR_BYTE_LENGTH * 3)

        return bytes
    }

    /**
     * Creates one aligned compound document whose final regular stream backs a
     * declared mini-stream entry.
     * @returns {Uint8Array}
     */
    static createMiniStreamDocument() {
        const bytes = new Uint8Array(SECTOR_BYTE_LENGTH * 5)
        const view = new DataView(bytes.buffer)

        ConvergenceOleTailTestFactory.#writeHeader(view)
        view.setUint32(56, 4096, true)
        view.setInt32(60, 2, true)
        view.setUint32(64, 1, true)
        ConvergenceOleTailTestFactory.#writeFat(view, [-3, -2, -2, -2])
        ConvergenceOleTailTestFactory.#writeMiniDirectory(bytes)
        ConvergenceOleTailTestFactory.#writeMiniFat(view)
        bytes.set(new TextEncoder().encode(STREAM_TEXT), SECTOR_BYTE_LENGTH * 4)

        return bytes
    }

    /**
     * Writes the OLE header and DIFAT entry.
     * @param {DataView} view Output view.
     * @returns {void}
     */
    static #writeHeader(view) {
        const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
        signature.forEach((value, index) => view.setUint8(index, value))
        view.setUint16(24, 0x003e, true)
        view.setUint16(26, 0x0003, true)
        view.setUint16(28, 0xfffe, true)
        view.setUint16(30, 9, true)
        view.setUint16(32, 6, true)
        view.setUint32(44, 1, true)
        view.setInt32(48, 1, true)
        view.setUint32(56, 0, true)
        view.setInt32(60, -2, true)
        view.setUint32(64, 0, true)
        view.setInt32(68, -2, true)
        view.setUint32(72, 0, true)
        view.setInt32(76, 0, true)
        for (let index = 1; index < 109; index += 1) {
            view.setInt32(76 + index * 4, -1, true)
        }
    }

    /**
     * Writes one FAT sector for the FAT, directory, and stream sectors.
     * @param {DataView} view Output view.
     * @returns {void}
     */
    static #writeFat(view, entries = [-3, -2, -2]) {
        const offset = SECTOR_BYTE_LENGTH
        for (let index = 0; index < 128; index += 1) {
            view.setInt32(offset + index * 4, entries[index] ?? -1, true)
        }
    }

    /**
     * Writes the root and one regular stream directory entry.
     * @param {Uint8Array} bytes Output bytes.
     * @returns {void}
     */
    static #writeDirectory(bytes) {
        const offset = SECTOR_BYTE_LENGTH * 2
        bytes.set(
            ConvergenceOleTailTestFactory.#createDirectoryEntry({
                name: 'Root Entry',
                type: 5,
                startSector: -2,
                streamSize: 0,
                child: 1
            }),
            offset
        )
        bytes.set(
            ConvergenceOleTailTestFactory.#createDirectoryEntry({
                name: 'Data',
                type: 2,
                startSector: 2,
                streamSize: STREAM_TEXT.length
            }),
            offset + 128
        )
    }

    /**
     * Writes root and mini-stream directory entries.
     * @param {Uint8Array} bytes Output bytes.
     * @returns {void}
     */
    static #writeMiniDirectory(bytes) {
        const offset = SECTOR_BYTE_LENGTH * 2
        bytes.set(
            ConvergenceOleTailTestFactory.#createDirectoryEntry({
                name: 'Root Entry',
                type: 5,
                startSector: 3,
                streamSize: STREAM_TEXT.length,
                child: 1
            }),
            offset
        )
        bytes.set(
            ConvergenceOleTailTestFactory.#createDirectoryEntry({
                name: 'Data',
                type: 2,
                startSector: 0,
                streamSize: STREAM_TEXT.length
            }),
            offset + 128
        )
    }

    /**
     * Writes one mini-FAT sector containing a single mini-stream chain.
     * @param {DataView} view Output view.
     * @returns {void}
     */
    static #writeMiniFat(view) {
        const offset = SECTOR_BYTE_LENGTH * 3
        for (let index = 0; index < 128; index += 1) {
            view.setInt32(offset + index * 4, index ? -1 : -2, true)
        }
    }

    /**
     * Creates one OLE directory entry.
     * @param {{ name: string, type: number, startSector: number, streamSize: number, child?: number }} options Entry values.
     * @returns {Uint8Array}
     */
    static #createDirectoryEntry(options) {
        const bytes = new Uint8Array(128)
        const view = new DataView(bytes.buffer)
        const nameBytes = new TextEncoder().encode(
            options.name
                .split('')
                .map((character) => character + '\u0000')
                .join('') + '\u0000\u0000'
        )

        bytes.set(nameBytes.slice(0, 64))
        view.setUint16(64, (options.name.length + 1) * 2, true)
        view.setUint8(66, options.type)
        view.setUint8(67, 1)
        view.setInt32(68, -1, true)
        view.setInt32(72, -1, true)
        view.setInt32(76, options.child ?? -1, true)
        view.setInt32(116, options.startSector, true)
        view.setBigUint64(120, BigInt(options.streamSize), true)
        return bytes
    }
}

test('AltiumOleInputTailNormalizer pads only unused final stream bytes', () => {
    const aligned = ConvergenceOleTailTestFactory.createDocument()
    const unpadded = aligned.slice(
        0,
        SECTOR_BYTE_LENGTH * 3 + STREAM_TEXT.length
    )
    const normalized = AltiumOleInputTailNormalizer.normalize(unpadded.buffer)
    const document = OleCompoundDocument.fromArrayBuffer(normalized)

    assert.equal(normalized.byteLength, aligned.byteLength)
    assert.equal(
        new TextDecoder().decode(document.getStream('Data')),
        STREAM_TEXT
    )
})

test('AltiumOleInputTailNormalizer preserves genuine stream truncation', () => {
    const aligned = ConvergenceOleTailTestFactory.createDocument()
    const truncated = aligned.slice(
        0,
        SECTOR_BYTE_LENGTH * 3 + STREAM_TEXT.length - 1
    )
    const normalized = AltiumOleInputTailNormalizer.normalize(truncated.buffer)

    assert.equal(normalized, truncated.buffer)
    assert.throws(
        () => OleCompoundDocument.fromArrayBuffer(normalized),
        /sector-aligned/iu
    )
})

test('AltiumOleInputTailNormalizer rejects surplus regular stream chain sectors', () => {
    const source = ConvergenceOleTailTestFactory.createDocument()
    const aligned = new Uint8Array(SECTOR_BYTE_LENGTH * 5)
    aligned.set(source)
    const view = new DataView(aligned.buffer)
    view.setInt32(SECTOR_BYTE_LENGTH + 2 * 4, 3, true)
    view.setInt32(SECTOR_BYTE_LENGTH + 3 * 4, -2, true)
    const partialSurplusSector = aligned.slice(0, SECTOR_BYTE_LENGTH * 4 + 1)
    const normalized = AltiumOleInputTailNormalizer.normalize(
        partialSurplusSector.buffer
    )

    assert.equal(normalized, partialSurplusSector.buffer)
})

test('AltiumOleInputTailNormalizer rejects unreferenced physical tails', () => {
    const source = ConvergenceOleTailTestFactory.createDocument()
    const aligned = new Uint8Array(SECTOR_BYTE_LENGTH * 5)
    aligned.set(source)
    const unreferencedTail = aligned.slice(0, SECTOR_BYTE_LENGTH * 4 + 1)
    const normalized = AltiumOleInputTailNormalizer.normalize(
        unreferencedTail.buffer
    )

    assert.equal(normalized, unreferencedTail.buffer)
})

test('AltiumOleInputTailNormalizer preserves partial structural sectors', () => {
    const aligned = ConvergenceOleTailTestFactory.createDocument()
    const truncatedDirectory = aligned.slice(0, SECTOR_BYTE_LENGTH * 2 + 256)
    const normalized = AltiumOleInputTailNormalizer.normalize(
        truncatedDirectory.buffer
    )

    assert.equal(normalized, truncatedDirectory.buffer)
})

test('AltiumOleInputTailNormalizer preserves malformed structural metadata', () => {
    const aligned = ConvergenceOleTailTestFactory.createDocument()
    const malformed = aligned.slice(
        0,
        SECTOR_BYTE_LENGTH * 3 + STREAM_TEXT.length
    )
    new DataView(malformed.buffer).setUint32(44, 0, true)
    const normalized = AltiumOleInputTailNormalizer.normalize(malformed.buffer)

    assert.equal(normalized, malformed.buffer)
})

test('AltiumOleInputTailNormalizer validates complete mini-stream tails', () => {
    const aligned = ConvergenceOleTailTestFactory.createMiniStreamDocument()
    const unpadded = aligned.slice(
        0,
        SECTOR_BYTE_LENGTH * 4 + STREAM_TEXT.length
    )
    const normalized = AltiumOleInputTailNormalizer.normalize(unpadded.buffer)
    const document = OleCompoundDocument.fromArrayBuffer(normalized)

    assert.equal(normalized.byteLength, aligned.byteLength)
    assert.equal(
        new TextDecoder().decode(document.getStream('Data')),
        STREAM_TEXT
    )
})

test('AltiumOleInputTailNormalizer rejects mini-stream bytes beyond the root stream', () => {
    const aligned = ConvergenceOleTailTestFactory.createMiniStreamDocument()
    const unpadded = aligned.slice(
        0,
        SECTOR_BYTE_LENGTH * 4 + STREAM_TEXT.length
    )
    const directoryEntryOffset = SECTOR_BYTE_LENGTH * 2 + 128
    new DataView(unpadded.buffer).setBigUint64(
        directoryEntryOffset + 120,
        BigInt(STREAM_TEXT.length + 1),
        true
    )
    const normalized = AltiumOleInputTailNormalizer.normalize(unpadded.buffer)

    assert.equal(normalized, unpadded.buffer)
})

test('AltiumOleInputTailNormalizer rejects surplus mini-FAT chain sectors', () => {
    const source = ConvergenceOleTailTestFactory.createMiniStreamDocument()
    const aligned = new Uint8Array(SECTOR_BYTE_LENGTH * 6)
    aligned.set(source)
    const view = new DataView(aligned.buffer)
    view.setInt32(SECTOR_BYTE_LENGTH + 2 * 4, 4, true)
    view.setInt32(SECTOR_BYTE_LENGTH + 4 * 4, -2, true)
    const partialSurplusSector = aligned.slice(0, SECTOR_BYTE_LENGTH * 5 + 1)
    const normalized = AltiumOleInputTailNormalizer.normalize(
        partialSurplusSector.buffer
    )

    assert.equal(normalized, partialSurplusSector.buffer)
})

test('AltiumOleInputTailNormalizer returns aligned and non-OLE inputs unchanged', () => {
    const aligned = ConvergenceOleTailTestFactory.createDocument().buffer
    const text = new TextEncoder().encode('not an OLE document').buffer

    assert.equal(AltiumOleInputTailNormalizer.normalize(aligned), aligned)
    assert.equal(AltiumOleInputTailNormalizer.normalize(text), text)
})
