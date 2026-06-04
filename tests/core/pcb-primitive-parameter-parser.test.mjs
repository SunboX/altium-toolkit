// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbPrimitiveParameterParser } from '../../src/core/altium/PcbPrimitiveParameterParser.mjs'

/**
 * Encodes length-prefixed PrimitiveParameters/Data records from byte payloads.
 * @param {Uint8Array[]} records
 * @returns {Uint8Array}
 */
function encodePrimitiveParameterRecords(records) {
    const totalLength = records.reduce(
        (sum, record) => sum + 4 + record.byteLength,
        0
    )
    const dataBytes = new Uint8Array(totalLength)
    const dataView = new DataView(dataBytes.buffer)
    let offset = 0

    for (const record of records) {
        dataView.setUint32(offset, record.byteLength, true)
        offset += 4
        dataBytes.set(record, offset)
        offset += record.byteLength
    }

    return dataBytes
}

test('PcbPrimitiveParameterParser decodes Windows-1252 parameter values', () => {
    const groupRecord = Buffer.from(
        '|PRIMITIVEID=UID-A1|ID=Component#0|COUNT=1',
        'latin1'
    )
    const valueRecord = Buffer.concat([
        Buffer.from('|NAME=Label|VALUE=ESD', 'latin1'),
        Buffer.from([0x96]),
        Buffer.from('TVS', 'latin1')
    ])

    const parsed = PcbPrimitiveParameterParser.parse(
        encodePrimitiveParameterRecords([groupRecord, valueRecord])
    )

    assert.equal(parsed.groups.length, 1)
    assert.equal(parsed.byPrimitiveId['UID-A1'].Label, 'ESD–TVS')
})
