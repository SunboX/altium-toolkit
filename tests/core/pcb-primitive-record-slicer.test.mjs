// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbPrimitiveRecordSlicer } from '../../src/core/altium/PcbPrimitiveRecordSlicer.mjs'

/**
 * Builds synthetic primitive streams for shared record-slicer tests.
 */
class PcbPrimitiveRecordSlicerTestFactory {
    /**
     * Creates one stream header with a little-endian record count.
     * @param {number} count
     * @returns {Uint8Array}
     */
    static createHeader(count) {
        const headerBytes = new Uint8Array(4)
        new DataView(headerBytes.buffer).setUint32(0, count, true)
        return headerBytes
    }

    /**
     * Creates one object-id/length-prefixed record.
     * @param {number} objectId
     * @param {number[]} payload
     * @returns {Uint8Array}
     */
    static createLengthPrefixedRecord(objectId, payload) {
        const record = new Uint8Array(5 + payload.length)
        const view = new DataView(record.buffer)

        view.setUint8(0, objectId)
        view.setUint32(1, payload.length, true)
        record.set(payload, 5)

        return record
    }
}

/**
 * Verifies payload-view slicing for primitives whose normalized offsets start
 * after the object-id/length prefix.
 */
test('PcbPrimitiveRecordSlicer slices length-prefixed payload views', () => {
    const firstRecord =
        PcbPrimitiveRecordSlicerTestFactory.createLengthPrefixedRecord(
            4,
            [0x11, 0x12, 0x13]
        )
    const secondRecord =
        PcbPrimitiveRecordSlicerTestFactory.createLengthPrefixedRecord(
            4,
            [0x21, 0x22, 0x23, 0x24]
        )
    const dataBytes = new Uint8Array(
        firstRecord.byteLength + secondRecord.byteLength
    )

    dataBytes.set(firstRecord, 0)
    dataBytes.set(secondRecord, firstRecord.byteLength)

    const records = PcbPrimitiveRecordSlicer.slicePrimitiveRecords({
        headerBytes: PcbPrimitiveRecordSlicerTestFactory.createHeader(2),
        dataBytes,
        objectId: 4,
        fixedRecordByteLength: 8,
        minimumPayloadByteLength: 3,
        lengthPrefixedView: 'payload'
    })

    assert.deepEqual(
        records.map((record) => Array.from(record.viewBytes)),
        [
            [0x11, 0x12, 0x13],
            [0x21, 0x22, 0x23, 0x24]
        ]
    )
})

/**
 * Verifies record-view slicing for primitives whose normalized offsets include
 * the object-id/length prefix.
 */
test('PcbPrimitiveRecordSlicer slices length-prefixed full record views', () => {
    const record =
        PcbPrimitiveRecordSlicerTestFactory.createLengthPrefixedRecord(
            6,
            [0x31, 0x32, 0x33]
        )

    const records = PcbPrimitiveRecordSlicer.slicePrimitiveRecords({
        headerBytes: PcbPrimitiveRecordSlicerTestFactory.createHeader(1),
        dataBytes: record,
        objectId: 6,
        fixedRecordByteLength: 8,
        minimumPayloadByteLength: 3,
        lengthPrefixedView: 'record'
    })

    assert.deepEqual(
        Array.from(records[0].viewBytes),
        [6, 3, 0, 0, 0, 0x31, 0x32, 0x33]
    )
})

/**
 * Verifies fixed-record fallback remains available when an old stream has no
 * object-id/length prefixes.
 */
test('PcbPrimitiveRecordSlicer falls back to fixed records', () => {
    const dataBytes = new Uint8Array([
        0x41, 0x42, 0x43, 0x44, 0x51, 0x52, 0x53, 0x54
    ])

    const records = PcbPrimitiveRecordSlicer.slicePrimitiveRecords({
        headerBytes: PcbPrimitiveRecordSlicerTestFactory.createHeader(2),
        dataBytes,
        objectId: 1,
        fixedRecordByteLength: 4,
        minimumPayloadByteLength: 3,
        lengthPrefixedView: 'payload'
    })

    assert.deepEqual(
        records.map((record) => Array.from(record.viewBytes)),
        [
            [0x41, 0x42, 0x43, 0x44],
            [0x51, 0x52, 0x53, 0x54]
        ]
    )
})
