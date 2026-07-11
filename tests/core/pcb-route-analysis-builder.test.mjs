// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbRouteAnalysisBuilder } from '../../src/legacy-parser.mjs'

test('PcbRouteAnalysisBuilder avoids per-net primitive scans for empty nets', () => {
    const originalFilter = Array.prototype.filter
    let filterCalls = 0
    let routeAnalysis = null

    Array.prototype.filter = function trackedFilter(...args) {
        filterCalls += 1
        return originalFilter.apply(this, args)
    }

    try {
        routeAnalysis = PcbRouteAnalysisBuilder.build({
            nets: Array.from({ length: 50 }, (_, index) => ({
                name: 'N' + index
            })),
            tracks: [],
            arcs: [],
            vias: [],
            classes: [],
            differentialPairs: []
        })
    } finally {
        Array.prototype.filter = originalFilter
    }

    assert.deepEqual(routeAnalysis.byNet, [])
    assert.ok(filterCalls < 20)
})
