// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumParser } from './AltiumParser.mjs'
import { DraftsmanDigestParser } from './DraftsmanDigestParser.mjs'
import { PcbModelParser } from './PcbModelParser.mjs'
import { PrjPcbModelParser } from './PrjPcbModelParser.mjs'

/**
 * Runs deterministic synthetic compatibility cases against parser entrypoints.
 */
export class ParserCompatibilityFuzzer {
    static SCHEMA = 'altium-toolkit.parser-compatibility-fuzz.a1'

    /**
     * Runs all built-in synthetic parser compatibility cases.
     * @returns {object}
     */
    static run() {
        const cases = ParserCompatibilityFuzzer.#cases().map((entry) =>
            ParserCompatibilityFuzzer.#runCase(entry)
        )

        return {
            schema: ParserCompatibilityFuzzer.SCHEMA,
            summary: {
                caseCount: cases.length,
                failureCount: cases.filter((entry) => entry.status === 'fail')
                    .length,
                handledErrorCount: cases.filter(
                    (entry) => entry.status === 'handled-error'
                ).length,
                diagnosticCount: cases.reduce(
                    (total, entry) =>
                        total + Number(entry.diagnosticCount || 0),
                    0
                )
            },
            cases
        }
    }

    /**
     * Lists deterministic compatibility cases.
     * @returns {{ key: string, parse: () => object, expectedError?: boolean }[]}
     */
    static #cases() {
        return [
            {
                key: 'sch-record-ordering',
                parse: () =>
                    AltiumParser.parseArrayBufferToRendererModel(
                        'fuzz-order.SchDoc',
                        ParserCompatibilityFuzzer.#encodeText(
                            '|RECORD=999|Text=Unknown First|' +
                                '|HEADER=Schematic Document|' +
                                '|RECORD=31|CustomX=120|CustomY=80|BorderOn=F|TitleBlockOn=F|' +
                                '|RECORD=13|Location.X=10|Location.Y=10|Corner.X=80|Corner.Y=10|LineWidth=1|'
                        )
                    )
            },
            {
                key: 'sch-odd-encoding',
                parse: () =>
                    AltiumParser.parseArrayBufferToRendererModel(
                        'fuzz-encoding.SchDoc',
                        ParserCompatibilityFuzzer.#windows1252Schematic()
                    )
            },
            {
                key: 'pcb-malformed-sidecars',
                parse: () =>
                    PcbModelParser.parse('fuzz-sidecar.PcbDoc', [
                        {
                            sourceStream: 'Pads6/Data',
                            fields: {
                                X: 'not-a-number',
                                Y: '20mil',
                                HOLESIZE: 'malformed',
                                NET: 'NET_A'
                            }
                        },
                        {
                            sourceStream: 'ExtendedPrimitiveInformation/Data',
                            fields: {
                                PRIMITIVEINDEX: 'not-a-number',
                                SolderMaskExpansionMode: 'Manual',
                                SolderMaskExpansion: 'bad'
                            }
                        },
                        {
                            sourceStream: 'UnsupportedSidecar/Data',
                            fields: { RECORD: '777', VALUE: 'preserve' }
                        }
                    ])
            },
            {
                key: 'project-sparse-documents',
                parse: () =>
                    PrjPcbModelParser.parseText(
                        'fuzz-project.PrjPcb',
                        '[Design]\n\n[Document1]\nDocumentUniqueId=EMPTY\n'
                    )
            },
            {
                key: 'draftsman-unsupported-container',
                parse: () =>
                    DraftsmanDigestParser.parse(
                        'fuzz.PCBDwf',
                        new Uint8Array([0, 1, 2, 3]).buffer
                    )
            },
            {
                key: 'empty-schdoc',
                parse: () =>
                    AltiumParser.parseArrayBufferToRendererModel(
                        'empty.SchDoc',
                        new ArrayBuffer(0)
                    )
            },
            {
                key: 'random-pcbdoc',
                parse: () =>
                    AltiumParser.parseArrayBufferToRendererModel(
                        'random.PcbDoc',
                        ParserCompatibilityFuzzer.#byteBuffer([
                            0, 17, 65, 127, 128, 255, 42, 3
                        ])
                    )
            },
            {
                key: 'random-pcblib',
                parse: () =>
                    AltiumParser.parseArrayBufferToRendererModel(
                        'random.PcbLib',
                        ParserCompatibilityFuzzer.#byteBuffer([
                            9, 8, 7, 6, 5, 4, 3, 2
                        ])
                    )
            },
            {
                key: 'random-intlib',
                expectedError: true,
                parse: () =>
                    AltiumParser.parseArrayBufferToRendererModel(
                        'random.IntLib',
                        ParserCompatibilityFuzzer.#byteBuffer([
                            1, 35, 69, 103, 137, 171, 205, 239
                        ])
                    )
            },
            {
                key: 'wrong-reader-schdoc-as-intlib',
                expectedError: true,
                parse: () =>
                    AltiumParser.parseArrayBufferToRendererModel(
                        'wrong-reader.IntLib',
                        ParserCompatibilityFuzzer.#encodeText(
                            '|HEADER=Schematic Document|' +
                                '|RECORD=31|CustomX=120|CustomY=80|'
                        )
                    )
            },
            {
                key: 'unknown-extension-fallback',
                parse: () =>
                    AltiumParser.parseArrayBufferToRendererModel(
                        'unknown.bin',
                        ParserCompatibilityFuzzer.#encodeText(
                            '|RECORD=1|NET=FALLBACK|'
                        )
                    )
            }
        ]
    }

    /**
     * Executes one compatibility case.
     * @param {{ key: string, parse: () => object, expectedError?: boolean }} entry Case descriptor.
     * @returns {object}
     */
    static #runCase(entry) {
        try {
            const model = entry.parse()
            if (entry.expectedError) {
                return {
                    key: entry.key,
                    status: 'fail',
                    expectedError: true,
                    diagnosticCount: 1,
                    error: {
                        name: 'ExpectedError',
                        message:
                            'Parser case was expected to fail in a controlled way.'
                    }
                }
            }

            return {
                key: entry.key,
                status: 'pass',
                kind: model?.kind || '',
                fileType: model?.fileType || '',
                diagnosticCount: (model?.diagnostics || []).length,
                summary: ParserCompatibilityFuzzer.#stableSummary(
                    model?.summary || {}
                )
            }
        } catch (error) {
            if (entry.expectedError) {
                return {
                    key: entry.key,
                    status: 'handled-error',
                    expectedError: true,
                    diagnosticCount: 1,
                    error: {
                        name: error?.name || 'Error',
                        message: error?.message || String(error)
                    }
                }
            }

            return {
                key: entry.key,
                status: 'fail',
                diagnosticCount: 1,
                error: {
                    name: error?.name || 'Error',
                    message: error?.message || String(error)
                }
            }
        }
    }

    /**
     * Builds a stable compact summary object.
     * @param {object} summary Parser summary.
     * @returns {object}
     */
    static #stableSummary(summary) {
        return Object.fromEntries(
            Object.entries(summary || {}).filter(([, value]) =>
                ['number', 'string', 'boolean'].includes(typeof value)
            )
        )
    }

    /**
     * Encodes text as UTF-8.
     * @param {string} text Text payload.
     * @returns {ArrayBuffer}
     */
    static #encodeText(text) {
        const bytes = new TextEncoder().encode(text)
        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.length
        )
    }

    /**
     * Builds an ArrayBuffer from stable synthetic bytes.
     * @param {number[]} values Byte values.
     * @returns {ArrayBuffer}
     */
    static #byteBuffer(values) {
        const bytes = new Uint8Array(values)
        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.length
        )
    }

    /**
     * Builds a schematic payload with one Windows-1252 punctuation byte.
     * @returns {ArrayBuffer}
     */
    static #windows1252Schematic() {
        const prefix = new TextEncoder().encode(
            '|HEADER=Schematic Document|' +
                '|RECORD=31|CustomX=120|CustomY=80|BorderOn=F|TitleBlockOn=F|' +
                '|RECORD=4|Location.X=20|Location.Y=20|TEXT=ESD'
        )
        const suffix = new TextEncoder().encode('TVS|')
        const bytes = new Uint8Array(prefix.length + 1 + suffix.length)
        bytes.set(prefix, 0)
        bytes[prefix.length] = 0x96
        bytes.set(suffix, prefix.length + 1)

        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.length
        )
    }
}
