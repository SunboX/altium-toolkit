// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { SchematicRecordTypeRegistry as ExportedSchematicRecordTypeRegistry } from '../../src/parser.mjs'
import { SchematicRecordTypeRegistry } from '../../src/core/altium/SchematicRecordTypeRegistry.mjs'

test('SchematicRecordTypeRegistry describes deferred record families', () => {
    assert.deepEqual(SchematicRecordTypeRegistry.get(3), {
        recordType: 3,
        name: 'ieee-symbol',
        family: 'symbol',
        supported: true
    })
    assert.deepEqual(SchematicRecordTypeRegistry.get('5'), {
        recordType: 5,
        name: 'bezier',
        family: 'graphic',
        supported: true
    })
    assert.deepEqual(SchematicRecordTypeRegistry.get(9), {
        recordType: 9,
        name: 'pie-chart',
        family: 'graphic',
        supported: true
    })
    assert.deepEqual(SchematicRecordTypeRegistry.get(10), {
        recordType: 10,
        name: 'rounded-rectangle',
        family: 'graphic',
        supported: true
    })
    assert.deepEqual(SchematicRecordTypeRegistry.get(209), {
        recordType: 209,
        name: 'note',
        family: 'annotation',
        supported: true
    })
    assert.deepEqual(SchematicRecordTypeRegistry.get(211), {
        recordType: 211,
        name: 'compile-mask',
        family: 'directive',
        supported: true
    })
    assert.deepEqual(SchematicRecordTypeRegistry.get(215), {
        recordType: 215,
        name: 'harness-connector',
        family: 'harness',
        supported: true
    })
    assert.deepEqual(SchematicRecordTypeRegistry.get(225), {
        recordType: 225,
        name: 'blanket',
        family: 'directive',
        supported: true
    })
    assert.deepEqual(SchematicRecordTypeRegistry.get(226), {
        recordType: 226,
        name: 'hyperlink',
        family: 'annotation',
        supported: false
    })
})

test('SchematicRecordTypeRegistry summarizes record counts by type', () => {
    const summary = SchematicRecordTypeRegistry.summarize([
        { fields: { RECORD: '3' } },
        { fields: { RECORD: '3' } },
        { fields: { RECORD: '211' } },
        { fields: { RECORD: '999' } }
    ])

    assert.deepEqual(summary, [
        {
            recordType: 3,
            name: 'ieee-symbol',
            family: 'symbol',
            supported: true,
            count: 2
        },
        {
            recordType: 211,
            name: 'compile-mask',
            family: 'directive',
            supported: true,
            count: 1
        },
        {
            recordType: 999,
            name: 'unknown-999',
            family: 'unknown',
            supported: false,
            count: 1
        }
    ])
    assert.equal(
        ExportedSchematicRecordTypeRegistry,
        SchematicRecordTypeRegistry
    )
})

test('SchematicRecordTypeRegistry supported flags match normalized read models', () => {
    const supportedFamilies = new Map([
        [3, 'ieeeSymbols'],
        [5, 'beziers'],
        [9, 'pies'],
        [10, 'roundedRectangles'],
        [28, 'textFrames'],
        [39, 'template'],
        [44, 'implementations'],
        [45, 'implementations'],
        [46, 'implementations'],
        [47, 'implementations'],
        [48, 'implementations'],
        [209, 'texts'],
        [211, 'directiveSemantics.compileMasks'],
        [215, 'harnesses.connectors'],
        [216, 'harnesses.entries'],
        [217, 'harnesses.typeLabels'],
        [218, 'harnesses.signalHarnesses'],
        [225, 'directiveSemantics.blankets']
    ])

    for (const [recordType, readModelPath] of supportedFamilies) {
        assert.equal(
            SchematicRecordTypeRegistry.get(recordType).supported,
            true,
            'record ' + recordType + ' should advertise ' + readModelPath
        )
    }
})
