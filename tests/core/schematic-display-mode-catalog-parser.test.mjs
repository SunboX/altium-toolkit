// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicDisplayModeCatalogParser } from '../../src/core/altium/SchematicDisplayModeCatalogParser.mjs'

/**
 * Creates an unrelated owner-capable child record with tracked owner reads.
 * @param {number} index Record index.
 * @param {{ count: number }} reads Owner-index read counter.
 * @returns {object}
 */
function passiveOwnerChild(index, reads) {
    return {
        recordIndex: index,
        fields: {
            RECORD: '99',
            OwnerPartID: '1',
            get OwnerIndex() {
                reads.count += 1
                return ''
            }
        }
    }
}

test('SchematicDisplayModeCatalogParser indexes owner children once', () => {
    const ownerReads = { count: 0 }
    const model = SchematicDisplayModeCatalogParser.parse([
        {
            recordIndex: 1,
            fields: {
                RECORD: '1',
                IndexInSheet: '10',
                PartCount: '1',
                DisplayModeCount: '1'
            }
        },
        {
            recordIndex: 2,
            fields: {
                RECORD: '1',
                IndexInSheet: '11',
                PartCount: '1',
                DisplayModeCount: '1'
            }
        },
        ...Array.from({ length: 20 }, (_, index) =>
            passiveOwnerChild(100 + index, ownerReads)
        )
    ])

    assert.equal(model.components.length, 2)
    assert.equal(ownerReads.count, 20)
})
