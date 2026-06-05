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
     * @returns {{ key: string, parse: () => object }[]}
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
            }
        ]
    }

    /**
     * Executes one compatibility case.
     * @param {{ key: string, parse: () => object }} entry Case descriptor.
     * @returns {object}
     */
    static #runCase(entry) {
        try {
            const model = entry.parse()
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
