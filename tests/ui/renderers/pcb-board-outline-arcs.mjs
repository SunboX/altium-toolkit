// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'

/**
 * Verifies board-outline semicircle arcs use authored angles to break the
 * otherwise ambiguous endpoint cross-product tie.
 */
test('renderPcbSvg honors board-outline semicircle arc sweep from angles', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Side slot board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 300,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 400, y2: 0 },
                    { type: 'line', x1: 400, y1: 0, x2: 400, y2: 300 },
                    { type: 'line', x1: 400, y1: 300, x2: 0, y2: 300 },
                    { type: 'line', x1: 0, y1: 300, x2: 0, y2: 210 },
                    {
                        type: 'arc',
                        x1: 0,
                        y1: 210,
                        x2: 0,
                        y2: 90,
                        cx: 0,
                        cy: 150,
                        radius: 60,
                        startAngle: 90,
                        endAngle: 270
                    },
                    { type: 'line', x1: 0, y1: 90, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            components: []
        }
    })

    assert.match(markup, /A 60 60 0 0 0 0 90/)
})
