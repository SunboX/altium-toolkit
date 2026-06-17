// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbReviewMetadataBuilder } from '../../src/core/altium/PcbReviewMetadataBuilder.mjs'
import { PcbReviewRouteHighlightProfileBuilder } from '../../src/core/altium/PcbReviewRouteHighlightProfileBuilder.mjs'
import {
    PcbModelParser,
    PcbReviewPolygonRealizationBuilder
} from '../../src/parser.mjs'

/**
 * Creates a minimal printable PCB record.
 * @param {string} sourceStream Source stream name.
 * @param {Record<string, string>} fields Printable fields.
 * @returns {{ raw: string, sourceStream: string, fields: Record<string, string> }}
 */
function record(sourceStream, fields) {
    return {
        raw: Object.entries(fields)
            .map(([key, value]) => key + '=' + value)
            .join('|'),
        sourceStream,
        fields
    }
}

test('PcbModelParser emits route and board-assembly review metadata', () => {
    const model = PcbModelParser.parse(
        'review-board.PcbDoc',
        [
            record('Board6/Data', {
                KIND0: 'Board',
                X1: '0',
                Y1: '0',
                X2: '500',
                Y2: '300',
                LAYER1NAME: 'Top Layer',
                V7_LAYER_1_NAME: 'Top Layer'
            }),
            record('Nets6/Data', {
                NAME: 'PAIR_P',
                NETINDEX: '0'
            }),
            record('Nets6/Data', {
                NAME: 'PAIR_N',
                NETINDEX: '1'
            }),
            record('Classes6/Data', {
                NAME: 'Matched Nets',
                KIND: '0',
                MEMBER0: 'PAIR_P',
                MEMBER1: 'PAIR_N'
            }),
            record('DifferentialPairs6/Data', {
                NAME: 'PAIR_MAIN',
                POSITIVENETNAME: 'PAIR_P',
                NEGATIVENETNAME: 'PAIR_N'
            }),
            record('Classes6/Data', {
                NAME: 'Matched Pairs',
                KIND: '6',
                MEMBER0: 'PAIR_MAIN'
            })
        ],
        {
            streamNames: ['Tracks6/Data', 'Models/Data'],
            binaryPrimitives: {
                tracks: [
                    {
                        primitiveIndex: 4,
                        x1: 0,
                        y1: 0,
                        x2: 100,
                        y2: 0,
                        width: 6,
                        layerId: 1,
                        netIndex: 0
                    },
                    {
                        primitiveIndex: 5,
                        x1: 0,
                        y1: 20,
                        x2: 90,
                        y2: 20,
                        width: 6,
                        layerId: 1,
                        netIndex: 1
                    }
                ],
                arcs: [],
                vias: [],
                pads: [],
                fills: [],
                texts: [],
                regions: [],
                shapeBasedRegions: [],
                boardRegions: []
            },
            embeddedModels: {
                models: [
                    {
                        id: 'body-1',
                        name: 'connector.step',
                        format: 'step',
                        sourceStream: 'Models/0'
                    },
                    {
                        id: 'assembly-1',
                        name: 'board-review.step',
                        format: 'step',
                        sourceStream: 'Models/1'
                    }
                ],
                componentBodies: [{ modelId: 'body-1', name: 'connector.step' }]
            },
            diagnostics: {
                printableRecordCount: 6,
                printableStreamCount: 4,
                binaryPrimitiveCount: 2
            }
        }
    )

    assert.deepEqual(model.pcb.reviewMetadata, {
        schema: 'altium-toolkit.pcb.review-metadata.a1',
        summary: {
            routeGroupCount: 2,
            boardAssemblyViewCount: 1,
            polygonRealizationCount: 0,
            routeHighlightProfileCount: 5,
            drillOverlayCount: 0
        },
        routeGroups: [
            {
                key: 'route-class-matched-nets',
                kind: 'net-class',
                name: 'Matched Nets',
                netNames: ['PAIR_N', 'PAIR_P'],
                layerKeys: ['L1'],
                primitiveKeys: ['track-0', 'track-1'],
                totalLengthMil: 190
            },
            {
                key: 'route-diff-pair-pair-main',
                kind: 'differential-pair',
                name: 'PAIR_MAIN',
                netNames: ['PAIR_P', 'PAIR_N'],
                layerKeys: ['L1'],
                primitiveKeys: ['track-0', 'track-1'],
                totalLengthMil: 190,
                skewLengthMil: 10,
                classes: ['Matched Pairs']
            }
        ],
        routeHighlightProfiles: [
            {
                key: 'highlight-diff-pair-pair-main',
                selectorKind: 'differential-pair',
                name: 'PAIR_MAIN',
                netNames: ['PAIR_N', 'PAIR_P'],
                minRoutedLengthMil: 190,
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-0', 'track-1'],
                        routedLengthMil: 190
                    }
                ],
                style: {
                    highlightColor: '#dc2626',
                    contextColor: '#475569'
                }
            },
            {
                key: 'highlight-diff-pair-class-matched-pairs',
                selectorKind: 'differential-pair-class',
                name: 'Matched Pairs',
                netNames: ['PAIR_N', 'PAIR_P'],
                minRoutedLengthMil: 190,
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-0', 'track-1'],
                        routedLengthMil: 190
                    }
                ],
                style: {
                    highlightColor: '#7c3aed',
                    contextColor: '#475569'
                }
            },
            {
                key: 'highlight-net-class-matched-nets',
                selectorKind: 'net-class',
                name: 'Matched Nets',
                netNames: ['PAIR_N', 'PAIR_P'],
                minRoutedLengthMil: 190,
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-0', 'track-1'],
                        routedLengthMil: 190
                    }
                ],
                style: {
                    highlightColor: '#d97706',
                    contextColor: '#475569'
                }
            },
            {
                key: 'highlight-net-pair-n',
                selectorKind: 'net',
                name: 'PAIR_N',
                netNames: ['PAIR_N'],
                minRoutedLengthMil: 90,
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-1'],
                        routedLengthMil: 90
                    }
                ],
                style: {
                    highlightColor: '#2563eb',
                    contextColor: '#475569'
                }
            },
            {
                key: 'highlight-net-pair-p',
                selectorKind: 'net',
                name: 'PAIR_P',
                netNames: ['PAIR_P'],
                minRoutedLengthMil: 100,
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-0'],
                        routedLengthMil: 100
                    }
                ],
                style: {
                    highlightColor: '#2563eb',
                    contextColor: '#475569'
                }
            }
        ],
        polygonRealizations: [],
        drillReview: {
            overlays: [],
            layerDrawOrder: [
                {
                    layerKey: 'L1',
                    layerId: 1,
                    displayName: 'Top Layer',
                    role: 'surface',
                    drawOrder: 0
                }
            ]
        },
        boardAssemblyViews: [
            {
                key: 'board-assembly-0-board-review-step',
                name: 'board-review.step',
                format: 'step',
                sourceStream: 'Models/1',
                modelId: 'assembly-1',
                reason: 'embedded model is not referenced by component bodies'
            }
        ],
        indexes: {
            routeGroupsByName: {
                'Matched Nets': 0,
                PAIR_MAIN: 1
            },
            routeHighlightProfilesByName: {
                PAIR_MAIN: 0,
                'Matched Pairs': 1,
                'Matched Nets': 2,
                PAIR_N: 3,
                PAIR_P: 4
            },
            primitiveKeysByNet: {
                PAIR_N: ['track-1'],
                PAIR_P: ['track-0']
            },
            polygonRealizationsByKey: {},
            drillOverlaysByOwnerKey: {},
            boardAssemblyViewsByName: {
                'board-review.step': 0
            }
        }
    })
})

test('PcbReviewRouteHighlightProfileBuilder indexes route rows without repeated net scans', () => {
    const routeRows = Array.from({ length: 25 }, (_entry, index) => ({
        netName: 'NET_' + index,
        layerParticipation: [
            {
                layerKey: 'L1',
                totalLengthMil: index + 1
            }
        ],
        connectedRouteGroups: [
            {
                layerKeys: ['L1'],
                primitiveKeys: ['track-' + index]
            }
        ]
    }))
    let filterCalls = 0
    const byNet = new Proxy(routeRows, {
        get(target, property, receiver) {
            if (property === 'filter') filterCalls += 1
            return Reflect.get(target, property, receiver)
        }
    })

    const profiles = PcbReviewRouteHighlightProfileBuilder.build({
        byNet,
        classes: [
            {
                name: 'All Signals',
                netNames: routeRows.map((row) => row.netName)
            }
        ],
        differentialPairs: []
    })

    assert.equal(profiles.length, 26)
    assert.equal(filterCalls, 0)
})

test('PcbReviewMetadataBuilder indexes route groups without repeated net scans', () => {
    const routeRows = Array.from({ length: 20 }, (_entry, index) => ({
        netName: 'NET_' + index,
        layers: ['L1'],
        connectedRouteGroups: [
            {
                primitiveKeys: ['track-' + index]
            }
        ]
    }))
    let filterCalls = 0
    const byNet = new Proxy(routeRows, {
        get(target, property, receiver) {
            if (property === 'filter') filterCalls += 1
            return Reflect.get(target, property, receiver)
        }
    })

    const reviewMetadata = PcbReviewMetadataBuilder.build({
        routeAnalysis: {
            byNet,
            classes: [
                {
                    name: 'All Signals',
                    netNames: routeRows.map((row) => row.netName),
                    totalLengthMil: 20
                }
            ],
            differentialPairs: [
                {
                    name: 'PAIR_1',
                    positiveNetName: 'NET_1',
                    negativeNetName: 'NET_2'
                }
            ]
        }
    })

    assert.equal(reviewMetadata.summary.routeGroupCount, 2)
    assert.equal(filterCalls, 0)
})

test('PcbReviewPolygonRealizationBuilder is exported for direct review sidecars', () => {
    const rows = PcbReviewPolygonRealizationBuilder.build({
        layers: [{ id: 1, name: 'Top Layer' }],
        polygons: [
            {
                layer: 'Top Layer',
                polygonIndex: 2
            }
        ],
        tracks: [
            {
                layerId: 1,
                polygonIndex: 2
            }
        ]
    })

    assert.deepEqual(rows, [
        {
            key: 'polygon-realization-2-main-none',
            polygonIndex: 2,
            classification: 'copper-pour',
            layerKeys: ['L1'],
            primitiveKeys: ['polygon-0', 'track-0'],
            realizedPrimitiveKinds: ['polygon', 'track']
        }
    ])
})

test('PcbReviewRouteHighlightProfileBuilder sorts route keys without locale collation', () => {
    const originalLocaleCompare = String.prototype.localeCompare
    let localeCompareCalls = 0
    let profiles = []

    String.prototype.localeCompare = function countedLocaleCompare(...args) {
        localeCompareCalls += 1
        return originalLocaleCompare.apply(this, args)
    }

    try {
        profiles = PcbReviewRouteHighlightProfileBuilder.build({
            byNet: [
                {
                    netName: 'NET_2',
                    layerParticipation: [
                        {
                            layerKey: 'L2',
                            totalLengthMil: 1
                        },
                        {
                            layerKey: 'L10',
                            totalLengthMil: 1
                        },
                        {
                            layerKey: 'L1',
                            totalLengthMil: 3
                        }
                    ],
                    connectedRouteGroups: [
                        {
                            layerKeys: ['L2', 'L10', 'L1'],
                            primitiveKeys: [
                                'track-10',
                                'track-2',
                                'track-1',
                                'track-2'
                            ]
                        }
                    ]
                }
            ],
            classes: [
                {
                    name: 'Class 10',
                    netNames: ['NET_2']
                }
            ],
            differentialPairs: []
        })
    } finally {
        String.prototype.localeCompare = originalLocaleCompare
    }

    const netProfile = profiles.find((profile) => profile.name === 'NET_2')
    assert.deepEqual(
        netProfile.layerGroups.map((group) => group.layerKey),
        ['L1', 'L2', 'L10']
    )
    assert.deepEqual(netProfile.layerGroups[0].primitiveKeys, [
        'track-1',
        'track-2',
        'track-10'
    ])
    assert.equal(localeCompareCalls, 0)
})

test('PcbReviewMetadataBuilder sorts primitive keys without locale collation', () => {
    const originalLocaleCompare = String.prototype.localeCompare
    let localeCompareCalls = 0
    let reviewMetadata = null

    String.prototype.localeCompare = function countedLocaleCompare(...args) {
        localeCompareCalls += 1
        return originalLocaleCompare.apply(this, args)
    }

    try {
        reviewMetadata = PcbReviewMetadataBuilder.build({
            routeAnalysis: {
                byNet: [
                    {
                        netName: 'NET_2',
                        layers: ['L2', 'L10', 'L1'],
                        connectedRouteGroups: [
                            {
                                primitiveKeys: [
                                    'track-10',
                                    'track-2',
                                    'track-1',
                                    'track-2'
                                ]
                            }
                        ]
                    }
                ],
                classes: [
                    {
                        name: 'Class 10',
                        netNames: ['NET_2'],
                        totalLengthMil: 3
                    }
                ],
                differentialPairs: []
            }
        })
    } finally {
        String.prototype.localeCompare = originalLocaleCompare
    }

    assert.deepEqual(reviewMetadata.routeGroups[0].layerKeys, [
        'L1',
        'L2',
        'L10'
    ])
    assert.deepEqual(reviewMetadata.routeGroups[0].primitiveKeys, [
        'track-1',
        'track-2',
        'track-10'
    ])
    assert.equal(localeCompareCalls, 0)
})

test('PcbModelParser emits polygon, route-highlight, and drill review sidecars', () => {
    const model = PcbModelParser.parse(
        'visual-review.PcbDoc',
        [
            record('Board6/Data', {
                KIND0: 'Board',
                X1: '0',
                Y1: '0',
                X2: '600',
                Y2: '400',
                LAYER1NAME: 'Top Layer',
                LAYER2NAME: 'Mid Layer',
                LAYER33NAME: 'Top Overlay'
            }),
            record('Polygons6/Data', {
                LAYER: 'Top Layer',
                POLYGONINDEX: '7',
                SUBPOLYINDEX: '2',
                UNIONINDEX: '5',
                ISCUTOUT: 'T',
                VX0: '10',
                VY0: '10',
                KIND0: '0',
                VX1: '100',
                VY1: '10',
                KIND1: '0',
                VX2: '100',
                VY2: '80',
                KIND2: '0',
                VX3: '10',
                VY3: '80',
                KIND3: '0'
            }),
            record('Nets6/Data', {
                NAME: 'NET_A',
                NETINDEX: '0'
            }),
            record('Nets6/Data', {
                NAME: 'NET_B',
                NETINDEX: '1'
            }),
            record('Classes6/Data', {
                NAME: 'Signal Nets',
                KIND: '0',
                MEMBER0: 'NET_A',
                MEMBER1: 'NET_B'
            }),
            record('Classes6/Data', {
                NAME: 'Pair Group',
                KIND: '6',
                MEMBER0: 'PAIR_AB'
            }),
            record('DifferentialPairs6/Data', {
                NAME: 'PAIR_AB',
                POSITIVENETNAME: 'NET_A',
                NEGATIVENETNAME: 'NET_B'
            })
        ],
        {
            streamNames: ['Tracks6/Data', 'Vias6/Data', 'Pads6/Data'],
            binaryPrimitives: {
                tracks: [
                    {
                        primitiveIndex: 10,
                        x1: 10,
                        y1: 20,
                        x2: 110,
                        y2: 20,
                        width: 6,
                        layerId: 1,
                        netIndex: 0,
                        polygonIndex: 7,
                        subpolygonIndex: 2,
                        unionIndex: 5
                    },
                    {
                        primitiveIndex: 11,
                        x1: 10,
                        y1: 40,
                        x2: 70,
                        y2: 40,
                        width: 6,
                        layerId: 2,
                        netIndex: 1
                    }
                ],
                arcs: [],
                vias: [
                    {
                        primitiveIndex: 12,
                        x: 110,
                        y: 20,
                        diameter: 24,
                        holeDiameter: 10,
                        layerId: 1,
                        netIndex: 0,
                        ipc4761Type: 7
                    }
                ],
                pads: [
                    {
                        primitiveIndex: 13,
                        x: 150,
                        y: 20,
                        sizeTopX: 30,
                        sizeTopY: 30,
                        holeDiameter: 12,
                        holeSlotLength: 36,
                        isPlated: false,
                        layerId: 1,
                        netIndex: 0,
                        designator: '1'
                    }
                ],
                fills: [],
                texts: [],
                regions: [
                    {
                        primitiveIndex: 14,
                        layerId: 1,
                        netIndex: 0,
                        polygonIndex: 7,
                        subpolyIndex: 2,
                        unionIndex: 5,
                        isCutout: true
                    }
                ],
                shapeBasedRegions: [],
                boardRegions: []
            },
            diagnostics: {
                printableRecordCount: 7,
                printableStreamCount: 5,
                binaryPrimitiveCount: 5
            }
        }
    )

    assert.deepEqual(model.pcb.reviewMetadata.summary, {
        routeGroupCount: 2,
        boardAssemblyViewCount: 0,
        polygonRealizationCount: 1,
        routeHighlightProfileCount: 5,
        drillOverlayCount: 2
    })
    assert.deepEqual(model.pcb.reviewMetadata.polygonRealizations, [
        {
            key: 'polygon-realization-7-2-5',
            polygonIndex: 7,
            subpolygonIndex: 2,
            unionIndex: 5,
            classification: 'cutout',
            layerKeys: ['L1'],
            primitiveKeys: ['polygon-0', 'region-0', 'track-0'],
            realizedPrimitiveKinds: ['polygon', 'region', 'track']
        }
    ])
    assert.deepEqual(
        model.pcb.reviewMetadata.routeHighlightProfiles.map((profile) => ({
            key: profile.key,
            selectorKind: profile.selectorKind,
            name: profile.name,
            netNames: profile.netNames,
            layerGroups: profile.layerGroups
        })),
        [
            {
                key: 'highlight-diff-pair-pair-ab',
                selectorKind: 'differential-pair',
                name: 'PAIR_AB',
                netNames: ['NET_A', 'NET_B'],
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-0'],
                        routedLengthMil: 100
                    },
                    {
                        layerKey: 'L2',
                        primitiveKeys: ['track-1'],
                        routedLengthMil: 60
                    }
                ]
            },
            {
                key: 'highlight-diff-pair-class-pair-group',
                selectorKind: 'differential-pair-class',
                name: 'Pair Group',
                netNames: ['NET_A', 'NET_B'],
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-0'],
                        routedLengthMil: 100
                    },
                    {
                        layerKey: 'L2',
                        primitiveKeys: ['track-1'],
                        routedLengthMil: 60
                    }
                ]
            },
            {
                key: 'highlight-net-class-signal-nets',
                selectorKind: 'net-class',
                name: 'Signal Nets',
                netNames: ['NET_A', 'NET_B'],
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-0'],
                        routedLengthMil: 100
                    },
                    {
                        layerKey: 'L2',
                        primitiveKeys: ['track-1'],
                        routedLengthMil: 60
                    }
                ]
            },
            {
                key: 'highlight-net-net-a',
                selectorKind: 'net',
                name: 'NET_A',
                netNames: ['NET_A'],
                layerGroups: [
                    {
                        layerKey: 'L1',
                        primitiveKeys: ['track-0'],
                        routedLengthMil: 100
                    }
                ]
            },
            {
                key: 'highlight-net-net-b',
                selectorKind: 'net',
                name: 'NET_B',
                netNames: ['NET_B'],
                layerGroups: [
                    {
                        layerKey: 'L2',
                        primitiveKeys: ['track-1'],
                        routedLengthMil: 60
                    }
                ]
            }
        ]
    )
    assert.deepEqual(model.pcb.reviewMetadata.drillReview.overlays, [
        {
            elementKey: 'pcb-via-hole-0',
            ownerKind: 'via',
            ownerKey: 'via-0',
            holeKind: 'round',
            plating: 'plated',
            renderState: 'capped',
            overlayKind: 'filled-or-capped-via',
            layerKeys: ['L1']
        },
        {
            elementKey: 'pcb-pad-hole-0',
            ownerKind: 'pad',
            ownerKey: 'pad-0',
            holeKind: 'slot',
            plating: 'non-plated',
            renderState: 'open',
            overlayKind: 'non-plated-slot',
            layerKeys: ['L1']
        }
    ])
    assert.deepEqual(model.pcb.reviewMetadata.drillReview.layerDrawOrder, [
        {
            layerKey: 'L1',
            layerId: 1,
            displayName: 'Top Layer',
            role: 'surface',
            drawOrder: 0
        },
        {
            layerKey: 'L2',
            layerId: 2,
            displayName: 'Mid Layer',
            role: 'internal',
            drawOrder: 1,
            internalOrder: 1
        },
        {
            layerKey: 'L33',
            layerId: 33,
            displayName: 'Top Overlay',
            role: 'overlay',
            drawOrder: 2
        }
    ])
})

test('PcbModelParser emits placed-footprint extraction manifests', () => {
    const model = PcbModelParser.parse(
        'placed-footprints.PcbDoc',
        [
            record('Board6/Data', {
                KIND0: 'Board',
                X1: '0',
                Y1: '0',
                X2: '400',
                Y2: '200',
                V7_LAYER_1_NAME: 'Top Layer'
            }),
            record('Components6/Data', {
                SOURCEDESIGNATOR: 'U1',
                PATTERN: 'PKG_FAKE_A',
                SOURCELIBREFERENCE: 'CTRL_FAKE',
                X: '100mil',
                Y: '80mil',
                LAYER: 'TOP'
            })
        ],
        {
            streamNames: ['Pads6/Data', 'Tracks6/Data'],
            binaryPrimitives: {
                pads: [
                    {
                        primitiveIndex: 0,
                        componentIndex: 0,
                        designator: '1',
                        layerId: 1,
                        layerName: 'Top Layer',
                        x: 95,
                        y: 80,
                        sizeTopX: 20,
                        sizeTopY: 30
                    }
                ],
                tracks: [
                    {
                        primitiveIndex: 1,
                        componentIndex: 0,
                        layerId: 1,
                        layerName: 'Top Layer',
                        x1: 80,
                        y1: 70,
                        x2: 120,
                        y2: 70,
                        width: 5
                    }
                ],
                arcs: [],
                vias: [],
                fills: [],
                texts: [],
                regions: [],
                shapeBasedRegions: [],
                boardRegions: []
            },
            embeddedModels: {
                models: [
                    {
                        id: 'body-1',
                        name: 'package.step',
                        format: 'step',
                        sourceStream: 'Models/0'
                    }
                ],
                componentBodies: [
                    {
                        componentIndex: 0,
                        modelId: 'body-1',
                        name: 'package.step',
                        sourceStream: 'ComponentBodies6/Data',
                        positionMil: { x: 100, y: 80 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 0 }
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

    assert.deepEqual(model.pcb.footprintExtractionManifest, {
        schema: 'altium-toolkit.pcb.placed-footprint-extraction.a1',
        sourceDocument: 'placed-footprints.PcbDoc',
        summary: {
            componentCount: 1,
            extractableFootprintCount: 1,
            embeddedAssetCount: 1
        },
        outputs: [
            {
                kind: 'placed-footprint',
                footprintKey: 'footprint-extract-0-u1-pkg-fake-a',
                designator: 'U1',
                pattern: 'PKG_FAKE_A',
                componentIndex: 0,
                outputLibraryKey:
                    'pcb-extract/footprint-extract-0-u1-pkg-fake-a.PcbLib',
                renderManifestKey:
                    'pcb-extract/footprint-extract-0-u1-pkg-fake-a.render.json',
                primitiveCounts: {
                    pads: 1,
                    tracks: 1,
                    arcs: 0,
                    fills: 0,
                    vias: 0,
                    regions: 0,
                    shapeBasedRegions: 0,
                    texts: 0,
                    componentBodies: 1
                },
                layers: [
                    {
                        layerKey: 'L1',
                        layerId: 1,
                        displayName: 'Top Layer'
                    }
                ],
                embeddedAssets: [
                    {
                        key: 'body-1',
                        format: 'step',
                        sourceStream: 'Models/0',
                        name: 'package.step'
                    }
                ],
                diagnostics: []
            }
        ],
        indexes: {
            outputsByDesignator: {
                U1: 0
            },
            outputsByPattern: {
                PKG_FAKE_A: [0]
            }
        }
    })
})
