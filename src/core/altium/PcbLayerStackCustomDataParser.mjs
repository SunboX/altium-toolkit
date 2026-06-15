// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzlibSync } from 'fflate'
import { ParserUtils } from './ParserUtils.mjs'
import { PcbLayerStackInterchangeParser } from './PcbLayerStackInterchangeParser.mjs'

const { getField } = ParserUtils

/**
 * Extracts compressed stack custom data from PCB board records.
 */
export class PcbLayerStackCustomDataParser {
    /**
     * Appends decoded stack custom data records after native board records.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} boardRecords Board records.
     * @returns {{ fields: Record<string, string>, sourceStream?: string, stackCustomData: true }[]}
     */
    static parseBoardRecords(boardRecords) {
        return PcbLayerStackCustomDataParser.parseBoardRecordsWithDiagnostics(
            boardRecords
        ).records
    }

    /**
     * Decodes stack custom data records with caller-visible diagnostics.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} boardRecords Board records.
     * @returns {{ records: { fields: Record<string, string>, sourceStream?: string, stackCustomData: true }[], diagnostics: object[] }}
     */
    static parseBoardRecordsWithDiagnostics(boardRecords) {
        const records = []
        const diagnostics = []

        for (const record of boardRecords || []) {
            const parsed =
                PcbLayerStackCustomDataParser.#parseBoardRecord(record)

            if (parsed.record) {
                records.push(parsed.record)
            }
            diagnostics.push(...parsed.diagnostics)
        }

        return { records, diagnostics }
    }

    /**
     * Parses one board record.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }} record Board record.
     * @returns {{ record: { fields: Record<string, string>, sourceStream?: string, stackCustomData: true } | null, diagnostics: object[] }}
     */
    static #parseBoardRecord(record) {
        const encoded = PcbLayerStackCustomDataParser.#encodedField(
            record?.fields
        )

        if (!encoded.value) {
            return { record: null, diagnostics: [] }
        }

        const decoded = PcbLayerStackCustomDataParser.#decodePayload(
            encoded.value
        )

        if (decoded.error) {
            return {
                record: null,
                diagnostics: [
                    PcbLayerStackCustomDataParser.#decodeDiagnostic(
                        record,
                        encoded.name
                    )
                ]
            }
        }

        if (!decoded.text) {
            return { record: null, diagnostics: [] }
        }

        const fields = PcbLayerStackInterchangeParser.parseTextToFields(
            decoded.text,
            { format: 'stackupx' }
        )

        if (!Object.keys(fields).length) {
            return { record: null, diagnostics: [] }
        }

        return {
            record: {
                sourceStream: record?.sourceStream,
                fields,
                stackCustomData: true
            },
            diagnostics: []
        }
    }

    /**
     * Finds the first stack custom data field.
     * @param {Record<string, string | string[]> | undefined} fields Board fields.
     * @returns {{ name: string, value: string }}
     */
    static #encodedField(fields) {
        const v9Value = getField(fields, 'V9_STACKCUSTOMDATA')

        if (v9Value) {
            return { name: 'V9_STACKCUSTOMDATA', value: v9Value }
        }

        return {
            name: 'STACKCUSTOMDATA',
            value: getField(fields, 'STACKCUSTOMDATA') || ''
        }
    }

    /**
     * Builds one invalid stack custom data diagnostic.
     * @param {{ sourceStream?: string }} record Source record.
     * @param {string} fieldName Encoded field name.
     * @returns {{ code: string, severity: string, message: string, sourceStream?: string, fieldName: string }}
     */
    static #decodeDiagnostic(record, fieldName) {
        return {
            code: 'pcb.layer-stack-custom-data.decode-failed',
            severity: 'warning',
            message:
                'Compressed PCB layer stack custom data could not be decoded.',
            sourceStream: record?.sourceStream,
            fieldName
        }
    }

    /**
     * Decodes one base64 zlib stack payload.
     * @param {string} encoded Encoded field value.
     * @returns {{ text: string, error: Error | null }}
     */
    static #decodePayload(encoded) {
        if (!encoded) {
            return { text: '', error: null }
        }

        try {
            const inflated = unzlibSync(
                PcbLayerStackCustomDataParser.#base64ToBytes(encoded)
            )
            const text = new TextDecoder()
                .decode(inflated)
                .replace(/^\?/, '')
                .replace(/\0+$/u, '')
                .trim()

            return { text, error: null }
        } catch (error) {
            return { text: '', error }
        }
    }

    /**
     * Converts base64 text into bytes in browser and Node runtimes.
     * @param {string} encoded Base64 text.
     * @returns {Uint8Array}
     */
    static #base64ToBytes(encoded) {
        const normalized = String(encoded || '').replace(/\s+/gu, '')

        if (typeof Buffer !== 'undefined') {
            return Uint8Array.from(Buffer.from(normalized, 'base64'))
        }

        const binary = globalThis.atob(normalized)
        const bytes = new Uint8Array(binary.length)

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index) & 0xff
        }

        return bytes
    }
}
