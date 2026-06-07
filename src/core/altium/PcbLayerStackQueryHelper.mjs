// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Provides read-only lookup helpers for normalized PCB layer-stack models.
 */
export class PcbLayerStackQueryHelper {
    /**
     * Finds a substack by native source ref, accepting refs with or without
     * braces and case differences.
     * @param {object} readModel Layer-stack read model.
     * @param {string} sourceRef Native stack reference.
     * @returns {object | null}
     */
    static substackBySourceRef(readModel, sourceRef) {
        const normalizedRef = PcbLayerStackQueryHelper.#normalizeRef(sourceRef)
        if (!normalizedRef) return null

        return (
            (readModel?.substacks || []).find((substack) =>
                PcbLayerStackQueryHelper.#substackRefs(substack).some(
                    (candidate) =>
                        PcbLayerStackQueryHelper.#normalizeRef(candidate) ===
                        normalizedRef
                )
            ) || null
        )
    }

    /**
     * Resolves physical layers that belong to one substack.
     * @param {object} readModel Layer-stack read model.
     * @param {object | string} substackOrRef Substack object or source ref.
     * @returns {object[]}
     */
    static layersForSubstack(readModel, substackOrRef) {
        const substack =
            typeof substackOrRef === 'string'
                ? PcbLayerStackQueryHelper.substackBySourceRef(
                      readModel,
                      substackOrRef
                  )
                : substackOrRef
        if (!substack) return []

        const layersById = new Map(
            (readModel?.layers || [])
                .filter((layer) => Number.isFinite(layer.layerId))
                .map((layer) => [layer.layerId, layer])
        )
        const layersByKey = new Map(
            (readModel?.layers || [])
                .filter((layer) => layer.layerKey)
                .map((layer) => [layer.layerKey, layer])
        )
        const layerIds = Array.isArray(substack.layerIds)
            ? substack.layerIds
            : []
        const layerKeys = Array.isArray(substack.layerKeys)
            ? substack.layerKeys
            : []

        return [
            ...layerIds.map((layerId) => layersById.get(layerId)),
            ...layerKeys.map((layerKey) => layersByKey.get(layerKey))
        ].filter(Boolean)
    }

    /**
     * Finds board-region rows attached to one layer-stack id.
     * @param {object} readModel Layer-stack read model.
     * @param {string} layerStackId Native stack id.
     * @returns {object[]}
     */
    static boardRegionsForLayerStackId(readModel, layerStackId) {
        const normalizedRef =
            PcbLayerStackQueryHelper.#normalizeRef(layerStackId)
        if (!normalizedRef) return []

        const explicitRegions = PcbLayerStackQueryHelper.#boardRegions(
            readModel
        ).filter(
            (region) =>
                PcbLayerStackQueryHelper.#normalizeRef(region.layerStackId) ===
                normalizedRef
        )
        if (explicitRegions.length) return explicitRegions

        const substack = PcbLayerStackQueryHelper.substackBySourceRef(
            readModel,
            layerStackId
        )
        if (!substack) return []

        return (substack.boardRegionIndexes || []).map((index, rowIndex) => ({
            index,
            name: substack.boardRegionNames?.[rowIndex] || '',
            layerStackId: substack.id
        }))
    }

    /**
     * Resolves physical layers for a board-region row.
     * @param {object} readModel Layer-stack read model.
     * @param {object | string} regionOrStackRef Region object or stack ref.
     * @returns {object[]}
     */
    static layersForBoardRegion(readModel, regionOrStackRef) {
        const stackRef =
            typeof regionOrStackRef === 'string'
                ? regionOrStackRef
                : regionOrStackRef?.layerStackId
        const substack = PcbLayerStackQueryHelper.substackBySourceRef(
            readModel,
            stackRef
        )

        return PcbLayerStackQueryHelper.layersForSubstack(readModel, substack)
    }

    /**
     * Finds branch rows that reference one stack.
     * @param {object} readModel Layer-stack read model.
     * @param {string} stackRef Native stack reference.
     * @returns {object[]}
     */
    static branchesForStackRef(readModel, stackRef) {
        const normalizedRef = PcbLayerStackQueryHelper.#normalizeRef(stackRef)
        if (!normalizedRef) return []

        return (readModel?.branches || []).filter((branch) =>
            PcbLayerStackQueryHelper.#branchRefs(branch).some(
                (candidate) =>
                    PcbLayerStackQueryHelper.#normalizeRef(candidate) ===
                    normalizedRef
            )
        )
    }

    /**
     * Returns candidate refs for a substack row.
     * @param {object} substack Substack row.
     * @returns {string[]}
     */
    static #substackRefs(substack) {
        return [
            substack?.id,
            substack?.sourceStackupRef,
            substack?.sourceRef,
            substack?.stackRef
        ].filter(Boolean)
    }

    /**
     * Returns candidate refs for a branch row.
     * @param {object} branch Branch row.
     * @returns {string[]}
     */
    static #branchRefs(branch) {
        return [
            branch?.rootStackRef,
            ...(branch?.stackRefs || []),
            ...(branch?.sections || []).flatMap((section) =>
                (section.stacks || []).map((stack) => stack.stackRef)
            )
        ].filter(Boolean)
    }

    /**
     * Returns explicit board-region rows from known read-model locations.
     * @param {object} readModel Layer-stack read model.
     * @returns {object[]}
     */
    static #boardRegions(readModel) {
        return [
            ...(readModel?.boardRegions || []),
            ...(readModel?.regions || []),
            ...(readModel?.cavityReport?.cavityRegions || [])
        ]
    }

    /**
     * Normalizes native ids and refs for lookup.
     * @param {unknown} value Raw ref.
     * @returns {string}
     */
    static #normalizeRef(value) {
        return String(value || '')
            .trim()
            .replace(/^\{|\}$/gu, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '')
    }
}
