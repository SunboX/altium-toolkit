// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AsciiRecordParser } from '../../src/core/altium/AsciiRecordParser.mjs'

test('AsciiRecordParser keeps ASCII-only field parsing on the byte-string fast path', (t) => {
    const originalTextDecoder = globalThis.TextDecoder

    class ThrowingTextDecoder {
        /**
         * Fails when plain ASCII fields take the legacy decoder path.
         */
        constructor() {
            throw new Error('unexpected decoder use for ASCII field')
        }
    }

    t.after(() => {
        globalThis.TextDecoder = originalTextDecoder
    })
    globalThis.TextDecoder = ThrowingTextDecoder

    const payload = Buffer.from(
        'noise\u0000|RECORD=1|NAME=R1|VALUE=10K|COMMENT= pullup |\u0000tail',
        'latin1'
    )
    const arrayBuffer = payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength
    )

    const records = AsciiRecordParser.parse(arrayBuffer)

    assert.equal(records.length, 1)
    assert.equal(records[0].fields.NAME, 'R1')
    assert.equal(records[0].fields.VALUE, '10K')
    assert.equal(records[0].fields.COMMENT, 'pullup')
})

test('AsciiRecordParser decodes GBK-encoded printable PCB field values', () => {
    const prefix = Buffer.from(
        '|RECORD=1|PATTERN=0402|SOURCEDESIGNATOR=C1|SOURCELIBREFERENCE=CAP/0402|SOURCEDESCRIPTION=',
        'latin1'
    )
    const description = Buffer.from('ccf9c6acb5e7c8dd32325028524f485329', 'hex')
    const suffix = Buffer.from('|', 'latin1')
    const payload = Buffer.concat([prefix, description, suffix])
    const arrayBuffer = payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength
    )

    const records = AsciiRecordParser.parse(arrayBuffer)

    assert.equal(records.length, 1)
    assert.equal(records[0].fields.SOURCEDESCRIPTION, '贴片电容22P(ROHS)')
})

test('AsciiRecordParser decodes Windows-1252 printable PCB field values', () => {
    const payload = Buffer.concat([
        Buffer.from('|RECORD=1|NAME=MARKING|VALUE=ESD', 'latin1'),
        Buffer.from([0x96]),
        Buffer.from('TVS|', 'latin1')
    ])
    const arrayBuffer = payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength
    )

    const records = AsciiRecordParser.parse(arrayBuffer)

    assert.equal(records.length, 1)
    assert.equal(records[0].fields.VALUE, 'ESD–TVS')
})
