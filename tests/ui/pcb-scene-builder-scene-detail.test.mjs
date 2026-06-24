// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Verifies Altium silkscreen scene data includes drill masks so overlay
 * strokes and text planes cannot cover via or through-hole openings.
 */
test('PcbScene3dBuilder exposes Altium silkscreen drill cutouts', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 400,
                segments: []
            },
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            fills: [{ layerId: 33, x1: 80, y1: 40, x2: 220, y2: 160 }],
            tracks: [
                {
                    layerId: 33,
                    x1: 50,
                    y1: 100,
                    x2: 250,
                    y2: 100,
                    width: 10
                }
            ],
            arcs: [],
            texts: [],
            regions: [],
            shapeBasedRegions: [],
            pads: [
                { x: 120, y: 100, holeDiameter: 40 },
                {
                    x: 180,
                    y: 100,
                    holeDiameter: 30,
                    holeShape: 2,
                    holeSlotLength: 70,
                    holeRotation: 0,
                    rotation: 90
                }
            ],
            vias: [{ x: 200, y: 100, holeDiameter: 20 }],
            components: []
        },
        bom: []
    })
    const topSilkscreen = scene.detail.silkscreen.top
    const bottomSilkscreen = scene.detail.silkscreen.bottom

    assert.equal(topSilkscreen.drillCutouts.length, 3)
    assert.equal(bottomSilkscreen.drillCutouts.length, 3)
    assert.equal(topSilkscreen.fills[0].holes.length, 3)
    assert.ok(
        topSilkscreen.drillCutouts.some((cutout) => {
            const xs = cutout.map((point) => point.x)
            const ys = cutout.map((point) => point.y)
            const width = Math.max(...xs) - Math.min(...xs)
            const height = Math.max(...ys) - Math.min(...ys)

            return Math.max(width, height) > 60 && Math.min(width, height) > 29
        }),
        'Expected the slotted through-hole pad to produce a long cutout'
    )
})

/**
 * Verifies 3D Altium scenes expose copper-layer region contours as fill
 * detail while keeping overlay documentation regions out of copper.
 */
test('PcbScene3dBuilder exposes Altium copper regions as 3D fills', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 400,
                segments: []
            },
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 32, name: 'Bottom Layer' },
                { layerId: 33, name: 'Top Overlay' }
            ],
            fills: [],
            tracks: [],
            arcs: [],
            texts: [],
            regions: [
                {
                    layerId: 1,
                    points: [
                        { x: 20, y: 20 },
                        { x: 40, y: 20 },
                        { x: 40, y: 40 },
                        { x: 20, y: 40 }
                    ],
                    holes: []
                }
            ],
            shapeBasedRegions: [
                {
                    layerId: 1,
                    layerCode: 1,
                    netName: 'GND',
                    points: [
                        {
                            x: 100,
                            y: 120,
                            isArc: true,
                            centerX: 140,
                            centerY: 120,
                            radius: 40,
                            startAngle: 180,
                            endAngle: 90
                        },
                        { x: 140, y: 160 },
                        { x: 180, y: 120 },
                        { x: 140, y: 80 }
                    ],
                    holes: [
                        [
                            { x: 130, y: 110 },
                            { x: 150, y: 110 },
                            { x: 150, y: 130 },
                            { x: 130, y: 130 }
                        ]
                    ]
                },
                {
                    layerId: 32,
                    layerCode: 32,
                    netName: 'GND',
                    points: [
                        { x: 240, y: 220 },
                        { x: 300, y: 220 },
                        { x: 300, y: 280 },
                        { x: 240, y: 280 }
                    ],
                    holes: []
                },
                {
                    layerId: 33,
                    points: [
                        { x: 320, y: 40 },
                        { x: 360, y: 40 },
                        { x: 360, y: 80 },
                        { x: 320, y: 80 }
                    ],
                    holes: []
                },
                {
                    layerId: 1,
                    isPolygonPourCutout: true,
                    points: [
                        { x: 60, y: 60 },
                        { x: 80, y: 60 },
                        { x: 80, y: 80 },
                        { x: 60, y: 80 }
                    ],
                    holes: []
                }
            ],
            pads: [],
            vias: [],
            polygons: [],
            components: []
        },
        bom: []
    })

    assert.equal(scene.detail.fills.length, 2)
    assert.deepEqual(
        scene.detail.fills.map((fill) => fill.layerId),
        [1, 32]
    )
    assert.equal(scene.detail.fills[0].netName, 'GND')
    assert.equal(scene.detail.fills[0].holes.length, 1)
    assert.equal(scene.detail.fills[0].contours.length, 2)
    assert.deepEqual(scene.detail.fills[0].contours[0][0], {
        type: 'arc',
        x1: 100,
        y1: 120,
        x2: 140,
        y2: 160,
        x: 140,
        y: 120,
        radius: 40,
        startAngle: 180,
        endAngle: 90
    })
})

/**
 * Verifies 3D Altium scenes prefer a matching board-region contour when the
 * recovered board outline is a rasterized stair-step fallback.
 */
test('PcbScene3dBuilder refines rasterized Altium board outlines from board regions', () => {
    const stairStepSegments = []
    const stairPoints = [
        { x: 0, y: 100 },
        { x: 72, y: 100 },
        { x: 72, y: 96 },
        { x: 80, y: 96 },
        { x: 80, y: 92 },
        { x: 84, y: 92 },
        { x: 84, y: 88 },
        { x: 88, y: 88 },
        { x: 88, y: 84 },
        { x: 92, y: 84 },
        { x: 92, y: 80 },
        { x: 96, y: 80 },
        { x: 96, y: 72 },
        { x: 100, y: 72 },
        { x: 100, y: 0 },
        { x: 0, y: 0 }
    ]

    for (let index = 0; index < stairPoints.length; index += 1) {
        const current = stairPoints[index]
        const next = stairPoints[(index + 1) % stairPoints.length]
        stairStepSegments.push({
            type: 'line',
            x1: current.x,
            y1: current.y,
            x2: next.x,
            y2: next.y
        })
    }

    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: stairStepSegments
            },
            primitiveLayers: [],
            boardRegions: [
                {
                    objectKind: 'BoardRegion',
                    isBoardCutout: true,
                    points: [
                        { x: 0, y: 100 },
                        { x: 0, y: 0 },
                        { x: 100, y: 0 },
                        { x: 100, y: 76 },
                        { x: 96, y: 88 },
                        { x: 88, y: 96 },
                        { x: 76, y: 100 }
                    ]
                }
            ],
            pads: [],
            tracks: [],
            arcs: [],
            vias: [],
            components: []
        },
        bom: []
    })

    assert.equal(scene.board.segments.length, 7)
    assert.deepEqual(scene.board.segments[4], {
        type: 'line',
        x1: 96,
        y1: 88,
        x2: 88,
        y2: 96
    })
})
