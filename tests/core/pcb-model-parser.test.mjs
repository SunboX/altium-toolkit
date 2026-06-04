// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Verifies PCB component records retain their native component index so
 * primitive ownership can be resolved without geometry-specific inference.
 */
test('PcbModelParser preserves native component indexes', () => {
    const documentModel = PcbModelParser.parse('demo.PcbDoc', [
        createBoardRecord(),
        {
            sourceStream: 'Components6/Data',
            fields: {
                LAYER: 'TOP',
                X: '100mil',
                Y: '120mil',
                PATTERN: '0603',
                ROTATION: '0',
                HEIGHT: '12mil',
                SOURCEDESIGNATOR: 'R1',
                SOURCELIBREFERENCE: 'RES/FAKE/10K',
                SOURCEDESCRIPTION: 'Drift resistor'
            }
        },
        {
            sourceStream: 'Components6/Data',
            fields: {
                LAYER: 'TOP',
                X: '300mil',
                Y: '160mil',
                PATTERN: 'CONN-4',
                ROTATION: '90',
                HEIGHT: '18mil',
                SOURCEDESIGNATOR: 'J1',
                SOURCELIBREFERENCE: 'CON/FAKE/4P',
                SOURCEDESCRIPTION: 'Debug connector'
            }
        }
    ])

    assert.deepEqual(
        documentModel.pcb.components.map((component) => ({
            designator: component.designator,
            componentIndex: component.componentIndex,
            y: component.y
        })),
        [
            { designator: 'J1', componentIndex: 1, y: 340 },
            { designator: 'R1', componentIndex: 0, y: 380 }
        ]
    )
})

/**
 * Verifies PCB component indexing follows the native Components6/Data table
 * even when other printable records carry component-like fields.
 */
test('PcbModelParser indexes only Components6/Data when that table is available', () => {
    const documentModel = PcbModelParser.parse('demo.PcbDoc', [
        createBoardRecord(),
        {
            sourceStream: 'PrimitiveParameters/Data',
            fields: {
                PATTERN: 'DECOY',
                SOURCEDESIGNATOR: 'IGNORED',
                X: '900mil',
                Y: '900mil'
            }
        },
        {
            sourceStream: 'Components6/Data',
            fields: {
                LAYER: 'TOP',
                X: '100mil',
                Y: '120mil',
                PATTERN: '0603',
                ROTATION: '0',
                SOURCEDESIGNATOR: 'R1'
            }
        },
        {
            sourceStream: 'Components6/Data',
            fields: {
                LAYER: 'TOP',
                X: '300mil',
                Y: '160mil',
                PATTERN: 'CONN-4',
                ROTATION: '90',
                SOURCEDESIGNATOR: 'J1'
            }
        }
    ])

    assert.deepEqual(
        documentModel.pcb.components.map((component) => ({
            designator: component.designator,
            componentIndex: component.componentIndex
        })),
        [
            { designator: 'J1', componentIndex: 1 },
            { designator: 'R1', componentIndex: 0 }
        ]
    )
})

/**
 * Verifies sparse native component records do not shift later primitive owner
 * indexes when they are omitted from the public placement list.
 */
test('PcbModelParser keeps native component indexes through sparse records', () => {
    const documentModel = PcbModelParser.parse('demo.PcbDoc', [
        createBoardRecord(),
        {
            sourceStream: 'Components6/Data',
            fields: {
                LAYER: 'TOP',
                X: '40mil',
                Y: '40mil'
            }
        },
        {
            sourceStream: 'Components6/Data',
            fields: {
                LAYER: 'TOP',
                X: '100mil',
                Y: '120mil',
                PATTERN: '0603',
                ROTATION: '0',
                SOURCEDESIGNATOR: 'R1'
            }
        }
    ])

    assert.deepEqual(
        documentModel.pcb.components.map((component) => ({
            designator: component.designator,
            componentIndex: component.componentIndex
        })),
        [{ designator: 'R1', componentIndex: 1 }]
    )
    assert.equal(documentModel.pcb.componentPrimitives[0], null)
    assert.equal(documentModel.pcb.componentPrimitives[1].designator, 'R1')
})

/**
 * Verifies the public PCB model exposes native component primitive groups so
 * host apps can highlight footprints without geometry ownership guessing.
 */
test('PcbModelParser exposes component primitive groups from native indexes', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            createBoardRecord(),
            {
                sourceStream: 'Components6/Data',
                fields: {
                    LAYER: 'TOP',
                    X: '100mil',
                    Y: '120mil',
                    PATTERN: '0603',
                    ROTATION: '0',
                    SOURCEDESIGNATOR: 'R1'
                }
            },
            {
                sourceStream: 'Components6/Data',
                fields: {
                    LAYER: 'TOP',
                    X: '300mil',
                    Y: '160mil',
                    PATTERN: 'CONN-4',
                    ROTATION: '90',
                    SOURCEDESIGNATOR: 'J1'
                }
            }
        ],
        {
            streamNames: ['Board6/Data', 'Tracks6/Data', 'Pads6/Data'],
            binaryPrimitives: {
                fills: [
                    {
                        x1: 280,
                        y1: 150,
                        x2: 340,
                        y2: 170,
                        componentIndex: 1,
                        netIndex: 5,
                        polygonIndex: null,
                        layerCode: 33,
                        layerId: 33
                    },
                    {
                        x1: 10,
                        y1: 10,
                        x2: 20,
                        y2: 20,
                        componentIndex: null,
                        netIndex: null,
                        polygonIndex: null,
                        layerCode: 33,
                        layerId: 33
                    }
                ],
                tracks: [
                    {
                        x1: 95,
                        y1: 110,
                        x2: 130,
                        y2: 110,
                        width: 8,
                        componentIndex: 0,
                        netIndex: 6,
                        polygonIndex: 7,
                        layerCode: 33,
                        layerId: 33
                    }
                ],
                arcs: [],
                vias: [
                    {
                        x: 500,
                        y: 250,
                        diameter: 30,
                        holeDiameter: 15,
                        componentIndex: null,
                        netIndex: 8,
                        polygonIndex: 9
                    }
                ],
                pads: [
                    {
                        x: 300,
                        y: 160,
                        sizeTopX: 60,
                        sizeTopY: 40,
                        sizeMidX: 60,
                        sizeMidY: 40,
                        sizeBottomX: 60,
                        sizeBottomY: 40,
                        holeDiameter: 20,
                        shapeTop: 2,
                        shapeMid: 2,
                        shapeBottom: 2,
                        rotation: 90,
                        isPlated: true,
                        componentIndex: 1,
                        netIndex: 10,
                        polygonIndex: null
                    }
                ],
                regions: [
                    {
                        layerId: 33,
                        layerCode: 33,
                        netIndex: 11,
                        polygonIndex: 12,
                        componentIndex: 1,
                        kind: 0,
                        isKeepout: false,
                        isBoardCutout: false,
                        isShapeBased: false,
                        points: [
                            { x: 280, y: 150 },
                            { x: 340, y: 150 },
                            { x: 340, y: 190 },
                            { x: 280, y: 190 }
                        ],
                        holes: [
                            [
                                { x: 300, y: 160 },
                                { x: 320, y: 160 },
                                { x: 320, y: 180 },
                                { x: 300, y: 180 }
                            ]
                        ],
                        properties: { KIND: '0' }
                    }
                ],
                texts: [
                    {
                        text: 'J1',
                        ownerIndex: 1,
                        x: 305,
                        y: 180,
                        height: 10,
                        layerId: 33,
                        kind: 0,
                        visibilityFlags: 0,
                        rotation: 0
                    }
                ]
            },
            diagnostics: {
                printableRecordCount: 3,
                printableStreamCount: 1,
                binaryPrimitiveCount: 5,
                rawRecordCount: 1
            },
            rawRecords: [
                {
                    registryId: 'pcbdoc:Tracks6/Data:0',
                    source: 'pcbdoc',
                    sourceStream: 'Tracks6/Data',
                    headerStream: 'Tracks6/Header',
                    family: 'tracks',
                    type: 'track',
                    typeId: 4,
                    recordIndex: 0,
                    offset: 0,
                    byteLength: 54,
                    payloadByteLength: 49,
                    encoding: 'length-prefixed',
                    supported: true,
                    parsed: true,
                    rawBase64: 'BA=='
                }
            ]
        }
    )

    assert.deepEqual(
        documentModel.pcb.componentPrimitiveGroups.map((group) => ({
            componentIndex: group.componentIndex,
            designator: group.designator,
            pads: group.pads.length,
            tracks: group.tracks.length,
            fills: group.fills.length,
            regions: group.regions.length,
            texts: group.texts.map((text) => text.text)
        })),
        [
            {
                componentIndex: 1,
                designator: 'J1',
                pads: 1,
                tracks: 0,
                fills: 1,
                regions: 1,
                texts: ['J1']
            },
            {
                componentIndex: 0,
                designator: 'R1',
                pads: 0,
                tracks: 1,
                fills: 0,
                regions: 0,
                texts: []
            }
        ]
    )
    assert.deepEqual(
        documentModel.pcb.componentPrimitives.map((group) => ({
            componentIndex: group.componentIndex,
            designator: group.designator,
            pads: group.pads.length,
            tracks: group.tracks.length,
            fills: group.fills.length,
            vias: group.vias.length,
            regions: group.regions.length,
            texts: group.texts.map((text) => text.text)
        })),
        [
            {
                componentIndex: 0,
                designator: 'R1',
                pads: 0,
                tracks: 1,
                fills: 0,
                vias: 0,
                regions: 0,
                texts: []
            },
            {
                componentIndex: 1,
                designator: 'J1',
                pads: 1,
                tracks: 0,
                fills: 1,
                vias: 0,
                regions: 1,
                texts: ['J1']
            }
        ]
    )
    assert.deepEqual(documentModel.pcb.regions[0].points, [
        { x: 280, y: 350 },
        { x: 340, y: 350 },
        { x: 340, y: 310 },
        { x: 280, y: 310 }
    ])
    assert.deepEqual(documentModel.pcb.regions[0].holes, [
        [
            { x: 300, y: 340 },
            { x: 320, y: 340 },
            { x: 320, y: 320 },
            { x: 300, y: 320 }
        ]
    ])
    assert.deepEqual(documentModel.pcb.vias[0], {
        x: 500,
        y: 250,
        diameter: 30,
        holeDiameter: 15,
        componentIndex: null,
        netIndex: 8,
        polygonIndex: 9
    })
    assert.equal(
        documentModel.pcb.ownership.schema,
        'altium-toolkit.pcb.ownership.a1'
    )
    assert.deepEqual(
        documentModel.pcb.ownership.componentsByIndex['1'].primitiveKeys,
        ['fill-0', 'pad-0', 'region-0', 'text-0']
    )
    assert.deepEqual(documentModel.pcb.ownership.netsByIndex['8'], {
        netIndex: 8,
        name: '',
        primitiveKeys: ['via-0']
    })
    assert.deepEqual(
        documentModel.pcb.ownership.primitiveOwners.find(
            (entry) => entry.primitiveKey === 'track-0'
        ),
        {
            primitiveKey: 'track-0',
            primitiveKind: 'track',
            componentIndex: 0,
            component: 'R1',
            netIndex: 6,
            net: '',
            polygonIndex: 7
        }
    )
    assert.equal(documentModel.summary.rawRecordCount, 1)
    assert.equal(
        documentModel.pcb.rawRecords[0].registryId,
        'pcbdoc:Tracks6/Data:0'
    )
})

/**
 * Verifies normalized PCB models carry decoded pad geometry through the
 * board-space flip into viewer coordinates.
 */
test('PcbModelParser preserves and normalizes decoded pads', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            {
                sourceStream: 'Board6/Data',
                fields: {
                    KIND0: '0',
                    VX0: '0mil',
                    VY0: '0mil',
                    CX0: '0mil',
                    CY0: '0mil',
                    SA0: '0',
                    EA0: '0',
                    R0: '0mil',
                    KIND1: '0',
                    VX1: '1000mil',
                    VY1: '0mil',
                    CX1: '0mil',
                    CY1: '0mil',
                    SA1: '0',
                    EA1: '0',
                    R1: '0mil',
                    KIND2: '0',
                    VX2: '1000mil',
                    VY2: '500mil',
                    CX2: '0mil',
                    CY2: '0mil',
                    SA2: '0',
                    EA2: '0',
                    R2: '0mil',
                    KIND3: '0',
                    VX3: '0mil',
                    VY3: '500mil',
                    CX3: '0mil',
                    CY3: '0mil',
                    SA3: '0',
                    EA3: '0',
                    R3: '0mil',
                    V9_STACK_LAYER1_NAME: 'Top Layer',
                    V9_STACK_LAYER1_LAYERID: '1'
                }
            }
        ],
        {
            streamNames: ['Board6/Data', 'Pads6/Data'],
            binaryPrimitives: {
                fills: [],
                tracks: [],
                vias: [],
                pads: [
                    {
                        x: 120,
                        y: 80,
                        sizeTopX: 160,
                        sizeTopY: 160,
                        sizeMidX: 160,
                        sizeMidY: 160,
                        sizeBottomX: 160,
                        sizeBottomY: 160,
                        holeDiameter: 90,
                        shapeTop: 1,
                        shapeMid: 1,
                        shapeBottom: 1,
                        rotation: 90,
                        isPlated: true,
                        holeShape: 2,
                        holeSlotLength: 140,
                        holeRotation: 15,
                        hasRoundedRect: false,
                        roundedRectShapeTop: null,
                        cornerRadiusTop: null,
                        offsetTopX: 0,
                        offsetTopY: 0
                    }
                ]
            },
            diagnostics: {
                printableRecordCount: 1,
                printableStreamCount: 1,
                binaryPrimitiveCount: 1
            }
        }
    )

    assert.deepEqual(documentModel.pcb.pads, [
        {
            x: 120,
            y: 420,
            sizeTopX: 160,
            sizeTopY: 160,
            sizeMidX: 160,
            sizeMidY: 160,
            sizeBottomX: 160,
            sizeBottomY: 160,
            holeDiameter: 90,
            shapeTop: 1,
            shapeMid: 1,
            shapeBottom: 1,
            rotation: 270,
            isPlated: true,
            holeShape: 2,
            holeSlotLength: 140,
            holeRotation: 345,
            hasRoundedRect: false,
            roundedRectShapeTop: null,
            cornerRadiusTop: null,
            offsetTopX: 0,
            offsetTopY: 0
        }
    ])
})

/**
 * Creates the standard synthetic rectangular board record for parser tests.
 * @returns {{ sourceStream: string, fields: Record<string, string> }}
 */
function createBoardRecord() {
    return {
        sourceStream: 'Board6/Data',
        fields: {
            KIND0: '0',
            VX0: '0mil',
            VY0: '0mil',
            CX0: '0mil',
            CY0: '0mil',
            SA0: '0',
            EA0: '0',
            R0: '0mil',
            KIND1: '0',
            VX1: '1000mil',
            VY1: '0mil',
            CX1: '0mil',
            CY1: '0mil',
            SA1: '0',
            EA1: '0',
            R1: '0mil',
            KIND2: '0',
            VX2: '1000mil',
            VY2: '500mil',
            CX2: '0mil',
            CY2: '0mil',
            SA2: '0',
            EA2: '0',
            R2: '0mil',
            KIND3: '0',
            VX3: '0mil',
            VY3: '500mil',
            CX3: '0mil',
            CY3: '0mil',
            SA3: '0',
            EA3: '0',
            R3: '0mil',
            V9_STACK_LAYER1_NAME: 'Top Layer',
            V9_STACK_LAYER1_LAYERID: '1'
        }
    }
}

/**
 * Verifies normalized PCB models carry decoded arc geometry through the
 * board-space flip so authored rounded outlines stay drawable.
 */
test('PcbModelParser preserves and normalizes decoded arcs', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            {
                sourceStream: 'Board6/Data',
                fields: {
                    KIND0: '0',
                    VX0: '0mil',
                    VY0: '0mil',
                    CX0: '0mil',
                    CY0: '0mil',
                    SA0: '0',
                    EA0: '0',
                    R0: '0mil',
                    KIND1: '0',
                    VX1: '1000mil',
                    VY1: '0mil',
                    CX1: '0mil',
                    CY1: '0mil',
                    SA1: '0',
                    EA1: '0',
                    R1: '0mil',
                    KIND2: '0',
                    VX2: '1000mil',
                    VY2: '500mil',
                    CX2: '0mil',
                    CY2: '0mil',
                    SA2: '0',
                    EA2: '0',
                    R2: '0mil',
                    KIND3: '0',
                    VX3: '0mil',
                    VY3: '500mil',
                    CX3: '0mil',
                    CY3: '0mil',
                    SA3: '0',
                    EA3: '0',
                    R3: '0mil',
                    V9_STACK_LAYER1_NAME: 'Top Layer',
                    V9_STACK_LAYER1_LAYERID: '1'
                }
            }
        ],
        {
            streamNames: ['Arcs6/Data', 'Board6/Data'],
            binaryPrimitives: {
                fills: [],
                tracks: [],
                arcs: [
                    {
                        x: 200,
                        y: 100,
                        radius: 25,
                        startAngle: 90,
                        endAngle: 180,
                        width: 6,
                        layerCode: 33,
                        layerId: 33
                    }
                ],
                vias: [],
                pads: []
            },
            diagnostics: {
                printableRecordCount: 1,
                printableStreamCount: 1,
                binaryPrimitiveCount: 1
            }
        }
    )

    assert.deepEqual(documentModel.pcb.arcs, [
        {
            x: 200,
            y: 400,
            radius: 25,
            startAngle: 270,
            endAngle: 180,
            width: 6,
            layerCode: 33,
            layerId: 33
        }
    ])
})

/**
 * Verifies normalized PCB models expose legacy primitive layer names used by
 * decoded binary primitives such as overlay and mechanical outline tracks.
 */
test('PcbModelParser exposes primitive layer names for decoded binary layers', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            {
                sourceStream: 'Board6/Data',
                fields: {
                    KIND0: '0',
                    VX0: '0mil',
                    VY0: '0mil',
                    CX0: '0mil',
                    CY0: '0mil',
                    SA0: '0',
                    EA0: '0',
                    R0: '0mil',
                    KIND1: '0',
                    VX1: '1000mil',
                    VY1: '0mil',
                    CX1: '0mil',
                    CY1: '0mil',
                    SA1: '0',
                    EA1: '0',
                    R1: '0mil',
                    KIND2: '0',
                    VX2: '1000mil',
                    VY2: '500mil',
                    CX2: '0mil',
                    CY2: '0mil',
                    SA2: '0',
                    EA2: '0',
                    R2: '0mil',
                    KIND3: '0',
                    VX3: '0mil',
                    VY3: '500mil',
                    CX3: '0mil',
                    CY3: '0mil',
                    SA3: '0',
                    EA3: '0',
                    R3: '0mil'
                }
            },
            {
                sourceStream: 'Board6/Data',
                fields: {
                    RECORD: '6',
                    LAYER33NAME: 'Top Overlay',
                    LAYER59NAME: 'M3 Placement Outline',
                    LAYER71NAME: 'M15 Top RefDes'
                }
            }
        ],
        {
            streamNames: ['Board6/Data'],
            binaryPrimitives: {
                fills: [],
                tracks: [],
                vias: [],
                pads: []
            },
            diagnostics: {
                printableRecordCount: 2,
                printableStreamCount: 1,
                binaryPrimitiveCount: 0
            }
        }
    )

    assert.deepEqual(documentModel.pcb.primitiveLayers, [
        { layerId: 33, name: 'Top Overlay' },
        { layerId: 59, name: 'M3 Placement Outline' },
        { layerId: 71, name: 'M15 Top RefDes' }
    ])
    assert.equal(documentModel.summary.layerCount, 3)
})

/**
 * Verifies mechanical-layer pair relationships are exposed for footprint-side
 * flipping and user-facing layer identity.
 */
test('PcbModelParser exposes mechanical layer pairs and flip metadata', () => {
    const documentModel = PcbModelParser.parse('demo.PcbDoc', [
        {
            sourceStream: 'Board6/Data',
            fields: {
                KIND0: '0',
                VX0: '0mil',
                VY0: '0mil',
                CX0: '0mil',
                CY0: '0mil',
                SA0: '0',
                EA0: '0',
                R0: '0mil',
                KIND1: '0',
                VX1: '100mil',
                VY1: '0mil',
                CX1: '0mil',
                CY1: '0mil',
                SA1: '0',
                EA1: '0',
                R1: '0mil',
                KIND2: '0',
                VX2: '100mil',
                VY2: '80mil',
                CX2: '0mil',
                CY2: '0mil',
                SA2: '0',
                EA2: '0',
                R2: '0mil',
                KIND3: '0',
                VX3: '0mil',
                VY3: '80mil',
                CX3: '0mil',
                CY3: '0mil',
                SA3: '0',
                EA3: '0',
                R3: '0mil',
                LAYER57NAME: 'Mech A',
                LAYER58NAME: 'Mech B',
                V9_STACK_LAYER1_NAME: 'Mech A',
                V9_STACK_LAYER1_LAYERID: '57',
                V9_STACK_LAYER2_NAME: 'Mech B',
                V9_STACK_LAYER2_LAYERID: '58',
                MECHANICAL_LAYER_PAIR_COUNT: '1',
                MECHANICAL_LAYER_PAIR1_LAYER1: '57',
                MECHANICAL_LAYER_PAIR1_LAYER2: '58',
                MECHANICAL_LAYER_PAIR1_LAYER1V7: '16908289',
                MECHANICAL_LAYER_PAIR1_LAYER2V7: '16908290'
            }
        }
    ])

    assert.deepEqual(documentModel.pcb.mechanicalLayerPairs, [
        {
            index: 1,
            layer1Id: 57,
            layer2Id: 58,
            layer1Name: 'Mech A',
            layer2Name: 'Mech B',
            layer1V7SaveId: 0x01020001,
            layer2V7SaveId: 0x01020002
        }
    ])
    assert.deepEqual(documentModel.pcb.layerFlipMetadata.mechanicalFlipMap, {
        57: 58,
        58: 57
    })
    assert.equal(documentModel.summary.mechanicalLayerPairCount, 1)
})

/**
 * Verifies normalized PCB models preserve embedded 3D model payloads and flip
 * component-body placements into viewer coordinates.
 */
test('PcbModelParser preserves embedded model payloads and normalizes body placements', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            {
                sourceStream: 'Board6/Data',
                fields: {
                    KIND0: '0',
                    VX0: '0mil',
                    VY0: '0mil',
                    CX0: '0mil',
                    CY0: '0mil',
                    SA0: '0',
                    EA0: '0',
                    R0: '0mil',
                    KIND1: '0',
                    VX1: '1000mil',
                    VY1: '0mil',
                    CX1: '0mil',
                    CY1: '0mil',
                    SA1: '0',
                    EA1: '0',
                    R1: '0mil',
                    KIND2: '0',
                    VX2: '1000mil',
                    VY2: '500mil',
                    CX2: '0mil',
                    CY2: '0mil',
                    SA2: '0',
                    EA2: '0',
                    R2: '0mil',
                    KIND3: '0',
                    VX3: '0mil',
                    VY3: '500mil',
                    CX3: '0mil',
                    CY3: '0mil',
                    SA3: '0',
                    EA3: '0',
                    R3: '0mil',
                    V9_STACK_LAYER1_NAME: 'Top Layer',
                    V9_STACK_LAYER1_LAYERID: '1'
                }
            },
            {
                sourceStream: 'Components6/Data',
                fields: {
                    LAYER: 'TOP',
                    X: '250mil',
                    Y: '300mil',
                    PATTERN: 'SOT-23',
                    ROTATION: '45',
                    HEIGHT: '40mil',
                    SOURCEDESIGNATOR: 'Q1',
                    SOURCELIBREFERENCE: 'Transistor',
                    SOURCEDESCRIPTION: 'Switch transistor'
                }
            }
        ],
        {
            streamNames: [
                'Board6/Data',
                'ComponentBodies6/Data',
                'Models/Data'
            ],
            binaryPrimitives: {
                fills: [],
                tracks: [],
                arcs: [],
                vias: [],
                pads: []
            },
            embeddedModels: {
                models: [
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
                ],
                componentBodies: [
                    {
                        sourceStream: 'ComponentBodies6/Data',
                        layer: 'MECHANICAL1',
                        identifier: 'SOT-23_Y',
                        modelId: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
                        checksum: 3467130030,
                        embedded: true,
                        name: 'SOT-23_Y.stp',
                        positionMil: { x: 250, y: 300 },
                        rotationDeg: 45,
                        modelRotationDeg: { x: 0, y: 0, z: 270 },
                        dzMil: 11.811,
                        overallHeightMil: 39.3701,
                        standoffHeightMil: -0.0684
                    }
                ]
            },
            diagnostics: {
                printableRecordCount: 2,
                printableStreamCount: 2,
                binaryPrimitiveCount: 0
            }
        }
    )

    assert.deepEqual(documentModel.pcb.embeddedModels, [
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
    ])
    assert.deepEqual(documentModel.pcb.componentBodies, [
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
    ])
    assert.deepEqual(documentModel.bom, [
        {
            designators: ['Q1'],
            quantity: 1,
            pattern: 'SOT-23',
            source: 'Transistor',
            value: 'Switch transistor'
        }
    ])
    assert.ok(
        documentModel.diagnostics.some(
            (diagnostic) =>
                diagnostic.message === 'Recovered 1 embedded 3D model payloads.'
        )
    )
})

/**
 * Verifies compiled PCB component provenance is exposed without requiring the
 * project compiler to run.
 */
test('PcbModelParser exposes component source provenance fields', () => {
    const documentModel = PcbModelParser.parse('provenance.PcbDoc', [
        createBoardRecord(),
        {
            sourceStream: 'Components6/Data',
            fields: {
                LAYER: 'TOP',
                X: '100mil',
                Y: '120mil',
                PATTERN: 'QFN-FAKE',
                ROTATION: '0',
                HEIGHT: '20mil',
                SOURCEDESIGNATOR: 'U1',
                SOURCEUNIQUEID: 'TOP\\CH_A\\COMP_1',
                SOURCEHIERARCHICALPATH: 'Root\\RepeatedA',
                SOURCEFOOTPRINTLIBRARY: 'Libraries\\PackageVault.PcbLib',
                SOURCELIBREFERENCE: 'SYM/FAKE/QFN',
                SOURCECOMPONENTLIBRARY: 'Libraries\\LogicVault.SchLib',
                SOURCECOMPLIBIDENTIFIERKIND: '2',
                SOURCECOMPLIBRARYIDENTIFIER: 'FAKE-COMPONENT-ID',
                FOOTPRINTDESCRIPTION: 'Synthetic package',
                CHANNELOFFSET: '8',
                NAMEAUTOPOSITION: '3',
                COMMENTAUTOPOSITION: '7',
                LOCKSTRINGS: 'TRUE',
                ENABLEPINSWAPPING: 'FALSE',
                ENABLEPARTSWAPPING: 'TRUE'
            }
        }
    ])

    assert.deepEqual(documentModel.pcb.components[0].provenance, {
        channelOffset: 8,
        sourceDesignator: 'U1',
        sourceUniqueId: 'TOP\\CH_A\\COMP_1',
        sourceUniqueIdSegments: ['TOP', 'CH_A', 'COMP_1'],
        sourceHierarchicalPath: 'Root\\RepeatedA',
        sourceHierarchySegments: ['Root', 'RepeatedA'],
        sourceFootprintLibrary: 'Libraries\\PackageVault.PcbLib',
        sourceFootprintLibraryName: 'PackageVault.PcbLib',
        sourceLibReference: 'SYM/FAKE/QFN',
        sourceComponentLibrary: 'Libraries\\LogicVault.SchLib',
        sourceComponentLibraryIdentifierKind: 2,
        sourceComponentLibraryIdentifier: 'FAKE-COMPONENT-ID',
        footprintDescription: 'Synthetic package',
        nameAutoPosition: 3,
        commentAutoPosition: 7,
        lockStrings: true,
        enablePinSwapping: false,
        enablePartSwapping: true
    })
})

/**
 * Verifies class records and differential-pair records are joined into a
 * consumer-facing lookup surface.
 */
test('PcbModelParser joins differential-pair classes to pair records', () => {
    const documentModel = PcbModelParser.parse('diff-pair.PcbDoc', [
        createBoardRecord(),
        {
            sourceStream: 'Classes6/Data',
            fields: {
                NAME: 'Matched Pairs',
                KIND: '6',
                MEMBERCOUNT: '2',
                M0: 'CLK_A',
                M1: 'DATA_A',
                ENABLED: 'TRUE',
                UNIQUEID: 'CLASS-1'
            }
        },
        {
            sourceStream: 'DifferentialPairs6/Data',
            fields: {
                NAME: 'CLK_A',
                POSITIVENETNAME: 'CLK_A_P',
                NEGATIVENETNAME: 'CLK_A_N',
                GATHERCONTROL: 'TRUE',
                UNIQUEID: 'PAIR-1'
            }
        }
    ])

    assert.deepEqual(documentModel.pcb.differentialPairs, [
        {
            pairIndex: 0,
            name: 'CLK_A',
            positiveNetName: 'CLK_A_P',
            negativeNetName: 'CLK_A_N',
            netNames: ['CLK_A_P', 'CLK_A_N'],
            gatherControl: true,
            uniqueId: 'PAIR-1',
            classNames: ['Matched Pairs']
        }
    ])
    assert.deepEqual(documentModel.pcb.differentialPairClasses, [
        {
            classIndex: 0,
            name: 'Matched Pairs',
            members: ['CLK_A', 'DATA_A'],
            pairNames: ['CLK_A'],
            unresolvedMembers: ['DATA_A']
        }
    ])
})

/**
 * Verifies PnP entries distinguish Altium-style pad-anchor centers from
 * component-origin coordinates.
 */
test('PcbModelParser emits pick-place entries with explicit coordinate modes', () => {
    const documentModel = PcbModelParser.parse(
        'pick-place.PcbDoc',
        [
            createBoardRecord(),
            {
                sourceStream: 'Components6/Data',
                fields: {
                    LAYER: 'TOP',
                    X: '100mil',
                    Y: '120mil',
                    PATTERN: 'QFN-FAKE',
                    ROTATION: '90',
                    HEIGHT: '20mil',
                    SOURCEDESIGNATOR: 'U1'
                }
            }
        ],
        {
            streamNames: ['Board6/Data', 'Pads6/Data'],
            binaryPrimitives: {
                pads: [
                    {
                        x: 70,
                        y: 110,
                        sizeTopX: 20,
                        sizeTopY: 20,
                        componentIndex: 0
                    },
                    {
                        x: 170,
                        y: 130,
                        sizeTopX: 20,
                        sizeTopY: 20,
                        componentIndex: 0
                    }
                ]
            },
            diagnostics: {
                printableRecordCount: 2,
                printableStreamCount: 2,
                binaryPrimitiveCount: 2
            }
        }
    )

    assert.equal(documentModel.pnp.positionMode, 'altium-pick-place')
    assert.deepEqual(documentModel.pnp.entries, [
        {
            designator: 'U1',
            pattern: 'QFN-FAKE',
            layer: 'TOP',
            rotation: 90,
            x: 120,
            y: 380,
            componentOriginX: 100,
            componentOriginY: 380,
            padAnchorCount: 2,
            positionSource: 'pad-anchor-bounds'
        }
    ])
    assert.deepEqual(documentModel.pnp.modes.componentOrigin.entries, [
        {
            designator: 'U1',
            pattern: 'QFN-FAKE',
            layer: 'TOP',
            rotation: 90,
            x: 100,
            y: 380,
            componentOriginX: 100,
            componentOriginY: 380,
            padAnchorCount: 2,
            positionSource: 'component-origin'
        }
    ])
})

/**
 * Verifies PCB parsing exposes deterministic QA statistics for board review
 * and regression diffing.
 */
test('PcbModelParser emits deterministic PCB statistics summary', () => {
    const documentModel = PcbModelParser.parse(
        'stats.PcbDoc',
        [createBoardRecord()],
        {
            streamNames: ['Board6/Data', 'Tracks6/Data', 'Pads6/Data'],
            binaryPrimitives: {
                tracks: [
                    {
                        layerId: 1,
                        width: 8,
                        x1: 0,
                        y1: 0,
                        x2: 100,
                        y2: 0
                    }
                ],
                arcs: [{ layerId: 1, width: 6 }],
                vias: [
                    {
                        layerId: 1,
                        diameter: 24,
                        holeDiameter: 12,
                        isPlated: true
                    }
                ],
                pads: [
                    {
                        layerId: 1,
                        sizeTopX: 50,
                        sizeTopY: 70,
                        holeDiameter: 20,
                        holeShape: 2,
                        holeSlotLength: 60,
                        isPlated: false
                    }
                ],
                fills: [],
                texts: [],
                regions: [],
                shapeBasedRegions: []
            },
            diagnostics: {
                printableRecordCount: 1,
                printableStreamCount: 1,
                binaryPrimitiveCount: 4
            }
        }
    )

    assert.deepEqual(documentModel.pcb.statistics.board, {
        widthMil: 1000,
        heightMil: 500,
        centroidMil: { x: 500, y: 250 },
        outlineSegmentCount: 4,
        cutoutCount: 0
    })
    assert.deepEqual(documentModel.pcb.statistics.drills, {
        totalHoleCount: 2,
        padHoleCount: 1,
        viaHoleCount: 1,
        platedHoleCount: 1,
        nonPlatedHoleCount: 1,
        slotCount: 1,
        holeDiameterMil: { 12: 1, 20: 1 },
        slotLengthMil: { 60: 1 }
    })
    assert.deepEqual(documentModel.pcb.statistics.primitiveWidths, {
        tracksMil: { 8: 1 },
        arcsMil: { 6: 1 },
        viasMil: { 24: 1 },
        padsTopXMil: { 50: 1 }
    })
    assert.deepEqual(documentModel.pcb.statistics.layers.entries, [
        {
            layerId: 1,
            name: 'Top Layer',
            role: 'signal',
            primitiveCounts: {
                tracks: 1,
                arcs: 1,
                vias: 1,
                pads: 1,
                fills: 0,
                texts: 0,
                regions: 0,
                shapeBasedRegions: 0
            }
        }
    ])
})

/**
 * Verifies layer stack material and electrical fields are included in the
 * deterministic statistics contract when they are present in board metadata.
 */
test('PcbModelParser emits layer-stack material statistics', () => {
    const boardRecord = createBoardRecord()
    Object.assign(boardRecord.fields, {
        V9_STACK_LAYER1_KIND: 'signal',
        V9_STACK_LAYER1_MATERIAL: 'Copper',
        V9_STACK_LAYER1_COPPERTHICKNESS: '1.4mil',
        V9_STACK_LAYER1_COPPERWEIGHT: '1oz',
        V9_STACK_LAYER2_NAME: 'Core',
        V9_STACK_LAYER2_LAYERID: '2',
        V9_STACK_LAYER2_KIND: 'dielectric',
        V9_STACK_LAYER2_MATERIAL: 'FR-4',
        V9_STACK_LAYER2_THICKNESS: '58mil',
        V9_STACK_LAYER2_DK: '4.2',
        V9_STACK_LAYER2_DF: '0.018'
    })

    const documentModel = PcbModelParser.parse(
        'stack-stats.PcbDoc',
        [boardRecord],
        {
            streamNames: ['Board6/Data'],
            binaryPrimitives: {},
            diagnostics: {
                printableRecordCount: 1,
                printableStreamCount: 1,
                binaryPrimitiveCount: 0
            }
        }
    )

    assert.deepEqual(documentModel.pcb.layers, [
        {
            index: 1,
            name: 'Top Layer',
            layerId: 1,
            kind: 'signal',
            material: 'Copper',
            copperThicknessMil: 1.4,
            copperWeight: '1oz'
        },
        {
            index: 2,
            name: 'Core',
            layerId: 2,
            kind: 'dielectric',
            material: 'FR-4',
            thicknessMil: 58,
            dielectricConstant: 4.2,
            dissipationFactor: 0.018
        }
    ])
    assert.deepEqual(documentModel.pcb.statistics.layers.summary, {
        signalLayerCount: 1,
        dielectricLayerCount: 1,
        copperLayerCount: 1,
        dielectricThicknessMil: 58,
        materials: {
            Copper: 1,
            'FR-4': 1
        }
    })
    assert.deepEqual(documentModel.pcb.statistics.layers.entries[1], {
        layerId: 2,
        name: 'Core',
        role: 'dielectric',
        material: 'FR-4',
        thicknessMil: 58,
        dielectricConstant: 4.2,
        dissipationFactor: 0.018,
        primitiveCounts: {
            tracks: 0,
            arcs: 0,
            vias: 0,
            pads: 0,
            fills: 0,
            texts: 0,
            regions: 0,
            shapeBasedRegions: 0
        }
    })
})
