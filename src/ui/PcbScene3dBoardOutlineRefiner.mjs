// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Refines Altium 3D board outlines when parser recovery emitted a rasterized
 * stair-step contour even though the document still carries a smoother board
 * region contour.
 */
export class PcbScene3dBoardOutlineRefiner {
    static #MIN_RASTERIZED_SEGMENTS = 16
    static #MIN_SHORT_SEGMENT_RATIO = 0.35
    static #MIN_AXIS_ALIGNED_RATIO = 0.9
    static #SHORT_SEGMENT_MAX_MIL = 24
    static #POINT_EPSILON_MIL = 0.25
    static #AREA_RATIO_MIN = 0.75
    static #AREA_RATIO_MAX = 1.25

    /**
     * Returns a scene description with a refined board outline when a better
     * board-region contour is available.
     * @param {object} sceneDescription Built scene description.
     * @param {object} documentModel Source PCB document model.
     * @returns {object}
     */
    static refine(sceneDescription, documentModel) {
        const board = sceneDescription?.board
        const segments = Array.isArray(board?.segments) ? board.segments : []

        if (
            !PcbScene3dBoardOutlineRefiner.#isRasterizedManhattanOutline(
                segments
            )
        ) {
            return sceneDescription
        }

        const currentOutline =
            documentModel?.pcb?.boardOutline || sceneDescription?.board || {}
        const candidate = PcbScene3dBoardOutlineRefiner.#selectCandidate(
            documentModel?.pcb?.boardRegions,
            currentOutline
        )

        if (!candidate) {
            return sceneDescription
        }

        const refinedBoard = {
            ...board,
            minX: candidate.minX,
            minY: candidate.minY,
            widthMil: candidate.widthMil,
            heightMil: candidate.heightMil,
            centerX: candidate.minX + candidate.widthMil / 2,
            centerY: candidate.minY + candidate.heightMil / 2,
            segments: candidate.segments
        }

        return {
            ...sceneDescription,
            board: refinedBoard,
            components: PcbScene3dBoardOutlineRefiner.#realignLocalPlacements(
                sceneDescription?.components,
                board,
                refinedBoard
            ),
            externalPlacements:
                PcbScene3dBoardOutlineRefiner.#realignLocalPlacements(
                    sceneDescription?.externalPlacements,
                    board,
                    refinedBoard
                ),
            staticBodyPlacements:
                PcbScene3dBoardOutlineRefiner.#realignLocalPlacements(
                    sceneDescription?.staticBodyPlacements,
                    board,
                    refinedBoard
                )
        }
    }

    /**
     * Realigns precomputed local placements to a refined board center.
     * @param {object[] | undefined} placements Scene placements.
     * @param {{ centerX?: number, centerY?: number }} previousBoard Previous board.
     * @param {{ centerX?: number, centerY?: number }} refinedBoard Refined board.
     * @returns {object[] | undefined}
     */
    static #realignLocalPlacements(placements, previousBoard, refinedBoard) {
        if (!Array.isArray(placements)) {
            return placements
        }

        const deltaX =
            Number(previousBoard?.centerX || 0) -
            Number(refinedBoard?.centerX || 0)
        const deltaY =
            Number(previousBoard?.centerY || 0) -
            Number(refinedBoard?.centerY || 0)

        if (!deltaX && !deltaY) {
            return placements
        }

        return placements.map((placement) =>
            PcbScene3dBoardOutlineRefiner.#realignLocalPlacement(
                placement,
                deltaX,
                deltaY
            )
        )
    }

    /**
     * Applies one local origin delta to a scene placement.
     * @param {object} placement Scene placement.
     * @param {number} deltaX Local X delta.
     * @param {number} deltaY Local Y delta.
     * @returns {object}
     */
    static #realignLocalPlacement(placement, deltaX, deltaY) {
        const positionMil = placement?.positionMil || {}

        return {
            ...placement,
            positionMil: {
                ...positionMil,
                x: Number(positionMil.x || 0) + deltaX,
                y: Number(positionMil.y || 0) + deltaY
            }
        }
    }

    /**
     * Returns true when an outline looks like a raster-grid recovery of a
     * curved board route instead of authored geometric segments.
     * @param {Array<Record<string, number | string>>} segments Outline segments.
     * @returns {boolean}
     */
    static #isRasterizedManhattanOutline(segments) {
        if (
            segments.length <
            PcbScene3dBoardOutlineRefiner.#MIN_RASTERIZED_SEGMENTS
        ) {
            return false
        }

        if (segments.some((segment) => segment.type === 'arc')) {
            return false
        }

        let axisAlignedCount = 0
        let shortSegmentCount = 0

        for (const segment of segments) {
            const dx = Math.abs(
                Number(segment.x2 || 0) - Number(segment.x1 || 0)
            )
            const dy = Math.abs(
                Number(segment.y2 || 0) - Number(segment.y1 || 0)
            )
            const length = Math.hypot(dx, dy)

            if (dx <= 0.001 || dy <= 0.001) {
                axisAlignedCount += 1
            }
            if (
                length <= PcbScene3dBoardOutlineRefiner.#SHORT_SEGMENT_MAX_MIL
            ) {
                shortSegmentCount += 1
            }
        }

        return (
            axisAlignedCount / segments.length >=
                PcbScene3dBoardOutlineRefiner.#MIN_AXIS_ALIGNED_RATIO &&
            shortSegmentCount / segments.length >=
                PcbScene3dBoardOutlineRefiner.#MIN_SHORT_SEGMENT_RATIO
        )
    }

    /**
     * Chooses the best compatible board-region contour.
     * @param {object[] | undefined} regions Candidate board regions.
     * @param {object} currentOutline Current outline bounds and segments.
     * @returns {object | null}
     */
    static #selectCandidate(regions, currentOutline) {
        const currentBounds =
            PcbScene3dBoardOutlineRefiner.#resolveOutlineBounds(currentOutline)
        if (!currentBounds) {
            return null
        }

        const currentArea = Math.abs(
            PcbScene3dBoardOutlineRefiner.#computeAreaFromSegments(
                currentOutline?.segments || []
            )
        )
        const candidates = (Array.isArray(regions) ? regions : [])
            .filter((region) =>
                PcbScene3dBoardOutlineRefiner.#isBoardRegionCandidate(region)
            )
            .map((region) => ({
                region,
                outline: PcbScene3dBoardOutlineRefiner.#buildOutlineFromPoints(
                    region.points
                )
            }))
            .filter((candidate) => candidate.outline)
            .filter((candidate) =>
                PcbScene3dBoardOutlineRefiner.#boundsAreCompatible(
                    currentBounds,
                    candidate.outline
                )
            )
            .filter(
                (candidate) =>
                    !PcbScene3dBoardOutlineRefiner.#isInsetCutoutCandidate(
                        currentBounds,
                        candidate.outline,
                        candidate.region
                    )
            )
            .filter((candidate) =>
                PcbScene3dBoardOutlineRefiner.#areaIsCompatible(
                    currentArea,
                    candidate.outline
                )
            )
            .map((candidate) => ({
                outline: candidate.outline,
                score: PcbScene3dBoardOutlineRefiner.#scoreBounds(
                    currentBounds,
                    candidate.outline
                )
            }))
            .sort((left, right) => left.score - right.score)

        return candidates[0]?.outline || null
    }

    /**
     * Returns true when an explicit board cutout is fully inset from the
     * current board envelope and therefore cannot represent the outer edge.
     * @param {object} current Current outline bounds.
     * @param {object} candidate Candidate outline.
     * @param {object} region Source board region.
     * @returns {boolean}
     */
    static #isInsetCutoutCandidate(current, candidate, region) {
        if (region?.isBoardCutout !== true) {
            return false
        }

        if (PcbScene3dBoardOutlineRefiner.#isLayerStackBodyRegion(region)) {
            return false
        }

        const candidateBounds =
            PcbScene3dBoardOutlineRefiner.#resolveOutlineBounds(candidate)
        if (!candidateBounds) {
            return false
        }

        const epsilon = PcbScene3dBoardOutlineRefiner.#POINT_EPSILON_MIL
        const insideEnvelope =
            candidateBounds.minX >= current.minX - epsilon &&
            candidateBounds.minY >= current.minY - epsilon &&
            candidateBounds.maxX <= current.maxX + epsilon &&
            candidateBounds.maxY <= current.maxY + epsilon
        const touchesOuterEdge =
            Math.abs(candidateBounds.minX - current.minX) <= epsilon ||
            Math.abs(candidateBounds.minY - current.minY) <= epsilon ||
            Math.abs(candidateBounds.maxX - current.maxX) <= epsilon ||
            Math.abs(candidateBounds.maxY - current.maxY) <= epsilon

        return insideEnvelope && !touchesOuterEdge
    }

    /**
     * Returns true when a board region describes a layer-stack body contour
     * rather than a separate internal cutout aperture.
     * @param {object} region Source board region.
     * @returns {boolean}
     */
    static #isLayerStackBodyRegion(region) {
        if (region?.objectKind !== 'BoardRegion') {
            return false
        }

        return (
            region?.isRigidRegion === true ||
            region?.isFlexRegion === true ||
            String(region?.layerStackId || '').trim().length > 0
        )
    }

    /**
     * Returns true when a region can represent the board body boundary.
     * @param {object} region Source board region.
     * @returns {boolean}
     */
    static #isBoardRegionCandidate(region) {
        return (
            Array.isArray(region?.points) &&
            region.points.length >= 3 &&
            (region?.objectKind === 'BoardRegion' ||
                region?.isBoardCutout === true ||
                Number.isInteger(region?.boardRegionIndex))
        )
    }

    /**
     * Converts one point loop into outline bounds and line segments.
     * @param {{ x?: number, y?: number }[] | undefined} points Source points.
     * @returns {object | null}
     */
    static #buildOutlineFromPoints(points) {
        const normalizedPoints =
            PcbScene3dBoardOutlineRefiner.#normalizePointLoop(points)

        if (normalizedPoints.length < 3) {
            return null
        }

        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY

        for (const point of normalizedPoints) {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
        }

        const segments = normalizedPoints.map((point, index) => {
            const next = normalizedPoints[(index + 1) % normalizedPoints.length]

            return {
                type: 'line',
                x1: point.x,
                y1: point.y,
                x2: next.x,
                y2: next.y
            }
        })

        return {
            minX,
            minY,
            widthMil: maxX - minX,
            heightMil: maxY - minY,
            segments
        }
    }

    /**
     * Normalizes finite points and drops duplicated adjacent points.
     * @param {{ x?: number, y?: number }[] | undefined} points Source points.
     * @returns {{ x: number, y: number }[]}
     */
    static #normalizePointLoop(points) {
        const output = []

        for (const point of Array.isArray(points) ? points : []) {
            const nextPoint = {
                x: Number(point?.x),
                y: Number(point?.y)
            }

            if (
                !Number.isFinite(nextPoint.x) ||
                !Number.isFinite(nextPoint.y)
            ) {
                continue
            }

            if (
                output.length &&
                PcbScene3dBoardOutlineRefiner.#distanceBetween(
                    output[output.length - 1],
                    nextPoint
                ) <= PcbScene3dBoardOutlineRefiner.#POINT_EPSILON_MIL
            ) {
                continue
            }

            output.push(nextPoint)
        }

        if (
            output.length > 1 &&
            PcbScene3dBoardOutlineRefiner.#distanceBetween(
                output[0],
                output[output.length - 1]
            ) <= PcbScene3dBoardOutlineRefiner.#POINT_EPSILON_MIL
        ) {
            output.pop()
        }

        return output
    }

    /**
     * Resolves bounds from an outline object.
     * @param {object} outline Outline-like object.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, widthMil: number, heightMil: number } | null}
     */
    static #resolveOutlineBounds(outline) {
        const minX = Number(outline?.minX)
        const minY = Number(outline?.minY)
        const widthMil = Number(outline?.widthMil)
        const heightMil = Number(outline?.heightMil)

        if (
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(widthMil) ||
            !Number.isFinite(heightMil) ||
            widthMil <= 0 ||
            heightMil <= 0
        ) {
            return null
        }

        return {
            minX,
            minY,
            maxX: minX + widthMil,
            maxY: minY + heightMil,
            widthMil,
            heightMil
        }
    }

    /**
     * Returns true when a candidate's envelope matches the current board.
     * @param {object} current Current outline bounds.
     * @param {object} candidate Candidate outline bounds.
     * @returns {boolean}
     */
    static #boundsAreCompatible(current, candidate) {
        const tolerance = Math.max(
            Math.max(current.widthMil, current.heightMil) * 0.06,
            40
        )
        const candidateBounds =
            PcbScene3dBoardOutlineRefiner.#resolveOutlineBounds(candidate)

        if (!candidateBounds) {
            return false
        }

        return (
            Math.abs(current.minX - candidateBounds.minX) <= tolerance &&
            Math.abs(current.minY - candidateBounds.minY) <= tolerance &&
            Math.abs(current.maxX - candidateBounds.maxX) <= tolerance &&
            Math.abs(current.maxY - candidateBounds.maxY) <= tolerance
        )
    }

    /**
     * Returns true when the candidate area is close enough to the fallback.
     * @param {number} currentArea Current outline area.
     * @param {object} candidate Candidate outline.
     * @returns {boolean}
     */
    static #areaIsCompatible(currentArea, candidate) {
        if (!currentArea) {
            return true
        }

        const candidateArea = Math.abs(
            PcbScene3dBoardOutlineRefiner.#computeAreaFromSegments(
                candidate?.segments || []
            )
        )
        const ratio = candidateArea / currentArea

        return (
            ratio >= PcbScene3dBoardOutlineRefiner.#AREA_RATIO_MIN &&
            ratio <= PcbScene3dBoardOutlineRefiner.#AREA_RATIO_MAX
        )
    }

    /**
     * Scores how closely candidate bounds match current bounds.
     * @param {object} current Current outline bounds.
     * @param {object} candidate Candidate outline bounds.
     * @returns {number}
     */
    static #scoreBounds(current, candidate) {
        const candidateBounds =
            PcbScene3dBoardOutlineRefiner.#resolveOutlineBounds(candidate)

        if (!candidateBounds) {
            return Number.POSITIVE_INFINITY
        }

        return (
            Math.abs(current.minX - candidateBounds.minX) +
            Math.abs(current.minY - candidateBounds.minY) +
            Math.abs(current.maxX - candidateBounds.maxX) +
            Math.abs(current.maxY - candidateBounds.maxY)
        )
    }

    /**
     * Computes signed area from line segments.
     * @param {Array<Record<string, number | string>>} segments Outline segments.
     * @returns {number}
     */
    static #computeAreaFromSegments(segments) {
        let area = 0

        for (const segment of segments) {
            area +=
                Number(segment.x1 || 0) * Number(segment.y2 || 0) -
                Number(segment.x2 || 0) * Number(segment.y1 || 0)
        }

        return area / 2
    }

    /**
     * Measures the distance between two points.
     * @param {{ x: number, y: number }} left First point.
     * @param {{ x: number, y: number }} right Second point.
     * @returns {number}
     */
    static #distanceBetween(left, right) {
        return Math.hypot(right.x - left.x, right.y - left.y)
    }
}
