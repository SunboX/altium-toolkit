// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbDimensionReportBuilder } from '../../src/legacy-parser.mjs'

/**
 * Verifies PCB dimension reports classify renderable dimensions and unresolved
 * reference geometry without requiring SVG rendering.
 */
test('PcbDimensionReportBuilder reports dimension renderability', () => {
    const report = PcbDimensionReportBuilder.build({
        pcb: {
            dimensions: [
                {
                    dimensionIndex: 0,
                    kind: 'linear',
                    name: 'D1',
                    layer: 'Mechanical 1',
                    text: '100 mil',
                    references: [
                        { index: 0, x: 0, y: 10 },
                        { index: 1, x: 100, y: 10 }
                    ],
                    textLocation: { x: 50, y: 30 }
                },
                {
                    dimensionIndex: 1,
                    kind: 'angular',
                    name: 'A1',
                    references: [
                        { index: 0, x: 10, y: 10 },
                        { index: 1, x: 20, y: 20 }
                    ]
                },
                {
                    dimensionIndex: 2,
                    kind: 'diameter',
                    name: 'DR1',
                    references: [{ index: 0, x: 40, y: 40 }]
                }
            ]
        }
    })

    assert.equal(report.schema, 'altium-toolkit.pcb.dimensions.a1')
    assert.deepEqual(report.summary, {
        dimensionCount: 3,
        renderableCount: 1,
        unresolvedCount: 2,
        missingTextLocationCount: 2,
        byKind: [
            { kind: 'angular', count: 1 },
            { kind: 'diameter', count: 1 },
            { kind: 'linear', count: 1 }
        ]
    })
    assert.deepEqual(
        report.dimensions.map((dimension) => ({
            dimensionIndex: dimension.dimensionIndex,
            kind: dimension.kind,
            name: dimension.name,
            status: dimension.status,
            referenceCount: dimension.referenceCount,
            requiredReferenceCount: dimension.requiredReferenceCount
        })),
        [
            {
                dimensionIndex: 0,
                kind: 'linear',
                name: 'D1',
                status: 'renderable',
                referenceCount: 2,
                requiredReferenceCount: 2
            },
            {
                dimensionIndex: 1,
                kind: 'angular',
                name: 'A1',
                status: 'unresolved',
                referenceCount: 2,
                requiredReferenceCount: 3
            },
            {
                dimensionIndex: 2,
                kind: 'diameter',
                name: 'DR1',
                status: 'unresolved',
                referenceCount: 1,
                requiredReferenceCount: 2
            }
        ]
    )
    assert.deepEqual(
        report.findings.map((finding) => finding.code),
        ['pcb.dimension.missing-reference', 'pcb.dimension.missing-reference']
    )
})
