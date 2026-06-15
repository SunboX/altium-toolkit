// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies common Altium coordinate conversions are available from the parser
 * entrypoint without forcing callers to duplicate unit math.
 */
test('AltiumUnits converts between mil, millimeter, inch, and raw units', async () => {
    const { AltiumUnits } = await import('../../src/parser.mjs')

    assert.equal(typeof AltiumUnits, 'function')
    assert.equal(AltiumUnits.mmToMil(2.54), 100)
    assert.equal(AltiumUnits.milToMm(100), 2.54)
    assert.equal(AltiumUnits.inchToMil(0.1), 100)
    assert.equal(AltiumUnits.milToRaw(100), 1000000)
    assert.equal(AltiumUnits.rawToMil(1000000), 100)
})

/**
 * Verifies length parsing returns deterministic, multi-unit values for common
 * Altium textual fields.
 */
test('AltiumUnits parses length strings with explicit and default units', async () => {
    const { AltiumUnits } = await import('../../src/parser.mjs')

    assert.deepEqual(AltiumUnits.parseLength('2.54mm'), {
        value: 2.54,
        unit: 'mm',
        mil: 100,
        mm: 2.54,
        inch: 0.1,
        raw: 1000000
    })
    assert.deepEqual(AltiumUnits.parseLength('100mil'), {
        value: 100,
        unit: 'mil',
        mil: 100,
        mm: 2.54,
        inch: 0.1,
        raw: 1000000
    })
    assert.deepEqual(AltiumUnits.parseLength(0.1, { defaultUnit: 'in' }), {
        value: 0.1,
        unit: 'in',
        mil: 100,
        mm: 2.54,
        inch: 0.1,
        raw: 1000000
    })
    assert.equal(AltiumUnits.parseLength('bad'), null)
})

/**
 * Verifies formatted lengths are stable enough for report and example output.
 */
test('AltiumUnits formats lengths deterministically', async () => {
    const { AltiumUnits } = await import('../../src/parser.mjs')

    assert.equal(AltiumUnits.formatMil(100, 'mm'), '2.54mm')
    assert.equal(AltiumUnits.formatMil(100, 'mil'), '100mil')
    assert.equal(AltiumUnits.formatMil(100, 'in'), '0.1in')
    assert.equal(AltiumUnits.formatMil(Number.NaN, 'mm'), '')
})
