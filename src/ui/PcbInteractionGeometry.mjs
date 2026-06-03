// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Provides lightweight hit-test geometry helpers for PCB mil coordinates.
 */
export class PcbInteractionGeometry {
    /**
     * Builds a circular geometry descriptor.
     * @param {{ x?: unknown, y?: unknown }} center Center point.
     * @param {unknown} radius Radius.
     * @returns {object}
     */
    static circle(center, radius) {
        return {
            kind: 'circle',
            center: PcbInteractionGeometry.point(center),
            radius: Math.max(0, Number(radius) || 0)
        }
    }

    /**
     * Builds a stroked segment geometry descriptor.
     * @param {{ x?: unknown, y?: unknown }} start Start point.
     * @param {{ x?: unknown, y?: unknown }} end End point.
     * @param {unknown} radius Stroke radius.
     * @returns {object}
     */
    static segment(start, end, radius = 0) {
        return {
            kind: 'segment',
            start: PcbInteractionGeometry.point(start),
            end: PcbInteractionGeometry.point(end),
            radius: Math.max(0, Number(radius) || 0)
        }
    }

    /**
     * Builds a polygon geometry descriptor.
     * @param {{ x?: unknown, y?: unknown }[]} points Polygon points.
     * @returns {object}
     */
    static polygon(points) {
        return {
            kind: 'polygon',
            points: (Array.isArray(points) ? points : []).map((point) =>
                PcbInteractionGeometry.point(point)
            )
        }
    }

    /**
     * Builds an axis-aligned bounds geometry descriptor.
     * @param {object} bounds Bounds.
     * @returns {object}
     */
    static bounds(bounds) {
        return {
            kind: 'bounds',
            bounds: PcbInteractionGeometry.normalizeBounds(bounds)
        }
    }

    /**
     * Builds a rotated rectangle polygon geometry descriptor.
     * @param {object} rectangle Rectangle.
     * @returns {object}
     */
    static rotatedRectangle(rectangle) {
        const center = PcbInteractionGeometry.point(rectangle)
        const width = Math.max(0, Number(rectangle?.width) || 0)
        const height = Math.max(0, Number(rectangle?.height) || 0)
        const rotation = (Number(rectangle?.rotation) || 0) * (Math.PI / 180)
        const cos = Math.cos(rotation)
        const sin = Math.sin(rotation)
        const halfWidth = width / 2
        const halfHeight = height / 2

        return PcbInteractionGeometry.polygon(
            [
                { x: -halfWidth, y: -halfHeight },
                { x: halfWidth, y: -halfHeight },
                { x: halfWidth, y: halfHeight },
                { x: -halfWidth, y: halfHeight }
            ].map((point) => ({
                x: center.x + point.x * cos - point.y * sin,
                y: center.y + point.x * sin + point.y * cos
            }))
        )
    }

    /**
     * Normalizes a point value.
     * @param {{ x?: unknown, y?: unknown }} point Point-like value.
     * @returns {{ x: number, y: number }}
     */
    static point(point) {
        return {
            x: Number(point?.x) || 0,
            y: Number(point?.y) || 0
        }
    }

    /**
     * Returns bounds for a geometry descriptor.
     * @param {object | null | undefined} geometry Geometry descriptor.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
     */
    static boundsFor(geometry) {
        if (!geometry || typeof geometry !== 'object') {
            return PcbInteractionGeometry.normalizeBounds(null)
        }

        if (geometry.kind === 'bounds') {
            return PcbInteractionGeometry.normalizeBounds(geometry.bounds)
        }

        const points = PcbInteractionGeometry.#pointsForBounds(geometry)
        if (!points.length) return PcbInteractionGeometry.normalizeBounds(null)

        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)
        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        const maxX = Math.max(...xs)
        const maxY = Math.max(...ys)

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        }
    }

    /**
     * Normalizes an axis-aligned bounds value.
     * @param {object | null | undefined} bounds Bounds-like value.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
     */
    static normalizeBounds(bounds) {
        const minX = Number(bounds?.minX) || 0
        const minY = Number(bounds?.minY) || 0
        const width = Number(bounds?.widthMil ?? bounds?.width) || 0
        const height = Number(bounds?.heightMil ?? bounds?.height) || 0
        const maxX = Number.isFinite(Number(bounds?.maxX))
            ? Number(bounds.maxX)
            : minX + width
        const maxY = Number.isFinite(Number(bounds?.maxY))
            ? Number(bounds.maxY)
            : minY + height

        return {
            minX: Math.min(minX, maxX),
            minY: Math.min(minY, maxY),
            maxX: Math.max(minX, maxX),
            maxY: Math.max(minY, maxY),
            width: Math.abs(maxX - minX),
            height: Math.abs(maxY - minY)
        }
    }

    /**
     * Returns whether a point intersects a geometry descriptor.
     * @param {object | null | undefined} geometry Geometry descriptor.
     * @param {{ x?: unknown, y?: unknown }} point Point-like value.
     * @param {number} [tolerance] Extra tolerance.
     * @returns {boolean}
     */
    static containsPoint(geometry, point, tolerance = 0) {
        const normalizedPoint = PcbInteractionGeometry.point(point)
        if (!geometry || typeof geometry !== 'object') return false

        if (
            !PcbInteractionGeometry.#boundsContainsPoint(
                PcbInteractionGeometry.boundsFor(geometry),
                normalizedPoint,
                tolerance
            )
        ) {
            return false
        }

        if (geometry.kind === 'circle') {
            return (
                PcbInteractionGeometry.#distance(
                    normalizedPoint,
                    geometry.center
                ) <=
                (Number(geometry.radius) || 0) + tolerance
            )
        }

        if (geometry.kind === 'segment') {
            return (
                PcbInteractionGeometry.#pointToSegmentDistance(
                    normalizedPoint,
                    geometry.start,
                    geometry.end
                ) <=
                (Number(geometry.radius) || 0) + tolerance
            )
        }

        if (geometry.kind === 'polygon') {
            return PcbInteractionGeometry.#pointInPolygon(
                normalizedPoint,
                geometry.points || []
            )
        }

        if (geometry.kind === 'bounds') {
            return true
        }

        return false
    }

    /**
     * Returns geometry points used for bounds calculations.
     * @param {object} geometry Geometry descriptor.
     * @returns {{ x: number, y: number }[]}
     */
    static #pointsForBounds(geometry) {
        if (geometry.kind === 'circle') {
            const center = PcbInteractionGeometry.point(geometry.center)
            const radius = Math.max(0, Number(geometry.radius) || 0)
            return [
                { x: center.x - radius, y: center.y - radius },
                { x: center.x + radius, y: center.y + radius }
            ]
        }

        if (geometry.kind === 'segment') {
            const start = PcbInteractionGeometry.point(geometry.start)
            const end = PcbInteractionGeometry.point(geometry.end)
            const radius = Math.max(0, Number(geometry.radius) || 0)
            return [
                {
                    x: Math.min(start.x, end.x) - radius,
                    y: Math.min(start.y, end.y) - radius
                },
                {
                    x: Math.max(start.x, end.x) + radius,
                    y: Math.max(start.y, end.y) + radius
                }
            ]
        }

        if (geometry.kind === 'polygon') {
            return (Array.isArray(geometry.points) ? geometry.points : []).map(
                (point) => PcbInteractionGeometry.point(point)
            )
        }

        return []
    }

    /**
     * Returns whether bounds contain a point.
     * @param {object} bounds Bounds.
     * @param {{ x: number, y: number }} point Point.
     * @param {number} tolerance Tolerance.
     * @returns {boolean}
     */
    static #boundsContainsPoint(bounds, point, tolerance) {
        return (
            point.x >= bounds.minX - tolerance &&
            point.x <= bounds.maxX + tolerance &&
            point.y >= bounds.minY - tolerance &&
            point.y <= bounds.maxY + tolerance
        )
    }

    /**
     * Returns Euclidean distance between two points.
     * @param {{ x?: unknown, y?: unknown }} first First point.
     * @param {{ x?: unknown, y?: unknown }} second Second point.
     * @returns {number}
     */
    static #distance(first, second) {
        const a = PcbInteractionGeometry.point(first)
        const b = PcbInteractionGeometry.point(second)
        return Math.hypot(a.x - b.x, a.y - b.y)
    }

    /**
     * Computes point-to-segment distance.
     * @param {{ x: number, y: number }} point Point.
     * @param {{ x?: unknown, y?: unknown }} start Segment start.
     * @param {{ x?: unknown, y?: unknown }} end Segment end.
     * @returns {number}
     */
    static #pointToSegmentDistance(point, start, end) {
        const first = PcbInteractionGeometry.point(start)
        const second = PcbInteractionGeometry.point(end)
        const dx = second.x - first.x
        const dy = second.y - first.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared === 0) {
            return PcbInteractionGeometry.#distance(point, first)
        }

        const t = Math.max(
            0,
            Math.min(
                1,
                ((point.x - first.x) * dx + (point.y - first.y) * dy) /
                    lengthSquared
            )
        )
        return PcbInteractionGeometry.#distance(point, {
            x: first.x + t * dx,
            y: first.y + t * dy
        })
    }

    /**
     * Returns whether a point is inside a polygon.
     * @param {{ x: number, y: number }} point Point.
     * @param {{ x?: unknown, y?: unknown }[]} polygon Polygon.
     * @returns {boolean}
     */
    static #pointInPolygon(point, polygon) {
        const points = (Array.isArray(polygon) ? polygon : []).map((entry) =>
            PcbInteractionGeometry.point(entry)
        )
        let inside = false
        for (
            let index = 0, previous = points.length - 1;
            index < points.length;
            previous = index++
        ) {
            const current = points[index]
            const before = points[previous]
            const intersects =
                current.y > point.y !== before.y > point.y &&
                point.x <
                    ((before.x - current.x) * (point.y - current.y)) /
                        (before.y - current.y || Number.EPSILON) +
                        current.x
            if (intersects) inside = !inside
        }

        return inside
    }
}
