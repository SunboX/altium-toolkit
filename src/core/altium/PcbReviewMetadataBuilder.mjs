// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbReviewDrillMetadataBuilder } from './PcbReviewDrillMetadataBuilder.mjs'
import { PcbReviewPolygonRealizationBuilder } from './PcbReviewPolygonRealizationBuilder.mjs'
import { PcbReviewRouteHighlightProfileBuilder } from './PcbReviewRouteHighlightProfileBuilder.mjs'
import { NaturalStringComparator } from './NaturalStringComparator.mjs'

/**
 * Builds PCB review metadata for routed-class and board-assembly workflows.
 */
export class PcbReviewMetadataBuilder {
    static SCHEMA = 'altium-toolkit.pcb.review-metadata.a1'

    /**
     * Builds a normalized review-metadata sidecar.
     * @param {{ routeAnalysis?: object, embeddedModels?: object[], componentBodies?: object[], layers?: object[], primitiveLayers?: object[], polygons?: object[], tracks?: object[], arcs?: object[], fills?: object[], vias?: object[], pads?: object[], regions?: object[], shapeBasedRegions?: object[] }} pcb Review context.
     * @returns {object}
     */
    static build(pcb = {}) {
        const routeAnalysis = pcb.routeAnalysis || {}
        const routeRowsByName =
            PcbReviewMetadataBuilder.#routeRowsByName(routeAnalysis)
        const routeGroups = PcbReviewMetadataBuilder.#routeGroups(
            routeAnalysis,
            routeRowsByName
        )
        const routeHighlightProfiles =
            PcbReviewRouteHighlightProfileBuilder.build(routeAnalysis)
        const polygonRealizations =
            PcbReviewPolygonRealizationBuilder.build(pcb)
        const drillReview = PcbReviewDrillMetadataBuilder.build(pcb)
        const boardAssemblyViews = PcbReviewMetadataBuilder.#boardAssemblyViews(
            pcb.embeddedModels || [],
            pcb.componentBodies || []
        )

        return {
            schema: PcbReviewMetadataBuilder.SCHEMA,
            summary: {
                routeGroupCount: routeGroups.length,
                boardAssemblyViewCount: boardAssemblyViews.length,
                polygonRealizationCount: polygonRealizations.length,
                routeHighlightProfileCount: routeHighlightProfiles.length,
                drillOverlayCount: drillReview.overlays.length
            },
            routeGroups,
            routeHighlightProfiles,
            polygonRealizations,
            drillReview,
            boardAssemblyViews,
            indexes: PcbReviewMetadataBuilder.#indexes(
                routeGroups,
                routeHighlightProfiles,
                polygonRealizations,
                drillReview,
                boardAssemblyViews,
                routeAnalysis
            )
        }
    }

    /**
     * Builds route highlight groups from route analysis.
     * @param {object} routeAnalysis Route analysis model.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @returns {object[]}
     */
    static #routeGroups(routeAnalysis, routeRowsByName) {
        return [
            ...PcbReviewMetadataBuilder.#classGroups(
                routeAnalysis,
                routeRowsByName
            ),
            ...PcbReviewMetadataBuilder.#differentialPairGroups(
                routeAnalysis,
                routeRowsByName
            )
        ]
    }

    /**
     * Builds net-class route groups.
     * @param {object} routeAnalysis Route analysis model.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @returns {object[]}
     */
    static #classGroups(routeAnalysis, routeRowsByName) {
        return (routeAnalysis.classes || []).map((classRow) =>
            PcbReviewMetadataBuilder.#stripEmpty({
                key:
                    'route-class-' +
                    PcbReviewMetadataBuilder.#slug(classRow.name),
                kind: 'net-class',
                name: classRow.name,
                netNames: classRow.netNames || [],
                layerKeys: PcbReviewMetadataBuilder.#layerKeysForNets(
                    routeRowsByName,
                    classRow.netNames || []
                ),
                primitiveKeys: PcbReviewMetadataBuilder.#primitiveKeysForNets(
                    routeRowsByName,
                    classRow.netNames || []
                ),
                totalLengthMil: classRow.totalLengthMil
            })
        )
    }

    /**
     * Builds differential-pair route groups.
     * @param {object} routeAnalysis Route analysis model.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @returns {object[]}
     */
    static #differentialPairGroups(routeAnalysis, routeRowsByName) {
        return (routeAnalysis.differentialPairs || []).map((pair) => {
            const netNames = [
                pair.positiveNetName,
                pair.negativeNetName
            ].filter(Boolean)

            return PcbReviewMetadataBuilder.#stripEmpty({
                key:
                    'route-diff-pair-' +
                    PcbReviewMetadataBuilder.#slug(pair.name),
                kind: 'differential-pair',
                name: pair.name,
                netNames,
                layerKeys: PcbReviewMetadataBuilder.#layerKeysForNets(
                    routeRowsByName,
                    netNames
                ),
                primitiveKeys: PcbReviewMetadataBuilder.#primitiveKeysForNets(
                    routeRowsByName,
                    netNames
                ),
                totalLengthMil: PcbReviewMetadataBuilder.#round(
                    Number(pair.positiveLengthMil || 0) +
                        Number(pair.negativeLengthMil || 0)
                ),
                skewLengthMil: pair.skewLengthMil,
                classes: pair.classes || []
            })
        })
    }

    /**
     * Builds board assembly view candidates from unreferenced model payloads.
     * @param {object[]} embeddedModels Embedded model payload rows.
     * @param {object[]} componentBodies Component body rows.
     * @returns {object[]}
     */
    static #boardAssemblyViews(embeddedModels, componentBodies) {
        const referencedModelKeys =
            PcbReviewMetadataBuilder.#referencedModelKeys(componentBodies)

        return (embeddedModels || [])
            .filter((model) => {
                const keys = PcbReviewMetadataBuilder.#modelKeys(model)
                return !keys.some((key) => referencedModelKeys.has(key))
            })
            .map((model, index) =>
                PcbReviewMetadataBuilder.#stripEmpty({
                    key:
                        'board-assembly-' +
                        index +
                        '-' +
                        PcbReviewMetadataBuilder.#slug(model.name || index),
                    name: model.name,
                    format: model.format,
                    sourceStream: model.sourceStream,
                    modelId: model.id,
                    reason: 'embedded model is not referenced by component bodies'
                })
            )
    }

    /**
     * Builds review lookup indexes.
     * @param {object[]} routeGroups Route review groups.
     * @param {object[]} routeHighlightProfiles Route-highlight profiles.
     * @param {object[]} polygonRealizations Polygon realization rows.
     * @param {{ overlays: object[] }} drillReview Drill review rows.
     * @param {object[]} boardAssemblyViews Assembly-view candidates.
     * @param {object} routeAnalysis Route analysis model.
     * @returns {object}
     */
    static #indexes(
        routeGroups,
        routeHighlightProfiles,
        polygonRealizations,
        drillReview,
        boardAssemblyViews,
        routeAnalysis
    ) {
        const routeGroupsByName = {}
        const routeHighlightProfilesByName = {}
        const polygonRealizationsByKey = {}
        const drillOverlaysByOwnerKey = {}
        const boardAssemblyViewsByName = {}

        routeGroups.forEach((group, index) => {
            if (group.name) routeGroupsByName[group.name] = index
        })
        routeHighlightProfiles.forEach((profile, index) => {
            if (profile.name) routeHighlightProfilesByName[profile.name] = index
        })
        polygonRealizations.forEach((realization, index) => {
            polygonRealizationsByKey[realization.key] = index
        })
        for (const [index, overlay] of (drillReview.overlays || []).entries()) {
            drillOverlaysByOwnerKey[overlay.ownerKey] = index
        }
        boardAssemblyViews.forEach((view, index) => {
            if (view.name) boardAssemblyViewsByName[view.name] = index
        })

        return {
            routeGroupsByName,
            routeHighlightProfilesByName,
            primitiveKeysByNet:
                PcbReviewMetadataBuilder.#primitiveKeysByNet(routeAnalysis),
            polygonRealizationsByKey,
            drillOverlaysByOwnerKey,
            boardAssemblyViewsByName
        }
    }

    /**
     * Builds primitive-key lookups by net.
     * @param {object} routeAnalysis Route analysis model.
     * @returns {Record<string, string[]>}
     */
    static #primitiveKeysByNet(routeAnalysis) {
        const entries = {}
        for (const net of routeAnalysis.byNet || []) {
            entries[net.netName] = PcbReviewMetadataBuilder.#primitiveKeys(net)
        }
        return Object.fromEntries(
            Object.entries(entries).sort(([left], [right]) =>
                NaturalStringComparator.compare(left, right)
            )
        )
    }

    /**
     * Returns layer keys participating in a list of nets.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @param {string[]} netNames Net names.
     * @returns {string[]}
     */
    static #layerKeysForNets(routeRowsByName, netNames) {
        const nets = PcbReviewMetadataBuilder.#netsByName(
            routeRowsByName,
            netNames
        )
        return PcbReviewMetadataBuilder.#sortedStrings(
            nets.flatMap((net) => net.layers || [])
        )
    }

    /**
     * Returns primitive keys participating in a list of nets.
     * @param {Map<string, object[]>} routeRowsByName Route rows by net name.
     * @param {string[]} netNames Net names.
     * @returns {string[]}
     */
    static #primitiveKeysForNets(routeRowsByName, netNames) {
        const nets = PcbReviewMetadataBuilder.#netsByName(
            routeRowsByName,
            netNames
        )
        return PcbReviewMetadataBuilder.#sortedStrings(
            nets.flatMap((net) => PcbReviewMetadataBuilder.#primitiveKeys(net))
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
     * Collects primitive keys from one net route row.
     * @param {object} net Net route row.
     * @returns {string[]}
     */
    static #primitiveKeys(net) {
        return PcbReviewMetadataBuilder.#sortedStrings(
            (net.connectedRouteGroups || []).flatMap(
                (group) => group.primitiveKeys || []
            )
        )
    }

    /**
     * Collects model reference keys from component bodies.
     * @param {object[]} componentBodies Component body rows.
     * @returns {Set<string>}
     */
    static #referencedModelKeys(componentBodies) {
        const keys = new Set()
        for (const componentBody of componentBodies || []) {
            for (const key of PcbReviewMetadataBuilder.#modelKeys(
                componentBody
            )) {
                keys.add(key)
            }
        }
        return keys
    }

    /**
     * Builds comparable model identity keys.
     * @param {object} value Model or body row.
     * @returns {string[]}
     */
    static #modelKeys(value) {
        return [value?.id, value?.modelId, value?.checksum, value?.name]
            .map((entry) => String(entry ?? '').trim())
            .filter(Boolean)
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
