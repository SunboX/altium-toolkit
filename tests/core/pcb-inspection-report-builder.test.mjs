// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInspectionReportBuilder } from '../../src/legacy-parser.mjs'

test('PcbInspectionReportBuilder composes board, net, class, rule, and diagnostic summaries', () => {
    const report = PcbInspectionReportBuilder.build({
        fileName: 'fixture-board.PcbDoc',
        diagnostics: [
            {
                severity: 'warning',
                code: 'pcb.synthetic-warning'
            }
        ],
        pcb: {
            boardOutline: {
                widthMil: 1200,
                heightMil: 800,
                minX: 0,
                minY: 0,
                segments: [{}, {}, {}, {}]
            },
            layers: [
                { id: 1, name: 'Top Layer', role: 'signal' },
                { id: 2, name: 'Bottom Layer', role: 'signal' }
            ],
            primitiveLayers: [],
            nets: [{ name: 'GND' }, { name: 'AIRWIRE' }],
            pads: [
                {
                    designator: '1',
                    netName: 'GND',
                    layerId: 1,
                    holeDiameter: 20
                },
                { designator: '2', netName: 'AIRWIRE', layerId: 1 },
                { designator: '3', netName: 'AIRWIRE', layerId: 1 }
            ],
            tracks: [
                { netName: 'GND', layerId: 1, x1: 0, y1: 0, x2: 100, y2: 0 }
            ],
            arcs: [],
            vias: [{ netName: 'GND', layerId: 2, holeDiameter: 12 }],
            fills: [],
            regions: [],
            polygons: [],
            components: [{ designator: 'U1' }],
            classes: [
                {
                    name: 'Power Nets',
                    kind: 0,
                    kindName: 'net',
                    enabled: true,
                    members: ['GND']
                }
            ],
            differentialPairs: [],
            rules: [
                {
                    kind: 'clearance',
                    name: 'Default Clearance'
                },
                {
                    ruleKind: 'width',
                    name: 'Default Width'
                }
            ]
        }
    })

    assert.equal(report.schema, 'altium-toolkit.pcb.inspection.a1')
    assert.equal(report.summary.fileName, 'fixture-board.PcbDoc')
    assert.equal(report.summary.status, 'needs-review')
    assert.equal(report.summary.boardWidthMil, 1200)
    assert.equal(report.summary.boardHeightMil, 800)
    assert.equal(report.summary.layerCount, 2)
    assert.equal(report.summary.netCount, 2)
    assert.equal(report.summary.componentCount, 1)
    assert.equal(report.summary.primitiveCount, 5)
    assert.equal(report.summary.ruleCount, 2)
    assert.equal(report.summary.warningCount, 1)
    assert.equal(report.summary.possibleUnroutedNetCount, 1)
    assert.deepEqual(report.rules.byKind, [
        { kind: 'clearance', count: 1 },
        { kind: 'width', count: 1 }
    ])
    assert.equal(report.statistics.board.outlineSegmentCount, 4)
    assert.equal(report.netMembership.summary.possibleUnroutedNetCount, 1)
    assert.equal(report.classes.summary.netClassCount, 1)
})

test('PcbInspectionReportBuilder includes review metadata and fabrication readiness summaries', () => {
    const report = PcbInspectionReportBuilder.build({
        fileName: 'aggregate-review.PcbDoc',
        pcb: {
            boardOutline: {
                widthMil: 900,
                heightMil: 500,
                segments: []
            },
            layers: [{ id: 1, name: 'Top Layer', role: 'signal' }],
            primitiveLayers: [],
            nets: [{ name: 'PWR_A' }],
            pads: [
                {
                    designator: '1',
                    netName: 'PWR_A',
                    padMode: 2,
                    padModeName: 'full-stack',
                    localStack: {
                        layers: [
                            {
                                layerKey: 'L1',
                                offsetX: 2,
                                offsetY: 0
                            }
                        ]
                    }
                }
            ],
            tracks: [
                {
                    netName: 'PWR_A',
                    layerId: 1,
                    x1: 0,
                    y1: 0,
                    x2: 100,
                    y2: 0,
                    polygonIndex: 4
                }
            ],
            arcs: [],
            vias: [
                {
                    netName: 'PWR_A',
                    diameter: 18,
                    holeDiameter: 6,
                    drillLayerPairType: 3
                }
            ],
            fills: [],
            regions: [],
            polygons: [
                {
                    netName: 'PWR_A',
                    layerId: 1,
                    polygonIndex: 4
                }
            ],
            components: [],
            classes: [],
            differentialPairs: [],
            rules: []
        }
    })

    assert.equal(
        report.reviewMetadata.schema,
        'altium-toolkit.pcb.review-metadata.a1'
    )
    assert.deepEqual(report.reviewMetadata.summary, {
        routeGroupCount: 0,
        boardAssemblyViewCount: 0,
        polygonRealizationCount: 1,
        routeHighlightProfileCount: 1,
        drillOverlayCount: 1
    })
    assert.equal(
        report.fabricationReadiness.schema,
        'altium-toolkit.pcb.fabrication-readiness.a1'
    )
    assert.equal(report.fabricationReadiness.summary.reviewItemCount, 4)
    assert.equal(report.summary.polygonRealizationCount, 1)
    assert.equal(report.summary.fabricationReviewItemCount, 4)
})
