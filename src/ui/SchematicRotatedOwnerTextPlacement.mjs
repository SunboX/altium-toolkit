// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Places vertical owner annotations in columns clear of narrow symbol bodies.
 */
export class SchematicRotatedOwnerTextPlacement {
    /**
     * Resolves the horizontal baseline for one rotated owner annotation.
     * @param {{ ownerIndex?: string, rotation?: number }} text
     * @param {number} sourceX
     * @param {number} fontSize
     * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} ownerBodyBounds
     * @returns {number}
     */
    static resolveX(text, sourceX, fontSize, ownerBodyBounds) {
        const numericX = Number(sourceX)
        const numericFontSize = Number(fontSize)
        const ownerIndex = String(text?.ownerIndex || '').trim()
        const rotation = SchematicRotatedOwnerTextPlacement.#normalizeDegrees(
            text?.rotation
        )

        if (
            !ownerIndex ||
            (rotation !== 90 && rotation !== 270) ||
            !Number.isFinite(numericX) ||
            !Number.isFinite(numericFontSize) ||
            numericFontSize <= 0
        ) {
            return numericX
        }

        const bounds = ownerBodyBounds.get(ownerIndex)
        if (!bounds || numericX < Number(bounds.maxX)) {
            return numericX
        }

        return numericX + numericFontSize
    }

    /**
     * Normalizes a source angle to the positive 0-359 degree range.
     * @param {number | undefined} value
     * @returns {number}
     */
    static #normalizeDegrees(value) {
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue)) return 0

        return ((numericValue % 360) + 360) % 360
    }
}
