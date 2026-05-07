// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    PcbSideResolvedRenderModel,
    isCopperPrimitive,
    preparePcbSideResolvedRenderModel
} from '../../src/renderers.mjs'

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
        [-1, -32, 33]
    )
    assert.deepEqual(
        resolved.pcb.fills.map((fill) => fill.layerCode),
        [-1, 33]
    )
    assert.equal(isCopperPrimitive(resolved.pcb.tracks[0]), true)
    assert.equal(isCopperPrimitive(resolved.pcb.tracks[2]), false)
})

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
