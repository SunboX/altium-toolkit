// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    LibraryCompatibilityReportBuilder,
    LibraryQaReportBuilder
} from '../../src/legacy-parser.mjs'

test('LibraryCompatibilityReportBuilder classifies schematic pin compatibility', () => {
    const report = LibraryCompatibilityReportBuilder.build({
        schematicLibraries: [
            {
                fileName: 'logic-symbols.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'CTRL_FAKE',
                            pins: [
                                {
                                    designator: '1',
                                    name: 'CLK',
                                    partId: 'A',
                                    electricalType: 0,
                                    symbolInner: 'clock',
                                    symbolOuter: 'dot'
                                },
                                {
                                    designator: '2',
                                    name: 'VCC',
                                    partId: 'A',
                                    electricalType: 'Power',
                                    hidden: true
                                },
                                {
                                    designator: '3',
                                    name: 'GND',
                                    partId: 'A',
                                    electricalType: 'Passive',
                                    hidden: true
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.library.compatibility.a1')
    assert.deepEqual(report.summary, {
        schematicLibraryCount: 1,
        pcbLibraryCount: 0,
        symbolPinCount: 3,
        hiddenPinCount: 2,
        symbolBoundsCount: 0,
        fieldPlacementRiskCount: 0,
        footprintBoundsCount: 0,
        padDiagnosticCount: 0,
        modelSuggestionCount: 0,
        issuesBySeverity: {
            error: 0,
            warning: 0,
            info: 2
        },
        issueCount: 2
    })
    assert.deepEqual(report.symbolPins, [
        {
            libraryFileName: 'logic-symbols.SchLib',
            symbolName: 'CTRL_FAKE',
            designator: '1',
            name: 'CLK',
            partId: 'A',
            electricalRole: 'input',
            edgeShape: 'inverted-clock',
            hidden: false,
            labelVisibility: 'visible'
        },
        {
            libraryFileName: 'logic-symbols.SchLib',
            symbolName: 'CTRL_FAKE',
            designator: '2',
            name: 'VCC',
            partId: 'A',
            electricalRole: 'power',
            edgeShape: 'line',
            hidden: true,
            labelVisibility: 'hidden',
            placementHint: 'top'
        },
        {
            libraryFileName: 'logic-symbols.SchLib',
            symbolName: 'CTRL_FAKE',
            designator: '3',
            name: 'GND',
            partId: 'A',
            electricalRole: 'passive',
            edgeShape: 'line',
            hidden: true,
            labelVisibility: 'hidden',
            placementHint: 'bottom'
        }
    ])
    assert.deepEqual(report.hiddenPins, [
        {
            libraryFileName: 'logic-symbols.SchLib',
            symbolName: 'CTRL_FAKE',
            designator: '2',
            name: 'VCC',
            partId: 'A',
            placementHint: 'top',
            reason: 'hidden pin carries a power-oriented label'
        },
        {
            libraryFileName: 'logic-symbols.SchLib',
            symbolName: 'CTRL_FAKE',
            designator: '3',
            name: 'GND',
            partId: 'A',
            placementHint: 'bottom',
            reason: 'hidden pin carries a reference-oriented label'
        }
    ])
    assert.deepEqual(
        report.issues.map((issue) => ({
            code: issue.code,
            severity: issue.severity,
            target: issue.target
        })),
        [
            {
                code: 'library.compatibility.hidden-pin',
                severity: 'info',
                target: 'CTRL_FAKE:2'
            },
            {
                code: 'library.compatibility.hidden-pin',
                severity: 'info',
                target: 'CTRL_FAKE:3'
            }
        ]
    )
})

test('LibraryCompatibilityReportBuilder reports symbol bounds and field placement risks', () => {
    const report = LibraryCompatibilityReportBuilder.build({
        schematicLibraries: [
            {
                fileName: 'bounded-symbols.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'FIELD_FAKE',
                            pins: [
                                {
                                    designator: '1',
                                    name: 'IN',
                                    x: 0,
                                    y: 20,
                                    length: 30,
                                    orientation: 'left',
                                    electricalType: 0
                                },
                                {
                                    designator: '2',
                                    name: 'OUT',
                                    x: 100,
                                    y: 20,
                                    length: 30,
                                    orientation: 'right',
                                    electricalType: 2
                                }
                            ],
                            rectangles: [
                                {
                                    x: 0,
                                    y: 0,
                                    width: 100,
                                    height: 40
                                }
                            ],
                            texts: [
                                {
                                    name: 'Designator',
                                    text: 'U?',
                                    x: 20,
                                    y: 20,
                                    height: 10
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    })

    assert.deepEqual(report.symbolBounds, [
        {
            libraryFileName: 'bounded-symbols.SchLib',
            symbolName: 'FIELD_FAKE',
            bounds: {
                minX: -30,
                minY: 0,
                maxX: 130,
                maxY: 40,
                width: 160,
                height: 40
            },
            bodyBounds: {
                minX: 0,
                minY: 0,
                maxX: 100,
                maxY: 40,
                width: 100,
                height: 40
            },
            pinBounds: {
                minX: -30,
                minY: 20,
                maxX: 130,
                maxY: 20,
                width: 160,
                height: 0
            },
            fieldAnchors: {
                designator: {
                    x: -30,
                    y: 50,
                    horizontal: 'left',
                    vertical: 'bottom'
                },
                comment: {
                    x: -30,
                    y: -10,
                    horizontal: 'left',
                    vertical: 'top'
                }
            },
            sourceCounts: {
                pins: 2,
                bodyPrimitives: 1,
                texts: 1
            }
        }
    ])
    assert.deepEqual(report.fieldPlacementRisks, [
        {
            code: 'library.compatibility.symbol-field-inside-bounds',
            severity: 'warning',
            target: 'FIELD_FAKE:Designator',
            libraryFileName: 'bounded-symbols.SchLib',
            symbolName: 'FIELD_FAKE',
            fieldName: 'Designator',
            fieldText: 'U?',
            position: { x: 20, y: 20 },
            reason: 'visible symbol field is placed inside the symbol bounds'
        }
    ])
    assert.deepEqual(
        report.issues.map((issue) => issue.code),
        ['library.compatibility.symbol-field-inside-bounds']
    )
})

test('LibraryCompatibilityReportBuilder reports footprint bounds and package hints', () => {
    const report = LibraryCompatibilityReportBuilder.build({
        pcbLibraries: [
            {
                fileName: 'geometry-footprints.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: 'QFN_2X3_P0.50_1EP',
                            pads: [
                                {
                                    designator: '1',
                                    x: 0,
                                    y: 0,
                                    sizeTopX: 100,
                                    sizeTopY: 50,
                                    sizeMidX: 100,
                                    sizeMidY: 50,
                                    sizeBottomX: 100,
                                    sizeBottomY: 50,
                                    shapeTopName: 'rectangular',
                                    shapeMidName: 'rectangular',
                                    shapeBottomName: 'rectangular',
                                    rotation: 90,
                                    layerId: 1
                                },
                                {
                                    designator: '2',
                                    x: 100,
                                    y: 0,
                                    sizeTopX: 40,
                                    sizeTopY: 30,
                                    sizeMidX: 40,
                                    sizeMidY: 30,
                                    sizeBottomX: 50,
                                    sizeBottomY: 30,
                                    shapeTopName: 'rectangular',
                                    shapeMidName: 'rectangular',
                                    shapeBottomName: 'rectangular',
                                    rotation: 0,
                                    layerId: 74
                                },
                                {
                                    designator: '3',
                                    x: 0,
                                    y: 100,
                                    sizeTopX: 0,
                                    sizeTopY: 20,
                                    sizeBottomX: 0,
                                    sizeBottomY: 20,
                                    shapeTopName: 'unknown-99',
                                    shapeBottomName: 'rectangular',
                                    rotation: 0,
                                    layerId: 1
                                }
                            ],
                            tracks: [
                                {
                                    x1: -10,
                                    y1: -10,
                                    x2: 10,
                                    y2: -10,
                                    width: 4
                                }
                            ],
                            embeddedModels: [],
                            componentBodies: []
                        }
                    ]
                }
            }
        ]
    })

    assert.deepEqual(report.summary, {
        schematicLibraryCount: 0,
        pcbLibraryCount: 1,
        symbolPinCount: 0,
        hiddenPinCount: 0,
        symbolBoundsCount: 0,
        fieldPlacementRiskCount: 0,
        footprintBoundsCount: 1,
        padDiagnosticCount: 3,
        modelSuggestionCount: 1,
        issuesBySeverity: {
            error: 0,
            warning: 3,
            info: 1
        },
        issueCount: 4
    })
    assert.deepEqual(report.footprintBounds, [
        {
            libraryFileName: 'geometry-footprints.PcbLib',
            footprintName: 'QFN_2X3_P0.50_1EP',
            bounds: {
                minX: -25,
                minY: -50,
                maxX: 125,
                maxY: 110,
                width: 150,
                height: 160
            },
            courtyard: {
                minX: -27,
                minY: -52,
                maxX: 127,
                maxY: 112,
                width: 154,
                height: 164,
                marginMil: 2
            },
            sourceCounts: {
                pads: 3,
                tracks: 1,
                arcs: 0,
                fills: 0,
                regions: 0,
                texts: 0
            }
        }
    ])
    assert.deepEqual(
        report.padDiagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            target: diagnostic.target,
            padDesignator: diagnostic.padDesignator
        })),
        [
            {
                code: 'library.compatibility.pad-top-bottom-size-mismatch',
                target: 'QFN_2X3_P0.50_1EP:2',
                padDesignator: '2'
            },
            {
                code: 'library.compatibility.pad-zero-size',
                target: 'QFN_2X3_P0.50_1EP:3',
                padDesignator: '3'
            },
            {
                code: 'library.compatibility.pad-unknown-shape',
                target: 'QFN_2X3_P0.50_1EP:3',
                padDesignator: '3'
            }
        ]
    )
    assert.deepEqual(report.modelSuggestions, [
        {
            libraryFileName: 'geometry-footprints.PcbLib',
            footprintName: 'QFN_2X3_P0.50_1EP',
            packageClass: 'QFN',
            keys: ['QFN', '2X3', 'ARRAY', 'PITCH-0.50', '1EP', 'EP'],
            pinOneDesignator: '1',
            pinOnePosition: { x: 0, y: 0 },
            rotationHint: 0,
            reason: 'footprint has no embedded or body-level model reference'
        }
    ])
})

test('LibraryCompatibilityReportBuilder diagnoses custom pad outlines and model rotation hints', () => {
    const report = LibraryCompatibilityReportBuilder.build({
        pcbLibraries: [
            {
                fileName: 'outline-footprints.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: 'SOT-23-5_P0.95_A1',
                            pads: [
                                {
                                    designator: 'A1',
                                    x: -30,
                                    y: 20,
                                    sizeTopX: 20,
                                    sizeTopY: 20,
                                    sizeBottomX: 20,
                                    sizeBottomY: 20,
                                    shapeTopName: 'rectangular',
                                    shapeBottomName: 'rectangular',
                                    layerId: 1,
                                    customShape: {
                                        layers: [
                                            {
                                                layer: 'Top Layer',
                                                layerId: 1,
                                                regions: [
                                                    {
                                                        points: [
                                                            { x: -40, y: 10 },
                                                            { x: -20, y: 10 },
                                                            { x: -20, y: 30 },
                                                            { x: -40, y: 30 }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                layer: 'Bottom Layer',
                                                layerId: 74,
                                                regions: []
                                            }
                                        ]
                                    }
                                },
                                {
                                    designator: '2',
                                    x: 30,
                                    y: -20,
                                    sizeTopX: 20,
                                    sizeTopY: 20,
                                    sizeBottomX: 20,
                                    sizeBottomY: 20,
                                    shapeTopName: 'rectangular',
                                    shapeBottomName: 'rectangular',
                                    layerId: 1,
                                    customShape: {
                                        layers: [
                                            {
                                                layer: 'Top Layer',
                                                layerId: 1,
                                                regions: [
                                                    {
                                                        points: [
                                                            { x: 0, y: 0 },
                                                            { x: 10, y: 0 },
                                                            { x: 20, y: 0 }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            ],
                            embeddedModels: [],
                            componentBodies: []
                        }
                    ]
                }
            }
        ]
    })

    assert.deepEqual(
        report.padDiagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: diagnostic.severity,
            target: diagnostic.target,
            padDesignator: diagnostic.padDesignator
        })),
        [
            {
                code: 'library.compatibility.pad-custom-shape-outline',
                severity: 'info',
                target: 'SOT-23-5_P0.95_A1:A1',
                padDesignator: 'A1'
            },
            {
                code: 'library.compatibility.pad-custom-shape-missing-geometry',
                severity: 'warning',
                target: 'SOT-23-5_P0.95_A1:A1',
                padDesignator: 'A1'
            },
            {
                code: 'library.compatibility.pad-custom-shape-side-asymmetry',
                severity: 'warning',
                target: 'SOT-23-5_P0.95_A1:A1',
                padDesignator: 'A1'
            },
            {
                code: 'library.compatibility.pad-custom-shape-outline',
                severity: 'info',
                target: 'SOT-23-5_P0.95_A1:2',
                padDesignator: '2'
            },
            {
                code: 'library.compatibility.pad-custom-shape-zero-area',
                severity: 'warning',
                target: 'SOT-23-5_P0.95_A1:2',
                padDesignator: '2'
            },
            {
                code: 'library.compatibility.pad-custom-shape-side-asymmetry',
                severity: 'warning',
                target: 'SOT-23-5_P0.95_A1:2',
                padDesignator: '2'
            }
        ]
    )
    assert.deepEqual(report.modelSuggestions, [
        {
            libraryFileName: 'outline-footprints.PcbLib',
            footprintName: 'SOT-23-5_P0.95_A1',
            packageClass: 'SOT',
            keys: ['SOT', '23', '5', 'PITCH-0.95', 'A1'],
            pinOneDesignator: 'A1',
            pinOnePosition: { x: -30, y: 20 },
            rotationHint: -90,
            reason: 'footprint has no embedded or body-level model reference'
        }
    ])
})

test('LibraryQaReportBuilder composes compatibility issues when present', () => {
    const report = LibraryQaReportBuilder.build({
        schematicLibraries: [
            {
                fileName: 'logic-symbols.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'POWER_FAKE',
                            pins: [
                                {
                                    designator: '1',
                                    name: 'VDD',
                                    electricalType: 'Power',
                                    hidden: true
                                }
                            ]
                        }
                    ]
                }
            }
        ],
        pcbLibraries: [
            {
                fileName: 'footprints.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: 'SOIC_P1.27',
                            pads: [
                                {
                                    designator: '1',
                                    x: 0,
                                    y: 0,
                                    sizeTopX: 20,
                                    sizeTopY: 40,
                                    sizeBottomX: 24,
                                    sizeBottomY: 40,
                                    shapeTopName: 'rectangular',
                                    shapeBottomName: 'rectangular',
                                    layerId: 74
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.summary.compatibilityIssueCount, 3)
    assert.deepEqual(report.summary.issuesBySeverity, {
        error: 0,
        warning: 1,
        info: 2
    })
    assert.deepEqual(
        report.issues.map((issue) => issue.code),
        [
            'library.compatibility.hidden-pin',
            'library.compatibility.pad-top-bottom-size-mismatch',
            'library.compatibility.model-name-suggestion'
        ]
    )
    assert.deepEqual(report.compatibility.summary, {
        schematicLibraryCount: 1,
        pcbLibraryCount: 1,
        symbolPinCount: 1,
        hiddenPinCount: 1,
        symbolBoundsCount: 0,
        fieldPlacementRiskCount: 0,
        footprintBoundsCount: 1,
        padDiagnosticCount: 1,
        modelSuggestionCount: 1,
        issuesBySeverity: {
            error: 0,
            warning: 1,
            info: 2
        },
        issueCount: 3
    })
})
