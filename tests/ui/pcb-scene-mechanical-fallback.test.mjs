// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a compact fake board for mechanical fallback tests.
 * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: object[] }}
 */
function buildBoardOutline() {
    return {
        minX: 0,
        minY: 0,
        widthMil: 1200,
        heightMil: 900,
        segments: []
    }
}

/**
 * Builds one fake static frame body row.
 * @param {string} identifier Fake row identifier.
 * @param {{ x: number, y: number }} positionMil Body source position.
 * @param {object} staticGeometry Static geometry metadata.
 * @returns {object}
 */
function buildStaticFrameBody(identifier, positionMil, staticGeometry) {
    return {
        componentIndex: 0,
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        layer: staticGeometry.status === 'complete' ? 'MECHANICAL13' : '',
        identifier,
        modelId: `{00000000-0000-0000-0000-${identifier === 'Frame' ? '000000000031' : '000000000032'}}`,
        checksum: identifier === 'Frame' ? 131 : 132,
        embedded: false,
        name: '',
        positionMil,
        rotationDeg: 0,
        modelTypeName: 'extruded-polygon',
        bodyOpacity: 0.6,
        overallHeightMil:
            Number(staticGeometry.standoffHeightMil || 0) +
            Number(staticGeometry.heightMil || 0),
        standoffHeightMil: staticGeometry.standoffHeightMil,
        staticGeometry
    }
}

/**
 * Resolves axis-aligned bounds for placement vertices.
 * @param {{ x: number, y: number }[]} vertices Vertices.
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
function vertexBounds(vertices) {
    const xs = vertices.map((vertex) => vertex.x)
    const ys = vertices.map((vertex) => vertex.y)

    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
    }
}

test('PcbScene3dBuilder suppresses generic fallback boxes for authored shield frames', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'mechanical-frame-fake.PcbDoc',
        pcb: {
            boardOutline: buildBoardOutline(),
            pads: [
                {
                    componentIndex: 0,
                    x: 275,
                    y: 125,
                    sizeTopX: 60,
                    sizeTopY: 60
                },
                {
                    componentIndex: 0,
                    x: 925,
                    y: 775,
                    sizeTopX: 60,
                    sizeTopY: 60
                }
            ],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'FRAME_RAIL',
                    modelId: '{00000000-0000-0000-0000-000000000030}',
                    checksum: 130,
                    embedded: false,
                    name: '',
                    positionMil: { x: 600, y: 450 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.65,
                    overallHeightMil: 120,
                    standoffHeightMil: 20,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 100,
                        standoffHeightMil: 20,
                        verticesMil: [
                            { x: 275, y: 125 },
                            { x: 925, y: 125 },
                            { x: 925, y: 175 },
                            { x: 275, y: 175 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MX1',
                    x: 600,
                    y: 450,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'GENERIC_RF_SHIELD_FRAME',
                    source: 'MECH/RF_SHIELD_FRAME',
                    height: null
                }
            ]
        }
    })
    const frameComponent = scene.components.find(
        (component) => component.designator === 'MX1'
    )

    assert.equal(frameComponent.renderFallbackBody, false)
    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(scene.staticBodyPlacements[0].bodyOpacity, 0.65)
})

test('PcbScene3dBuilder assigns static shield-frame pieces to the mechanical owner', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'static-frame-owner-fake.PcbDoc',
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
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'Frame2',
                    embedded: false,
                    positionMil: { x: 430, y: 450 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.6,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 4,
                        standoffHeightMil: 120,
                        verticesMil: [
                            { x: 360, y: 350 },
                            { x: 500, y: 350 },
                            { x: 500, y: 380 },
                            { x: 360, y: 380 }
                        ]
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'Leg',
                    embedded: false,
                    positionMil: { x: 710, y: 450 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.6,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 20,
                        standoffHeightMil: 0,
                        verticesMil: [
                            { x: 700, y: 420 },
                            { x: 720, y: 420 },
                            { x: 720, y: 480 },
                            { x: 700, y: 480 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MX2',
                    x: 600,
                    y: 450,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'GENERIC_RF_SHIELD_FRAME',
                    source: 'MECH/RF_SHIELD_FRAME',
                    height: null
                }
            ]
        }
    })
    const ownedPlacements = scene.staticBodyPlacements.filter(
        (placement) => placement.designator === 'MX2'
    )

    assert.equal(ownedPlacements.length, 2)
    assert.equal(
        scene.staticBodyPlacements.some((placement) =>
            ['Frame2', 'Leg'].includes(placement.designator)
        ),
        false
    )
    assert.deepEqual(
        ownedPlacements.map((placement) => placement.bodyOpacity),
        [0.6, 0.6]
    )
})

test('PcbScene3dBuilder mirrors source-coordinate shield-frame pieces around their owner', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'mirrored-static-frame-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 4000,
                heightMil: 2000,
                segments: []
            },
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'Frame',
                    embedded: false,
                    positionMil: { x: 2600, y: 700 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.65,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 100,
                        standoffHeightMil: 20,
                        verticesMil: [
                            { x: 2300, y: 1290 },
                            { x: 2900, y: 1290 },
                            { x: 2900, y: 1310 },
                            { x: 2300, y: 1310 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MX3',
                    x: 2600,
                    y: 1000,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'GENERIC_RF_SHIELD_FRAME',
                    source: 'MECH/RF_SHIELD_FRAME',
                    height: null
                }
            ]
        }
    })
    const framePlacement = scene.staticBodyPlacements.find(
        (placement) => placement.designator === 'MX3'
    )
    const yValues = framePlacement.geometry.verticesMil.map(
        (vertex) => vertex.y
    )

    assert.equal(framePlacement.positionMil.y, -300)
    assert.deepEqual([Math.min(...yValues), Math.max(...yValues)], [-10, 10])
})

test('PcbScene3dBuilder recovers symmetric shield-frame static rows', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'symmetric-static-frame-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 3000,
                heightMil: 2000,
                segments: []
            },
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                buildStaticFrameBody(
                    'Frame',
                    { x: 1500, y: 700 },
                    {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 120,
                        standoffHeightMil: 20,
                        verticesMil: [
                            { x: 1200, y: 1290 },
                            { x: 1800, y: 1290 },
                            { x: 1800, y: 1310 },
                            { x: 1200, y: 1310 }
                        ]
                    }
                ),
                buildStaticFrameBody(
                    'Frame',
                    { x: 1500, y: 1300 },
                    {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 120,
                        standoffHeightMil: 20
                    }
                ),
                buildStaticFrameBody(
                    'Frame',
                    { x: 1200, y: 1000 },
                    {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 120,
                        standoffHeightMil: 20
                    }
                ),
                buildStaticFrameBody(
                    'Frame',
                    { x: 1800, y: 1000 },
                    {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 120,
                        standoffHeightMil: 20
                    }
                ),
                buildStaticFrameBody(
                    'Frame2',
                    { x: 1200, y: 1000 },
                    {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 4,
                        standoffHeightMil: 140,
                        verticesMil: [
                            { x: 1190, y: 700 },
                            { x: 1210, y: 700 },
                            { x: 1210, y: 1300 },
                            { x: 1190, y: 1300 }
                        ]
                    }
                ),
                buildStaticFrameBody(
                    'Frame2',
                    { x: 1800, y: 1000 },
                    {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 4,
                        standoffHeightMil: 140
                    }
                )
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MX4',
                    x: 1500,
                    y: 1000,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'GENERIC_RF_SHIELD_FRAME',
                    source: 'MECH/RF_SHIELD_FRAME',
                    height: null
                }
            ]
        }
    })
    const framePlacements = scene.staticBodyPlacements.filter(
        (placement) => placement.designator === 'MX4'
    )
    const wallPlacements = framePlacements.filter(
        (placement) => placement.geometry.heightMil === 120
    )
    const lipPlacements = framePlacements.filter(
        (placement) => placement.geometry.heightMil === 4
    )

    assert.deepEqual(
        wallPlacements.map((placement) => placement.positionMil),
        [
            { x: 0, y: -300, z: 111.5 },
            { x: 0, y: 300, z: 111.5 },
            { x: -300, y: 0, z: 111.5 },
            { x: 300, y: 0, z: 111.5 }
        ]
    )
    assert.deepEqual(
        wallPlacements.map((placement) =>
            vertexBounds(placement.geometry.verticesMil)
        ),
        [
            { minX: -300, maxX: 300, minY: -10, maxY: 10 },
            { minX: -300, maxX: 300, minY: -10, maxY: 10 },
            { minX: -10, maxX: 10, minY: -310, maxY: 310 },
            { minX: -10, maxX: 10, minY: -310, maxY: 310 }
        ]
    )
    assert.deepEqual(
        lipPlacements.map((placement) => placement.positionMil),
        [
            { x: -300, y: 0, z: 173.5 },
            { x: 300, y: 0, z: 173.5 }
        ]
    )
    assert.deepEqual(
        lipPlacements.map((placement) =>
            vertexBounds(placement.geometry.verticesMil)
        ),
        [
            { minX: -10, maxX: 10, minY: -300, maxY: 300 },
            { minX: -10, maxX: 10, minY: -300, maxY: 300 }
        ]
    )
})
