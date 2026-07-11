// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { EmbeddedAssetReportBuilder } from '../../src/legacy-parser.mjs'

/**
 * Verifies embedded payloads from multiple parser roots are summarized in one
 * deterministic read-only report.
 */
test('EmbeddedAssetReportBuilder inventories parser-root embedded assets', () => {
    const report = EmbeddedAssetReportBuilder.build({
        models: [
            {
                kind: 'schematic',
                fileName: 'sheet.SchDoc',
                schematic: {
                    images: [
                        {
                            key: 'image-0',
                            mimeType: 'image/png',
                            byteLength: 8,
                            sourceStream: 'Images/0'
                        }
                    ],
                    embeddedFiles: {
                        files: [
                            {
                                name: 'note.pdf',
                                format: 'pdf',
                                byteLength: 9,
                                sourceStream: 'EmbeddedFiles/note.pdf'
                            }
                        ]
                    }
                }
            },
            {
                kind: 'pcb',
                fileName: 'board.PcbDoc',
                pcb: {
                    embeddedFonts: [
                        {
                            family: 'BoardFont',
                            format: 'truetype',
                            byteLength: 12,
                            sourceStream: 'Fonts/0'
                        }
                    ],
                    embeddedModels: [
                        {
                            name: 'case.step',
                            format: 'step',
                            byteLength: 20,
                            sourceStream: 'Models/0'
                        }
                    ]
                }
            },
            {
                kind: 'integrated-library',
                fileName: 'bundle.IntLib',
                integratedLibrary: {
                    sources: [
                        {
                            path: 'SchLib/Symbols.SchLib',
                            fileName: 'Symbols.SchLib',
                            fileType: 'SchLib',
                            byteLength: 30
                        }
                    ]
                }
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.embedded-assets.a1')
    assert.deepEqual(report.summary, {
        modelCount: 3,
        assetCount: 5,
        totalByteCount: 79,
        byKind: {
            'embedded-file': 1,
            'integrated-library-source': 1,
            'pcb-font': 1,
            'pcb-model': 1,
            'schematic-image': 1
        }
    })
    assert.deepEqual(report.assets, [
        {
            modelFileName: 'board.PcbDoc',
            modelKind: 'pcb',
            kind: 'pcb-font',
            name: 'BoardFont',
            format: 'truetype',
            sourceStream: 'Fonts/0',
            byteLength: 12
        },
        {
            modelFileName: 'board.PcbDoc',
            modelKind: 'pcb',
            kind: 'pcb-model',
            name: 'case.step',
            format: 'step',
            sourceStream: 'Models/0',
            byteLength: 20
        },
        {
            modelFileName: 'bundle.IntLib',
            modelKind: 'integrated-library',
            kind: 'integrated-library-source',
            name: 'Symbols.SchLib',
            format: 'SchLib',
            sourceStream: 'SchLib/Symbols.SchLib',
            byteLength: 30
        },
        {
            modelFileName: 'sheet.SchDoc',
            modelKind: 'schematic',
            kind: 'embedded-file',
            name: 'note.pdf',
            format: 'pdf',
            sourceStream: 'EmbeddedFiles/note.pdf',
            byteLength: 9
        },
        {
            modelFileName: 'sheet.SchDoc',
            modelKind: 'schematic',
            kind: 'schematic-image',
            name: 'image-0',
            format: 'png',
            sourceStream: 'Images/0',
            byteLength: 8
        }
    ])
})
