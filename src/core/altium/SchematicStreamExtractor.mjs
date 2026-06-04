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
     * Extracts schematic records from the logical `FileHeader` stream.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ records: Array<{ raw: string, fields: Record<string, string | string[]>, sourceStream: string }>, streamNames: string[] } | null}
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

        let fileHeaderBytes

        try {
            fileHeaderBytes = compoundDocument.getStream('FileHeader')
        } catch {
            return null
        }

        const records = AsciiRecordParser.parse(
            SchematicStreamExtractor.#toArrayBuffer(fileHeaderBytes)
        ).map((record) => ({
            ...record,
            sourceStream: 'FileHeader'
        }))

        if (!records.length) {
            return null
        }

        return {
            records,
            streamNames: compoundDocument.listStreams(),
            embeddedFiles: EmbeddedFileInventoryBuilder.buildFromStreams(
                new Map(
                    compoundDocument
                        .listStreams()
                        .map((name) => [name, compoundDocument.getStream(name)])
                ),
                { skipStreamNames: ['FileHeader'] }
            )
        }
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
