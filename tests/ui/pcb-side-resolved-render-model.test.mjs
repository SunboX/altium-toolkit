// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    PcbSideResolvedRenderModel,
    isCopperPrimitive,
    preparePcbSideResolvedRenderModel
} from '../../src/legacy-renderers.mjs'

/**
 * Verifies the toolkit owns Altium front-view filtering without mutating input.
 */
test('PcbSideResolvedRenderModel resolves front-facing PCB render data', () => {
    const board = buildSideFixtureBoard()

    const resolved = PcbSideResolvedRenderModel.resolve(board, {
        side: 'front'
    })

    assert.deepEqual(
        resolved.pcb.components.map((component) => component.designator),
        ['U1', 'J3']
    )
    assert.deepEqual(
        resolved.pcb.pads.map((pad) => pad.id),
        ['top-pad', 'multi-layer-pad']
    )
    assert.deepEqual(
        resolved.pcb.vias.map((via) => via.id),
        ['front-via', 'through-via', 'unknown-via']
    )
    assert.equal(resolved.pcb.tracks[0].layerCode, 1)
    assert.equal(resolved.pcb.polygons[0].layer, 'TOP')
    assert.equal(board.pcb.pads[1].layerId, 32)
    assert.equal(board.pcb.tracks[0].layerCode, 1)
})

/**
 * Verifies the toolkit owns Altium back-view projection for top-only renderers.
 */
test('PcbSideResolvedRenderModel resolves back-facing PCB render data', () => {
    const board = buildSideFixtureBoard()

    const resolved = preparePcbSideResolvedRenderModel(board, 'back')

    assert.deepEqual(
        resolved.pcb.components.map((component) => component.designator),
        ['U2']
    )
    assert.deepEqual(
        resolved.pcb.primitiveLayers.map((layer) => layer.name),
        ['Hidden Overlay', 'Top Overlay', 'Mechanical 1']
    )
    assert.deepEqual(
        resolved.pcb.polygons.map((polygon) => polygon.layer),
        ['HIDDEN', 'TOP', 'INNER']
    )
    assert.deepEqual(
        resolved.pcb.pads.map((pad) => ({
            id: pad.id,
            layerId: pad.layerId,
            layerCode: pad.layerCode,
            shapeTop: pad.shapeTop,
            sizeTopX: pad.sizeTopX,
            sizeTopY: pad.sizeTopY,
            roundedRectShapeTop: pad.roundedRectShapeTop,
            cornerRadiusTop: pad.cornerRadiusTop
        })),
        [
            {
                id: 'bottom-pad',
                layerId: 1,
                layerCode: 1,
                shapeTop: 3,
                sizeTopX: 70,
                sizeTopY: 45,
                roundedRectShapeTop: 9,
                cornerRadiusTop: 7
            },
            {
                id: 'multi-layer-pad',
                layerId: 2,
                layerCode: 2,
                shapeTop: 5,
                sizeTopX: 30,
                sizeTopY: 25,
                roundedRectShapeTop: 11,
                cornerRadiusTop: 8
            }
        ]
    )
    assert.deepEqual(
        resolved.pcb.vias.map((via) => via.id),
        ['back-via', 'through-via', 'unknown-via']
    )
    assert.deepEqual(
        resolved.pcb.tracks.map((track) => track.layerCode),
        [-1, -32]
    )
    assert.deepEqual(
        resolved.pcb.fills.map((fill) => fill.layerCode),
        [-1]
    )
    assert.equal(isCopperPrimitive(resolved.pcb.tracks[0]), true)
})

/**
 * Verifies side projection excludes opposite-side fabrication details while
 * retaining neutral documentation layers.
 */
test('PcbSideResolvedRenderModel filters opposite-side fabrication details', () => {
    const board = {
        summary: { title: 'Surface detail fixture board' },
        pcb: {
            components: [],
            primitiveLayers: [
                { layerId: 33, name: 'Top Overlay' },
                { layerId: 34, name: 'Bottom Overlay' },
                { layerId: 35, name: 'Top Paste' },
                { layerId: 36, name: 'Bottom Paste' },
                { layerId: 37, name: 'Top Solder' },
                { layerId: 38, name: 'Bottom Solder' },
                { layerId: 57, name: 'Mechanical 1' }
            ],
            polygons: [],
            fills: [
                { id: 'front-overlay-fill', layerId: 33, layerCode: 33 },
                { id: 'back-overlay-fill', layerId: 34, layerCode: 34 }
            ],
            tracks: [
                { id: 'front-paste-track', layerId: 35, layerCode: 35 },
                { id: 'back-paste-track', layerId: 36, layerCode: 36 }
            ],
            arcs: [
                { id: 'front-mask-arc', layerId: 37, layerCode: 37 },
                { id: 'back-mask-arc', layerId: 38, layerCode: 38 }
            ],
            regions: [
                { id: 'front-overlay-region', layerId: 33, layerCode: 33 },
                { id: 'back-overlay-region', layerId: 34, layerCode: 34 }
            ],
            shapeBasedRegions: [
                {
                    id: 'front-mask-region',
                    layerId: 37,
                    layerCode: 37
                },
                { id: 'back-mask-region', layerId: 38, layerCode: 38 }
            ],
            boardRegions: [
                { id: 'neutral-board-region', layerId: 57, layerCode: 57 }
            ],
            vias: [],
            pads: []
        }
    }

    const front = preparePcbSideResolvedRenderModel(board, 'front')
    const back = preparePcbSideResolvedRenderModel(board, 'back')

    assert.deepEqual(collectSurfaceDetailIds(front.pcb), {
        fills: ['front-overlay-fill'],
        tracks: ['front-paste-track'],
        arcs: ['front-mask-arc'],
        regions: ['front-overlay-region'],
        shapeBasedRegions: ['front-mask-region'],
        boardRegions: ['neutral-board-region']
    })
    assert.deepEqual(collectSurfaceDetailIds(back.pcb), {
        fills: ['back-overlay-fill'],
        tracks: ['back-paste-track'],
        arcs: ['back-mask-arc'],
        regions: ['back-overlay-region'],
        shapeBasedRegions: ['back-mask-region'],
        boardRegions: ['neutral-board-region']
    })
})

/**
 * Collects primitive identifiers from side-resolved fabrication details.
 * @param {object} pcb Side-resolved PCB model.
 * @returns {Record<string, string[]>}
 */
function collectSurfaceDetailIds(pcb) {
    return Object.fromEntries(
        [
            'fills',
            'tracks',
            'arcs',
            'regions',
            'shapeBasedRegions',
            'boardRegions'
        ].map((key) => [key, (pcb[key] || []).map((primitive) => primitive.id)])
    )
}

/**
 * Builds a minimal normalized PCB with both top and bottom entities.
 * @returns {object}
 */
function buildSideFixtureBoard() {
    return {
        summary: { title: 'Side fixture board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                { designator: 'U1', layer: 'Top Layer' },
                { designator: 'U2', layer: 'Bottom Layer' },
                { designator: 'J3', layer: '' }
            ],
            primitiveLayers: [
                { layerId: 33, name: 'Top Overlay' },
                { layerId: 34, name: 'Bottom Overlay' },
                { layerId: 57, name: 'Mechanical 1' }
            ],
            polygons: [
                { layer: 'TOP' },
                { layer: 'BOTTOM' },
                { layer: 'INNER' }
            ],
            fills: [
                { id: 'copper-fill', layerId: 1, layerCode: 1 },
                { id: 'overlay-fill', layerId: 33, layerCode: 33 }
            ],
            tracks: [
                { id: 'top-track', layerId: 1, layerCode: 1 },
                { id: 'bottom-track', layerId: 32, layerCode: 32 },
                { id: 'overlay-track', layerId: 33, layerCode: 33 }
            ],
            arcs: [],
            regions: [],
            shapeBasedRegions: [],
            boardRegions: [],
            vias: [
                { id: 'front-via', layerStartId: 1, layerEndId: 5 },
                { id: 'back-via', layerStartId: 16, layerEndId: 32 },
                { id: 'through-via', layerStartId: 1, layerEndId: 32 },
                { id: 'unknown-via' }
            ],
            pads: [
                {
                    id: 'top-pad',
                    layerId: 1,
                    layerCode: 1,
                    sizeTopX: 50,
                    sizeTopY: 40,
                    shapeTop: 2
                },
                {
                    id: 'bottom-pad',
                    layerId: 32,
                    layerCode: 32,
                    sizeTopX: 10,
                    sizeTopY: 9,
                    sizeMidX: 20,
                    sizeMidY: 18,
                    sizeBottomX: 70,
                    sizeBottomY: 45,
                    shapeTop: 2,
                    shapeMid: 4,
                    shapeBottom: 3,
                    roundedRectShapeTop: 4,
                    roundedRectShapeMid: 6,
                    roundedRectShapeBottom: 9,
                    cornerRadiusTop: 2,
                    cornerRadiusMid: 4,
                    cornerRadiusBottom: 7
                },
                {
                    id: 'multi-layer-pad',
                    layerId: 2,
                    layerCode: 2,
                    sizeTopX: 30,
                    sizeTopY: 25,
                    shapeTop: 5,
                    roundedRectShapeTop: 11,
                    cornerRadiusTop: 8
                }
            ]
        }
    }
}
