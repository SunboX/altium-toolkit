// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { ParserCompatibilityFuzzer } from '../../src/legacy-parser.mjs'

test('ParserCompatibilityFuzzer runs deterministic synthetic parser cases', () => {
    const report = ParserCompatibilityFuzzer.run()
    const repeat = ParserCompatibilityFuzzer.run()

    assert.equal(report.schema, 'altium-toolkit.parser-compatibility-fuzz.a1')
    assert.equal(report.summary.caseCount, 11)
    assert.equal(report.summary.failureCount, 0)
    assert.equal(report.summary.handledErrorCount, 2)
    assert.deepEqual(
        report.cases.map((entry) => entry.key),
        [
            'sch-record-ordering',
            'sch-odd-encoding',
            'pcb-malformed-sidecars',
            'project-sparse-documents',
            'draftsman-unsupported-container',
            'empty-schdoc',
            'random-pcbdoc',
            'random-pcblib',
            'random-intlib',
            'wrong-reader-schdoc-as-intlib',
            'unknown-extension-fallback'
        ]
    )
    assert.deepEqual(
        report.cases.map((entry) => entry.status),
        [
            'pass',
            'pass',
            'pass',
            'pass',
            'pass',
            'pass',
            'pass',
            'pass',
            'handled-error',
            'handled-error',
            'pass'
        ]
    )
    assert.deepEqual(
        report.cases
            .filter((entry) => entry.status === 'handled-error')
            .map((entry) => entry.expectedError),
        [true, true]
    )
    assert.equal(JSON.stringify(report), JSON.stringify(repeat))
})
