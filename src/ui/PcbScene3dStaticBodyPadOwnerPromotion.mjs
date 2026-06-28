// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Promotes compact static bodies that sit exactly on component-owned pads.
 */
export class PcbScene3dStaticBodyPadOwnerPromotion {
    static #PAD_OWNER_DISTANCE_MIL = 5
    static #PAD_OWNER_AMBIGUITY_MARGIN_MIL = 0.25
    static #COMPACT_BODY_MAX_SPAN_MIL = 40
    static #AUTHORED_MECHANICAL_TOKENS = new Set([
        'can',
        'clip',
        'cover',
        'enclosure',
        'frame',
        'hardware',
        'leg',
        'mechanical',
        'plate',
        'shield'
    ])

    /**
     * Applies exact pad ownership to mutable static placement rows.
     * @param {{ placement: object, matchedComponent: object | null }[]} placementRows Mutable placement rows.
     * @param {{ componentIndex?: number, designator?: string, layer?: string }[]} components PCB components.
     * @param {{ componentIndex?: number, x?: number, y?: number, hasTopPasteMaskOpening?: boolean, hasBottomPasteMaskOpening?: boolean }[]} pads PCB pads.
     * @returns {void}
     */
    static promote(placementRows, components = [], pads = []) {
        const componentByIndex =
            PcbScene3dStaticBodyPadOwnerPromotion.#componentByIndex(components)

        placementRows.forEach((row) => {
            if (!PcbScene3dStaticBodyPadOwnerPromotion.#canPromoteRow(row)) {
                return
            }

            const owner =
                PcbScene3dStaticBodyPadOwnerPromotion.#padOwnerForPlacement(
                    row.placement,
                    componentByIndex,
                    pads
                )
            if (!owner) {
                return
            }

            row.matchedComponent = owner
            row.placement = PcbScene3dStaticBodyPadOwnerPromotion.#withOwner(
                row.placement,
                owner
            )
        })
    }

    /**
     * Builds a component-index lookup.
     * @param {object[]} components PCB components.
     * @returns {Map<number, object>}
     */
    static #componentByIndex(components) {
        const componentByIndex = new Map()

        ;(Array.isArray(components) ? components : []).forEach((component) => {
            const componentIndex = Number(component?.componentIndex)
            if (
                Number.isInteger(componentIndex) &&
                String(component?.designator || '').trim()
            ) {
                componentByIndex.set(componentIndex, component)
            }
        })

        return componentByIndex
    }

    /**
     * Checks whether one static row is eligible for exact pad ownership.
     * @param {{ placement?: object } | null} row Static placement row.
     * @returns {boolean}
     */
    static #canPromoteRow(row) {
        const placement = row?.placement

        return (
            placement &&
            !placement.ownerLocked &&
            !PcbScene3dStaticBodyPadOwnerPromotion.#hasAuthoredMechanicalIdentity(
                placement
            ) &&
            PcbScene3dStaticBodyPadOwnerPromotion.#maxSpan(
                placement.geometry
            ) <=
                PcbScene3dStaticBodyPadOwnerPromotion.#COMPACT_BODY_MAX_SPAN_MIL
        )
    }

    /**
     * Resolves the unique component whose surface pad owns a body anchor.
     * @param {{ bodyPositionMil?: { x?: number, y?: number } }} placement Static placement.
     * @param {Map<number, object>} componentByIndex Component lookup.
     * @param {object[]} pads PCB pads.
     * @returns {object | null}
     */
    static #padOwnerForPlacement(placement, componentByIndex, pads) {
        const position =
            PcbScene3dStaticBodyPadOwnerPromotion.#bodyPosition(placement)
        if (!position) {
            return null
        }

        const candidates = (Array.isArray(pads) ? pads : [])
            .map((pad) =>
                PcbScene3dStaticBodyPadOwnerPromotion.#padOwnerCandidate(
                    pad,
                    position,
                    componentByIndex
                )
            )
            .filter(Boolean)
            .sort((left, right) => left.distance - right.distance)

        return PcbScene3dStaticBodyPadOwnerPromotion.#unambiguousOwner(
            candidates
        )
    }

    /**
     * Builds one exact pad-owner candidate.
     * @param {object} pad PCB pad.
     * @param {{ x: number, y: number }} position Body source position.
     * @param {Map<number, object>} componentByIndex Component lookup.
     * @returns {{ component: object, distance: number } | null}
     */
    static #padOwnerCandidate(pad, position, componentByIndex) {
        const component = componentByIndex.get(Number(pad?.componentIndex))
        if (
            !component ||
            !PcbScene3dStaticBodyPadOwnerPromotion.#isSurfacePadForComponent(
                pad,
                component
            )
        ) {
            return null
        }

        const distance = Math.hypot(
            Number(pad?.x || 0) - position.x,
            Number(pad?.y || 0) - position.y
        )

        return Number.isFinite(distance) &&
            distance <=
                PcbScene3dStaticBodyPadOwnerPromotion.#PAD_OWNER_DISTANCE_MIL
            ? { component, distance }
            : null
    }

    /**
     * Resolves an unambiguous owner from pad-distance candidates.
     * @param {{ component: object, distance: number }[]} candidates Candidates.
     * @returns {object | null}
     */
    static #unambiguousOwner(candidates) {
        const nearest = candidates[0]
        if (!nearest) {
            return null
        }

        const nextDifferentOwner = candidates.find(
            (candidate) =>
                String(candidate.component?.designator || '') !==
                String(nearest.component?.designator || '')
        )

        return nextDifferentOwner &&
            nextDifferentOwner.distance - nearest.distance <=
                PcbScene3dStaticBodyPadOwnerPromotion
                    .#PAD_OWNER_AMBIGUITY_MARGIN_MIL
            ? null
            : nearest.component
    }

    /**
     * Resolves the static body source position.
     * @param {{ bodyPositionMil?: { x?: number, y?: number } }} placement Static placement.
     * @returns {{ x: number, y: number } | null}
     */
    static #bodyPosition(placement) {
        const x = Number(placement?.bodyPositionMil?.x)
        const y = Number(placement?.bodyPositionMil?.y)

        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Checks whether a pad belongs to the component's mounted PCB face.
     * @param {object} pad PCB pad.
     * @param {{ layer?: string }} component PCB component.
     * @returns {boolean}
     */
    static #isSurfacePadForComponent(pad, component) {
        return PcbScene3dStaticBodyPadOwnerPromotion.#componentMountSide(
            component
        ) === 'bottom'
            ? Boolean(pad?.hasBottomPasteMaskOpening)
            : Boolean(pad?.hasTopPasteMaskOpening)
    }

    /**
     * Applies a component owner to a placement.
     * @param {object} placement Static placement.
     * @param {{ designator?: string, layer?: string }} owner Owner component.
     * @returns {object}
     */
    static #withOwner(placement, owner) {
        return {
            ...PcbScene3dStaticBodyPadOwnerPromotion.#withMountSide(
                placement,
                PcbScene3dStaticBodyPadOwnerPromotion.#componentMountSide(owner)
            ),
            designator:
                String(owner?.designator || '').trim() || placement?.designator
        }
    }

    /**
     * Applies a mount side while preserving the placement's XY anchor.
     * @param {object} placement Static placement.
     * @param {string | undefined} mountSide Owner mount side.
     * @returns {object}
     */
    static #withMountSide(placement, mountSide) {
        const currentSide =
            PcbScene3dStaticBodyPadOwnerPromotion.#normalizeMountSide(
                placement?.mountSide
            )
        const side = PcbScene3dStaticBodyPadOwnerPromotion.#normalizeMountSide(
            mountSide || currentSide
        )
        const z = Math.abs(Number(placement?.positionMil?.z || 0))

        return {
            ...placement,
            mountSide: side,
            positionMil: {
                ...(placement?.positionMil || {}),
                z: side === 'bottom' ? -z : z
            },
            geometry:
                currentSide === side
                    ? placement?.geometry
                    : PcbScene3dStaticBodyPadOwnerPromotion.#mirrorGeometry(
                          placement
                      )
        }
    }

    /**
     * Resolves the board side from one component layer.
     * @param {{ layer?: string }} component PCB component.
     * @returns {'top' | 'bottom'}
     */
    static #componentMountSide(component) {
        return String(component?.layer || '')
            .trim()
            .toLowerCase()
            .includes('bottom')
            ? 'bottom'
            : 'top'
    }

    /**
     * Normalizes a mount-side token.
     * @param {string | undefined} mountSide Candidate side.
     * @returns {'top' | 'bottom'}
     */
    static #normalizeMountSide(mountSide) {
        return String(mountSide || 'top')
            .trim()
            .toLowerCase() === 'bottom'
            ? 'bottom'
            : 'top'
    }

    /**
     * Mirrors source-coordinate polygon geometry for a side change.
     * @param {{ sourceCoordinateFrame?: boolean, geometry?: object }} placement Static placement.
     * @returns {object | undefined}
     */
    static #mirrorGeometry(placement) {
        const geometry = placement?.geometry
        if (
            !placement?.sourceCoordinateFrame ||
            !Array.isArray(geometry?.verticesMil)
        ) {
            return geometry
        }

        return {
            ...geometry,
            verticesMil: geometry.verticesMil.map((vertex) => ({
                x: PcbScene3dStaticBodyPadOwnerPromotion.#roundMil(
                    Number(vertex?.x || 0)
                ),
                y: PcbScene3dStaticBodyPadOwnerPromotion.#roundMil(
                    -Number(vertex?.y || 0)
                )
            }))
        }
    }

    /**
     * Checks whether a placement identity names authored board mechanics.
     * @param {{ designator?: string, sourceIdentityKey?: string } | null} placement Static placement.
     * @returns {boolean}
     */
    static #hasAuthoredMechanicalIdentity(placement) {
        return PcbScene3dStaticBodyPadOwnerPromotion.#identityTokens(
            placement
        ).some((token) =>
            PcbScene3dStaticBodyPadOwnerPromotion.#AUTHORED_MECHANICAL_TOKENS.has(
                token
            )
        )
    }

    /**
     * Collects normalized identity tokens from one placement.
     * @param {{ designator?: string, sourceIdentityKey?: string } | null} placement Static placement.
     * @returns {string[]}
     */
    static #identityTokens(placement) {
        return [placement?.designator, placement?.sourceIdentityKey]
            .join(' ')
            .replace(/([a-z])([A-Z])/gu, '$1 $2')
            .toLowerCase()
            .split(/[^a-z0-9]+/g)
            .flatMap((fragment) => fragment.match(/[a-z]+|\d+/g) || [])
            .filter(Boolean)
    }

    /**
     * Resolves the largest horizontal body span.
     * @param {object | undefined} geometry Static geometry.
     * @returns {number}
     */
    static #maxSpan(geometry) {
        const vertices = Array.isArray(geometry?.verticesMil)
            ? geometry.verticesMil
            : []
        if (vertices.length) {
            const xs = vertices.map((vertex) => Number(vertex?.x || 0))
            const ys = vertices.map((vertex) => Number(vertex?.y || 0))

            return Math.max(
                Math.max(...xs) - Math.min(...xs),
                Math.max(...ys) - Math.min(...ys)
            )
        }

        const radius = Number(geometry?.radiusMil)
        return Number.isFinite(radius) && radius > 0 ? radius * 2 : 0
    }

    /**
     * Rounds one mil value for stable promoted geometry output.
     * @param {number} value Candidate value.
     * @returns {number}
     */
    static #roundMil(value) {
        const rounded = Math.round(Number(value) * 10000) / 10000
        return Object.is(rounded, -0) ? 0 : rounded
    }
}
