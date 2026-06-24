// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves procedural body yaw from owned PCB pad geometry.
 */
export class PcbScene3dPadYawResolver {
    static #DOMINANT_AXIS_RATIO = 1.25
    static #EPSILON = 1e-9

    /**
     * Resolves a component yaw from its owned pad-center distribution.
     * @param {{ componentIndex?: number, rotation?: number }} component Source component.
     * @param {object[]} pads Source PCB pads.
     * @param {'top' | 'bottom' | string} [mountSide] Component mount side.
     * @returns {number | null}
     */
    static resolve(component, pads, mountSide = 'top') {
        const points = PcbScene3dPadYawResolver.#ownedPadCenters(
            component,
            pads,
            mountSide
        )
        if (points.length < 2) {
            return null
        }

        const axis = PcbScene3dPadYawResolver.#dominantAxis(points)
        if (axis === null) {
            return null
        }

        return PcbScene3dPadYawResolver.#closestHalfTurnEquivalent(
            axis,
            Number(component?.rotation || 0)
        )
    }

    /**
     * Resolves finite owned pad centers, preferring mounted-surface pads.
     * @param {{ componentIndex?: number }} component Source component.
     * @param {object[]} pads Source PCB pads.
     * @param {'top' | 'bottom' | string} mountSide Component mount side.
     * @returns {{ x: number, y: number }[]}
     */
    static #ownedPadCenters(component, pads, mountSide) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex) || !Array.isArray(pads)) {
            return []
        }

        const ownedPads = pads.filter(
            (pad) => Number(pad?.componentIndex) === componentIndex
        )
        const surfacePads = ownedPads.filter((pad) =>
            PcbScene3dPadYawResolver.#isSurfacePad(pad, mountSide)
        )
        const yawPads = surfacePads.length ? surfacePads : ownedPads

        return yawPads
            .map((pad) => PcbScene3dPadYawResolver.#padCenter(pad))
            .filter(Boolean)
    }

    /**
     * Checks whether one pad belongs to the mounted paste-mask side.
     * @param {object} pad Source pad.
     * @param {'top' | 'bottom' | string} mountSide Component mount side.
     * @returns {boolean}
     */
    static #isSurfacePad(pad, mountSide) {
        return String(mountSide || '').toLowerCase() === 'bottom'
            ? Boolean(pad?.hasBottomPasteMaskOpening)
            : Boolean(pad?.hasTopPasteMaskOpening)
    }

    /**
     * Resolves one finite pad center.
     * @param {{ x?: number, y?: number }} pad Source pad.
     * @returns {{ x: number, y: number } | null}
     */
    static #padCenter(pad) {
        const x = Number(pad?.x)
        const y = Number(pad?.y)

        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Resolves a dominant pad-center axis, modulo 180 degrees.
     * @param {{ x: number, y: number }[]} points Pad centers.
     * @returns {number | null}
     */
    static #dominantAxis(points) {
        const mean = PcbScene3dPadYawResolver.#meanPoint(points)
        let xx = 0
        let xy = 0
        let yy = 0

        for (const point of points) {
            const dx = point.x - mean.x
            const dy = point.y - mean.y
            xx += dx * dx
            xy += dx * dy
            yy += dy * dy
        }

        xx /= points.length
        xy /= points.length
        yy /= points.length

        const trace = xx + yy
        const discriminant = Math.sqrt((xx - yy) ** 2 + 4 * xy * xy)
        const primary = (trace + discriminant) / 2
        const secondary = (trace - discriminant) / 2

        if (
            primary <= PcbScene3dPadYawResolver.#EPSILON ||
            (secondary > PcbScene3dPadYawResolver.#EPSILON &&
                primary / secondary <
                    PcbScene3dPadYawResolver.#DOMINANT_AXIS_RATIO)
        ) {
            return null
        }

        return PcbScene3dPadYawResolver.#normalizeHalfTurn(
            (Math.atan2(2 * xy, xx - yy) * 90) / Math.PI
        )
    }

    /**
     * Resolves the mean point for a non-empty point set.
     * @param {{ x: number, y: number }[]} points Pad centers.
     * @returns {{ x: number, y: number }}
     */
    static #meanPoint(points) {
        const sum = points.reduce(
            (accumulator, point) => ({
                x: accumulator.x + point.x,
                y: accumulator.y + point.y
            }),
            { x: 0, y: 0 }
        )

        return {
            x: sum.x / points.length,
            y: sum.y / points.length
        }
    }

    /**
     * Selects the 180-degree equivalent closest to the source rotation.
     * @param {number} axis Dominant axis in degrees.
     * @param {number} sourceRotation Source component rotation.
     * @returns {number}
     */
    static #closestHalfTurnEquivalent(axis, sourceRotation) {
        const first = PcbScene3dPadYawResolver.#normalizeAngle(axis)
        const second = PcbScene3dPadYawResolver.#normalizeAngle(axis + 180)
        const source = PcbScene3dPadYawResolver.#normalizeAngle(sourceRotation)

        return PcbScene3dPadYawResolver.#angularDistance(first, source) <=
            PcbScene3dPadYawResolver.#angularDistance(second, source)
            ? first
            : second
    }

    /**
     * Resolves the smallest angular distance between two directions.
     * @param {number} left First angle.
     * @param {number} right Second angle.
     * @returns {number}
     */
    static #angularDistance(left, right) {
        const distance = Math.abs(
            PcbScene3dPadYawResolver.#normalizeAngle(left - right)
        )

        return distance > 180 ? 360 - distance : distance
    }

    /**
     * Normalizes an angle to 0 inclusive through 180 exclusive.
     * @param {number} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeHalfTurn(angle) {
        return ((Number(angle || 0) % 180) + 180) % 180
    }

    /**
     * Normalizes an angle to 0 inclusive through 360 exclusive.
     * @param {number} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        return ((Number(angle || 0) % 360) + 360) % 360
    }
}
