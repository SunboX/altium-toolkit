// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'

/**
 * Verifies PCB SVG rendering prefers a smooth board-region contour when the
 * recovered board route is a rasterized stair-step outline.
 */
test('renderPcbSvg refines rasterized board outlines from board regions', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Smooth board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: createStairStepSegments()
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 1, name: 'Top Layer' }],
            boardRegions: [
                {
                    objectKind: 'BoardRegion',
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
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            regions: [],
            shapeBasedRegions: [],
            vias: [],
            pads: [],
            components: []
        }
    })

    assert.match(
        markup,
        /<path class="board-outline" d="M 0 100 L 0 0 L 100 0 L 100 76 L 96 88 L 88 96 L 76 100 L 0 100 Z" \/>/
    )
    assert.doesNotMatch(markup, /L 72 96 L 80 96/)
})

/**
 * Verifies thick board-outline strokes use rounded joins and caps so smoothed
 * contours do not produce sharp miter spikes at small angle changes.
 */
test('renderer stylesheet rounds PCB board outline stroke joins', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')
    const boardOutlineBlock = css.match(/\.board-outline\s*\{[^}]*\}/)?.[0]

    assert.ok(boardOutlineBlock)
    assert.match(boardOutlineBlock, /stroke-linejoin:\s*round;/)
    assert.match(boardOutlineBlock, /stroke-linecap:\s*round;/)
})

/**
 * Creates a small rasterized Manhattan contour that approximates one rounded
 * board corner.
 * @returns {{ type: string, x1: number, y1: number, x2: number, y2: number }[]}
 */
function createStairStepSegments() {
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

    return stairPoints.map((point, index) => {
        const next = stairPoints[(index + 1) % stairPoints.length]

        return {
            type: 'line',
            x1: point.x,
            y1: point.y,
            x2: next.x,
            y2: next.y
        }
    })
}
