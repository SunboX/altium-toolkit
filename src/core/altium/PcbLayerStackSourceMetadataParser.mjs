// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

/**
 * Parses source-only layer-stack metadata that is not part of core geometry.
 */
export class PcbLayerStackSourceMetadataParser {
    /**
     * Parses source-aware extras for one layer-stack row.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {number} index Layer-stack index.
     * @returns {object}
     */
    static layerSourceFields(fields, index) {
        const prefixes = ['V9_STACK_LAYER', 'STACK_LAYER']
        const layerField = (suffixes) =>
            PcbLayerStackSourceMetadataParser.#indexedField(
                fields,
                prefixes,
                index,
                suffixes
            )

        return PcbLayerStackSourceMetadataParser.#stripUndefined({
            family: layerField(['FAMILY', 'LAYERFAMILY']),
            sourceFamily: layerField(['SOURCEFAMILY', 'SOURCE_FAMILY']),
            sourceRecordId: layerField([
                'SOURCE_RECORD_ID',
                'SOURCERECORDID',
                'RECORDID'
            ]),
            sourceKeys: PcbLayerStackSourceMetadataParser.optionalArray(
                PcbLayerStackSourceMetadataParser.#list(
                    layerField(['SOURCE_KEYS', 'SOURCEKEYS'])
                )
            ),
            registryRef: layerField(['REGISTRYREF', 'REGISTRY_REF']),
            modelId: layerField(['MODELID', 'MODEL_ID']),
            aliases: PcbLayerStackSourceMetadataParser.optionalArray(
                PcbLayerStackSourceMetadataParser.#list(
                    layerField(['ALIASES', 'DISPLAYALIASES'])
                )
            ),
            materialColor: layerField(['MATERIALCOLOR', 'MATERIAL_COLOR']),
            surfaceFinish: layerField(['SURFACEFINISH', 'SURFACE_FINISH']),
            plating: layerField(['PLATING']),
            coverlayExpansion: layerField([
                'COVERLAYEXPANSION',
                'COVERLAY_EXPANSION'
            ]),
            isStiffener: PcbLayerStackSourceMetadataParser.#optionalBoolean(
                layerField(['ISSTIFFENER', 'IS_STIFFENER'])
            ),
            isAdhesive: PcbLayerStackSourceMetadataParser.#optionalBoolean(
                layerField(['ISADHESIVE', 'IS_ADHESIVE'])
            ),
            stackupxShared: PcbLayerStackSourceMetadataParser.#optionalBoolean(
                layerField(['SHARED', 'STACKUPX_SHARED'])
            ),
            stackupxProperties: PcbLayerStackSourceMetadataParser.#keyValueMap(
                layerField(['STACKUPX_PROPERTIES', 'PROPERTIES'])
            ),
            substackEnablement: PcbLayerStackSourceMetadataParser.optionalArray(
                PcbLayerStackSourceMetadataParser.#substackEnablement(
                    fields,
                    index
                )
            )
        })
    }

    /**
     * Returns undefined for optional empty arrays.
     * @param {object[]} values Source values.
     * @returns {object[] | undefined}
     */
    static optionalArray(values) {
        return values.length ? values : undefined
    }

    /**
     * Parses branch-section rows.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @param {number} branchIndex Branch index.
     * @returns {object[]}
     */
    static branchSections(fields, branchIndex) {
        const sectionIndexes = PcbLayerStackSourceMetadataParser.#nestedIndexes(
            fields,
            'STACKBRANCH' + branchIndex + '_SECTION',
            '_ID'
        )

        return sectionIndexes.map((sectionIndex) => {
            const prefix =
                'STACKBRANCH' + branchIndex + '_SECTION' + sectionIndex

            return PcbLayerStackSourceMetadataParser.#stripUndefined({
                index: sectionIndex,
                id: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_ID'
                ),
                name: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_NAME'
                ),
                parentSectionId: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_PARENTID'
                ),
                stacks: PcbLayerStackSourceMetadataParser.#branchSectionStacks(
                    fields,
                    prefix
                )
            })
        })
    }

    /**
     * Parses top-level board bend-line cache entries.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @returns {object[]}
     */
    static topLevelBendLines(fields) {
        return PcbLayerStackSourceMetadataParser.#indexedRows(fields, [
            /^BOARD_BENDLINE(\d+)$/iu,
            /^BENDLINE(\d+)$/iu
        ]).map((index) => {
            const raw =
                PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    'BOARD_BENDLINE' + index
                ) ||
                PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    'BENDLINE' + index
                )
            const tokens = raw.split(';').map((token) => token.trim())
            const radiusRaw = PcbLayerStackSourceMetadataParser.#numberToken(
                tokens[1]
            )

            return PcbLayerStackSourceMetadataParser.#stripUndefined({
                index,
                raw,
                angleDeg: PcbLayerStackSourceMetadataParser.#numberToken(
                    tokens[0]
                ),
                radiusRaw,
                radiusMil:
                    radiusRaw === undefined
                        ? undefined
                        : Number((radiusRaw / 10000).toFixed(6)),
                foldIndex: PcbLayerStackSourceMetadataParser.#numberToken(
                    tokens[2]
                ),
                name: tokens[7],
                stateRaw: tokens[8],
                regionName: tokens[9]
            })
        })
    }

    /**
     * Builds cavity/stiffener reporting metadata.
     * @param {object[]} layers Layer rows.
     * @param {object[]} boardRegions Board-region rows.
     * @returns {object}
     */
    static cavityReport(layers, boardRegions) {
        const cavityRegions = boardRegions
            .map((region, regionIndex) => ({ region, regionIndex }))
            .filter(({ region }) => Boolean(region.cavityHeight))
            .map(({ region, regionIndex }) =>
                PcbLayerStackSourceMetadataParser.#stripUndefined({
                    regionIndex,
                    name: region.name,
                    layerStackId: region.layerStackId,
                    cavityHeight: region.cavityHeight
                })
            )
        const stiffenerLayers = layers
            .filter((layer) => layer.isStiffener)
            .map((layer) => layer.name)
            .filter(Boolean)
        const adhesiveLayers = layers
            .filter((layer) => layer.isAdhesive)
            .map((layer) => layer.name)
            .filter(Boolean)

        return {
            cavityRegionCount: cavityRegions.length,
            stiffenerLayerCount: stiffenerLayers.length,
            adhesiveLayerCount: adhesiveLayers.length,
            cavityRegions,
            stiffenerLayers,
            adhesiveLayers
        }
    }

    /**
     * Builds a compact source-evidence summary.
     * @param {object[]} layers Layer rows.
     * @param {object[]} topLevelBendLines Top-level bend cache rows.
     * @param {object} cavityReport Cavity/stiffener report.
     * @returns {object}
     */
    static sourceMap(layers, topLevelBendLines, cavityReport) {
        return {
            registryEntryCount: layers.filter((layer) => layer.registryRef)
                .length,
            sourceKeyCount: layers.reduce(
                (count, layer) => count + (layer.sourceKeys?.length || 0),
                0
            ),
            topLevelBendLineCount: topLevelBendLines.length,
            cavityRegionCount: cavityReport.cavityRegionCount,
            stiffenerLayerCount: cavityReport.stiffenerLayerCount,
            adhesiveLayerCount: cavityReport.adhesiveLayerCount,
            surfaceFinishCount: layers.filter((layer) => layer.surfaceFinish)
                .length
        }
    }

    /**
     * Parses per-substack enablement fields from one layer row.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {number} layerIndex Layer-stack index.
     * @returns {object[]}
     */
    static #substackEnablement(fields, layerIndex) {
        const pattern = new RegExp(
            '^V9_STACK_LAYER' + layerIndex + '_SUBSTACK(\\d+)_ENABLED$',
            'iu'
        )

        return Object.keys(fields)
            .flatMap((key) => {
                const match = pattern.exec(key)
                if (!match) return []

                return [
                    {
                        substackIndex: Number.parseInt(match[1], 10),
                        enabled:
                            PcbLayerStackSourceMetadataParser.#optionalBoolean(
                                PcbLayerStackSourceMetadataParser.#field(
                                    fields,
                                    key
                                )
                            )
                    }
                ]
            })
            .sort((left, right) => left.substackIndex - right.substackIndex)
    }

    /**
     * Parses branch-section stack rows.
     * @param {Record<string, string | string[]>} fields Board fields.
     * @param {string} sectionPrefix Section field prefix.
     * @returns {object[]}
     */
    static #branchSectionStacks(fields, sectionPrefix) {
        const stackIndexes = PcbLayerStackSourceMetadataParser.#nestedIndexes(
            fields,
            sectionPrefix + '_STACK',
            '_REF'
        )

        return stackIndexes.map((stackIndex) => {
            const prefix = sectionPrefix + '_STACK' + stackIndex

            return PcbLayerStackSourceMetadataParser.#stripUndefined({
                index: stackIndex,
                stackRef: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_REF'
                ),
                materialUsage: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_MATERIALUSAGE'
                ),
                source: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_SOURCE'
                ),
                parentLayerId: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_PARENTLAYERID'
                ),
                parentLayerStackId: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_PARENTLAYERSTACKID'
                ),
                sourceLayerId: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_SOURCELAYERID'
                ),
                sourceLayerStackId: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_SOURCELAYERSTACKID'
                ),
                intrusionLeftBottom: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_INTRUSIONLEFTBOTTOM'
                ),
                intrusionLeftTop: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_INTRUSIONLEFTTOP'
                ),
                intrusionRightBottom: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_INTRUSIONRIGHTBOTTOM'
                ),
                intrusionRightTop: PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + '_INTRUSIONRIGHTTOP'
                )
            })
        })
    }

    /**
     * Finds all indexes matching any row-id pattern.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {RegExp[]} patterns Index patterns.
     * @returns {number[]}
     */
    static #indexedRows(fields, patterns) {
        return [
            ...new Set(
                Object.keys(fields).flatMap((key) => {
                    for (const pattern of patterns) {
                        const match = pattern.exec(key)
                        if (match) return [Number.parseInt(match[1], 10)]
                    }
                    return []
                })
            )
        ].sort((left, right) => left - right)
    }

    /**
     * Finds nested indexes for fields with a common prefix and suffix.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string} prefix Field prefix before the nested index.
     * @param {string} suffix Field suffix after the nested index.
     * @returns {number[]}
     */
    static #nestedIndexes(fields, prefix, suffix) {
        const pattern = new RegExp(
            '^' +
                prefix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') +
                '(\\d+)' +
                suffix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') +
                '$',
            'iu'
        )

        return [
            ...new Set(
                Object.keys(fields).flatMap((key) => {
                    const match = pattern.exec(key)
                    return match ? [Number.parseInt(match[1], 10)] : []
                })
            )
        ].sort((left, right) => left - right)
    }

    /**
     * Reads the first matching indexed field.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string[]} prefixes Row prefixes.
     * @param {number} index Row index.
     * @param {string[]} suffixes Field suffixes.
     * @returns {string}
     */
    static #indexedField(fields, prefixes, index, suffixes) {
        for (const prefix of prefixes) {
            for (const suffix of suffixes) {
                const value = PcbLayerStackSourceMetadataParser.#field(
                    fields,
                    prefix + index + '_' + suffix
                )
                if (value) return value
            }
        }

        return ''
    }

    /**
     * Reads a case-insensitive field value.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string} key Field key.
     * @returns {string}
     */
    static #field(fields, key) {
        if (Object.hasOwn(fields, key)) {
            return ParserUtils.getField(fields, key)
        }
        const upperKey = key.toUpperCase()
        const realKey = Object.keys(fields).find(
            (fieldKey) => fieldKey.toUpperCase() === upperKey
        )

        return realKey ? ParserUtils.getField(fields, realKey) : ''
    }

    /**
     * Splits a native list field.
     * @param {string} value Raw list value.
     * @returns {string[]}
     */
    static #list(value) {
        return String(value || '')
            .split(/[;,]/u)
            .map((item) => item.trim())
            .filter(Boolean)
    }

    /**
     * Parses a native key-value property bag.
     * @param {string} value Raw value.
     * @returns {object | undefined}
     */
    static #keyValueMap(value) {
        const entries = String(value || '')
            .split(/[|;]/u)
            .map((item) => item.trim())
            .filter(Boolean)
            .flatMap((item) => {
                const separator = item.indexOf('=')
                if (separator < 0) return []
                return [
                    [
                        item.slice(0, separator).trim(),
                        item.slice(separator + 1).trim()
                    ]
                ]
            })
            .filter(([key]) => key)

        return entries.length ? Object.fromEntries(entries) : undefined
    }

    /**
     * Parses an optional boolean value.
     * @param {string} value Raw value.
     * @returns {boolean | undefined}
     */
    static #optionalBoolean(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
        if (!normalized) return undefined
        return ['true', 't', '1', 'yes'].includes(normalized)
    }

    /**
     * Parses a numeric token.
     * @param {string | undefined} value Raw token.
     * @returns {number | undefined}
     */
    static #numberToken(value) {
        const parsed = Number.parseFloat(String(value || '').trim())
        return Number.isFinite(parsed) ? parsed : undefined
    }

    /**
     * Removes undefined and empty string values while keeping false and empty
     * arrays stable.
     * @param {Record<string, unknown>} object Source object.
     * @returns {object}
     */
    static #stripUndefined(object) {
        return Object.fromEntries(
            Object.entries(object).filter(
                ([, value]) => value !== undefined && value !== ''
            )
        )
    }
}
