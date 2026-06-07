// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds polygon-pour realization rows for PCB review metadata.
 */
export class PcbReviewPolygonRealizationBuilder {
    /**
     * Builds polygon-pour realization sidecars.
     * @param {object} pcb Normalized PCB model.
     * @returns {object[]}
     */
    static build(pcb = {}) {
        const layerNameToKey =
            PcbReviewPolygonRealizationBuilder.#layerNameToKey(pcb)
        const rows = [
            ...PcbReviewPolygonRealizationBuilder.#realizationRows(
                'polygon',
                pcb.polygons || [],
                layerNameToKey
            ),
            ...PcbReviewPolygonRealizationBuilder.#realizationRows(
                'track',
                pcb.tracks || [],
                layerNameToKey
            ),
            ...PcbReviewPolygonRealizationBuilder.#realizationRows(
                'arc',
                pcb.arcs || [],
                layerNameToKey
            ),
            ...PcbReviewPolygonRealizationBuilder.#realizationRows(
                'fill',
                pcb.fills || [],
                layerNameToKey
            ),
            ...PcbReviewPolygonRealizationBuilder.#realizationRows(
                'region',
                pcb.regions || [],
                layerNameToKey
            ),
            ...PcbReviewPolygonRealizationBuilder.#realizationRows(
                'shape-based-region',
                pcb.shapeBasedRegions || [],
                layerNameToKey
            )
        ]
        const groups = new Map()

        for (const row of rows) {
            if (!Number.isFinite(row.polygonIndex)) {
                continue
            }
            const key =
                row.polygonIndex +
                ':' +
                (row.subpolygonIndex ?? '') +
                ':' +
                (row.unionIndex ?? '')
            if (!groups.has(key)) {
                groups.set(key, {
                    polygonIndex: row.polygonIndex,
                    subpolygonIndex: row.subpolygonIndex,
                    unionIndex: row.unionIndex,
                    isCutout: false,
                    layerKeys: new Set(),
                    primitiveKeys: new Set(),
                    realizedPrimitiveKinds: new Set()
                })
            }
            const group = groups.get(key)
            group.isCutout = group.isCutout || row.isCutout === true
            if (row.layerKey) group.layerKeys.add(row.layerKey)
            group.primitiveKeys.add(row.primitiveKey)
            group.realizedPrimitiveKinds.add(row.kind)
        }

        return [...groups.values()]
            .map((group) =>
                PcbReviewPolygonRealizationBuilder.#stripEmpty({
                    key:
                        'polygon-realization-' +
                        group.polygonIndex +
                        '-' +
                        (group.subpolygonIndex ?? 'main') +
                        '-' +
                        (group.unionIndex ?? 'none'),
                    polygonIndex: group.polygonIndex,
                    subpolygonIndex: group.subpolygonIndex,
                    unionIndex: group.unionIndex,
                    classification: group.isCutout ? 'cutout' : 'copper-pour',
                    layerKeys:
                        PcbReviewPolygonRealizationBuilder.#sortedStrings([
                            ...group.layerKeys
                        ]),
                    primitiveKeys:
                        PcbReviewPolygonRealizationBuilder.#sortedStrings([
                            ...group.primitiveKeys
                        ]),
                    realizedPrimitiveKinds:
                        PcbReviewPolygonRealizationBuilder.#sortedStrings([
                            ...group.realizedPrimitiveKinds
                        ])
                })
            )
            .sort((left, right) =>
                left.key.localeCompare(right.key, undefined, { numeric: true })
            )
    }

    /**
     * Builds realization rows for one primitive collection.
     * @param {string} kind Primitive kind.
     * @param {object[]} primitives Primitive rows.
     * @param {Map<string, string>} layerNameToKey Layer-name lookup.
     * @returns {object[]}
     */
    static #realizationRows(kind, primitives, layerNameToKey) {
        return (primitives || []).map((primitive, index) => ({
            kind,
            primitiveKey: kind + '-' + index,
            polygonIndex: PcbReviewPolygonRealizationBuilder.#optionalNumber(
                primitive?.polygonIndex
            ),
            subpolygonIndex: PcbReviewPolygonRealizationBuilder.#optionalNumber(
                primitive?.subpolygonIndex ?? primitive?.subpolyIndex
            ),
            unionIndex: PcbReviewPolygonRealizationBuilder.#optionalNumber(
                primitive?.unionIndex
            ),
            isCutout:
                primitive?.isCutout === true ||
                primitive?.classification === 'cutout',
            layerKey: PcbReviewPolygonRealizationBuilder.#layerKey(
                primitive,
                layerNameToKey
            )
        }))
    }

    /**
     * Builds a layer-name to layer-key lookup.
     * @param {object} pcb PCB model.
     * @returns {Map<string, string>}
     */
    static #layerNameToKey(pcb) {
        const lookup = new Map()
        for (const layer of [
            ...(pcb.layers || []),
            ...(pcb.primitiveLayers || [])
        ]) {
            const layerId = PcbReviewPolygonRealizationBuilder.#layerId(layer)
            const name = String(layer?.displayName || layer?.name || '').trim()
            if (Number.isInteger(layerId) && name) {
                lookup.set(
                    PcbReviewPolygonRealizationBuilder.#lookupName(name),
                    'L' + layerId
                )
            }
        }
        return lookup
    }

    /**
     * Resolves a layer key from a primitive or layer descriptor.
     * @param {object} value Primitive or layer descriptor.
     * @param {Map<string, string>} [layerNameToKey] Optional layer-name lookup.
     * @returns {string}
     */
    static #layerKey(value, layerNameToKey = new Map()) {
        const layerId = PcbReviewPolygonRealizationBuilder.#layerId(value)
        if (Number.isInteger(layerId)) {
            return 'L' + layerId
        }

        const layer = String(value?.layer || value?.layerName || '').trim()
        const lookupKey = PcbReviewPolygonRealizationBuilder.#lookupName(layer)
        if (layerNameToKey.has(lookupKey)) {
            return layerNameToKey.get(lookupKey)
        }
        return layer
            ? 'L-' + PcbReviewPolygonRealizationBuilder.#slug(layer)
            : ''
    }

    /**
     * Resolves a numeric layer id.
     * @param {object} value Primitive or layer descriptor.
     * @returns {number | undefined}
     */
    static #layerId(value) {
        for (const key of ['layerId', 'layerCode', 'id', 'index']) {
            const layerId = Number(value?.[key])
            if (Number.isInteger(layerId)) {
                return layerId
            }
        }

        return undefined
    }

    /**
     * Returns a finite number or undefined.
     * @param {unknown} value Candidate value.
     * @returns {number | undefined}
     */
    static #optionalNumber(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number : undefined
    }

    /**
     * Sorts and deduplicates strings naturally.
     * @param {string[]} values Source values.
     * @returns {string[]}
     */
    static #sortedStrings(values) {
        return [...new Set((values || []).filter(Boolean))].sort(
            (left, right) =>
                left.localeCompare(right, undefined, { numeric: true })
        )
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
     * Normalizes a layer or semantic lookup name.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #lookupName(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/gu, ' ')
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
