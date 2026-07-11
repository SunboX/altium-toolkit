// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { LibraryCatalogArtifactBuilder } from '../../src/legacy-parser.mjs'

test('LibraryCatalogArtifactBuilder emits deterministic static catalog artifacts', () => {
    const artifact = LibraryCatalogArtifactBuilder.build({
        schematicLibraries: [
            {
                fileName: 'Symbols.SchLib',
                schematicLibrary: {
                    symbols: [
                        {
                            name: 'CTRL_CORE',
                            pins: [
                                { designator: '1', name: 'IN' },
                                { designator: '2', name: 'OUT' }
                            ],
                            parts: [{ partId: 'A' }],
                            parameters: {
                                Description: 'controller symbol'
                            }
                        }
                    ]
                }
            }
        ],
        pcbLibraries: [
            {
                fileName: 'Footprints.PcbLib',
                pcbLibrary: {
                    footprints: [
                        {
                            name: 'PKG_CORE',
                            sourceStorage: 'PKG_CORE',
                            pads: [{ designator: '1' }, { designator: '2' }],
                            tracks: [{ layerId: 1, layerName: 'Top Layer' }]
                        }
                    ]
                }
            }
        ],
        qaReport: {
            libraryLint: {
                issues: [
                    {
                        code: 'library.symbol.unnamed-pin',
                        severity: 'info',
                        target: 'CTRL_CORE',
                        symbolName: 'CTRL_CORE',
                        unnamedPinCount: 1
                    }
                ]
            }
        }
    })

    assert.equal(artifact.schema, 'altium-toolkit.library.catalog.a1')
    assert.deepEqual(artifact.summary, {
        schematicLibraryCount: 1,
        pcbLibraryCount: 1,
        entryCount: 2,
        symbolCount: 1,
        footprintCount: 1,
        issueCount: 1
    })
    assert.deepEqual(
        artifact.entries.map((entry) => ({
            kind: entry.kind,
            name: entry.name,
            libraryFileName: entry.libraryFileName,
            outputSvgKey: entry.outputSvgKey,
            issueCodes: entry.issueCodes,
            searchText: entry.searchText
        })),
        [
            {
                kind: 'footprint',
                name: 'PKG_CORE',
                libraryFileName: 'Footprints.PcbLib',
                outputSvgKey: 'pcb-library/footprint-0-pkg-core.svg',
                issueCodes: [],
                searchText: 'PKG_CORE Footprints.PcbLib footprint pads:2'
            },
            {
                kind: 'symbol',
                name: 'CTRL_CORE',
                libraryFileName: 'Symbols.SchLib',
                outputSvgKey: 'schematic-library/symbol-0-ctrl-core/part-a.svg',
                issueCodes: ['library.symbol.unnamed-pin'],
                searchText:
                    'CTRL_CORE Symbols.SchLib symbol controller symbol pins:2'
            }
        ]
    )
    assert.deepEqual(artifact.searchIndex.entries, [
        {
            key: 'footprint:Footprints.PcbLib:PKG_CORE',
            kind: 'footprint',
            name: 'PKG_CORE',
            libraryFileName: 'Footprints.PcbLib',
            text: 'PKG_CORE Footprints.PcbLib footprint pads:2'
        },
        {
            key: 'symbol:Symbols.SchLib:CTRL_CORE',
            kind: 'symbol',
            name: 'CTRL_CORE',
            libraryFileName: 'Symbols.SchLib',
            text: 'CTRL_CORE Symbols.SchLib symbol controller symbol pins:2'
        }
    ])
    assert.match(artifact.html, /data-library-catalog/u)
    assert.match(artifact.html, /CTRL_CORE/u)
    assert.match(artifact.html, /library\.symbol\.unnamed-pin/u)
    assert.doesNotMatch(artifact.html, /<script/u)
})
