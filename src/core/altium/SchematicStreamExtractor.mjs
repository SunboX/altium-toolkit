// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AsciiRecordParser } from './AsciiRecordParser.mjs'
import { EmbeddedFileInventoryBuilder } from './EmbeddedFileInventoryBuilder.mjs'
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

        let fileHeaderRecords

        try {
            fileHeaderRecords = SchematicStreamExtractor.#parseStreamRecords(
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
        const auxiliaryRecords = auxiliaryStreamNames.flatMap((streamName) =>
            SchematicStreamExtractor.#parseStreamRecords(
                compoundDocument,
                streamName
            )
        )
        const records = [...fileHeaderRecords, ...auxiliaryRecords]

        if (!records.length) {
            return null
        }

        return {
            records,
            streamNames,
            embeddedFiles: EmbeddedFileInventoryBuilder.buildFromStreams(
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
        }
    }

    /**
     * Parses printable records from one compound-document stream.
     * @param {OleCompoundDocument} compoundDocument
     * @param {string} streamName
     * @returns {Array<{ raw: string, fields: Record<string, string | string[]>, sourceStream: string }>}
     */
    static #parseStreamRecords(compoundDocument, streamName) {
        return AsciiRecordParser.parse(
            SchematicStreamExtractor.#toArrayBuffer(
                compoundDocument.getStream(streamName)
            )
        ).map((record) => ({
            ...record,
            sourceStream: streamName
        }))
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
