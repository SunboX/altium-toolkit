// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Normalizes edge-facing footprint documentation glyphs so repeated mirrored
 * variants open toward the nearest board edge in the 2D PCB renderer.
 */
export class PcbEdgeFacingGlyphNormalizer {
    static #FULL_CIRCLE_EPSILON = 0.001
    static #EDGE_GLYPH_CONNECTION_TOLERANCE = 4
    static #EDGE_GLYPH_MIN_TRACK_COUNT = 5
    static #EDGE_GLYPH_TIP_TRACK_LENGTH_RATIO = 0.7
    static #EDGE_GLYPH_CENTER_TOLERANCE = 1.5
    static #EDGE_GLYPH_PROXIMITY_RATIO = 0.2
    static #MARKER_PROXIMITY_MULTIPLIER = 3

    /**
     * Normalizes repeated edge-facing documentation glyphs so their opening
     * stays on the board edge even when the authored primitive cluster is
     * mirrored inward.
     * @param {{ fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[] }} footprintPrimitives
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number }} outline
     * @param {{ preferMarkers?: boolean }} [options]
     * @returns {{ fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[] }}
     */
    static normalize(footprintPrimitives, outline, options = {}) {
        const normalizedTracks = (footprintPrimitives?.tracks || []).map(
            (track) => ({ ...track })
        )
        const normalizedArcs = (footprintPrimitives?.arcs || []).map((arc) => ({
            ...arc
        }))
        const groups = PcbEdgeFacingGlyphNormalizer.#collectGroups(
            normalizedTracks,
            normalizedArcs
        )

        for (const group of groups) {
            const transform = PcbEdgeFacingGlyphNormalizer.#resolveTransform(
                group,
                normalizedTracks,
                normalizedArcs
            )

            if (!transform) {
                continue
            }

            if (transform.kind === 'arc-half-flip') {
                group.arcIndexes.forEach((arcIndex) => {
                    normalizedArcs[arcIndex] =
                        PcbEdgeFacingGlyphNormalizer.#flipArcHalf(
                            normalizedArcs[arcIndex]
                        )
                })
                continue
            }
        }

        return {
            fills: footprintPrimitives?.fills || [],
            tracks: normalizedTracks,
            arcs: normalizedArcs
        }
    }

    /**
     * Normalizes glyphs using only the nearest board edge so 3D silkscreen
     * detail does not overreact to nearby circular markers on other features.
     * @param {{ fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[] }} footprintPrimitives
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number }} outline
     * @returns {{ fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[] }}
     */
    static normalizeForBoardEdge(footprintPrimitives, outline) {
        return PcbEdgeFacingGlyphNormalizer.normalize(
            footprintPrimitives,
            outline
        )
    }

    /**
     * Collects connected non-circular footprint glyph groups that could need
     * edge-facing orientation cleanup.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number }[]} tracks
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number }[]} arcs
     * @returns {{ trackIndexes: number[], arcIndexes: number[], minX: number, maxX: number, minY: number, maxY: number }[]}
     */
    static #collectGroups(tracks, arcs) {
        const items = [
            ...tracks.map((track, trackIndex) => ({
                kind: 'track',
                trackIndex,
                bounds: PcbEdgeFacingGlyphNormalizer.#buildTrackBounds(track)
            })),
            ...arcs
                .map((arc, arcIndex) => ({
                    kind: 'arc',
                    arcIndex,
                    arc,
                    bounds: PcbEdgeFacingGlyphNormalizer.#buildArcBounds(arc)
                }))
                .filter(
                    (item) =>
                        !PcbEdgeFacingGlyphNormalizer.#isFullCircleArc(item.arc)
                )
        ]
        const visited = new Array(items.length).fill(false)
        const groups = []

        for (let index = 0; index < items.length; index += 1) {
            if (visited[index]) {
                continue
            }

            const queue = [index]
            const trackIndexes = []
            const arcIndexes = []
            let minX = Number.POSITIVE_INFINITY
            let maxX = Number.NEGATIVE_INFINITY
            let minY = Number.POSITIVE_INFINITY
            let maxY = Number.NEGATIVE_INFINITY
            visited[index] = true

            while (queue.length) {
                const currentIndex = queue.pop()
                const currentItem = items[currentIndex]
                minX = Math.min(minX, currentItem.bounds.minX)
                maxX = Math.max(maxX, currentItem.bounds.maxX)
                minY = Math.min(minY, currentItem.bounds.minY)
                maxY = Math.max(maxY, currentItem.bounds.maxY)

                if (currentItem.kind === 'track') {
                    trackIndexes.push(currentItem.trackIndex)
                } else {
                    arcIndexes.push(currentItem.arcIndex)
                }

                for (
                    let nextIndex = 0;
                    nextIndex < items.length;
                    nextIndex += 1
                ) {
                    if (visited[nextIndex]) {
                        continue
                    }

                    if (
                        PcbEdgeFacingGlyphNormalizer.#boundsIntersect(
                            currentItem.bounds,
                            items[nextIndex].bounds
                        )
                    ) {
                        visited[nextIndex] = true
                        queue.push(nextIndex)
                    }
                }
            }

            groups.push({
                trackIndexes,
                arcIndexes,
                minX,
                maxX,
                minY,
                maxY
            })
        }

        return groups
    }

    /**
     * Resolves whether one connected screw glyph needs its semicircular head
     * moved onto the same side as the screw tip while keeping the authored
     * shaft geometry unchanged.
     * @param {{ trackIndexes: number[], arcIndexes: number[], minX: number, maxX: number, minY: number, maxY: number }} group
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number, layerCode?: number, layerId?: number }[]} tracks
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number }[]} arcs
     * @returns {{ kind: 'arc-half-flip' } | null}
     */
    static #resolveTransform(group, tracks, arcs) {
        if (
            group.trackIndexes.length <
                PcbEdgeFacingGlyphNormalizer.#EDGE_GLYPH_MIN_TRACK_COUNT ||
            group.arcIndexes.length !== 1
        ) {
            return null
        }

        const arc = arcs[group.arcIndexes[0]]
        if (
            Math.abs(
                Math.abs(
                    PcbEdgeFacingGlyphNormalizer.#resolveSweepDelta(
                        Number(arc.startAngle || 0),
                        Number(arc.endAngle || 0)
                    )
                ) - 180
            ) > PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
        ) {
            return null
        }
        const tipSide = PcbEdgeFacingGlyphNormalizer.#resolveTipSide(
            group,
            tracks,
            arc
        )
        if (!tipSide) {
            return null
        }
        const currentHeadSide =
            PcbEdgeFacingGlyphNormalizer.#resolveSemicircleSide(arc)
        const desiredHeadSide = tipSide

        if (!currentHeadSide || currentHeadSide === desiredHeadSide) {
            return null
        }

        return { kind: 'arc-half-flip' }
    }

    /**
     * Moves one semicircular screw head onto the opposite circle half while
     * preserving its authored endpoints and center position.
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number, layerCode?: number, layerId?: number }} arc
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number, layerCode?: number, layerId?: number }}
     */
    static #flipArcHalf(arc) {
        const endAngle = Number(arc.endAngle || 0)
        const rawDelta = endAngle - Number(arc.startAngle || 0)

        return {
            ...arc,
            endAngle:
                rawDelta > PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
                    ? endAngle - 360
                    : endAngle + 360
        }
    }

    /**
     * Resolves which side one screw tip points toward from the two longest
     * tracks meeting at the head center.
     * @param {{ trackIndexes: number[] }} group
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number, layerCode?: number, layerId?: number }[]} tracks
     * @param {{ x: number, y: number, radius: number }} arc
     * @returns {'left' | 'right' | 'top' | 'bottom' | null}
     */
    static #resolveTipSide(group, tracks, arc) {
        const centerX = Number(arc.x || 0)
        const centerY = Number(arc.y || 0)
        const minimumLength = Math.max(
            Number(arc.radius || 0) *
                PcbEdgeFacingGlyphNormalizer.#EDGE_GLYPH_TIP_TRACK_LENGTH_RATIO,
            18
        )
        const tipVectors = group.trackIndexes
            .map((trackIndex) =>
                PcbEdgeFacingGlyphNormalizer.#resolveTipVector(
                    tracks[trackIndex],
                    centerX,
                    centerY
                )
            )
            .filter(Boolean)
            .filter((vector) => vector.length >= minimumLength)
            .sort((left, right) => right.length - left.length)
            .slice(0, 2)

        if (!tipVectors.length) {
            return null
        }

        const averageVector = tipVectors.reduce(
            (sum, vector) => ({
                x: sum.x + vector.x,
                y: sum.y + vector.y
            }),
            { x: 0, y: 0 }
        )

        if (
            Math.abs(averageVector.x) <=
                PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON &&
            Math.abs(averageVector.y) <=
                PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
        ) {
            return null
        }

        if (Math.abs(averageVector.x) >= Math.abs(averageVector.y)) {
            return averageVector.x >= 0 ? 'right' : 'left'
        }

        return averageVector.y >= 0 ? 'bottom' : 'top'
    }

    /**
     * Resolves one tip vector from a center-connected screw track.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} track
     * @param {number} centerX
     * @param {number} centerY
     * @returns {{ x: number, y: number, length: number } | null}
     */
    static #resolveTipVector(track, centerX, centerY) {
        if (!track) {
            return null
        }

        const firstPoint = {
            x: Number(track.x1),
            y: Number(track.y1)
        }
        const secondPoint = {
            x: Number(track.x2),
            y: Number(track.y2)
        }
        const firstDistance = Math.hypot(
            firstPoint.x - centerX,
            firstPoint.y - centerY
        )
        const secondDistance = Math.hypot(
            secondPoint.x - centerX,
            secondPoint.y - centerY
        )
        const minimumDistance =
            PcbEdgeFacingGlyphNormalizer.#EDGE_GLYPH_CENTER_TOLERANCE

        if (
            firstDistance > minimumDistance &&
            secondDistance > minimumDistance
        ) {
            return null
        }

        const farPoint =
            firstDistance > secondDistance ? firstPoint : secondPoint

        return {
            x: farPoint.x - centerX,
            y: farPoint.y - centerY,
            length: Math.hypot(farPoint.x - centerX, farPoint.y - centerY)
        }
    }

    /**
     * Resolves which circle half one semicircular screw head currently occupies.
     * @param {{ startAngle: number, endAngle: number }} arc
     * @returns {'left' | 'right' | 'top' | 'bottom' | null}
     */
    static #resolveSemicircleSide(arc) {
        const delta = PcbEdgeFacingGlyphNormalizer.#resolveSweepDelta(
            Number(arc.startAngle || 0),
            Number(arc.endAngle || 0)
        )

        if (
            Math.abs(Math.abs(delta) - 180) >
            PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
        ) {
            return null
        }

        const midpointAngle =
            (Number(arc.startAngle || 0) + delta / 2) * (Math.PI / 180)
        const x = Math.cos(midpointAngle)
        const y = Math.sin(midpointAngle)

        if (Math.abs(x) >= Math.abs(y)) {
            return x >= 0 ? 'right' : 'left'
        }

        return y >= 0 ? 'bottom' : 'top'
    }

    /**
     * Resolves whether one glyph should mirror horizontally or vertically to
     * face its nearest board edge.
     * @param {'left' | 'right' | 'top' | 'bottom'} edge
     * @param {{ x: number, y: number }} arc
     * @param {number} centerX
     * @param {number} centerY
     * @returns {{ axis: 'horizontal' | 'vertical', value: number } | null}
     */
    static #resolveEdgeTransform(edge, arc, centerX, centerY) {
        if (edge === 'left' && Number(arc.x) > centerX) {
            return {
                axis: 'horizontal',
                value: centerX
            }
        }

        if (edge === 'right' && Number(arc.x) < centerX) {
            return {
                axis: 'horizontal',
                value: centerX
            }
        }

        if (edge === 'top' && Number(arc.y) > centerY) {
            return {
                axis: 'vertical',
                value: centerY
            }
        }

        if (edge === 'bottom' && Number(arc.y) < centerY) {
            return {
                axis: 'vertical',
                value: centerY
            }
        }

        return null
    }

    /**
     * Resolves the nearest adjacent full-circle marker for one glyph group.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} group
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number }[]} arcs
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveNearestFullCircleMarker(group, arcs) {
        const centerX = (group.minX + group.maxX) / 2
        const centerY = (group.minY + group.maxY) / 2
        const maxSpan = Math.max(
            group.maxX - group.minX,
            group.maxY - group.minY,
            1
        )
        const maxDistance =
            maxSpan * PcbEdgeFacingGlyphNormalizer.#MARKER_PROXIMITY_MULTIPLIER
        let nearestMarker = null
        let nearestDistance = Number.POSITIVE_INFINITY

        for (const arc of arcs) {
            if (!PcbEdgeFacingGlyphNormalizer.#isFullCircleArc(arc)) {
                continue
            }

            const deltaX = Number(arc.x) - centerX
            const deltaY = Number(arc.y) - centerY
            const distance = Math.hypot(deltaX, deltaY)

            if (distance > maxDistance || distance >= nearestDistance) {
                continue
            }

            nearestMarker = {
                x: Number(arc.x),
                y: Number(arc.y)
            }
            nearestDistance = distance
        }

        return nearestMarker
    }

    /**
     * Resolves whether one glyph should mirror to face its adjacent full-circle
     * marker.
     * @param {{ x: number, y: number }} marker
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number }} arc
     * @param {number} centerX
     * @param {number} centerY
     * @returns {{ axis: 'horizontal' | 'vertical', value: number } | null}
     */
    static #resolveMarkerTransform(marker, arc, centerX, centerY) {
        const deltaX = Number(marker.x) - centerX
        const deltaY = Number(marker.y) - centerY

        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            if (deltaX < 0 && Number(arc.x) > centerX) {
                return {
                    axis: 'horizontal',
                    value: centerX
                }
            }

            if (deltaX > 0 && Number(arc.x) < centerX) {
                return {
                    axis: 'horizontal',
                    value: centerX
                }
            }

            return null
        }

        if (deltaY < 0 && Number(arc.y) > centerY) {
            return {
                axis: 'vertical',
                value: centerY
            }
        }

        if (deltaY > 0 && Number(arc.y) < centerY) {
            return {
                axis: 'vertical',
                value: centerY
            }
        }

        return null
    }

    /**
     * Mirrors one track horizontally around a local cluster axis.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number, layerCode?: number, layerId?: number }} track
     * @param {number} axisX
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width?: number, layerCode?: number, layerId?: number }}
     */
    static #mirrorTrackHorizontally(track, axisX) {
        return PcbEdgeFacingGlyphNormalizer.#normalizeTrackDirection({
            ...track,
            x1: axisX * 2 - Number(track.x1),
            x2: axisX * 2 - Number(track.x2)
        })
    }

    /**
     * Mirrors one track vertically around a local cluster axis.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number, layerCode?: number, layerId?: number }} track
     * @param {number} axisY
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width?: number, layerCode?: number, layerId?: number }}
     */
    static #mirrorTrackVertically(track, axisY) {
        return PcbEdgeFacingGlyphNormalizer.#normalizeTrackDirection({
            ...track,
            y1: axisY * 2 - Number(track.y1),
            y2: axisY * 2 - Number(track.y2)
        })
    }

    /**
     * Mirrors one arc horizontally around a local cluster axis.
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number, layerCode?: number, layerId?: number }} arc
     * @param {number} axisX
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number, layerCode?: number, layerId?: number }}
     */
    static #mirrorArcHorizontally(arc, axisX) {
        return {
            ...arc,
            x: axisX * 2 - Number(arc.x),
            startAngle: PcbEdgeFacingGlyphNormalizer.#normalizeAngle(
                180 - Number(arc.endAngle)
            ),
            endAngle: PcbEdgeFacingGlyphNormalizer.#normalizeAngle(
                180 - Number(arc.startAngle)
            )
        }
    }

    /**
     * Mirrors one arc vertically around a local cluster axis.
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number, layerCode?: number, layerId?: number }} arc
     * @param {number} axisY
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number, layerCode?: number, layerId?: number }}
     */
    static #mirrorArcVertically(arc, axisY) {
        return {
            ...arc,
            y: axisY * 2 - Number(arc.y),
            startAngle: PcbEdgeFacingGlyphNormalizer.#normalizeAngle(
                360 - Number(arc.endAngle)
            ),
            endAngle: PcbEdgeFacingGlyphNormalizer.#normalizeAngle(
                360 - Number(arc.startAngle)
            )
        }
    }

    /**
     * Returns one stroke-aware bounds envelope for a documentation track.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number }} track
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    static #buildTrackBounds(track) {
        const halfWidth =
            Math.max(Number(track.width || 0), 1) / 2 +
            PcbEdgeFacingGlyphNormalizer.#EDGE_GLYPH_CONNECTION_TOLERANCE

        return {
            minX: Math.min(Number(track.x1), Number(track.x2)) - halfWidth,
            maxX: Math.max(Number(track.x1), Number(track.x2)) + halfWidth,
            minY: Math.min(Number(track.y1), Number(track.y2)) - halfWidth,
            maxY: Math.max(Number(track.y1), Number(track.y2)) + halfWidth
        }
    }

    /**
     * Returns one stroke-aware bounds envelope for a documentation arc.
     * @param {{ x: number, y: number, radius: number, width?: number }} arc
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    static #buildArcBounds(arc) {
        const radius =
            Math.max(Number(arc.radius || 0), 0) +
            Math.max(Number(arc.width || 0), 1) / 2 +
            PcbEdgeFacingGlyphNormalizer.#EDGE_GLYPH_CONNECTION_TOLERANCE

        return {
            minX: Number(arc.x) - radius,
            maxX: Number(arc.x) + radius,
            minY: Number(arc.y) - radius,
            maxY: Number(arc.y) + radius
        }
    }

    /**
     * Returns true when two stroke-aware primitive envelopes overlap.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} left
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} right
     * @returns {boolean}
     */
    static #boundsIntersect(left, right) {
        return !(
            left.maxX < right.minX ||
            left.minX > right.maxX ||
            left.maxY < right.minY ||
            left.minY > right.maxY
        )
    }

    /**
     * Resolves the nearest relevant board edge for one connected glyph bounds
     * box. Corner-adjacent glyphs use their own opening axis first so a
     * left-edge screw near the top border still resolves against the left
     * board edge instead of the closer top/bottom corner distance.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number }} outline
     * @param {{ x: number, y: number }} arc
     * @param {number} centerX
     * @param {number} centerY
     * @returns {{ edge: 'left' | 'right' | 'top' | 'bottom', distance: number }}
     */
    static #resolveNearestOutlineEdge(bounds, outline, arc, centerX, centerY) {
        const outlineMaxX =
            Number(outline?.minX || 0) + Number(outline?.widthMil || 0)
        const outlineMaxY =
            Number(outline?.minY || 0) + Number(outline?.heightMil || 0)
        const horizontalDistances = [
            {
                edge: 'left',
                distance: Math.max(bounds.minX - Number(outline?.minX || 0), 0)
            },
            {
                edge: 'right',
                distance: Math.max(outlineMaxX - bounds.maxX, 0)
            }
        ]
        const verticalDistances = [
            {
                edge: 'top',
                distance: Math.max(bounds.minY - Number(outline?.minY || 0), 0)
            },
            {
                edge: 'bottom',
                distance: Math.max(outlineMaxY - bounds.maxY, 0)
            }
        ]

        horizontalDistances.sort(
            (left, right) => left.distance - right.distance
        )
        verticalDistances.sort((left, right) => left.distance - right.distance)
        const axis = PcbEdgeFacingGlyphNormalizer.#resolveGlyphAxis(
            bounds,
            arc,
            centerX,
            centerY
        )

        if (axis === 'horizontal') {
            return horizontalDistances[0]
        }

        if (axis === 'vertical') {
            return verticalDistances[0]
        }

        const distances = [horizontalDistances[0], verticalDistances[0]]
        distances.sort((left, right) => left.distance - right.distance)
        return distances[0]
    }

    /**
     * Resolves the primary opening axis for one documentation glyph from the
     * arc position and, when that is ambiguous, from the group's overall span.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @param {{ x: number, y: number }} arc
     * @param {number} centerX
     * @param {number} centerY
     * @returns {'horizontal' | 'vertical' | null}
     */
    static #resolveGlyphAxis(bounds, arc, centerX, centerY) {
        const deltaX = Math.abs(Number(arc?.x || 0) - centerX)
        const deltaY = Math.abs(Number(arc?.y || 0) - centerY)

        if (
            deltaX >
            deltaY + PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
        ) {
            return 'horizontal'
        }

        if (
            deltaY >
            deltaX + PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
        ) {
            return 'vertical'
        }

        const width = Math.max(Number(bounds.maxX) - Number(bounds.minX), 0)
        const height = Math.max(Number(bounds.maxY) - Number(bounds.minY), 0)

        if (
            width >
            height + PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
        ) {
            return 'horizontal'
        }

        if (
            height >
            width + PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
        ) {
            return 'vertical'
        }

        return null
    }

    /**
     * Returns true when one documentation arc is effectively a full circle.
     * @param {{ startAngle: number, endAngle: number }} arc
     * @returns {boolean}
     */
    static #isFullCircleArc(arc) {
        const delta = Number(arc.endAngle || 0) - Number(arc.startAngle || 0)

        return (
            Math.abs(delta) <=
                PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON ||
            Math.abs(delta) >=
                360 - PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON
        )
    }

    /**
     * Resolves one arc sweep delta onto the short wrapped direction used by
     * the PCB renderers.
     * @param {number} startAngle
     * @param {number} endAngle
     * @returns {number}
     */
    static #resolveSweepDelta(startAngle, endAngle) {
        const rawDelta = Number(endAngle || 0) - Number(startAngle || 0)
        let normalizedDelta = ((rawDelta + 540) % 360) - 180

        if (
            Math.abs(normalizedDelta + 180) <=
                PcbEdgeFacingGlyphNormalizer.#FULL_CIRCLE_EPSILON &&
            rawDelta > 0
        ) {
            normalizedDelta = 180
        }

        return normalizedDelta
    }

    /**
     * Normalizes one mirrored track direction into a stable left-to-right or
     * top-to-bottom ordering for deterministic SVG output.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number, layerCode?: number, layerId?: number }} track
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width?: number, layerCode?: number, layerId?: number }}
     */
    static #normalizeTrackDirection(track) {
        const x1 = Number(track.x1)
        const y1 = Number(track.y1)
        const x2 = Number(track.x2)
        const y2 = Number(track.y2)

        if (x1 < x2 || (Math.abs(x1 - x2) <= 0.001 && y1 <= y2)) {
            return track
        }

        return {
            ...track,
            x1: x2,
            y1: y2,
            x2: x1,
            y2: y1
        }
    }

    /**
     * Normalizes one angle into the range [0, 360).
     * @param {number} angle
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }
}
