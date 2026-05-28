// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds overlay fill cutouts from drilled pad and via metadata.
 */
export class PcbScene3dDrillCutoutBuilder {
    static #CIRCLE_SEGMENTS = 24
    static #SLOT_CAP_SEGMENTS = 12
    static #EPSILON = 0.001

    /**
     * Adds drill-shaped holes to every fill intersected by a pad or via drill.
     * @param {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][], x1?: number, y1?: number, x2?: number, y2?: number }[]} fills
     * @param {{ x?: number, y?: number, holeDiameter?: number, drillDiameter?: number, holeSlotLength?: number, slotLength?: number, rotation?: number, holeRotation?: number }[]} pads
     * @param {{ x?: number, y?: number, holeDiameter?: number, drillDiameter?: number }[]} vias
     * @returns {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][], x1?: number, y1?: number, x2?: number, y2?: number }[]}
     */
    static clipFills(fills, pads, vias) {
        const cutouts = PcbScene3dDrillCutoutBuilder.#buildCutouts(pads, vias)

        if (!cutouts.length) {
            return fills
        }

        return fills.map((fill) => {
            const holes = cutouts
                .filter((cutout) =>
                    PcbScene3dDrillCutoutBuilder.#cutoutTouchesFill(
                        cutout,
                        fill
                    )
                )
                .map((cutout) => cutout.points)

            if (!holes.length) {
                return fill
            }

            return {
                ...fill,
                holes: [
                    ...PcbScene3dDrillCutoutBuilder.#resolveExistingHoles(fill),
                    ...holes
                ]
            }
        })
    }

    /**
     * Builds all known drill cutout contours.
     * @param {{ x?: number, y?: number, holeDiameter?: number, drillDiameter?: number, holeSlotLength?: number, slotLength?: number, rotation?: number, holeRotation?: number }[]} pads
     * @param {{ x?: number, y?: number, holeDiameter?: number, drillDiameter?: number }[]} vias
     * @returns {{ x: number, y: number, bounds: { minX: number, minY: number, maxX: number, maxY: number }, points: { x: number, y: number }[] }[]}
     */
    static #buildCutouts(pads, vias) {
        return [
            ...PcbScene3dDrillCutoutBuilder.#buildPadCutouts(pads),
            ...PcbScene3dDrillCutoutBuilder.#buildViaCutouts(vias)
        ]
    }

    /**
     * Builds drill contours for drilled pads.
     * @param {{ x?: number, y?: number, holeDiameter?: number, drillDiameter?: number, holeSlotLength?: number, slotLength?: number, rotation?: number, holeRotation?: number }[]} pads
     * @returns {{ x: number, y: number, bounds: { minX: number, minY: number, maxX: number, maxY: number }, points: { x: number, y: number }[] }[]}
     */
    static #buildPadCutouts(pads) {
        return (Array.isArray(pads) ? pads : [])
            .map((pad) => {
                const x = Number(pad?.x)
                const y = Number(pad?.y)
                const diameter =
                    PcbScene3dDrillCutoutBuilder.#resolvePositiveNumber(pad, [
                        'holeDiameter',
                        'drillDiameter'
                    ])
                const slotLength =
                    PcbScene3dDrillCutoutBuilder.#resolvePositiveNumber(pad, [
                        'holeSlotLength',
                        'slotLength'
                    ])
                const rotationDeg =
                    Number(pad?.rotation || 0) + Number(pad?.holeRotation || 0)

                return PcbScene3dDrillCutoutBuilder.#buildCutout(
                    x,
                    y,
                    diameter,
                    slotLength,
                    rotationDeg
                )
            })
            .filter(Boolean)
    }

    /**
     * Builds circular drill contours for vias.
     * @param {{ x?: number, y?: number, holeDiameter?: number, drillDiameter?: number }[]} vias
     * @returns {{ x: number, y: number, bounds: { minX: number, minY: number, maxX: number, maxY: number }, points: { x: number, y: number }[] }[]}
     */
    static #buildViaCutouts(vias) {
        return (Array.isArray(vias) ? vias : [])
            .map((via) => {
                const x = Number(via?.x)
                const y = Number(via?.y)
                const diameter =
                    PcbScene3dDrillCutoutBuilder.#resolvePositiveNumber(via, [
                        'holeDiameter',
                        'drillDiameter'
                    ])

                return PcbScene3dDrillCutoutBuilder.#buildCutout(
                    x,
                    y,
                    diameter,
                    0,
                    0
                )
            })
            .filter(Boolean)
    }

    /**
     * Builds one drill contour from center, diameter, and optional slot length.
     * @param {number} x
     * @param {number} y
     * @param {number} diameter
     * @param {number} slotLength
     * @param {number} rotationDeg
     * @returns {{ x: number, y: number, bounds: { minX: number, minY: number, maxX: number, maxY: number }, points: { x: number, y: number }[] } | null}
     */
    static #buildCutout(x, y, diameter, slotLength, rotationDeg) {
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(diameter) ||
            diameter <= PcbScene3dDrillCutoutBuilder.#EPSILON
        ) {
            return null
        }

        const points =
            Number.isFinite(slotLength) && slotLength > diameter
                ? PcbScene3dDrillCutoutBuilder.#buildSlotPoints(
                      x,
                      y,
                      diameter,
                      slotLength,
                      rotationDeg
                  )
                : PcbScene3dDrillCutoutBuilder.#buildCirclePoints(
                      x,
                      y,
                      diameter
                  )

        return {
            x,
            y,
            points,
            bounds: PcbScene3dDrillCutoutBuilder.#resolvePointBounds(points)
        }
    }

    /**
     * Builds a polygonal circular drill contour.
     * @param {number} x
     * @param {number} y
     * @param {number} diameter
     * @returns {{ x: number, y: number }[]}
     */
    static #buildCirclePoints(x, y, diameter) {
        const radius = diameter / 2

        return Array.from(
            { length: PcbScene3dDrillCutoutBuilder.#CIRCLE_SEGMENTS },
            (_, index) => {
                const angle =
                    (Math.PI * 2 * index) /
                    PcbScene3dDrillCutoutBuilder.#CIRCLE_SEGMENTS

                return {
                    x: x + Math.cos(angle) * radius,
                    y: y + Math.sin(angle) * radius
                }
            }
        )
    }

    /**
     * Builds a polygonal slotted drill contour.
     * @param {number} x
     * @param {number} y
     * @param {number} diameter
     * @param {number} slotLength
     * @param {number} rotationDeg
     * @returns {{ x: number, y: number }[]}
     */
    static #buildSlotPoints(x, y, diameter, slotLength, rotationDeg) {
        const radius = diameter / 2
        const halfStraight = Math.max((slotLength - diameter) / 2, 0)
        const rotation = (rotationDeg * Math.PI) / 180
        const points = []

        for (
            let index = 0;
            index <= PcbScene3dDrillCutoutBuilder.#SLOT_CAP_SEGMENTS;
            index += 1
        ) {
            const angle =
                -Math.PI / 2 +
                (Math.PI * index) /
                    PcbScene3dDrillCutoutBuilder.#SLOT_CAP_SEGMENTS
            points.push(
                PcbScene3dDrillCutoutBuilder.#rotatePoint(
                    x,
                    y,
                    halfStraight + Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    rotation
                )
            )
        }

        for (
            let index = 0;
            index <= PcbScene3dDrillCutoutBuilder.#SLOT_CAP_SEGMENTS;
            index += 1
        ) {
            const angle =
                Math.PI / 2 +
                (Math.PI * index) /
                    PcbScene3dDrillCutoutBuilder.#SLOT_CAP_SEGMENTS
            points.push(
                PcbScene3dDrillCutoutBuilder.#rotatePoint(
                    x,
                    y,
                    -halfStraight + Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    rotation
                )
            )
        }

        return points
    }

    /**
     * Rotates one local point around a drill center.
     * @param {number} centerX
     * @param {number} centerY
     * @param {number} localX
     * @param {number} localY
     * @param {number} rotation
     * @returns {{ x: number, y: number }}
     */
    static #rotatePoint(centerX, centerY, localX, localY, rotation) {
        const cos = Math.cos(rotation)
        const sin = Math.sin(rotation)

        return {
            x: centerX + localX * cos - localY * sin,
            y: centerY + localX * sin + localY * cos
        }
    }

    /**
     * Returns true when a drill contour should cut one fill.
     * @param {{ x: number, y: number, bounds: { minX: number, minY: number, maxX: number, maxY: number }, points: { x: number, y: number }[] }} cutout
     * @param {{ points?: { x: number, y: number }[], x1?: number, y1?: number, x2?: number, y2?: number }} fill
     * @returns {boolean}
     */
    static #cutoutTouchesFill(cutout, fill) {
        const fillBounds = PcbScene3dDrillCutoutBuilder.#resolveFillBounds(fill)

        if (
            !fillBounds ||
            !PcbScene3dDrillCutoutBuilder.#boundsOverlap(
                cutout.bounds,
                fillBounds
            )
        ) {
            return false
        }

        const fillPoints = PcbScene3dDrillCutoutBuilder.#resolveFillPoints(fill)
        if (fillPoints.length < 3) {
            return true
        }

        return (
            PcbScene3dDrillCutoutBuilder.#isPointInPolygon(
                cutout,
                fillPoints
            ) ||
            cutout.points.some((point) =>
                PcbScene3dDrillCutoutBuilder.#isPointInPolygon(
                    point,
                    fillPoints
                )
            )
        )
    }

    /**
     * Resolves existing authored holes from a fill.
     * @param {{ holes?: { x: number, y: number }[][] }} fill
     * @returns {{ x: number, y: number }[][]}
     */
    static #resolveExistingHoles(fill) {
        return Array.isArray(fill?.holes)
            ? fill.holes.filter((hole) => Array.isArray(hole))
            : []
    }

    /**
     * Resolves finite polygon points from a fill.
     * @param {{ points?: { x: number, y: number }[] }} fill
     * @returns {{ x: number, y: number }[]}
     */
    static #resolveFillPoints(fill) {
        return (Array.isArray(fill?.points) ? fill.points : [])
            .map((point) => ({
                x: Number(point?.x),
                y: Number(point?.y)
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
    }

    /**
     * Resolves one fill's bounds.
     * @param {{ points?: { x: number, y: number }[], x1?: number, y1?: number, x2?: number, y2?: number }} fill
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveFillBounds(fill) {
        const points = PcbScene3dDrillCutoutBuilder.#resolveFillPoints(fill)

        if (points.length) {
            return PcbScene3dDrillCutoutBuilder.#resolvePointBounds(points)
        }

        const x1 = Number(fill?.x1)
        const y1 = Number(fill?.y1)
        const x2 = Number(fill?.x2)
        const y2 = Number(fill?.y2)

        if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2)
        ) {
            return null
        }

        return {
            minX: Math.min(x1, x2),
            minY: Math.min(y1, y2),
            maxX: Math.max(x1, x2),
            maxY: Math.max(y1, y2)
        }
    }

    /**
     * Resolves bounds for a point list.
     * @param {{ x: number, y: number }[]} points
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #resolvePointBounds(points) {
        return points.reduce(
            (bounds, point) => ({
                minX: Math.min(bounds.minX, point.x),
                minY: Math.min(bounds.minY, point.y),
                maxX: Math.max(bounds.maxX, point.x),
                maxY: Math.max(bounds.maxY, point.y)
            }),
            {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            }
        )
    }

    /**
     * Returns true when two axis-aligned boxes overlap.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} a
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} b
     * @returns {boolean}
     */
    static #boundsOverlap(a, b) {
        return (
            a.minX <= b.maxX &&
            a.maxX >= b.minX &&
            a.minY <= b.maxY &&
            a.maxY >= b.minY
        )
    }

    /**
     * Returns true when a point lies inside a polygon.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} polygon
     * @returns {boolean}
     */
    static #isPointInPolygon(point, polygon) {
        let inside = false

        for (
            let index = 0, previousIndex = polygon.length - 1;
            index < polygon.length;
            previousIndex = index, index += 1
        ) {
            const current = polygon[index]
            const previous = polygon[previousIndex]
            const intersects =
                current.y > point.y !== previous.y > point.y &&
                point.x <
                    ((previous.x - current.x) * (point.y - current.y)) /
                        (previous.y - current.y) +
                        current.x

            if (intersects) {
                inside = !inside
            }
        }

        return inside
    }

    /**
     * Resolves the first positive numeric field from an object.
     * @param {Record<string, unknown>} source
     * @param {string[]} keys
     * @returns {number}
     */
    static #resolvePositiveNumber(source, keys) {
        for (const key of keys) {
            const value = Number(source?.[key])

            if (Number.isFinite(value) && value > 0) {
                return value
            }
        }

        return 0
    }
}
