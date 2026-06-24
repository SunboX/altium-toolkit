// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

test('PcbScene3dBuilder skips incomplete projected component bodies', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            pads: [
                {
                    componentIndex: 0,
                    x: 180,
                    y: 230,
                    sizeTopX: 30,
                    sizeTopY: 80,
                    holeDiameter: 0
                },
                {
                    componentIndex: 0,
                    x: 320,
                    y: 230,
                    sizeTopX: 30,
                    sizeTopY: 80,
                    holeDiameter: 0
                }
            ],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                {
                    sourceStream: 'ComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'PROJECTED_BODY',
                    modelId: '{00000000-0000-0000-0000-000000000001}',
                    checksum: 101,
                    embedded: false,
                    name: '',
                    positionMil: { x: 250, y: 230 },
                    rotationDeg: 0,
                    modelType: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyColor: {
                        raw: 0x808080,
                        hex: '#808080',
                        rgb: { red: 128, green: 128, blue: 128 }
                    },
                    bodyOpacity: 0.75,
                    overallHeightMil: 64,
                    standoffHeightMil: 4,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 64,
                        standoffHeightMil: 4
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'U1',
                    x: 250,
                    y: 230,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'MODULE_A',
                    height: null
                }
            ]
        }
    })

    assert.equal(scene.staticBodyPlacements.length, 0)
})

test('PcbScene3dBuilder suppresses unowned translucent static bodies', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'translucent-static-body-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2000,
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
                    identifier: 'AUX_BODY_A',
                    modelId: '{00000000-0000-0000-0000-000000000011}',
                    checksum: 111,
                    embedded: false,
                    name: '',
                    positionMil: { x: 1000, y: 500 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyColor: {
                        raw: 0xf0f0f0,
                        hex: '#f0f0f0',
                        rgb: { red: 240, green: 240, blue: 240 }
                    },
                    bodyOpacity: 0.75,
                    overallHeightMil: 124,
                    standoffHeightMil: 120,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 4,
                        standoffHeightMil: 120,
                        verticesMil: [
                            { x: -300, y: -100 },
                            { x: 300, y: -100 },
                            { x: 300, y: 100 },
                            { x: -300, y: 100 }
                        ]
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'PKG_BODY_A',
                    modelId: '{00000000-0000-0000-0000-000000000012}',
                    checksum: 112,
                    embedded: false,
                    name: '',
                    positionMil: { x: 300, y: 300 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyColor: {
                        raw: 0xdddddd,
                        hex: '#dddddd',
                        rgb: { red: 221, green: 221, blue: 221 }
                    },
                    bodyOpacity: 0.75,
                    overallHeightMil: 40,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 40,
                        standoffHeightMil: 0,
                        verticesMil: [
                            { x: -40, y: -30 },
                            { x: 40, y: -30 },
                            { x: 40, y: 30 },
                            { x: -40, y: 30 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'U1',
                    x: 300,
                    y: 300,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'PKG_BODY_A',
                    source: 'PKG_BODY_A',
                    height: 40
                }
            ]
        }
    })

    assert.deepEqual(
        scene.staticBodyPlacements.map((placement) => placement.designator),
        ['PKG_BODY_A']
    )
})

test('PcbScene3dBuilder suppresses generic translucent mechanical bodies', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'generic-mechanical-static-body-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2000,
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
                    identifier: 'FRAME2',
                    modelId: '{00000000-0000-0000-0000-000000000013}',
                    checksum: 113,
                    embedded: false,
                    name: '',
                    positionMil: { x: 900, y: 500 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyColor: {
                        raw: 0xf0f0f0,
                        hex: '#f0f0f0',
                        rgb: { red: 240, green: 240, blue: 240 }
                    },
                    bodyOpacity: 0.75,
                    overallHeightMil: 124,
                    standoffHeightMil: 120,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 4,
                        standoffHeightMil: 120,
                        verticesMil: [
                            { x: -320, y: -80 },
                            { x: 320, y: -80 },
                            { x: 320, y: 80 },
                            { x: -320, y: 80 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'ME1',
                    x: 1000,
                    y: 500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'AUX_FRAME2_HOLDER',
                    source: 'AUX_FRAME2_HOLDER',
                    height: 40
                }
            ]
        }
    })

    assert.equal(scene.staticBodyPlacements.length, 0)
})

test('PcbScene3dBuilder keeps generic translucent shield bodies near shield owners', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'shield-static-body-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2000,
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
                    identifier: 'FRAME2',
                    modelId: '{00000000-0000-0000-0000-000000000014}',
                    checksum: 114,
                    embedded: false,
                    name: '',
                    positionMil: { x: 1080, y: 500 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyColor: {
                        raw: 0xf0f0f0,
                        hex: '#f0f0f0',
                        rgb: { red: 240, green: 240, blue: 240 }
                    },
                    bodyOpacity: 0.75,
                    overallHeightMil: 124,
                    standoffHeightMil: 120,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 4,
                        standoffHeightMil: 120,
                        verticesMil: [
                            { x: -320, y: -80 },
                            { x: 320, y: -80 },
                            { x: 320, y: 80 },
                            { x: -320, y: 80 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MECH1',
                    x: 1000,
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

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(scene.staticBodyPlacements[0].designator, 'FRAME2')
    assert.equal(scene.staticBodyPlacements[0].bodyOpacity, 0.75)
})

test('PcbScene3dBuilder renders complete component-body geometry', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'complete-static-body-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            pads: [
                {
                    componentIndex: 0,
                    x: 180,
                    y: 230,
                    sizeTopX: 30,
                    sizeTopY: 80,
                    holeDiameter: 0
                },
                {
                    componentIndex: 0,
                    x: 320,
                    y: 230,
                    sizeTopX: 30,
                    sizeTopY: 80,
                    holeDiameter: 0
                }
            ],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                {
                    sourceStream: 'ComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'QFN50P350X450X80-24_JEDEC_MO-220WFSD',
                    modelId: '{00000000-0000-0000-0000-000000000002}',
                    checksum: 102,
                    embedded: false,
                    name: '',
                    positionMil: { x: 250, y: 230 },
                    rotationDeg: 0,
                    modelType: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyColor: {
                        raw: 0x808080,
                        hex: '#808080',
                        rgb: { red: 128, green: 128, blue: 128 }
                    },
                    bodyOpacity: 1,
                    overallHeightMil: 64,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 64,
                        standoffHeightMil: 0,
                        verticesMil: [
                            { x: -90, y: -45 },
                            { x: 90, y: -45 },
                            { x: 90, y: 45 },
                            { x: -90, y: 45 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'U1',
                    x: 250,
                    y: 230,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'MODULE_A',
                    height: null
                },
                {
                    componentIndex: 1,
                    designator: 'U2',
                    x: 750,
                    y: 230,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'QFN50P350X450X80-24_JEDEC_MO-220WFSD',
                    height: null
                }
            ]
        }
    })

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(
        scene.staticBodyPlacements[0].designator,
        'QFN50P350X450X80-24_JEDEC_MO-220WFSD'
    )
    assert.equal(scene.staticBodyPlacements[0].mountSide, 'top')
    assert.deepEqual(scene.staticBodyPlacements[0].geometry.verticesMil, [
        { x: -90, y: -45 },
        { x: 90, y: -45 },
        { x: 90, y: 45 },
        { x: -90, y: 45 }
    ])
})

test('PcbScene3dBuilder keeps source-coordinate static polygons at their authored bounds', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'source-coordinate-static-body-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 4000,
                minY: 4000,
                widthMil: 2000,
                heightMil: 1200,
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
                    identifier: 'FRAME_RAIL',
                    modelId: '{00000000-0000-0000-0000-000000000010}',
                    checksum: 110,
                    embedded: false,
                    name: '',
                    positionMil: { x: 5200, y: 4800 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    bodyOpacity: 0.75,
                    overallHeightMil: 140,
                    standoffHeightMil: 20,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 120,
                        standoffHeightMil: 20,
                        verticesMil: [
                            { x: 5100, y: 4200 },
                            { x: 5700, y: 4200 },
                            { x: 5700, y: 4210 },
                            { x: 5100, y: 4210 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'MX1',
                    x: 5200,
                    y: 4800,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'GENERIC_SHIELD_OWNER',
                    source: 'GENERIC_SHIELD_OWNER',
                    height: 140
                }
            ]
        }
    })

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.deepEqual(scene.staticBodyPlacements[0].positionMil, {
        x: 400,
        y: -395,
        z: 111.5
    })
    assert.deepEqual(scene.staticBodyPlacements[0].geometry.verticesMil, [
        { x: -300, y: -5 },
        { x: 300, y: -5 },
        { x: 300, y: 5 },
        { x: -300, y: 5 }
    ])
})

test('PcbScene3dBuilder keeps authored stacked timing bodies on the top side', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'stacked-timing-body-fake.PcbDoc',
            pcb: {
                boardOutline: {
                    minX: 3000,
                    minY: 4000,
                    widthMil: 1000,
                    heightMil: 800,
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
                        identifier: 'QFN50P350X450X80-24_JEDEC_MO-220WFSD',
                        modelId: '{00000000-0000-0000-0000-000000000003}',
                        checksum: 103,
                        embedded: false,
                        name: '',
                        positionMil: { x: 4093.071, y: 4730.9059 },
                        rotationDeg: 0,
                        modelType: 0,
                        modelTypeName: 'extruded-polygon',
                        bodyColor: {
                            raw: 0x808080,
                            hex: '#808080',
                            rgb: { red: 128, green: 128, blue: 128 }
                        },
                        bodyOpacity: 1,
                        overallHeightMil: 39.3701,
                        standoffHeightMil: 0,
                        staticGeometry: {
                            kind: 'extruded-polygon',
                            status: 'complete',
                            units: 'mil',
                            heightMil: 39.3701,
                            standoffHeightMil: 0,
                            verticesMil: [
                                { x: 4002.5198, y: 4180.5113 },
                                { x: 4183.6222, y: 4180.5113 },
                                { x: 4183.6222, y: 4444.2909 },
                                { x: 4002.5198, y: 4444.2909 }
                            ]
                        }
                    },
                    {
                        sourceStream: 'ShapeBasedComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'lid_piece',
                        modelId: '{00000000-0000-0000-0000-000000000004}',
                        checksum: 104,
                        embedded: true,
                        name: 'lid-piece.step',
                        positionMil: { x: 4065.5075, y: 4776.1792 },
                        rotationDeg: 0,
                        modelType: 1,
                        modelTypeName: 'cone',
                        overallHeightMil: 70.8662,
                        standoffHeightMil: 39.3701,
                        staticGeometry: {
                            kind: 'cone',
                            status: 'incomplete',
                            units: 'mil',
                            heightMil: 31.4961,
                            standoffHeightMil: 39.3701
                        }
                    }
                ],
                components: [
                    {
                        componentIndex: 0,
                        designator: 'T1',
                        x: 4093.071,
                        y: 4725.0003,
                        rotation: 270,
                        layer: 'TOP',
                        pattern: 'CLOCK_UNIT',
                        source: 'CLOCK_UNIT',
                        height: 48
                    },
                    {
                        componentIndex: 1,
                        designator: 'U9',
                        x: 4240.1614,
                        y: 4253.9385,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: 'QFN50P350X450X80_24',
                        source: 'QFN50P350X450X80_24',
                        height: 32
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
                    return componentBody.embedded
                        ? {
                              origin: 'embedded',
                              name: componentBody.name,
                              format: 'step',
                              payloadText: 'ISO-10303-21;',
                              sourceStream: 'Models/3'
                          }
                        : null
                }
            }
        }
    )

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(scene.staticBodyPlacements[0].mountSide, 'top')
    assert.deepEqual(
        {
            x: scene.staticBodyPlacements[0].positionMil.x,
            y: scene.staticBodyPlacements[0].positionMil.y
        },
        { x: 593.071, y: 325.0003 }
    )
    assert.equal(scene.staticBodyPlacements[0].positionMil.z, 51.1851)
    assert.deepEqual(scene.staticBodyPlacements[0].geometry.verticesMil, [
        { x: -90.5512, y: -131.8898 },
        { x: 90.5512, y: -131.8898 },
        { x: 90.5512, y: 131.8898 },
        { x: -90.5512, y: 131.8898 }
    ])
    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].modelTransform.dzMil, 39.3701)
})

test('PcbScene3dBuilder keeps raised shape-stack sub-bodies with the carrier owner', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'raised-stack-owner-fake.PcbDoc',
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 1000,
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
                        identifier: 'CARRIER_BODY',
                        modelId: '{00000000-0000-0000-0000-000000000005}',
                        checksum: 105,
                        embedded: false,
                        name: '',
                        positionMil: { x: 500, y: 500 },
                        rotationDeg: 0,
                        modelTypeName: 'extruded-polygon',
                        overallHeightMil: 40,
                        standoffHeightMil: 0,
                        staticGeometry: {
                            kind: 'extruded-polygon',
                            status: 'complete',
                            units: 'mil',
                            heightMil: 40,
                            standoffHeightMil: 0,
                            verticesMil: [
                                { x: -120, y: -90 },
                                { x: 120, y: -90 },
                                { x: 120, y: 90 },
                                { x: -120, y: 90 }
                            ]
                        }
                    },
                    {
                        sourceStream: 'ShapeBasedComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'CARRIER_BODY_ALT',
                        modelId: '{00000000-0000-0000-0000-000000000007}',
                        checksum: 107,
                        embedded: false,
                        name: '',
                        positionMil: { x: 500, y: 500 },
                        rotationDeg: 0,
                        modelTypeName: 'extruded-polygon',
                        overallHeightMil: 80,
                        standoffHeightMil: 0,
                        staticGeometry: {
                            kind: 'extruded-polygon',
                            status: 'complete',
                            units: 'mil',
                            heightMil: 80,
                            standoffHeightMil: 0,
                            verticesMil: [
                                { x: -120, y: -90 },
                                { x: 120, y: -90 },
                                { x: 120, y: 90 },
                                { x: -120, y: 90 }
                            ]
                        }
                    },
                    {
                        sourceStream: 'ShapeBasedComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'CAP 0201',
                        modelId: '{00000000-0000-0000-0000-000000000006}',
                        checksum: 106,
                        embedded: true,
                        name: 'CAP 0201.step',
                        positionMil: { x: 630, y: 540 },
                        rotationDeg: 0,
                        modelTypeName: 'cone',
                        overallHeightMil: 55,
                        standoffHeightMil: 40,
                        staticGeometry: {
                            kind: 'cone',
                            status: 'incomplete',
                            units: 'mil',
                            heightMil: 15,
                            standoffHeightMil: 40
                        }
                    },
                    {
                        sourceStream: 'ShapeBasedComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'CAP 0201',
                        modelId: '{00000000-0000-0000-0000-000000000006}',
                        checksum: 106,
                        embedded: true,
                        name: 'CAP 0201.step',
                        positionMil: { x: 630, y: 540 },
                        rotationDeg: 0,
                        modelTypeName: 'cone',
                        overallHeightMil: 95,
                        standoffHeightMil: 80,
                        staticGeometry: {
                            kind: 'cone',
                            status: 'incomplete',
                            units: 'mil',
                            heightMil: 15,
                            standoffHeightMil: 80
                        }
                    }
                ],
                components: [
                    {
                        componentIndex: 0,
                        designator: 'Y1',
                        x: 500,
                        y: 500,
                        rotation: 270,
                        layer: 'TOP',
                        pattern: 'CLOCK_UNIT',
                        source: 'CLOCK_UNIT',
                        parameters: {
                            'Part Description': 'Clock source'
                        },
                        height: 48
                    },
                    {
                        componentIndex: 1,
                        designator: 'Y2',
                        x: 500,
                        y: 500,
                        rotation: 270,
                        layer: 'TOP',
                        pattern: 'CLOCK_UNIT_ALT',
                        source: 'CLOCK_UNIT_ALT',
                        height: 48
                    },
                    {
                        componentIndex: 2,
                        designator: 'C1',
                        x: 630,
                        y: 540,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'CAP0201',
                        source: 'CAP_0201',
                        height: 12
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
                    return componentBody.embedded
                        ? {
                              origin: 'embedded',
                              name: componentBody.name,
                              format: 'step',
                              payloadText: 'ISO-10303-21;',
                              sourceStream: 'Models/stack'
                          }
                        : null
                }
            }
        }
    )

    const carrierComponent = scene.components.find(
        (component) => component.designator === 'Y1'
    )
    const passiveComponent = scene.components.find(
        (component) => component.designator === 'C1'
    )
    const carrierBases = scene.staticBodyPlacements
        .filter((placement) => [40, 80].includes(placement.geometry.heightMil))
        .sort(
            (left, right) => left.geometry.heightMil - right.geometry.heightMil
        )
    const raisedBodies = scene.externalPlacements
        .filter((placement) => placement.externalModel.name === 'CAP 0201.step')
        .sort(
            (left, right) =>
                left.modelTransform.dzMil - right.modelTransform.dzMil
        )
    const alternateComponent = scene.components.find(
        (component) => component.designator === 'Y2'
    )

    assert.equal(carrierComponent.renderFallbackBody, false)
    assert.equal(alternateComponent.renderFallbackBody, false)
    assert.equal(passiveComponent.renderFallbackBody, undefined)
    assert.equal(
        carrierComponent.coLocatedVariantGroupKey,
        alternateComponent.coLocatedVariantGroupKey
    )
    assert.ok(carrierComponent.coLocatedVariantGroupKey)
    assert.deepEqual(
        carrierBases.map((placement) => placement.designator),
        ['Y1', 'Y2']
    )
    assert.deepEqual(
        carrierBases.map((placement) => placement.coLocatedVariantGroupKey),
        [
            carrierComponent.coLocatedVariantGroupKey,
            carrierComponent.coLocatedVariantGroupKey
        ]
    )
    assert.deepEqual(
        raisedBodies.map((placement) => [
            placement.designator,
            placement.modelTransform.dzMil
        ]),
        [
            ['Y1', 40],
            ['Y2', 80]
        ]
    )
    assert.deepEqual(
        raisedBodies.map((placement) => placement.coLocatedVariantGroupKey),
        [
            carrierComponent.coLocatedVariantGroupKey,
            carrierComponent.coLocatedVariantGroupKey
        ]
    )
    assert.deepEqual(raisedBodies[0].modelTransform.ownerAnchorOffsetMil, {
        x: 130,
        y: 40
    })
    assert.deepEqual(raisedBodies[0].modelTransform.offsetMil, {
        x: 40,
        y: 130,
        z: 40
    })
    assert.deepEqual(raisedBodies[1].modelTransform.offsetMil, {
        x: 40,
        y: 130,
        z: 80
    })
})
