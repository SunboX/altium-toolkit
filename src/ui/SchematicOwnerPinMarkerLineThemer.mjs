// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const COMPACT_PIN_MAX_LENGTH = 15
const MARKER_LINE_BASE_TOLERANCE = 6
const MARKER_LINE_BASE_MAX_LENGTH = 8
const MARKER_LINE_COLOR = 'var(--schematic-accent-ink-color)'

/**
 * Normalizes compact owner-authored marker strokes around hidden pin stubs.
 */
export class SchematicOwnerPinMarkerLineThemer {
    /**
     * Applies schematic pin color to compact owner marker strokes.
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number, color?: string, ownerIndex?: string }[]} lines Line primitives.
     * @param {{ x?: number, y?: number, length?: number, name?: string, designator?: string, electrical?: number, ownerIndex?: string }[]} pins Pin primitives.
     * @returns {{ x1?: number, y1?: number, x2?: number, y2?: number, color?: string, ownerIndex?: string }[]}
     */
    static theme(lines, pins) {
        const anchorsByOwner =
            SchematicOwnerPinMarkerLineThemer.#buildCompactPinAnchors(pins)

        if (anchorsByOwner.size === 0) {
            return lines || []
        }

        return (lines || []).map((line) =>
            SchematicOwnerPinMarkerLineThemer.#isCompactMarkerLine(
                line,
                anchorsByOwner
            )
                ? { ...line, color: MARKER_LINE_COLOR }
                : line
        )
    }

    /**
     * Builds lookup anchors for compact unnamed owner pins.
     * @param {{ x?: number, y?: number, length?: number, name?: string, designator?: string, electrical?: number, ownerIndex?: string }[]} pins Pin primitives.
     * @returns {Map<string, { x: number, y: number, tolerance: number, maxLineLength: number }[]>}
     */
    static #buildCompactPinAnchors(pins) {
        const anchorsByOwner = new Map()

        for (const pin of pins || []) {
            if (!SchematicOwnerPinMarkerLineThemer.#isCompactMarkerPin(pin)) {
                continue
            }

            const ownerIndex = String(pin.ownerIndex || '').trim()
            const length = Math.abs(Number(pin.length || 0))
            const anchor = {
                x: Number(pin.x),
                y: Number(pin.y),
                tolerance: Math.max(MARKER_LINE_BASE_TOLERANCE, length * 0.6),
                maxLineLength: Math.max(
                    MARKER_LINE_BASE_MAX_LENGTH,
                    length * 0.8
                )
            }

            if (!anchorsByOwner.has(ownerIndex)) {
                anchorsByOwner.set(ownerIndex, [])
            }
            anchorsByOwner.get(ownerIndex).push(anchor)
        }

        return anchorsByOwner
    }

    /**
     * Returns true for compact unnamed owner pins that are marker anchors.
     * @param {{ x?: number, y?: number, length?: number, name?: string, designator?: string, electrical?: number, ownerIndex?: string } | null | undefined} pin Pin primitive.
     * @returns {boolean}
     */
    static #isCompactMarkerPin(pin) {
        const ownerIndex = String(pin?.ownerIndex || '').trim()
        const name = String(pin?.name || '').trim()
        const designator = String(pin?.designator || '').trim()
        const length = Math.abs(Number(pin?.length || 0))
        const electrical = Number(pin?.electrical)
        const x = Number(pin?.x)
        const y = Number(pin?.y)

        return (
            Boolean(ownerIndex) &&
            !name &&
            /^\d+$/.test(designator) &&
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            length > 0 &&
            length <= COMPACT_PIN_MAX_LENGTH &&
            (!Number.isFinite(electrical) || electrical === 4)
        )
    }

    /**
     * Returns true when one owner line is compact marker linework near a pin.
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number, ownerIndex?: string } | null | undefined} line Line primitive.
     * @param {Map<string, { x: number, y: number, tolerance: number, maxLineLength: number }[]>} anchorsByOwner Marker anchors by owner.
     * @returns {boolean}
     */
    static #isCompactMarkerLine(line, anchorsByOwner) {
        const ownerIndex = String(line?.ownerIndex || '').trim()
        const anchors = anchorsByOwner.get(ownerIndex)

        if (!anchors?.length) {
            return false
        }

        const pointA = {
            x: Number(line?.x1),
            y: Number(line?.y1)
        }
        const pointB = {
            x: Number(line?.x2),
            y: Number(line?.y2)
        }

        if (
            !Number.isFinite(pointA.x) ||
            !Number.isFinite(pointA.y) ||
            !Number.isFinite(pointB.x) ||
            !Number.isFinite(pointB.y)
        ) {
            return false
        }

        const lineLength = SchematicOwnerPinMarkerLineThemer.#distance(
            pointA,
            pointB
        )

        return anchors.some(
            (anchor) =>
                lineLength > 0 &&
                lineLength <= anchor.maxLineLength &&
                SchematicOwnerPinMarkerLineThemer.#distance(pointA, anchor) <=
                    anchor.tolerance &&
                SchematicOwnerPinMarkerLineThemer.#distance(pointB, anchor) <=
                    anchor.tolerance
        )
    }

    /**
     * Measures planar distance between two schematic points.
     * @param {{ x: number, y: number }} pointA First point.
     * @param {{ x: number, y: number }} pointB Second point.
     * @returns {number}
     */
    static #distance(pointA, pointB) {
        return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y)
    }
}
