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
 * Verifies a matched bottom component remains authoritative when its embedded
 * body is authored on a generic odd mechanical layer.
 */
test('PcbScene3dBuilder resolves matched external bodies from component side first', () => {
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
                        identifier: 'ember_socket_body',
                        modelId: '{MODEL-1}',
                        checksum: 123,
                        embedded: true,
                        name: 'ember_socket_body.step',
                        positionMil: { x: 250, y: 200 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 270 },
                        dzMil: 0
                    }
                ],
                components: [
                    {
                        designator: 'J1',
                        x: 250,
                        y: 200,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: 'EMBER_SOCKET',
                        source: 'CON/EMBER_SOCKET',
                        height: 80
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'J1')
    assert.equal(scene.externalPlacements[0].mountSide, 'bottom')
    assert.equal(scene.externalPlacements[0].positionMil.z, -31.5)
})

/**
 * Verifies unresolvable duplicate bodies do not reserve component matches
 * ahead of renderable bodies at the same footprint anchor.
 */
test('PcbScene3dBuilder ignores unresolved duplicate bodies during matching', () => {
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
                        layer: 'MECHANICAL1',
                        identifier: 'shadow_socket',
                        modelId: '{MODEL-MISSING}',
                        checksum: 111,
                        embedded: true,
                        name: 'shadow-socket.step',
                        positionMil: { x: 250, y: 200 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    {
                        sourceStream: 'ComponentBodies6/Data',
                        layer: 'MECHANICAL1',
                        identifier: 'real_socket',
                        modelId: '{MODEL-REAL}',
                        checksum: 222,
                        embedded: true,
                        name: 'real-socket.step',
                        positionMil: { x: 250, y: 200 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    }
                ],
                components: [
                    {
                        designator: 'J1',
                        x: 250,
                        y: 200,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'REAL_SOCKET',
                        source: 'CON/REAL_SOCKET',
                        height: 80
                    }
                ]
            }
        },
        {
            modelRegistry: {
                resolveComponentModel() {
                    return null
                },
                resolveComponentBodyModel(componentBody) {
                    if (componentBody.modelId !== '{MODEL-REAL}') {
                        return null
                    }

                    return {
                        origin: 'embedded',
                        name: componentBody.name,
                        format: 'step',
                        sourceStream: 'Models/0'
                    }
                }
            }
        }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'J1')
    assert.deepEqual(scene.externalPlacements[0].positionMil, {
        x: -250,
        y: -50,
        z: 31.5
    })
})

/**
 * Verifies meaningful model identity beats a nearby unrelated component when
 * an off-origin body anchor sits close to another footprint.
 */
test('PcbScene3dBuilder prefers identity matches for off-origin model anchors', () => {
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
                        layer: 'MECHANICAL1',
                        identifier: 'atlas_module',
                        modelId: '{MODEL-ATLAS}',
                        checksum: 333,
                        embedded: true,
                        name: 'atlas-module.step',
                        positionMil: { x: 410, y: 210 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 270 },
                        dzMil: 0
                    }
                ],
                components: [
                    {
                        designator: 'C1',
                        x: 410,
                        y: 210,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: 'CAP_0201',
                        source: 'PASSIVE/CAP_0201',
                        height: 12
                    },
                    {
                        designator: 'U1',
                        x: 250,
                        y: 370,
                        rotation: 270,
                        layer: 'TOP',
                        pattern: 'ATLAS_MODULE',
                        source: 'RF/ATLAS_MODULE',
                        height: 80
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'U1')
    assert.equal(scene.externalPlacements[0].mountSide, 'top')
    assert.equal(scene.externalPlacements[0].rotationDeg, 270)
})

/**
 * Verifies Altium model Z metadata does not become an initial air gap. The
 * runtime seats loaded mesh bounds on the board face before applying live user
 * adjustments.
 */
test('PcbScene3dBuilder leaves embedded body models seated on the board face', () => {
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
                        layer: 'MECHANICAL1',
                        identifier: 'raised_origin_chip',
                        modelId: '{MODEL-RAISED}',
                        checksum: 444,
                        embedded: true,
                        name: 'raised-origin-chip.step',
                        positionMil: { x: 250, y: 200 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 40,
                        overallHeightMil: 60,
                        standoffHeightMil: 40
                    }
                ],
                components: [
                    {
                        designator: 'U2',
                        x: 250,
                        y: 200,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'RAISED_ORIGIN_CHIP',
                        source: 'IC/RAISED_ORIGIN_CHIP',
                        height: 60
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'U2')
    assert.equal(scene.externalPlacements[0].modelTransform.dzMil, 0)
})

/**
 * Verifies embedded bodies with authored geometry below the mount plane keep
 * that penetration so pins and leads are not lifted onto the board surface.
 */
test('PcbScene3dBuilder preserves negative embedded body standoff', () => {
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
                        layer: 'MECHANICAL1',
                        identifier: 'through_pin_socket',
                        modelId: '{MODEL-PENETRATING}',
                        checksum: 445,
                        embedded: true,
                        name: 'through-pin-socket.step',
                        positionMil: { x: 260, y: 210 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0,
                        overallHeightMil: 180,
                        standoffHeightMil: -70
                    }
                ],
                components: [
                    {
                        designator: 'J9',
                        x: 260,
                        y: 210,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'THROUGH_PIN_SOCKET',
                        source: 'CON/THROUGH_PIN_SOCKET',
                        height: 180
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'J9')
    assert.equal(scene.externalPlacements[0].modelTransform.dzMil, -70)
})

/**
 * Verifies repeated sub-bodies that cannot all claim one component still
 * inherit the side of a nearby footprint-compatible bottom connector.
 */
test('PcbScene3dBuilder resolves unmatched repeated pin bodies from nearby component side', () => {
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
                        x: 560,
                        y: 220,
                        rotation: 180,
                        layer: 'BOTTOM',
                        pattern: 'EMBER_PIN_ROW',
                        source: 'CON/EMBER_PIN_ROW',
                        height: 80
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 3)
    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.mountSide),
        ['bottom', 'bottom', 'bottom']
    )
    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.positionMil.z),
        [-31.5, -31.5, -31.5]
    )
})

/**
 * Verifies unowned in-board body rows with significant negative standoff keep
 * the underside implied by their authored 3D placement, even when a nearby
 * top-side footprint-compatible component can provide a side hint.
 */
test('PcbScene3dBuilder keeps in-board negative standoff repeated bodies on the underside', () => {
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
                    identifier: 'lumen_leg_unit',
                    modelId: '{MODEL-LEG}',
                    checksum: 654,
                    embedded: true,
                    name: 'lumen-leg-unit.step',
                    positionMil: { x: 520, y },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 90 },
                    dzMil: 0,
                    overallHeightMil: 335,
                    standoffHeightMil: -145
                })),
                components: [
                    {
                        designator: 'J1',
                        x: 560,
                        y: 220,
                        rotation: 180,
                        layer: 'TOP',
                        pattern: 'LUMEN_LEG_ROW',
                        source: 'CON/LUMEN_LEG_ROW',
                        height: 80
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 3)
    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.mountSide),
        ['bottom', 'bottom', 'bottom']
    )
    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.positionMil.z),
        [-31.5, -31.5, -31.5]
    )
})

/**
 * Verifies metadata-backed offset external bodies use component yaw while
 * keeping the native body anchor instead of moving onto the component origin.
 */
test('PcbScene3dBuilder promotes component yaw for metadata-backed offset bodies', () => {
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
    assert.equal(scene.externalPlacements[0].rotationDeg, 180)
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
            { x: 20, y: -130, z: -31.5 },
            { x: 20, y: -30, z: -31.5 },
            { x: 20, y: 70, z: -31.5 }
        ]
    )
})

/**
 * Verifies top mechanical-layer models with connector standoffs do not get
 * moved to the underside when no component row can be matched.
 */
test('PcbScene3dBuilder keeps unmatched top mechanical connector bodies on top', () => {
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
                        identifier: 'atlas_edge_socket',
                        modelId: '{MODEL-EDGE}',
                        checksum: 987,
                        embedded: true,
                        name: 'atlas-edge-socket.step',
                        positionMil: { x: -120, y: 250 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 270 },
                        dzMil: -60,
                        overallHeightMil: 70,
                        standoffHeightMil: -105
                    }
                ],
                components: []
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].mountSide, 'top')
    assert.deepEqual(scene.externalPlacements[0].positionMil, {
        x: -620,
        y: 0,
        z: 31.5
    })
})

/**
 * Verifies near body anchors remain authoritative when a generic package body
 * name also loosely matches a farther footprint.
 */
test('PcbScene3dBuilder prefers nearby body anchors over generic package affinity', () => {
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
                        identifier: 'nova_dfn_8_2_body',
                        modelId: '{MODEL-GENERIC}',
                        checksum: 789,
                        embedded: true,
                        name: 'nova_dfn_8_2_body.step',
                        positionMil: { x: 260, y: 200 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        dzMil: 0
                    }
                ],
                components: [
                    {
                        designator: 'U1',
                        x: 272,
                        y: 200,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'CORE_MEMORY',
                        source: 'IC/CORE_MEMORY',
                        height: 40
                    },
                    {
                        designator: 'E1',
                        x: 720,
                        y: 200,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'NOVA_DFN_8_2',
                        source: 'FILTER/NOVA_DFN_8_2',
                        height: 40
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'U1')
    assert.deepEqual(scene.externalPlacements[0].positionMil, {
        x: -240,
        y: -50,
        z: 31.5
    })
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
