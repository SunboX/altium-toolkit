// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Selects documentation-layer primitives that should render as package
 * outlines or silkscreen on one board side.
 */
export class PcbFootprintPrimitiveSelector {
    /**
     * Selects one prioritized primitive family for the requested board side.
     * @param {{ layerId: number, name: string }[]} primitiveLayers
     * @param {{ x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[]} fills
     * @param {{ x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[]} tracks
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[]} arcs
     * @param {{ points?: object[], holes?: object[][], layerCode?: number, layerId?: number }[] | 'top' | 'bottom'} [regionsOrSide]
     * @param {'top' | 'bottom'} [side]
     * @returns {{ fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[], regions: { points?: object[], holes?: object[][], layerCode?: number, layerId?: number }[] }}
     */
    static select(
        primitiveLayers,
        fills,
        tracks,
        arcs,
        regionsOrSide = [],
        side = 'top'
    ) {
        const requestedSide =
            typeof regionsOrSide === 'string' ? regionsOrSide : side
        const regions = Array.isArray(regionsOrSide) ? regionsOrSide : []
        const prioritizedLayerMatchers =
            PcbFootprintPrimitiveSelector.#resolveLayerMatchers(requestedSide)

        for (const matchesLayerName of prioritizedLayerMatchers) {
            const layerIds = new Set(
                (primitiveLayers || [])
                    .filter((layer) => matchesLayerName(layer.name))
                    .map((layer) => Number(layer.layerId))
                    .filter((layerId) => Number.isInteger(layerId))
            )

            if (!layerIds.size) {
                continue
            }

            const layerFills = (fills || []).filter((fill) =>
                layerIds.has(fill.layerId)
            )
            const layerTracks = (tracks || []).filter((track) =>
                layerIds.has(track.layerId)
            )
            const layerArcs = (arcs || []).filter((arc) =>
                layerIds.has(arc.layerId)
            )
            const layerRegions = regions.filter((region) =>
                layerIds.has(region.layerId)
            )

            if (
                layerFills.length ||
                layerTracks.length ||
                layerArcs.length ||
                layerRegions.length
            ) {
                return {
                    fills: layerFills,
                    tracks: layerTracks,
                    arcs: layerArcs,
                    regions: layerRegions
                }
            }
        }

        return {
            fills: [],
            tracks: [],
            arcs: [],
            regions: []
        }
    }

    /**
     * Resolves the prioritized layer-name matchers for one board side.
     * @param {'top' | 'bottom'} side
     * @returns {((layerName: string) => boolean)[]}
     */
    static #resolveLayerMatchers(side) {
        if (side === 'bottom') {
            return [
                (layerName) =>
                    PcbFootprintPrimitiveSelector.#includesLayerName(
                        layerName,
                        'BOTTOM OVERLAY'
                    ),
                (layerName) =>
                    PcbFootprintPrimitiveSelector.#includesLayerName(
                        layerName,
                        'BOTTOM ASSEMBLY'
                    ),
                (layerName) =>
                    PcbFootprintPrimitiveSelector.#includesLayerName(
                        layerName,
                        'PLACEMENT OUTLINE'
                    ),
                (layerName) =>
                    PcbFootprintPrimitiveSelector.#includesLayerName(
                        layerName,
                        'BOTTOM MECHANIC'
                    )
            ]
        }

        return [
            (layerName) =>
                PcbFootprintPrimitiveSelector.#includesLayerName(
                    layerName,
                    'TOP OVERLAY'
                ),
            (layerName) =>
                PcbFootprintPrimitiveSelector.#includesLayerName(
                    layerName,
                    'TOP ASSEMBLY'
                ),
            (layerName) =>
                PcbFootprintPrimitiveSelector.#includesLayerName(
                    layerName,
                    'PLACEMENT OUTLINE'
                ),
            (layerName) =>
                PcbFootprintPrimitiveSelector.#includesLayerName(
                    layerName,
                    'TOP MECHANIC'
                )
        ]
    }

    /**
     * Returns true when one primitive layer name contains the target label.
     * @param {string} layerName
     * @param {string} needle
     * @returns {boolean}
     */
    static #includesLayerName(layerName, needle) {
        return PcbFootprintPrimitiveSelector.#compactLayerName(
            layerName
        ).includes(PcbFootprintPrimitiveSelector.#compactLayerName(needle))
    }

    /**
     * Normalizes layer labels so compact names such as TopOverlay match
     * spaced Altium labels such as Top Overlay.
     * @param {string} layerName
     * @returns {string}
     */
    static #compactLayerName(layerName) {
        return String(layerName || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
    }
}
