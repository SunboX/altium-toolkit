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
 * Verifies source layer-stack metadata is exposed as a read-only model with
 * rigid-flex topology and electrical stack sidecars.
 */
test('PcbModelParser exposes source layer-stack topology and span metadata', () => {
    const boardRecord = createBoardRecord()

    Object.assign(boardRecord.fields, {
        V9_STACK_LAYER2_NAME: 'Dielectric A',
        V9_STACK_LAYER2_LAYERID: '2',
        V9_STACK_LAYER2_KIND: 'dielectric',
        V9_STACK_LAYER2_MATERIAL: 'FR-4',
        V9_STACK_LAYER2_THICKNESS: '58mil',
        V9_STACK_LAYER2_DK: '4.2',
        V9_STACK_LAYER2_DF: '0.018',
        V9_STACK_LAYER3_NAME: 'Bottom Layer',
        V9_STACK_LAYER3_LAYERID: '32',
        V9_STACK_LAYER3_KIND: 'signal',
        V9_STACK_LAYER3_MATERIAL: 'Copper',
        V9_STACK_LAYER3_COPPERTHICKNESS: '1.4mil',
        V9_STACK_LAYER3_COPPERWEIGHT: '1oz',
        V9_SUBSTACK0_ID: '{MAIN}',
        V9_SUBSTACK0_NAME: 'Main Stack',
        V9_SUBSTACK0_ISFLEX: 'FALSE',
        V9_SUBSTACK0_LAYERS: '1,2,32',
        V9_SUBSTACK1_ID: '{TAIL}',
        V9_SUBSTACK1_NAME: 'Flex Tail',
        V9_SUBSTACK1_ISFLEX: 'TRUE',
        V9_SUBSTACK1_LAYERS: '1,32',
        STACKBRANCH0_ID: '{BRANCH-A}',
        STACKBRANCH0_NAME: 'Branch A',
        STACKBRANCH0_ROOTSTACKREF: '{MAIN}',
        STACKBRANCH0_STACKREFS: '{MAIN};{TAIL}',
        IMPEDANCEPROFILE0_ID: '{Z0}',
        IMPEDANCEPROFILE0_NAME: 'Single 50',
        IMPEDANCEPROFILE0_TARGETIMPEDANCE: '50',
        TRANSMISSIONLINE0_ID: '{TL0}',
        TRANSMISSIONLINE0_NAME: 'Trace Width',
        TRANSMISSIONLINE0_PROFILEID: '{Z0}',
        TRANSMISSIONLINE0_LAYERID: '1',
        TRANSMISSIONLINE0_REFERENCE_LAYERID: '32',
        TRANSMISSIONLINE0_WIDTH: '6mil',
        TRANSMISSIONLINE0_GAP: '8mil',
        VIASPAN0_ID: '{VS0}',
        VIASPAN0_NAME: 'Through Span',
        VIASPAN0_STARTLAYER: '1',
        VIASPAN0_ENDLAYER: '32',
        BACKDRILLSPAN0_ID: '{BD0}',
        BACKDRILLSPAN0_NAME: 'Backdrill A',
        BACKDRILLSPAN0_STARTLAYER: '32',
        BACKDRILLSPAN0_ENDLAYER: '2',
        BACKDRILLSPAN0_TARGETSTUB: '10mil'
    })

    const documentModel = PcbModelParser.parse(
        'stack-topology.PcbDoc',
        [boardRecord],
        {
            streamNames: ['Board6/Data', 'BoardRegions/Data'],
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
                        isBoardCutout: false,
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
                            NAME: 'Tail Region',
                            LAYERSTACKID: '{TAIL}',
                            BENDINGLINECOUNT: '1',
                            BENDINGLINE0:
                                '30;200000;0;1000000;2000000;1100000;2100000'
                        }
                    }
                ]
            },
            diagnostics: {
                printableRecordCount: 1,
                printableStreamCount: 2,
                binaryPrimitiveCount: 1
            }
        }
    )

    assert.equal(
        documentModel.pcb.layerStackReadModel.schema,
        'altium-toolkit.pcb.layer-stack.a1'
    )
    assert.deepEqual(documentModel.pcb.layerStackReadModel.summary, {
        layerCount: 3,
        substackCount: 2,
        boardRegionCount: 1,
        branchCount: 1,
        impedanceProfileCount: 1,
        transmissionLineCount: 1,
        viaSpanCount: 1,
        backdrillSpanCount: 1,
        topLevelBendLineCount: 0,
        cavityRegionCount: 0,
        stiffenerLayerCount: 0,
        adhesiveLayerCount: 0,
        diagnosticCount: 0
    })
    assert.deepEqual(documentModel.pcb.layerStackReadModel.source, {
        fileName: 'stack-topology.PcbDoc',
        nativeStreams: ['Board6/Data'],
        hasNativeBoardData: true,
        hasBoardRegionsData: true
    })
    assert.deepEqual(documentModel.pcb.layerStackReadModel.layers, [
        {
            index: 1,
            layerId: 1,
            layerKey: 'L1',
            name: 'Top Layer'
        },
        {
            index: 2,
            layerId: 2,
            layerKey: 'L2',
            name: 'Dielectric A',
            kind: 'dielectric',
            material: 'FR-4',
            thicknessMil: 58,
            dielectricConstant: 4.2,
            dissipationFactor: 0.018
        },
        {
            index: 3,
            layerId: 32,
            layerKey: 'L32',
            name: 'Bottom Layer',
            kind: 'signal',
            material: 'Copper',
            copperThicknessMil: 1.4,
            copperWeight: '1oz'
        }
    ])
    assert.deepEqual(documentModel.pcb.layerStackReadModel.substacks, [
        {
            index: 0,
            id: '{MAIN}',
            name: 'Main Stack',
            isFlex: false,
            layerIds: [1, 2, 32],
            layerKeys: ['L1', 'L2', 'L32'],
            boardRegionIndexes: [],
            boardRegionNames: [],
            bendingLineCount: 0
        },
        {
            index: 1,
            id: '{TAIL}',
            name: 'Flex Tail',
            isFlex: true,
            layerIds: [1, 32],
            layerKeys: ['L1', 'L32'],
            boardRegionIndexes: [0],
            boardRegionNames: ['Tail Region'],
            bendingLineCount: 1
        }
    ])
    assert.deepEqual(documentModel.pcb.layerStackReadModel.branches, [
        {
            index: 0,
            id: '{BRANCH-A}',
            name: 'Branch A',
            rootStackRef: '{MAIN}',
            stackRefs: ['{MAIN}', '{TAIL}']
        }
    ])
    assert.deepEqual(documentModel.pcb.layerStackReadModel.impedanceProfiles, [
        {
            index: 0,
            id: '{Z0}',
            name: 'Single 50',
            targetImpedanceOhm: 50
        }
    ])
    assert.deepEqual(documentModel.pcb.layerStackReadModel.transmissionLines, [
        {
            index: 0,
            id: '{TL0}',
            name: 'Trace Width',
            profileId: '{Z0}',
            layerId: 1,
            layerKey: 'L1',
            referenceLayerId: 32,
            referenceLayerKey: 'L32',
            widthMil: 6,
            gapMil: 8
        }
    ])
    assert.deepEqual(documentModel.pcb.layerStackReadModel.viaSpans, [
        {
            index: 0,
            id: '{VS0}',
            name: 'Through Span',
            startLayerId: 1,
            startLayerKey: 'L1',
            endLayerId: 32,
            endLayerKey: 'L32'
        }
    ])
    assert.deepEqual(documentModel.pcb.layerStackReadModel.backdrillSpans, [
        {
            index: 0,
            id: '{BD0}',
            name: 'Backdrill A',
            startLayerId: 32,
            startLayerKey: 'L32',
            endLayerId: 2,
            endLayerKey: 'L2',
            targetStubMil: 10
        }
    ])
    assert.equal(
        documentModel.pcb.rigidFlexTopology.schema,
        'altium-toolkit.pcb.rigid-flex-topology.a1'
    )
    assert.deepEqual(documentModel.pcb.rigidFlexTopology.summary, {
        substackCount: 2,
        flexSubstackCount: 1,
        boardRegionCount: 1,
        branchCount: 1,
        bendLineCount: 1,
        diagnosticCount: 0
    })
    assert.deepEqual(documentModel.pcb.rigidFlexTopology.substackRegionJoins, [
        {
            substackId: '{MAIN}',
            substackName: 'Main Stack',
            isFlex: false,
            layerKeys: ['L1', 'L2', 'L32'],
            regionIndexes: [],
            regionNames: []
        },
        {
            substackId: '{TAIL}',
            substackName: 'Flex Tail',
            isFlex: true,
            layerKeys: ['L1', 'L32'],
            regionIndexes: [0],
            regionNames: ['Tail Region']
        }
    ])
    assert.deepEqual(documentModel.pcb.rigidFlexTopology.branchGraph, [
        {
            branchId: '{BRANCH-A}',
            branchName: 'Branch A',
            rootStackRef: '{MAIN}',
            stackRefs: ['{MAIN}', '{TAIL}'],
            childSubstacks: [
                { id: '{MAIN}', name: 'Main Stack', isFlex: false },
                { id: '{TAIL}', name: 'Flex Tail', isFlex: true }
            ]
        }
    ])
    assert.equal(documentModel.summary.layerStackBranchCount, 1)
    assert.equal(documentModel.summary.impedanceProfileCount, 1)
    assert.equal(documentModel.summary.backdrillSpanCount, 1)
})

/**
 * Verifies richer layer-stack source evidence remains available for QA reports.
 */
test('PcbModelParser preserves rich layer-stack source evidence', () => {
    const boardRecord = createBoardRecord()

    Object.assign(boardRecord.fields, {
        V9_STACK_LAYER1_KIND: 'signal',
        V9_STACK_LAYER1_FAMILY: 'copper',
        V9_STACK_LAYER1_SOURCE_RECORD_ID: '{LAYER-TOP}',
        V9_STACK_LAYER1_SOURCE_KEYS: 'StackCustomData;Layer1',
        V9_STACK_LAYER1_REGISTRYREF: '{REG-TOP}',
        V9_STACK_LAYER1_MODELID: 'SignalTop',
        V9_STACK_LAYER1_ALIASES: 'Top;Signal 1',
        V9_STACK_LAYER1_MATERIALCOLOR: '#cc8844',
        V9_STACK_LAYER1_SURFACEFINISH: 'ENIG',
        V9_STACK_LAYER1_PLATING: '1.2um',
        V9_STACK_LAYER1_STACKUPX_PROPERTIES:
            'Process=Etch|Material=Copper|Weight=1oz',
        V9_STACK_LAYER2_NAME: 'Bond Ply',
        V9_STACK_LAYER2_LAYERID: '2',
        V9_STACK_LAYER2_KIND: 'dielectric',
        V9_STACK_LAYER2_FAMILY: 'dielectric',
        V9_STACK_LAYER2_MATERIAL: 'Polyimide',
        V9_STACK_LAYER2_THICKNESS: '2mil',
        V9_STACK_LAYER2_DK: '3.4',
        V9_STACK_LAYER2_DF: '0.004',
        V9_STACK_LAYER2_ISADHESIVE: 'TRUE',
        V9_STACK_LAYER2_COVERLAYEXPANSION: '3mil',
        V9_STACK_LAYER2_SHARED: 'FALSE',
        V9_STACK_LAYER2_SUBSTACK0_ENABLED: 'TRUE',
        V9_STACK_LAYER2_SUBSTACK1_ENABLED: 'FALSE',
        V9_STACK_LAYER3_NAME: 'Stiffener',
        V9_STACK_LAYER3_LAYERID: '90',
        V9_STACK_LAYER3_KIND: 'mechanical',
        V9_STACK_LAYER3_ISSTIFFENER: 'TRUE',
        V9_SUBSTACK0_ID: '{MAIN}',
        V9_SUBSTACK0_NAME: 'Main Stack',
        V9_SUBSTACK0_ISFLEX: 'FALSE',
        V9_SUBSTACK0_LAYERS: '1,2,90',
        V9_SUBSTACK0_STACKUPX_ISFLEX: 'FALSE',
        V9_SUBSTACK0_STACKUPX_STACKTYPE: 'Rigid',
        V9_SUBSTACK1_ID: '{TAIL}',
        V9_SUBSTACK1_NAME: 'Flex Tail',
        V9_SUBSTACK1_ISFLEX: 'TRUE',
        V9_SUBSTACK1_LAYERS: '1,2',
        V9_SUBSTACK1_STACKUPX_ISFLEX: 'TRUE',
        V9_SUBSTACK1_STACKUPX_STACKTYPE: 'Flex',
        STACKBRANCH0_ID: '{BRANCH-A}',
        STACKBRANCH0_NAME: 'Branch A',
        STACKBRANCH0_DESCRIPTION: 'Demo branch',
        STACKBRANCH0_PARENTBRANCHID: '{ROOT}',
        STACKBRANCH0_ROOTSTACKREF: '{MAIN}',
        STACKBRANCH0_STACKREFS: '{MAIN};{TAIL}',
        STACKBRANCH0_SECTION0_ID: '{SEC-A}',
        STACKBRANCH0_SECTION0_NAME: 'Entry',
        STACKBRANCH0_SECTION0_PARENTID: '{SEC-ROOT}',
        STACKBRANCH0_SECTION0_STACK0_REF: '{MAIN}',
        STACKBRANCH0_SECTION0_STACK0_MATERIALUSAGE: 'base',
        STACKBRANCH0_SECTION0_STACK0_SOURCE: 'native',
        STACKBRANCH0_SECTION0_STACK0_PARENTLAYERID: '{LAYER-TOP}',
        STACKBRANCH0_SECTION0_STACK0_SOURCELAYERID: '{LAYER-TOP}',
        STACKBRANCH0_SECTION0_STACK0_INTRUSIONLEFTBOTTOM: '4mil',
        STACKBRANCH0_SECTION0_STACK0_INTRUSIONLEFTTOP: '5mil',
        STACKBRANCH0_SECTION0_STACK0_INTRUSIONRIGHTBOTTOM: '6mil',
        STACKBRANCH0_SECTION0_STACK0_INTRUSIONRIGHTTOP: '7mil',
        BOARD_BENDLINE0:
            '15;100000;1;1000000;2000000;1100000;2100000;Fold A;active;Tail Region',
        IMPEDANCEPROFILE0_ID: '{Z0}',
        IMPEDANCEPROFILE0_NAME: 'Diff 90',
        IMPEDANCEPROFILE0_TYPE: 'Differential',
        IMPEDANCEPROFILE0_TYPERAW: '2',
        IMPEDANCEPROFILE0_TARGETIMPEDANCE: '90',
        IMPEDANCEPROFILE0_TOLERANCE: '10%',
        IMPEDANCEPROFILE0_TRANSMISSIONLINECOUNT: '1',
        TRANSMISSIONLINE0_ID: '{TL0}',
        TRANSMISSIONLINE0_NAME: 'Diff Width',
        TRANSMISSIONLINE0_PROFILEID: '{Z0}',
        TRANSMISSIONLINE0_SUBSTACKID: '{TAIL}',
        TRANSMISSIONLINE0_LAYERID: '1',
        TRANSMISSIONLINE0_TOPREFID: 'air',
        TRANSMISSIONLINE0_BOTTOMREFID: '2',
        TRANSMISSIONLINE0_WIDTH: '5mil',
        TRANSMISSIONLINE0_GAP: '6mil',
        TRANSMISSIONLINE0_ISDIFFERENTIAL: 'TRUE',
        TRANSMISSIONLINE0_CALCMODE: 'field',
        TRANSMISSIONLINE0_CALCMODERAW: '3',
        TRANSMISSIONLINE0_IMPEDANCEERROR: '0.5',
        TRANSMISSIONLINE0_TLTYPENAME: 'Edge coupled',
        TRANSMISSIONLINE0_HASPLATING: 'TRUE',
        TRANSMISSIONLINE0_USESOLDERMASK: 'FALSE',
        TRANSMISSIONLINE0_COATEDHEIGHT1: '1mil',
        TRANSMISSIONLINE0_COATEDHEIGHT2: '2mil',
        TRANSMISSIONLINE0_CLEARANCETOPLANE: '8mil',
        TRANSMISSIONLINE0_ELECTRICPARAMETERS: 'ErEff=3.1|Delay=145ps'
    })

    const documentModel = PcbModelParser.parse(
        'rich-stack.PcbDoc',
        [boardRecord],
        {
            streamNames: ['Board6/Data', 'BoardRegions/Data'],
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
                        isBoardCutout: false,
                        isShapeBased: false,
                        points: [],
                        holes: [],
                        properties: {
                            OBJECTKIND: 'BoardRegion',
                            NAME: 'Tail Region',
                            LAYERSTACKID: '{TAIL}',
                            CAVITYHEIGHT: '9mil',
                            BENDINGLINECOUNT: '0'
                        }
                    }
                ]
            },
            diagnostics: {
                printableRecordCount: 1,
                printableStreamCount: 2,
                binaryPrimitiveCount: 1
            }
        }
    )

    assert.deepEqual(documentModel.pcb.layerStackReadModel.sourceMap, {
        registryEntryCount: 1,
        sourceKeyCount: 2,
        topLevelBendLineCount: 1,
        cavityRegionCount: 1,
        stiffenerLayerCount: 1,
        adhesiveLayerCount: 1,
        surfaceFinishCount: 1
    })
    assert.deepEqual(documentModel.pcb.layerStackReadModel.layers[0], {
        index: 1,
        layerId: 1,
        layerKey: 'L1',
        name: 'Top Layer',
        kind: 'signal',
        family: 'copper',
        sourceRecordId: '{LAYER-TOP}',
        sourceKeys: ['StackCustomData', 'Layer1'],
        registryRef: '{REG-TOP}',
        modelId: 'SignalTop',
        aliases: ['Top', 'Signal 1'],
        materialColor: '#cc8844',
        surfaceFinish: 'ENIG',
        plating: '1.2um',
        stackupxProperties: {
            Process: 'Etch',
            Material: 'Copper',
            Weight: '1oz'
        }
    })
    assert.equal(
        documentModel.pcb.layerStackReadModel.layers[1].isAdhesive,
        true
    )
    assert.equal(
        documentModel.pcb.layerStackReadModel.layers[1].coverlayExpansion,
        '3mil'
    )
    assert.deepEqual(
        documentModel.pcb.layerStackReadModel.layers[1].substackEnablement,
        [
            { substackIndex: 0, enabled: true },
            { substackIndex: 1, enabled: false }
        ]
    )
    assert.equal(
        documentModel.pcb.layerStackReadModel.layers[2].isStiffener,
        true
    )
    assert.deepEqual(documentModel.pcb.layerStackReadModel.topLevelBendLines, [
        {
            index: 0,
            raw: '15;100000;1;1000000;2000000;1100000;2100000;Fold A;active;Tail Region',
            angleDeg: 15,
            radiusRaw: 100000,
            radiusMil: 10,
            foldIndex: 1,
            name: 'Fold A',
            stateRaw: 'active',
            regionName: 'Tail Region'
        }
    ])
    assert.deepEqual(documentModel.pcb.layerStackReadModel.cavityReport, {
        cavityRegionCount: 1,
        stiffenerLayerCount: 1,
        adhesiveLayerCount: 1,
        cavityRegions: [
            {
                regionIndex: 0,
                name: 'Tail Region',
                layerStackId: '{TAIL}',
                cavityHeight: '9mil'
            }
        ],
        stiffenerLayers: ['Stiffener'],
        adhesiveLayers: ['Bond Ply']
    })
    assert.deepEqual(
        documentModel.pcb.layerStackReadModel.branches[0].sections,
        [
            {
                index: 0,
                id: '{SEC-A}',
                name: 'Entry',
                parentSectionId: '{SEC-ROOT}',
                stacks: [
                    {
                        index: 0,
                        stackRef: '{MAIN}',
                        materialUsage: 'base',
                        source: 'native',
                        parentLayerId: '{LAYER-TOP}',
                        sourceLayerId: '{LAYER-TOP}',
                        intrusionLeftBottom: '4mil',
                        intrusionLeftTop: '5mil',
                        intrusionRightBottom: '6mil',
                        intrusionRightTop: '7mil'
                    }
                ]
            }
        ]
    )
    assert.deepEqual(
        documentModel.pcb.layerStackReadModel.impedanceProfiles[0],
        {
            index: 0,
            id: '{Z0}',
            name: 'Diff 90',
            targetImpedanceOhm: 90,
            kind: 'Differential',
            profileTypeRaw: 2,
            tolerance: '10%',
            transmissionLineCount: 1
        }
    )
    assert.equal(
        documentModel.pcb.layerStackReadModel.transmissionLines[0]
            .isDifferential,
        true
    )
    assert.deepEqual(
        documentModel.pcb.layerStackReadModel.transmissionLines[0]
            .electricParameters,
        { ErEff: '3.1', Delay: '145ps' }
    )
    assert.deepEqual(
        documentModel.pcb.rigidFlexTopology.branchGraph[0].sections,
        documentModel.pcb.layerStackReadModel.branches[0].sections
    )
    assert.equal(documentModel.summary.cavityRegionCount, 1)
    assert.equal(documentModel.summary.stiffenerLayerCount, 1)
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
