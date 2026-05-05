// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'
import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils

/**
 * Normalizes embedded and external schematic image records.
 */
export class SchematicImageParser {
    /**
     * Parses schematic image records and resolves embedded payloads when the
     * file is an OLE container.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }[]} records
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ images: { x: number, y: number, cornerX: number, cornerY: number, fileName: string, embedded: boolean, keepAspect: boolean, mimeType: string, dataBase64: string, renderOrder: number, diagnosticState: string }[], diagnostics: { severity: 'info' | 'warning', message: string }[] }}
     */
    static parseSchematicImages(records, arrayBuffer) {
        const diagnostics = []
        const imageRecords = records.filter(
            (record) => getField(record.fields, 'RECORD') === '30'
        )
        let oleDocument = null

        if (
            imageRecords.some((record) =>
                SchematicImageParser.#isEmbedded(record.fields)
            )
        ) {
            try {
                oleDocument = OleCompoundDocument.fromArrayBuffer(arrayBuffer)
            } catch {
                oleDocument = null
            }
        }

        const images = imageRecords
            .map((record) =>
                SchematicImageParser.#parseSchematicImageRecord(
                    record,
                    oleDocument,
                    diagnostics
                )
            )
            .filter(Boolean)

        return { images, diagnostics }
    }

    /**
     * Returns true when one record requests an embedded image payload.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static #isEmbedded(fields) {
        return parseBoolean(fields.EmbedImage || fields.EMBEDIMAGE)
    }

    /**
     * Normalizes one image placement record.
     * @param {{ fields: Record<string, string | string[]>, recordIndex: number }} record
     * @param {OleCompoundDocument | null} oleDocument
     * @param {{ severity: 'info' | 'warning', message: string }[]} diagnostics
     * @returns {{ x: number, y: number, cornerX: number, cornerY: number, fileName: string, embedded: boolean, keepAspect: boolean, mimeType: string, dataBase64: string, renderOrder: number, diagnosticState: string } | null}
     */
    static #parseSchematicImageRecord(record, oleDocument, diagnostics) {
        const x = parseNumericField(record.fields, 'Location.X')
        const y = parseNumericField(record.fields, 'Location.Y')
        const cornerX = parseNumericField(record.fields, 'Corner.X')
        const cornerY = parseNumericField(record.fields, 'Corner.Y')

        if (x === null || y === null || cornerX === null || cornerY === null) {
            return null
        }

        const fileName =
            getField(record.fields, 'FileName') ||
            getField(record.fields, 'FILENAME')
        const embedded = SchematicImageParser.#isEmbedded(record.fields)
        const keepAspect = parseBoolean(
            record.fields.KeepAspect || record.fields.KEEPASPECT
        )
        const renderOrder =
            parseNumericField(record.fields, 'IndexInSheet') ??
            record.recordIndex
        let mimeType = ''
        let dataBase64 = ''
        let diagnosticState = embedded ? 'missing-embedded-payload' : 'external'

        if (embedded && fileName && oleDocument) {
            try {
                const streamBytes = oleDocument.getStream(fileName)
                mimeType = SchematicImageParser.#inferMimeType(fileName)
                dataBase64 = SchematicImageParser.#encodeBase64(streamBytes)
                diagnosticState = 'embedded'
            } catch {
                diagnostics.push({
                    severity: 'warning',
                    message:
                        'Embedded schematic image payload could not be resolved for ' +
                        fileName +
                        '.'
                })
            }
        } else if (embedded) {
            diagnostics.push({
                severity: 'warning',
                message:
                    'Embedded schematic image payload could not be resolved for ' +
                    (fileName || 'unnamed image') +
                    '.'
            })
        }

        return {
            x,
            y,
            cornerX,
            cornerY,
            fileName,
            embedded,
            keepAspect,
            mimeType,
            dataBase64,
            renderOrder,
            diagnosticState
        }
    }

    /**
     * Infers a MIME type from one file name.
     * @param {string} fileName
     * @returns {string}
     */
    static #inferMimeType(fileName) {
        const normalized = String(fileName || '').toLowerCase()

        if (normalized.endsWith('.bmp')) return 'image/bmp'
        if (normalized.endsWith('.gif')) return 'image/gif'
        if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
            return 'image/jpeg'
        }
        if (normalized.endsWith('.png')) return 'image/png'
        if (normalized.endsWith('.svg')) return 'image/svg+xml'
        if (normalized.endsWith('.tif') || normalized.endsWith('.tiff')) {
            return 'image/tiff'
        }

        return ''
    }

    /**
     * Encodes one byte array as base64 in both browser and test environments.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #encodeBase64(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64')
        }

        let binary = ''

        for (const byte of bytes) {
            binary += String.fromCharCode(byte)
        }

        return btoa(binary)
    }
}
