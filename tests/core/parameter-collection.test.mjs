// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies parsed parameter collections preserve repeated fields while
 * exposing case-insensitive typed reads.
 */
test('ParameterCollection preserves duplicate values with typed accessors', async () => {
    const { ParameterCollection } = await import('../../src/legacy-parser.mjs')

    assert.equal(typeof ParameterCollection, 'function')

    const collection = ParameterCollection.parse(
        '|Name=R1|COUNT=2|count=3|Enabled=T|Scale=1.5|Code=9|Coord=-12.5mil|%UTF8%Label=Cap'
    )

    assert.equal(collection.count, 8)
    assert.equal(collection.has('name'), true)
    assert.equal(collection.get('NAME').asString(), 'R1')
    assert.deepEqual(
        collection.getAll('count').map((value) => value.asInt()),
        [2, 3]
    )
    assert.equal(collection.get('count').asInt(), 2)
    assert.equal(collection.last('count').asInt(), 3)
    assert.equal(collection.get('enabled').asBool(), true)
    assert.equal(collection.get('scale').asNumber(), 1.5)
    assert.equal(collection.get('code').asCode(), 9)
    assert.deepEqual(collection.get('coord').asCoordinate(), {
        value: -12.5,
        unit: 'mil'
    })
    assert.equal(collection.get('label').asString(), 'Cap')
    assert.deepEqual(
        collection.entries.map((entry) => [
            entry.key,
            entry.rawKey,
            entry.value,
            entry.isUtf8
        ]),
        [
            ['Name', 'Name', 'R1', false],
            ['COUNT', 'COUNT', '2', false],
            ['count', 'count', '3', false],
            ['Enabled', 'Enabled', 'T', false],
            ['Scale', 'Scale', '1.5', false],
            ['Code', 'Code', '9', false],
            ['Coord', 'Coord', '-12.5mil', false],
            ['Label', '%UTF8%Label', 'Cap', true]
        ]
    )
})

/**
 * Verifies missing and malformed parameter values degrade to caller defaults.
 */
test('ParameterCollection typed accessors return defaults for missing values', async () => {
    const { ParameterCollection } = await import('../../src/legacy-parser.mjs')
    const collection = ParameterCollection.parse('|Enabled=F|Size=abc')

    assert.equal(collection.get('missing').asString('fallback'), 'fallback')
    assert.equal(collection.get('missing').asNumber(4.2), 4.2)
    assert.equal(collection.get('missing').asBool(true), true)
    assert.equal(collection.get('size').asInt(7), 7)
    assert.deepEqual(collection.get('size').asCoordinate({ value: 1 }), {
        value: 1
    })
    assert.equal(collection.get('enabled').asBool(true), false)
})
