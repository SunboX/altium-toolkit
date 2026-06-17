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

test('parseAltiumArrayBuffer exposes schematic image diagnostics', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=30|IndexInSheet=10|Location.X=20|Location.Y=30|Corner.X=120|Corner.Y=80' +
            '|EmbedImage=F|KeepAspect=T|FileName=linked-diagram.png' +
            '|RECORD=30|IndexInSheet=11|Location.X=130|Location.Y=30|Corner.X=180|Corner.Y=80' +
            '|EmbedImage=T|KeepAspect=T|FileName=missing-icon.bmp'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'image-diagnostics.SchDoc',
        arrayBuffer
    )

    assert.equal(
        documentModel.schematic.imageDiagnostics.schema,
        'altium-toolkit.schematic.image-diagnostics.a1'
    )
    assert.deepEqual(documentModel.schematic.imageDiagnostics.summary, {
        imageCount: 2,
        embeddedImageCount: 1,
        embeddedPayloadCount: 0,
        externalReferenceCount: 1,
        missingPayloadCount: 1,
        unsupportedMimeTypeCount: 0,
        convertedPayloadCount: 0,
        alphaPayloadCount: 0,
        findingCount: 2
    })
})

/**
 * Verifies auxiliary code-symbol style records are preserved as a read-only
 * sidecar instead of falling through as unsupported native records.
 */
test('parseAltiumArrayBuffer exposes schematic code symbol records', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=220|IndexInSheet=70|Location.X=40|Location.Y=120|XSize=160|YSize=50' +
            '|Color=255|AreaColor=4366847|IsSolid=T|SymbolType=normal|UniqueID=CODE-A' +
            '|ExportedRoutineCount=1|RoutineName0=BOOT_A|InterfaceMode0=1|DataWidth0=32|IsLinked0=T' +
            '|InternalMemoryCount=1|InternalMemorySize=1024|ExternalMemoryCount=1' +
            '|ExternalMemory_Name0=MEM_A|ExternalMemory_Interface0=2|ExternalMemory_DataWidth0=16|ExternalMemory_AddressWidth0=12' +
            '|RECORD=221|IndexInSheet=71|OwnerIndex=70|Name=BUS_A[7..0]|DataIdentifier=BUS_A|DataType=logic' +
            '|DataWidth=8|Side=1|IOType=2|EntryType=1|Style=3|DistanceFromTop=2|TextFontID=1' +
            '|TextColor=128|Color=255|AreaColor=4366847|ParentRoutine=BOOT_A|OwnerIndexAdditionalList=T' +
            '|RECORD=222|IndexInSheet=72|OwnerIndex=70|Text=Block title|Location.X=44|Location.Y=126|FontID=1|Color=128' +
            '|RECORD=223|IndexInSheet=73|OwnerIndex=70|Text=Block source|Location.X=44|Location.Y=104|FontID=1|Color=255' +
            '|RECORD=210|IndexInSheet=74|Location.X=12|Location.Y=34|Name=PROBE_A|Color=255|OwnerPartID=-1'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'code-symbol-records.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.codeSymbols, {
        schema: 'altium-toolkit.schematic.code-symbols.a1',
        summary: {
            symbolCount: 1,
            entryCount: 1,
            textCount: 2,
            markerCount: 1
        },
        symbols: [
            {
                key: 'schematic-code-symbol-70',
                recordKey: 'schematic-record-1',
                recordId: 'record-70',
                x: 40,
                y: 120,
                width: 160,
                height: 50,
                color: '#ff0000',
                fill: '#ffa142',
                isSolid: true,
                symbolType: 'normal',
                uniqueId: 'CODE-A',
                routines: [
                    {
                        index: 0,
                        name: 'BOOT_A',
                        interfaceMode: 1,
                        dataWidth: 32,
                        isLinked: true
                    }
                ],
                internalMemory: {
                    count: 1,
                    size: 1024
                },
                externalMemory: [
                    {
                        index: 0,
                        name: 'MEM_A',
                        interfaceMode: 2,
                        dataWidth: 16,
                        addressWidth: 12
                    }
                ],
                entryKeys: ['schematic-code-entry-71'],
                textKeys: ['schematic-code-text-72', 'schematic-code-text-73']
            }
        ],
        entries: [
            {
                key: 'schematic-code-entry-71',
                recordKey: 'schematic-record-2',
                ownerSymbolKey: 'schematic-code-symbol-70',
                ownerIndex: '70',
                name: 'BUS_A[7..0]',
                dataIdentifier: 'BUS_A',
                dataType: 'logic',
                dataWidth: 8,
                side: 'right',
                direction: 'input',
                entryType: 1,
                style: 3,
                x: 200,
                y: 100,
                color: '#ff0000',
                fill: '#ffa142',
                textColor: '#800000',
                textFontId: 1,
                parentRoutine: 'BOOT_A',
                ownerIndexAdditionalList: true
            }
        ],
        texts: [
            {
                key: 'schematic-code-text-72',
                recordKey: 'schematic-record-3',
                ownerSymbolKey: 'schematic-code-symbol-70',
                ownerIndex: '70',
                kind: 'title',
                text: 'Block title',
                x: 44,
                y: 126,
                fontId: 1,
                color: '#800000'
            },
            {
                key: 'schematic-code-text-73',
                recordKey: 'schematic-record-4',
                ownerSymbolKey: 'schematic-code-symbol-70',
                ownerIndex: '70',
                kind: 'source',
                text: 'Block source',
                x: 44,
                y: 104,
                fontId: 1,
                color: '#ff0000'
            }
        ],
        markers: [
            {
                key: 'schematic-code-marker-74',
                recordKey: 'schematic-record-5',
                recordId: 'record-74',
                name: 'PROBE_A',
                x: 12,
                y: 34,
                color: '#ff0000',
                ownerPartId: '-1'
            }
        ]
    })
    assert.deepEqual(
        documentModel.schematic.recordTypes
            .filter((recordType) =>
                [210, 220, 221, 222, 223].includes(recordType.recordType)
            )
            .map(({ recordType, name, supported }) => ({
                recordType,
                name,
                supported
            })),
        [
            {
                recordType: 210,
                name: 'probe-marker',
                supported: true
            },
            {
                recordType: 220,
                name: 'code-symbol',
                supported: true
            },
            {
                recordType: 221,
                name: 'code-symbol-entry',
                supported: true
            },
            {
                recordType: 222,
                name: 'code-symbol-title',
                supported: true
            },
            {
                recordType: 223,
                name: 'code-symbol-source',
                supported: true
            }
        ]
    )
})

/**
 * Verifies schematic QA exposes a deterministic parser field-coverage report
 * without promoting additive native fields to top-level diagnostics.
 */
test('parseAltiumArrayBuffer reports unrecognized schematic fields by record type', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|SheetMystery=Y' +
            '|RECORD=4|Location.X=40|Location.Y=120|Color=255|FontID=1|Text=FIRST' +
            '|ExperimentalOffset=12' +
            '|RECORD=4|Location.X=80|Location.Y=120|Color=255|FontID=1|Text=SECOND' +
            '|ExperimentalOffset=24'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'field-coverage-report.SchDoc',
        arrayBuffer
    )
    const coverage = documentModel.schematic.qa.fieldCoverage

    assert.equal(coverage.schema, 'altium-toolkit.schematic.field-coverage.a1')
    assert.deepEqual(coverage.summary, {
        recordTypeCount: 2,
        unrecognizedFieldCount: 2,
        unrecognizedOccurrenceCount: 3
    })
    assert.deepEqual(coverage.recordTypes, [
        {
            recordType: 4,
            name: 'label',
            family: 'annotation',
            supported: true,
            recordCount: 2,
            unrecognizedFields: [
                {
                    name: 'ExperimentalOffset',
                    count: 2,
                    recordKeys: ['schematic-record-1', 'schematic-record-2']
                }
            ]
        },
        {
            recordType: 31,
            name: 'sheet',
            family: 'sheet',
            supported: true,
            recordCount: 1,
            unrecognizedFields: [
                {
                    name: 'SheetMystery',
                    count: 1,
                    recordKeys: ['schematic-record-0']
                }
            ]
        }
    ])
    assert.equal(
        documentModel.diagnostics.some(
            (diagnostic) => diagnostic.code === 'schematic.field.unrecognized'
        ),
        false
    )
})

/**
 * Verifies schematic field coverage matches known native fields without
 * depending on the authored field-key casing.
 */
test('parseAltiumArrayBuffer treats known schematic coverage fields case-insensitively', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=300|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=F|TITLEBLOCKON=F|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=2|OWNERINDEX=10|PINCONGLOMERATE=48|PINLENGTH=20' +
            '|LOCATION.X=80|LOCATION.Y=90|NAME=READY|DESIGNATOR=1|FORMALTYPE=1' +
            '|PINCASEMYSTERY=Y'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'case-normalized-field-coverage.SchDoc',
        arrayBuffer
    )
    const coverage = documentModel.schematic.qa.fieldCoverage

    assert.deepEqual(coverage.summary, {
        recordTypeCount: 1,
        unrecognizedFieldCount: 1,
        unrecognizedOccurrenceCount: 1
    })
    assert.deepEqual(coverage.recordTypes, [
        {
            recordType: 2,
            name: 'pin',
            family: 'component',
            supported: true,
            recordCount: 1,
            unrecognizedFields: [
                {
                    name: 'PINCASEMYSTERY',
                    count: 1,
                    recordKeys: ['schematic-record-1']
                }
            ]
        }
    ])
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

/**
 * Verifies harness metadata contributes explicit review findings when local
 * harness connectivity cannot be resolved from the recovered sheet model.
 */
test('parseAltiumArrayBuffer reports harness connectivity QA findings', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=320|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=15|IndexInSheet=40|Location.X=50|Location.Y=150|XSize=80|YSize=50' +
            '|Name=Child|FileName=child.SchDoc|Color=128|AreaColor=16777215' +
            '|RECORD=16|OwnerIndex=40|Name=DATA|Side=0|DistanceFromTop=2' +
            '|HarnessType=MISSING_GROUP|TextColor=255' +
            '|RECORD=215|IndexInSheet=120|Location.X=180|Location.Y=130|XSize=70|YSize=40' +
            '|Side=1|PrimaryConnectionPosition=20|LineWidth=1|Color=128|AreaColor=16777215' +
            '|RECORD=216|OwnerIndex=120|Name=CTRL_A|Side=0|DistanceFromTop=1' +
            '|HarnessType=CTRL_GROUP|TextStyle=Short|TextColor=255' +
            '|RECORD=217|OwnerIndex=120|Location.X=180|Location.Y=140|Text=CTRL_GROUP|Color=8388608'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'harness-connectivity-qa.SchDoc',
        arrayBuffer
    )

    assert.equal(
        documentModel.schematic.connectivityQa.summary.harnessFindingCount,
        2
    )
    assert.equal(
        documentModel.schematic.connectivityQa.summary
            .unresolvedHarnessTypeCount,
        1
    )
    assert.equal(
        documentModel.schematic.connectivityQa.summary
            .unlinkedHarnessEntryCount,
        1
    )
    assert.deepEqual(
        documentModel.schematic.connectivityQa.findings.map(
            (finding) => finding.code
        ),
        [
            'schematic.connectivity.harness-sheet-entry-unresolved-type',
            'schematic.connectivity.harness-entry-unlinked-signal'
        ]
    )
})

/**
 * Verifies explicit owner display-mode primitives are filtered to the active
 * display mode requested by their component placement.
 */
test('parseAltiumArrayBuffer renders only active schematic display-mode records', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=240|CustomY=160|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=1|IndexInSheet=30|Location.X=90|Location.Y=80|LibReference=MODE_CELL' +
            '|PartCount=1|DisplayModeCount=2|CurrentPartId=1|DisplayMode=2' +
            '|RECORD=2|OwnerIndex=30|OwnerPartID=1|OwnerPartDisplayMode=1|PinConglomerate=58' +
            '|PinLength=20|Location.X=90|Location.Y=70|Name=MODE_A|Designator=1' +
            '|RECORD=2|OwnerIndex=30|OwnerPartID=1|OwnerPartDisplayMode=2|PinConglomerate=58' +
            '|PinLength=20|Location.X=90|Location.Y=90|Name=MODE_B|Designator=2'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'active-display-mode.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(
        documentModel.schematic.pins.map((pin) => pin.name),
        ['MODE_B']
    )
    assert.equal(
        documentModel.schematic.displayModes.components[0].parts[0]
            .displayModes[0].isActive,
        false
    )
    assert.equal(
        documentModel.schematic.displayModes.components[0].parts[0]
            .displayModes[1].isActive,
        true
    )
})
