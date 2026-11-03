// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Measures PCB coordinate collections without expanding them into arguments.
 */
export class PcbCoordinateBounds {
    /**
     * Computes an axis range using constant call-stack space.
     * @param {Iterable<number>} values Coordinates.
     * @returns {{ min: number, max: number }}
     */
    static range(values) {
        let min = Infinity
        let max = -Infinity
        for (const value of values) {
            // Fixed-arity calls preserve Math's NaN and signed-zero behavior.
            min = Math.min(min, value)
            max = Math.max(max, value)
        }
        return { min, max }
    }

    /**
     * Computes bounds from independent coordinate collections.
     * @param {Iterable<number>} xs X coordinates.
     * @param {Iterable<number>} ys Y coordinates.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static fromAxes(xs, ys) {
        const x = PcbCoordinateBounds.range(xs)
        const y = PcbCoordinateBounds.range(ys)
        return { minX: x.min, minY: y.min, maxX: x.max, maxY: y.max }
    }

    /**
     * Computes bounds from points without allocating coordinate arrays.
     * @param {Iterable<{ x: number, y: number }>} points Coordinates.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static fromPoints(points) {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const point of points) {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
        }
        return { minX, minY, maxX, maxY }
    }
}
