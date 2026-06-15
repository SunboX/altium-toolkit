// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { IntLibModelParser } from '../../src/core/altium/IntLibModelParser.mjs'
import { LibraryQaReportBuilder } from '../../src/core/altium/LibraryQaReportBuilder.mjs'
import { LibraryRenderManifestBuilder } from '../../src/core/altium/LibraryRenderManifestBuilder.mjs'
import { LibrarySearchIndex } from '../../src/core/altium/LibrarySearchIndex.mjs'
import { PcbLibModelParser } from '../../src/core/altium/PcbLibModelParser.mjs'

test('PcbLibModelParser exposes footprint indexes and search metadata', () => {
    const model = PcbLibModelParser.parse('library-index.PcbLib', {
        footprints: [
            {
                name: 'PKG_FAKE_A',
                dataName: 'Data-PKG_FAKE_A',
                sourceStorage: 'Footprints/PKG_FAKE_A',
                parameters: {
                    Description: 'Controller package',
                    FootprintType: 'SMD'
                },
                componentParams: {
                    ModelName: 'PKG_FAKE_A',
                    Height: '40mil'
                },
                implementations: [
                    {
                        modelName: 'PKG_FAKE_A',
                        modelType: 'PCB',
                        source: 'library-index.PcbLib'
                    }
                ],
                componentModels: [
                    {
                        name: 'PKG_FAKE_A',
                        kind: 'footprint',
                        description: 'Controller package'
                    }
                ],
                pinDisplayModes: {
                    default: 'designator',
                    hiddenPins: ['NC']
                },
                pads: [{ designator: '1' }, { designator: '2' }],
                tracks: [{}],
                arcs: [],
                vias: [],
                fills: [],
                texts: [{ text: 'REF**' }],
                regions: []
            }
        ]
    })

    assert.deepEqual(model.pcbLibrary.indexes.footprintsByName, {
        PKG_FAKE_A: {
            index: 0,
            name: 'PKG_FAKE_A',
            dataName: 'Data-PKG_FAKE_A',
            sourceStorage: 'Footprints/PKG_FAKE_A',
            primitiveCount: 0,
            padCount: 2,
            textCount: 1,
            keywords: [
                'PKG_FAKE_A',
                'Data-PKG_FAKE_A',
                'Controller package',
                'SMD',
                'PKG_FAKE_A',
                '40mil'
            ]
        }
    })
    assert.deepEqual(model.pcbLibrary.footprints[0].implementations, [
        {
            modelName: 'PKG_FAKE_A',
            modelType: 'PCB',
            source: 'library-index.PcbLib'
        }
    ])
    assert.deepEqual(model.pcbLibrary.footprints[0].componentModels, [
        {
            name: 'PKG_FAKE_A',
            kind: 'footprint',
            description: 'Controller package'
        }
    ])
    assert.deepEqual(model.pcbLibrary.footprints[0].pinDisplayModes, {
        default: 'designator',
        hiddenPins: ['NC']
    })
    assert.deepEqual(model.pcbLibrary.renderManifest.outputs, [
        {
            kind: 'footprint',
            footprintKey: 'footprint-0-pkg-fake-a',
            name: 'PKG_FAKE_A',
            sourceStorage: 'Footprints/PKG_FAKE_A',
            outputSvgKey: 'pcb-library/footprint-0-pkg-fake-a.svg',
            layerSvgs: [],
            embeddedAssets: []
        }
    ])
    assert.deepEqual(
        LibrarySearchIndex.searchPcbFootprints(
            model.pcbLibrary,
            'controller package'
        ).matches.map((match) => ({
            name: match.name,
            matchKind: match.matchKind
        })),
        [{ name: 'PKG_FAKE_A', matchKind: 'keyword' }]
    )
    assert.deepEqual(
        LibrarySearchIndex.searchPcbFootprints(
            model.pcbLibrary,
            'pkgfa'
        ).matches.map((match) => ({
            name: match.name,
            matchKind: match.matchKind
        })),
        [{ name: 'PKG_FAKE_A', matchKind: 'fuzzy' }]
    )
})

test('PcbLibModelParser exposes library and footprint defaults', () => {
    const model = PcbLibModelParser.parse('defaults-index.PcbLib', {
        libraryHeader: {
            TRACKWIDTH: '7mil',
            VIAHOLESIZE: '10mil',
            VIADIAMETER: '20mil',
            SOLDERMASKEXPANSION: '3mil',
            PASTEMASKEXPANSION: '-0.25mil',
            DEFAULTFONTNAME: 'Arial'
        },
        footprints: [
            {
                name: 'PKG_DEFAULTS_A',
                parameters: {
                    TRACKWIDTH: '6mil',
                    SOLDERMASKEXPANSION: '2mil',
                    DEFAULTCOLOR: '255'
                },
                pads: [{ designator: '1' }]
            }
        ]
    })

    assert.deepEqual(model.pcbLibrary.defaults, {
        schema: 'altium-toolkit.pcb.defaults.a1',
        source: 'pcb-library',
        board: {
            defaultFontName: 'Arial'
        },
        primitiveStyles: {
            trackWidthMil: 7,
            viaHoleSizeMil: 10,
            viaDiameterMil: 20
        },
        maskPaste: {
            solder: {
                expansionMil: 3
            },
            paste: {
                expansionMil: -0.25
            }
        }
    })
    assert.deepEqual(model.pcbLibrary.footprints[0].defaults, {
        schema: 'altium-toolkit.pcb.defaults.a1',
        source: 'pcb-library-footprint',
        primitiveStyles: {
            trackWidthMil: 6
        },
        maskPaste: {
            solder: {
                expansionMil: 2
            }
        },
        colors: {
            defaultColor: '#ff0000'
        }
    })
})

test('LibraryRenderManifestBuilder and LibrarySearchIndex expose schematic library read helpers', () => {
    const schematicLibrary = {
        symbols: [
            {
                name: 'CTRL_CORE',
                parts: [{ partId: 'A' }, { partId: 'B' }],
                parameters: { Description: 'controller symbol' },
                embeddedAssets: [
                    {
                        key: 'symbol-image-0',
                        format: 'png',
                        sourceStream: 'Images/0'
                    }
                ]
            }
        ]
    }

    assert.deepEqual(
        LibraryRenderManifestBuilder.buildSchematicLibraryManifest(
            schematicLibrary
        ),
        {
            schema: 'altium-toolkit.library.render-manifest.a1',
            libraryKind: 'schematic-symbols',
            outputs: [
                {
                    kind: 'symbol',
                    symbolKey: 'symbol-0-ctrl-core',
                    name: 'CTRL_CORE',
                    partKey: 'symbol-0-ctrl-core/part-a',
                    partId: 'A',
                    outputSvgKey:
                        'schematic-library/symbol-0-ctrl-core/part-a.svg',
                    embeddedAssets: [
                        {
                            key: 'symbol-image-0',
                            format: 'png',
                            sourceStream: 'Images/0'
                        }
                    ]
                },
                {
                    kind: 'symbol',
                    symbolKey: 'symbol-0-ctrl-core',
                    name: 'CTRL_CORE',
                    partKey: 'symbol-0-ctrl-core/part-b',
                    partId: 'B',
                    outputSvgKey:
                        'schematic-library/symbol-0-ctrl-core/part-b.svg',
                    embeddedAssets: [
                        {
                            key: 'symbol-image-0',
                            format: 'png',
                            sourceStream: 'Images/0'
                        }
                    ]
                }
            ],
            embeddedAssets: [
                {
                    key: 'symbol-image-0',
                    format: 'png',
                    sourceStream: 'Images/0'
                }
            ]
        }
    )
    assert.deepEqual(
        LibrarySearchIndex.searchSchematicSymbols(
            schematicLibrary,
            'controller'
        ).matches.map((match) => ({
            name: match.name,
            matchKind: match.matchKind
        })),
        [{ name: 'CTRL_CORE', matchKind: 'keyword' }]
    )
})

test('LibraryRenderManifestBuilder reports database-library-ready schematic extraction plans', () => {
    const manifest =
        LibraryRenderManifestBuilder.buildSchematicExtractionManifest({
            fileName: 'audit-sheet.SchDoc',
            schematic: {
                components: [
                    {
                        designator: 'U1',
                        libReference: 'CTRL_CORE',
                        uniqueId: 'CMP-1',
                        ownerIndex: '20',
                        parameters: {
                            Designator: 'U1',
                            Comment: 'Controller',
                            Lifecycle: 'Released',
                            Manufacturer: 'Acme'
                        }
                    },
                    {
                        designator: 'R1',
                        libReference: 'RES_CORE',
                        uniqueId: 'CMP-2',
                        ownerIndex: '30',
                        parameters: {
                            Comment: '10k'
                        }
                    }
                ],
                pins: [{ ownerIndex: '20' }, { ownerIndex: '20' }],
                lines: [{ ownerIndex: '20' }],
                texts: [{ ownerIndex: '20' }, { ownerIndex: '30' }],
                images: [
                    {
                        ownerIndex: '20',
                        key: 'img-1',
                        nativeFormat: 'PNG',
                        byteSize: 42,
                        checksum: {
                            algorithm: 'fnv1a32',
                            value: 'abcd1234'
                        }
                    }
                ],
                implementations: {
                    components: [
                        {
                            componentKey: 'schematic-component-20',
                            implementationKeys: ['impl-1']
                        }
                    ]
                }
            }
        })

    assert.deepEqual(manifest.summary, {
        outputCount: 2,
        embeddedAssetCount: 1,
        readyOutputCount: 2,
        strippedParameterCount: 3,
        strippedImplementationCount: 1
    })
    assert.deepEqual(manifest.outputs[0].databaseLibrary, {
        readiness: 'ready',
        preservedParameterNames: ['Lifecycle', 'Manufacturer'],
        strippedParameterNames: ['Designator', 'Comment'],
        stripImplementationLinks: true,
        strippedImplementationKeys: ['impl-1'],
        auditKey: 'schematic-extract/symbol-extract-0-ctrl-core.dblib.json'
    })
    assert.deepEqual(manifest.outputs[1].databaseLibrary, {
        readiness: 'ready',
        preservedParameterNames: [],
        strippedParameterNames: ['Comment'],
        stripImplementationLinks: false,
        strippedImplementationKeys: [],
        auditKey: 'schematic-extract/symbol-extract-1-res-core.dblib.json'
    })
})

test('LibraryRenderManifestBuilder exposes schematic template extraction manifests', () => {
    const manifest =
        LibraryRenderManifestBuilder.buildSchematicTemplateExtractionManifest({
            fileName: 'template-source.SchDoc',
            schematic: {
                template: {
                    identity: {
                        fileName: 'base-template.SchDot',
                        name: 'Base Template',
                        recordId: 'record-40'
                    },
                    ownedRecordKeys: [
                        'schematic-record-41',
                        'schematic-record-42'
                    ],
                    ownedGraphics: {
                        lines: ['schematic-record-41'],
                        texts: ['schematic-record-42'],
                        images: ['schematic-record-43']
                    },
                    fonts: {
                        1: { name: 'Arial', size: 10 }
                    },
                    missingParameters: ['CheckedBy'],
                    titleBlock: {
                        title: 'Template Title',
                        documentNumber: '=DocumentNumber'
                    }
                }
            }
        })

    assert.deepEqual(manifest, {
        schema: 'altium-toolkit.schematic.template-extraction.a1',
        sourceDocument: 'template-source.SchDoc',
        template: {
            identity: {
                fileName: 'base-template.SchDot',
                name: 'Base Template',
                recordId: 'record-40'
            },
            outputTemplateKey: 'schematic-template/base-template.schdot',
            renderManifestKey: 'schematic-template/base-template.render.json',
            ownedRecordKeys: ['schematic-record-41', 'schematic-record-42'],
            ownedGraphics: {
                lines: ['schematic-record-41'],
                texts: ['schematic-record-42'],
                images: ['schematic-record-43']
            },
            fonts: {
                1: { name: 'Arial', size: 10 }
            },
            missingParameters: ['CheckedBy'],
            titleBlock: {
                title: 'Template Title',
                documentNumber: '=DocumentNumber'
            }
        },
        summary: {
            templatePresent: true,
            ownedRecordCount: 2,
            missingParameterCount: 1,
            fontCount: 1
        },
        diagnostics: [
            {
                code: 'schematic.template-extraction.missing-parameter',
                severity: 'warning',
                parameterName: 'CheckedBy'
            }
        ]
    })
})

test('LibraryRenderManifestBuilder exposes SchDoc symbol extraction manifests', () => {
    const manifest =
        LibraryRenderManifestBuilder.buildSchematicExtractionManifest({
            fileName: 'placed-symbols.SchDoc',
            schematic: {
                components: [
                    {
                        ownerIndex: '20',
                        designator: 'U1',
                        libReference: 'CTRL_FAKE',
                        uniqueId: 'CMP-1'
                    }
                ],
                pins: [
                    { ownerIndex: '20', name: 'IN', designator: '1' },
                    { ownerIndex: '20', name: 'OUT', designator: '2' }
                ],
                rectangles: [{ ownerIndex: '20' }],
                lines: [{ ownerIndex: '20' }],
                texts: [
                    {
                        ownerIndex: '20',
                        name: 'Designator',
                        text: 'U1'
                    },
                    {
                        ownerIndex: '20',
                        name: 'Comment',
                        text: 'Controller'
                    }
                ],
                images: [
                    {
                        ownerIndex: '20',
                        key: 'symbol-image-0',
                        format: 'png'
                    }
                ]
            }
        })

    assert.deepEqual(manifest, {
        schema: 'altium-toolkit.schematic.extraction-manifest.a1',
        sourceDocument: 'placed-symbols.SchDoc',
        summary: {
            outputCount: 1,
            embeddedAssetCount: 1,
            readyOutputCount: 1,
            strippedParameterCount: 0,
            strippedImplementationCount: 0
        },
        outputs: [
            {
                kind: 'symbol-extraction',
                symbolKey: 'symbol-extract-0-ctrl-fake',
                sourceComponent: {
                    designator: 'U1',
                    libReference: 'CTRL_FAKE',
                    uniqueId: 'CMP-1',
                    ownerIndex: '20'
                },
                outputLibraryKey:
                    'schematic-extract/symbol-extract-0-ctrl-fake.SchLib',
                renderManifestKey:
                    'schematic-extract/symbol-extract-0-ctrl-fake.render.json',
                partKeys: ['symbol-extract-0-ctrl-fake/part-default'],
                childCounts: {
                    pins: 2,
                    graphics: 2,
                    texts: 2,
                    images: 1
                },
                embeddedAssets: [
                    {
                        key: 'symbol-image-0',
                        format: 'png'
                    }
                ]
            }
        ],
        embeddedAssets: [
            {
                key: 'symbol-image-0',
                format: 'png'
            }
        ]
    })
})

test('LibraryRenderManifestBuilder preserves extraction asset audit metadata', () => {
    const manifest =
        LibraryRenderManifestBuilder.buildSchematicExtractionManifest({
            fileName: 'asset-audit.SchDoc',
            schematic: {
                components: [
                    {
                        ownerIndex: '30',
                        designator: 'U2',
                        libReference: 'IMG_FAKE',
                        uniqueId: 'CMP-2'
                    }
                ],
                pins: [],
                rectangles: [],
                lines: [],
                texts: [],
                images: [
                    {
                        ownerIndex: '30',
                        key: 'asset-0',
                        format: 'png',
                        nativeFormat: 'png',
                        wrapperType: 'ole-native',
                        byteSize: 128,
                        checksum: {
                            algorithm: 'fnv1a32',
                            value: '89abcdef'
                        },
                        diagnostics: [
                            {
                                code: 'asset.wrapper-stripped',
                                severity: 'info',
                                message: 'Recovered image payload wrapper.'
                            }
                        ]
                    }
                ]
            }
        })

    assert.deepEqual(manifest.outputs[0].embeddedAssets, [
        {
            key: 'asset-0',
            format: 'png',
            nativeFormat: 'png',
            wrapperType: 'ole-native',
            byteSize: 128,
            checksum: {
                algorithm: 'fnv1a32',
                value: '89abcdef'
            },
            diagnostics: [
                {
                    code: 'asset.wrapper-stripped',
                    severity: 'info',
                    message: 'Recovered image payload wrapper.'
                }
            ]
        }
    ])
})

test('LibraryQaReportBuilder emits schematic library merge-plan diagnostics', () => {
    const report = LibraryQaReportBuilder.build({
        schematicLibraries: [
            {
                fileName: 'first.SchLib',
                schematicLibrary: {
                    fonts: [{ id: 1, name: 'Arial' }],
                    symbols: [
                        {
                            name: 'CTRL_CORE',
                            parts: [{ partId: 'A' }],
                            pins: [{ designator: '1' }, { designator: '2' }],
                            displayModes: [{ mode: 0 }],
                            embeddedAssets: [
                                {
                                    key: 'logo-a',
                                    format: 'png',
                                    sourceStream: 'Images/0'
                                }
                            ]
                        }
                    ]
                }
            },
            {
                fileName: 'second.SchLib',
                schematicLibrary: {
                    fonts: [{ id: 2, name: 'Courier New' }],
                    symbols: [
                        {
                            name: 'CTRL_CORE',
                            parts: [{ partId: 'A' }, { partId: 'B' }],
                            pins: [{ designator: '1' }],
                            displayModes: [{ mode: 0 }, { mode: 1 }],
                            embeddedAssets: [
                                {
                                    key: 'logo-b',
                                    format: 'jpg',
                                    sourceStream: 'Images/1'
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.summary.mergePlanConflictCount, 1)
    assert.deepEqual(report.mergePlan, {
        schema: 'altium-toolkit.library.merge-plan.a1',
        strategy: 'read-only-analysis',
        summary: {
            duplicateNameCount: 1,
            conflictCount: 1,
            renameSuggestionCount: 1,
            embeddedAssetCount: 2,
            fontDependencyCount: 2
        },
        duplicateSymbols: [
            {
                name: 'CTRL_CORE',
                conflictKind: 'conflicting-symbol',
                suggestedNames: [
                    {
                        libraryFileName: 'first.SchLib',
                        index: 0,
                        currentName: 'CTRL_CORE',
                        suggestedName: 'CTRL_CORE'
                    },
                    {
                        libraryFileName: 'second.SchLib',
                        index: 0,
                        currentName: 'CTRL_CORE',
                        suggestedName: 'CTRL_CORE_2'
                    }
                ],
                differences: {
                    pinCounts: [2, 1],
                    partCounts: [1, 2],
                    displayModeCounts: [1, 2]
                },
                occurrences: [
                    {
                        libraryFileName: 'first.SchLib',
                        index: 0,
                        pinCount: 2,
                        partCount: 1,
                        displayModeCount: 1
                    },
                    {
                        libraryFileName: 'second.SchLib',
                        index: 0,
                        pinCount: 1,
                        partCount: 2,
                        displayModeCount: 2
                    }
                ]
            }
        ],
        embeddedAssets: [
            {
                libraryFileName: 'first.SchLib',
                symbolName: 'CTRL_CORE',
                key: 'logo-a',
                format: 'png',
                sourceStream: 'Images/0'
            },
            {
                libraryFileName: 'second.SchLib',
                symbolName: 'CTRL_CORE',
                key: 'logo-b',
                format: 'jpg',
                sourceStream: 'Images/1'
            }
        ],
        fontDependencies: [
            {
                libraryFileName: 'first.SchLib',
                id: 1,
                name: 'Arial'
            },
            {
                libraryFileName: 'second.SchLib',
                id: 2,
                name: 'Courier New'
            }
        ],
        diagnostics: [
            {
                code: 'library.merge-plan.conflicting-symbol',
                severity: 'warning',
                symbolName: 'CTRL_CORE'
            }
        ]
    })
})

test('PcbLibModelParser carries advanced footprint fields and projection diagnostics', () => {
    const model = PcbLibModelParser.parse('advanced-footprints.PcbLib', {
        embeddedModels: {
            models: [
                {
                    id: 'mdl-1',
                    checksum: 123,
                    name: 'case.step',
                    format: 'step',
                    sourceStream: 'Models/0'
                }
            ],
            componentBodies: [
                {
                    modelId: 'mdl-1',
                    checksum: 123,
                    name: 'case.step',
                    embedded: true,
                    layer: 'Top Layer',
                    positionMil: { x: 100, y: 200 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 0 },
                    dzMil: 0
                }
            ]
        },
        footprints: [
            {
                name: 'ADVANCED_PAD',
                sourceStorage: 'ADVANCED_PAD',
                extendedPrimitiveInformation: {
                    entries: [
                        {
                            primitiveIndex: 0,
                            primitiveObjectId: 2,
                            primitiveType: 'pad',
                            sourceStream: 'ExtendedPrimitiveInformation/Data',
                            maskExpansion: {
                                paste: {
                                    mode: 2,
                                    source: 'manual',
                                    manualExpansion: 3
                                },
                                solder: {
                                    mode: 1,
                                    source: 'rule',
                                    manualExpansion: null
                                }
                            }
                        }
                    ]
                },
                customPadShapes: {
                    entries: [
                        {
                            primitiveIndex: 0,
                            layerId: 1,
                            regionIndexes: [0],
                            sourceStream: 'CustomShapes/Data'
                        }
                    ],
                    byPrimitiveIndex: {
                        0: [
                            {
                                primitiveIndex: 0,
                                layerId: 1,
                                regionIndexes: [0],
                                shapeRegionIndexes: [],
                                arcIndexes: [],
                                trackIndexes: [],
                                fillIndexes: [],
                                sourceStream: 'CustomShapes/Data'
                            }
                        ]
                    }
                },
                pads: [
                    {
                        primitiveIndex: 0,
                        designator: '1',
                        layerId: 1,
                        x: 10,
                        y: 20
                    }
                ],
                regions: [
                    {
                        primitiveIndex: 0,
                        layerId: 1,
                        points: [
                            { x: 0, y: 0 },
                            { x: 20, y: 0 }
                        ]
                    }
                ],
                texts: [
                    {
                        text: 'CODE',
                        kind: 'barCode',
                        barcode: {
                            kind: 'code128',
                            renderMode: 'bars',
                            showText: true
                        }
                    }
                ],
                componentBodies: [{ modelId: 'mdl-1', name: 'case.step' }],
                embeddedModels: [{ id: 'mdl-1', name: 'case.step' }]
            }
        ]
    })
    const footprint = model.pcbLibrary.footprints[0]

    assert.equal(model.summary.embeddedModelCount, 1)
    assert.equal(
        footprint.pads[0].extendedPrimitiveInformation.maskExpansion.paste
            .source,
        'manual'
    )
    assert.equal(footprint.pads[0].customShape.layers[0].regions.length, 1)
    assert.deepEqual(footprint.texts[0].barcode, {
        kind: 'code128',
        renderMode: 'bars',
        showText: true
    })
    assert.deepEqual(footprint.embeddedModels, [
        { id: 'mdl-1', name: 'case.step' }
    ])
    assert.equal(
        footprint.componentBodies[0].projectionDiagnostics.source,
        'embedded-model'
    )
    assert.equal(
        footprint.componentBodies[0].projectionDiagnostics.reason,
        'matched embedded model payload'
    )
})

test('PcbLibModelParser emits advanced-field parity reports', () => {
    const model = PcbLibModelParser.parse('parity-footprints.PcbLib', {
        footprints: [
            {
                name: 'PARITY_A',
                pads: [
                    {
                        primitiveIndex: 0,
                        designator: '1',
                        layerId: 1,
                        holeDiameter: 10,
                        localStack: {
                            schema: 'altium-toolkit.pcb.pad-local-stack.a1',
                            mode: 'full-stack',
                            layers: [{ layerId: 1, shape: 1 }]
                        }
                    }
                ],
                vias: [
                    {
                        primitiveIndex: 1,
                        layerId: 1,
                        topTenting: true,
                        bottomTenting: false,
                        solderMaskExpansionMode: 2,
                        solderMaskExpansion: 4
                    }
                ],
                texts: [
                    {
                        text: 'ABC123',
                        barcode: {
                            kindName: 'code128',
                            renderModeName: 'bars',
                            showText: true
                        }
                    }
                ],
                customPadShapes: {
                    entries: [
                        {
                            primitiveIndex: 0,
                            layerId: 1,
                            regionIndexes: [0]
                        }
                    ],
                    byPrimitiveIndex: {
                        0: [
                            {
                                primitiveIndex: 0,
                                layerId: 1,
                                regionIndexes: [0],
                                shapeRegionIndexes: [],
                                arcIndexes: [],
                                trackIndexes: [],
                                fillIndexes: []
                            }
                        ]
                    }
                },
                regions: [{ primitiveIndex: 0, layerId: 1 }],
                componentBodies: [{ modelId: 'model-a', name: 'body.step' }],
                embeddedModels: [
                    {
                        id: 'model-a',
                        name: 'body.step',
                        format: 'step',
                        sourceStream: 'Models/0'
                    }
                ]
            }
        ]
    })

    assert.deepEqual(model.pcbLibrary.parityReport, {
        schema: 'altium-toolkit.pcblib.parity.a1',
        summary: {
            footprintCount: 1,
            footprintWithAdvancedFieldsCount: 1,
            localStackPadCount: 1,
            customPadFootprintCount: 1,
            maskPastePrimitiveCount: 1,
            viaTentingCount: 1,
            barcodeTextCount: 1,
            embeddedModelFootprintCount: 1,
            projectionDiagnosticCount: 1
        },
        footprints: [
            {
                name: 'PARITY_A',
                advancedFields: {
                    localStackPads: 1,
                    customPadShapes: 1,
                    maskPastePrimitives: 1,
                    viaTenting: 1,
                    barcodeTexts: 1,
                    embeddedModels: 1,
                    projectionDiagnostics: 1
                },
                layers: [
                    {
                        layerKey: 'L1',
                        layerId: 1,
                        displayName: 'L1'
                    }
                ],
                diagnostics: []
            }
        ]
    })
})

test('LibraryQaReportBuilder reports collection-level collisions and stale links', () => {
    const report = LibraryQaReportBuilder.build({
        schematicLibraries: [
            {
                fileName: 'logic-a.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'CTRL_FAKE',
                            parts: [{ partId: 'A' }],
                            implementations: [
                                {
                                    modelName: 'PKG_FAKE',
                                    targetLibraries: [
                                        'missing-footprints.PcbLib'
                                    ]
                                }
                            ]
                        },
                        {
                            name: 'MULTI_FAKE',
                            parts: [{ partId: 'A' }, { partId: 'C' }]
                        }
                    ]
                }
            },
            {
                fileName: 'logic-b.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'CTRL_FAKE',
                            parts: [{ partId: 'A' }, { partId: 'B' }]
                        }
                    ]
                }
            }
        ],
        pcbLibraries: [
            {
                fileName: 'footprints-a.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: 'PKG_FAKE',
                            pads: [{ designator: '1' }],
                            embeddedModels: [{ id: 'model-a' }]
                        },
                        {
                            name: 'DUP_FAKE',
                            pads: [{ designator: '1' }]
                        }
                    ]
                }
            },
            {
                fileName: 'footprints-b.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: 'DUP_FAKE',
                            pads: [{ designator: '1' }, { designator: '2' }]
                        },
                        {
                            name: 'NO_MODEL_FAKE',
                            componentBodies: [{ modelId: 'missing-model' }]
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.library.qa.a1')
    assert.deepEqual(report.summary, {
        schematicLibraryCount: 2,
        pcbLibraryCount: 2,
        duplicateSymbolCount: 1,
        duplicateFootprintCount: 1,
        staleImplementationCount: 1,
        missingModelCount: 1,
        multipartMismatchCount: 1,
        mergePlanConflictCount: 1,
        libraryLintIssueCount: 0,
        issuesBySeverity: {
            error: 0,
            warning: 6,
            info: 0
        },
        issueCount: 6
    })
    assert.deepEqual(report.duplicates.symbols, [
        {
            name: 'CTRL_FAKE',
            occurrences: [
                { libraryFileName: 'logic-a.SchLib', index: 0 },
                { libraryFileName: 'logic-b.SchLib', index: 0 }
            ]
        }
    ])
    assert.deepEqual(report.duplicates.footprints, [
        {
            name: 'DUP_FAKE',
            occurrences: [
                {
                    libraryFileName: 'footprints-a.PcbLib',
                    index: 1,
                    padCount: 1
                },
                {
                    libraryFileName: 'footprints-b.PcbLib',
                    index: 0,
                    padCount: 2
                }
            ],
            collisionKind: 'conflicting-footprint'
        }
    ])
    assert.deepEqual(report.staleImplementations, [
        {
            libraryFileName: 'logic-a.SchLib',
            symbolName: 'CTRL_FAKE',
            modelName: 'PKG_FAKE',
            targetLibraries: ['missing-footprints.PcbLib'],
            reason: 'target library was not present in the scanned collection'
        }
    ])
    assert.deepEqual(report.missingModels, [
        {
            libraryFileName: 'footprints-b.PcbLib',
            footprintName: 'NO_MODEL_FAKE',
            modelId: 'missing-model',
            reason: 'component body references an embedded model that is absent'
        }
    ])
    assert.deepEqual(report.multipartMismatches, [
        {
            libraryFileName: 'logic-a.SchLib',
            symbolName: 'MULTI_FAKE',
            partIds: ['A', 'C'],
            expectedPartIds: ['A', 'B']
        }
    ])
})

test('LibraryQaReportBuilder emits symbol and footprint lint issues', () => {
    const report = LibraryQaReportBuilder.build({
        schematicLibraries: [
            {
                fileName: 'lint-symbols.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: '',
                            pins: []
                        },
                        {
                            name: 'GATE_FAKE',
                            pins: [
                                { designator: '1', name: 'A' },
                                { designator: '1', name: 'B' },
                                { designator: '', name: 'C' },
                                { designator: '4', name: '' }
                            ],
                            implementations: [{ modelName: 'PKG_GATE_FAKE' }]
                        }
                    ]
                }
            }
        ],
        pcbLibraries: [
            {
                fileName: 'lint-footprints.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: '',
                            pads: []
                        },
                        {
                            name: 'PKG_GATE_FAKE',
                            pads: [
                                { designator: '1' },
                                { designator: '1' },
                                { designator: '' }
                            ]
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.summary.libraryLintIssueCount, 10)
    assert.equal(report.summary.issueCount, 10)
    assert.deepEqual(report.summary.issuesBySeverity, {
        error: 0,
        warning: 9,
        info: 1
    })
    assert.deepEqual(report.libraryLint.summary.issuesBySeverity, {
        error: 0,
        warning: 9,
        info: 1
    })
    assert.deepEqual(
        report.libraryLint.issues.map((issue) => ({
            code: issue.code,
            target: issue.target
        })),
        [
            {
                code: 'library.symbol.empty-name',
                target: 'lint-symbols.SchLib#0'
            },
            {
                code: 'library.symbol.no-pins',
                target: 'lint-symbols.SchLib#0'
            },
            {
                code: 'library.symbol.blank-pin-designator',
                target: 'GATE_FAKE'
            },
            {
                code: 'library.symbol.unnamed-pin',
                target: 'GATE_FAKE'
            },
            {
                code: 'library.symbol.duplicate-pin-designator',
                target: 'GATE_FAKE'
            },
            {
                code: 'library.footprint.empty-name',
                target: 'lint-footprints.PcbLib#0'
            },
            {
                code: 'library.footprint.no-pads',
                target: 'lint-footprints.PcbLib#0'
            },
            {
                code: 'library.footprint.blank-pad-designator',
                target: 'PKG_GATE_FAKE'
            },
            {
                code: 'library.footprint.duplicate-pad-designator',
                target: 'PKG_GATE_FAKE'
            },
            {
                code: 'library.symbol-footprint.pin-pad-count-mismatch',
                target: 'GATE_FAKE'
            }
        ]
    )
    assert.deepEqual(report.libraryLint.issues[3], {
        code: 'library.symbol.unnamed-pin',
        severity: 'info',
        target: 'GATE_FAKE',
        libraryFileName: 'lint-symbols.SchLib',
        symbolName: 'GATE_FAKE',
        unnamedPinCount: 1,
        reason: 'one or more pins had a blank name'
    })
    assert.deepEqual(report.libraryLint.issues[9], {
        code: 'library.symbol-footprint.pin-pad-count-mismatch',
        severity: 'warning',
        target: 'GATE_FAKE',
        libraryFileName: 'lint-symbols.SchLib',
        symbolName: 'GATE_FAKE',
        footprintName: 'PKG_GATE_FAKE',
        pinCount: 4,
        padCount: 3,
        modelName: 'PKG_GATE_FAKE',
        reason: 'symbol pin count differs from the linked footprint pad count'
    })
})

test('IntLibModelParser exposes source and cross-reference indexes', () => {
    const model = IntLibModelParser.parse('bundle-index.IntLib', {
        version: '1.0',
        sources: [
            {
                path: 'SchLib/Symbols.SchLib',
                fileName: 'Symbols.SchLib',
                fileType: 'SchLib',
                libraryKind: 'schematic-symbols'
            },
            {
                path: 'PCBLib/Footprints.PcbLib',
                fileName: 'Footprints.PcbLib',
                fileType: 'PcbLib',
                libraryKind: 'pcb-footprints'
            }
        ],
        crossReferences: [
            {
                component: 'U_FAKE',
                model: 'SYM_FAKE',
                kind: 'SCH',
                fields: {}
            },
            {
                component: 'U_FAKE',
                model: 'PKG_FAKE',
                kind: 'PCB',
                fields: {}
            }
        ],
        parameters: {}
    })

    assert.deepEqual(model.integratedLibrary.indexes.sourcesByFileName, {
        'Footprints.PcbLib': {
            index: 1,
            path: 'PCBLib/Footprints.PcbLib',
            fileType: 'PcbLib',
            libraryKind: 'pcb-footprints'
        },
        'Symbols.SchLib': {
            index: 0,
            path: 'SchLib/Symbols.SchLib',
            fileType: 'SchLib',
            libraryKind: 'schematic-symbols'
        }
    })
    assert.deepEqual(model.integratedLibrary.indexes.sourcesByKind, {
        'pcb-footprints': ['Footprints.PcbLib'],
        'schematic-symbols': ['Symbols.SchLib']
    })
    assert.deepEqual(model.integratedLibrary.indexes.modelsByComponent, {
        U_FAKE: [
            { model: 'SYM_FAKE', kind: 'SCH' },
            { model: 'PKG_FAKE', kind: 'PCB' }
        ]
    })
    assert.deepEqual(model.integratedLibrary.indexes.symbolsByComponent, {
        U_FAKE: ['SYM_FAKE']
    })
    assert.deepEqual(model.integratedLibrary.indexes.footprintsByComponent, {
        U_FAKE: ['PKG_FAKE']
    })
})
