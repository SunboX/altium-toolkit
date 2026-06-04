// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PrintableTextDecoder } from './PrintableTextDecoder.mjs'

/**
 * Decodes via-protection sidecar records and links them to via primitives.
 */
export class PcbViaStructureParser {
    static #STRUCTURE_STREAM_NAMES = [
        'ViaStructures/Data',
        'ViaStructureManager/Data'
    ]

    /**
     * Extracts via-protection structures and primitive links from stream data.
     * @param {Map<string, Uint8Array>} streams
     * @returns {{ structures: object[], links: object[], byPrimitiveIndex: Record<string, object> }}
     */
    static extractFromStreams(streams) {
        const structures = []
        const links = []

        for (const streamName of PcbViaStructureParser
            .#STRUCTURE_STREAM_NAMES) {
            const records = PcbViaStructureParser.#parseLengthPrefixedRecords(
                streams.get(streamName),
                streamName
            )

            for (const record of records) {
                const structure =
                    PcbViaStructureParser.#parseStructureRecord(record)
                const link = PcbViaStructureParser.#parseLinkRecord(record)

                if (structure) {
                    structures.push(structure)
                }
                if (link) {
                    links.push(link)
                }
            }
        }

        return PcbViaStructureParser.#buildLookup(structures, links)
    }

    /**
     * Adds via-protection metadata to parsed via primitives in place.
     * @param {object[]} vias
     * @param {{ byPrimitiveIndex?: Record<string, object> }} viaStructures
     */
    static attachToVias(vias, viaStructures) {
        if (!Array.isArray(vias) || !viaStructures?.byPrimitiveIndex) {
            return
        }

        for (let index = 0; index < vias.length; index += 1) {
            const viaProtection = viaStructures.byPrimitiveIndex[String(index)]
            if (!viaProtection) {
                continue
            }

            vias[index].viaStructureIndex = viaProtection.viaStructureIndex
            if (viaProtection.ipc4761Type !== undefined) {
                vias[index].ipc4761Type = viaProtection.ipc4761Type
            }
            vias[index].viaProtection = {
                ipc4761Type: viaProtection.ipc4761Type,
                structureType: viaProtection.structureType,
                features: viaProtection.features
            }
            vias[index].drill = {
                holeKind: 'via',
                plating:
                    vias[index].isPlated === false ? 'non-plated' : 'plated',
                renderState:
                    PcbViaStructureParser.#resolveDrillRenderState(
                        viaProtection
                    ),
                ipc4761Type: viaProtection.ipc4761Type
            }
        }
    }

    /**
     * Resolves a display drill state from via-protection metadata.
     * @param {{ ipc4761Type?: number | string, features?: object[] }} viaProtection Via-protection metadata.
     * @returns {'open' | 'covered' | 'filled' | 'capped'}
     */
    static #resolveDrillRenderState(viaProtection) {
        const featureText = (viaProtection?.features || [])
            .flatMap((feature) => [feature.type, feature.material])
            .join(' ')
            .toLowerCase()

        if (/cap/u.test(featureText)) return 'capped'
        if (/fill|plug/u.test(featureText)) return 'filled'
        if (/cover|tent|mask/u.test(featureText)) return 'covered'

        const ipcType = Number(viaProtection?.ipc4761Type)
        if (ipcType === 6 || ipcType === 7) return 'capped'
        if (ipcType === 3 || ipcType === 4 || ipcType === 5) return 'filled'
        if (ipcType === 1 || ipcType === 2) return 'covered'
        return 'open'
    }

    /**
     * Parses one sidecar stream into field records.
     * @param {Uint8Array | undefined} dataBytes
     * @param {string} sourceStream
     * @returns {{ fields: Record<string, string>, sourceStream: string, recordIndex: number }[]}
     */
    static #parseLengthPrefixedRecords(dataBytes, sourceStream) {
        const bytes = PcbViaStructureParser.#toUint8Array(dataBytes)
        const records = []
        let offset = 0

        while (offset + 4 <= bytes.byteLength) {
            const recordLength = PcbViaStructureParser.#readUint32(
                bytes,
                offset
            )
            offset += 4

            if (recordLength <= 0 || offset + recordLength > bytes.byteLength) {
                break
            }

            const recordBytes = bytes.subarray(offset, offset + recordLength)
            offset += recordLength

            records.push({
                fields: PcbViaStructureParser.#parseRecordFields(recordBytes),
                sourceStream,
                recordIndex: records.length
            })
        }

        return records
    }

    /**
     * Parses one pipe-delimited sidecar record.
     * @param {Uint8Array} bytes
     * @returns {Record<string, string>}
     */
    static #parseRecordFields(bytes) {
        const text = PrintableTextDecoder.decodeBytes(bytes)
            .replace(/\u0000/gu, '')
            .trim()
        const fields = {}

        for (const segment of text.split('|')) {
            const candidate = segment.trim()
            const separatorIndex = candidate.indexOf('=')
            if (separatorIndex <= 0) {
                continue
            }

            const key = candidate.slice(0, separatorIndex).trim().toUpperCase()
            if (!key) {
                continue
            }

            fields[key] = candidate.slice(separatorIndex + 1).trim()
        }

        return fields
    }

    /**
     * Parses one via structure definition record.
     * @param {{ fields: Record<string, string>, sourceStream: string, recordIndex: number }} record
     * @returns {object | null}
     */
    static #parseStructureRecord(record) {
        if (!('STRUCTURETYPE' in record.fields)) {
            return null
        }

        const index =
            PcbViaStructureParser.#parseInteger(
                record.fields.VIASTRUCTUREINDEX
            ) ?? record.recordIndex
        const structureType = PcbViaStructureParser.#parseIntegerOrString(
            record.fields.STRUCTURETYPE
        )

        return {
            index,
            ipc4761Type: structureType,
            structureType,
            sourceStream: record.sourceStream,
            features: PcbViaStructureParser.#parseFeatures(record.fields)
        }
    }

    /**
     * Parses one primitive-to-structure link record.
     * @param {{ fields: Record<string, string>, sourceStream: string }} record
     * @returns {{ primitiveIndex: number, viaStructureIndex: number, sourceStream: string } | null}
     */
    static #parseLinkRecord(record) {
        const primitiveIndex = PcbViaStructureParser.#parseInteger(
            record.fields.PRIMITIVEINDEX ?? record.fields.VIAINDEX
        )
        const viaStructureIndex = PcbViaStructureParser.#parseInteger(
            record.fields.VIASTRUCTUREINDEX ?? record.fields.STRUCTUREINDEX
        )

        if (primitiveIndex === null || viaStructureIndex === null) {
            return null
        }

        return {
            primitiveIndex,
            viaStructureIndex,
            sourceStream: record.sourceStream
        }
    }

    /**
     * Parses repeated via-protection feature fields.
     * @param {Record<string, string>} fields
     * @returns {{ index: number, type: string, side: string, material: string }[]}
     */
    static #parseFeatures(fields) {
        const features = []

        for (let index = 0; index < 16; index += 1) {
            const type = fields[`FEATURETYPE${index}`]
            const side = fields[`FEATURESIDE${index}`]
            const material = fields[`FEATUREMATERIAL${index}`]

            if (!type && !side && !material) {
                continue
            }

            features.push({
                index,
                type: type || '',
                side: side || '',
                material: material || ''
            })
        }

        return features
    }

    /**
     * Builds link lookups keyed by via primitive index.
     * @param {object[]} structures
     * @param {{ primitiveIndex: number, viaStructureIndex: number }[]} links
     * @returns {{ structures: object[], links: object[], byPrimitiveIndex: Record<string, object> }}
     */
    static #buildLookup(structures, links) {
        const structuresByIndex = new Map(
            structures.map((structure) => [structure.index, structure])
        )
        const byPrimitiveIndex = {}

        for (const link of links) {
            const structure = structuresByIndex.get(link.viaStructureIndex)
            if (!structure) {
                continue
            }

            byPrimitiveIndex[String(link.primitiveIndex)] = {
                viaStructureIndex: link.viaStructureIndex,
                ipc4761Type: structure.ipc4761Type,
                structureType: structure.structureType,
                features: structure.features
            }
        }

        return {
            structures,
            links,
            byPrimitiveIndex
        }
    }

    /**
     * Parses a finite integer from a field value.
     * @param {string | undefined} value
     * @returns {number | null}
     */
    static #parseInteger(value) {
        const number = Number(value)
        return Number.isInteger(number) ? number : null
    }

    /**
     * Parses a number when possible and otherwise preserves the string value.
     * @param {string | undefined} value
     * @returns {number | string}
     */
    static #parseIntegerOrString(value) {
        const parsed = PcbViaStructureParser.#parseInteger(value)
        return parsed === null ? String(value || '') : parsed
    }

    /**
     * Reads one little-endian unsigned integer from a byte view.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static #readUint32(bytes, offset) {
        return new DataView(
            bytes.buffer,
            bytes.byteOffset + offset,
            4
        ).getUint32(0, true)
    }

    /**
     * Normalizes one byte-like input into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer | undefined} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        if (!bytes) {
            return new Uint8Array(0)
        }

        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes)
    }
}
