// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { ProjectHierarchyReportBuilder } from '../../src/legacy-parser.mjs'

test('ProjectHierarchyReportBuilder walks child sheets and reports gaps', () => {
    const report = ProjectHierarchyReportBuilder.build({
        projectModel: {
            project: {
                design: {
                    HierarchyMode: '2'
                },
                documents: [
                    {
                        path: 'Main.SchDoc',
                        normalizedPath: 'Main.SchDoc',
                        fileName: 'Main.SchDoc',
                        kind: 'schematic',
                        uniqueId: 'DOC-MAIN'
                    },
                    {
                        path: 'Child.SchDoc',
                        normalizedPath: 'Child.SchDoc',
                        fileName: 'Child.SchDoc',
                        kind: 'schematic',
                        uniqueId: 'DOC-CHILD'
                    },
                    {
                        path: 'Orphan.SchDoc',
                        normalizedPath: 'Orphan.SchDoc',
                        fileName: 'Orphan.SchDoc',
                        kind: 'schematic',
                        uniqueId: 'DOC-ORPHAN'
                    }
                ]
            }
        },
        documentModels: [
            {
                kind: 'schematic',
                fileName: 'Main.SchDoc',
                summary: { title: 'Top Sheet' },
                schematic: {
                    sheetSymbols: [
                        {
                            uniqueId: 'SYM-CHILD',
                            indexInSheet: 10,
                            name: 'Child Block',
                            fileName: 'Child.SchDoc'
                        },
                        {
                            uniqueId: 'SYM-MISSING',
                            indexInSheet: 20,
                            name: 'Missing Block',
                            fileName: 'Missing.SchDoc'
                        }
                    ],
                    sheetEntries: [
                        {
                            ownerIndex: '10',
                            name: 'NET_A',
                            direction: 'input'
                        }
                    ]
                }
            },
            {
                kind: 'schematic',
                fileName: 'Child.SchDoc',
                summary: { title: 'Child Sheet' },
                schematic: {
                    sheetSymbols: [
                        {
                            uniqueId: 'SYM-LOOP',
                            indexInSheet: 30,
                            name: 'Loop Block',
                            fileName: 'Main.SchDoc'
                        }
                    ],
                    sheetEntries: [
                        {
                            ownerIndex: '30',
                            name: 'LOOP',
                            direction: 'output'
                        }
                    ]
                }
            },
            {
                kind: 'schematic',
                fileName: 'Orphan.SchDoc',
                summary: { title: 'Unreferenced Sheet' },
                schematic: {
                    sheetSymbols: [],
                    sheetEntries: []
                }
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.project.hierarchy.a1')
    assert.deepEqual(report.summary, {
        sheetCount: 3,
        rootSheetCount: 2,
        linkCount: 3,
        resolvedLinkCount: 1,
        missingSheetCount: 1,
        cycleCount: 1,
        repeatedReferenceCount: 0
    })
    assert.deepEqual(
        report.roots.map((root) => ({
            fileName: root.fileName,
            childCount: root.children.length
        })),
        [
            { fileName: 'Main.SchDoc', childCount: 2 },
            { fileName: 'Orphan.SchDoc', childCount: 0 }
        ]
    )
    assert.deepEqual(
        report.links.map((link) => ({
            parentSheetFileName: link.parentSheetFileName,
            childSheetFileName: link.childSheetFileName,
            status: link.status,
            sheetEntryNames: link.sheetEntryNames
        })),
        [
            {
                parentSheetFileName: 'Child.SchDoc',
                childSheetFileName: 'Main.SchDoc',
                status: 'cycle',
                sheetEntryNames: ['LOOP']
            },
            {
                parentSheetFileName: 'Main.SchDoc',
                childSheetFileName: 'Child.SchDoc',
                status: 'resolved',
                sheetEntryNames: ['NET_A']
            },
            {
                parentSheetFileName: 'Main.SchDoc',
                childSheetFileName: 'Missing.SchDoc',
                status: 'missing',
                sheetEntryNames: []
            }
        ]
    )
    assert.deepEqual(
        report.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: diagnostic.severity,
            parentSheetFileName: diagnostic.parentSheetFileName,
            childSheetFileName: diagnostic.childSheetFileName
        })),
        [
            {
                code: 'project.hierarchy.cycle',
                severity: 'warning',
                parentSheetFileName: 'Child.SchDoc',
                childSheetFileName: 'Main.SchDoc'
            },
            {
                code: 'project.hierarchy.missing-sheet',
                severity: 'warning',
                parentSheetFileName: 'Main.SchDoc',
                childSheetFileName: 'Missing.SchDoc'
            }
        ]
    )
})
