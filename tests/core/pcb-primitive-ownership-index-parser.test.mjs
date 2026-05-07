// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbPrimitiveOwnershipIndexParser } from '../../src/core/altium/PcbPrimitiveOwnershipIndexParser.mjs'

/**
 * Creates a byte view with primitive owner indexes at the common offsets.
 * @returns {DataView}
 */
function createOwnershipView() {
    const bytes = new Uint8Array(14)
    const view = new DataView(bytes.buffer)

    view.setUint16(3, 17, true)
    view.setUint16(5, 0xffff, true)
    view.setUint16(7, 3, true)

    return view
}

/**
 * Verifies shared ownership readers preserve all index families.
 */
test('PcbPrimitiveOwnershipIndexParser reads component, net, and polygon indexes', () => {
    const view = createOwnershipView()

    assert.deepEqual(
        PcbPrimitiveOwnershipIndexParser.readOwnershipIndexes(view, {
            component: 7,
            net: 3,
            polygon: 5
        }),
        {
            componentIndex: 3,
            netIndex: 17,
            polygonIndex: null
        }
    )
})

/**
 * Verifies truncated optional ownership fields safely fall back to null.
 */
test('PcbPrimitiveOwnershipIndexParser returns null for missing ownership fields', () => {
    const view = new DataView(new Uint8Array(4).buffer)

    assert.deepEqual(
        PcbPrimitiveOwnershipIndexParser.readOwnershipIndexes(view, {
            component: 7,
            net: 3,
            polygon: 5
        }),
        {
            componentIndex: null,
            netIndex: null,
            polygonIndex: null
        }
    )
})
