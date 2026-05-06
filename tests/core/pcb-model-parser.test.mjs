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
                binaryPrimitiveCount: 5
            }
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
