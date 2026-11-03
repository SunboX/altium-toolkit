// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbSvgRenderer } from '../../src/ui/PcbSvgRenderer.mjs'
import { PcbRegionPrimitiveRenderer } from '../../src/ui/PcbRegionPrimitiveRenderer.mjs'
import { PcbInteractionGeometry } from '../../src/ui/PcbInteractionGeometry.mjs'
import { PcbCopperPrimitiveSplitter } from '../../src/ui/PcbCopperPrimitiveSplitter.mjs'
import { PcbNativeTextKnockoutDetector } from '../../src/ui/PcbNativeTextKnockoutDetector.mjs'
import { PcbCoordinateBounds } from '../../src/ui/PcbCoordinateBounds.mjs'

/**
 * Builds a synthetic board whose tracks exceed common function argument limits.
 * @returns {object}
 */
function createDenseBoard() {
    return {
        summary: { title: 'Synthetic board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 80,
                segments: []
            },
            layers: [{ name: 'Top Layer', layerId: 1 }],
            primitiveLayers: [{ name: 'Top Layer', layerId: 1 }],
            components: [],
            tracks: Array.from({ length: 75000 }, (_, index) => ({
                x1: -index,
                y1: index,
                x2: index + 1,
                y2: -index - 1,
                width: 1,
                layerId: 1,
                layerCode: 1
            }))
        }
    }
}

/**
 * Verifies complete SVG output and exact bounds for a large primitive collection.
 */
test('PCB SVG fits every track without exceeding function argument limits', () => {
    const markup = PcbSvgRenderer.render(createDenseBoard())
    assert.match(markup, /viewBox="-75239 -75240 150479 150479"/)
    assert.equal((markup.match(/class="pcb-track /g) || []).length, 75000)
})

/**
 * Verifies a dense contour's last points and holes contribute to its bounds.
 */
test('region bounds include large contours and holes without argument spreading', () => {
    const region = {
        points: Array.from({ length: 150000 }, (_, index) => ({
            x: -index,
            y: index
        })),
        holes: [[{ x: 500, y: -700 }, { x: NaN, y: 0 }, null]]
    }
    assert.deepEqual(PcbRegionPrimitiveRenderer.bounds(region), {
        minX: -149999,
        minY: -700,
        maxX: 500,
        maxY: 149999
    })
    assert.equal(PcbRegionPrimitiveRenderer.bounds({ points: [null] }), null)
    assert.equal(
        PcbRegionPrimitiveRenderer.intersectsBounds(region, {
            minX: -150000,
            minY: 149998,
            maxX: -149998,
            maxY: 150000
        }),
        true
    )
})

/**
 * Verifies hit-test indexing can measure the same large contours as rendering.
 */
test('PCB interaction bounds support large polygons', () => {
    const geometry = PcbInteractionGeometry.polygon(
        Array.from({ length: 150000 }, (_, index) => ({
            x: index - 500,
            y: -index
        }))
    )
    assert.deepEqual(PcbInteractionGeometry.boundsFor(geometry), {
        minX: -500,
        minY: -149999,
        maxX: 149499,
        maxY: 0,
        width: 149999,
        height: 149999
    })
})

/**
 * Verifies dense copper splitting still selects the lowest authored layer.
 */
test('copper splitting handles large primitive collections', () => {
    const tracks = Array.from({ length: 150000 }, () => ({
        layerCode: 2,
        layerId: 1
    }))
    tracks.push({ layerCode: 1, layerId: 1 }, { layerCode: NaN, layerId: 1 })
    const result = PcbCopperPrimitiveSplitter.split([], [], tracks, [], [])
    assert.deepEqual(result.surface.tracks, [tracks[150000]])
    assert.equal(result.subsurface.tracks.length, 150001)
    assert.equal(result.subsurface.tracks.at(-1), tracks.at(-1))
})

/**
 * Verifies native overlay knockout detection can measure dense region artwork.
 */
test('native knockout detection supports large region contours', () => {
    const points = Array.from({ length: 150000 }, (_, index) => ({
        x: index % 100,
        y: Math.floor(index / 100)
    }))
    assert.equal(
        PcbNativeTextKnockoutDetector.hasNativeTextKnockouts(
            {
                tracks: Array.from({ length: 300 }, () => ({})),
                regions: [{ points, holes: [[{ x: 1, y: 1 }]] }]
            },
            { widthMil: 100, heightMil: 1500 }
        ),
        true
    )
})

/**
 * Verifies range aggregation retains native empty, nonfinite and zero semantics.
 */
test('coordinate ranges preserve Math extrema semantics', () => {
    assert.deepEqual(PcbCoordinateBounds.range([]), {
        min: Infinity,
        max: -Infinity
    })
    assert.deepEqual(PcbCoordinateBounds.range([0, -0]), { min: -0, max: 0 })
    assert.deepEqual(PcbCoordinateBounds.range([2, NaN, -5]), {
        min: NaN,
        max: NaN
    })
    assert.deepEqual(PcbCoordinateBounds.fromAxes([-3, 7], [9, -2]), {
        minX: -3,
        minY: -2,
        maxX: 7,
        maxY: 9
    })
})
