// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NaturalStringComparator } from './NaturalStringComparator.mjs'

/**
 * Builds route-highlight profile rows for PCB review metadata.
 */
export class PcbReviewRouteHighlightProfileBuilder {
    /**
     * Builds route-highlight profiles for classes, pairs, pair classes, and nets.
     * @param {object} routeAnalysis Route analysis model.
     * @returns {object[]}
     */
    static build(routeAnalysis = {}) {
        const routeRowsByName =
            PcbReviewRouteHighlightProfileBuilder.#routeRowsByName(
                routeAnalysis
            )
        return [
            ...PcbReviewRouteHighlightProfileBuilder.#differentialPairProfiles(
                routeAnalysis,
                routeRowsByName
            ),
            ...PcbReviewRouteHighlightProfileBuilder.#differentialPairClassProfiles(
                routeAnalysis,
                routeRowsByName
            ),
            ...PcbReviewRouteHighlightProfileBuilder.#netClassProfiles(
                routeAnalysis,
                routeRowsByName
            ),
            ...PcbReviewRouteHighlightProfileBuilder.#netProfiles(
                routeAnalysis,
                routeRowsByName
            )
        ]
    }

    /**
     * Builds net-class highlight profiles.
     * @param {object} routeAnalysis Route analysis model.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @returns {object[]}
     */
    static #netClassProfiles(routeAnalysis, routeRowsByName) {
        return (routeAnalysis.classes || []).map((classRow) =>
            PcbReviewRouteHighlightProfileBuilder.#highlightProfile({
                selectorKind: 'net-class',
                keyPrefix: 'highlight-net-class-',
                name: classRow.name,
                netNames: classRow.netNames || [],
                routeAnalysis,
                routeRowsByName
            })
        )
    }

    /**
     * Builds differential-pair highlight profiles.
     * @param {object} routeAnalysis Route analysis model.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @returns {object[]}
     */
    static #differentialPairProfiles(routeAnalysis, routeRowsByName) {
        return (routeAnalysis.differentialPairs || []).map((pair) =>
            PcbReviewRouteHighlightProfileBuilder.#highlightProfile({
                selectorKind: 'differential-pair',
                keyPrefix: 'highlight-diff-pair-',
                name: pair.name,
                netNames: [pair.positiveNetName, pair.negativeNetName].filter(
                    Boolean
                ),
                routeAnalysis,
                routeRowsByName
            })
        )
    }

    /**
     * Builds differential-pair class highlight profiles.
     * @param {object} routeAnalysis Route analysis model.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @returns {object[]}
     */
    static #differentialPairClassProfiles(routeAnalysis, routeRowsByName) {
        const classNames = new Map()
        for (const pair of routeAnalysis.differentialPairs || []) {
            for (const className of pair.classes || []) {
                if (!classNames.has(className)) {
                    classNames.set(className, new Set())
                }
                const netNames = classNames.get(className)
                for (const netName of [
                    pair.positiveNetName,
                    pair.negativeNetName
                ]) {
                    if (netName) {
                        netNames.add(netName)
                    }
                }
            }
        }

        return [...classNames.entries()]
            .sort(([left], [right]) =>
                NaturalStringComparator.compare(left, right)
            )
            .map(([className, netNames]) =>
                PcbReviewRouteHighlightProfileBuilder.#highlightProfile({
                    selectorKind: 'differential-pair-class',
                    keyPrefix: 'highlight-diff-pair-class-',
                    name: className,
                    netNames: [...netNames],
                    routeAnalysis,
                    routeRowsByName
                })
            )
    }

    /**
     * Builds scalar net highlight profiles.
     * @param {object} routeAnalysis Route analysis model.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @returns {object[]}
     */
    static #netProfiles(routeAnalysis, routeRowsByName) {
        return (routeAnalysis.byNet || []).map((net) =>
            PcbReviewRouteHighlightProfileBuilder.#highlightProfile({
                selectorKind: 'net',
                keyPrefix: 'highlight-net-',
                name: net.netName,
                netNames: [net.netName],
                routeAnalysis,
                routeRowsByName
            })
        )
    }

    /**
     * Builds one route-highlight profile.
     * @param {{ selectorKind: string, keyPrefix: string, name: string, netNames: string[], routeAnalysis: object, routeRowsByName: Map<string, object[]> }} options Profile options.
     * @returns {object}
     */
    static #highlightProfile(options) {
        const netNames = PcbReviewRouteHighlightProfileBuilder.#sortedStrings(
            options.netNames || []
        )
        const layerGroups = PcbReviewRouteHighlightProfileBuilder.#layerGroups(
            options.routeAnalysis,
            netNames,
            options.routeRowsByName
        )

        return PcbReviewRouteHighlightProfileBuilder.#stripEmpty({
            key:
                options.keyPrefix +
                PcbReviewRouteHighlightProfileBuilder.#slug(options.name),
            selectorKind: options.selectorKind,
            name: options.name,
            netNames,
            minRoutedLengthMil:
                layerGroups.length > 0
                    ? Math.min(
                          ...layerGroups.map((group) =>
                              Number(group.routedLengthMil || 0)
                          )
                      )
                    : 0,
            layerGroups,
            style: PcbReviewRouteHighlightProfileBuilder.#highlightStyle(
                options.selectorKind
            )
        })
    }

    /**
     * Builds per-layer route-highlight groups.
     * @param {object} routeAnalysis Route analysis model.
     * @param {string[]} netNames Net names.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @returns {object[]}
     */
    static #layerGroups(routeAnalysis, netNames, routeRowsByName) {
        const groupsByLayer = new Map()
        for (const net of PcbReviewRouteHighlightProfileBuilder.#netsByName(
            routeRowsByName,
            netNames
        )) {
            for (const participation of net.layerParticipation || []) {
                const layerKey = participation.layerKey || ''
                if (!layerKey) {
                    continue
                }
                if (!groupsByLayer.has(layerKey)) {
                    groupsByLayer.set(layerKey, {
                        layerKey,
                        primitiveKeys: new Set(),
                        routedLengthMil: 0
                    })
                }
                const group = groupsByLayer.get(layerKey)
                group.routedLengthMil += Number(
                    participation.totalLengthMil || 0
                )
                for (const routeGroup of net.connectedRouteGroups || []) {
                    if (!(routeGroup.layerKeys || []).includes(layerKey)) {
                        continue
                    }
                    for (const primitiveKey of routeGroup.primitiveKeys || []) {
                        group.primitiveKeys.add(primitiveKey)
                    }
                }
            }
        }

        return [...groupsByLayer.values()]
            .map((group) => ({
                layerKey: group.layerKey,
                primitiveKeys:
                    PcbReviewRouteHighlightProfileBuilder.#sortedStrings([
                        ...group.primitiveKeys
                    ]),
                routedLengthMil: PcbReviewRouteHighlightProfileBuilder.#round(
                    group.routedLengthMil
                )
            }))
            .sort((left, right) =>
                NaturalStringComparator.compare(left.layerKey, right.layerKey)
            )
    }

    /**
     * Builds route rows indexed by net name.
     * @param {object} routeAnalysis Route analysis model.
     * @returns {Map<string, object[]>}
     */
    static #routeRowsByName(routeAnalysis) {
        const rowsByName = new Map()
        for (const net of routeAnalysis.byNet || []) {
            const netName = String(net?.netName || '')
            if (!netName) continue
            if (!rowsByName.has(netName)) {
                rowsByName.set(netName, [])
            }
            rowsByName.get(netName).push(net)
        }
        return rowsByName
    }

    /**
     * Resolves net route rows by name.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @param {string[]} netNames Net names.
     * @returns {object[]}
     */
    static #netsByName(routeRowsByName, netNames) {
        return (netNames || []).flatMap(
            (netName) => routeRowsByName.get(netName) || []
        )
    }

    /**
     * Returns deterministic highlight style metadata.
     * @param {string} selectorKind Selector kind.
     * @returns {{ highlightColor: string, contextColor: string }}
     */
    static #highlightStyle(selectorKind) {
        if (selectorKind === 'differential-pair') {
            return { highlightColor: '#dc2626', contextColor: '#475569' }
        }
        if (selectorKind === 'differential-pair-class') {
            return { highlightColor: '#7c3aed', contextColor: '#475569' }
        }
        if (selectorKind === 'net-class') {
            return { highlightColor: '#d97706', contextColor: '#475569' }
        }
        return { highlightColor: '#2563eb', contextColor: '#475569' }
    }

    /**
     * Sorts and deduplicates strings naturally.
     * @param {string[]} values Source values.
     * @returns {string[]}
     */
    static #sortedStrings(values) {
        const sortedValues = [...new Set((values || []).filter(Boolean))]
        return sortedValues.length < 2
            ? sortedValues
            : sortedValues.sort(NaturalStringComparator.compare)
    }

    /**
     * Converts a value to a deterministic lowercase key segment.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #slug(value) {
        return (
            String(value || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, '-')
                .replace(/^-+|-+$/gu, '') || 'item'
        )
    }

    /**
     * Rounds numeric values for stable JSON.
     * @param {number} value Candidate number.
     * @returns {number}
     */
    static #round(value) {
        return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0
    }

    /**
     * Removes empty fields while preserving zeros and false.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) return entryValue.length > 0
                return (
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
                )
            })
        )
    }
}
