// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzlibSync } from 'fflate'
import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'
import { PcbSidecarRecordParser } from './PcbSidecarRecordParser.mjs'
import { PrintableTextDecoder } from './PrintableTextDecoder.mjs'

/**
 * Extracts read-only metadata and bundled source entries from integrated
 * library compound documents.
 */
export class IntLibStreamExtractor {
    /**
     * Extracts integrated-library data directly from one OLE buffer.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {ReturnType<typeof IntLibStreamExtractor.extractFromStreams> | null}
     */
    static extractFromArrayBuffer(arrayBuffer) {
        const compoundDocument =
            OleCompoundDocument.fromArrayBuffer(arrayBuffer)
        const streams = new Map()

        for (const name of compoundDocument.listStreams()) {
            streams.set(name, compoundDocument.getStream(name))
        }

        return IntLibStreamExtractor.extractFromStreams(streams)
    }

    /**
     * Extracts integrated-library metadata and source payloads from streams.
     * @param {Map<string, Uint8Array>} streams
     * @returns {{ version: string, crossReferences: object[], parameters: Record<string, string>, parameterRecords: object[], sources: object[], streamNames: string[], diagnostics: Record<string, number> }}
     */
    static extractFromStreams(streams) {
        const version = IntLibStreamExtractor.#decodeText(
            streams.get('Version.Txt')
        ).trim()
        const crossReferenceParse = IntLibStreamExtractor.#parseCrossReferences(
            streams.get('LibCrossRef.Txt')
        )
        const crossReferences = crossReferenceParse.records
        const parameterRecords = IntLibStreamExtractor.#parseParameterRecords(
            streams.get('Parameters   .bin')
        )
        const parameters =
            IntLibStreamExtractor.#buildParameterMap(parameterRecords)
        const sources = IntLibStreamExtractor.#extractSources(streams)
        const streamNames = IntLibStreamExtractor.#collectUsedStreamNames(
            streams,
            sources
        )

        return {
            version,
            crossReferences,
            parameters,
            parameterRecords,
            sources,
            streamNames,
            diagnostics: {
                crossReferenceCount: crossReferences.length,
                parameterCount: Object.keys(parameters).length,
                sourceCount: sources.length,
                issues: crossReferenceParse.issues
            }
        }
    }

    /**
     * Parses LibCrossRef.Txt into field records.
     * @param {Uint8Array | undefined} bytes
     * @returns {{ records: object[], issues: object[] }}
     */
    static #parseCrossReferences(bytes) {
        const records = []
        const issues = []

        IntLibStreamExtractor.#decodeText(bytes)
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line, index) => {
                const fields = PcbSidecarRecordParser.parseRecordFields(
                    new TextEncoder().encode(line)
                )
                const component = fields.COMPONENT || fields.COMPONENTNAME || ''
                const model = fields.MODEL || fields.MODELNAME || ''

                if (!Object.keys(fields).length || !component || !model) {
                    issues.push(
                        IntLibStreamExtractor.#issue(
                            'intlib.crossref.malformed-row',
                            'LibCrossRef.Txt',
                            index + 1,
                            'Skipped malformed integrated-library cross-reference row.'
                        )
                    )
                    return
                }

                records.push({
                    component,
                    model,
                    kind: fields.KIND || fields.TYPE || '',
                    fields
                })
            })

        return { records, issues }
    }

    /**
     * Builds a structured parser issue.
     * @param {string} code Stable diagnostic code.
     * @param {string} stream Source stream name.
     * @param {number} line One-based line number.
     * @param {string} message User-facing summary.
     * @returns {object}
     */
    static #issue(code, stream, line, message) {
        return {
            code,
            severity: 'warning',
            stream,
            line,
            message
        }
    }

    /**
     * Parses integrated-library parameter records.
     * @param {Uint8Array | undefined} bytes
     * @returns {object[]}
     */
    static #parseParameterRecords(bytes) {
        const lengthPrefixed =
            PcbSidecarRecordParser.parseLengthPrefixedRecords(
                bytes,
                'Parameters   .bin'
            )

        if (lengthPrefixed.length) {
            return lengthPrefixed.map((record) => record.fields)
        }

        return IntLibStreamExtractor.#decodeText(bytes)
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) =>
                PcbSidecarRecordParser.parseRecordFields(
                    new TextEncoder().encode(line)
                )
            )
            .filter((fields) => Object.keys(fields).length)
    }

    /**
     * Builds a parameter lookup from parameter records.
     * @param {Record<string, string>[]} records
     * @returns {Record<string, string>}
     */
    static #buildParameterMap(records) {
        const parameters = {}

        for (const record of records) {
            const name = record.NAME || record.PARAMETER || ''
            if (!name) {
                continue
            }

            parameters[name] = record.VALUE || ''
        }

        return parameters
    }

    /**
     * Extracts bundled source entries from recognized source-library folders.
     * @param {Map<string, Uint8Array>} streams
     * @returns {object[]}
     */
    static #extractSources(streams) {
        const sources = []

        for (const [path, bytes] of streams.entries()) {
            const sourceKind = IntLibStreamExtractor.#sourceKind(path)
            if (!sourceKind) {
                continue
            }

            const payload = IntLibStreamExtractor.#decodePayload(bytes)
            sources.push({
                path,
                fileName: IntLibStreamExtractor.#basename(path),
                fileType: IntLibStreamExtractor.#sourceFileType(path),
                libraryKind: sourceKind,
                compression: payload.compression,
                byteLength: payload.bytes.byteLength,
                payloadBase64: IntLibStreamExtractor.#bytesToBase64(
                    payload.bytes
                ),
                payloadText: IntLibStreamExtractor.#decodePrintablePayload(
                    payload.bytes
                )
            })
        }

        return sources.sort((left, right) =>
            left.path.localeCompare(right.path)
        )
    }

    /**
     * Decodes a possibly wrapped zlib source payload.
     * @param {Uint8Array} bytes
     * @returns {{ bytes: Uint8Array, compression: string }}
     */
    static #decodePayload(bytes) {
        const normalized = PcbSidecarRecordParser.toUint8Array(bytes)

        if (normalized[0] === 0x02 && normalized[1] === 0x78) {
            return {
                bytes: Uint8Array.from(unzlibSync(normalized.subarray(1))),
                compression: 'zlib-wrapper'
            }
        }

        if (normalized[0] === 0x78) {
            return {
                bytes: Uint8Array.from(unzlibSync(normalized)),
                compression: 'zlib'
            }
        }

        return {
            bytes: normalized,
            compression: 'none'
        }
    }

    /**
     * Decodes text bytes with toolkit printable-text fallbacks.
     * @param {Uint8Array | undefined} bytes
     * @returns {string}
     */
    static #decodeText(bytes) {
        if (!bytes) {
            return ''
        }

        return PrintableTextDecoder.decodeBytes(
            PcbSidecarRecordParser.toUint8Array(bytes)
        ).replace(/^\uFEFF/u, '')
    }

    /**
     * Decodes source payload text only when it looks printable.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #decodePrintablePayload(bytes) {
        const text = IntLibStreamExtractor.#decodeText(bytes)
            .replace(/\u0000/gu, '')
            .trim()
        if (!text || /[\u0001-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) {
            return ''
        }

        return text
    }

    /**
     * Resolves the source-library kind for one stream path.
     * @param {string} path
     * @returns {string}
     */
    static #sourceKind(path) {
        const normalized = String(path || '').replace(/\\/gu, '/')

        if (/^SchLib\//iu.test(normalized)) {
            return 'schematic-symbols'
        }
        if (/^PCBLib\//iu.test(normalized)) {
            return 'pcb-footprints'
        }
        if (/^PCB3DLib\//iu.test(normalized)) {
            return 'pcb-3d-models'
        }

        return ''
    }

    /**
     * Resolves the source file type from one stream path.
     * @param {string} path
     * @returns {string}
     */
    static #sourceFileType(path) {
        const extension = IntLibStreamExtractor.#basename(path).split('.').pop()

        if (/^SchLib$/iu.test(extension)) return 'SchLib'
        if (/^PcbLib$/iu.test(extension)) return 'PcbLib'
        if (/^PCB3DLib$/iu.test(extension)) return 'PCB3DLib'

        return extension || 'unknown'
    }

    /**
     * Returns the final path segment.
     * @param {string} path
     * @returns {string}
     */
    static #basename(path) {
        return String(path || '')
            .replace(/\\/gu, '/')
            .split('/')
            .pop()
    }

    /**
     * Collects streams that contributed to extraction.
     * @param {Map<string, Uint8Array>} streams
     * @param {object[]} sources
     * @returns {string[]}
     */
    static #collectUsedStreamNames(streams, sources) {
        return [
            'Version.Txt',
            'LibCrossRef.Txt',
            'Parameters   .bin',
            ...sources.map((source) => source.path)
        ]
            .filter((streamName) => streams.has(streamName))
            .sort((left, right) => left.localeCompare(right))
    }

    /**
     * Encodes bytes as base64 in browser and Node runtimes.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #bytesToBase64(bytes) {
        if (typeof btoa === 'function') {
            let binary = ''
            const chunkSize = 0x8000

            for (
                let offset = 0;
                offset < bytes.byteLength;
                offset += chunkSize
            ) {
                binary += String.fromCharCode(
                    ...bytes.subarray(offset, offset + chunkSize)
                )
            }

            return btoa(binary)
        }

        return Buffer.from(bytes).toString('base64')
    }
}
