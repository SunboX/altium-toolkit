// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies parser value reports compare curated expected paths against actual
 * parser output and classify mismatches separately from missing paths.
 */
test('ParserValueVerificationReportBuilder reports path-level value mismatches', async () => {
    const { ParserValueVerificationReportBuilder } =
        await import('../../src/parser.mjs')

    const report = ParserValueVerificationReportBuilder.build({
        cases: [
            {
                key: 'fake-schematic-values',
                source: 'value-gate.SchDoc',
                actual: {
                    summary: { title: 'Value gate' },
                    schematic: {
                        texts: [{ text: 'DATA', x: 10 }],
                        pins: [{ name: 'CS', designator: '1' }]
                    }
                },
                expectedValues: {
                    'summary.title': 'Value gate',
                    'schematic.texts[0].text': 'DATA',
                    'schematic.texts[0].x': 12,
                    'schematic.components[0].designator': 'U1'
                }
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.parser-value-verification.a1')
    assert.deepEqual(report.summary, {
        caseCount: 1,
        assertionCount: 4,
        passedCount: 2,
        failedCount: 2,
        mismatchCount: 1,
        missingCount: 1,
        status: 'failed'
    })
    assert.deepEqual(report.cases, [
        {
            key: 'fake-schematic-values',
            source: 'value-gate.SchDoc',
            status: 'failed',
            assertionCount: 4,
            passedCount: 2,
            failedCount: 2,
            failures: [
                {
                    path: 'schematic.texts[0].x',
                    status: 'mismatch',
                    expected: 12,
                    actual: 10,
                    message:
                        'Expected schematic.texts[0].x to equal 12 but received 10.'
                },
                {
                    path: 'schematic.components[0].designator',
                    status: 'missing',
                    expected: 'U1',
                    actual: null,
                    message:
                        'Expected schematic.components[0].designator to equal "U1" but the path was missing.'
                }
            ]
        }
    ])
    assert.deepEqual(report.failures, [
        {
            caseKey: 'fake-schematic-values',
            source: 'value-gate.SchDoc',
            path: 'schematic.texts[0].x',
            status: 'mismatch',
            expected: 12,
            actual: 10,
            message:
                'Expected schematic.texts[0].x to equal 12 but received 10.'
        },
        {
            caseKey: 'fake-schematic-values',
            source: 'value-gate.SchDoc',
            path: 'schematic.components[0].designator',
            status: 'missing',
            expected: 'U1',
            actual: null,
            message:
                'Expected schematic.components[0].designator to equal "U1" but the path was missing.'
        }
    ])
})

/**
 * Verifies assertion-array manifests can carry stable labels for downstream
 * fixture gates without changing the comparison behavior.
 */
test('ParserValueVerificationReportBuilder accepts labelled expected assertions', async () => {
    const { ParserValueVerificationReportBuilder } =
        await import('../../src/parser.mjs')

    const report = ParserValueVerificationReportBuilder.build({
        cases: [
            {
                key: 'fake-pcb-values',
                actual: {
                    pcb: {
                        pads: [{ designator: '1', holeSize: 20 }]
                    }
                },
                expected: [
                    {
                        path: 'pcb.pads[0].designator',
                        expected: '1',
                        label: 'first pad designator'
                    },
                    {
                        path: 'pcb.pads[0].holeSize',
                        expected: 20,
                        label: 'first pad drill'
                    }
                ]
            }
        ]
    })

    assert.equal(report.summary.status, 'passed')
    assert.equal(report.summary.assertionCount, 2)
    assert.equal(report.summary.failedCount, 0)
    assert.deepEqual(report.failures, [])
    assert.deepEqual(
        report.cases[0].assertions.map((assertion) => assertion.label),
        ['first pad designator', 'first pad drill']
    )
})
