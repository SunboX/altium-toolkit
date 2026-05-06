// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'

/**
 * Verifies rendered Altium region polygons are drawn as filled copper with
 * even-odd holes instead of being dropped from the PCB view.
 */
test('renderPcbSvg renders shape-based copper regions with holes', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Region copper board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 300,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 500, y2: 0 },
                    { type: 'line', x1: 500, y1: 0, x2: 500, y2: 300 },
                    { type: 'line', x1: 500, y1: 300, x2: 0, y2: 300 },
                    { type: 'line', x1: 0, y1: 300, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 1, name: 'Top Layer' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            regions: [],
            shapeBasedRegions: [
                {
                    layerId: 1,
                    layerCode: 1,
                    points: [
                        { x: 100, y: 80 },
                        { x: 260, y: 80 },
                        { x: 260, y: 180 },
                        { x: 100, y: 180 }
                    ],
                    holes: [
                        [
                            { x: 140, y: 110 },
                            { x: 180, y: 110 },
                            { x: 180, y: 150 },
                            { x: 140, y: 150 }
                        ]
                    ]
                }
            ],
            vias: [],
            pads: [],
            components: []
        }
    })

    assert.match(markup, /class="pcb-region pcb-region--surface"/)
    assert.match(markup, /fill-rule="evenodd"/)
    assert.match(
        markup,
        /d="M 100 80 L 260 80 L 260 180 L 100 180 Z M 140 110 L 180 110 L 180 150 L 140 150 Z"/
    )
})
