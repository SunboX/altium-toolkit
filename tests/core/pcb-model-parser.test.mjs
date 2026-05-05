// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

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
