// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies parser diagnostics are normalized into one reusable envelope with
 * stable codes, severities, source metadata, and rollups.
 */
test('ParserDiagnosticNormalizer builds structured diagnostic reports', async () => {
    const { ParserDiagnosticNormalizer } = await import('../../src/parser.mjs')

    const report = ParserDiagnosticNormalizer.buildReport({
        defaults: { source: 'parser-unit' },
        diagnostics: [
            {
                severity: 'warn',
                message: 'Recovered record',
                sourceStream: 'Data',
                recordIndex: '4',
                fieldName: 'Name'
            },
            'Plain note',
            new Error('Parser crashed')
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.parser-diagnostics.a1')
    assert.deepEqual(report.summary, {
        diagnosticCount: 3,
        infoCount: 1,
        warningCount: 1,
        errorCount: 1
    })
    assert.deepEqual(report.diagnostics, [
        {
            code: 'parser.recovered.record',
            severity: 'warning',
            message: 'Recovered record',
            source: 'parser-unit',
            sourceStream: 'Data',
            recordIndex: 4,
            fieldName: 'Name'
        },
        {
            code: 'parser.plain.note',
            severity: 'info',
            message: 'Plain note',
            source: 'parser-unit'
        },
        {
            code: 'parser.parser.crashed',
            severity: 'error',
            message: 'Parser crashed',
            source: 'parser-unit'
        }
    ])
})

/**
 * Verifies explicit diagnostic codes and context metadata survive
 * normalization while unknown severities fall back to info.
 */
test('ParserDiagnosticNormalizer preserves explicit codes and context keys', async () => {
    const { ParserDiagnosticNormalizer } = await import('../../src/parser.mjs')

    const normalized = ParserDiagnosticNormalizer.normalize(
        {
            code: 'parser.custom',
            severity: 'notice',
            message: 'Custom condition',
            sourceStorage: 'StorageA',
            contextKey: 'component:U1'
        },
        { source: 'parser-unit', sourceStream: 'Fallback' }
    )

    assert.deepEqual(normalized, {
        code: 'parser.custom',
        severity: 'info',
        message: 'Custom condition',
        source: 'parser-unit',
        sourceStream: 'Fallback',
        sourceStorage: 'StorageA',
        contextKey: 'component:U1'
    })
})
