// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { EmbeddedFileInventoryBuilder } from './EmbeddedFileInventoryBuilder.mjs'
import { NativeStreamInventoryBuilder } from './NativeStreamInventoryBuilder.mjs'
import { SchematicRecordStreamParser } from './SchematicRecordStreamParser.mjs'
import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'
import { OleConstants } from '../ole/OleConstants.mjs'

/**
 * Extracts stream-scoped printable schematic content from OLE-backed SchDoc
 * containers.
 */
export class SchematicStreamExtractor {
    static #AUXILIARY_PRINTABLE_STREAMS = new Set(['Additional'])

    /**
     * Returns true when one buffer starts with the OLE compound-document
     * signature.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {boolean}
     */
    static isCompoundDocument(arrayBuffer) {
        const bytes = new Uint8Array(
            arrayBuffer,
            0,
            Math.min(
                arrayBuffer.byteLength,
                OleConstants.HEADER_SIGNATURE.length
            )
        )

        if (bytes.byteLength < OleConstants.HEADER_SIGNATURE.length) {
            return false
        }

        return OleConstants.HEADER_SIGNATURE.every(
            (value, index) => bytes[index] === value
        )
    }

    /**
     * Extracts schematic records from the logical `FileHeader` stream and
     * Altium's auxiliary printable schematic streams.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ records: Array<{ raw: string, fields: Record<string, string | string[]>, sourceStream: string }>, streamNames: string[], embeddedFiles?: object } | null}
     */
    static extractFromArrayBuffer(arrayBuffer) {
        if (!SchematicStreamExtractor.isCompoundDocument(arrayBuffer)) {
            return null
        }

        let compoundDocument

        try {
            compoundDocument = OleCompoundDocument.fromArrayBuffer(arrayBuffer)
        } catch {
            return null
        }

        let fileHeaderParse

        try {
            fileHeaderParse = SchematicStreamExtractor.#parseStreamRecords(
                compoundDocument,
                'FileHeader'
            )
        } catch {
            return null
        }

        const streamNames = compoundDocument.listStreams()
        const auxiliaryStreamNames = streamNames.filter((streamName) =>
            SchematicStreamExtractor.#isAuxiliaryPrintableStream(streamName)
        )
        const auxiliaryParses = auxiliaryStreamNames.map((streamName) =>
            SchematicStreamExtractor.#parseStreamRecords(
                compoundDocument,
                streamName
            )
        )
        const records = [
            ...fileHeaderParse.records,
            ...auxiliaryParses.flatMap((entry) => entry.records)
        ]
        const opaqueRecords = [
            ...fileHeaderParse.opaqueRecords,
            ...auxiliaryParses.flatMap((entry) => entry.opaqueRecords)
        ]

        if (!records.length && !opaqueRecords.length) {
            return null
        }

        const embeddedFiles = EmbeddedFileInventoryBuilder.buildFromStreams(
            new Map(
                streamNames.map((name) => [
                    name,
                    compoundDocument.getStream(name)
                ])
            ),
            {
                skipStreamNames: ['FileHeader', ...auxiliaryStreamNames]
            }
        )
        const consumedStreamNames = [
            'FileHeader',
            ...auxiliaryStreamNames,
            ...embeddedFiles.files.map((file) => file.sourceStream),
            ...embeddedFiles.diagnostics.map(
                (diagnostic) => diagnostic.sourceStream
            )
        ]
        const nativeStreams = NativeStreamInventoryBuilder.buildFromStreams(
            new Map(
                streamNames.map((name) => [
                    name,
                    compoundDocument.getStream(name)
                ])
            ),
            {
                source: 'schdoc',
                consumedStreamNames,
                knownStreamNames: ['FileHeader', ...auxiliaryStreamNames]
            }
        )

        return {
            records,
            streamNames,
            opaqueRecords,
            nativeStreams,
            embeddedFiles
        }
    }

    /**
     * Parses printable records from one compound-document stream.
     * @param {OleCompoundDocument} compoundDocument
     * @param {string} streamName
     * @returns {{ records: Array<{ raw: string, fields: Record<string, string | string[]>, sourceStream: string }>, opaqueRecords: object[] }}
     */
    static #parseStreamRecords(compoundDocument, streamName) {
        const parsed = SchematicRecordStreamParser.parseWithOpaqueRecords(
            SchematicStreamExtractor.#toArrayBuffer(
                compoundDocument.getStream(streamName)
            ),
            { sourceStream: streamName }
        )

        return {
            records: parsed.records.map((record) => ({
                ...record,
                sourceStream: streamName
            })),
            opaqueRecords: parsed.opaqueRecords
        }
    }

    /**
     * Returns true for known non-embedded schematic streams with printable
     * primitive records.
     * @param {string} streamName
     * @returns {boolean}
     */
    static #isAuxiliaryPrintableStream(streamName) {
        const leafName = String(streamName || '')
            .split('/')
            .at(-1)

        return SchematicStreamExtractor.#AUXILIARY_PRINTABLE_STREAMS.has(
            leafName
        )
    }

    /**
     * Returns an ArrayBuffer view over one byte slice.
     * @param {Uint8Array} bytes
     * @returns {ArrayBuffer}
     */
    static #toArrayBuffer(bytes) {
        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )
    }
}
