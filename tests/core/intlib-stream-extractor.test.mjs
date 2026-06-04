// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateSync } from 'node:zlib'
import { IntLibModelParser } from '../../src/core/altium/IntLibModelParser.mjs'
import { IntLibStreamExtractor } from '../../src/core/altium/IntLibStreamExtractor.mjs'
import { PcbSidecarTestFactory } from './PcbSidecarTestFactory.mjs'

/**
 * Builds synthetic integrated-library streams.
 */
class IntLibTestFactory {
    /**
     * Creates one stream map with metadata and bundled source payloads.
     * @returns {Map<string, Uint8Array>}
     */
    static createStreamMap() {
        return new Map([
            ['Version.Txt', new TextEncoder().encode('1.0')],
            [
                'LibCrossRef.Txt',
                new TextEncoder().encode(
                    'COMPONENT=U_FAKE|MODEL=PKG_FAKE|KIND=PCB\nCOMPONENT=U_FAKE|MODEL=SYM_FAKE|KIND=SCH'
                )
            ],
            [
                'Parameters   .bin',
                PcbSidecarTestFactory.createLengthPrefixedRecords([
                    '|NAME=LibraryFamily|VALUE=Fake Logic',
                    '|NAME=Lifecycle|VALUE=Prototype'
                ])
            ],
            [
                'SchLib/Symbols.SchLib',
                new TextEncoder().encode(
                    '|HEADER=Protel for Windows - Schematic Library'
                )
            ],
            [
                'PCBLib/Footprints.PcbLib',
                IntLibTestFactory.#createWrappedZlibPayload(
                    '|HEADER=PCB 6.0 Binary Library'
                )
            ],
            ['PCB3DLib/Models.PCB3DLib', new Uint8Array([0x01, 0x02, 0x03])]
        ])
    }

    /**
     * Creates the zlib wrapper used by some bundled library streams.
     * @param {string} text
     * @returns {Uint8Array}
     */
    static #createWrappedZlibPayload(text) {
        const compressed = Uint8Array.from(
            deflateSync(new TextEncoder().encode(text))
        )
        const wrapped = new Uint8Array(compressed.byteLength + 1)

        wrapped[0] = 0x02
        wrapped.set(compressed, 1)

        return wrapped
    }
}

/**
 * Verifies integrated-library extraction is read-only and exposes metadata plus
 * recovered source entries.
 */
test('IntLibStreamExtractor extracts metadata and bundled library sources', () => {
    const extracted = IntLibStreamExtractor.extractFromStreams(
        IntLibTestFactory.createStreamMap()
    )

    assert.equal(extracted.version, '1.0')
    assert.deepEqual(extracted.crossReferences, [
        {
            component: 'U_FAKE',
            model: 'PKG_FAKE',
            kind: 'PCB',
            fields: {
                COMPONENT: 'U_FAKE',
                MODEL: 'PKG_FAKE',
                KIND: 'PCB'
            }
        },
        {
            component: 'U_FAKE',
            model: 'SYM_FAKE',
            kind: 'SCH',
            fields: {
                COMPONENT: 'U_FAKE',
                MODEL: 'SYM_FAKE',
                KIND: 'SCH'
            }
        }
    ])
    assert.deepEqual(extracted.parameters, {
        LibraryFamily: 'Fake Logic',
        Lifecycle: 'Prototype'
    })
    assert.deepEqual(
        extracted.sources.map((source) => ({
            path: source.path,
            fileName: source.fileName,
            fileType: source.fileType,
            libraryKind: source.libraryKind,
            compression: source.compression,
            byteLength: source.byteLength,
            payloadText: source.payloadText
        })),
        [
            {
                path: 'PCB3DLib/Models.PCB3DLib',
                fileName: 'Models.PCB3DLib',
                fileType: 'PCB3DLib',
                libraryKind: 'pcb-3d-models',
                compression: 'none',
                byteLength: 3,
                payloadText: ''
            },
            {
                path: 'PCBLib/Footprints.PcbLib',
                fileName: 'Footprints.PcbLib',
                fileType: 'PcbLib',
                libraryKind: 'pcb-footprints',
                compression: 'zlib-wrapper',
                byteLength: 30,
                payloadText: '|HEADER=PCB 6.0 Binary Library'
            },
            {
                path: 'SchLib/Symbols.SchLib',
                fileName: 'Symbols.SchLib',
                fileType: 'SchLib',
                libraryKind: 'schematic-symbols',
                compression: 'none',
                byteLength: 46,
                payloadText: '|HEADER=Protel for Windows - Schematic Library'
            }
        ]
    )
})

/**
 * Verifies integrated-library extraction is normalized into the public model
 * shape used by parser entrypoints.
 */
test('IntLibModelParser builds an integrated-library model contract', () => {
    const model = IntLibModelParser.parse('bundle.IntLib', {
        ...IntLibStreamExtractor.extractFromStreams(
            IntLibTestFactory.createStreamMap()
        )
    })

    assert.equal(model.kind, 'integrated-library')
    assert.equal(model.fileType, 'IntLib')
    assert.equal(model.summary.sourceCount, 3)
    assert.equal(model.summary.crossReferenceCount, 2)
    assert.deepEqual(model.integratedLibrary.parameters, {
        LibraryFamily: 'Fake Logic',
        Lifecycle: 'Prototype'
    })
})

/**
 * Verifies malformed cross-reference metadata is reported without preventing
 * bundled library source extraction.
 */
test('IntLibStreamExtractor preserves sources when metadata rows are malformed', () => {
    const streams = IntLibTestFactory.createStreamMap()
    streams.set(
        'LibCrossRef.Txt',
        new TextEncoder().encode(
            'COMPONENT=U_FAKE|MODEL=PKG_FAKE|KIND=PCB\nMALFORMED_ROW'
        )
    )

    const extracted = IntLibStreamExtractor.extractFromStreams(streams)
    const model = IntLibModelParser.parse('degraded.IntLib', extracted)

    assert.equal(extracted.sources.length, 3)
    assert.deepEqual(extracted.crossReferences, [
        {
            component: 'U_FAKE',
            model: 'PKG_FAKE',
            kind: 'PCB',
            fields: {
                COMPONENT: 'U_FAKE',
                MODEL: 'PKG_FAKE',
                KIND: 'PCB'
            }
        }
    ])
    assert.deepEqual(extracted.diagnostics.issues, [
        {
            code: 'intlib.crossref.malformed-row',
            severity: 'warning',
            stream: 'LibCrossRef.Txt',
            line: 2,
            message: 'Skipped malformed integrated-library cross-reference row.'
        }
    ])
    assert.deepEqual(model.integratedLibrary.diagnostics.issues, [
        {
            code: 'intlib.crossref.malformed-row',
            severity: 'warning',
            stream: 'LibCrossRef.Txt',
            line: 2,
            message: 'Skipped malformed integrated-library cross-reference row.'
        }
    ])
    assert.equal(
        model.diagnostics.some(
            (diagnostic) =>
                diagnostic.code === 'intlib.crossref.malformed-row' &&
                diagnostic.severity === 'warning'
        ),
        true
    )
})
