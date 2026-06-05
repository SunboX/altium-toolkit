// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { ParserCompatibilityFuzzer } from '../../src/parser.mjs'

test('ParserCompatibilityFuzzer runs deterministic synthetic parser cases', () => {
    const report = ParserCompatibilityFuzzer.run()
    const repeat = ParserCompatibilityFuzzer.run()

    assert.equal(report.schema, 'altium-toolkit.parser-compatibility-fuzz.a1')
    assert.equal(report.summary.caseCount, 5)
    assert.equal(report.summary.failureCount, 0)
    assert.deepEqual(
        report.cases.map((entry) => entry.key),
        [
            'sch-record-ordering',
            'sch-odd-encoding',
            'pcb-malformed-sidecars',
            'project-sparse-documents',
            'draftsman-unsupported-container'
        ]
    )
    assert.deepEqual(
        report.cases.map((entry) => entry.status),
        ['pass', 'pass', 'pass', 'pass', 'pass']
    )
    assert.equal(JSON.stringify(report), JSON.stringify(repeat))
})
