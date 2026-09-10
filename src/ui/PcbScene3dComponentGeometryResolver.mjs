// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dPadLocalSpanResolver } from './PcbScene3dPadLocalSpanResolver.mjs'
import { PcbScene3dPadYawResolver } from './PcbScene3dPadYawResolver.mjs'

/** Resolves footprint geometry with indexes scoped to one scene build. */
export class PcbScene3dComponentGeometryResolver {
    #components
    #pads
    #ownedPads = new Map()
    #surfacePads = new Map()
    #drilledCandidates = null

    /**
     * Indexes pad ownership once, retaining source order and numeric coercion.
     * @param {object[]} components Source components.
     * @param {object[]} pads Source pads.
     */
    constructor(components, pads) {
        this.#components = components
        this.#pads = pads
        for (const pad of pads) {
            const index = Number(pad?.componentIndex)
            if (!Number.isFinite(index)) continue
            const owned = this.#ownedPads.get(index) || []
            owned.push(pad)
            this.#ownedPads.set(index, owned)
        }
    }

    /**
     * Returns owned pads, preferring the mounted paste-mask surface.
     * @param {object | null} component Source component.
     * @param {string} [mountSide] Mounted surface override.
     * @returns {object[]}
     */
    componentPads(
        component,
        mountSide = PcbScene3dComponentGeometryResolver.#mountSide(component)
    ) {
        const index = Number(component?.componentIndex)
        if (!Number.isFinite(index)) return []
        const side =
            String(mountSide || '').toLowerCase() === 'bottom'
                ? 'bottom'
                : 'top'
        const key = `${index}:${side}`
        if (!this.#surfacePads.has(key)) {
            const owned = this.#ownedPads.get(index) || []
            const surface = owned.filter((pad) =>
                side === 'bottom'
                    ? Boolean(pad?.hasBottomPasteMaskOpening)
                    : Boolean(pad?.hasTopPasteMaskOpening)
            )
            this.#surfacePads.set(key, surface.length ? surface : owned)
        }
        return this.#surfacePads.get(key)
    }

    /**
     * Resolves a footprint-local span, searching nearby pads only if unowned.
     * @param {object} component Source component.
     * @param {number} rotationDeg Visible rotation.
     * @returns {{ width: number, depth: number }}
     */
    resolvePadSpan(component, rotationDeg = Number(component?.rotation || 0)) {
        const owned = this.componentPads(component)
        const pads = owned.length
            ? owned
            : this.#pads.filter(
                  (pad) =>
                      Math.abs(Number(pad.x || 0) - Number(component.x || 0)) <=
                          160 &&
                      Math.abs(Number(pad.y || 0) - Number(component.y || 0)) <=
                          160
              )
        if (!pads.length) return { width: 0, depth: 0 }
        return (
            PcbScene3dPadLocalSpanResolver.resolve(
                { ...component, rotation: rotationDeg },
                pads,
                PcbScene3dComponentGeometryResolver.#mountSide(component)
            ) || { width: 0, depth: 0 }
        )
    }

    /**
     * Resolves visible yaw from the owning footprint's pad centers.
     * @param {object} component Source component.
     * @param {string} mountSide Mounted surface.
     * @returns {number}
     */
    resolveComponentRotation(component, mountSide) {
        return (
            PcbScene3dPadYawResolver.resolve(
                component,
                this.componentPads(component),
                mountSide
            ) ?? Number(component?.rotation || 0)
        )
    }

    /**
     * Checks for drilled pads after mounted-surface preference is applied.
     * @param {object | null} component Source component.
     * @returns {boolean}
     */
    componentHasThroughHolePads(component) {
        return this.componentPads(component).some((pad) =>
            PcbScene3dComponentGeometryResolver.hasDrilledPadOpening(pad)
        )
    }

    /**
     * Resolves a body owner from drilled-pad anchor areas, preserving ties in
     * component and pad source order.
     * @param {object | null | undefined} sourcePosition Body anchor.
     * @returns {object | null}
     */
    resolveComponentFromOwnedDrilledPad(sourcePosition) {
        const x = Number(sourcePosition?.x)
        const y = Number(sourcePosition?.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        this.#drilledCandidates ??= this.#buildDrilledCandidates()
        const matches = []
        for (const candidate of this.#drilledCandidates) {
            const padDistance = Math.max(
                0,
                Math.hypot(candidate.x - x, candidate.y - y) - candidate.radius
            )
            if (!(padDistance <= 1)) continue
            matches.push({
                component: candidate.component,
                padDistance,
                componentDistance: Math.hypot(
                    Number(candidate.component?.x || 0) - x,
                    Number(candidate.component?.y || 0) - y
                )
            })
        }
        matches.sort(
            (left, right) =>
                left.padDistance - right.padDistance ||
                left.componentDistance - right.componentDistance
        )
        return matches[0]?.component || null
    }

    /**
     * Prepares drill anchor geometry once when owner recovery first needs it.
     * @returns {object[]}
     */
    #buildDrilledCandidates() {
        const candidates = []
        for (const component of this.#components) {
            for (const pad of this.componentPads(component)) {
                if (
                    !PcbScene3dComponentGeometryResolver.hasDrilledPadOpening(
                        pad
                    )
                )
                    continue
                const radius =
                    PcbScene3dComponentGeometryResolver.#padAnchorRadiusMil(pad)
                if (radius <= 0) continue
                candidates.push({
                    component,
                    radius,
                    x: Number(pad?.x || 0),
                    y: Number(pad?.y || 0)
                })
            }
        }
        return candidates
    }

    /**
     * Measures distance to a drilled pad's effective anchor area.
     * @param {object} point Body anchor.
     * @param {object} pad Source pad.
     * @returns {number}
     */
    static distanceToPadAnchor(point, pad) {
        const distance = Math.hypot(
            Number(pad?.x || 0) - Number(point.x || 0),
            Number(pad?.y || 0) - Number(point.y || 0)
        )
        const radius =
            PcbScene3dComponentGeometryResolver.#padAnchorRadiusMil(pad)
        return radius > 0 ? Math.max(0, distance - radius) : Infinity
    }

    /**
     * Checks for drilled or slotted board openings.
     * @param {object} pad Source pad.
     * @returns {boolean}
     */
    static hasDrilledPadOpening(pad) {
        const hole = pad?.holeGeometry || {}
        return [
            pad?.holeDiameter,
            pad?.drillDiameter,
            pad?.holeSlotLength,
            pad?.slotLength,
            hole?.diameter,
            hole?.length,
            hole?.slotLength
        ].some((value) => Number(value || 0) > 0)
    }

    /**
     * Resolves the effective radius including copper and slot extents.
     * @param {object} pad Source pad.
     * @returns {number}
     */
    static #padAnchorRadiusMil(pad) {
        const hole = pad?.holeGeometry || {}
        const diameter = Math.max(
            ...[
                pad?.sizeTopX,
                pad?.sizeTopY,
                pad?.sizeMidX,
                pad?.sizeMidY,
                pad?.sizeBottomX,
                pad?.sizeBottomY,
                pad?.holeDiameter,
                pad?.drillDiameter,
                pad?.holeSlotLength,
                pad?.slotLength,
                hole?.diameter,
                hole?.length,
                hole?.slotLength
            ].map((value) => Number(value || 0))
        )
        return Number.isFinite(diameter) && diameter > 0 ? diameter / 2 : 0
    }

    /**
     * Resolves the scene builder's canonical component surface.
     * @param {object | null} component Source component.
     * @returns {'top' | 'bottom'}
     */
    static #mountSide(component) {
        return String(component?.layer || 'TOP').toUpperCase() === 'BOTTOM'
            ? 'bottom'
            : 'top'
    }
}
