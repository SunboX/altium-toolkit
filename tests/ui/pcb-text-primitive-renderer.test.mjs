// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbTextPrimitiveRenderer } from '../../src/ui/PcbTextPrimitiveRenderer.mjs'

/**
 * Verifies PCB barcode text records render as deterministic vector barcode
 * groups with semantic attributes.
 */
test('PcbTextPrimitiveRenderer renders barcode text primitives', () => {
    const markup = PcbTextPrimitiveRenderer.render([
        {
            text: 'BATCH42',
            x: 100,
            y: 80,
            height: 18,
            layerId: 33,
            fontType: 2,
            fontTypeName: 'BarCode',
            barcode: {
                kind: 1,
                kindName: 'code128',
                renderMode: 2,
                renderModeName: 'full-size',
                fullWidth: 120,
                fullHeight: 40,
                marginX: 6,
                marginY: 4,
                minBarWidth: 2,
                showText: true,
                inverted: true
            }
        }
    ])

    assert.match(markup, /class="pcb-text pcb-text--layer-33 pcb-text--barcode/)
    assert.match(markup, /data-primitive="text"/)
    assert.match(markup, /data-text-role="barcode"/)
    assert.match(markup, /data-barcode-kind="code128"/)
    assert.match(markup, /data-barcode-render-mode="full-size"/)
    assert.match(markup, /data-barcode-inverted="true"/)
    assert.match(markup, /<rect class="pcb-barcode__bar"/)
    assert.match(markup, /<text class="pcb-barcode__caption"/)
})

/**
 * Verifies barcode rendering uses known symbology encoders instead of the
 * legacy pseudo-random module pattern.
 */
test('PcbTextPrimitiveRenderer renders Code 39 and Code 128 encoded modules', () => {
    const code39Markup = PcbTextPrimitiveRenderer.render([
        {
            text: 'A1',
            x: 0,
            y: 0,
            height: 10,
            layerId: 33,
            fontTypeName: 'BarCode',
            barcode: {
                kindName: 'code39',
                minBarWidth: 1,
                showText: false
            }
        }
    ])
    const code128Markup = PcbTextPrimitiveRenderer.render([
        {
            text: 'A1',
            x: 0,
            y: 0,
            height: 10,
            layerId: 33,
            fontTypeName: 'BarCode',
            barcode: {
                kindName: 'code128',
                minBarWidth: 1,
                showText: false
            }
        }
    ])

    assert.match(code39Markup, /data-barcode-kind="code39"/)
    assert.match(code39Markup, /data-barcode-symbology="Code 39"/)
    assert.match(code39Markup, /data-barcode-module-count="51"/)
    assert.match(code128Markup, /data-barcode-kind="code128"/)
    assert.match(code128Markup, /data-barcode-symbology="Code 128B"/)
    assert.match(code128Markup, /data-barcode-module-count="57"/)
    assert.notEqual(code39Markup, code128Markup)
})
