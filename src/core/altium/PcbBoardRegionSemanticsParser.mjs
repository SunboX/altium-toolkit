// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils

const SUBSTACK_FIELD_FAMILIES = [
    {
        fieldFamily: 'v9',
        indexPattern: /^V9_SUBSTACK(\d+)_ID$/i,
        fields: {
            id: 'V9_SUBSTACK{index}_ID',
            name: 'V9_SUBSTACK{index}_NAME',
            isFlex: 'V9_SUBSTACK{index}_ISFLEX',
            showTopDielectric: 'V9_SUBSTACK{index}_SHOWTOPDIELECTRIC',
            showBottomDielectric: 'V9_SUBSTACK{index}_SHOWBOTTOMDIELECTRIC',
            serviceStackup: 'V9_SUBSTACK{index}_SERVICE',
            usedByPrimitives: 'V9_SUBSTACK{index}_USEDBYPRIMS',
            rawStackupType: 'V9_SUBSTACK{index}_TYPE'
        }
    },
    {
        fieldFamily: 'legacy',
        indexPattern: /^SUBSTACK(\d+)_ID$/i,
        fields: {
            id: 'SUBSTACK{index}_ID',
            name: 'SUBSTACK{index}_NAME',
            isFlex: 'SUBSTACK{index}_ISFLEX',
            showTopDielectric: 'SUBSTACK{index}_SHOWTOPDIELECTRIC',
            showBottomDielectric: 'SUBSTACK{index}_SHOWBOTTOMDIELECTRIC',
            serviceStackup: 'SUBSTACK{index}_SERVICE',
            usedByPrimitives: 'SUBSTACK{index}_USEDBYPRIMS',
            rawStackupType: 'SUBSTACK{index}_TYPE'
        }
    },
    {
        fieldFamily: 'v8',
        indexPattern: /^LAYERSUBSTACK_V8_(\d+)ID$/i,
        fields: {
            id: 'LAYERSUBSTACK_V8_{index}ID',
            name: 'LAYERSUBSTACK_V8_{index}NAME',
            isFlex: 'LAYERSUBSTACK_V8_{index}ISFLEX',
            showTopDielectric: 'LAYERSUBSTACK_V8_{index}SHOWTOPDIELECTRIC',
            showBottomDielectric:
                'LAYERSUBSTACK_V8_{index}SHOWBOTTOMDIELECTRIC',
            serviceStackup: 'LAYERSUBSTACK_V8_{index}SERVICE',
            usedByPrimitives: 'LAYERSUBSTACK_V8_{index}USEDBYPRIMS',
            rawStackupType: 'LAYERSUBSTACK_V8_{index}TYPE'
        }
    }
]

/**
 * Normalizes rigid-flex board-region semantics from decoded PCB records.
 */
export class PcbBoardRegionSemanticsParser {
    /**
     * Extracts layer-substack metadata from Board6/Data field sets.
     * @param {Record<string, string | string[]>[]} fieldSets
     * @returns {{ index: number, fieldFamily: string, id: string, name: string, isFlex: boolean | null, showTopDielectric: boolean | null, showBottomDielectric: boolean | null, serviceStackup: boolean | null, usedByPrimitives: boolean | null, rawStackupType: string }[]}
     */
    static parseLayerSubstacks(fieldSets) {
        const fields = PcbBoardRegionSemanticsParser.#mergeFieldSets(fieldSets)
        const substacks = []
        const seenIds = new Set()

        for (const family of SUBSTACK_FIELD_FAMILIES) {
            const indexes = PcbBoardRegionSemanticsParser.#findFamilyIndexes(
                fields,
                family.indexPattern
            )

            for (const index of indexes) {
                const substack =
                    PcbBoardRegionSemanticsParser.#parseLayerSubstack(
                        fields,
                        family,
                        index
                    )

                if (!substack || seenIds.has(substack.id)) {
                    continue
                }

                seenIds.add(substack.id)
                substacks.push(substack)
            }
        }

        return substacks
    }

    /**
     * Adds board-planning semantics to decoded BoardRegions/Data records.
     * @param {object[]} boardRegions
     * @param {{ index: number, id: string, name: string, isFlex: boolean | null }[]} layerSubstacks
     * @returns {object[]}
     */
    static enrichBoardRegions(boardRegions, layerSubstacks) {
        const substacksById = new Map(
            (layerSubstacks || [])
                .filter((substack) => substack.id)
                .map((substack) => [substack.id, substack])
        )

        return (boardRegions || []).map((region, regionIndex) =>
            PcbBoardRegionSemanticsParser.#enrichBoardRegion(
                region,
                regionIndex,
                substacksById
            )
        )
    }

    /**
     * Builds a compact region-to-substack context list.
     * @param {object[]} boardRegions
     * @returns {{ regionIndex: number, name: string, layerStackId: string, substackIndex: number | null, substackName: string, isFlex: boolean | null, locked3d: boolean, bendingLineCount: number }[]}
     */
    static buildBoardRegionContexts(boardRegions) {
        return (boardRegions || []).map((region, regionIndex) => ({
            regionIndex,
            name: region.name || '',
            layerStackId: region.layerStackId || '',
            substackIndex:
                region.substackIndex === undefined
                    ? null
                    : region.substackIndex,
            substackName: region.substackName || '',
            isFlex:
                region.isFlexRegion === undefined ? null : region.isFlexRegion,
            locked3d: region.locked3d === true,
            bendingLineCount: Number(region.bendingLineCount || 0)
        }))
    }

    /**
     * Counts board-region semantic records for model summaries.
     * @param {object[]} boardRegions
     * @returns {{ boardRegionCount: number, flexRegionCount: number, bendingLineCount: number }}
     */
    static summarizeBoardRegions(boardRegions) {
        const regions = boardRegions || []

        return {
            boardRegionCount: regions.length,
            flexRegionCount: regions.filter(
                (region) => region.isFlexRegion === true
            ).length,
            bendingLineCount: regions.reduce(
                (total, region) => total + Number(region.bendingLineCount || 0),
                0
            )
        }
    }

    /**
     * Merges field sets into one lookup while preserving later native records.
     * @param {Record<string, string | string[]>[]} fieldSets
     * @returns {Record<string, string | string[]>}
     */
    static #mergeFieldSets(fieldSets) {
        return Object.assign({}, ...(fieldSets || []))
    }

    /**
     * Finds all substack indexes for one native field family.
     * @param {Record<string, string | string[]>} fields
     * @param {RegExp} pattern
     * @returns {number[]}
     */
    static #findFamilyIndexes(fields, pattern) {
        return [
            ...new Set(
                Object.keys(fields || {})
                    .map((key) => pattern.exec(key)?.[1])
                    .filter((index) => index !== undefined)
                    .map((index) => Number.parseInt(index, 10))
                    .filter((index) => Number.isInteger(index))
            )
        ].sort((left, right) => left - right)
    }

    /**
     * Extracts one layer-substack row.
     * @param {Record<string, string | string[]>} fields
     * @param {{ fieldFamily: string, fields: Record<string, string> }} family
     * @param {number} index
     * @returns {object | null}
     */
    static #parseLayerSubstack(fields, family, index) {
        const names = PcbBoardRegionSemanticsParser.#fieldNames(
            family.fields,
            index
        )
        const id = getField(fields, names.id)

        if (!id) {
            return null
        }

        return {
            index,
            fieldFamily: family.fieldFamily,
            id,
            name:
                getField(fields, names.name) ||
                'Board Layer Stack ' + String(index),
            isFlex: PcbBoardRegionSemanticsParser.#parseOptionalBoolean(
                fields,
                names.isFlex
            ),
            showTopDielectric:
                PcbBoardRegionSemanticsParser.#parseOptionalBoolean(
                    fields,
                    names.showTopDielectric
                ),
            showBottomDielectric:
                PcbBoardRegionSemanticsParser.#parseOptionalBoolean(
                    fields,
                    names.showBottomDielectric
                ),
            serviceStackup: PcbBoardRegionSemanticsParser.#parseOptionalBoolean(
                fields,
                names.serviceStackup
            ),
            usedByPrimitives:
                PcbBoardRegionSemanticsParser.#parseOptionalBoolean(
                    fields,
                    names.usedByPrimitives
                ),
            rawStackupType: getField(fields, names.rawStackupType)
        }
    }

    /**
     * Replaces field-name placeholders with an index.
     * @param {Record<string, string>} templates
     * @param {number} index
     * @returns {Record<string, string>}
     */
    static #fieldNames(templates, index) {
        return Object.fromEntries(
            Object.entries(templates).map(([key, template]) => [
                key,
                template.replace('{index}', String(index))
            ])
        )
    }

    /**
     * Adds typed fields to one decoded board region.
     * @param {object} region
     * @param {number} regionIndex
     * @param {Map<string, object>} substacksById
     * @returns {object}
     */
    static #enrichBoardRegion(region, regionIndex, substacksById) {
        const properties = region?.properties || {}
        const layerStackId = getField(properties, 'LAYERSTACKID')
        const substack = substacksById.get(layerStackId)
        const bendingLines =
            PcbBoardRegionSemanticsParser.#parseBendingLines(properties)
        const bendingLineCount =
            PcbBoardRegionSemanticsParser.#parseIntegerField(
                properties,
                'BENDINGLINECOUNT'
            ) ?? bendingLines.length
        const isFlexRegion =
            substack?.isFlex === undefined ? null : substack.isFlex

        return {
            ...region,
            boardRegionIndex: regionIndex,
            objectKind:
                getField(properties, 'OBJECTKIND') ||
                (layerStackId ? 'BoardRegion' : ''),
            name: getField(properties, 'NAME'),
            v7Layer: getField(properties, 'V7_LAYER'),
            boardLayerToken: getField(properties, 'LAYER'),
            layerStackId,
            substackIndex: substack?.index ?? null,
            substackName: substack?.name || '',
            isFlexRegion,
            isRigidRegion:
                isFlexRegion === null ? null : isFlexRegion === false,
            locked3d:
                PcbBoardRegionSemanticsParser.#parseOptionalBoolean(
                    properties,
                    'LOCKED3D'
                ) === true,
            cavityHeight: getField(properties, 'CAVITYHEIGHT'),
            arcResolution: getField(properties, 'ARCRESOLUTION'),
            bendingLineCount,
            bendingLines
        }
    }

    /**
     * Parses indexed BENDINGLINE{n} values in stream order.
     * @param {Record<string, string | string[]>} properties
     * @returns {object[]}
     */
    static #parseBendingLines(properties) {
        return Object.entries(properties || {})
            .map(([key, value]) => ({
                match: /^BENDINGLINE(\d+)$/i.exec(key),
                value
            }))
            .filter((item) => item.match)
            .map((item) => ({
                index: Number.parseInt(item.match[1], 10),
                raw: PcbBoardRegionSemanticsParser.#stringValue(item.value)
            }))
            .sort((left, right) => left.index - right.index)
            .map((item) =>
                PcbBoardRegionSemanticsParser.#parseBendingLine(
                    item.index,
                    item.raw
                )
            )
    }

    /**
     * Parses one semicolon-delimited board-region bending line.
     * @param {number} index
     * @param {string} raw
     * @returns {object}
     */
    static #parseBendingLine(index, raw) {
        const tokens = String(raw || '')
            .split(';')
            .map((token) => token.trim())
        const angleDeg = PcbBoardRegionSemanticsParser.#parseOptionalNumber(
            tokens[0]
        )
        const radiusRaw = PcbBoardRegionSemanticsParser.#parseOptionalInteger(
            tokens[1]
        )
        const radiusMil =
            radiusRaw === null
                ? null
                : PcbBoardRegionSemanticsParser.#toMil(radiusRaw)

        return {
            index,
            raw,
            angleDeg,
            radiusRaw,
            radiusMil,
            affectedWidthMil:
                angleDeg === null || radiusMil === null
                    ? null
                    : PcbBoardRegionSemanticsParser.#roundMil(
                          (Math.abs(angleDeg) / 360) * 2 * Math.PI * radiusMil
                      ),
            foldIndex: PcbBoardRegionSemanticsParser.#parseOptionalInteger(
                tokens[2]
            ),
            x1Raw: PcbBoardRegionSemanticsParser.#parseOptionalInteger(
                tokens[3]
            ),
            y1Raw: PcbBoardRegionSemanticsParser.#parseOptionalInteger(
                tokens[4]
            ),
            x2Raw: PcbBoardRegionSemanticsParser.#parseOptionalInteger(
                tokens[5]
            ),
            y2Raw: PcbBoardRegionSemanticsParser.#parseOptionalInteger(
                tokens[6]
            ),
            x1: PcbBoardRegionSemanticsParser.#toMilOrNull(tokens[3]),
            y1: PcbBoardRegionSemanticsParser.#toMilOrNull(tokens[4]),
            x2: PcbBoardRegionSemanticsParser.#toMilOrNull(tokens[5]),
            y2: PcbBoardRegionSemanticsParser.#toMilOrNull(tokens[6])
        }
    }

    /**
     * Parses one optional boolean field.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {boolean | null}
     */
    static #parseOptionalBoolean(fields, key) {
        const raw = getField(fields, key)

        if (!raw) {
            return null
        }

        return parseBoolean(raw)
    }

    /**
     * Parses one optional integer field.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {number | null}
     */
    static #parseIntegerField(fields, key) {
        const parsed = parseNumericField(fields, key)

        return parsed === null ? null : Math.trunc(parsed)
    }

    /**
     * Parses one optional number token.
     * @param {string | undefined} raw
     * @returns {number | null}
     */
    static #parseOptionalNumber(raw) {
        if (raw === undefined || raw === '') {
            return null
        }

        const parsed = Number(raw)
        return Number.isFinite(parsed) ? parsed : null
    }

    /**
     * Parses one optional integer token.
     * @param {string | undefined} raw
     * @returns {number | null}
     */
    static #parseOptionalInteger(raw) {
        const parsed = PcbBoardRegionSemanticsParser.#parseOptionalNumber(raw)

        return parsed === null ? null : Math.trunc(parsed)
    }

    /**
     * Converts one internal Altium coordinate token to mils.
     * @param {string | undefined} raw
     * @returns {number | null}
     */
    static #toMilOrNull(raw) {
        const value = PcbBoardRegionSemanticsParser.#parseOptionalInteger(raw)

        return value === null
            ? null
            : PcbBoardRegionSemanticsParser.#toMil(value)
    }

    /**
     * Converts one internal Altium coordinate to mils.
     * @param {number} value
     * @returns {number}
     */
    static #toMil(value) {
        return PcbBoardRegionSemanticsParser.#roundMil(
            Number(value || 0) / 10000
        )
    }

    /**
     * Rounds a mil value for stable JSON output.
     * @param {number} value
     * @returns {number}
     */
    static #roundMil(value) {
        return Math.round(Number(value || 0) * 1000000) / 1000000
    }

    /**
     * Returns the last text value from one field payload.
     * @param {string | string[] | undefined} raw
     * @returns {string}
     */
    static #stringValue(raw) {
        const values = Array.isArray(raw) ? raw : [raw]

        return String(values.findLast((value) => value !== undefined) || '')
    }
}
