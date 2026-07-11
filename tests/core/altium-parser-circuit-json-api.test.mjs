// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../src/legacy-parser.mjs'

/**
 * Encodes fixture text as an ArrayBuffer.
 * @param {string} text
 * @returns {ArrayBuffer}
 */
function encodeText(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

/**
 * Verifies the breaking parser root returns Circuit JSON directly.
 */
test('AltiumParser.parseArrayBuffer returns a Circuit JSON array', () => {
    const circuitJson = AltiumParser.parseArrayBuffer(
        'neutral-sheet.SchDoc',
        encodeText(
            '|HEADER=Schematic Document' +
                '|RECORD=31|CustomX=100|CustomY=100|BorderOn=F|TitleBlockOn=F'
        )
    )

    assert.equal(Array.isArray(circuitJson), true)
    assert.equal(circuitJson.kind, 'schematic')
    assert.equal(circuitJson.fileType, 'SchDoc')
    assert.equal(
        circuitJson.some(
            (element) => element.type === 'source_project_metadata'
        ),
        true
    )
    assert.equal(
        JSON.parse(JSON.stringify(circuitJson)).every(
            (element) => element.type
        ),
        true
    )
})

/**
 * Verifies the compatibility API keeps returning the renderer model.
 */
test('AltiumParser.parseArrayBufferToRendererModel keeps renderer output', () => {
    const rendererModel = AltiumParser.parseArrayBufferToRendererModel(
        'neutral-sheet.SchDoc',
        encodeText(
            '|HEADER=Schematic Document' +
                '|RECORD=31|CustomX=100|CustomY=100|BorderOn=F|TitleBlockOn=F'
        )
    )

    assert.equal(Array.isArray(rendererModel), false)
    assert.equal(rendererModel.kind, 'schematic')
    assert.equal(rendererModel.fileType, 'SchDoc')
    assert.equal(rendererModel.schematic.sheet.width, 100)
})
