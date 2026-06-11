// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PrintableTextDecoder } from '../../src/core/altium/PrintableTextDecoder.mjs'

test('PrintableTextDecoder extracts record byte runs without decoding candidates', (t) => {
    const originalTextDecoder = globalThis.TextDecoder

    class ThrowingTextDecoder {
        /**
         * Fails when byte-run extraction performs text decoding.
         */
        constructor() {
            throw new Error('unexpected decode during byte-run extraction')
        }
    }

    t.after(() => {
        globalThis.TextDecoder = originalTextDecoder
    })
    globalThis.TextDecoder = ThrowingTextDecoder

    const payload = Buffer.from(
        'noise\u0000|RECORD=1|NAME=R1|VALUE=10K|\u0000tail',
        'latin1'
    )
    const arrayBuffer = payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength
    )

    const runs = PrintableTextDecoder.extractRunBytes(arrayBuffer)

    assert.equal(runs.length, 1)
    assert.equal(
        Buffer.from(runs[0]).toString('latin1'),
        '|RECORD=1|NAME=R1|VALUE=10K|'
    )
})

test('PrintableTextDecoder reuses text decoders for repeated field values', (t) => {
    const originalTextDecoder = globalThis.TextDecoder
    let constructorCalls = 0

    class CountingTextDecoder {
        /**
         * Creates a decoder while counting constructor use.
         * @param {string} encoding
         * @param {TextDecoderOptions} options
         */
        constructor(encoding, options = {}) {
            constructorCalls += 1
            this.decoder = new originalTextDecoder(encoding, options)
        }

        /**
         * Decodes bytes using the wrapped runtime decoder.
         * @param {Uint8Array} bytes
         * @returns {string}
         */
        decode(bytes) {
            return this.decoder.decode(bytes)
        }
    }

    t.after(() => {
        globalThis.TextDecoder = originalTextDecoder
    })
    globalThis.TextDecoder = CountingTextDecoder

    assert.equal(
        PrintableTextDecoder.decodeBytes(Uint8Array.from([82, 49])),
        'R1'
    )
    assert.equal(
        PrintableTextDecoder.decodeBytes(Uint8Array.from([82, 50])),
        'R2'
    )
    assert.equal(constructorCalls, 1)
})

test('PrintableTextDecoder maps Windows-1252 punctuation when runtime decoding leaves C1 controls', (t) => {
    const originalTextDecoder = globalThis.TextDecoder

    class ControlPreservingTextDecoder {
        /**
         * Creates a decoder that mimics runtimes where windows-1252 leaves C1
         * punctuation bytes as control characters.
         * @param {string} encoding
         * @param {TextDecoderOptions} options
         */
        constructor(encoding, options = {}) {
            this.encoding = encoding
            this.decoder = new originalTextDecoder(encoding, options)
        }

        /**
         * Decodes bytes while preserving raw Windows-1252 control bytes.
         * @param {Uint8Array} bytes
         * @returns {string}
         */
        decode(bytes) {
            if (this.encoding === 'windows-1252') {
                return String.fromCharCode(...bytes)
            }

            return this.decoder.decode(bytes)
        }
    }

    t.after(() => {
        globalThis.TextDecoder = originalTextDecoder
    })
    globalThis.TextDecoder = ControlPreservingTextDecoder

    const decoded = PrintableTextDecoder.decodeBytes(
        Uint8Array.from([0x45, 0x53, 0x44, 0x96, 0x54, 0x56, 0x53]),
        { encoding: 'windows-1252' }
    )

    assert.equal(decoded, 'ESD–TVS')
})
