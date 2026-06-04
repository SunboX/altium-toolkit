// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies implementation records are exposed as component-owned model links
 * with target-library and search-path metadata.
 */
test('parseAltiumArrayBuffer exposes schematic implementation links', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=1|IndexInSheet=20|Location.X=80|Location.Y=80|LibReference=CTRL_CORE|UniqueID=CMP-1' +
            '|RECORD=44|IndexInSheet=30|OwnerIndex=20' +
            '|RECORD=45|IndexInSheet=31|OwnerIndex=30|ModelName=CTRL_FOOTPRINT|ModelType=PCB|Description=Main footprint|IsCurrent=T' +
            '|DatafileCount=2|ModelDatafileEntity0=LocalFootprints|ModelDatafileKind0=PCBLib' +
            '|ModelDatafileEntity1=SharedModels|ModelDatafileKind1=IntLib|SearchPathCount=2' +
            '|SearchPath0=Project/Footprints|SearchPath1=Library/Vault' +
            '|RECORD=47|OwnerIndex=31|DesIntf=A1|DesImpCount=2|DesImp0=1|DesImp1=2' +
            '|RECORD=48|OwnerIndex=31|Name=Lifecycle|Text=Released'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'implementation-links.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.implementations, {
        schema: 'altium-toolkit.schematic.implementations.a1',
        components: [
            {
                componentKey: 'schematic-component-20',
                recordKey: 'schematic-record-1',
                uniqueId: 'CMP-1',
                libReference: 'CTRL_CORE',
                implementationKeys: ['schematic-implementation-31']
            }
        ],
        implementations: [
            {
                key: 'schematic-implementation-31',
                recordKey: 'schematic-record-3',
                ownerComponentKey: 'schematic-component-20',
                ownerListKey: 'schematic-implementation-list-30',
                modelName: 'CTRL_FOOTPRINT',
                modelType: 'pcb',
                description: 'Main footprint',
                isCurrent: true,
                targetLibraries: [
                    {
                        index: 0,
                        entity: 'LocalFootprints',
                        kind: 'pcblib',
                        fileName: 'LocalFootprints.PcbLib'
                    },
                    {
                        index: 1,
                        entity: 'SharedModels',
                        kind: 'intlib',
                        fileName: 'SharedModels.IntLib'
                    }
                ],
                searchPaths: ['Project/Footprints', 'Library/Vault'],
                mapDefiners: [
                    {
                        recordKey: 'schematic-record-4',
                        designatorInterface: 'A1',
                        implementationDesignators: ['1', '2']
                    }
                ],
                parameters: [
                    {
                        recordKey: 'schematic-record-5',
                        name: 'Lifecycle',
                        value: 'Released'
                    }
                ]
            }
        ]
    })
    assert.deepEqual(documentModel.schematic.bindings, {
        schema: 'altium-toolkit.schematic.bindings.a1',
        summary: {
            componentCount: 1,
            resolvedCount: 1,
            unresolvedCount: 0,
            staleCount: 0,
            externalCount: 0
        },
        components: [
            {
                componentKey: 'schematic-component-20',
                recordKey: 'schematic-record-1',
                uniqueId: 'CMP-1',
                libReference: 'CTRL_CORE',
                status: 'resolved',
                implementationKeys: ['schematic-implementation-31'],
                targetLibraries: [
                    {
                        entity: 'LocalFootprints',
                        kind: 'pcblib',
                        fileName: 'LocalFootprints.PcbLib'
                    },
                    {
                        entity: 'SharedModels',
                        kind: 'intlib',
                        fileName: 'SharedModels.IntLib'
                    }
                ],
                reasons: []
            }
        ]
    })
})

/**
 * Verifies cross-sheet connectors join the local net model and repeated sheet
 * entries expose hierarchy-aware aliases.
 */
test('parseAltiumArrayBuffer exposes cross-sheet connectors and repeated-channel aliases', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=400|CustomY=240|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=15|IndexInSheet=40|Location.X=180|Location.Y=120|XSize=90|YSize=60|Name=REPEAT(CH, 1, 3)|Designator=$ChannelPrefix$ChannelIndex' +
            '|RECORD=16|OwnerIndex=40|Name=REPEAT(DATA)|Side=0|DistanceFromTop=1|IOType=2|Style=0' +
            '|RECORD=17|IndexInSheet=50|Location.X=70|Location.Y=80|Text=DATA|Style=1|IsCrossSheetConnector=T|Color=255' +
            '|RECORD=27|LocationCount=2|X1=70|Y1=80|X2=150|Y2=80|Color=128|LineWidth=1' +
            '|RECORD=2|OwnerIndex=90|OwnerPartID=1|PinConglomerate=58|PinLength=20|Location.X=150|Location.Y=80|Name=DATA|Designator=1'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'cross-sheet-repeat.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.crossSheetConnectors, {
        schema: 'altium-toolkit.schematic.cross-sheet-connectors.a1',
        connectors: [
            {
                key: 'cross-sheet-connector-50',
                recordKey: 'schematic-record-3',
                recordId: 'record-50',
                name: 'DATA',
                x: 70,
                y: 80,
                style: 'right',
                color: '#ff0000'
            }
        ]
    })
    assert.deepEqual(documentModel.schematic.repeatedChannels, {
        schema: 'altium-toolkit.schematic.repeated-channels.a1',
        rooms: [
            {
                key: 'repeated-channel-40',
                sheetSymbolKey: 'schematic-record-1',
                channelName: 'CH',
                startIndex: 1,
                endIndex: 3,
                designatorTemplate: '$ChannelPrefix$ChannelIndex',
                instances: [
                    {
                        index: 1,
                        alpha: 'A',
                        channelPrefix: 'CH',
                        designator: 'CH1',
                        hierarchyPath: 'CH1'
                    },
                    {
                        index: 2,
                        alpha: 'B',
                        channelPrefix: 'CH',
                        designator: 'CH2',
                        hierarchyPath: 'CH2'
                    },
                    {
                        index: 3,
                        alpha: 'C',
                        channelPrefix: 'CH',
                        designator: 'CH3',
                        hierarchyPath: 'CH3'
                    }
                ]
            }
        ],
        netAliases: [
            {
                key: 'repeated-channel-net-2',
                sheetEntryKey: 'schematic-record-2',
                sheetSymbolKey: 'schematic-record-1',
                baseName: 'DATA',
                aliases: ['CH1/DATA', 'CH2/DATA', 'CH3/DATA'],
                hierarchyPaths: ['CH1', 'CH2', 'CH3']
            }
        ]
    })
    assert.deepEqual(documentModel.schematic.nets[0].crossSheetConnectors, [
        {
            key: 'cross-sheet-connector-50',
            name: 'DATA',
            x: 70,
            y: 80,
            style: 'right'
        }
    ])
})

/**
 * Verifies the read-only schematic QA report surfaces deterministic styling
 * and parameter-resolution findings without editing document data.
 */
test('parseAltiumArrayBuffer exposes schematic QA report', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=9|FontName2=Courier New|Bold2=T|Rotation2=0' +
            '|RECORD=41|Name=Title|Text==MissingTitle|IsHidden=T' +
            '|RECORD=4|Location.X=40|Location.Y=120|Color=255|FontID=2|Text==MissingVisible' +
            '|RECORD=13|Location.X=20|Location.Y=40|Corner.X=100|Corner.Y=40|LineWidth=3|Color=65280'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'qa-report.SchDoc',
        arrayBuffer
    )

    assert.equal(
        documentModel.schematic.qa.schema,
        'altium-toolkit.schematic.qa.a1'
    )
    assert.deepEqual(documentModel.schematic.qa.summary, {
        recordCount: 4,
        fontFamilyCount: 2,
        colorCount: 2,
        lineWidthCount: 1,
        unresolvedParameterCount: 2,
        findingCount: 3
    })
    assert.deepEqual(documentModel.schematic.qa.unresolvedParameters, [
        'MissingTitle',
        'MissingVisible'
    ])
    assert.deepEqual(documentModel.schematic.qa.fonts.families, [
        'Courier New',
        'Times New Roman'
    ])
    assert.equal(
        documentModel.schematic.qa.findings.some(
            (finding) => finding.code === 'schematic.text.unresolved-parameter'
        ),
        true
    )
})

/**
 * Verifies malformed schematic font families produce structured render
 * diagnostics without changing the stable sheet font table shape.
 */
test('parseAltiumArrayBuffer exposes schematic font fallback diagnostics', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=240|CustomY=160|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Bad"Family|Bold1=F|Rotation1=0' +
            '|Size2=10|FontName2=Arial|Bold2=F|Rotation2=0' +
            '|RECORD=4|Location.X=40|Location.Y=80|Color=128|FontID=1|Text=FALLBACK'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'font-fallback-diagnostics.SchDoc',
        arrayBuffer
    )

    assert.equal(
        documentModel.schematic.sheet.fonts['1'].family,
        'Times New Roman'
    )
    assert.deepEqual(documentModel.schematic.renderDiagnostics, {
        schema: 'altium-toolkit.schematic.render-diagnostics.a1',
        fontFallbacks: [
            {
                code: 'schematic.font.family-fallback',
                severity: 'warning',
                fontId: '1',
                sourceFamily: 'Bad"Family',
                resolvedFamily: 'Times New Roman',
                message:
                    'Schematic font family was missing or malformed and was replaced for deterministic SVG rendering.'
            }
        ]
    })
    assert.ok(
        documentModel.diagnostics.some(
            (diagnostic) =>
                diagnostic.code === 'schematic.font.family-fallback' &&
                diagnostic.fontId === '1'
        )
    )
})

/**
 * Verifies component display modes and alternate parts are catalogued even
 * when normal rendering filters to the active part.
 */
test('parseAltiumArrayBuffer exposes schematic component display-mode catalog', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=1|IndexInSheet=20|Location.X=80|Location.Y=80|LibReference=CTRL_MODE|UniqueID=CMP-MODE' +
            '|PartCount=2|DisplayModeCount=2|CurrentPartId=2|PartIDLocked=T|AllPinCount=3' +
            '|RECORD=2|OwnerIndex=20|OwnerPartID=1|OwnerPartDisplayMode=1|PinConglomerate=58|PinLength=20|Location.X=100|Location.Y=70|Name=A_IN|Designator=1' +
            '|RECORD=2|OwnerIndex=20|OwnerPartID=2|OwnerPartDisplayMode=1|PinConglomerate=58|PinLength=20|Location.X=100|Location.Y=90|Name=B_IN|Designator=1' +
            '|RECORD=2|OwnerIndex=20|OwnerPartID=2|OwnerPartDisplayMode=2|PinConglomerate=58|PinLength=20|Location.X=100|Location.Y=110|Name=B_ALT|Designator=2' +
            '|RECORD=13|OwnerIndex=20|OwnerPartID=2|OwnerPartDisplayMode=2|Location.X=75|Location.Y=65|Corner.X=125|Corner.Y=115|Color=255|LineWidth=1'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'display-mode-catalog.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.displayModes, {
        schema: 'altium-toolkit.schematic.display-modes.a1',
        components: [
            {
                componentKey: 'schematic-component-20',
                recordKey: 'schematic-record-1',
                uniqueId: 'CMP-MODE',
                libReference: 'CTRL_MODE',
                partCount: 2,
                displayModeCount: 2,
                currentPartId: 2,
                partIdLocked: true,
                allPinCount: 3,
                parts: [
                    {
                        partId: 1,
                        isCurrent: false,
                        primitiveCount: 1,
                        pinCount: 1,
                        displayModes: [
                            {
                                displayMode: 1,
                                isActive: false,
                                primitiveCount: 1,
                                pinCount: 1
                            }
                        ]
                    },
                    {
                        partId: 2,
                        isCurrent: true,
                        primitiveCount: 3,
                        pinCount: 2,
                        displayModes: [
                            {
                                displayMode: 1,
                                isActive: true,
                                primitiveCount: 1,
                                pinCount: 1
                            },
                            {
                                displayMode: 2,
                                isActive: false,
                                primitiveCount: 2,
                                pinCount: 1
                            }
                        ]
                    }
                ]
            }
        ]
    })
})

/**
 * Verifies read-only connectivity QA reports disconnected named objects,
 * implicit names, unconnected pins, and unused authored junctions.
 */
test('parseAltiumArrayBuffer exposes schematic connectivity QA graph', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=320|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=27|LocationCount=2|X1=40|Y1=40|X2=120|Y2=40|Color=128|LineWidth=1' +
            '|RECORD=25|Location.X=80|Location.Y=40|Text=GOOD|Color=255|FontID=1' +
            '|RECORD=2|OwnerIndex=20|OwnerPartID=1|PinConglomerate=58|PinLength=20|Location.X=120|Location.Y=40|Name=IN|Designator=1' +
            '|RECORD=27|LocationCount=2|X1=40|Y1=90|X2=120|Y2=90|Color=128|LineWidth=1' +
            '|RECORD=25|Location.X=230|Location.Y=40|Text=FLOATING|Color=255|FontID=1' +
            '|RECORD=18|Location.X=230|Location.Y=70|Width=40|Name=ORPHAN|IOType=3|Alignment=0' +
            '|RECORD=2|OwnerIndex=30|OwnerPartID=1|PinConglomerate=58|PinLength=20|Location.X=230|Location.Y=110|Name=NC|Designator=2' +
            '|RECORD=29|Location.X=250|Location.Y=140|Color=128'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'connectivity-qa.SchDoc',
        arrayBuffer
    )

    assert.equal(
        documentModel.schematic.connectivityQa.schema,
        'altium-toolkit.schematic.connectivity-qa.a1'
    )
    assert.deepEqual(documentModel.schematic.connectivityQa.summary, {
        netCount: 2,
        findingCount: 5,
        danglingLabelCount: 1,
        orphanPortCount: 1,
        unconnectedPinCount: 1,
        implicitNetCount: 1,
        ambiguousJunctionCount: 1
    })
    assert.deepEqual(
        documentModel.schematic.connectivityQa.findings.map(
            (finding) => finding.code
        ),
        [
            'schematic.connectivity.implicit-net-name',
            'schematic.connectivity.dangling-label',
            'schematic.connectivity.orphan-port',
            'schematic.connectivity.unconnected-pin',
            'schematic.connectivity.ambiguous-junction'
        ]
    )
})
