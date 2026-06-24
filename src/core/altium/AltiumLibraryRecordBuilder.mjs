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
     * @param {{ bundle: object, model: object, id: string, checksum: number }[]} models Model rows.
     * @returns {Uint8Array}
     */
    static buildModelsData(models) {
        return AltiumLibraryRecordBuilder.concatBytes(
            models.map((row) =>
                AltiumLibraryRecordBuilder.createLengthPrefixedAscii(
                    AltiumLibraryRecordBuilder.#pipeRecord({
                        EMBED: 'TRUE',
                        MODELSOURCE: 'Undefined',
                        ID: row.id,
                        ...AltiumLibraryRecordBuilder.#modelMetadataTransform(
                            row
                        ),
                        NAME: row.model.name,
                        CHECKSUM: String(row.checksum),
                        FORMAT: row.model.format
                    }) + '\u0000'
                )
            )
        )
    }

    /**
     * Builds component-body placement records for embedded model rows.
     * @param {{ bundle: object, model: object, id: string, checksum: number }[]} models Model rows.
     * @returns {Uint8Array}
     */
    static buildComponentBodiesData(models) {
        return AltiumLibraryRecordBuilder.concatBytes(
            models.map((row) =>
                new TextEncoder().encode(
                    AltiumLibraryRecordBuilder.#pipeRecord(
                        AltiumLibraryRecordBuilder.#componentBodyFields(row)
                    ) + '\u0000'
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
     * Builds model metadata transform fields.
     * @param {{ bundle: object, model: object }} row Model row.
     * @returns {Record<string, string>}
     */
    static #modelMetadataTransform(row) {
        const rotation = AltiumLibraryRecordBuilder.#modelRotation(
            row.model,
            AltiumLibraryRecordBuilder.#rowComponent(row)
        )

        return {
            ROTX: AltiumLibraryRecordBuilder.#numberText(rotation.x),
            ROTY: AltiumLibraryRecordBuilder.#numberText(rotation.y),
            ROTZ: AltiumLibraryRecordBuilder.#numberText(rotation.z),
            DZ: AltiumLibraryRecordBuilder.#milText(
                AltiumLibraryRecordBuilder.#modelDzMil(row.model)
            )
        }
    }

    /**
     * Builds one component-body placement record.
     * @param {{ bundle: object, model: object, id: string, checksum: number }} row Model row.
     * @returns {Record<string, string>}
     */
    static #componentBodyFields(row) {
        const offset = AltiumLibraryRecordBuilder.#modelOffsetMil(row.model)
        const rotation = AltiumLibraryRecordBuilder.#modelRotation(
            row.model,
            AltiumLibraryRecordBuilder.#rowComponent(row)
        )

        return {
            V7_LAYER: 'MECHANICAL1',
            KIND: '0',
            SUBPOLYINDEX: '-1',
            UNIONINDEX: '0',
            ISSHAPEBASED: 'FALSE',
            STANDOFFHEIGHT: '0mil',
            OVERALLHEIGHT: '0mil',
            IDENTIFIER: AltiumLibraryRecordBuilder.#identifierBytes(
                row.bundle?.footprint?.name || row.model?.name || row.id
            ),
            MODELID: row.id,
            'MODEL.CHECKSUM': String(row.checksum),
            'MODEL.EMBED': 'TRUE',
            'MODEL.NAME': row.model.name,
            'MODEL.2D.X': AltiumLibraryRecordBuilder.#milText(offset.x),
            'MODEL.2D.Y': AltiumLibraryRecordBuilder.#milText(offset.y),
            'MODEL.2D.ROTATION': '0',
            'MODEL.3D.ROTX': AltiumLibraryRecordBuilder.#numberText(rotation.x),
            'MODEL.3D.ROTY': AltiumLibraryRecordBuilder.#numberText(rotation.y),
            'MODEL.3D.ROTZ': AltiumLibraryRecordBuilder.#numberText(rotation.z),
            'MODEL.3D.DZ': AltiumLibraryRecordBuilder.#milText(
                AltiumLibraryRecordBuilder.#modelDzMil(row.model)
            ),
            'MODEL.MODELSOURCE': 'Undefined'
        }
    }

    /**
     * Resolves the source component attached to a model row.
     * @param {{ bundle?: object }} row Model row.
     * @returns {object}
     */
    static #rowComponent(row) {
        return (
            row?.bundle?.footprint?.component ||
            row?.bundle?.footprint?.raw?.component ||
            {}
        )
    }

    /**
     * Resolves one model transform object.
     * @param {object} model Model asset.
     * @returns {object}
     */
    static #modelTransform(model) {
        return model?.transform || model?.raw?.transform || {}
    }

    /**
     * Resolves model offset in mils.
     * @param {object} model Model asset.
     * @returns {{ x: number, y: number }}
     */
    static #modelOffsetMil(model) {
        const transform = AltiumLibraryRecordBuilder.#modelTransform(model)
        const offsetMil = transform.offsetMil || {}

        return {
            x: AltiumLibraryRecordBuilder.#round(
                AltiumLibraryRecordBuilder.#number(
                    offsetMil.x ?? transform.dxMil,
                    0
                )
            ),
            y: AltiumLibraryRecordBuilder.#round(
                AltiumLibraryRecordBuilder.#number(
                    offsetMil.y ?? transform.dyMil,
                    0
                )
            )
        }
    }

    /**
     * Resolves one model Z offset in mils.
     * @param {object} model Model asset.
     * @returns {number}
     */
    static #modelDzMil(model) {
        const transform = AltiumLibraryRecordBuilder.#modelTransform(model)
        const offsetMil = transform.offsetMil || {}

        return AltiumLibraryRecordBuilder.#round(
            AltiumLibraryRecordBuilder.#number(
                offsetMil.z ?? transform.dzMil,
                0
            )
        )
    }

    /**
     * Resolves model 3D rotation in footprint-local degrees.
     * @param {object} model Model asset.
     * @param {object} component Selected footprint component origin.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #modelRotation(model, component) {
        const transform = AltiumLibraryRecordBuilder.#modelTransform(model)
        const rotation = transform.rotationDeg || {}
        const generatedRotation =
            AltiumLibraryRecordBuilder.#generatedFrameRotation(model, component)

        return {
            x: AltiumLibraryRecordBuilder.#round(
                AltiumLibraryRecordBuilder.#number(rotation.x, 0) +
                    generatedRotation.x
            ),
            y: AltiumLibraryRecordBuilder.#round(
                AltiumLibraryRecordBuilder.#number(rotation.y, 0) +
                    generatedRotation.y
            ),
            z: AltiumLibraryRecordBuilder.#round(
                AltiumLibraryRecordBuilder.#number(rotation.z, 0) +
                    generatedRotation.z
            )
        }
    }

    /**
     * Resolves correction for generated stitched STEP files.
     * @param {object} model Model asset.
     * @param {object} component Selected footprint component origin.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #generatedFrameRotation(model, component) {
        if (model?.generated !== true && model?.raw?.generated !== true) {
            return { x: 0, y: 0, z: 0 }
        }

        return {
            x: -90,
            y: 0,
            z: AltiumLibraryRecordBuilder.#normalizeAngle(
                -AltiumLibraryRecordBuilder.#number(component?.rotation, 0)
            )
        }
    }

    /**
     * Encodes one Altium identifier as comma-separated character codes.
     * @param {string} text Source text.
     * @returns {string}
     */
    static #identifierBytes(text) {
        return [...String(text || '')]
            .map((character) => character.charCodeAt(0))
            .join(',')
    }

    /**
     * Formats a model distance in mils.
     * @param {number} value Value in mils.
     * @returns {string}
     */
    static #milText(value) {
        return AltiumLibraryRecordBuilder.#numberText(value) + 'mil'
    }

    /**
     * Formats one numeric record field.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static #numberText(value) {
        return String(AltiumLibraryRecordBuilder.#round(value))
    }

    /**
     * Reads a finite number with fallback.
     * @param {unknown} value Candidate value.
     * @param {number} fallback Fallback value.
     * @returns {number}
     */
    static #number(value, fallback) {
        const number = Number(value)
        return Number.isFinite(number) ? number : fallback
    }

    /**
     * Rounds generated numeric fields.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        const rounded = Number(Number(value || 0).toFixed(6))
        return Object.is(rounded, -0) ? 0 : rounded
    }

    /**
     * Normalizes a degree angle to the 0-360 range.
     * @param {number} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        return ((angle % 360) + 360) % 360
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
