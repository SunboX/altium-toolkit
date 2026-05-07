// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Splits PCB copper primitives into surface and subsurface render groups.
 */
export class PcbCopperPrimitiveSplitter {
    /**
     * Splits recovered copper primitives into the default top-facing surface
     * view and de-emphasized buried layers.
     * @param {{ layer?: string, segments: Array<Record<string, number | string>> }[]} polygons
     * @param {{ x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[]} fills
     * @param {{ x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[]} tracks
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[]} arcs
     * @param {{ points?: object[], holes?: object[][], layerCode?: number, layerId?: number }[]} regions
     * @returns {{ surface: { polygons: { layer?: string, segments: Array<Record<string, number | string>> }[], fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[], regions: { points?: object[], holes?: object[][], layerCode?: number, layerId?: number }[] }, subsurface: { polygons: { layer?: string, segments: Array<Record<string, number | string>> }[], fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[], regions: { points?: object[], holes?: object[][], layerCode?: number, layerId?: number }[] } }}
     */
    static split(polygons, fills, tracks, arcs, regions) {
        const copperFills = fills.filter((fill) =>
            PcbCopperPrimitiveSplitter.#isCopperLayerId(fill.layerId)
        )
        const copperTracks = tracks.filter((track) =>
            PcbCopperPrimitiveSplitter.#isCopperLayerId(track.layerId)
        )
        const copperArcs = arcs.filter((arc) =>
            PcbCopperPrimitiveSplitter.#isCopperLayerId(arc.layerId)
        )
        const copperRegions = regions.filter((region) =>
            PcbCopperPrimitiveSplitter.#isCopperLayerId(region.layerId)
        )
        const surfaceTrackLayerCode =
            PcbCopperPrimitiveSplitter.#resolveSurfaceLayerCode(copperTracks)
        const surfaceFillLayerCode =
            PcbCopperPrimitiveSplitter.#resolveSurfaceLayerCode(copperFills)
        const surfaceArcLayerCode =
            PcbCopperPrimitiveSplitter.#resolveSurfaceLayerCode(copperArcs)
        const surfaceRegionLayerCode =
            PcbCopperPrimitiveSplitter.#resolveSurfaceLayerCode(copperRegions)

        return {
            surface: {
                polygons: polygons.filter((polygon) =>
                    PcbCopperPrimitiveSplitter.#isSurfacePolygon(polygon)
                ),
                fills: copperFills.filter(
                    (fill) => fill.layerCode === surfaceFillLayerCode
                ),
                tracks: copperTracks.filter(
                    (track) => track.layerCode === surfaceTrackLayerCode
                ),
                arcs: copperArcs.filter(
                    (arc) => arc.layerCode === surfaceArcLayerCode
                ),
                regions: copperRegions.filter(
                    (region) => region.layerCode === surfaceRegionLayerCode
                )
            },
            subsurface: {
                polygons: polygons.filter(
                    (polygon) =>
                        !PcbCopperPrimitiveSplitter.#isSurfacePolygon(polygon)
                ),
                fills: copperFills.filter(
                    (fill) => fill.layerCode !== surfaceFillLayerCode
                ),
                tracks: copperTracks.filter(
                    (track) => track.layerCode !== surfaceTrackLayerCode
                ),
                arcs: copperArcs.filter(
                    (arc) => arc.layerCode !== surfaceArcLayerCode
                ),
                regions: copperRegions.filter(
                    (region) => region.layerCode !== surfaceRegionLayerCode
                )
            }
        }
    }

    /**
     * Returns the default visible layer code from one primitive family.
     * @param {{ layerCode?: number }[]} primitives
     * @returns {number | null}
     */
    static #resolveSurfaceLayerCode(primitives) {
        const layerCodes = primitives
            .map((primitive) => primitive.layerCode)
            .filter((layerCode) => Number.isFinite(layerCode))
        return layerCodes.length ? Math.min(...layerCodes) : null
    }

    /**
     * Returns true when one polygon belongs to the top-facing copper view.
     * @param {{ layer?: string }} polygon
     * @returns {boolean}
     */
    static #isSurfacePolygon(polygon) {
        return (
            String(polygon.layer || '')
                .trim()
                .toUpperCase() === 'TOP'
        )
    }

    /**
     * Returns true when one decoded primitive layer belongs to copper.
     * @param {number | undefined} layerId
     * @returns {boolean}
     */
    static #isCopperLayerId(layerId) {
        return Number.isInteger(layerId) && layerId >= 1 && layerId <= 32
    }
}
