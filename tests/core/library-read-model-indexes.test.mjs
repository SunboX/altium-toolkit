// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { IntLibModelParser } from '../../src/core/altium/IntLibModelParser.mjs'
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
