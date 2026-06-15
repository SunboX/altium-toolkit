// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies parser field coverage reports expose observed, mapped, and missing
 * native fields by normalized primitive family.
 */
test('ParserFieldCoverageReportBuilder reports mapped and missing fields', async () => {
    const { ParserFieldCoverageReportBuilder } =
        await import('../../src/parser.mjs')

    assert.equal(typeof ParserFieldCoverageReportBuilder, 'function')

    const report = ParserFieldCoverageReportBuilder.build({
        schematicRecords: [
            {
                sourceStream: 'FileHeader',
                fields: {
                    RECORD: '13',
                    'Location.X': '10',
                    'Location.Y': '20',
                    'Corner.X': '30',
                    'Corner.Y': '40',
                    LineWidth: '1',
                    CustomLineField: 'preserved'
                }
            },
            {
                sourceStream: 'FileHeader',
                fields: {
                    RECORD: '226',
                    URL: 'https://example.invalid'
                }
            }
        ],
        pcbRecords: [
            {
                sourceStream: 'Tracks6/Data',
                fields: {
                    X1: '1',
                    Y1: '2',
                    X2: '3',
                    Y2: '4',
                    WIDTH: '5',
                    LAYER: '1',
                    CUSTOMTRACKFIELD: 'preserved'
                }
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.parser-field-coverage.a1')
    assert.deepEqual(report.summary, {
        familyCount: 3,
        observedFieldCount: 14,
        mappedFieldCount: 12,
        missingFieldCount: 2,
        unsupportedFieldCount: 0,
        supportedFamilyCount: 3,
        unsupportedFamilyCount: 0,
        completeFamilyCount: 1,
        partialFamilyCount: 2,
        mappedFieldCoverageRatio: 0.8571
    })
    assert.deepEqual(report.matrix, {
        columns: [
            'domain',
            'family',
            'status',
            'observedFieldCount',
            'mappedFieldCount',
            'missingFieldCount',
            'unsupportedFieldCount',
            'mappedRatio'
        ],
        rows: [
            {
                domain: 'schematic',
                family: 'hyperlink',
                status: 'complete',
                observedFieldCount: 1,
                mappedFieldCount: 1,
                missingFieldCount: 0,
                unsupportedFieldCount: 0,
                mappedRatio: 1
            },
            {
                domain: 'schematic',
                family: 'line',
                status: 'partial',
                observedFieldCount: 6,
                mappedFieldCount: 5,
                missingFieldCount: 1,
                unsupportedFieldCount: 0,
                mappedRatio: 0.8333
            },
            {
                domain: 'pcb',
                family: 'tracks',
                status: 'partial',
                observedFieldCount: 7,
                mappedFieldCount: 6,
                missingFieldCount: 1,
                unsupportedFieldCount: 0,
                mappedRatio: 0.8571
            }
        ]
    })

    const line = report.families.find(
        (entry) => entry.domain === 'schematic' && entry.family === 'line'
    )
    assert.deepEqual(line.coverage, {
        status: 'partial',
        observedFieldCount: 6,
        mappedFieldCount: 5,
        missingFieldCount: 1,
        unsupportedFieldCount: 0,
        mappedRatio: 0.8333
    })
    assert.deepEqual(line.mappedFields, [
        {
            sourceField: 'Corner.X',
            modelField: 'schematic.lines[].x2'
        },
        {
            sourceField: 'Corner.Y',
            modelField: 'schematic.lines[].y2'
        },
        {
            sourceField: 'LineWidth',
            modelField: 'schematic.lines[].width'
        },
        {
            sourceField: 'Location.X',
            modelField: 'schematic.lines[].x1'
        },
        {
            sourceField: 'Location.Y',
            modelField: 'schematic.lines[].y1'
        }
    ])
    assert.deepEqual(line.missingFields, ['CustomLineField'])

    const hyperlink = report.families.find(
        (entry) => entry.domain === 'schematic' && entry.family === 'hyperlink'
    )
    assert.equal(hyperlink.supported, true)
    assert.deepEqual(hyperlink.mappedFields, [
        {
            sourceField: 'URL',
            modelField: 'schematic.hyperlinks[].url'
        }
    ])
})

/**
 * Verifies the coverage builder can summarize parser roots that already carry
 * schematic and PCB source records.
 */
test('ParserFieldCoverageReportBuilder reads parser root source records', async () => {
    const { ParserFieldCoverageReportBuilder } =
        await import('../../src/parser.mjs')

    const report = ParserFieldCoverageReportBuilder.build({
        models: [
            {
                schematic: {
                    sourceRecords: [
                        {
                            fields: {
                                RECORD: '4',
                                Text: 'NET_A',
                                'Location.X': '1',
                                'Location.Y': '2'
                            }
                        }
                    ]
                },
                pcb: {
                    sourceRecords: [
                        {
                            sourceStream: 'Pads6/Data',
                            fields: {
                                NAME: '1',
                                X: '10',
                                Y: '20',
                                HOLESIZE: '30'
                            }
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.summary.familyCount, 2)
    assert.equal(report.summary.missingFieldCount, 0)
    assert.deepEqual(
        report.families.map((entry) => entry.family),
        ['label', 'pads']
    )
})

/**
 * Verifies parser field coverage ignores structural fields regardless of
 * source key casing while still mapping supported fields case-insensitively.
 */
test('ParserFieldCoverageReportBuilder ignores structural field casing', async () => {
    const { ParserFieldCoverageReportBuilder } =
        await import('../../src/parser.mjs')

    const report = ParserFieldCoverageReportBuilder.build({
        schematicRecords: [
            {
                fields: {
                    record: '4',
                    text: 'NET_A',
                    'location.x': '1',
                    'location.y': '2'
                }
            }
        ]
    })

    assert.deepEqual(report.summary, {
        familyCount: 1,
        observedFieldCount: 3,
        mappedFieldCount: 3,
        missingFieldCount: 0,
        unsupportedFieldCount: 0,
        supportedFamilyCount: 1,
        unsupportedFamilyCount: 0,
        completeFamilyCount: 1,
        partialFamilyCount: 0,
        mappedFieldCoverageRatio: 1
    })
    assert.deepEqual(report.families[0].mappedFields, [
        {
            sourceField: 'location.x',
            modelField: 'schematic.texts[].x'
        },
        {
            sourceField: 'location.y',
            modelField: 'schematic.texts[].y'
        },
        {
            sourceField: 'text',
            modelField: 'schematic.texts[].text'
        }
    ])
})
