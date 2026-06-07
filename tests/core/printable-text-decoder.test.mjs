// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PrintableTextDecoder } from '../../src/core/altium/PrintableTextDecoder.mjs'

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
