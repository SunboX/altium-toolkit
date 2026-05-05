// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Verifies the scene builder produces board metadata and procedural package
 * bodies from the normalized PCB model.
 */
test('PcbScene3dBuilder builds board and procedural package scene data', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: {
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
            },
            pads: [
                { x: 180, y: 120, sizeTopX: 30, sizeTopY: 70, holeDiameter: 0 },
                { x: 260, y: 120, sizeTopX: 30, sizeTopY: 70, holeDiameter: 0 },
                { x: 520, y: 180, sizeTopX: 18, sizeTopY: 36, holeDiameter: 0 },
                { x: 610, y: 220, sizeTopX: 18, sizeTopY: 36, holeDiameter: 0 },
                { x: 660, y: 220, sizeTopX: 18, sizeTopY: 36, holeDiameter: 0 }
            ],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            components: [
                {
                    designator: 'R1',
                    x: 220,
                    y: 120,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: '0603',
                    height: null
                },
                {
                    designator: 'Q1',
                    x: 635,
                    y: 220,
                    rotation: 90,
                    layer: 'BOTTOM',
                    pattern: 'SOT-23',
                    height: null
                },
                {
                    designator: 'C9',
                    x: 420,
                    y: 280,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'C3.0A',
                    height: 240
                },
                {
                    designator: 'X1',
                    x: 220,
                    y: 120,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'MYSTERY_PART',
                    height: null
                }
            ]
        }
    })

    assert.equal(scene.board.widthMil, 1000)
    assert.equal(scene.board.heightMil, 500)
    assert.equal(scene.board.thicknessMil, 63)
    assert.equal(scene.components.length, 4)

    const resistor = scene.components.find(
        (component) => component.designator === 'R1'
    )
    const transistor = scene.components.find(
        (component) => component.designator === 'Q1'
    )
    const capacitor = scene.components.find(
        (component) => component.designator === 'C9'
    )
    const generic = scene.components.find(
        (component) => component.designator === 'X1'
    )

    assert.equal(resistor?.body.family, 'chip')
    assert.equal(resistor?.positionMil.x, -280)
    assert.equal(resistor?.positionMil.y, -130)
    assert.equal(transistor?.mountSide, 'bottom')
    assert.equal(transistor?.body.family, 'sot')
    assert.equal(transistor?.positionMil.x, 135)
    assert.equal(transistor?.positionMil.y, -30)
    assert.equal(capacitor?.body.family, 'radial-capacitor')
    assert.equal(capacitor?.body.sizeMil.height, 240)
    assert.equal(generic?.body.family, 'generic')
    assert.ok((generic?.body.sizeMil.width || 0) >= 110)
})

/**
 * Verifies embedded component-body placements become explicit external-model
 * scene entries with board-centered coordinates and authored transforms.
 */
test('PcbScene3dBuilder emits embedded external placements from normalized body records', () => {
    const embeddedModels = [
        {
            id: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
            checksum: 3467130030,
            name: 'SOT-23_Y.stp',
            format: 'step',
            payloadText: 'ISO-10303-21;',
            sourceStream: 'Models/0',
            transform: {
                rotationDeg: { x: 0, y: 0, z: 270 },
                dzMil: 11.811
            }
        }
    ]

    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: {
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
                },
                pads: [
                    {
                        x: 210,
                        y: 200,
                        sizeTopX: 30,
                        sizeTopY: 70,
                        holeDiameter: 0
                    },
                    {
                        x: 290,
                        y: 200,
                        sizeTopX: 30,
                        sizeTopY: 70,
                        holeDiameter: 0
                    }
                ],
                tracks: [],
                arcs: [],
                fills: [],
                vias: [],
                polygons: [],
                embeddedModels,
                componentBodies: [
                    {
                        sourceStream: 'ComponentBodies6/Data',
                        layer: 'MECHANICAL1',
                        identifier: 'SOT-23_Y',
                        modelId: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
                        checksum: 3467130030,
                        embedded: true,
                        name: 'SOT-23_Y.stp',
                        positionMil: { x: 250, y: 200 },
                        rotationDeg: 315,
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        dzMil: 11.811,
                        overallHeightMil: 39.3701,
                        standoffHeightMil: -0.0684
                    }
                ],
                components: [
                    {
                        designator: 'Q1',
                        x: 250,
                        y: 200,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'SOT-23',
                        height: 40
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
                    return {
                        origin: 'embedded',
                        name: componentBody.name,
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/0'
                    }
                }
            }
        }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.deepEqual(scene.externalPlacements[0], {
        designator: 'Q1',
        mountSide: 'top',
        rotationDeg: 315,
        positionMil: {
            x: -250,
            y: -50,
            z: 31.5
        },
        bodyPositionMil: {
            x: 250,
            y: 200
        },
        bodyRotationDeg: 315,
        modelTransform: {
            rotationDeg: { x: 0, y: 0, z: 90 },
            dzMil: 11.811
        },
        externalModel: {
            origin: 'embedded',
            name: 'SOT-23_Y.stp',
            format: 'step',
            payloadText: 'ISO-10303-21;',
            sourceStream: 'Models/0'
        }
    })
})

/**
 * Verifies explicit external placements inherit the matched component
 * rotation in addition to any authored 2D body rotation offset.
 */
test('PcbScene3dBuilder combines matched component rotation with body rotation', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: {
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
                },
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
                        identifier: 'CONN_BODY',
                        modelId: '{MODEL-1}',
                        checksum: 123,
                        embedded: true,
                        name: 'connector.step',
                        positionMil: { x: 250, y: 200 },
                        rotationDeg: 45,
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 12
                    }
                ],
                components: [
                    {
                        designator: 'J1',
                        x: 250,
                        y: 200,
                        rotation: 180,
                        layer: 'TOP',
                        pattern: 'CONN',
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
                resolveComponentBodyModel() {
                    return {
                        origin: 'embedded',
                        name: 'connector.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/0'
                    }
                }
            }
        }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'J1')
    assert.equal(scene.externalPlacements[0].rotationDeg, 225)
})

/**
 * Verifies matched explicit placements use the component anchor position even
 * when the body metadata position is slightly offset.
 */
test('PcbScene3dBuilder prefers the matched component position for explicit placements', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: {
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
                },
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
                        identifier: 'SHIFTED',
                        modelId: '{MODEL-1}',
                        checksum: 123,
                        embedded: true,
                        name: 'shifted.step',
                        positionMil: { x: 210, y: 240 },
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
                        rotation: 180,
                        layer: 'TOP',
                        pattern: 'SHIFTED',
                        source: 'CON/SHIFTED',
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
                resolveComponentBodyModel() {
                    return {
                        origin: 'embedded',
                        name: 'shifted.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/0'
                    }
                }
            }
        }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.deepEqual(scene.externalPlacements[0].positionMil, {
        x: -250,
        y: -50,
        z: 31.5
    })
})

/**
 * Verifies unresolved repeated body placements can still bind to the matching
 * repeated component footprint family by ordered affinity.
 */
test('PcbScene3dBuilder binds unresolved repeated bodies to repeated matching components', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 1000,
                    heightMil: 2000,
                    segments: [
                        { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                        { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 2000 },
                        { type: 'line', x1: 1000, y1: 2000, x2: 0, y2: 2000 },
                        { type: 'line', x1: 0, y1: 2000, x2: 0, y2: 0 }
                    ]
                },
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
                        identifier: 'ck_636_6p',
                        modelId: '{MODEL-1}',
                        checksum: 123,
                        embedded: true,
                        name: 'ck_636_6p.stp',
                        positionMil: { x: 50, y: 1100 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        dzMil: 0
                    },
                    {
                        sourceStream: 'ComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'ck_636_6p',
                        modelId: '{MODEL-1}',
                        checksum: 123,
                        embedded: true,
                        name: 'ck_636_6p.stp',
                        positionMil: { x: 50, y: 1400 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        dzMil: 0
                    },
                    {
                        sourceStream: 'ComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'ck_636_6p',
                        modelId: '{MODEL-1}',
                        checksum: 123,
                        embedded: true,
                        name: 'ck_636_6p.stp',
                        positionMil: { x: 50, y: 1700 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        dzMil: 0
                    }
                ],
                components: [
                    {
                        designator: 'J1',
                        x: 450,
                        y: 100,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: 'CK-6.35-636-6P',
                        source: 'CON/6.35/CK-6.35-636-6P',
                        height: null
                    },
                    {
                        designator: 'J2',
                        x: 450,
                        y: 400,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: 'CK-6.35-636-6P',
                        source: 'CON/6.35/CK-6.35-636-6P',
                        height: null
                    },
                    {
                        designator: 'J3',
                        x: 450,
                        y: 700,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: 'CK-6.35-636-6P',
                        source: 'CON/6.35/CK-6.35-636-6P',
                        height: null
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
                    return {
                        origin: 'embedded',
                        name: componentBody.name,
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/0'
                    }
                }
            }
        }
    )

    assert.equal(scene.externalPlacements.length, 3)
    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.designator),
        ['J1', 'J2', 'J3']
    )
    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.positionMil),
        [
            { x: -50, y: -900, z: -31.5 },
            { x: -50, y: -600, z: -31.5 },
            { x: -50, y: -300, z: -31.5 }
        ]
    )
})

/**
 * Verifies the scene builder carries top and bottom silkscreen primitives into
 * the 3D scene detail model.
 */
test('PcbScene3dBuilder includes top and bottom silkscreen detail', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 600,
                heightMil: 400,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 600, y2: 0 },
                    { type: 'line', x1: 600, y1: 0, x2: 600, y2: 400 },
                    { type: 'line', x1: 600, y1: 400, x2: 0, y2: 400 },
                    { type: 'line', x1: 0, y1: 400, x2: 0, y2: 0 }
                ]
            },
            primitiveLayers: [
                { layerId: 33, name: 'Top Overlay' },
                { layerId: 34, name: 'Bottom Overlay' }
            ],
            pads: [],
            tracks: [
                { x1: 10, y1: 20, x2: 70, y2: 20, width: 6, layerId: 33 },
                { x1: 15, y1: 350, x2: 75, y2: 350, width: 6, layerId: 34 }
            ],
            arcs: [
                {
                    x: 200,
                    y: 80,
                    radius: 15,
                    startAngle: 0,
                    endAngle: 180,
                    width: 4,
                    layerId: 33
                }
            ],
            fills: [{ x1: 250, y1: 90, x2: 280, y2: 110, layerId: 34 }],
            vias: [],
            polygons: [],
            components: []
        }
    })

    assert.deepEqual(scene.detail.silkscreen.top.tracks, [
        { x1: 10, y1: 20, x2: 70, y2: 20, width: 6, layerId: 33 }
    ])
    assert.deepEqual(scene.detail.silkscreen.top.arcs, [
        {
            x: 200,
            y: 80,
            radius: 15,
            startAngle: 0,
            endAngle: 180,
            width: 4,
            layerId: 33
        }
    ])
    assert.deepEqual(scene.detail.silkscreen.bottom.fills, [
        { x1: 250, y1: 90, x2: 280, y2: 110, layerId: 34 }
    ])
    assert.deepEqual(scene.detail.silkscreen.bottom.tracks, [
        { x1: 15, y1: 350, x2: 75, y2: 350, width: 6, layerId: 34 }
    ])
})

test('PcbScene3dBuilder keeps authored screw shafts while correcting tip-facing heads', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 1000 },
                    { type: 'line', x1: 1000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            pads: [],
            tracks: [
                { x1: 100, y1: 180, x2: 180, y2: 180, width: 8, layerId: 33 },
                { x1: 100, y1: 220, x2: 180, y2: 220, width: 8, layerId: 33 },
                { x1: 100, y1: 180, x2: 100, y2: 220, width: 8, layerId: 33 },
                { x1: 110, y1: 182, x2: 120, y2: 218, width: 8, layerId: 33 },
                { x1: 130, y1: 182, x2: 140, y2: 218, width: 8, layerId: 33 },
                { x1: 150, y1: 182, x2: 160, y2: 218, width: 8, layerId: 33 },
                { x1: 180, y1: 200, x2: 220, y2: 175, width: 8, layerId: 33 },
                { x1: 180, y1: 200, x2: 220, y2: 225, width: 8, layerId: 33 },
                { x1: 100, y1: 380, x2: 180, y2: 380, width: 8, layerId: 33 },
                { x1: 100, y1: 420, x2: 180, y2: 420, width: 8, layerId: 33 },
                { x1: 180, y1: 380, x2: 180, y2: 420, width: 8, layerId: 33 },
                { x1: 120, y1: 382, x2: 130, y2: 418, width: 8, layerId: 33 },
                { x1: 140, y1: 382, x2: 150, y2: 418, width: 8, layerId: 33 },
                { x1: 160, y1: 382, x2: 170, y2: 418, width: 8, layerId: 33 },
                { x1: 60, y1: 375, x2: 100, y2: 400, width: 8, layerId: 33 },
                { x1: 60, y1: 425, x2: 100, y2: 400, width: 8, layerId: 33 }
            ],
            arcs: [
                {
                    x: 180,
                    y: 200,
                    radius: 28,
                    startAngle: 90,
                    endAngle: 270,
                    width: 8,
                    layerId: 33
                },
                {
                    x: 40,
                    y: 200,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerId: 33
                },
                {
                    x: 100,
                    y: 400,
                    radius: 28,
                    startAngle: 270,
                    endAngle: 90,
                    width: 8,
                    layerId: 33
                },
                {
                    x: 260,
                    y: 400,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerId: 33
                }
            ],
            fills: [],
            vias: [],
            polygons: [],
            components: []
        }
    })

    assert.deepEqual(scene.detail.silkscreen.top.tracks, [
        { x1: 100, y1: 180, x2: 180, y2: 180, width: 8, layerId: 33 },
        { x1: 100, y1: 220, x2: 180, y2: 220, width: 8, layerId: 33 },
        { x1: 100, y1: 180, x2: 100, y2: 220, width: 8, layerId: 33 },
        { x1: 110, y1: 182, x2: 120, y2: 218, width: 8, layerId: 33 },
        { x1: 130, y1: 182, x2: 140, y2: 218, width: 8, layerId: 33 },
        { x1: 150, y1: 182, x2: 160, y2: 218, width: 8, layerId: 33 },
        { x1: 180, y1: 200, x2: 220, y2: 175, width: 8, layerId: 33 },
        { x1: 180, y1: 200, x2: 220, y2: 225, width: 8, layerId: 33 },
        { x1: 100, y1: 380, x2: 180, y2: 380, width: 8, layerId: 33 },
        { x1: 100, y1: 420, x2: 180, y2: 420, width: 8, layerId: 33 },
        { x1: 180, y1: 380, x2: 180, y2: 420, width: 8, layerId: 33 },
        { x1: 120, y1: 382, x2: 130, y2: 418, width: 8, layerId: 33 },
        { x1: 140, y1: 382, x2: 150, y2: 418, width: 8, layerId: 33 },
        { x1: 160, y1: 382, x2: 170, y2: 418, width: 8, layerId: 33 },
        { x1: 60, y1: 375, x2: 100, y2: 400, width: 8, layerId: 33 },
        { x1: 60, y1: 425, x2: 100, y2: 400, width: 8, layerId: 33 }
    ])
    assert.deepEqual(scene.detail.silkscreen.top.arcs, [
        {
            x: 180,
            y: 200,
            radius: 28,
            startAngle: 90,
            endAngle: -90,
            width: 8,
            layerId: 33
        },
        {
            x: 40,
            y: 200,
            radius: 30,
            startAngle: 0,
            endAngle: 0,
            width: 8,
            layerId: 33
        },
        {
            x: 100,
            y: 400,
            radius: 28,
            startAngle: 270,
            endAngle: 90,
            width: 8,
            layerId: 33
        },
        {
            x: 260,
            y: 400,
            radius: 30,
            startAngle: 0,
            endAngle: 0,
            width: 8,
            layerId: 33
        }
    ])
})

test('PcbScene3dBuilder flips corner-adjacent right-pointing screw heads tip-facing', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 1000 },
                    { type: 'line', x1: 1000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            pads: [],
            tracks: [
                { x1: 100, y1: 900, x2: 180, y2: 900, width: 8, layerId: 33 },
                { x1: 100, y1: 940, x2: 180, y2: 940, width: 8, layerId: 33 },
                { x1: 100, y1: 900, x2: 100, y2: 940, width: 8, layerId: 33 },
                { x1: 110, y1: 902, x2: 120, y2: 938, width: 8, layerId: 33 },
                { x1: 130, y1: 902, x2: 140, y2: 938, width: 8, layerId: 33 },
                { x1: 150, y1: 902, x2: 160, y2: 938, width: 8, layerId: 33 },
                { x1: 180, y1: 920, x2: 220, y2: 895, width: 8, layerId: 33 },
                { x1: 180, y1: 920, x2: 220, y2: 945, width: 8, layerId: 33 }
            ],
            arcs: [
                {
                    x: 180,
                    y: 920,
                    radius: 28,
                    startAngle: 90,
                    endAngle: 270,
                    width: 8,
                    layerId: 33
                }
            ],
            fills: [],
            vias: [],
            polygons: [],
            components: []
        }
    })

    assert.deepEqual(scene.detail.silkscreen.top.tracks, [
        { x1: 100, y1: 900, x2: 180, y2: 900, width: 8, layerId: 33 },
        { x1: 100, y1: 940, x2: 180, y2: 940, width: 8, layerId: 33 },
        { x1: 100, y1: 900, x2: 100, y2: 940, width: 8, layerId: 33 },
        { x1: 110, y1: 902, x2: 120, y2: 938, width: 8, layerId: 33 },
        { x1: 130, y1: 902, x2: 140, y2: 938, width: 8, layerId: 33 },
        { x1: 150, y1: 902, x2: 160, y2: 938, width: 8, layerId: 33 },
        { x1: 180, y1: 920, x2: 220, y2: 895, width: 8, layerId: 33 },
        { x1: 180, y1: 920, x2: 220, y2: 945, width: 8, layerId: 33 }
    ])
    assert.deepEqual(scene.detail.silkscreen.top.arcs, [
        {
            x: 180,
            y: 920,
            radius: 28,
            startAngle: 90,
            endAngle: -90,
            width: 8,
            layerId: 33
        }
    ])
})

test('PcbScene3dBuilder keeps downward-pointing screw heads tip-facing without rotating the shaft', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: {
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
            },
            primitiveLayers: [{ layerId: 34, name: 'Bottom Overlay' }],
            pads: [],
            tracks: [
                { x1: 780, y1: 100, x2: 820, y2: 100, width: 8, layerId: 34 },
                { x1: 780, y1: 120, x2: 820, y2: 120, width: 8, layerId: 34 },
                { x1: 780, y1: 100, x2: 780, y2: 120, width: 8, layerId: 34 },
                { x1: 782, y1: 90, x2: 818, y2: 80, width: 8, layerId: 34 },
                { x1: 782, y1: 110, x2: 818, y2: 100, width: 8, layerId: 34 },
                { x1: 782, y1: 130, x2: 818, y2: 120, width: 8, layerId: 34 },
                { x1: 800, y1: 120, x2: 775, y2: 160, width: 8, layerId: 34 },
                { x1: 800, y1: 120, x2: 825, y2: 160, width: 8, layerId: 34 }
            ],
            arcs: [
                {
                    x: 800,
                    y: 120,
                    radius: 28,
                    startAngle: 180,
                    endAngle: 0,
                    width: 8,
                    layerId: 34
                },
                {
                    x: 720,
                    y: 120,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerId: 34
                }
            ],
            fills: [],
            vias: [],
            polygons: [],
            components: []
        }
    })

    assert.deepEqual(scene.detail.silkscreen.bottom.tracks, [
        { x1: 780, y1: 100, x2: 820, y2: 100, width: 8, layerId: 34 },
        { x1: 780, y1: 120, x2: 820, y2: 120, width: 8, layerId: 34 },
        { x1: 780, y1: 100, x2: 780, y2: 120, width: 8, layerId: 34 },
        { x1: 782, y1: 90, x2: 818, y2: 80, width: 8, layerId: 34 },
        { x1: 782, y1: 110, x2: 818, y2: 100, width: 8, layerId: 34 },
        { x1: 782, y1: 130, x2: 818, y2: 120, width: 8, layerId: 34 },
        { x1: 800, y1: 120, x2: 775, y2: 160, width: 8, layerId: 34 },
        { x1: 800, y1: 120, x2: 825, y2: 160, width: 8, layerId: 34 }
    ])
    assert.deepEqual(scene.detail.silkscreen.bottom.arcs, [
        {
            x: 800,
            y: 120,
            radius: 28,
            startAngle: 180,
            endAngle: 0,
            width: 8,
            layerId: 34
        },
        {
            x: 720,
            y: 120,
            radius: 30,
            startAngle: 0,
            endAngle: 0,
            width: 8,
            layerId: 34
        }
    ])
})

test('PcbScene3dBuilder flips right-pointing screw heads onto the tip-facing half', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: {
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
            },
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            pads: [],
            tracks: [
                { x1: 100, y1: 180, x2: 180, y2: 180, width: 8, layerId: 33 },
                { x1: 100, y1: 220, x2: 180, y2: 220, width: 8, layerId: 33 },
                { x1: 180, y1: 180, x2: 180, y2: 220, width: 8, layerId: 33 },
                { x1: 120, y1: 182, x2: 130, y2: 218, width: 8, layerId: 33 },
                { x1: 140, y1: 182, x2: 150, y2: 218, width: 8, layerId: 33 },
                { x1: 160, y1: 182, x2: 170, y2: 218, width: 8, layerId: 33 },
                { x1: 180, y1: 200, x2: 220, y2: 175, width: 8, layerId: 33 },
                { x1: 180, y1: 200, x2: 220, y2: 225, width: 8, layerId: 33 }
            ],
            arcs: [
                {
                    x: 180,
                    y: 200,
                    radius: 28,
                    startAngle: 90,
                    endAngle: 270,
                    width: 8,
                    layerId: 33
                }
            ],
            fills: [],
            vias: [],
            polygons: [],
            components: []
        }
    })

    assert.deepEqual(scene.detail.silkscreen.top.tracks, [
        { x1: 100, y1: 180, x2: 180, y2: 180, width: 8, layerId: 33 },
        { x1: 100, y1: 220, x2: 180, y2: 220, width: 8, layerId: 33 },
        { x1: 180, y1: 180, x2: 180, y2: 220, width: 8, layerId: 33 },
        { x1: 120, y1: 182, x2: 130, y2: 218, width: 8, layerId: 33 },
        { x1: 140, y1: 182, x2: 150, y2: 218, width: 8, layerId: 33 },
        { x1: 160, y1: 182, x2: 170, y2: 218, width: 8, layerId: 33 },
        { x1: 180, y1: 200, x2: 220, y2: 175, width: 8, layerId: 33 },
        { x1: 180, y1: 200, x2: 220, y2: 225, width: 8, layerId: 33 }
    ])
    assert.deepEqual(scene.detail.silkscreen.top.arcs, [
        {
            x: 180,
            y: 200,
            radius: 28,
            startAngle: 90,
            endAngle: -90,
            width: 8,
            layerId: 33
        }
    ])
})
