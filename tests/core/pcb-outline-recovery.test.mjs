// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbOutlineRecovery } from '../../src/core/altium/PcbOutlineRecovery.mjs'

/**
 * Approximates one outline area by sampling arc segments.
 * @param {{ segments: Array<Record<string, number | string>> }} outline
 * @returns {number}
 */
function computeOutlineArea(outline) {
    const points = []

    for (const segment of outline.segments || []) {
        const samples =
            segment.type === 'arc'
                ? sampleArcPoints(segment)
                : [
                      {
                          x: Number(segment.x1 || 0),
                          y: Number(segment.y1 || 0)
                      },
                      { x: Number(segment.x2 || 0), y: Number(segment.y2 || 0) }
                  ]

        if (!points.length) {
            points.push(samples[0])
        }

        points.push(...samples.slice(1))
    }

    let area = 0

    for (let index = 0; index < points.length; index += 1) {
        const current = points[index]
        const next = points[(index + 1) % points.length]

        area += current.x * next.y - next.x * current.y
    }

    return Math.abs(area / 2)
}

/**
 * Samples one arc segment into polygon points.
 * @param {Record<string, number | string>} segment
 * @returns {{ x: number, y: number }[]}
 */
function sampleArcPoints(segment) {
    const startAngle = Number(segment.startAngle || 0)
    const endAngle = Number(segment.endAngle || 0)
    let delta = endAngle - startAngle

    if (Math.abs(delta) < 1e-6) {
        delta = 360
    }

    if (delta < 0) {
        delta += 360
    }

    const steps = Math.max(Math.ceil(Math.abs(delta) / 10), 8)
    const radius = Number(segment.radius || 0)
    const centerX = Number(segment.cx || 0)
    const centerY = Number(segment.cy || 0)
    const points = []

    for (let step = 0; step <= steps; step += 1) {
        const angle = ((startAngle + delta * (step / steps)) * Math.PI) / 180

        points.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        })
    }

    return points
}

/**
 * Verifies mechanical outline recovery prefers the smallest enclosing
 * boundary layer instead of the tight inner cutout or a much larger frame.
 */
test('PcbOutlineRecovery selects the enclosing mechanical boundary layer', () => {
    const recovered = PcbOutlineRecovery.recoverOutline({
        fallbackOutline: {
            minX: 300,
            minY: 120,
            widthMil: 700,
            heightMil: 380,
            segments: [
                { type: 'line', x1: 300, y1: 120, x2: 1000, y2: 120 },
                { type: 'line', x1: 1000, y1: 120, x2: 1000, y2: 500 },
                { type: 'line', x1: 1000, y1: 500, x2: 300, y2: 500 },
                { type: 'line', x1: 300, y1: 500, x2: 300, y2: 120 }
            ]
        },
        components: [
            { x: 520, y: 240 },
            { x: 840, y: 260 },
            { x: 760, y: 430 }
        ],
        tracks: [
            { x1: 300, y1: 120, x2: 1000, y2: 120, width: 10, layerId: 67 },
            { x1: 1000, y1: 120, x2: 1000, y2: 500, width: 10, layerId: 67 },
            { x1: 1000, y1: 500, x2: 300, y2: 500, width: 10, layerId: 67 },
            { x1: 300, y1: 500, x2: 300, y2: 120, width: 10, layerId: 67 },
            { x1: 120, y1: 40, x2: 1380, y2: 40, width: 10, layerId: 68 },
            { x1: 1380, y1: 40, x2: 1380, y2: 680, width: 10, layerId: 68 },
            { x1: 1380, y1: 680, x2: 120, y2: 680, width: 10, layerId: 68 },
            { x1: 120, y1: 680, x2: 120, y2: 40, width: 10, layerId: 68 },
            { x1: 1600, y1: 100, x2: 1780, y2: 100, width: 10, layerId: 68 },
            { x1: 1780, y1: 100, x2: 1780, y2: 240, width: 10, layerId: 68 },
            { x1: 1780, y1: 240, x2: 1600, y2: 240, width: 10, layerId: 68 },
            { x1: 1600, y1: 240, x2: 1600, y2: 100, width: 10, layerId: 68 },
            { x1: -900, y1: -600, x2: 2600, y2: -600, width: 10, layerId: 72 },
            { x1: 2600, y1: -600, x2: 2600, y2: 1300, width: 10, layerId: 72 },
            { x1: 2600, y1: 1300, x2: -900, y2: 1300, width: 10, layerId: 72 },
            { x1: -900, y1: 1300, x2: -900, y2: -600, width: 10, layerId: 72 }
        ]
    })

    assert.equal(recovered.source, 'mechanical-track-layer')
    assert.equal(recovered.layerId, 68)
    assert.ok(recovered.outline.widthMil > 1200)
    assert.ok(recovered.outline.widthMil < 1400)
    assert.ok(recovered.outline.heightMil > 600)
    assert.ok(recovered.outline.heightMil < 720)
    assert.ok(recovered.outline.minX < 160)
    assert.ok(recovered.outline.minY < 80)
})

/**
 * Verifies board-route closure fills small routed hole bites without inflating
 * the overall board silhouette into an unrelated envelope.
 */
test('PcbOutlineRecovery closes small board-route scallops before rendering', () => {
    const rawOutline = {
        minX: 0,
        minY: 0,
        widthMil: 1000,
        heightMil: 500,
        segments: [
            { type: 'line', x1: 0, y1: 320, x2: 0, y2: 500 },
            { type: 'line', x1: 0, y1: 500, x2: 1000, y2: 500 },
            { type: 'line', x1: 1000, y1: 500, x2: 1000, y2: 0 },
            { type: 'line', x1: 1000, y1: 0, x2: 0, y2: 0 },
            { type: 'line', x1: 0, y1: 0, x2: 0, y2: 180 },
            {
                type: 'arc',
                x1: 0,
                y1: 180,
                x2: 0,
                y2: 320,
                cx: 0,
                cy: 250,
                radius: 70,
                startAngle: 270,
                endAngle: 90
            }
        ]
    }
    const recovered = PcbOutlineRecovery.recoverOutline({
        fallbackOutline: rawOutline,
        components: [
            { x: 320, y: 220 },
            { x: 720, y: 260 }
        ],
        tracks: []
    })

    assert.equal(recovered.source, 'board-route')
    assert.ok(Math.abs(recovered.outline.minX) <= 8)
    assert.ok(Math.abs(recovered.outline.minY) <= 8)
    assert.ok(Math.abs(recovered.outline.widthMil - 1000) <= 16)
    assert.ok(Math.abs(recovered.outline.heightMil - 500) <= 16)
    assert.ok(
        computeOutlineArea(recovered.outline) > computeOutlineArea(rawOutline)
    )
})

/**
 * Verifies simple authored rounded board routes stay arc-based instead of
 * being rasterized into stepped corner segments.
 */
test('PcbOutlineRecovery preserves simple authored rounded board-route arcs', () => {
    const roundedOutline = {
        minX: 3031.4961,
        minY: 2362.2047,
        widthMil: 1220.4724,
        heightMil: 1299.2126,
        segments: [
            {
                type: 'line',
                x1: 3031.4961,
                y1: 2412.2047,
                x2: 3031.4961,
                y2: 3611.4173
            },
            {
                type: 'arc',
                x1: 3031.4961,
                y1: 3611.4173,
                x2: 3081.4961,
                y2: 3661.4173,
                cx: 3081.4961,
                cy: 3611.4173,
                radius: 50,
                startAngle: 90,
                endAngle: 180
            },
            {
                type: 'line',
                x1: 3081.4961,
                y1: 3661.4173,
                x2: 4201.9685,
                y2: 3661.4173
            },
            {
                type: 'arc',
                x1: 4201.9685,
                y1: 3661.4173,
                x2: 4251.9685,
                y2: 3611.4173,
                cx: 4201.9685,
                cy: 3611.4173,
                radius: 50,
                startAngle: 0,
                endAngle: 90
            },
            {
                type: 'line',
                x1: 4251.9685,
                y1: 3611.4173,
                x2: 4251.9685,
                y2: 2412.2047
            },
            {
                type: 'arc',
                x1: 4251.9685,
                y1: 2412.2047,
                x2: 4201.9685,
                y2: 2362.2047,
                cx: 4201.9685,
                cy: 2412.2047,
                radius: 50,
                startAngle: 270,
                endAngle: 360
            },
            {
                type: 'line',
                x1: 4201.9685,
                y1: 2362.2047,
                x2: 3081.4961,
                y2: 2362.2047
            },
            {
                type: 'arc',
                x1: 3081.4961,
                y1: 2362.2047,
                x2: 3031.4961,
                y2: 2412.2047,
                cx: 3081.4961,
                cy: 2412.2047,
                radius: 50,
                startAngle: 180,
                endAngle: 270
            },
            {
                type: 'line',
                x1: 3031.4961,
                y1: 2412.2047,
                x2: 3031.4961,
                y2: 2412.2047
            }
        ]
    }
    const recovered = PcbOutlineRecovery.recoverOutline({
        fallbackOutline: roundedOutline,
        components: [
            { x: 3380, y: 2720 },
            { x: 3870, y: 3270 }
        ],
        tracks: []
    })

    assert.equal(recovered.source, 'board-route')
    assert.equal(recovered.outline.segments.length, 9)
    assert.equal(
        recovered.outline.segments.filter((segment) => segment.type === 'arc')
            .length,
        4
    )
    assert.equal(
        recovered.outline.segments.filter((segment) => segment.type === 'line')
            .length,
        5
    )
})

/**
 * Verifies the PCB top-view normalization mirrors Y coordinates around the
 * recovered board outline instead of leaving the board upside down.
 */
test('PcbOutlineRecovery flips PCB geometry into top-view SVG coordinates', () => {
    const normalized = PcbOutlineRecovery.flipGeometryVertically({
        boardOutline: {
            minX: 120,
            minY: 40,
            widthMil: 1260,
            heightMil: 640,
            segments: [
                { type: 'line', x1: 120, y1: 40, x2: 1380, y2: 40 },
                { type: 'line', x1: 1380, y1: 40, x2: 1380, y2: 680 },
                { type: 'line', x1: 1380, y1: 680, x2: 120, y2: 680 },
                { type: 'line', x1: 120, y1: 680, x2: 120, y2: 40 }
            ]
        },
        polygons: [
            {
                layer: 'TOP',
                segments: [
                    { type: 'line', x1: 400, y1: 100, x2: 520, y2: 100 },
                    { type: 'line', x1: 520, y1: 100, x2: 520, y2: 160 },
                    { type: 'line', x1: 520, y1: 160, x2: 400, y2: 160 },
                    { type: 'line', x1: 400, y1: 160, x2: 400, y2: 100 }
                ]
            }
        ],
        fills: [
            { x1: 640, y1: 120, x2: 720, y2: 180, layerId: 1, layerCode: 256 }
        ],
        tracks: [
            {
                x1: 260,
                y1: 200,
                x2: 860,
                y2: 200,
                width: 12,
                layerId: 1,
                layerCode: 256
            }
        ],
        vias: [{ x: 860, y: 200, diameter: 24, holeDiameter: 10 }],
        pads: [{ x: 700, y: 150, rotation: 90, holeRotation: 15 }],
        components: [
            {
                designator: 'U1',
                x: 500,
                y: 180,
                rotation: 0,
                layer: 'TOP',
                pattern: 'QFN'
            }
        ]
    })

    assert.equal(normalized.boardOutline.segments[0].y1, 680)
    assert.equal(normalized.boardOutline.segments[0].y2, 680)
    assert.equal(normalized.tracks[0].y1, 520)
    assert.equal(normalized.tracks[0].y2, 520)
    assert.equal(normalized.vias[0].y, 520)
    assert.equal(normalized.pads[0].y, 570)
    assert.equal(normalized.pads[0].rotation, 270)
    assert.equal(normalized.pads[0].holeRotation, 345)
    assert.equal(normalized.components[0].y, 540)
    assert.equal(normalized.fills[0].y1, 540)
    assert.equal(normalized.fills[0].y2, 600)
})
