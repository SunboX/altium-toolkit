// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

test('PcbScene3dBuilder recovers incomplete cover tops from complete side walls', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'cover-top-recovery-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 3000,
                heightMil: 1000,
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
                    identifier: 'COVER_TOP',
                    modelId: '{00000000-0000-0000-0000-000000000015}',
                    checksum: 115,
                    embedded: false,
                    name: '',
                    positionMil: { x: 1500, y: 500 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    overallHeightMil: 110,
                    standoffHeightMil: 100,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 10,
                        standoffHeightMil: 100
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'COVER_SIDE_A',
                    modelId: '{00000000-0000-0000-0000-000000000016}',
                    checksum: 116,
                    embedded: false,
                    name: '',
                    positionMil: { x: 1200, y: 500 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    overallHeightMil: 100,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 100,
                        standoffHeightMil: 0,
                        verticesMil: [
                            { x: 1200, y: 300 },
                            { x: 1210, y: 300 },
                            { x: 1210, y: 700 },
                            { x: 1200, y: 700 }
                        ]
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'COVER_SIDE_B',
                    modelId: '{00000000-0000-0000-0000-000000000017}',
                    checksum: 117,
                    embedded: false,
                    name: '',
                    positionMil: { x: 1800, y: 500 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.5,
                    overallHeightMil: 100,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 100,
                        standoffHeightMil: 0,
                        verticesMil: [
                            { x: 1790, y: 300 },
                            { x: 1800, y: 300 },
                            { x: 1800, y: 700 },
                            { x: 1790, y: 700 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MECH1',
                    x: 1500,
                    y: 500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'RF_SHIELD_COVER',
                    source: 'MECH/RF_SHIELD_COVER',
                    height: 140
                }
            ]
        }
    })
    const recoveredTop = scene.staticBodyPlacements.find(
        (placement) => placement.designator === 'COVER_TOP'
    )

    assert.ok(recoveredTop)
    assert.deepEqual(recoveredTop.positionMil, { x: 0, y: 0, z: 136.5 })
    assert.equal(recoveredTop.bodyOpacity, 0.5)
    assert.deepEqual(recoveredTop.geometry.verticesMil, [
        { x: -300, y: -200 },
        { x: 300, y: -200 },
        { x: 300, y: 200 },
        { x: -300, y: 200 }
    ])
})

test('PcbScene3dBuilder inherits opacity from matching static body siblings', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'clip-opacity-inheritance-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 600,
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
                    componentIndex: 0,
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'RFI_CLIP_BODY',
                    modelId: '{00000000-0000-0000-0000-000000000018}',
                    checksum: 118,
                    embedded: false,
                    name: '',
                    positionMil: { x: 430, y: 300 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0,
                    overallHeightMil: 50,
                    standoffHeightMil: 10,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 40,
                        standoffHeightMil: 10,
                        verticesMil: [
                            { x: -40, y: -20 },
                            { x: 40, y: -20 },
                            { x: 40, y: 20 },
                            { x: -40, y: 20 }
                        ]
                    }
                },
                {
                    componentIndex: 0,
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'RFI_CLIP_BODY',
                    modelId: '{00000000-0000-0000-0000-000000000019}',
                    checksum: 119,
                    embedded: false,
                    name: '',
                    positionMil: { x: 570, y: 300 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.75,
                    overallHeightMil: 50,
                    standoffHeightMil: 10,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 40,
                        standoffHeightMil: 10,
                        verticesMil: [
                            { x: -40, y: -20 },
                            { x: 40, y: -20 },
                            { x: 40, y: 20 },
                            { x: -40, y: 20 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MX1',
                    x: 500,
                    y: 300,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'RFI_SHIELD_CLIP',
                    source: 'MECH/RFI_SHIELD_CLIP',
                    height: 50
                }
            ]
        }
    })

    assert.deepEqual(
        scene.staticBodyPlacements.map((placement) => placement.bodyOpacity),
        [0.75, 0.75]
    )
})

test('PcbScene3dBuilder keeps source-coordinate shield covers with corner owners inside their bounds', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'bounded-cover-owner-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 4000,
                minY: 4000,
                widthMil: 3000,
                heightMil: 1600,
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
                    identifier: 'CAN_TOP',
                    modelId: '{00000000-0000-0000-0000-000000000020}',
                    checksum: 120,
                    embedded: false,
                    name: '',
                    positionMil: { x: 5600, y: 4900 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.5,
                    overallHeightMil: 110,
                    standoffHeightMil: 100,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 10,
                        standoffHeightMil: 100,
                        verticesMil: [
                            { x: 5000, y: 4300 },
                            { x: 6200, y: 4300 },
                            { x: 6200, y: 5500 },
                            { x: 5000, y: 5500 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MX9',
                    x: 6200,
                    y: 5500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'RF_SHIELD_CLIP',
                    source: 'MECH/RF_SHIELD_CLIP',
                    height: 40
                }
            ]
        }
    })

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.deepEqual(scene.staticBodyPlacements[0].positionMil, {
        x: 100,
        y: 100,
        z: 136.5
    })
    assert.deepEqual(scene.staticBodyPlacements[0].geometry.verticesMil, [
        { x: -600, y: -600 },
        { x: 600, y: -600 },
        { x: 600, y: 600 },
        { x: -600, y: 600 }
    ])
    assert.equal(scene.staticBodyPlacements[0].bodyOpacity, 0.5)
})

test('PcbScene3dBuilder recovers incomplete cover sides from complete source-coordinate cover tops', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'bounded-cover-side-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 4000,
                minY: 4000,
                widthMil: 3000,
                heightMil: 1600,
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
                    identifier: 'CAN_TOP',
                    modelId: '{00000000-0000-0000-0000-000000000021}',
                    checksum: 121,
                    embedded: false,
                    name: '',
                    positionMil: { x: 5600, y: 4900 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.5,
                    overallHeightMil: 110,
                    standoffHeightMil: 100,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 10,
                        standoffHeightMil: 100,
                        verticesMil: [
                            { x: 5000, y: 4300 },
                            { x: 6200, y: 4300 },
                            { x: 6200, y: 5500 },
                            { x: 5000, y: 5500 }
                        ]
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'CAN_SIDE_A',
                    modelId: '{00000000-0000-0000-0000-000000000022}',
                    checksum: 122,
                    embedded: false,
                    name: '',
                    positionMil: { x: 5005, y: 4900 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    overallHeightMil: 100,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 100,
                        standoffHeightMil: 0
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'CAN_SIDE_B',
                    modelId: '{00000000-0000-0000-0000-000000000023}',
                    checksum: 123,
                    embedded: false,
                    name: '',
                    positionMil: { x: 6195, y: 4900 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    overallHeightMil: 100,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 100,
                        standoffHeightMil: 0
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'CAN_SIDE_C',
                    modelId: '{00000000-0000-0000-0000-000000000024}',
                    checksum: 124,
                    embedded: false,
                    name: '',
                    positionMil: { x: 5600, y: 4305 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    overallHeightMil: 100,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 100,
                        standoffHeightMil: 0
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'CAN_SIDE_D',
                    modelId: '{00000000-0000-0000-0000-000000000025}',
                    checksum: 125,
                    embedded: false,
                    name: '',
                    positionMil: { x: 5600, y: 5495 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    overallHeightMil: 100,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 100,
                        standoffHeightMil: 0
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MX1',
                    x: 5000,
                    y: 4300,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'RF_SHIELD_CLIP',
                    source: 'MECH/RF_SHIELD_CLIP',
                    height: 40
                },
                {
                    componentIndex: 1,
                    designator: 'MX2',
                    x: 6200,
                    y: 4300,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'RF_SHIELD_CLIP',
                    source: 'MECH/RF_SHIELD_CLIP',
                    height: 40
                },
                {
                    componentIndex: 2,
                    designator: 'MX3',
                    x: 5000,
                    y: 5500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'RF_SHIELD_CLIP',
                    source: 'MECH/RF_SHIELD_CLIP',
                    height: 40
                },
                {
                    componentIndex: 3,
                    designator: 'MX4',
                    x: 6200,
                    y: 5500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'RF_SHIELD_CLIP',
                    source: 'MECH/RF_SHIELD_CLIP',
                    height: 40
                }
            ]
        }
    })
    const sidePlacements = scene.staticBodyPlacements.filter((placement) =>
        placement.designator.startsWith('CAN_SIDE_')
    )

    assert.equal(sidePlacements.length, 4)
    assert.deepEqual(
        sidePlacements.map((placement) => placement.positionMil),
        [
            { x: -495, y: 100, z: 81.5 },
            { x: 695, y: 100, z: 81.5 },
            { x: 100, y: -495, z: 81.5 },
            { x: 100, y: 695, z: 81.5 }
        ]
    )
    assert.deepEqual(
        sidePlacements.map((placement) => placement.geometry.verticesMil),
        [
            [
                { x: -5, y: -600 },
                { x: 5, y: -600 },
                { x: 5, y: 600 },
                { x: -5, y: 600 }
            ],
            [
                { x: -5, y: -600 },
                { x: 5, y: -600 },
                { x: 5, y: 600 },
                { x: -5, y: 600 }
            ],
            [
                { x: -600, y: -5 },
                { x: 600, y: -5 },
                { x: 600, y: 5 },
                { x: -600, y: 5 }
            ],
            [
                { x: -600, y: -5 },
                { x: 600, y: -5 },
                { x: 600, y: 5 },
                { x: -600, y: 5 }
            ]
        ]
    )
})
