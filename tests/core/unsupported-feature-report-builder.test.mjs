// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies unsupported feature reports collect preserved-but-not-modeled
 * records and diagnostics across parser roots.
 */
test('UnsupportedFeatureReportBuilder summarizes unsupported parser features', async () => {
    const { UnsupportedFeatureReportBuilder } =
        await import('../../src/parser.mjs')

    assert.equal(typeof UnsupportedFeatureReportBuilder, 'function')

    const report = UnsupportedFeatureReportBuilder.build({
        models: [
            {
                fileName: 'summary.SchDoc',
                schematic: {
                    recordTypes: [
                        {
                            recordType: 13,
                            name: 'line',
                            family: 'graphic',
                            supported: true,
                            count: 1
                        },
                        {
                            recordType: 999,
                            name: 'unknown-999',
                            family: 'unknown',
                            supported: false,
                            count: 2
                        }
                    ],
                    opaqueRecords: [
                        {
                            sourceStream: 'FileHeader',
                            frameType: 2,
                            recordIndex: 6,
                            byteLength: 12
                        }
                    ]
                },
                diagnostics: [
                    {
                        code: 'parser.unsupported-feature',
                        severity: 'warning',
                        message: 'Parser preserved an unknown record.',
                        sourceStream: 'FileHeader',
                        recordType: 999
                    }
                ]
            }
        ],
        rawRecords: [
            {
                fileName: 'summary.PcbDoc',
                sourceStream: 'Unknown6/Data',
                family: 'unknown',
                type: 'unknown',
                byteLength: 9,
                supported: false,
                parsed: false
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.unsupported-features.a1')
    assert.deepEqual(report.summary, {
        modelCount: 1,
        unsupportedRecordTypeCount: 1,
        rawRecordCount: 1,
        opaqueRecordCount: 1,
        diagnosticCount: 1,
        edgeCaseCount: 0,
        itemCount: 4,
        status: 'unsupported'
    })
    assert.deepEqual(report.recordTypes, [
        {
            fileName: 'summary.SchDoc',
            domain: 'schematic',
            recordType: 999,
            name: 'unknown-999',
            family: 'unknown',
            count: 2
        }
    ])
    assert.deepEqual(report.rawRecords, [
        {
            fileName: 'summary.PcbDoc',
            domain: 'pcb',
            sourceStream: 'Unknown6/Data',
            family: 'unknown',
            type: 'unknown',
            byteLength: 9,
            supported: false,
            parsed: false
        }
    ])
    assert.deepEqual(report.opaqueRecords, [
        {
            fileName: 'summary.SchDoc',
            domain: 'schematic',
            sourceStream: 'FileHeader',
            frameType: 2,
            recordIndex: 6,
            byteLength: 12
        }
    ])
    assert.deepEqual(report.diagnostics, [
        {
            fileName: 'summary.SchDoc',
            code: 'parser.unsupported-feature',
            severity: 'warning',
            message: 'Parser preserved an unknown record.',
            sourceStream: 'FileHeader',
            recordType: 999
        }
    ])
    assert.deepEqual(report.edgeCases, [])
})

/**
 * Verifies reports without unsupported evidence return an empty supported
 * summary shape.
 */
test('UnsupportedFeatureReportBuilder returns supported status when clear', async () => {
    const { UnsupportedFeatureReportBuilder } =
        await import('../../src/parser.mjs')

    const report = UnsupportedFeatureReportBuilder.build({
        models: [
            {
                fileName: 'clear.SchDoc',
                schematic: {
                    recordTypes: [
                        {
                            recordType: 13,
                            name: 'line',
                            family: 'graphic',
                            supported: true,
                            count: 1
                        }
                    ]
                }
            }
        ]
    })

    assert.deepEqual(report.summary, {
        modelCount: 1,
        unsupportedRecordTypeCount: 0,
        rawRecordCount: 0,
        opaqueRecordCount: 0,
        diagnosticCount: 0,
        edgeCaseCount: 0,
        itemCount: 0,
        status: 'supported'
    })
    assert.deepEqual(report.recordTypes, [])
    assert.deepEqual(report.rawRecords, [])
    assert.deepEqual(report.opaqueRecords, [])
    assert.deepEqual(report.diagnostics, [])
    assert.deepEqual(report.edgeCases, [])
})

test('UnsupportedFeatureReportBuilder summarizes parser edge-case coverage', async () => {
    const { UnsupportedFeatureReportBuilder } =
        await import('../../src/parser.mjs')

    const report = UnsupportedFeatureReportBuilder.build({
        edgeCases: [
            {
                fileName: 'edge-a.SchDoc',
                domain: 'schematic',
                code: 'schematic.graphic.bezier',
                feature: 'bezier-curve',
                supportState: 'approximated'
            },
            {
                fileName: 'edge-a.SchDoc',
                domain: 'schematic',
                code: 'schematic.graphic.elliptical-arc',
                feature: 'elliptical-arc',
                supportState: 'approximated'
            },
            {
                fileName: 'edge-a.SchDoc',
                domain: 'schematic',
                code: 'schematic.graphic.rounded-rectangle',
                feature: 'rounded-rectangle',
                supportState: 'preserved'
            },
            {
                fileName: 'edge-b.PcbDoc',
                domain: 'pcb',
                code: 'pcb.pad.octagonal',
                feature: 'octagonal-pad',
                supportState: 'reported'
            },
            {
                fileName: 'edge-a.SchDoc',
                domain: 'schematic',
                code: 'schematic.text.multiline',
                feature: 'multiline-text-frame',
                supportState: 'preserved'
            },
            {
                fileName: 'edge-b.PcbDoc',
                domain: 'pcb',
                code: 'pcb.pad.componentless',
                feature: 'componentless-pad',
                supportState: 'preserved'
            },
            {
                fileName: 'edge-b.PcbDoc',
                domain: 'pcb',
                code: 'pcb.stream.newline-encoding',
                feature: 'newline-encoding',
                supportState: 'diagnostic'
            },
            {
                fileName: 'edge-b.PcbDoc',
                domain: 'pcb',
                code: 'pcb.region.length-mismatch',
                feature: 'malformed-region-length',
                supportState: 'diagnostic'
            }
        ]
    })

    assert.deepEqual(report.summary, {
        modelCount: 0,
        unsupportedRecordTypeCount: 0,
        rawRecordCount: 0,
        opaqueRecordCount: 0,
        diagnosticCount: 0,
        edgeCaseCount: 8,
        itemCount: 8,
        status: 'unsupported'
    })
    assert.deepEqual(
        report.edgeCases.map((edgeCase) => ({
            domain: edgeCase.domain,
            code: edgeCase.code,
            feature: edgeCase.feature,
            supportState: edgeCase.supportState
        })),
        [
            {
                domain: 'schematic',
                code: 'schematic.graphic.bezier',
                feature: 'bezier-curve',
                supportState: 'approximated'
            },
            {
                domain: 'schematic',
                code: 'schematic.graphic.elliptical-arc',
                feature: 'elliptical-arc',
                supportState: 'approximated'
            },
            {
                domain: 'schematic',
                code: 'schematic.graphic.rounded-rectangle',
                feature: 'rounded-rectangle',
                supportState: 'preserved'
            },
            {
                domain: 'pcb',
                code: 'pcb.pad.octagonal',
                feature: 'octagonal-pad',
                supportState: 'reported'
            },
            {
                domain: 'schematic',
                code: 'schematic.text.multiline',
                feature: 'multiline-text-frame',
                supportState: 'preserved'
            },
            {
                domain: 'pcb',
                code: 'pcb.pad.componentless',
                feature: 'componentless-pad',
                supportState: 'preserved'
            },
            {
                domain: 'pcb',
                code: 'pcb.stream.newline-encoding',
                feature: 'newline-encoding',
                supportState: 'diagnostic'
            },
            {
                domain: 'pcb',
                code: 'pcb.region.length-mismatch',
                feature: 'malformed-region-length',
                supportState: 'diagnostic'
            }
        ]
    )
})

test('UnsupportedFeatureReportBuilder derives PCB compatibility risks from parsed models', async () => {
    const { UnsupportedFeatureReportBuilder } =
        await import('../../src/parser.mjs')

    const report = UnsupportedFeatureReportBuilder.build({
        models: [
            {
                fileName: 'derived-risk.PcbDoc',
                pcb: {
                    pads: [
                        {
                            recordIndex: 4,
                            sourceStream: 'Pads6/Data',
                            shapeTop: 3,
                            shapeTopName: 'octagonal',
                            shapeMidName: 'rectangular',
                            shapeBottomName: 'round',
                            sizeTopX: 100,
                            sizeTopY: 80,
                            sizeMidX: 90,
                            sizeMidY: 70,
                            sizeBottomX: 120,
                            sizeBottomY: 90,
                            padMode: 2,
                            padModeName: 'full-stack',
                            holeShapeName: 'slot',
                            pasteMaskExpansionSource: 'manual',
                            solderMaskExpansionSource: 'manual',
                            customShape: {
                                layers: [
                                    {
                                        layerId: 1,
                                        regions: [],
                                        arcs: [],
                                        tracks: [],
                                        fills: []
                                    }
                                ]
                            }
                        }
                    ],
                    arcs: [
                        {
                            recordIndex: 2,
                            sourceStream: 'Arcs6/Data',
                            radius: 6,
                            width: 8
                        }
                    ],
                    regions: [
                        {
                            recordIndex: 7,
                            sourceStream: 'Regions6/Data',
                            holeCount: 1
                        }
                    ],
                    componentBodies: [
                        {
                            sourceStream: 'ShapeBasedComponentBodies6/Data',
                            modelType: 2,
                            modelTypeName: 'cylinder',
                            identifier: 'BODY_A'
                        },
                        {
                            sourceStream: 'ShapeBasedComponentBodies6/Data',
                            modelType: 0,
                            modelTypeName: 'extruded-polygon',
                            identifier: 'BODY_B',
                            staticGeometry: {
                                kind: 'extruded-polygon',
                                status: 'complete'
                            }
                        }
                    ],
                    embeddedModelIntegrity: {
                        issues: [
                            {
                                code: 'pcb.model.body-unresolved',
                                severity: 'warning',
                                message: 'Component body has no payload.',
                                sourceStream: 'ComponentBodies6/Data',
                                modelId: '{MODEL-A}'
                            }
                        ]
                    }
                }
            }
        ]
    })

    assert.deepEqual(
        report.edgeCases.map((edgeCase) => ({
            code: edgeCase.code,
            feature: edgeCase.feature,
            supportState: edgeCase.supportState,
            severity: edgeCase.severity,
            recordIndex: edgeCase.recordIndex,
            sourceStream: edgeCase.sourceStream
        })),
        [
            {
                code: 'pcb.pad.octagonal',
                feature: 'octagonal-pad',
                supportState: 'inspection-required',
                severity: 'warning',
                recordIndex: 4,
                sourceStream: 'Pads6/Data'
            },
            {
                code: 'pcb.pad.non-simple-stack',
                feature: 'non-simple-pad-stack',
                supportState: 'inspection-required',
                severity: 'warning',
                recordIndex: 4,
                sourceStream: 'Pads6/Data'
            },
            {
                code: 'pcb.pad.layer-specific-geometry',
                feature: 'layer-specific-pad-geometry',
                supportState: 'preserved',
                severity: 'info',
                recordIndex: 4,
                sourceStream: 'Pads6/Data'
            },
            {
                code: 'pcb.pad.slot-hole',
                feature: 'slot-hole',
                supportState: 'preserved',
                severity: 'info',
                recordIndex: 4,
                sourceStream: 'Pads6/Data'
            },
            {
                code: 'pcb.pad.manual-mask-paste',
                feature: 'manual-mask-paste-expansion',
                supportState: 'inspection-required',
                severity: 'warning',
                recordIndex: 4,
                sourceStream: 'Pads6/Data'
            },
            {
                code: 'pcb.custom-shape.missing-linked-geometry',
                feature: 'custom-pad-shape-linkage',
                supportState: 'inspection-required',
                severity: 'warning',
                recordIndex: 4,
                sourceStream: 'Pads6/Data'
            },
            {
                code: 'pcb.arc.width-radius-conflict',
                feature: 'wide-arc',
                supportState: 'inspection-required',
                severity: 'warning',
                recordIndex: 2,
                sourceStream: 'Arcs6/Data'
            },
            {
                code: 'pcb.region.holes',
                feature: 'region-with-holes',
                supportState: 'preserved',
                severity: 'info',
                recordIndex: 7,
                sourceStream: 'Regions6/Data'
            },
            {
                code: 'pcb.model.shape-body-static-geometry-missing',
                feature: 'shape-based-3d-body',
                supportState: 'inspection-required',
                severity: 'warning',
                recordIndex: undefined,
                sourceStream: 'ShapeBasedComponentBodies6/Data'
            },
            {
                code: 'pcb.model.body-unresolved',
                feature: 'embedded-model-integrity',
                supportState: 'diagnostic',
                severity: 'warning',
                recordIndex: undefined,
                sourceStream: 'ComponentBodies6/Data'
            }
        ]
    )
    assert.equal(report.summary.edgeCaseCount, 10)
    assert.equal(report.summary.status, 'unsupported')
})
