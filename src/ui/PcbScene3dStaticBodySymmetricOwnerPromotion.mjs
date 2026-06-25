// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Promotes complete symmetric source-coordinate chip-body fragments.
 */
export class PcbScene3dStaticBodySymmetricOwnerPromotion {
    static #CENTER_TOLERANCE_MIL = 2
    static #MAX_DISTANCE_MIL = 18
    static #MIN_PROJECTION_MIL = 4
    static #PROJECTION_TOLERANCE_MIL = 2.5
    static #PERPENDICULAR_TOLERANCE_MIL = 4

    /**
     * Reassigns complete symmetric source-coordinate fragments as one body.
     * @param {{ placement: object, matchedComponent: object | null }[]} placementRows Mutable placement rows.
     * @param {{ designator?: string, x?: number, y?: number, rotation?: number, layer?: string }[]} components PCB components.
     */
    static promote(placementRows, components = []) {
        const claims = (Array.isArray(components) ? components : [])
            .map((component) =>
                PcbScene3dStaticBodySymmetricOwnerPromotion.#ownerClaim(
                    placementRows,
                    component
                )
            )
            .filter(Boolean)
            .sort((left, right) => left.score - right.score)
        const assignedIndexes = new Set()

        claims.forEach((claim) => {
            if (claim.indexes.some((index) => assignedIndexes.has(index))) {
                return
            }

            claim.indexes.forEach((index) => {
                assignedIndexes.add(index)
                placementRows[index].matchedComponent = claim.component
                placementRows[index].placement =
                    PcbScene3dStaticBodySymmetricOwnerPromotion.#withOwner(
                        placementRows[index].placement,
                        claim.component
                    )
            })
        })
    }

    /**
     * Finds one centered source-coordinate owner claim for a component.
     * @param {{ placement: object }[]} placementRows Placement rows.
     * @param {{ designator?: string, x?: number, y?: number, rotation?: number, layer?: string }} component PCB component.
     * @returns {{ component: object, indexes: number[], score: number } | null}
     */
    static #ownerClaim(placementRows, component) {
        const center =
            PcbScene3dStaticBodySymmetricOwnerPromotion.#componentPosition(
                component
            )
        if (!center || !String(component?.designator || '').trim()) {
            return null
        }

        const axis =
            PcbScene3dStaticBodySymmetricOwnerPromotion.#componentAxis(
                component
            )
        const ownerSide =
            PcbScene3dStaticBodySymmetricOwnerPromotion.#componentMountSide(
                component
            )
        const candidates =
            PcbScene3dStaticBodySymmetricOwnerPromotion.#sourceCandidates(
                placementRows
            )
                .filter(
                    (candidate) =>
                        !candidate.row?.placement?.mountSideLocked ||
                        PcbScene3dStaticBodySymmetricOwnerPromotion.#normalizeMountSide(
                            candidate.row?.placement?.mountSide
                        ) === ownerSide
                )
                .map((candidate) => ({
                    ...candidate,
                    distance: Math.hypot(
                        candidate.position.x - center.x,
                        candidate.position.y - center.y
                    )
                }))
        const centerCandidates = candidates
            .filter(
                (candidate) =>
                    candidate.distance <=
                    PcbScene3dStaticBodySymmetricOwnerPromotion
                        .#CENTER_TOLERANCE_MIL
            )
            .sort((left, right) => left.distance - right.distance)

        return centerCandidates
            .map((centerCandidate) =>
                PcbScene3dStaticBodySymmetricOwnerPromotion.#bestPairClaim(
                    component,
                    center,
                    axis,
                    centerCandidate,
                    candidates
                )
            )
            .filter(Boolean)
            .sort((left, right) => left.score - right.score)[0]
    }

    /**
     * Finds the best opposite matching fragment pair for one center fragment.
     * @param {object} component Owner component.
     * @param {{ x: number, y: number }} center Component center.
     * @param {{ x: number, y: number }} axis Component axis unit vector.
     * @param {{ index: number, distance: number }} centerCandidate Center fragment.
     * @param {object[]} candidates Candidate fragments.
     * @returns {{ component: object, indexes: number[], score: number } | null}
     */
    static #bestPairClaim(
        component,
        center,
        axis,
        centerCandidate,
        candidates
    ) {
        const sideCandidates = candidates
            .filter((candidate) => candidate.index !== centerCandidate.index)
            .map((candidate) => ({
                ...candidate,
                offset: PcbScene3dStaticBodySymmetricOwnerPromotion.#axisOffset(
                    candidate.position,
                    center,
                    axis
                )
            }))
            .filter((candidate) =>
                PcbScene3dStaticBodySymmetricOwnerPromotion.#isSideCandidate(
                    candidate
                )
            )
        let bestClaim = null

        sideCandidates.forEach((negative) => {
            if (negative.offset.projection >= 0) {
                return
            }

            sideCandidates
                .filter(
                    (positive) =>
                        positive.offset.projection > 0 &&
                        positive.identityKey === negative.identityKey
                )
                .forEach((positive) => {
                    const symmetry = Math.abs(
                        Math.abs(negative.offset.projection) -
                            Math.abs(positive.offset.projection)
                    )
                    if (
                        symmetry >
                        PcbScene3dStaticBodySymmetricOwnerPromotion
                            .#PROJECTION_TOLERANCE_MIL
                    ) {
                        return
                    }

                    const score =
                        centerCandidate.distance +
                        symmetry +
                        negative.offset.perpendicular +
                        positive.offset.perpendicular
                    if (!bestClaim || score < bestClaim.score) {
                        bestClaim = {
                            component,
                            indexes: [
                                centerCandidate.index,
                                negative.index,
                                positive.index
                            ],
                            score
                        }
                    }
                })
        })

        return bestClaim
    }

    /**
     * Builds compact source-coordinate placement candidates.
     * @param {{ placement: object }[]} placementRows Placement rows.
     * @returns {object[]}
     */
    static #sourceCandidates(placementRows) {
        return placementRows
            .map((row, index) => ({
                index,
                row,
                position:
                    PcbScene3dStaticBodySymmetricOwnerPromotion.#sourcePosition(
                        row?.placement
                    ),
                identityKey: String(row?.placement?.sourceIdentityKey || '')
            }))
            .filter(
                (candidate) =>
                    candidate.position &&
                    candidate.row?.placement?.sourceCoordinateFrame &&
                    PcbScene3dStaticBodySymmetricOwnerPromotion.#isCompactRow(
                        candidate.row
                    )
            )
    }

    /**
     * Checks whether a projected fragment can be one side of a chip body.
     * @param {{ offset: { projection: number, perpendicular: number } }} candidate Candidate fragment.
     * @returns {boolean}
     */
    static #isSideCandidate(candidate) {
        return (
            Math.abs(candidate.offset.projection) >=
                PcbScene3dStaticBodySymmetricOwnerPromotion
                    .#MIN_PROJECTION_MIL &&
            Math.abs(candidate.offset.projection) <=
                PcbScene3dStaticBodySymmetricOwnerPromotion.#MAX_DISTANCE_MIL &&
            candidate.offset.perpendicular <=
                PcbScene3dStaticBodySymmetricOwnerPromotion
                    .#PERPENDICULAR_TOLERANCE_MIL
        )
    }

    /**
     * Checks whether one row is compact enough for symmetric ownership.
     * @param {{ placement: object }} row Placement row.
     * @returns {boolean}
     */
    static #isCompactRow(row) {
        return (
            PcbScene3dStaticBodySymmetricOwnerPromotion.#maxSpan(
                row.placement?.geometry
            ) <= 40
        )
    }

    /**
     * Resolves the source-space body anchor used for owner proximity.
     * @param {{ bodyPositionMil?: { x?: number, y?: number } }} placement Static placement.
     * @returns {{ x: number, y: number } | null}
     */
    static #sourcePosition(placement) {
        const x = Number(placement?.bodyPositionMil?.x)
        const y = Number(placement?.bodyPositionMil?.y)

        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Resolves a component source-space center.
     * @param {{ x?: number, y?: number }} component PCB component.
     * @returns {{ x: number, y: number } | null}
     */
    static #componentPosition(component) {
        const x = Number(component?.x)
        const y = Number(component?.y)

        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Resolves a component axis unit vector.
     * @param {{ rotation?: number }} component PCB component.
     * @returns {{ x: number, y: number }}
     */
    static #componentAxis(component) {
        const angle = (Number(component?.rotation || 0) * Math.PI) / 180

        return { x: Math.cos(angle), y: Math.sin(angle) }
    }

    /**
     * Projects a source-space point onto a component axis.
     * @param {{ x: number, y: number }} position Fragment source position.
     * @param {{ x: number, y: number }} center Component source position.
     * @param {{ x: number, y: number }} axis Component axis unit vector.
     * @returns {{ projection: number, perpendicular: number }}
     */
    static #axisOffset(position, center, axis) {
        const dx = position.x - center.x
        const dy = position.y - center.y

        return {
            projection: dx * axis.x + dy * axis.y,
            perpendicular: Math.abs(-dx * axis.y + dy * axis.x)
        }
    }

    /**
     * Applies a component owner to a placement.
     * @param {object} placement Static placement.
     * @param {{ designator?: string, layer?: string }} owner Owner component.
     * @returns {object}
     */
    static #withOwner(placement, owner) {
        return {
            ...PcbScene3dStaticBodySymmetricOwnerPromotion.#withMountSide(
                placement,
                PcbScene3dStaticBodySymmetricOwnerPromotion.#componentMountSide(
                    owner
                )
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
            PcbScene3dStaticBodySymmetricOwnerPromotion.#normalizeMountSide(
                placement?.mountSide
            )
        const side =
            PcbScene3dStaticBodySymmetricOwnerPromotion.#normalizeMountSide(
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
                    : PcbScene3dStaticBodySymmetricOwnerPromotion.#mirrorGeometry(
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
     * Normalizes a mount side token.
     * @param {string | undefined} mountSide Candidate mount side.
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
     * Mirrors source-coordinate geometry into the opposite mount-local frame.
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
                x: PcbScene3dStaticBodySymmetricOwnerPromotion.#roundMil(
                    Number(vertex?.x || 0)
                ),
                y: PcbScene3dStaticBodySymmetricOwnerPromotion.#roundMil(
                    -Number(vertex?.y || 0)
                )
            }))
        }
    }

    /**
     * Resolves the largest horizontal geometry span.
     * @param {object | undefined} geometry Static geometry.
     * @returns {number}
     */
    static #maxSpan(geometry) {
        const vertices = Array.isArray(geometry?.verticesMil)
            ? geometry.verticesMil
            : []
        if (!vertices.length) {
            return 0
        }

        const xs = vertices.map((vertex) => Number(vertex?.x || 0))
        const ys = vertices.map((vertex) => Number(vertex?.y || 0))

        return Math.max(
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys)
        )
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
