// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Verifies board-planning regions carry rigid-flex semantics in addition to
 * their decoded contour geometry.
 */
test('PcbModelParser resolves board-region substacks and bending lines', () => {
    const boardRecord = createBoardRecord()

    Object.assign(boardRecord.fields, {
        V9_SUBSTACK0_ID: '{RIGID-STACK}',
        V9_SUBSTACK0_NAME: 'Rigid Stack',
        V9_SUBSTACK0_ISFLEX: 'FALSE',
        V9_SUBSTACK0_SHOWTOPDIELECTRIC: 'TRUE',
        V9_SUBSTACK0_SHOWBOTTOMDIELECTRIC: 'FALSE',
        V9_SUBSTACK0_SERVICE: 'FALSE',
        V9_SUBSTACK0_USEDBYPRIMS: 'TRUE',
        V9_SUBSTACK0_TYPE: '1',
        V9_SUBSTACK1_ID: '{FLEX-STACK}',
        V9_SUBSTACK1_NAME: 'Flex Tail',
        V9_SUBSTACK1_ISFLEX: 'TRUE',
        V9_SUBSTACK1_SHOWTOPDIELECTRIC: 'FALSE',
        V9_SUBSTACK1_SHOWBOTTOMDIELECTRIC: 'TRUE',
        V9_SUBSTACK1_SERVICE: 'FALSE',
        V9_SUBSTACK1_USEDBYPRIMS: 'TRUE',
        V9_SUBSTACK1_TYPE: '2'
    })

    const documentModel = PcbModelParser.parse(
        'rigid-flex.PcbDoc',
        [boardRecord],
        {
            streamNames: ['BoardRegions/Data'],
            binaryPrimitives: {
                fills: [],
                tracks: [],
                arcs: [],
                vias: [],
                pads: [],
                texts: [],
                regions: [],
                shapeBasedRegions: [],
                boardRegions: [
                    {
                        layerId: 0,
                        layerCode: 0,
                        netIndex: null,
                        polygonIndex: null,
                        componentIndex: null,
                        kind: 0,
                        isKeepout: true,
                        isBoardCutout: true,
                        isShapeBased: false,
                        points: [
                            { x: 100, y: 150 },
                            { x: 450, y: 150 },
                            { x: 450, y: 300 },
                            { x: 100, y: 300 }
                        ],
                        holes: [],
                        properties: {
                            OBJECTKIND: 'BoardRegion',
                            NAME: 'Flex Tail Region',
                            LAYERSTACKID: '{FLEX-STACK}',
                            LOCKED3D: 'TRUE',
                            CAVITYHEIGHT: '2mil',
                            V7_LAYER: 'MULTILAYER',
                            LAYER: 'KEEPOUT',
                            ARCRESOLUTION: '0.5mil',
                            BENDINGLINECOUNT: '1',
                            BENDINGLINE0:
                                '45;250000;2;1000000;2000000;1100000;2100000'
                        }
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

    assert.deepEqual(documentModel.pcb.layerSubstacks, [
        {
            index: 0,
            fieldFamily: 'v9',
            id: '{RIGID-STACK}',
            name: 'Rigid Stack',
            isFlex: false,
            showTopDielectric: true,
            showBottomDielectric: false,
            serviceStackup: false,
            usedByPrimitives: true,
            rawStackupType: '1'
        },
        {
            index: 1,
            fieldFamily: 'v9',
            id: '{FLEX-STACK}',
            name: 'Flex Tail',
            isFlex: true,
            showTopDielectric: false,
            showBottomDielectric: true,
            serviceStackup: false,
            usedByPrimitives: true,
            rawStackupType: '2'
        }
    ])
    assert.deepEqual(documentModel.pcb.boardRegionContexts, [
        {
            regionIndex: 0,
            name: 'Flex Tail Region',
            layerStackId: '{FLEX-STACK}',
            substackIndex: 1,
            substackName: 'Flex Tail',
            isFlex: true,
            locked3d: true,
            bendingLineCount: 1
        }
    ])
    assert.deepEqual(
        {
            name: documentModel.pcb.boardRegions[0].name,
            objectKind: documentModel.pcb.boardRegions[0].objectKind,
            layerStackId: documentModel.pcb.boardRegions[0].layerStackId,
            substackIndex: documentModel.pcb.boardRegions[0].substackIndex,
            substackName: documentModel.pcb.boardRegions[0].substackName,
            isFlexRegion: documentModel.pcb.boardRegions[0].isFlexRegion,
            isRigidRegion: documentModel.pcb.boardRegions[0].isRigidRegion,
            locked3d: documentModel.pcb.boardRegions[0].locked3d,
            bendingLineCount:
                documentModel.pcb.boardRegions[0].bendingLineCount,
            bendingLines: documentModel.pcb.boardRegions[0].bendingLines
        },
        {
            name: 'Flex Tail Region',
            objectKind: 'BoardRegion',
            layerStackId: '{FLEX-STACK}',
            substackIndex: 1,
            substackName: 'Flex Tail',
            isFlexRegion: true,
            isRigidRegion: false,
            locked3d: true,
            bendingLineCount: 1,
            bendingLines: [
                {
                    index: 0,
                    raw: '45;250000;2;1000000;2000000;1100000;2100000',
                    angleDeg: 45,
                    radiusRaw: 250000,
                    radiusMil: 25,
                    affectedWidthMil: 19.634954,
                    foldIndex: 2,
                    x1Raw: 1000000,
                    y1Raw: 2000000,
                    x2Raw: 1100000,
                    y2Raw: 2100000,
                    x1: 100,
                    y1: 300,
                    x2: 110,
                    y2: 290
                }
            ]
        }
    )
    assert.equal(documentModel.summary.boardRegionCount, 1)
    assert.equal(documentModel.summary.flexRegionCount, 1)
    assert.equal(documentModel.summary.bendingLineCount, 1)
    assert.deepEqual(documentModel.pcb.statistics.planning, {
        keepouts: {
            totalCount: 1,
            regionCount: 0,
            shapeBasedRegionCount: 0,
            boardRegionCount: 1
        },
        rooms: {
            ruleCount: 0,
            namedRoomCount: 0,
            names: []
        },
        boardRegions: {
            boardRegionCount: 1,
            flexRegionCount: 1,
            rigidRegionCount: 0,
            locked3dCount: 1,
            bendingLineCount: 1,
            layerStacks: {
                'Flex Tail': 1
            }
        }
    })
    assert.ok(
        documentModel.diagnostics.some(
            (diagnostic) =>
                diagnostic.message ===
                'Recovered 1 board planning region and 1 bending line.'
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
