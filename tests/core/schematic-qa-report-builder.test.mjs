// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicQaReportBuilder } from '../../src/legacy-parser.mjs'

test('SchematicQaReportBuilder reuses title-block residue for findings', () => {
    const originalToLowerCase = String.prototype.toLowerCase
    let lowercaseCalls = 0

    String.prototype.toLowerCase = function trackedToLowerCase(...args) {
        lowercaseCalls += 1
        return originalToLowerCase.apply(this, args)
    }

    try {
        const report = SchematicQaReportBuilder.build({
            records: [
                {
                    recordIndex: 1,
                    fields: { RECORD: '31', TitleBlockOn: 'F' }
                },
                {
                    recordIndex: 2,
                    fields: {
                        RECORD: '41',
                        Name: ' Title ',
                        Text: ' =BoardTitle ',
                        IsHidden: 'T'
                    }
                }
            ]
        })

        assert.equal(report.titleBlockResidue.length, 1)
        assert.equal(
            report.findings.some(
                (finding) =>
                    finding.code === 'schematic.title-block.hidden-residue'
            ),
            true
        )
    } finally {
        String.prototype.toLowerCase = originalToLowerCase
    }

    assert.equal(lowercaseCalls, 1)
})

test('SchematicQaReportBuilder reads unresolved parameter text once', () => {
    let textReads = 0
    const parameterFields = {
        RECORD: '4',
        get Text() {
            textReads += 1
            return '=BoardTitle'
        }
    }

    const report = SchematicQaReportBuilder.build({
        records: [
            {
                recordIndex: 1,
                fields: { RECORD: '41', Name: 'BoardTitle', Text: 'Resolved' }
            },
            {
                recordIndex: 2,
                fields: parameterFields
            }
        ]
    })

    assert.deepEqual(report.unresolvedParameters, ['BoardTitle'])
    assert.equal(textReads, 1)
})

test('SchematicQaReportBuilder reads matching title-block names once', () => {
    let nameReads = 0
    const titleFields = {
        RECORD: '41',
        IsHidden: 'T',
        Text: '=BoardTitle',
        get Name() {
            nameReads += 1
            return ' Title '
        }
    }

    const report = SchematicQaReportBuilder.build({
        records: [
            {
                recordIndex: 1,
                fields: { RECORD: '31', TitleBlockOn: 'F' }
            },
            {
                recordIndex: 2,
                fields: titleFields
            }
        ]
    })

    assert.deepEqual(report.titleBlockResidue, [
        {
            recordKey: 'schematic-record-2',
            name: 'Title',
            value: '=BoardTitle'
        }
    ])
    assert.equal(nameReads, 1)
})
