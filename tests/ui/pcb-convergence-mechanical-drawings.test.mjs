// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbSvgRenderer } from '../../src/convergence/PcbSvgRenderer.mjs'

/**
 * Builds one generic PCB with compact source layer names and off-board drawing
 * content.
 * @returns {object}
 */
function createDrawingBoard() {
    const primitiveLayers = [
        { layerId: 1, name: 'Top Layer', role: 'copper' },
        { layerId: 33, name: 'TopOverlay', role: 'overlay' },
        { layerId: 34, name: 'BottomOverlay', role: 'overlay' },
        { layerId: 57, name: 'Mechanical1', role: 'mechanical' },
        { layerId: 58, name: 'ASM TOP', role: 'assembly' },
        { layerId: 59, name: 'ASM BOT', role: 'assembly' },
        { layerId: 60, name: 'Notes', role: 'documentation' }
    ]

    return {
        summary: { title: 'Drawing visibility board' },
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
                    { type: 'line', x1: 0, y1: 300, x2: 0, y2: 0 }
                ]
            },
            layers: [{ layerId: 1, name: 'Top Layer', role: 'copper' }],
            primitiveLayers,
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 5000,
                    y1: 4000,
                    x2: 7000,
                    y2: 4000,
                    width: 10,
                    layerId: 57
                }
            ],
            arcs: [],
            regions: [],
            vias: [],
            pads: [],
            texts: primitiveLayers.slice(1).map((layer) => ({
                text: layer.name,
                x: layer.layerId === 60 ? 7200 : 100,
                y: layer.layerId === 60 ? 4300 : layer.layerId * 3,
                height: layer.layerId === 60 ? 80 : 12,
                layerId: layer.layerId
            })),
            dimensions: [],
            components: []
        }
    }
}

/**
 * Reads the numeric root SVG viewBox.
 * @param {string} markup SVG markup.
 * @returns {number[]}
 */
function readViewBox(markup) {
    const match = markup.match(/<svg class="pcb-svg" viewBox="([^"]+)"/u)
    assert.ok(match, 'root PCB viewBox is present')
    return match[1].split(/\s+/u).map(Number)
}

/**
 * Verifies convergence adds side-correct annotations and keeps drawing text
 * outside the board clip used by ordinary overlay labels.
 */
test('convergence PCB renderer restores drawing text for both sides', () => {
    const documentModel = createDrawingBoard()
    const topMarkup = PcbSvgRenderer.render(documentModel, { side: 'top' })
    const bottomMarkup = PcbSvgRenderer.render(documentModel, {
        side: 'bottom'
    })

    assert.match(topMarkup, />TopOverlay</)
    assert.match(topMarkup, />Mechanical1</)
    assert.match(topMarkup, />ASM TOP</)
    assert.match(topMarkup, />Notes</)
    assert.doesNotMatch(topMarkup, />BottomOverlay</)
    assert.doesNotMatch(topMarkup, />ASM BOT</)
    assert.match(
        topMarkup,
        /<g class="pcb-drawing-texts">[\s\S]*data-layer-display-name="Mechanical1"[\s\S]*<\/g>/u
    )

    assert.match(bottomMarkup, />Mechanical1</)
    assert.match(bottomMarkup, />ASM BOT</)
    assert.doesNotMatch(bottomMarkup, />ASM TOP</)
})

/**
 * Verifies hidden drawing layers retain their markup but no longer enlarge the
 * fitted viewport.
 */
test('convergence PCB renderer fits the viewBox to visible layers', () => {
    const documentModel = createDrawingBoard()
    const visibleMarkup = PcbSvgRenderer.render(documentModel)
    const hiddenMarkup = PcbSvgRenderer.render(documentModel, {
        hiddenLayers: ['Mechanical1', 'Notes']
    })

    assert.ok(readViewBox(visibleMarkup)[2] > 7000)
    assert.deepEqual(readViewBox(hiddenMarkup), [-240, -240, 880, 780])
    assert.match(hiddenMarkup, /data-layer-display-name="Mechanical1"/)
    assert.match(hiddenMarkup, />Notes</)
})
