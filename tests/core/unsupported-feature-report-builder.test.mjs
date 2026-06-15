// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies unsupported feature reports collect preserved-but-not-modeled
 * records and diagnostics across parser roots.
 */
test('UnsupportedFeatureReportBuilder summarizes unsupported parser features', async () => {
    const { UnsupportedFeatureReportBuilder } =
        await import('../../src/parser.mjs')

    assert.equal(typeof UnsupportedFeatureReportBuilder, 'function')

    const report = UnsupportedFeatureReportBuilder.build({
        models: [
            {
                fileName: 'summary.SchDoc',
                schematic: {
                    recordTypes: [
                        {
                            recordType: 13,
                            name: 'line',
                            family: 'graphic',
                            supported: true,
                            count: 1
                        },
                        {
                            recordType: 999,
                            name: 'unknown-999',
                            family: 'unknown',
                            supported: false,
                            count: 2
                        }
                    ],
                    opaqueRecords: [
                        {
                            sourceStream: 'FileHeader',
                            frameType: 2,
                            recordIndex: 6,
                            byteLength: 12
                        }
                    ]
                },
                diagnostics: [
                    {
                        code: 'parser.unsupported-feature',
                        severity: 'warning',
                        message: 'Parser preserved an unknown record.',
                        sourceStream: 'FileHeader',
                        recordType: 999
                    }
                ]
            }
        ],
        rawRecords: [
            {
                fileName: 'summary.PcbDoc',
                sourceStream: 'Unknown6/Data',
                family: 'unknown',
                type: 'unknown',
                byteLength: 9,
                supported: false,
                parsed: false
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.unsupported-features.a1')
    assert.deepEqual(report.summary, {
        modelCount: 1,
        unsupportedRecordTypeCount: 1,
        rawRecordCount: 1,
        opaqueRecordCount: 1,
        diagnosticCount: 1,
        itemCount: 4,
        status: 'unsupported'
    })
    assert.deepEqual(report.recordTypes, [
        {
            fileName: 'summary.SchDoc',
            domain: 'schematic',
            recordType: 999,
            name: 'unknown-999',
            family: 'unknown',
            count: 2
        }
    ])
    assert.deepEqual(report.rawRecords, [
        {
            fileName: 'summary.PcbDoc',
            domain: 'pcb',
            sourceStream: 'Unknown6/Data',
            family: 'unknown',
            type: 'unknown',
            byteLength: 9,
            supported: false,
            parsed: false
        }
    ])
    assert.deepEqual(report.opaqueRecords, [
        {
            fileName: 'summary.SchDoc',
            domain: 'schematic',
            sourceStream: 'FileHeader',
            frameType: 2,
            recordIndex: 6,
            byteLength: 12
        }
    ])
    assert.deepEqual(report.diagnostics, [
        {
            fileName: 'summary.SchDoc',
            code: 'parser.unsupported-feature',
            severity: 'warning',
            message: 'Parser preserved an unknown record.',
            sourceStream: 'FileHeader',
            recordType: 999
        }
    ])
})

/**
 * Verifies reports without unsupported evidence return an empty supported
 * summary shape.
 */
test('UnsupportedFeatureReportBuilder returns supported status when clear', async () => {
    const { UnsupportedFeatureReportBuilder } =
        await import('../../src/parser.mjs')

    const report = UnsupportedFeatureReportBuilder.build({
        models: [
            {
                fileName: 'clear.SchDoc',
                schematic: {
                    recordTypes: [
                        {
                            recordType: 13,
                            name: 'line',
                            family: 'graphic',
                            supported: true,
                            count: 1
                        }
                    ]
                }
            }
        ]
    })

    assert.deepEqual(report.summary, {
        modelCount: 1,
        unsupportedRecordTypeCount: 0,
        rawRecordCount: 0,
        opaqueRecordCount: 0,
        diagnosticCount: 0,
        itemCount: 0,
        status: 'supported'
    })
    assert.deepEqual(report.recordTypes, [])
    assert.deepEqual(report.rawRecords, [])
    assert.deepEqual(report.opaqueRecords, [])
    assert.deepEqual(report.diagnostics, [])
})
