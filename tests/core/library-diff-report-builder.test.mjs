// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { LibraryDiffReportBuilder } from '../../src/parser.mjs'

/**
 * Verifies schematic and PCB library read models can be compared with stable
 * added, removed, and changed rows.
 */
test('LibraryDiffReportBuilder compares parsed library models', () => {
    const report = LibraryDiffReportBuilder.build({
        left: [
            {
                fileName: 'left-symbols.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'CTRL_CORE',
                            pins: [{}, {}],
                            parts: [{ partId: 'A' }],
                            parameters: { Description: 'Controller v1' }
                        },
                        {
                            name: 'OLD_IO',
                            pins: [{}],
                            parameters: { Description: 'Removed symbol' }
                        }
                    ]
                }
            },
            {
                fileName: 'left-footprints.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: 'PKG_CTRL',
                            pads: [{}, {}],
                            texts: [{}],
                            parameters: { Height: '1mm' }
                        }
                    ]
                }
            }
        ],
        right: [
            {
                fileName: 'right-symbols.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'CTRL_CORE',
                            pins: [{}, {}, {}],
                            parts: [{ partId: 'A' }, { partId: 'B' }],
                            parameters: { Description: 'Controller v2' }
                        },
                        {
                            name: 'NEW_SENSOR',
                            pins: [{}],
                            parameters: { Description: 'Added symbol' }
                        }
                    ]
                }
            },
            {
                fileName: 'right-footprints.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: 'PKG_CTRL',
                            pads: [{}, {}, {}],
                            texts: [{}],
                            parameters: { Height: '1.2mm' }
                        },
                        {
                            name: 'PKG_SENSOR',
                            pads: [{}],
                            texts: []
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.library.diff.a1')
    assert.deepEqual(report.summary, {
        leftLibraryCount: 2,
        rightLibraryCount: 2,
        addedSymbolCount: 1,
        removedSymbolCount: 1,
        changedSymbolCount: 1,
        addedFootprintCount: 1,
        removedFootprintCount: 0,
        changedFootprintCount: 1,
        differenceCount: 5
    })
    assert.deepEqual(report.symbols.added, [
        {
            name: 'NEW_SENSOR',
            libraryFileName: 'right-symbols.SchLib',
            index: 1,
            pinCount: 1,
            partCount: 0
        }
    ])
    assert.deepEqual(report.symbols.removed, [
        {
            name: 'OLD_IO',
            libraryFileName: 'left-symbols.SchLib',
            index: 1,
            pinCount: 1,
            partCount: 0
        }
    ])
    assert.deepEqual(report.symbols.changed, [
        {
            name: 'CTRL_CORE',
            left: {
                libraryFileName: 'left-symbols.SchLib',
                index: 0,
                pinCount: 2,
                partCount: 1
            },
            right: {
                libraryFileName: 'right-symbols.SchLib',
                index: 0,
                pinCount: 3,
                partCount: 2
            },
            differences: {
                pinCount: { left: 2, right: 3 },
                partCount: { left: 1, right: 2 },
                parameters: {
                    Description: {
                        left: 'Controller v1',
                        right: 'Controller v2'
                    }
                }
            }
        }
    ])
    assert.deepEqual(report.footprints.added, [
        {
            name: 'PKG_SENSOR',
            libraryFileName: 'right-footprints.PcbLib',
            index: 1,
            padCount: 1,
            textCount: 0
        }
    ])
    assert.deepEqual(report.footprints.changed, [
        {
            name: 'PKG_CTRL',
            left: {
                libraryFileName: 'left-footprints.PcbLib',
                index: 0,
                padCount: 2,
                textCount: 1
            },
            right: {
                libraryFileName: 'right-footprints.PcbLib',
                index: 0,
                padCount: 3,
                textCount: 1
            },
            differences: {
                padCount: { left: 2, right: 3 },
                parameters: {
                    Height: {
                        left: '1mm',
                        right: '1.2mm'
                    }
                }
            }
        }
    ])
})
