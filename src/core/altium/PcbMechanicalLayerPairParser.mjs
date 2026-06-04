// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

/**
 * Parses mechanical-layer pair metadata used when footprints move between
 * board sides.
 */
export class PcbMechanicalLayerPairParser {
    /**
     * Parses mechanical-layer pairs from board metadata records.
     * @param {Record<string, string | string[]>[]} fieldSets Board field sets.
     * @param {{ layerId: number | null, name: string }[]} layers Layer stack rows.
     * @param {{ layerId: number, name: string }[]} primitiveLayers Primitive layer rows.
     * @returns {{ index: number, layer1Id: number, layer2Id: number, layer1Name: string, layer2Name: string, layer1V7SaveId?: number, layer2V7SaveId?: number }[]}
     */
    static parse(fieldSets, layers = [], primitiveLayers = []) {
        const layerNames = PcbMechanicalLayerPairParser.#buildLayerNameMap(
            fieldSets,
            layers,
            primitiveLayers
        )
        const pairs = []

        for (const fields of fieldSets || []) {
            for (const index of PcbMechanicalLayerPairParser.#pairIndexes(
                fields
            )) {
                const layer1Id = PcbMechanicalLayerPairParser.#numberField(
                    fields,
                    index,
                    'layer1'
                )
                const layer2Id = PcbMechanicalLayerPairParser.#numberField(
                    fields,
                    index,
                    'layer2'
                )
                if (
                    !Number.isInteger(layer1Id) ||
                    !Number.isInteger(layer2Id)
                ) {
                    continue
                }

                pairs.push({
                    index,
                    layer1Id,
                    layer2Id,
                    layer1Name: layerNames.get(layer1Id) || 'Layer ' + layer1Id,
                    layer2Name: layerNames.get(layer2Id) || 'Layer ' + layer2Id,
                    ...PcbMechanicalLayerPairParser.#v7Fields(fields, index)
                })
            }
        }

        return PcbMechanicalLayerPairParser.#dedupePairs(pairs)
    }

    /**
     * Builds layer-flip metadata from parsed mechanical pairs.
     * @param {{ layer1Id: number, layer2Id: number }[]} pairs Mechanical pairs.
     * @returns {{ mechanicalFlipMap: Record<string, number>, pairedLayerIds: number[] }}
     */
    static buildFlipMetadata(pairs) {
        const mechanicalFlipMap = {}
        for (const pair of pairs || []) {
            mechanicalFlipMap[String(pair.layer1Id)] = pair.layer2Id
            mechanicalFlipMap[String(pair.layer2Id)] = pair.layer1Id
        }

        return {
            mechanicalFlipMap,
            pairedLayerIds: Object.keys(mechanicalFlipMap)
                .map((layerId) => Number.parseInt(layerId, 10))
                .sort((left, right) => left - right)
        }
    }

    /**
     * Builds a layer-id to display-name map.
     * @param {Record<string, string | string[]>[]} fieldSets Board field sets.
     * @param {{ layerId: number | null, name: string }[]} layers Layer stack rows.
     * @param {{ layerId: number, name: string }[]} primitiveLayers Primitive layer rows.
     * @returns {Map<number, string>}
     */
    static #buildLayerNameMap(fieldSets, layers, primitiveLayers) {
        const names = new Map()

        for (const layer of [...(layers || []), ...(primitiveLayers || [])]) {
            const layerId = Number(layer.layerId)
            if (Number.isInteger(layerId) && layer.name) {
                names.set(layerId, layer.name)
            }
        }

        for (const fields of fieldSets || []) {
            for (const [key, value] of Object.entries(fields || {})) {
                const match = String(key).match(/^LAYER(\d+)NAME$/iu)
                if (!match) continue
                names.set(Number.parseInt(match[1], 10), String(value || ''))
            }
        }

        return names
    }

    /**
     * Finds mechanical pair indexes declared in one field set.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @returns {number[]}
     */
    static #pairIndexes(fields) {
        const indexes = new Set()
        const declaredCount =
            ParserUtils.parseNumericField(
                fields,
                'MECHANICAL_LAYER_PAIR_COUNT'
            ) ||
            ParserUtils.parseNumericField(fields, 'MECHANICALPAIRCOUNT') ||
            0

        for (let index = 1; index <= declaredCount; index += 1) {
            indexes.add(index)
        }

        for (const key of Object.keys(fields || {})) {
            const match = String(key).match(/^MECHANICAL_?LAYER_?PAIR(\d+)_?/iu)
            if (match) indexes.add(Number.parseInt(match[1], 10))
        }

        return [...indexes].sort((left, right) => left - right)
    }

    /**
     * Reads one layer id from supported mechanical pair key variants.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @param {number} index Pair index.
     * @param {'layer1' | 'layer2'} role Pair side.
     * @returns {number | null}
     */
    static #numberField(fields, index, role) {
        const keys =
            role === 'layer1'
                ? [
                      `MECHANICAL_LAYER_PAIR${index}_LAYER1`,
                      `MECHANICAL_LAYER_PAIR${index}_FIRST`,
                      `MECHANICALLAYERPAIR${index}LAYER1`,
                      `MECHPAIR${index}LAYER1`
                  ]
                : [
                      `MECHANICAL_LAYER_PAIR${index}_LAYER2`,
                      `MECHANICAL_LAYER_PAIR${index}_SECOND`,
                      `MECHANICALLAYERPAIR${index}LAYER2`,
                      `MECHPAIR${index}LAYER2`
                  ]

        for (const key of keys) {
            const value = ParserUtils.parseNumericField(fields, key)
            if (Number.isInteger(value)) return value
        }

        return null
    }

    /**
     * Reads optional V7 saved-layer ids for one pair.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @param {number} index Pair index.
     * @returns {{ layer1V7SaveId?: number, layer2V7SaveId?: number }}
     */
    static #v7Fields(fields, index) {
        const layer1V7SaveId = ParserUtils.parseNumericField(
            fields,
            `MECHANICAL_LAYER_PAIR${index}_LAYER1V7`
        )
        const layer2V7SaveId = ParserUtils.parseNumericField(
            fields,
            `MECHANICAL_LAYER_PAIR${index}_LAYER2V7`
        )
        return {
            ...(Number.isInteger(layer1V7SaveId) ? { layer1V7SaveId } : {}),
            ...(Number.isInteger(layer2V7SaveId) ? { layer2V7SaveId } : {})
        }
    }

    /**
     * Removes duplicate pairs while preserving first-seen metadata.
     * @param {object[]} pairs Candidate pairs.
     * @returns {object[]}
     */
    static #dedupePairs(pairs) {
        const byKey = new Map()
        for (const pair of pairs || []) {
            const key = [pair.layer1Id, pair.layer2Id].sort().join(':')
            if (!byKey.has(key)) {
                byKey.set(key, pair)
            }
        }
        return [...byKey.values()]
    }
}
