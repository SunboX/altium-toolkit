// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Detects native overlay artwork that already contains text knockout holes.
 */
export class PcbNativeTextKnockoutDetector {
    static #DENSE_OVERLAY_MIN_REGION_AREA_RATIO = 0.2
    static #DENSE_OVERLAY_MIN_TRACK_COUNT = 250

    /**
     * Returns true when side-resolved overlay primitives carry native text
     * knockouts, so source inverted TrueType labels would duplicate artwork.
     * @param {{ fills?: object[], regions?: object[], tracks?: object[], arcs?: object[] }} primitives Side-resolved overlay primitives.
     * @param {{ widthMil?: number, heightMil?: number }} board Board bounds.
     * @returns {boolean}
     */
    static hasNativeTextKnockouts(primitives, board) {
        const fills = [
            ...(Array.isArray(primitives?.fills) ? primitives.fills : []),
            ...(Array.isArray(primitives?.regions) ? primitives.regions : [])
        ]

        return (
            PcbNativeTextKnockoutDetector.#isDenseOverlayArtwork(
                {
                    fills,
                    tracks: primitives?.tracks,
                    arcs: primitives?.arcs
                },
                board
            ) &&
            fills.some(
                (fill) => Array.isArray(fill?.holes) && fill.holes.length > 0
            )
        )
    }

    /**
     * Detects dense overlay artwork from structural density.
     * @param {{ fills?: object[], tracks?: object[], arcs?: object[] }} side Side primitives.
     * @param {{ widthMil?: number, heightMil?: number }} board Board bounds.
     * @returns {boolean}
     */
    static #isDenseOverlayArtwork(side, board) {
        const strokeCount =
            (Array.isArray(side?.tracks) ? side.tracks.length : 0) +
            (Array.isArray(side?.arcs) ? side.arcs.length : 0)

        return (
            strokeCount >=
                PcbNativeTextKnockoutDetector.#DENSE_OVERLAY_MIN_TRACK_COUNT &&
            PcbNativeTextKnockoutDetector.#maxFillAreaRatio(
                side?.fills,
                board
            ) >=
                PcbNativeTextKnockoutDetector
                    .#DENSE_OVERLAY_MIN_REGION_AREA_RATIO
        )
    }

    /**
     * Resolves the largest fill-to-board bounding-box area ratio.
     * @param {object[] | undefined} fills Fill primitives.
     * @param {{ widthMil?: number, heightMil?: number }} board Board bounds.
     * @returns {number}
     */
    static #maxFillAreaRatio(fills, board) {
        const boardArea =
            Math.max(Number(board?.widthMil || 0), 0) *
            Math.max(Number(board?.heightMil || 0), 0)
        if (!boardArea) {
            return 0
        }

        return (Array.isArray(fills) ? fills : []).reduce((maxRatio, fill) => {
            const bounds =
                PcbNativeTextKnockoutDetector.#resolveFillBounds(fill)
            if (!bounds) {
                return maxRatio
            }

            const fillArea =
                Math.max(bounds.maxX - bounds.minX, 0) *
                Math.max(bounds.maxY - bounds.minY, 0)

            return Math.max(maxRatio, fillArea / boardArea)
        }, 0)
    }

    /**
     * Resolves rough authored bounds for one rectangular or polygon fill.
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number, points?: { x?: number, y?: number }[] }} fill Fill primitive.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveFillBounds(fill) {
        const points = Array.isArray(fill?.points)
            ? fill.points
                  .map((point) => ({
                      x: Number(point?.x),
                      y: Number(point?.y)
                  }))
                  .filter(
                      (point) =>
                          Number.isFinite(point.x) && Number.isFinite(point.y)
                  )
            : [
                  { x: Number(fill?.x1), y: Number(fill?.y1) },
                  { x: Number(fill?.x2), y: Number(fill?.y2) }
              ].filter(
                  (point) =>
                      Number.isFinite(point.x) && Number.isFinite(point.y)
              )

        if (points.length < 2) {
            return null
        }

        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys)
        }
    }
}
