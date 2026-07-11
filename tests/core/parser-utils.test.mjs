// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { ParserUtils } from '../../src/legacy-parser.mjs'

test('ParserUtils picks repeated field values without map allocation', () => {
    const originalMap = Array.prototype.map
    let mapCalls = 0
    let fieldValue = ''
    let displayValue = ''

    Array.prototype.map = function mappedFieldValue(...args) {
        mapCalls += 1
        return originalMap.apply(this, args)
    }

    try {
        fieldValue = ParserUtils.getField(
            { NAME: [' ', 'fallback', ' preferred '] },
            'NAME'
        )
        displayValue = ParserUtils.getDisplayText({
            Text: ['*', ' visible label ']
        })
    } finally {
        Array.prototype.map = originalMap
    }

    assert.equal(fieldValue, 'preferred')
    assert.equal(displayValue, 'visible label')
    assert.equal(mapCalls, 0)
})

test('ParserUtils reuses normalized values for repeated text-array lookups', () => {
    const originalTrim = String.prototype.trim
    let trimCalls = 0
    const fields = {
        'UTF8:Text': ['*', ' resistor '],
        Text: [' fallback ']
    }
    let textValue = ''

    String.prototype.trim = function trackedTrim(...args) {
        trimCalls += 1
        return originalTrim.apply(this, args)
    }

    try {
        textValue = ParserUtils.getDisplayText(fields)
        ParserUtils.getDisplayText(fields)
    } finally {
        String.prototype.trim = originalTrim
    }

    assert.equal(textValue, 'resistor')
    assert.equal(trimCalls, 1)
})

test('ParserUtils bypasses cache bookkeeping for scalar field lookups', () => {
    const originalGet = WeakMap.prototype.get
    let weakMapGets = 0
    let fieldValue = ''

    WeakMap.prototype.get = function trackedWeakMapGet(...args) {
        weakMapGets += 1
        return originalGet.apply(this, args)
    }

    try {
        fieldValue = ParserUtils.getField({ Name: ' R1 ' }, 'Name')
    } finally {
        WeakMap.prototype.get = originalGet
    }

    assert.equal(fieldValue, 'R1')
    assert.equal(weakMapGets, 0)
})
