// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'

/**
 * Encodes one synthetic ASCII record stream.
 * @param {string} text Synthetic record stream.
 * @returns {ArrayBuffer}
 */
function encodeText(text) {
    return new TextEncoder().encode(text).buffer
}

/**
 * Verifies safe parsing returns a success envelope for renderer models.
 */
test('AltiumParser tryParseArrayBufferToRendererModel returns success envelope', () => {
    const result = AltiumParser.tryParseArrayBufferToRendererModel(
        'safe.SchDoc',
        encodeText(
            '|HEADER=Schematic Document|RECORD=31|CUSTOMX=100|CUSTOMY=100|BORDERON=F|TITLEBLOCKON=F'
        )
    )

    assert.equal(result.ok, true)
    assert.equal(result.model.kind, 'schematic')
    assert.equal(result.model.fileName, 'safe.SchDoc')
    assert.ok(Array.isArray(result.diagnostics))
    assert.equal(result.diagnostics.length, result.model.diagnostics.length)
})

/**
 * Verifies safe parsing returns a success envelope for Circuit JSON output.
 */
test('AltiumParser tryParseArrayBuffer returns success envelope', () => {
    const result = AltiumParser.tryParseArrayBuffer(
        'safe.SchDoc',
        encodeText(
            '|HEADER=Schematic Document|RECORD=31|CUSTOMX=100|CUSTOMY=100|BORDERON=F|TITLEBLOCKON=F'
        )
    )

    assert.equal(result.ok, true)
    assert.equal(Array.isArray(result.model), true)
    assert.equal(result.model.kind, 'schematic')
    assert.ok(Array.isArray(result.diagnostics))
})

/**
 * Verifies safe parsing converts thrown parser failures into diagnostics.
 */
test('AltiumParser safe parse returns failure envelope with normalized diagnostic', () => {
    const result = AltiumParser.tryParseArrayBufferToRendererModel(
        'broken.IntLib',
        new Uint8Array([1, 2, 3, 4, 5, 6]).buffer
    )

    assert.equal(result.ok, false)
    assert.equal(result.model, null)
    assert.equal(result.diagnostics.length, 1)
    assert.equal(result.diagnostics[0].code, 'parser.safe.parse.failed')
    assert.equal(result.diagnostics[0].severity, 'error')
    assert.equal(result.diagnostics[0].source, 'broken.IntLib')
    assert.equal(result.diagnostics[0].fileName, 'broken.IntLib')
    assert.equal(typeof result.diagnostics[0].message, 'string')
    assert.notEqual(result.diagnostics[0].message.length, 0)
})
