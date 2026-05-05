import assert from 'node:assert/strict'
import test from 'node:test'
import { AsciiRecordParser } from '../../src/core/altium/AsciiRecordParser.mjs'

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
