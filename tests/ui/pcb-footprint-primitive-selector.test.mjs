// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbFootprintPrimitiveSelector } from '../../src/ui/PcbFootprintPrimitiveSelector.mjs'

test('PcbFootprintPrimitiveSelector prioritizes overlay layers per board side', () => {
    const primitiveLayers = [
        { layerId: 33, name: 'Top Overlay' },
        { layerId: 34, name: 'Bottom Overlay' },
        { layerId: 35, name: 'Top Assembly' },
        { layerId: 36, name: 'Bottom Assembly' }
    ]
    const fills = [
        { x1: 10, y1: 20, x2: 30, y2: 40, layerId: 35 },
        { x1: 50, y1: 60, x2: 70, y2: 80, layerId: 36 }
    ]
    const tracks = [
        { x1: 1, y1: 2, x2: 3, y2: 4, width: 5, layerId: 33 },
        { x1: 6, y1: 7, x2: 8, y2: 9, width: 5, layerId: 34 },
        { x1: 11, y1: 12, x2: 13, y2: 14, width: 5, layerId: 35 }
    ]
    const arcs = [
        {
            x: 100,
            y: 120,
            radius: 15,
            startAngle: 0,
            endAngle: 90,
            width: 4,
            layerId: 34
        }
    ]

    const top = PcbFootprintPrimitiveSelector.select(
        primitiveLayers,
        fills,
        tracks,
        arcs,
        'top'
    )
    const bottom = PcbFootprintPrimitiveSelector.select(
        primitiveLayers,
        fills,
        tracks,
        arcs,
        'bottom'
    )

    assert.deepEqual(top, {
        fills: [],
        tracks: [{ x1: 1, y1: 2, x2: 3, y2: 4, width: 5, layerId: 33 }],
        arcs: [],
        regions: []
    })
    assert.deepEqual(bottom, {
        fills: [],
        tracks: [{ x1: 6, y1: 7, x2: 8, y2: 9, width: 5, layerId: 34 }],
        arcs: [
            {
                x: 100,
                y: 120,
                radius: 15,
                startAngle: 0,
                endAngle: 90,
                width: 4,
                layerId: 34
            }
        ],
        regions: []
    })
})

test('PcbFootprintPrimitiveSelector falls back to assembly layers when overlay is empty', () => {
    const primitiveLayers = [
        { layerId: 35, name: 'Top Assembly' },
        { layerId: 36, name: 'Bottom Assembly' }
    ]
    const fills = [{ x1: 10, y1: 20, x2: 30, y2: 40, layerId: 35 }]
    const tracks = [{ x1: 1, y1: 2, x2: 3, y2: 4, width: 5, layerId: 36 }]

    const top = PcbFootprintPrimitiveSelector.select(
        primitiveLayers,
        fills,
        tracks,
        [],
        'top'
    )
    const bottom = PcbFootprintPrimitiveSelector.select(
        primitiveLayers,
        fills,
        tracks,
        [],
        'bottom'
    )

    assert.deepEqual(top, {
        fills: [{ x1: 10, y1: 20, x2: 30, y2: 40, layerId: 35 }],
        tracks: [],
        arcs: [],
        regions: []
    })
    assert.deepEqual(bottom, {
        fills: [],
        tracks: [{ x1: 1, y1: 2, x2: 3, y2: 4, width: 5, layerId: 36 }],
        arcs: [],
        regions: []
    })
})

test('PcbFootprintPrimitiveSelector includes documentation regions', () => {
    const primitiveLayers = [{ layerId: 33, name: 'Top Overlay' }]
    const regions = [
        {
            points: [
                { x: 10, y: 20 },
                { x: 30, y: 20 },
                { x: 30, y: 40 }
            ],
            layerId: 33
        }
    ]

    const top = PcbFootprintPrimitiveSelector.select(
        primitiveLayers,
        [],
        [],
        [],
        regions,
        'top'
    )

    assert.deepEqual(top, {
        fills: [],
        tracks: [],
        arcs: [],
        regions
    })
})
