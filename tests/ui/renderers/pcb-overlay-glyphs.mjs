// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'

/**
 * Verifies screw glyphs keep their authored shafts while only tip-facing
 * head corrections change the rendered semicircle side.
 */
test('renderPcbSvg keeps authored screw shafts while correcting tip-facing heads', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Edge-adjacent screw glyph board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 1000 },
                    { type: 'line', x1: 1000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 100,
                    y1: 180,
                    x2: 180,
                    y2: 180,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 100,
                    y1: 220,
                    x2: 180,
                    y2: 220,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 100,
                    y1: 180,
                    x2: 100,
                    y2: 220,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 110,
                    y1: 182,
                    x2: 120,
                    y2: 218,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 130,
                    y1: 182,
                    x2: 140,
                    y2: 218,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 150,
                    y1: 182,
                    x2: 160,
                    y2: 218,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 180,
                    y1: 200,
                    x2: 220,
                    y2: 175,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 180,
                    y1: 200,
                    x2: 220,
                    y2: 225,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 100,
                    y1: 380,
                    x2: 180,
                    y2: 380,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 100,
                    y1: 420,
                    x2: 180,
                    y2: 420,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 180,
                    y1: 380,
                    x2: 180,
                    y2: 420,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 120,
                    y1: 382,
                    x2: 130,
                    y2: 418,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 140,
                    y1: 382,
                    x2: 150,
                    y2: 418,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 160,
                    y1: 382,
                    x2: 170,
                    y2: 418,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 60,
                    y1: 375,
                    x2: 100,
                    y2: 400,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 60,
                    y1: 425,
                    x2: 100,
                    y2: 400,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 380,
                    y1: 100,
                    x2: 420,
                    y2: 100,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 380,
                    y1: 120,
                    x2: 420,
                    y2: 120,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 380,
                    y1: 100,
                    x2: 380,
                    y2: 120,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 382,
                    y1: 90,
                    x2: 418,
                    y2: 80,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 382,
                    y1: 110,
                    x2: 418,
                    y2: 100,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 382,
                    y1: 130,
                    x2: 418,
                    y2: 120,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 400,
                    y1: 120,
                    x2: 375,
                    y2: 160,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 400,
                    y1: 120,
                    x2: 425,
                    y2: 160,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                }
            ],
            arcs: [
                {
                    x: 180,
                    y: 200,
                    radius: 28,
                    startAngle: 90,
                    endAngle: 270,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 40,
                    y: 200,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 100,
                    y: 400,
                    radius: 28,
                    startAngle: 270,
                    endAngle: 90,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 260,
                    y: 400,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 400,
                    y: 120,
                    radius: 28,
                    startAngle: 180,
                    endAngle: 0,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                }
            ],
            vias: [],
            pads: [],
            components: [
                {
                    designator: 'J1',
                    x: 150,
                    y: 200,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'EDGE-GLYPH'
                },
                {
                    designator: 'J2',
                    x: 120,
                    y: 400,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'EDGE-GLYPH'
                }
            ]
        }
    })

    assert.match(
        markup,
        /<path class="pcb-footprint-arc" d="M 180 228 A 28 28 0 0 0 180 172" stroke-width="8" fill="none" \/>/
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="180" y1="200" x2="220" y2="175"/
    )
    assert.match(
        markup,
        /<path class="pcb-footprint-arc" d="M 100 372 A 28 28 0 0 0 100 428" stroke-width="8" fill="none" \/>/
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="60" y1="375" x2="100" y2="400"/
    )
    assert.match(
        markup,
        /<path class="pcb-footprint-arc" d="M 372 120 A 28 28 0 0 0 428 120" stroke-width="8" fill="none" \/>/
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="400" y1="120" x2="375" y2="160"/
    )
    assert.doesNotMatch(
        markup,
        /<path class="pcb-footprint-arc" d="M 180 228 A 28 28 0 0 1 180 172" stroke-width="8" fill="none" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<path class="pcb-footprint-arc" d="M 100 372 A 28 28 0 0 1 100 428" stroke-width="8" fill="none" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<path class="pcb-footprint-arc" d="M 372 120 A 28 28 0 0 1 428 120" stroke-width="8" fill="none" \/>/
    )
})
