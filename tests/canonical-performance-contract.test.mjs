// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { runAltiumBenchmarks } from '../benchmarks/AltiumConvergenceBenchmark.mjs'

test('canonical Altium benchmark emits the complete provenance-bound contract', async () => {
    const report = await runAltiumBenchmarks({ quick: true })
    assert.equal(report.schema, 'altium-toolkit.benchmark-report.v1')
    assert.deepEqual(
        report.cases.map((row) => row.id),
        [
            'canonical-document',
            'no-extension-document',
            'canonical-project',
            'metadata-asset-document',
            'full-asset-document',
            'async-direct-document',
            'worker-protocol-roundtrip',
            'full-native-extension',
            'large-native-extension',
            'native-renderer-facade'
        ]
    )
    assert.equal(typeof report.passed, 'boolean')
    assert.equal(
        report.cases.every((row) => ['passed', 'failed'].includes(row.status)),
        true
    )
    for (const row of report.cases.filter((entry) =>
        Object.hasOwn(entry, 'baselineChecksum')
    )) {
        assert.equal(row.candidateChecksum, row.baselineChecksum, row.id)
    }
    assert.equal(
        report.cases.find((row) => row.id === 'canonical-project').allowanceMs,
        2.2
    )
})
