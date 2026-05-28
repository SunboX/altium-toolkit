// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a small rectangular board outline for scene-builder placement tests.
 * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: { type: string, x1: number, y1: number, x2: number, y2: number }[] }}
 */
function buildBoardOutline() {
    return {
        minX: 0,
        minY: 0,
        widthMil: 1000,
        heightMil: 500,
        segments: [
            { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
            { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
            { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
            { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
        ]
    }
}

/**
 * Builds a minimal registry that resolves every synthetic body model.
 * @returns {{ resolveComponentModel: () => null, resolveComponentBodyModel: (componentBody: { name?: string, sourceStream?: string }) => { origin: string, name: string, format: string, sourceStream: string } }}
 */
function buildModelRegistry() {
    return {
        resolveComponentModel() {
            return null
        },
        resolveComponentBodyModel(componentBody) {
            return {
                origin: 'embedded',
                name: String(componentBody.name || ''),
                format: 'step',
                sourceStream: String(componentBody.sourceStream || '')
            }
        }
    }
}

/**
 * Verifies matched external bodies promote authored 3D yaw while keeping the
 * native body anchor instead of moving onto the 2D component origin.
 */
test('PcbScene3dBuilder promotes explicit body yaw after component matching', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: buildBoardOutline(),
                pads: [],
                tracks: [],
                arcs: [],
                fills: [],
                vias: [],
                polygons: [],
                componentBodies: [
                    {
                        sourceStream: 'ComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'aurora_socket_body',
                        modelId: '{MODEL-1}',
                        checksum: 123,
                        embedded: true,
                        name: 'aurora_socket_body.step',
                        positionMil: { x: 240, y: 180 },
                        rotationDeg: 30,
                        modelRotationDeg: { x: 90, y: 0, z: 270 },
                        dzMil: 12
                    }
                ],
                components: [
                    {
                        designator: 'J1',
                        x: 400,
                        y: 320,
                        rotation: 180,
                        layer: 'TOP',
                        pattern: 'AURORA_SOCKET',
                        source: 'CON/AURORA_SOCKET',
                        height: 80
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.sourceFormat, 'altium')
    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'J1')
    assert.equal(scene.externalPlacements[0].mountSide, 'top')
    assert.equal(scene.externalPlacements[0].rotationDeg, 270)
    assert.deepEqual(scene.externalPlacements[0].positionMil, {
        x: -260,
        y: -70,
        z: 31.5
    })
})

/**
 * Verifies repeated sub-bodies keep their own anchors while exact-position
 * members can still claim their owning component.
 */
test('PcbScene3dBuilder keeps repeated sub-body anchors with exact matches', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: buildBoardOutline(),
                pads: [],
                tracks: [],
                arcs: [],
                fills: [],
                vias: [],
                polygons: [],
                componentBodies: [120, 220, 320].map((y) => ({
                    sourceStream: 'ComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'ember_pin_unit',
                    modelId: '{MODEL-PIN}',
                    checksum: 456,
                    embedded: true,
                    name: 'ember_pin_unit.step',
                    positionMil: { x: 520, y },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 270 },
                    dzMil: 0
                })),
                components: [
                    {
                        designator: 'J1',
                        x: 520,
                        y: 220,
                        rotation: 180,
                        layer: 'BOTTOM',
                        pattern: 'EMBER_PIN_ROW',
                        source: 'CON/EMBER_PIN_ROW',
                        height: 80
                    },
                    {
                        designator: 'U1',
                        x: 540,
                        y: 260,
                        rotation: 90,
                        layer: 'TOP',
                        pattern: 'AURORA_MODULE',
                        source: 'MODULE/AURORA',
                        height: 80
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 3)
    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.designator),
        ['ember_pin_unit', 'J1', 'ember_pin_unit']
    )
    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.positionMil),
        [
            { x: 20, y: -130, z: 31.5 },
            { x: 20, y: -30, z: 31.5 },
            { x: 20, y: 70, z: 31.5 }
        ]
    )
})

/**
 * Verifies 3D silkscreen detail includes overlay-region fills alongside line
 * and arc primitives so filled documentation artwork can render on the board.
 */
test('PcbScene3dBuilder promotes overlay regions into silkscreen fills', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: buildBoardOutline(),
            primitiveLayers: [
                { layerId: 33, name: 'Top Overlay' },
                { layerId: 34, name: 'Bottom Overlay' }
            ],
            pads: [],
            tracks: [{ x1: 10, y1: 20, x2: 70, y2: 20, width: 6, layerId: 33 }],
            arcs: [],
            fills: [],
            regions: [
                {
                    layerId: 33,
                    points: [
                        { x: 100, y: 120 },
                        { x: 160, y: 120 },
                        { x: 160, y: 180 },
                        { x: 100, y: 180 }
                    ],
                    holes: []
                },
                {
                    layerId: 34,
                    points: [
                        { x: 200, y: 220 },
                        { x: 260, y: 220 },
                        { x: 260, y: 280 },
                        { x: 200, y: 280 }
                    ],
                    holes: []
                }
            ],
            vias: [],
            polygons: [],
            components: []
        }
    })

    assert.equal(scene.detail.silkscreen.top.regions.length, 1)
    assert.equal(scene.detail.silkscreen.bottom.regions.length, 1)
    assert.deepEqual(scene.detail.silkscreen.top.fills, [
        {
            layerId: 33,
            points: [
                { x: 100, y: 120 },
                { x: 160, y: 120 },
                { x: 160, y: 180 },
                { x: 100, y: 180 }
            ],
            holes: []
        }
    ])
    assert.deepEqual(scene.detail.silkscreen.bottom.fills, [
        {
            layerId: 34,
            points: [
                { x: 200, y: 220 },
                { x: 260, y: 220 },
                { x: 260, y: 280 },
                { x: 200, y: 280 }
            ],
            holes: []
        }
    ])
})
