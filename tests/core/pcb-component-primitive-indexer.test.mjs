// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbComponentPrimitiveIndexer } from '../../src/parser.mjs'

test('PcbComponentPrimitiveIndexer groups primitives without repeated filters', () => {
    const originalFilter = Array.prototype.filter
    let filterCalls = 0
    let groups = []

    Array.prototype.filter = function countedFilter(...args) {
        filterCalls += 1
        return originalFilter.apply(this, args)
    }

    try {
        groups = PcbComponentPrimitiveIndexer.buildGroups(
            [
                { componentIndex: 1, designator: 'U1' },
                { componentIndex: 2, designator: 'U2' }
            ],
            {
                pads: [{ componentIndex: 1 }, { componentIndex: 2 }],
                tracks: [{ componentIndex: 1 }],
                arcs: [],
                fills: [],
                vias: [],
                regions: [],
                shapeBasedRegions: [],
                texts: [{ ownerIndex: 1 }, { ownerIndex: 2 }]
            },
            [{ componentIndex: 1 }, { componentIndex: 2 }]
        )
    } finally {
        Array.prototype.filter = originalFilter
    }

    assert.equal(filterCalls, 0)
    assert.equal(groups[0].pads.length, 1)
    assert.equal(groups[0].tracks.length, 1)
    assert.equal(groups[0].texts.length, 1)
    assert.equal(groups[0].componentBodies.length, 1)
    assert.equal(groups[1].pads.length, 1)
    assert.equal(groups[1].texts.length, 1)
})
