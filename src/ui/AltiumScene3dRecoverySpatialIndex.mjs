// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds compact reusable indexes for late Altium 3D owner recovery.
 */
export class AltiumScene3dRecoverySpatialIndex {
    /**
     * Groups source pads by numeric component owner.
     * @param {object[]} pads Source PCB pads.
     * @returns {Map<number, object[]>}
     */
    static padsByComponent(pads) {
        const index = new Map()
        for (const pad of pads) {
            const componentIndex = Number(pad?.componentIndex)
            if (!Number.isFinite(componentIndex)) continue
            index.set(componentIndex, [
                ...(index.get(componentIndex) || []),
                pad
            ])
        }
        return index
    }

    /**
     * Indexes arbitrary values by a point selected from each value.
     * @param {object[]} values Values to index.
     * @param {number} cellSize Bucket size.
     * @param {(value: object) => object} pointSelector Point selector.
     * @returns {Map<string, object[]>}
     */
    static create(values, cellSize, pointSelector) {
        const index = new Map()
        for (const value of values) {
            const point = pointSelector(value)
            const x = Number(point?.x)
            const y = Number(point?.y)
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue
            const key = AltiumScene3dRecoverySpatialIndex.#key(
                Math.floor(x / cellSize),
                Math.floor(y / cellSize)
            )
            index.set(key, [...(index.get(key) || []), value])
        }
        return index
    }

    /**
     * Reads values from square neighboring spatial buckets.
     * @param {Map<string, object[]>} index Spatial index.
     * @param {object} point Query point.
     * @param {number} cellSize Bucket size.
     * @param {number} radiusCells Query radius in buckets.
     * @returns {object[]}
     */
    static nearby(index, point, cellSize, radiusCells) {
        const centerX = Math.floor(Number(point?.x) / cellSize)
        const centerY = Math.floor(Number(point?.y) / cellSize)
        if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return []
        const values = []
        for (
            let x = centerX - radiusCells;
            x <= centerX + radiusCells;
            x += 1
        ) {
            for (
                let y = centerY - radiusCells;
                y <= centerY + radiusCells;
                y += 1
            ) {
                values.push(
                    ...(index.get(
                        AltiumScene3dRecoverySpatialIndex.#key(x, y)
                    ) || [])
                )
            }
        }
        return values
    }

    /**
     * Builds a stable spatial bucket key.
     * @param {number} x X bucket.
     * @param {number} y Y bucket.
     * @returns {string}
     */
    static #key(x, y) {
        return `${x}:${y}`
    }
}

Object.freeze(AltiumScene3dRecoverySpatialIndex.prototype)
Object.freeze(AltiumScene3dRecoverySpatialIndex)
