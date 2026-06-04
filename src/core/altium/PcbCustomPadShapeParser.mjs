// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbSidecarRecordParser } from './PcbSidecarRecordParser.mjs'

/**
 * Decodes custom pad shape sidecars and links pads to authored geometry.
 */
export class PcbCustomPadShapeParser {
    static #SOURCE_STREAM = 'CustomShapes/Data'

    /**
     * Parses custom pad shape sidecar records.
     * @param {Uint8Array | ArrayBuffer | undefined} dataBytes
     * @param {string} [sourceStream]
     * @returns {{ entries: object[], byPrimitiveIndex: Record<string, object[]> }}
     */
    static parse(
        dataBytes,
        sourceStream = PcbCustomPadShapeParser.#SOURCE_STREAM
    ) {
        const entries = PcbSidecarRecordParser.parseLengthPrefixedRecords(
            dataBytes,
            sourceStream
        )
            .map((record) => PcbCustomPadShapeParser.#normalizeRecord(record))
            .filter(Boolean)
        const byPrimitiveIndex = {}

        for (const entry of entries) {
            const key = String(entry.primitiveIndex)
            byPrimitiveIndex[key] = byPrimitiveIndex[key] || []
            byPrimitiveIndex[key].push(entry)
        }

        return {
            entries,
            byPrimitiveIndex
        }
    }

    /**
     * Links custom shape entries to pad records in place.
     * @param {object[]} pads
     * @param {{ byPrimitiveIndex?: Record<string, object[]> }} customShapes
     * @param {{ regions?: object[], shapeBasedRegions?: object[], arcs?: object[], tracks?: object[], fills?: object[] }} geometry
     */
    static attachToPads(pads, customShapes, geometry = {}) {
        if (!Array.isArray(pads) || !customShapes?.byPrimitiveIndex) {
            return
        }

        for (let index = 0; index < pads.length; index += 1) {
            const entries = customShapes.byPrimitiveIndex[String(index)] || []
            if (!entries.length) {
                continue
            }

            pads[index].customShape =
                PcbCustomPadShapeParser.#buildPadCustomShape(
                    index,
                    entries,
                    geometry
                )
        }
    }

    /**
     * Normalizes one custom-shape sidecar record.
     * @param {{ fields: Record<string, string>, sourceStream: string }} record
     * @returns {object | null}
     */
    static #normalizeRecord(record) {
        const primitiveIndex = PcbSidecarRecordParser.parseInteger(
            PcbSidecarRecordParser.firstField(record.fields, [
                'PRIMITIVEINDEX',
                'PADINDEX',
                'ANCHORINDEX'
            ])
        )

        if (primitiveIndex === null) {
            return null
        }

        return {
            primitiveIndex,
            layer: PcbSidecarRecordParser.firstField(record.fields, ['LAYER']),
            layerId: PcbSidecarRecordParser.parseInteger(
                PcbSidecarRecordParser.firstField(record.fields, [
                    'LAYERID',
                    'LAYERINDEX'
                ])
            ),
            pasteMask: PcbSidecarRecordParser.parseBoolean(
                PcbSidecarRecordParser.firstField(record.fields, [
                    'PASTEMASK',
                    'HASPASTEMASK'
                ])
            ),
            solderMask: PcbSidecarRecordParser.parseBoolean(
                PcbSidecarRecordParser.firstField(record.fields, [
                    'SOLDERMASK',
                    'HASSOLDERMASK'
                ])
            ),
            regionIndexes: PcbCustomPadShapeParser.#parseIndexList(
                record.fields,
                ['REGIONINDEX', 'REGIONINDEXES']
            ),
            shapeRegionIndexes: PcbCustomPadShapeParser.#parseIndexList(
                record.fields,
                ['SHAPEREGIONINDEX', 'SHAPEREGIONINDEXES']
            ),
            arcIndexes: PcbCustomPadShapeParser.#parseIndexList(record.fields, [
                'ARCINDEX',
                'ARCINDEXES'
            ]),
            trackIndexes: PcbCustomPadShapeParser.#parseIndexList(
                record.fields,
                ['TRACKINDEX', 'TRACKINDEXES']
            ),
            fillIndexes: PcbCustomPadShapeParser.#parseIndexList(
                record.fields,
                ['FILLINDEX', 'FILLINDEXES']
            ),
            sourceStream: record.sourceStream,
            fields: record.fields
        }
    }

    /**
     * Builds the custom-shape object attached to a pad.
     * @param {number} primitiveIndex
     * @param {object[]} entries
     * @param {object} geometry
     * @returns {object}
     */
    static #buildPadCustomShape(primitiveIndex, entries, geometry) {
        return {
            primitiveIndex,
            sourceStream: entries[0]?.sourceStream || '',
            layers: entries.map((entry) =>
                PcbCustomPadShapeParser.#buildLayerShape(entry, geometry)
            )
        }
    }

    /**
     * Resolves one layer-specific shape entry.
     * @param {object} entry
     * @param {object} geometry
     * @returns {object}
     */
    static #buildLayerShape(entry, geometry) {
        return {
            layer: entry.layer,
            layerId: entry.layerId,
            pasteMask: entry.pasteMask,
            solderMask: entry.solderMask,
            regions: PcbCustomPadShapeParser.#lookupMany(
                geometry.regions || [],
                entry.regionIndexes
            ),
            arcs: PcbCustomPadShapeParser.#lookupMany(
                geometry.arcs || [],
                entry.arcIndexes
            ),
            tracks: PcbCustomPadShapeParser.#lookupMany(
                geometry.tracks || [],
                entry.trackIndexes
            ),
            fills: PcbCustomPadShapeParser.#lookupMany(
                geometry.fills || [],
                entry.fillIndexes
            ),
            ...(entry.shapeRegionIndexes.length
                ? {
                      shapeRegions: PcbCustomPadShapeParser.#lookupMany(
                          geometry.shapeBasedRegions || [],
                          entry.shapeRegionIndexes
                      )
                  }
                : {})
        }
    }

    /**
     * Resolves several primitive indexes into object references.
     * @param {object[]} collection
     * @param {number[]} indexes
     * @returns {object[]}
     */
    static #lookupMany(collection, indexes) {
        return indexes
            .map((index) => collection[index])
            .filter((value) => value && typeof value === 'object')
    }

    /**
     * Parses one or more integer indexes from scalar or numbered fields.
     * @param {Record<string, string>} fields
     * @param {string[]} baseKeys
     * @returns {number[]}
     */
    static #parseIndexList(fields, baseKeys) {
        const indexes = []

        for (const baseKey of baseKeys) {
            const directValue = fields[baseKey]
            if (directValue) {
                indexes.push(
                    ...PcbCustomPadShapeParser.#splitIndexes(directValue)
                )
            }

            for (const [key, value] of Object.entries(fields)) {
                if (!key.startsWith(baseKey)) {
                    continue
                }
                if (key === baseKey) {
                    continue
                }

                indexes.push(...PcbCustomPadShapeParser.#splitIndexes(value))
            }
        }

        return [...new Set(indexes)]
    }

    /**
     * Parses a comma/semicolon-delimited index field.
     * @param {string} value
     * @returns {number[]}
     */
    static #splitIndexes(value) {
        return String(value || '')
            .split(/[;,\s]+/u)
            .map((part) => PcbSidecarRecordParser.parseInteger(part))
            .filter(Number.isInteger)
    }
}
