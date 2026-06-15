// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { LibraryInspectionReportBuilder } from '../../src/parser.mjs'

test('LibraryInspectionReportBuilder composes library inventory and QA findings', () => {
    const report = LibraryInspectionReportBuilder.build({
        schematicLibraries: [
            {
                fileName: 'symbols.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'CTRL_CORE',
                            pins: [
                                { designator: '1', name: 'IN' },
                                { designator: '2', name: 'OUT' }
                            ],
                            implementations: [
                                {
                                    modelName: 'PKG_CORE',
                                    targetLibraries: ['missing.PcbLib']
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
                            name: 'PKG_CORE',
                            pads: [{ designator: '1' }],
                            embeddedModels: [],
                            componentBodies: [{ modelId: 'BODY_A' }]
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.library.inspection.a1')
    assert.equal(report.summary.schematicLibraryCount, 1)
    assert.equal(report.summary.pcbLibraryCount, 1)
    assert.equal(report.summary.symbolCount, 1)
    assert.equal(report.summary.footprintCount, 1)
    assert.equal(report.summary.staleImplementationCount, 1)
    assert.equal(report.summary.missingModelCount, 1)
    assert.equal(report.summary.libraryLintIssueCount, 1)
    assert.equal(report.summary.issueCount, 3)
    assert.deepEqual(report.libraries, [
        {
            fileName: 'symbols.SchLib',
            kind: 'schematic-library',
            symbolCount: 1,
            pinCount: 2
        },
        {
            fileName: 'footprints.PcbLib',
            kind: 'pcb-library',
            footprintCount: 1,
            padCount: 1
        }
    ])
    assert.deepEqual(
        report.issues.map((issue) => issue.code),
        [
            'library.stale-implementation',
            'library.missing-model',
            'library.symbol-footprint.pin-pad-count-mismatch'
        ]
    )
})
