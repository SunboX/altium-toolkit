// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbEdgeFacingGlyphNormalizer } from '../../src/ui/PcbEdgeFacingGlyphNormalizer.mjs'

test('PcbEdgeFacingGlyphNormalizer flips right-pointing screw heads onto the tip-facing half', () => {
    const normalized = PcbEdgeFacingGlyphNormalizer.normalize(
        {
            fills: [],
            tracks: [
                { x1: 400, y1: 380, x2: 480, y2: 380, width: 8, layerId: 33 },
                { x1: 400, y1: 420, x2: 480, y2: 420, width: 8, layerId: 33 },
                { x1: 400, y1: 380, x2: 400, y2: 420, width: 8, layerId: 33 },
                { x1: 410, y1: 382, x2: 420, y2: 418, width: 8, layerId: 33 },
                { x1: 430, y1: 382, x2: 440, y2: 418, width: 8, layerId: 33 },
                { x1: 450, y1: 382, x2: 460, y2: 418, width: 8, layerId: 33 },
                { x1: 480, y1: 400, x2: 520, y2: 375, width: 8, layerId: 33 },
                { x1: 480, y1: 400, x2: 520, y2: 425, width: 8, layerId: 33 }
            ],
            arcs: [
                {
                    x: 480,
                    y: 400,
                    radius: 28,
                    startAngle: 90,
                    endAngle: 270,
                    width: 8,
                    layerId: 33
                },
                {
                    x: 340,
                    y: 400,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerId: 33
                }
            ]
        },
        {
            minX: 0,
            minY: 0,
            widthMil: 1200,
            heightMil: 500
        }
    )

    assert.deepEqual(normalized.tracks, [
        { x1: 400, y1: 380, x2: 480, y2: 380, width: 8, layerId: 33 },
        { x1: 400, y1: 420, x2: 480, y2: 420, width: 8, layerId: 33 },
        { x1: 400, y1: 380, x2: 400, y2: 420, width: 8, layerId: 33 },
        { x1: 410, y1: 382, x2: 420, y2: 418, width: 8, layerId: 33 },
        { x1: 430, y1: 382, x2: 440, y2: 418, width: 8, layerId: 33 },
        { x1: 450, y1: 382, x2: 460, y2: 418, width: 8, layerId: 33 },
        { x1: 480, y1: 400, x2: 520, y2: 375, width: 8, layerId: 33 },
        { x1: 480, y1: 400, x2: 520, y2: 425, width: 8, layerId: 33 }
    ])
    assert.deepEqual(normalized.arcs, [
        {
            x: 480,
            y: 400,
            radius: 28,
            startAngle: 90,
            endAngle: -90,
            width: 8,
            layerId: 33
        },
        {
            x: 340,
            y: 400,
            radius: 30,
            startAngle: 0,
            endAngle: 0,
            width: 8,
            layerId: 33
        }
    ])
})

test('PcbEdgeFacingGlyphNormalizer keeps left-pointing screw heads on the tip-facing half', () => {
    const normalized = PcbEdgeFacingGlyphNormalizer.normalize(
        {
            fills: [],
            tracks: [
                { x1: 100, y1: 180, x2: 180, y2: 180, width: 8, layerId: 33 },
                { x1: 100, y1: 220, x2: 180, y2: 220, width: 8, layerId: 33 },
                { x1: 180, y1: 180, x2: 180, y2: 220, width: 8, layerId: 33 },
                { x1: 120, y1: 182, x2: 130, y2: 218, width: 8, layerId: 33 },
                { x1: 140, y1: 182, x2: 150, y2: 218, width: 8, layerId: 33 },
                { x1: 160, y1: 182, x2: 170, y2: 218, width: 8, layerId: 33 },
                { x1: 60, y1: 175, x2: 100, y2: 200, width: 8, layerId: 33 },
                { x1: 60, y1: 225, x2: 100, y2: 200, width: 8, layerId: 33 }
            ],
            arcs: [
                {
                    x: 100,
                    y: 200,
                    radius: 28,
                    startAngle: 270,
                    endAngle: 90,
                    width: 8,
                    layerId: 33
                },
                {
                    x: 260,
                    y: 200,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerId: 33
                }
            ]
        },
        {
            minX: 0,
            minY: 0,
            widthMil: 1000,
            heightMil: 500
        }
    )

    assert.deepEqual(normalized.tracks, [
        { x1: 100, y1: 180, x2: 180, y2: 180, width: 8, layerId: 33 },
        { x1: 100, y1: 220, x2: 180, y2: 220, width: 8, layerId: 33 },
        { x1: 180, y1: 180, x2: 180, y2: 220, width: 8, layerId: 33 },
        { x1: 120, y1: 182, x2: 130, y2: 218, width: 8, layerId: 33 },
        { x1: 140, y1: 182, x2: 150, y2: 218, width: 8, layerId: 33 },
        { x1: 160, y1: 182, x2: 170, y2: 218, width: 8, layerId: 33 },
        { x1: 60, y1: 175, x2: 100, y2: 200, width: 8, layerId: 33 },
        { x1: 60, y1: 225, x2: 100, y2: 200, width: 8, layerId: 33 }
    ])
    assert.deepEqual(normalized.arcs, [
        {
            x: 100,
            y: 200,
            radius: 28,
            startAngle: 270,
            endAngle: 90,
            width: 8,
            layerId: 33
        },
        {
            x: 260,
            y: 200,
            radius: 30,
            startAngle: 0,
            endAngle: 0,
            width: 8,
            layerId: 33
        }
    ])
})

test('PcbEdgeFacingGlyphNormalizer.normalizeForBoardEdge flips corner-adjacent right-pointing heads', () => {
    const normalized = PcbEdgeFacingGlyphNormalizer.normalizeForBoardEdge(
        {
            fills: [],
            tracks: [
                { x1: 100, y1: 900, x2: 180, y2: 900, width: 8, layerId: 33 },
                { x1: 100, y1: 940, x2: 180, y2: 940, width: 8, layerId: 33 },
                { x1: 100, y1: 900, x2: 100, y2: 940, width: 8, layerId: 33 },
                { x1: 110, y1: 902, x2: 120, y2: 938, width: 8, layerId: 33 },
                { x1: 130, y1: 902, x2: 140, y2: 938, width: 8, layerId: 33 },
                { x1: 150, y1: 902, x2: 160, y2: 938, width: 8, layerId: 33 },
                { x1: 180, y1: 920, x2: 220, y2: 895, width: 8, layerId: 33 },
                { x1: 180, y1: 920, x2: 220, y2: 945, width: 8, layerId: 33 }
            ],
            arcs: [
                {
                    x: 180,
                    y: 920,
                    radius: 28,
                    startAngle: 90,
                    endAngle: 270,
                    width: 8,
                    layerId: 33
                }
            ]
        },
        {
            minX: 0,
            minY: 0,
            widthMil: 1000,
            heightMil: 1000
        }
    )

    assert.deepEqual(normalized.tracks, [
        { x1: 100, y1: 900, x2: 180, y2: 900, width: 8, layerId: 33 },
        { x1: 100, y1: 940, x2: 180, y2: 940, width: 8, layerId: 33 },
        { x1: 100, y1: 900, x2: 100, y2: 940, width: 8, layerId: 33 },
        { x1: 110, y1: 902, x2: 120, y2: 938, width: 8, layerId: 33 },
        { x1: 130, y1: 902, x2: 140, y2: 938, width: 8, layerId: 33 },
        { x1: 150, y1: 902, x2: 160, y2: 938, width: 8, layerId: 33 },
        { x1: 180, y1: 920, x2: 220, y2: 895, width: 8, layerId: 33 },
        { x1: 180, y1: 920, x2: 220, y2: 945, width: 8, layerId: 33 }
    ])
    assert.deepEqual(normalized.arcs, [
        {
            x: 180,
            y: 920,
            radius: 28,
            startAngle: 90,
            endAngle: -90,
            width: 8,
            layerId: 33
        }
    ])
})

test('PcbEdgeFacingGlyphNormalizer keeps downward-pointing screw heads on the tip-facing half', () => {
    const normalized = PcbEdgeFacingGlyphNormalizer.normalize(
        {
            fills: [],
            tracks: [
                { x1: 180, y1: 100, x2: 220, y2: 100, width: 8, layerId: 33 },
                { x1: 180, y1: 120, x2: 220, y2: 120, width: 8, layerId: 33 },
                { x1: 180, y1: 100, x2: 180, y2: 120, width: 8, layerId: 33 },
                { x1: 182, y1: 90, x2: 218, y2: 80, width: 8, layerId: 33 },
                { x1: 182, y1: 110, x2: 218, y2: 100, width: 8, layerId: 33 },
                { x1: 182, y1: 130, x2: 218, y2: 120, width: 8, layerId: 33 },
                { x1: 200, y1: 120, x2: 175, y2: 160, width: 8, layerId: 33 },
                { x1: 200, y1: 120, x2: 225, y2: 160, width: 8, layerId: 33 }
            ],
            arcs: [
                {
                    x: 200,
                    y: 120,
                    radius: 28,
                    startAngle: 180,
                    endAngle: 0,
                    width: 8,
                    layerId: 33
                }
            ]
        },
        {
            minX: 0,
            minY: 0,
            widthMil: 1000,
            heightMil: 500
        }
    )

    assert.deepEqual(normalized.tracks, [
        { x1: 180, y1: 100, x2: 220, y2: 100, width: 8, layerId: 33 },
        { x1: 180, y1: 120, x2: 220, y2: 120, width: 8, layerId: 33 },
        { x1: 180, y1: 100, x2: 180, y2: 120, width: 8, layerId: 33 },
        { x1: 182, y1: 90, x2: 218, y2: 80, width: 8, layerId: 33 },
        { x1: 182, y1: 110, x2: 218, y2: 100, width: 8, layerId: 33 },
        { x1: 182, y1: 130, x2: 218, y2: 120, width: 8, layerId: 33 },
        { x1: 200, y1: 120, x2: 175, y2: 160, width: 8, layerId: 33 },
        { x1: 200, y1: 120, x2: 225, y2: 160, width: 8, layerId: 33 }
    ])
    assert.deepEqual(normalized.arcs, [
        {
            x: 200,
            y: 120,
            radius: 28,
            startAngle: 180,
            endAngle: 0,
            width: 8,
            layerId: 33
        }
    ])
})
