// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { BinaryReader } from '../../src/core/BinaryReader.mjs'

/**
 * Verifies the binary reader decodes little-endian values and rejects reads
 * that would exceed the underlying buffer.
 */
test('BinaryReader reads little-endian integers and enforces bounds', () => {
    const reader = new BinaryReader(
        new Uint8Array([0x34, 0x12, 0x78, 0x56]).buffer
    )

    assert.equal(reader.readUint8(0), 0x34)
    assert.equal(reader.readInt16(0), 0x1234)
    assert.equal(reader.readUint16(0), 0x1234)
    assert.equal(reader.readUint16(2), 0x5678)
    assert.throws(() => reader.readUint32(2), /out of bounds/i)
})

/**
 * Verifies sized blocks, Pascal strings, floating-point values, and sequential
 * cursor reads share the same bounds-checked primitive decoder.
 */
test('BinaryReader reads blocks, strings, doubles, and sequential cursors', () => {
    const buffer = new ArrayBuffer(24)
    const view = new DataView(buffer)
    view.setUint32(0, 0xff000005, true)
    new Uint8Array(buffer).set([1, 2, 3, 4, 5], 4)
    view.setUint8(9, 3)
    new Uint8Array(buffer).set([0x61, 0x62, 0x63], 10)
    view.setFloat64(13, 12.5, true)
    view.setInt16(21, -7, true)

    const reader = new BinaryReader(buffer)
    const block = reader.readSizedBlock(0)

    assert.equal(block.byteLength, 5)
    assert.equal(block.flags, 0xff)
    assert.equal(block.dataOffset, 4)
    assert.equal(block.nextOffset, 9)
    assert.deepEqual([...block.bytes], [1, 2, 3, 4, 5])
    assert.equal(reader.readPascalString(9), 'abc')
    assert.equal(reader.readFloat64(13), 12.5)
    assert.equal(reader.readInt16(21), -7)

    const cursor = reader.cursor(0)
    assert.deepEqual([...cursor.readSizedBlock().bytes], [1, 2, 3, 4, 5])
    assert.equal(cursor.offset, 9)
    assert.equal(cursor.readPascalString(), 'abc')
    assert.equal(cursor.offset, 13)
    assert.equal(cursor.readFloat64(), 12.5)
    assert.equal(cursor.readInt16(), -7)
    assert.equal(cursor.offset, 23)

    assert.throws(() => reader.readSizedBlock(20), /out of bounds/i)
})
