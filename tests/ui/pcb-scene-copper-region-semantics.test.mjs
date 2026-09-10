// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dCopperRegionDetailBuilder } from '../../src/ui/PcbScene3dCopperRegionDetailBuilder.mjs'

/** Creates one synthetic region with a known copper outline. */
function region(metadata = {}) {
    return {
        layerId: 1,
        points: [
            { x: 10, y: 20 },
            { x: 90, y: 20 },
            { x: 90, y: 70 },
            { x: 10, y: 70 }
        ],
        holes: [],
        ...metadata
    }
}

for (const family of ['regions', 'shapeBasedRegions']) {
    test(`3D copper excludes numeric cutout, outline and cavity ${family}`, () => {
        const regions = [
            region({ kind: 0 }),
            region(),
            region({ kind: 1 }),
            region({ kind: 2 }),
            region({ kind: 4 }),
            region({ properties: { KIND: '1' } }),
            region({ kind: '1', layerId: 32 }),
            region({ kind: 0, isBoardCutout: true }),
            region({ kind: 0, isKeepout: true }),
            region({ kind: null, rawKind: 'PolygonPourCutout' }),
            region({ layerId: 32, kind: 0 })
        ]
        const before = structuredClone(regions)
        const fills = PcbScene3dCopperRegionDetailBuilder.build({
            [family]: regions
        })
        assert.deepEqual(fills, [regions[0], regions[1], regions[10]])
        assert.deepEqual(regions, before)
    })
}

/** Creates a synthetic circular copper region in normalized board coordinates. */
function circleRegion() {
    return region({
        kind: 0,
        points: [180, 90, 0, 270].map((startAngle, index, angles) => ({
            x: 200 + 60 * Math.cos((startAngle * Math.PI) / 180),
            y: 200 + 60 * Math.sin((startAngle * Math.PI) / 180),
            isArc: true,
            centerX: 200,
            centerY: 200,
            radius: 60,
            startAngle,
            endAngle: angles[(index + 1) % angles.length]
        }))
    })
}

test('curved copper contours keep continuous clockwise quarters across zero degrees', () => {
    const [fill] = PcbScene3dCopperRegionDetailBuilder.build({
        shapeBasedRegions: [circleRegion()]
    })
    assert.deepEqual(
        fill.contours[0].map((arc) => arc.sweepAngle),
        [-90, -90, -90, -90]
    )
})

for (const [startAngle, endAngle, reverse, expectedSweep] of [
    [0, 270, false, -90],
    [0, 270, true, 90],
    [270, 0, false, -270],
    [270, 0, true, 270]
]) {
    test(`curved region preserves ${expectedSweep} degree traversal`, () => {
        const angle = reverse ? endAngle : startAngle
        const nextAngle = reverse ? startAngle : endAngle
        const current = {
            x: 200 + 60 * Math.cos((angle * Math.PI) / 180),
            y: 200 + 60 * Math.sin((angle * Math.PI) / 180),
            centerX: 200,
            centerY: 200,
            radius: 60,
            isArc: true,
            startAngle,
            endAngle
        }
        const next = {
            x: 200 + 60 * Math.cos((nextAngle * Math.PI) / 180),
            y: 200 + 60 * Math.sin((nextAngle * Math.PI) / 180)
        }
        const [fill] = PcbScene3dCopperRegionDetailBuilder.build({
            regions: [region({ points: [current, next, { x: 200, y: 200 }] })]
        })
        const arc = fill.contours[0][0]
        assert.equal(arc.sweepAngle, expectedSweep)
        assert.equal(arc.startAngle, angle)
        assert.equal(arc.endAngle, nextAngle)
    })
}
