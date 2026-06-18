// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves pad bounds in component-local axes for 3D procedural bodies.
 */
export class PcbScene3dPadLocalSpanResolver {
    /**
     * Measures a set of pads after rotating their corners into the component's
     * local coordinate frame.
     * @param {{ x?: number, y?: number, rotation?: number }} component Source component.
     * @param {object[]} pads Pads to measure.
     * @param {'top' | 'bottom'} mountSide Component mount side.
     * @returns {{ width: number, depth: number } | null}
     */
    static resolve(component, pads, mountSide = 'top') {
        if (!Array.isArray(pads) || !pads.length) {
            return null
        }

        const originX = Number(component?.x || 0)
        const originY = Number(component?.y || 0)
        const componentRadians =
            (-Number(component?.rotation || 0) * Math.PI) / 180
        const componentCos = Math.cos(componentRadians)
        const componentSin = Math.sin(componentRadians)
        const xs = []
        const ys = []

        for (const pad of pads) {
            for (const point of PcbScene3dPadLocalSpanResolver.#padCorners(
                pad,
                mountSide
            )) {
                const relativeX = point.x - originX
                const relativeY = point.y - originY
                xs.push(relativeX * componentCos - relativeY * componentSin)
                ys.push(relativeX * componentSin + relativeY * componentCos)
            }
        }

        const width = PcbScene3dPadLocalSpanResolver.#roundMil(
            Math.max(...xs) - Math.min(...xs)
        )
        const depth = PcbScene3dPadLocalSpanResolver.#roundMil(
            Math.max(...ys) - Math.min(...ys)
        )

        return width > 0 && depth > 0 ? { width, depth } : null
    }

    /**
     * Rounds tiny trigonometric floating-point noise while preserving mil detail.
     * @param {number} value Raw mil value.
     * @returns {number}
     */
    static #roundMil(value) {
        return Math.round(Number(value || 0) * 1000000) / 1000000
    }

    /**
     * Builds the visible world-space corners of one rectangular pad.
     * @param {object} pad Source pad.
     * @param {'top' | 'bottom'} mountSide Component mount side.
     * @returns {{ x: number, y: number }[]}
     */
    static #padCorners(pad, mountSide) {
        const size = PcbScene3dPadLocalSpanResolver.#padSize(pad, mountSide)
        const halfWidth = size.width / 2
        const halfDepth = size.depth / 2
        const radians = (Number(pad?.rotation || 0) * Math.PI) / 180
        const cos = Math.cos(radians)
        const sin = Math.sin(radians)
        const centerX = Number(pad?.x || 0)
        const centerY = Number(pad?.y || 0)

        return [
            { x: -halfWidth, y: -halfDepth },
            { x: halfWidth, y: -halfDepth },
            { x: halfWidth, y: halfDepth },
            { x: -halfWidth, y: halfDepth }
        ].map((point) => ({
            x: centerX + point.x * cos - point.y * sin,
            y: centerY + point.x * sin + point.y * cos
        }))
    }

    /**
     * Resolves a pad's visible size on the component side.
     * @param {object} pad Source pad.
     * @param {'top' | 'bottom'} mountSide Component mount side.
     * @returns {{ width: number, depth: number }}
     */
    static #padSize(pad, mountSide) {
        const bottom = String(mountSide || '').toLowerCase() === 'bottom'
        const width = bottom
            ? pad?.sizeBottomX || pad?.sizeMidX || pad?.sizeTopX
            : pad?.sizeTopX || pad?.sizeMidX || pad?.sizeBottomX
        const depth = bottom
            ? pad?.sizeBottomY || pad?.sizeMidY || pad?.sizeTopY
            : pad?.sizeTopY || pad?.sizeMidY || pad?.sizeBottomY

        return {
            width: Number(width || 24) || 24,
            depth: Number(depth || 24) || 24
        }
    }
}
