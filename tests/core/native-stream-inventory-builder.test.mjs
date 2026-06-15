// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    NativeStreamInventoryBuilder,
    RawDataPreservationReportBuilder
} from '../../src/parser.mjs'

/**
 * Encodes a short stream payload.
 * @param {string} text Stream text.
 * @returns {Uint8Array}
 */
function bytes(text) {
    return new TextEncoder().encode(text)
}

test('NativeStreamInventoryBuilder classifies consumed and opaque streams', () => {
    const inventory = NativeStreamInventoryBuilder.buildFromStreams(
        new Map([
            ['FileHeader', bytes('|HEADER=Sheet')],
            ['Components6/Data', bytes('|RECORD=Component')],
            ['Mystery/Blob', new Uint8Array([1, 2, 3])],
            ['Empty/Sidecar', new Uint8Array()]
        ]),
        {
            source: 'fixture',
            consumedStreamNames: ['FileHeader', 'Components6/Data'],
            knownStreamNames: ['FileHeader', 'Components6/Data']
        }
    )

    assert.equal(inventory.schema, 'altium-toolkit.native-stream-inventory.a1')
    assert.deepEqual(inventory.summary, {
        streamCount: 4,
        knownStreamCount: 2,
        unknownStreamCount: 2,
        consumedStreamCount: 2,
        unconsumedStreamCount: 2,
        emptyStreamCount: 1,
        byteCount: 33
    })
    assert.deepEqual(
        inventory.streams.map((stream) => ({
            sourceStream: stream.sourceStream,
            sourceStorage: stream.sourceStorage,
            leafName: stream.leafName,
            known: stream.known,
            consumed: stream.consumed,
            classification: stream.classification,
            byteLength: stream.byteLength,
            checksum: stream.checksum
        })),
        [
            {
                sourceStream: 'Components6/Data',
                sourceStorage: 'Components6',
                leafName: 'Data',
                known: true,
                consumed: true,
                classification: 'known-consumed',
                byteLength: 17,
                checksum: { algorithm: 'fnv1a32', value: '984d06c0' }
            },
            {
                sourceStream: 'Empty/Sidecar',
                sourceStorage: 'Empty',
                leafName: 'Sidecar',
                known: false,
                consumed: false,
                classification: 'unknown-empty',
                byteLength: 0,
                checksum: { algorithm: 'fnv1a32', value: '811c9dc5' }
            },
            {
                sourceStream: 'FileHeader',
                sourceStorage: '',
                leafName: 'FileHeader',
                known: true,
                consumed: true,
                classification: 'known-consumed',
                byteLength: 13,
                checksum: { algorithm: 'fnv1a32', value: '31b3f8e8' }
            },
            {
                sourceStream: 'Mystery/Blob',
                sourceStorage: 'Mystery',
                leafName: 'Blob',
                known: false,
                consumed: false,
                classification: 'unknown-opaque',
                byteLength: 3,
                checksum: { algorithm: 'fnv1a32', value: '56cf37ab' }
            }
        ]
    )
})

test('RawDataPreservationReportBuilder summarizes native stream inventory rows', () => {
    const report = RawDataPreservationReportBuilder.build({
        rawRecords: [
            {
                source: 'pcbdoc',
                sourceStream: 'Pads6/Data',
                family: 'pads',
                type: 'pad',
                byteLength: 8,
                supported: true,
                parsed: true
            }
        ],
        nativeStreams: [
            {
                source: 'pcbdoc',
                sourceStream: 'Pads6/Data',
                sourceStorage: 'Pads6',
                leafName: 'Data',
                byteLength: 8,
                known: true,
                consumed: true,
                classification: 'known-consumed',
                checksum: { algorithm: 'fnv1a32', value: '00000001' }
            }
        ],
        models: [
            {
                schematic: {
                    nativeStreams: {
                        streams: [
                            {
                                source: 'schdoc',
                                sourceStream: 'UnknownBlob',
                                sourceStorage: '',
                                leafName: 'UnknownBlob',
                                byteLength: 4,
                                known: false,
                                consumed: false,
                                classification: 'unknown-opaque',
                                checksum: {
                                    algorithm: 'fnv1a32',
                                    value: '00000002'
                                }
                            }
                        ]
                    }
                }
            }
        ]
    })

    assert.equal(report.summary.rawRecordCount, 1)
    assert.equal(report.summary.nativeStreamCount, 2)
    assert.equal(report.summary.unknownNativeStreamCount, 1)
    assert.equal(report.summary.unconsumedNativeStreamCount, 1)
    assert.equal(report.summary.nativeStreamByteCount, 12)
    assert.equal(report.summary.preservedByteCount, 8)
    assert.deepEqual(
        report.nativeStreams.map((stream) => ({
            source: stream.source,
            sourceStream: stream.sourceStream,
            classification: stream.classification,
            known: stream.known,
            consumed: stream.consumed,
            byteLength: stream.byteLength,
            checksum: stream.checksum
        })),
        [
            {
                source: 'pcbdoc',
                sourceStream: 'Pads6/Data',
                classification: 'known-consumed',
                known: true,
                consumed: true,
                byteLength: 8,
                checksum: { algorithm: 'fnv1a32', value: '00000001' }
            },
            {
                source: 'schdoc',
                sourceStream: 'UnknownBlob',
                classification: 'unknown-opaque',
                known: false,
                consumed: false,
                byteLength: 4,
                checksum: { algorithm: 'fnv1a32', value: '00000002' }
            }
        ]
    )
})
