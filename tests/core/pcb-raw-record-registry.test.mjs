// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbRawRecordRegistry } from '../../src/core/altium/PcbRawRecordRegistry.mjs'
import { PcbStreamExtractor } from '../../src/core/altium/PcbStreamExtractor.mjs'
import { PcbBinaryPrimitiveTestFactory } from './PcbBinaryPrimitiveTestFactory.mjs'

/**
 * Creates a map containing one primitive stream pair.
 * @param {string} streamPrefix
 * @param {{ headerBytes: Uint8Array, dataBytes: Uint8Array }} stream
 * @returns {Map<string, Uint8Array>}
 */
function createSinglePrimitiveStreamMap(streamPrefix, stream) {
    return new Map([
        [streamPrefix + '/Header', stream.headerBytes],
        [streamPrefix + '/Data', stream.dataBytes]
    ])
}

/**
 * Builds a little-endian primitive record-count header.
 * @param {number} count Number of primitive records.
 * @returns {Uint8Array}
 */
function createRecordCountHeader(count) {
    const bytes = new Uint8Array(4)
    new DataView(bytes.buffer).setUint32(0, count, true)
    return bytes
}

/**
 * Builds generic fixed-length track records with valid payload lengths.
 * @param {number} count Number of fake track records.
 * @returns {Uint8Array}
 */
function createTrackData(count) {
    const recordByteLength = 49
    const payloadByteLength = 44
    const bytes = new Uint8Array(count * recordByteLength)

    for (let index = 0; index < count; index += 1) {
        const offset = index * recordByteLength
        bytes[offset] = 4
        new DataView(bytes.buffer).setUint32(
            offset + 1,
            payloadByteLength,
            true
        )
    }

    return bytes
}

/**
 * Verifies the parser entrypoint exposes the read-only raw-record registry.
 */
test('parser entrypoint exports PcbRawRecordRegistry', async () => {
    const parserEntrypoint = await import('../../src/legacy-parser.mjs')

    assert.equal(
        typeof parserEntrypoint.PcbComponentPrimitiveIndexer,
        'function'
    )
    assert.equal(typeof parserEntrypoint.PcbRawRecordRegistry, 'function')
    assert.ok(
        parserEntrypoint.PcbRawRecordRegistry.pcbDocDescriptors().some(
            (descriptor) => descriptor.sourceStream === 'Tracks6/Data'
        )
    )
})

/**
 * Verifies PcbDoc extraction keeps byte-preserving metadata for known
 * primitive records in both length-prefixed and legacy fixed stream formats.
 */
test('PcbStreamExtractor preserves raw PcbDoc primitive records', () => {
    const trackStream = PcbBinaryPrimitiveTestFactory.createTrackStream()
    const fillStream = PcbBinaryPrimitiveTestFactory.createFillStream()
    const streams = new Map([
        ['Tracks6/Header', trackStream.headerBytes],
        ['Tracks6/Data', trackStream.dataBytes],
        ['Fills6/Header', fillStream.headerBytes],
        ['Fills6/Data', fillStream.dataBytes]
    ])
    const extracted = PcbStreamExtractor.extractFromStreams(streams)
    const trackRecord = extracted.rawRecords.find(
        (record) => record.sourceStream === 'Tracks6/Data'
    )
    const fillRecord = extracted.rawRecords.find(
        (record) => record.sourceStream === 'Fills6/Data'
    )

    assert.equal(extracted.rawRecords.length, 2)
    assert.deepEqual(
        {
            source: trackRecord.source,
            sourceStream: trackRecord.sourceStream,
            headerStream: trackRecord.headerStream,
            family: trackRecord.family,
            type: trackRecord.type,
            typeId: trackRecord.typeId,
            recordIndex: trackRecord.recordIndex,
            offset: trackRecord.offset,
            byteLength: trackRecord.byteLength,
            payloadByteLength: trackRecord.payloadByteLength,
            encoding: trackRecord.encoding,
            supported: trackRecord.supported,
            parsed: trackRecord.parsed
        },
        {
            source: 'pcbdoc',
            sourceStream: 'Tracks6/Data',
            headerStream: 'Tracks6/Header',
            family: 'tracks',
            type: 'track',
            typeId: 4,
            recordIndex: 0,
            offset: 0,
            byteLength: 54,
            payloadByteLength: 49,
            encoding: 'length-prefixed',
            supported: true,
            parsed: true
        }
    )
    assert.equal(
        trackRecord.rawBase64,
        Buffer.from(trackStream.dataBytes).toString('base64')
    )
    assert.deepEqual(
        {
            family: fillRecord.family,
            type: fillRecord.type,
            typeId: fillRecord.typeId,
            byteLength: fillRecord.byteLength,
            payloadByteLength: fillRecord.payloadByteLength,
            encoding: fillRecord.encoding,
            supported: fillRecord.supported,
            parsed: fillRecord.parsed,
            rawBase64: fillRecord.rawBase64
        },
        {
            family: 'fills',
            type: 'fill',
            typeId: 6,
            byteLength: 55,
            payloadByteLength: null,
            encoding: 'fixed',
            supported: true,
            parsed: true,
            rawBase64: Buffer.from(fillStream.dataBytes).toString('base64')
        }
    )
    assert.equal(extracted.diagnostics.rawRecordCount, 2)
})

/**
 * Verifies compact via streams are decoded and represented as individual raw
 * primitive records.
 */
test('PcbStreamExtractor preserves compact via primitive records', () => {
    const viaStream = PcbBinaryPrimitiveTestFactory.createCompactViaStream()
    const streams = new Map([
        ['Vias6/Header', viaStream.headerBytes],
        ['Vias6/Data', viaStream.dataBytes]
    ])
    const extracted = PcbStreamExtractor.extractFromStreams(streams)

    assert.equal(extracted.binaryPrimitives.vias.length, 2)
    assert.equal(extracted.rawRecords.length, 2)
    assert.deepEqual(
        extracted.rawRecords.map((record) => ({
            family: record.family,
            type: record.type,
            byteLength: record.byteLength,
            payloadByteLength: record.payloadByteLength,
            encoding: record.encoding,
            parsed: record.parsed
        })),
        [
            {
                family: 'vias',
                type: 'via',
                byteLength: 214,
                payloadByteLength: 209,
                encoding: 'length-prefixed',
                parsed: true
            },
            {
                family: 'vias',
                type: 'via',
                byteLength: 214,
                payloadByteLength: 209,
                encoding: 'length-prefixed',
                parsed: true
            }
        ]
    )
})

/**
 * Verifies large primitive batches are appended without exceeding JavaScript
 * engine argument limits.
 */
test('PcbRawRecordRegistry collects large PcbDoc raw stream batches iteratively', () => {
    const recordCount = 140000
    const streams = new Map([
        ['Tracks6/Header', createRecordCountHeader(recordCount)],
        ['Tracks6/Data', createTrackData(recordCount)]
    ])

    const records = PcbRawRecordRegistry.collectPcbDocRecords(streams, {
        tracks: []
    })

    assert.equal(records.length, recordCount)
    assert.equal(records.at(0)?.registryId, 'pcbdoc:Tracks6/Data:0')
    assert.equal(
        records.at(-1)?.registryId,
        'pcbdoc:Tracks6/Data:' + (recordCount - 1)
    )
})

/**
 * Verifies raw preservation for subrecord-list primitives does not recurse over
 * every remaining record when it validates stream boundaries.
 */
test('PcbRawRecordRegistry collects large subrecord-list batches iteratively', () => {
    const recordCount = 12_000
    const padStream =
        PcbBinaryPrimitiveTestFactory.createLargePadStream(recordCount)
    const records = PcbRawRecordRegistry.collectPcbDocRecords(
        createSinglePrimitiveStreamMap('Pads6', padStream),
        { pads: [] }
    )

    assert.equal(records.length, recordCount)
    assert.equal(records.at(0)?.registryId, 'pcbdoc:Pads6/Data:0')
    assert.equal(
        records.at(-1)?.registryId,
        'pcbdoc:Pads6/Data:' + (recordCount - 1)
    )
    assert.equal(records.at(-1)?.encoding, 'subrecord-list')
})

/**
 * Verifies unsupported bytes in a registered stream are still represented as a
 * raw read-only record instead of disappearing from extraction output.
 */
test('PcbStreamExtractor preserves unparsed registered stream bytes', () => {
    const extracted = PcbStreamExtractor.extractFromStreams(
        createSinglePrimitiveStreamMap('Tracks6', {
            headerBytes: new Uint8Array([1, 0, 0, 0]),
            dataBytes: new Uint8Array([0xff, 0x01, 0x02])
        })
    )

    assert.deepEqual(extracted.binaryPrimitives.tracks, [])
    assert.deepEqual(extracted.rawRecords, [
        {
            registryId: 'pcbdoc:Tracks6/Data:0',
            source: 'pcbdoc',
            sourceStream: 'Tracks6/Data',
            headerStream: 'Tracks6/Header',
            family: 'tracks',
            type: 'track',
            typeId: 4,
            recordIndex: 0,
            offset: 0,
            byteLength: 3,
            payloadByteLength: null,
            encoding: 'unparsed-stream',
            supported: true,
            parsed: false,
            rawBase64: '/wEC'
        }
    ])
    assert.deepEqual(extracted.streamNames, ['Tracks6/Data'])
})
