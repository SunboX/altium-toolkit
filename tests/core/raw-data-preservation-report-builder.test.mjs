// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies raw-data preservation reports summarize supported, unsupported,
 * parsed, and unparsed preserved records without exposing decoded payload text.
 */
test('RawDataPreservationReportBuilder summarizes preserved raw records', async () => {
    const { RawDataPreservationReportBuilder } =
        await import('../../src/parser.mjs')

    assert.equal(typeof RawDataPreservationReportBuilder, 'function')

    const report = RawDataPreservationReportBuilder.build({
        rawRecords: [
            {
                source: 'pcbdoc',
                sourceStream: 'Tracks6/Data',
                family: 'tracks',
                type: 'track',
                byteLength: 12,
                supported: true,
                parsed: true,
                rawBase64: Buffer.from('track bytes').toString('base64')
            },
            {
                source: 'pcbdoc',
                sourceStream: 'Unknown6/Data',
                family: 'unknown',
                type: 'unknown',
                byteLength: 13,
                supported: false,
                parsed: false,
                rawBase64: Buffer.from('unknown bytes').toString('base64')
            }
        ],
        unknownRecords: [
            {
                sourceStorage: 'Footprint1',
                sourceStream: 'Footprint1/Data',
                typeId: 777,
                byteLength: 4
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.raw-data-preservation.a1')
    assert.deepEqual(report.summary, {
        rawRecordCount: 2,
        unknownRecordCount: 1,
        opaqueRecordCount: 0,
        supportedRawRecordCount: 1,
        unsupportedRawRecordCount: 1,
        parsedRawRecordCount: 1,
        unparsedRawRecordCount: 1,
        preservedByteCount: 29
    })
    assert.deepEqual(report.records, [
        {
            source: 'pcbdoc',
            sourceStream: 'Tracks6/Data',
            family: 'tracks',
            type: 'track',
            byteLength: 12,
            supported: true,
            parsed: true,
            hasRawPayload: true
        },
        {
            source: 'pcbdoc',
            sourceStream: 'Unknown6/Data',
            family: 'unknown',
            type: 'unknown',
            byteLength: 13,
            supported: false,
            parsed: false,
            hasRawPayload: true
        }
    ])
    assert.deepEqual(report.unknownRecords, [
        {
            sourceStorage: 'Footprint1',
            sourceStream: 'Footprint1/Data',
            typeId: 777,
            byteLength: 4
        }
    ])
})

/**
 * Verifies opaque schematic and library-style records are summarized without
 * exposing decoded payload bytes.
 */
test('RawDataPreservationReportBuilder summarizes opaque schematic records', async () => {
    const { RawDataPreservationReportBuilder } =
        await import('../../src/parser.mjs')

    const report = RawDataPreservationReportBuilder.build({
        opaqueRecords: [
            {
                source: 'schdoc',
                sourceStream: 'FileHeader',
                frameType: 1,
                recordIndex: 3,
                rawBase64: '3q2+7w=='
            }
        ],
        models: [
            {
                schematic: {
                    opaqueRecords: [
                        {
                            source: 'schdoc',
                            sourceStream: 'Additional',
                            frameType: 2,
                            recordIndex: 4,
                            byteLength: 6
                        }
                    ]
                },
                schematicLibrary: {
                    components: [
                        {
                            opaqueRecords: [
                                {
                                    source: 'schlib',
                                    sourceStorage: 'ComponentA',
                                    sourceStream: 'Data',
                                    frameType: 7,
                                    recordIndex: 1,
                                    rawBase64: 'AQID'
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.summary.opaqueRecordCount, 3)
    assert.equal(report.summary.preservedByteCount, 13)
    assert.deepEqual(report.opaqueRecords, [
        {
            source: 'schdoc',
            sourceStream: 'FileHeader',
            frameType: 1,
            recordIndex: 3,
            byteLength: 4,
            hasRawPayload: true
        },
        {
            source: 'schdoc',
            sourceStream: 'Additional',
            frameType: 2,
            recordIndex: 4,
            byteLength: 6,
            hasRawPayload: false
        },
        {
            source: 'schlib',
            sourceStorage: 'ComponentA',
            sourceStream: 'Data',
            frameType: 7,
            recordIndex: 1,
            byteLength: 3,
            hasRawPayload: true
        }
    ])
})

/**
 * Verifies parser root models can be passed directly to the preservation
 * report builder.
 */
test('RawDataPreservationReportBuilder reads parser root PCB raw records', async () => {
    const { RawDataPreservationReportBuilder } =
        await import('../../src/parser.mjs')

    const report = RawDataPreservationReportBuilder.build({
        models: [
            {
                pcb: {
                    rawRecords: [
                        {
                            source: 'pcbdoc',
                            sourceStream: 'Vias6/Data',
                            family: 'vias',
                            type: 'via',
                            byteLength: 3,
                            supported: true,
                            parsed: true,
                            rawBase64: 'AQID'
                        }
                    ]
                },
                pcbLibrary: {
                    footprints: [
                        {
                            rawRecords: [
                                {
                                    source: 'pcblib',
                                    sourceStream: 'Fp/Data',
                                    family: 'pads',
                                    type: 'pad',
                                    byteLength: 2,
                                    supported: true,
                                    parsed: true,
                                    rawBase64: 'BAU='
                                }
                            ],
                            unknownRecords: [
                                {
                                    sourceStream: 'Fp/Data',
                                    typeId: 999,
                                    byteLength: 8
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    })

    assert.deepEqual(report.summary, {
        rawRecordCount: 2,
        unknownRecordCount: 1,
        opaqueRecordCount: 0,
        supportedRawRecordCount: 2,
        unsupportedRawRecordCount: 0,
        parsedRawRecordCount: 2,
        unparsedRawRecordCount: 0,
        preservedByteCount: 13
    })
})

/**
 * Verifies base64 byte counts remain browser-safe when explicit byte lengths
 * are not available.
 */
test('RawDataPreservationReportBuilder counts base64 payload bytes without Buffer', async () => {
    const { RawDataPreservationReportBuilder } =
        await import('../../src/parser.mjs')
    const originalBuffer = globalThis.Buffer

    try {
        globalThis.Buffer = undefined
        const report = RawDataPreservationReportBuilder.build({
            rawRecords: [
                {
                    source: 'pcbdoc',
                    sourceStream: 'Vias6/Data',
                    family: 'vias',
                    type: 'via',
                    supported: true,
                    parsed: true,
                    rawBase64: 'AQIDBAU='
                }
            ]
        })

        assert.equal(report.records[0].byteLength, 5)
        assert.equal(report.summary.preservedByteCount, 5)
    } finally {
        globalThis.Buffer = originalBuffer
    }
})
