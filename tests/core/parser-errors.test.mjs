// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies typed parser errors expose stable diagnostic metadata.
 */
test('typed parser errors normalize with kind and source metadata', async () => {
    const { AltiumUnsupportedFeatureError, ParserDiagnosticNormalizer } =
        await import('../../src/legacy-parser.mjs')

    const error = new AltiumUnsupportedFeatureError('Unsupported record', {
        fileName: 'sample.SchDoc',
        sourceStream: 'FileHeader',
        recordType: 999,
        recordIndex: 4
    })
    const diagnostic = ParserDiagnosticNormalizer.normalize(error, {
        code: 'parser.safe.parse.failed',
        severity: 'error',
        source: 'sample.SchDoc'
    })

    assert.equal(error.name, 'AltiumUnsupportedFeatureError')
    assert.deepEqual(diagnostic, {
        code: 'parser.safe.parse.failed',
        severity: 'error',
        message: 'Unsupported record',
        source: 'sample.SchDoc',
        sourceStream: 'FileHeader',
        recordIndex: 4,
        recordType: 999,
        fileName: 'sample.SchDoc',
        errorKind: 'unsupported-feature'
    })
})

/**
 * Verifies safe parse failure envelopes classify generic parser exceptions as
 * parse errors while preserving the source file name.
 */
test('AltiumParser safe parse diagnostics include error kind', async () => {
    const { AltiumParser } = await import('../../src/legacy-parser.mjs')
    const result = AltiumParser.tryParseArrayBufferToRendererModel(
        'broken.IntLib',
        new Uint8Array([1, 2, 3, 4, 5, 6]).buffer
    )

    assert.equal(result.ok, false)
    assert.equal(result.model, null)
    assert.equal(result.diagnostics.length, 1)
    assert.equal(result.diagnostics[0].code, 'parser.safe.parse.failed')
    assert.equal(result.diagnostics[0].source, 'broken.IntLib')
    assert.equal(result.diagnostics[0].fileName, 'broken.IntLib')
    assert.equal(result.diagnostics[0].errorKind, 'parse')
    assert.equal(typeof result.diagnostics[0].errorName, 'string')
})

/**
 * Verifies the corrupt-file error kind is available for low-level decoders.
 */
test('AltiumCorruptFileError records corrupt file diagnostics', async () => {
    const { AltiumCorruptFileError, ParserDiagnosticNormalizer } =
        await import('../../src/legacy-parser.mjs')

    const diagnostic = ParserDiagnosticNormalizer.normalize(
        new AltiumCorruptFileError('Container header is incomplete', {
            fileName: 'sample.PcbDoc',
            sourceStream: 'FileHeader'
        })
    )

    assert.equal(diagnostic.code, 'parser.corrupt-file')
    assert.equal(diagnostic.severity, 'error')
    assert.equal(diagnostic.errorKind, 'corrupt-file')
    assert.equal(diagnostic.fileName, 'sample.PcbDoc')
    assert.equal(diagnostic.sourceStream, 'FileHeader')
})
