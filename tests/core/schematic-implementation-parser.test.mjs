// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicImplementationParser } from '../../src/legacy-parser.mjs'

/**
 * Creates an unrelated record that tracks record-type reads.
 * @param {number} index Record index.
 * @param {{ count: number }} reads Shared read counter.
 * @returns {object}
 */
function passiveRecord(index, reads) {
    return {
        recordIndex: index,
        fields: {
            get RECORD() {
                reads.count += 1
                return '99'
            }
        }
    }
}

test('SchematicImplementationParser indexes implementation children once', () => {
    const passiveReads = { count: 0 }
    const records = [
        {
            recordIndex: 1,
            fields: {
                RECORD: '1',
                IndexInSheet: '20',
                LibReference: 'CTRL_CORE'
            }
        },
        {
            recordIndex: 2,
            fields: { RECORD: '44', IndexInSheet: '30', OwnerIndex: '20' }
        },
        ...Array.from({ length: 20 }, (_, index) =>
            passiveRecord(100 + index, passiveReads)
        ),
        {
            recordIndex: 3,
            fields: {
                RECORD: '45',
                IndexInSheet: '31',
                OwnerIndex: '30',
                ModelName: 'CTRL_A',
                ModelType: 'PCB'
            }
        },
        {
            recordIndex: 4,
            fields: {
                RECORD: '45',
                IndexInSheet: '32',
                OwnerIndex: '30',
                ModelName: 'CTRL_B',
                ModelType: 'PCB'
            }
        },
        {
            recordIndex: 5,
            fields: { RECORD: '47', OwnerIndex: '31', DesIntf: 'A' }
        },
        {
            recordIndex: 6,
            fields: { RECORD: '48', OwnerIndex: '32', Name: 'Lifecycle' }
        }
    ]

    const model = SchematicImplementationParser.parse(records)

    assert.equal(model.implementations.length, 2)
    assert.equal(model.implementations[0].mapDefiners.length, 1)
    assert.equal(model.implementations[1].parameters.length, 1)
    assert.equal(passiveReads.count, 4 * 20)
})
