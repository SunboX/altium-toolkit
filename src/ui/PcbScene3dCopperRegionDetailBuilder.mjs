// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Converts parsed PCB region primitives into 3D copper fill detail.
 */
export class PcbScene3dCopperRegionDetailBuilder {
    /**
     * Builds fill-compatible region primitives for 3D copper rendering.
     * @param {{ regions?: object[], shapeBasedRegions?: object[] } | null} pcb Parsed PCB model.
     * @returns {object[]}
     */
    static build(pcb) {
        return PcbScene3dCopperRegionDetailBuilder.#sourceRegions(pcb)
            .filter((region) =>
                PcbScene3dCopperRegionDetailBuilder.#isCopperFillRegion(region)
            )
            .map((region) =>
                PcbScene3dCopperRegionDetailBuilder.#withSegmentContours(region)
            )
    }

    /**
     * Resolves the region family used by the 2D PCB renderer.
     * @param {{ regions?: object[], shapeBasedRegions?: object[] } | null} pcb Parsed PCB model.
     * @returns {object[]}
     */
    static #sourceRegions(pcb) {
        const shapeBasedRegions = Array.isArray(pcb?.shapeBasedRegions)
            ? pcb.shapeBasedRegions
            : []
        if (shapeBasedRegions.length) {
            return shapeBasedRegions
        }

        return Array.isArray(pcb?.regions) ? pcb.regions : []
    }

    /**
     * Checks whether one region should become rendered copper.
     * @param {object | null} region Parsed region primitive.
     * @returns {boolean}
     */
    static #isCopperFillRegion(region) {
        return (
            PcbScene3dCopperRegionDetailBuilder.#isCopperLayerId(
                region?.layerId
            ) &&
            !PcbScene3dCopperRegionDetailBuilder.#isCutoutOrKeepout(region) &&
            PcbScene3dCopperRegionDetailBuilder.#pointLoop(region?.points)
                .length >= 3
        )
    }

    /**
     * Checks whether one layer id belongs to Altium copper.
     * @param {unknown} layerId Source layer id.
     * @returns {boolean}
     */
    static #isCopperLayerId(layerId) {
        const normalized = Number(layerId)
        return (
            Number.isInteger(normalized) && normalized >= 1 && normalized <= 32
        )
    }

    /**
     * Checks whether one region describes clearance instead of copper.
     * @param {object | null} region Parsed region primitive.
     * @returns {boolean}
     */
    static #isCutoutOrKeepout(region) {
        return (
            region?.isKeepout === true ||
            region?.isBoardCutout === true ||
            region?.isPolygonPourCutout === true ||
            region?.isCutout === true ||
            Boolean(region?.cutoutClassification) ||
            PcbScene3dCopperRegionDetailBuilder.#looksLikeCutout(
                region?.classification
            ) ||
            PcbScene3dCopperRegionDetailBuilder.#looksLikeCutout(
                region?.rawKind
            ) ||
            PcbScene3dCopperRegionDetailBuilder.#looksLikeCutout(
                region?.properties?.KIND
            )
        )
    }

    /**
     * Checks a native classification token for cutout semantics.
     * @param {unknown} value Classification token.
     * @returns {boolean}
     */
    static #looksLikeCutout(value) {
        return String(value || '')
            .replace(/[^a-z0-9]/giu, '')
            .toLowerCase()
            .includes('cutout')
    }

    /**
     * Adds segment contours when a region includes arc vertices.
     * @param {object} region Parsed region primitive.
     * @returns {object}
     */
    static #withSegmentContours(region) {
        const loops = [
            region?.points,
            ...(Array.isArray(region?.holes) ? region.holes : [])
        ]

        if (
            !loops.some((loop) =>
                PcbScene3dCopperRegionDetailBuilder.#hasArcSegment(loop)
            )
        ) {
            return { ...region }
        }

        const contours = loops
            .map((loop) =>
                PcbScene3dCopperRegionDetailBuilder.#segmentContour(loop)
            )
            .filter((contour) => contour.length >= 3)

        return contours.length ? { ...region, contours } : { ...region }
    }

    /**
     * Checks whether a loop carries arc metadata.
     * @param {unknown[]} points Candidate loop points.
     * @returns {boolean}
     */
    static #hasArcSegment(points) {
        return PcbScene3dCopperRegionDetailBuilder.#pointLoop(points).some(
            (point) => PcbScene3dCopperRegionDetailBuilder.#isArcPoint(point)
        )
    }

    /**
     * Converts one point loop into line and arc segments.
     * @param {unknown[]} points Candidate loop points.
     * @returns {object[]}
     */
    static #segmentContour(points) {
        const loop = PcbScene3dCopperRegionDetailBuilder.#pointLoop(points)
        if (loop.length < 3) {
            return []
        }

        const segments = []
        for (let index = 0; index < loop.length; index += 1) {
            const current = loop[index]
            const next = loop[(index + 1) % loop.length]
            const segment =
                PcbScene3dCopperRegionDetailBuilder.#arcSegment(
                    current,
                    next
                ) ||
                PcbScene3dCopperRegionDetailBuilder.#lineSegment(current, next)
            segments.push(segment)
        }

        return segments
    }

    /**
     * Builds a straight segment between two region vertices.
     * @param {{ x: number, y: number }} current Start vertex.
     * @param {{ x: number, y: number }} next End vertex.
     * @returns {object}
     */
    static #lineSegment(current, next) {
        return {
            type: 'line',
            x1: Number(current.x),
            y1: Number(current.y),
            x2: Number(next.x),
            y2: Number(next.y)
        }
    }

    /**
     * Builds an arc segment when the start vertex carries arc metadata.
     * @param {{ x: number, y: number }} current Start vertex.
     * @param {{ x: number, y: number }} next End vertex.
     * @returns {object | null}
     */
    static #arcSegment(current, next) {
        if (!PcbScene3dCopperRegionDetailBuilder.#isArcPoint(current)) {
            return null
        }

        const center = PcbScene3dCopperRegionDetailBuilder.#arcCenter(current)
        const radius = Number(current.radius)
        if (
            !center ||
            !Number.isFinite(radius) ||
            radius <= 0 ||
            !Number.isFinite(Number(current.startAngle)) ||
            !Number.isFinite(Number(current.endAngle))
        ) {
            return null
        }

        return {
            type: 'arc',
            x1: Number(current.x),
            y1: Number(current.y),
            x2: Number(next.x),
            y2: Number(next.y),
            x: center.x,
            y: center.y,
            radius,
            startAngle: Number(current.startAngle),
            endAngle: Number(current.endAngle)
        }
    }

    /**
     * Resolves one arc center from known region vertex fields.
     * @param {object} point Region vertex.
     * @returns {{ x: number, y: number } | null}
     */
    static #arcCenter(point) {
        const x = Number(point?.centerX ?? point?.cx ?? point?.center?.x)
        const y = Number(point?.centerY ?? point?.cy ?? point?.center?.y)
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Checks whether a point starts an arc segment.
     * @param {object | null} point Region vertex.
     * @returns {boolean}
     */
    static #isArcPoint(point) {
        return point?.isArc === true && Number(point?.radius) > 0
    }

    /**
     * Builds a finite point loop and removes a duplicate closing vertex.
     * @param {unknown[] | undefined} points Candidate loop points.
     * @returns {object[]}
     */
    static #pointLoop(points) {
        const loop = (Array.isArray(points) ? points : []).filter((point) =>
            PcbScene3dCopperRegionDetailBuilder.#isFinitePoint(point)
        )

        if (loop.length < 2) {
            return loop
        }

        const first = loop[0]
        const last = loop[loop.length - 1]
        if (
            Math.abs(Number(first.x) - Number(last.x)) < 1e-6 &&
            Math.abs(Number(first.y) - Number(last.y)) < 1e-6
        ) {
            return loop.slice(0, -1)
        }

        return loop
    }

    /**
     * Checks whether one object carries finite point coordinates.
     * @param {unknown} point Candidate point.
     * @returns {boolean}
     */
    static #isFinitePoint(point) {
        return (
            Number.isFinite(Number(point?.x)) &&
            Number.isFinite(Number(point?.y))
        )
    }
}
