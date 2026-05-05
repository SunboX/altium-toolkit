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
    assert.equal(reader.readUint16(0), 0x1234)
    assert.equal(reader.readUint16(2), 0x5678)
    assert.throws(() => reader.readUint32(2), /out of bounds/i)
})
