// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicRecordStreamParser } from '../../src/legacy-parser.mjs'

/**
 * Verifies framed schematic streams preserve non-property frames as opaque
 * payload metadata while still exposing printable records normally.
 */
test('SchematicRecordStreamParser preserves opaque framed records', () => {
    const payload = SchematicRecordStreamParserTestData.framedBytes([
        {
            frameType: 0,
            text: '|RECORD=31|CustomX=120|CustomY=80'
        },
        {
            frameType: 1,
            bytes: new Uint8Array([0xde, 0xad, 0xbe, 0xef])
        }
    ])
    const parsed = SchematicRecordStreamParser.parseWithOpaqueRecords(payload, {
        sourceStream: 'FileHeader'
    })

    assert.equal(parsed.records.length, 1)
    assert.equal(parsed.records[0].fields.RECORD, '31')
    assert.deepEqual(parsed.opaqueRecords, [
        {
            source: 'schdoc',
            sourceStream: 'FileHeader',
            frameType: 1,
            recordIndex: 1,
            byteLength: 4,
            rawBase64: '3q2+7w=='
        }
    ])
})

/**
 * Test helpers for schematic stream parser payloads.
 */
class SchematicRecordStreamParserTestData {
    /**
     * Builds one native framed schematic stream.
     * @param {{ frameType: number, text?: string, bytes?: Uint8Array }[]} frames
     * @returns {ArrayBuffer}
     */
    static framedBytes(frames) {
        const chunks = frames.map((frame) =>
            SchematicRecordStreamParserTestData.#frameBytes(frame)
        )
        const totalLength = chunks.reduce(
            (sum, chunk) => sum + chunk.byteLength,
            0
        )
        const bytes = new Uint8Array(totalLength)
        let offset = 0

        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )
    }

    /**
     * Builds one length-prefixed native frame.
     * @param {{ frameType: number, text?: string, bytes?: Uint8Array }} frame
     * @returns {Uint8Array}
     */
    static #frameBytes(frame) {
        const payload = frame.text
            ? new TextEncoder().encode(frame.text + '\0')
            : frame.bytes || new Uint8Array()
        const bytes = new Uint8Array(4 + payload.byteLength)
        const dataView = new DataView(bytes.buffer)

        dataView.setUint16(0, payload.byteLength, true)
        bytes[2] = 0
        bytes[3] = frame.frameType
        bytes.set(payload, 4)

        return bytes
    }
}
