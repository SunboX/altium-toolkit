// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumGeneratedLibraryRecordBuilder } from './AltiumGeneratedLibraryRecordBuilder.mjs'

/**
 * Builds deterministic textual and byte records for generated Altium libraries.
 */
export class AltiumLibraryRecordBuilder {
    /**
     * Builds a schematic component record.
     * @param {object} bundle Normalized component bundle.
     * @returns {string}
     */
    static buildSchematicComponentRecord(bundle) {
        return AltiumLibraryRecordBuilder.#pipeRecord({
            RECORD: 'Component',
            Name: bundle.symbol.name,
            SourceId: bundle.id,
            DisplayName: bundle.name,
            PinCount: String(bundle.symbol.pins.length),
            PrimitiveCount: String(bundle.symbol.primitives.length)
        })
    }

    /**
     * Builds a full schematic component data record stream.
     * @param {object} bundle Normalized component bundle.
     * @returns {string}
     */
    static buildSchematicComponentDataRecord(bundle) {
        return AltiumGeneratedLibraryRecordBuilder.buildSchematicComponentData(
            bundle
        )
    }

    /**
     * Builds a PCB footprint record.
     * @param {object} bundle Normalized component bundle.
     * @returns {string}
     */
    static buildPcbFootprintRecord(bundle) {
        return AltiumLibraryRecordBuilder.#pipeRecord({
            RECORD: 'Footprint',
            Name: bundle.footprint.name,
            SourceId: bundle.id,
            DisplayName: bundle.name,
            PadCount: String(bundle.footprint.pads.length),
            TrackCount: String(bundle.footprint.tracks.length),
            ArcCount: String(bundle.footprint.arcs.length),
            FillCount: String(bundle.footprint.fills.length),
            TextCount: String(bundle.footprint.texts.length),
            ModelCount: String(bundle.models.length)
        })
    }

    /**
     * Counts generated footprint primitives.
     * @param {object} bundle Normalized bundle.
     * @returns {number}
     */
    static footprintPrimitiveCount(bundle) {
        return AltiumGeneratedLibraryRecordBuilder.footprintPrimitiveCount(
            bundle.footprint
        )
    }

    /**
     * Builds a PcbLib Library/Data stream.
     * @param {object[]} bundles Normalized component bundles.
     * @returns {Uint8Array}
     */
    static buildPcbLibraryData(bundles) {
        const countBytes = AltiumLibraryRecordBuilder.createCountHeader(
            bundles.length
        )

        return AltiumLibraryRecordBuilder.concatBytes([
            AltiumLibraryRecordBuilder.createProperties({
                HEADER: 'PCB 6.0 Binary Library File',
                WEIGHT: '0',
                GENERATEDBY: 'ECAD Forge'
            }),
            countBytes,
            ...bundles.map((bundle) =>
                AltiumLibraryRecordBuilder.createStringBlock(
                    bundle.footprint.name
                )
            )
        ])
    }

    /**
     * Builds a PcbLib component parameters table.
     * @param {object[]} bundles Normalized component bundles.
     * @returns {Uint8Array}
     */
    static buildComponentParamsToc(bundles) {
        return AltiumLibraryRecordBuilder.concatBytes(
            bundles.map((bundle) =>
                AltiumLibraryRecordBuilder.createLengthPrefixedAscii(
                    AltiumLibraryRecordBuilder.#pipeRecord({
                        Name: bundle.footprint.name,
                        'Pad Count': String(bundle.footprint.pads.length),
                        Height: String(bundle.metadata.height || ''),
                        Description: String(bundle.metadata.description || '')
                    }) + '\r\n\u0000'
                )
            )
        )
    }

    /**
     * Builds a SectionKeys stream.
     * @param {object[]} bundles Normalized component bundles.
     * @returns {Uint8Array}
     */
    static buildSectionKeys(bundles) {
        const entries = bundles.map((bundle) => ({
            fullName: bundle.footprint.name,
            storageName: AltiumLibraryRecordBuilder.sanitizeStorageName(
                bundle.footprint.name
            )
        }))

        return AltiumLibraryRecordBuilder.concatBytes([
            AltiumLibraryRecordBuilder.createCountHeader(entries.length),
            ...entries.flatMap((entry) => [
                AltiumLibraryRecordBuilder.createStringBlock(entry.fullName),
                AltiumLibraryRecordBuilder.createStringBlock(entry.storageName)
            ])
        ])
    }

    /**
     * Builds a footprint Data stream.
     * @param {object} bundle Normalized component bundle.
     * @returns {Uint8Array}
     */
    static buildFootprintData(bundle) {
        return AltiumLibraryRecordBuilder.concatBytes([
            AltiumLibraryRecordBuilder.createStringBlock(bundle.footprint.name),
            ...AltiumGeneratedLibraryRecordBuilder.buildFootprintPrimitiveRecords(
                bundle.footprint
            )
        ])
    }

    /**
     * Builds a footprint Parameters stream.
     * @param {object} bundle Normalized component bundle.
     * @returns {Uint8Array}
     */
    static buildFootprintParameters(bundle) {
        return AltiumLibraryRecordBuilder.createProperties({
            PATTERN: bundle.footprint.name,
            DESCRIPTION: String(bundle.metadata.description || ''),
            HEIGHT: String(bundle.metadata.height || ''),
            ITEMGUID: AltiumLibraryRecordBuilder.#guidFromText(bundle.id)
        })
    }

    /**
     * Builds model metadata entries.
     * @param {{ model: object, id: string, checksum: number }[]} models Model rows.
     * @returns {Uint8Array}
     */
    static buildModelsData(models) {
        return AltiumLibraryRecordBuilder.concatBytes(
            models.map((row) =>
                AltiumLibraryRecordBuilder.createLengthPrefixedAscii(
                    AltiumLibraryRecordBuilder.#pipeRecord({
                        ID: row.id,
                        NAME: row.model.name,
                        CHECKSUM: String(row.checksum),
                        FORMAT: row.model.format
                    }) + '\u0000'
                )
            )
        )
    }

    /**
     * Creates a little-endian count header.
     * @param {number} count Count value.
     * @returns {Uint8Array}
     */
    static createCountHeader(count) {
        const bytes = new Uint8Array(4)
        new DataView(bytes.buffer).setUint32(0, Number(count || 0), true)
        return bytes
    }

    /**
     * Creates a PcbLib property stream.
     * @param {Record<string, string>} properties Properties.
     * @returns {Uint8Array}
     */
    static createProperties(properties) {
        return AltiumLibraryRecordBuilder.createLengthPrefixedAscii(
            AltiumLibraryRecordBuilder.#pipeRecord(properties) + '\u0000'
        )
    }

    /**
     * Creates a Pascal-style string block.
     * @param {string} text Text value.
     * @returns {Uint8Array}
     */
    static createStringBlock(text) {
        const encoded = new TextEncoder().encode(String(text || ''))
        const bytes = new Uint8Array(4 + 1 + encoded.byteLength)
        const view = new DataView(bytes.buffer)

        view.setUint32(0, 1 + encoded.byteLength, true)
        bytes[4] = encoded.byteLength
        bytes.set(encoded, 5)

        return bytes
    }

    /**
     * Creates a length-prefixed ASCII/UTF-8 byte block.
     * @param {string} text Text body.
     * @returns {Uint8Array}
     */
    static createLengthPrefixedAscii(text) {
        const encoded = new TextEncoder().encode(String(text || ''))
        const bytes = new Uint8Array(4 + encoded.byteLength)

        new DataView(bytes.buffer).setUint32(0, encoded.byteLength, true)
        bytes.set(encoded, 4)

        return bytes
    }

    /**
     * Concatenates byte chunks.
     * @param {Uint8Array[]} chunks Byte chunks.
     * @returns {Uint8Array}
     */
    static concatBytes(chunks) {
        const byteLength = chunks.reduce(
            (sum, chunk) => sum + chunk.byteLength,
            0
        )
        const bytes = new Uint8Array(byteLength)
        let offset = 0

        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return bytes
    }

    /**
     * Sanitizes one OLE storage name.
     * @param {string} name Storage name.
     * @returns {string}
     */
    static sanitizeStorageName(name) {
        return String(name || 'Component')
            .replace(/[\\/:\u0000-\u001f]/gu, '_')
            .slice(0, 31)
    }

    /**
     * Computes a simple deterministic checksum for generated model metadata.
     * @param {Uint8Array} bytes Model bytes.
     * @returns {number}
     */
    static checksumBytes(bytes) {
        return [...bytes].reduce(
            (checksum, value) => (checksum + value) >>> 0,
            0
        )
    }

    /**
     * Builds one pipe-delimited record.
     * @param {Record<string, string>} fields Record fields.
     * @returns {string}
     */
    static #pipeRecord(fields) {
        return (
            '|' +
            Object.entries(fields)
                .filter(([, value]) => String(value ?? '') !== '')
                .map(([key, value]) => key + '=' + String(value))
                .join('|')
        )
    }

    /**
     * Builds a deterministic GUID-like id from text.
     * @param {string} text Source text.
     * @returns {string}
     */
    static #guidFromText(text) {
        const hex = [...new TextEncoder().encode(String(text || ''))]
            .map((value) => value.toString(16).padStart(2, '0'))
            .join('')
            .padEnd(32, '0')
            .slice(0, 32)

        return (
            '{' +
            hex.slice(0, 8) +
            '-' +
            hex.slice(8, 12) +
            '-' +
            hex.slice(12, 16) +
            '-' +
            hex.slice(16, 20) +
            '-' +
            hex.slice(20) +
            '}'
        )
    }
}
