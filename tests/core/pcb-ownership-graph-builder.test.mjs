// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbOwnershipGraphBuilder } from '../../src/legacy-parser.mjs'

test('PcbOwnershipGraphBuilder appends primitive keys without duplicate scans', () => {
    const originalIncludes = Array.prototype.includes
    let includesCalls = 0
    let ownership = null

    Array.prototype.includes = function countedIncludes(...args) {
        includesCalls += 1
        return originalIncludes.apply(this, args)
    }

    try {
        ownership = PcbOwnershipGraphBuilder.build({
            components: [{ componentIndex: 1, designator: 'U1' }],
            nets: [{ netIndex: 2, name: 'NET_A' }],
            tracks: Array.from({ length: 20 }, () => ({
                componentIndex: 1,
                netIndex: 2,
                polygonIndex: 3
            }))
        })
    } finally {
        Array.prototype.includes = originalIncludes
    }

    assert.equal(includesCalls, 0)
    assert.equal(ownership.componentsByIndex['1'].primitiveKeys.length, 20)
    assert.equal(ownership.netsByIndex['2'].primitiveKeys.length, 20)
    assert.equal(ownership.polygonsByIndex['3'].primitiveKeys.length, 20)
})
