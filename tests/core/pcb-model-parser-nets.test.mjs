// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Verifies PCB net records are exposed as a native net table and binary
 * primitives are annotated through their numeric net indexes.
 */
test('PcbModelParser exposes PCB nets and annotates primitive net names', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            createBoardRecord(),
            {
                sourceStream: 'Nets6/Data',
                fields: {
                    NAME: 'GND',
                    UNIQUEID: 'NET-GND',
                    COLOR: '255',
                    VISIBLE: 'TRUE',
                    OVERRIDECOLORFORDRAW: 'TRUE',
                    KEEPOUT: 'FALSE',
                    LOCKED: 'TRUE',
                    USERROUTED: 'FALSE',
                    LOOPREMOVAL: 'FALSE',
                    JUMPERSVISIBLE: 'FALSE',
                    POLYGONOUTLINE: 'TRUE',
                    LAYER: 'TOP',
                    UNIONINDEX: '2'
                }
            },
            {
                sourceStream: 'Nets6/Data',
                fields: {
                    NAME: '+3V3',
                    UNIQUEID: 'NET-3V3',
                    COLOR: '65280',
                    VISIBLE: 'FALSE',
                    OVERRIDECOLORFORDRAW: 'FALSE',
                    KEEPOUT: 'TRUE',
                    LOCKED: 'FALSE',
                    USERROUTED: 'TRUE',
                    LOOPREMOVAL: 'TRUE',
                    JUMPERSVISIBLE: 'TRUE',
                    POLYGONOUTLINE: 'FALSE',
                    LAYER: 'BOTTOM',
                    UNIONINDEX: '0'
                }
            }
        ],
        {
            streamNames: ['Board6/Data', 'Nets6/Data', 'Tracks6/Data'],
            binaryPrimitives: {
                fills: [
                    {
                        x1: 10,
                        y1: 20,
                        x2: 30,
                        y2: 40,
                        layerCode: 1,
                        layerId: 1,
                        netIndex: 1
                    }
                ],
                tracks: [
                    {
                        x1: 100,
                        y1: 120,
                        x2: 200,
                        y2: 140,
                        width: 8,
                        layerCode: 1,
                        layerId: 1,
                        netIndex: 1
                    }
                ],
                arcs: [
                    {
                        x: 250,
                        y: 130,
                        radius: 40,
                        startAngle: 0,
                        endAngle: 90,
                        width: 6,
                        layerCode: 1,
                        layerId: 1,
                        netIndex: 0
                    }
                ],
                vias: [
                    {
                        x: 320,
                        y: 180,
                        diameter: 30,
                        holeDiameter: 15,
                        netIndex: 0
                    }
                ],
                pads: [
                    {
                        x: 380,
                        y: 220,
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
                        netIndex: 1
                    }
                ],
                regions: [
                    {
                        layerId: 1,
                        layerCode: 1,
                        netIndex: 0,
                        points: [
                            { x: 450, y: 200 },
                            { x: 500, y: 200 },
                            { x: 500, y: 240 },
                            { x: 450, y: 240 }
                        ],
                        holes: [],
                        properties: {}
                    }
                ],
                shapeBasedRegions: [
                    {
                        layerId: 1,
                        layerCode: 1,
                        netIndex: 1,
                        points: [
                            { x: 540, y: 200 },
                            { x: 560, y: 200 },
                            { x: 560, y: 220 },
                            { x: 540, y: 220 }
                        ],
                        holes: [],
                        properties: {}
                    }
                ],
                boardRegions: []
            },
            diagnostics: {
                printableRecordCount: 3,
                printableStreamCount: 2,
                binaryPrimitiveCount: 7
            }
        }
    )

    assert.deepEqual(documentModel.pcb.nets, [
        {
            netIndex: 0,
            name: 'GND',
            uniqueId: 'NET-GND',
            color: '#ff0000',
            visible: true,
            overrideColor: true,
            keepout: false,
            locked: true,
            userRouted: false,
            loopRemoval: false,
            jumpersVisible: false,
            polygonOutline: true,
            layer: 'TOP',
            unionIndex: 2
        },
        {
            netIndex: 1,
            name: '+3V3',
            uniqueId: 'NET-3V3',
            color: '#00ff00',
            visible: false,
            overrideColor: false,
            keepout: true,
            locked: false,
            userRouted: true,
            loopRemoval: true,
            jumpersVisible: true,
            polygonOutline: false,
            layer: 'BOTTOM',
            unionIndex: 0
        }
    ])
    assert.equal(documentModel.pcb.fills[0].netName, '+3V3')
    assert.equal(documentModel.pcb.tracks[0].netName, '+3V3')
    assert.equal(documentModel.pcb.arcs[0].netName, 'GND')
    assert.equal(documentModel.pcb.vias[0].netName, 'GND')
    assert.equal(documentModel.pcb.pads[0].netName, '+3V3')
    assert.equal(documentModel.pcb.regions[0].netName, 'GND')
    assert.equal(documentModel.pcb.shapeBasedRegions[0].netName, '+3V3')
    assert.equal(documentModel.summary.netCount, 2)
    assert.ok(
        documentModel.diagnostics.some(
            (diagnostic) =>
                diagnostic.message === 'Recovered 2 PCB net definitions.'
        )
    )
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
