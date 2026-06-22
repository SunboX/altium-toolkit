// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dPlacementSideResolver } from './PcbScene3dPlacementSideResolver.mjs'

/**
 * Builds scene placements for static shape-based 3D bodies.
 */
export class PcbScene3dStaticBodyPlacementBuilder {
    static #UNMATCHED_BODY_OVERHANG_RATIO = 0.25
    static #UNMATCHED_BODY_MIN_OVERHANG_MIL = 150
    static #UNMATCHED_BODY_MAX_OVERHANG_MIL = 600
    static #OWNER_AFFINITY_DISTANCE_MIL = 600
    static #OWNER_EXACT_DISTANCE_MIL = 5
    static #OWNER_EXACT_MAX_SPAN_MIL = 500
    static #GENERIC_MECHANICAL_IDENTITY_TOKENS = new Set([
        'can',
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
     * Builds static shape-body scene placements.
     * @param {{ componentIndex?: number, identifier?: string, name?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, standoffHeightMil?: number | null, overallHeightMil?: number | null, bodyOpacity?: number | string, staticGeometry?: object }[]} componentBodies Component bodies.
     * @param {({ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null)[]} bodyMatches Matched components.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components Components.
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[]} pads Pads.
     * @param {{ centerX: number, centerY: number, minX?: number, minY?: number, widthMil?: number, heightMil?: number }} board Board.
     * @param {number} thicknessMil Board thickness.
     * @returns {{ designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, geometry: object }[]}
     */
    static build(
        componentBodies,
        bodyMatches,
        components,
        pads,
        board,
        thicknessMil
    ) {
        return (Array.isArray(componentBodies) ? componentBodies : [])
            .map((componentBody, index) =>
                PcbScene3dStaticBodyPlacementBuilder.#buildPlacement(
                    componentBody,
                    bodyMatches?.[index] || null,
                    components,
                    board,
                    thicknessMil
                )
            )
            .filter(Boolean)
    }

    /**
     * Checks whether one static geometry is already complete.
     * @param {object | undefined} geometry Static geometry.
     * @returns {boolean}
     */
    static #isCompleteGeometry(geometry) {
        return Boolean(geometry && geometry.status === 'complete')
    }

    /**
     * Builds one static shape-body scene placement.
     * @param {{ componentIndex?: number, embedded?: boolean, identifier?: string, name?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, standoffHeightMil?: number | null, overallHeightMil?: number | null, bodyOpacity?: number | string, staticGeometry?: object }} componentBody Component body.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null} matchedComponent Matched component.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components Components.
     * @param {{ centerX: number, centerY: number, minX?: number, minY?: number, widthMil?: number, heightMil?: number }} board Board.
     * @param {number} thicknessMil Board thickness.
     * @returns {{ designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, geometry: object } | null}
     */
    static #buildPlacement(
        componentBody,
        matchedComponent,
        components,
        board,
        thicknessMil
    ) {
        const geometry =
            PcbScene3dStaticBodyPlacementBuilder.#normalizeStaticGeometry(
                componentBody,
                componentBody?.staticGeometry
            )

        if (
            !PcbScene3dStaticBodyPlacementBuilder.#isCompleteGeometry(geometry)
        ) {
            return null
        }

        if (
            !matchedComponent &&
            PcbScene3dStaticBodyPlacementBuilder.#shouldSuppressStaticBody(
                componentBody,
                geometry,
                components
            )
        ) {
            return null
        }

        if (
            !matchedComponent &&
            !PcbScene3dStaticBodyPlacementBuilder.#isBodyPositionNearBoard(
                componentBody,
                board
            )
        ) {
            return null
        }

        const mountSide =
            PcbScene3dPlacementSideResolver.resolveStaticBodyPlacementSide(
                componentBody,
                matchedComponent,
                components,
                board
            )
        const sourcePosition =
            PcbScene3dStaticBodyPlacementBuilder.#sourcePosition(componentBody)
        const heightMil =
            PcbScene3dStaticBodyPlacementBuilder.#geometryHeight(geometry)
        const standoffMil = Math.abs(
            Number(
                geometry.standoffHeightMil ?? componentBody.standoffHeightMil
            )
        )
        const zOffset =
            Number(thicknessMil || 0) / 2 +
            (Number.isFinite(standoffMil) ? standoffMil : 0) +
            heightMil / 2

        return {
            designator:
                matchedComponent?.designator ||
                String(
                    componentBody.identifier || componentBody.name || '3D body'
                ),
            mountSide,
            rotationDeg: PcbScene3dStaticBodyPlacementBuilder.#normalizeAngle(
                Number(componentBody.rotationDeg || 0) +
                    Number(matchedComponent?.rotation || 0)
            ),
            positionMil: {
                x: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                    Number(sourcePosition.x || 0) - Number(board.centerX || 0)
                ),
                y: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                    Number(sourcePosition.y || 0) - Number(board.centerY || 0)
                ),
                z: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                    mountSide === 'bottom' ? -zOffset : zOffset
                )
            },
            bodyPositionMil: {
                x: Number(componentBody.positionMil?.x || 0),
                y: Number(componentBody.positionMil?.y || 0)
            },
            ...PcbScene3dStaticBodyPlacementBuilder.#displayMetadata(
                componentBody
            ),
            geometry
        }
    }

    /**
     * Converts source-space polygon vertices into render-local geometry.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {object | undefined} geometry Static geometry.
     * @returns {object | undefined}
     */
    static #normalizeStaticGeometry(componentBody, geometry) {
        if (
            String(geometry?.kind || '').toLowerCase() !== 'extruded-polygon' ||
            !Array.isArray(geometry?.verticesMil) ||
            geometry.verticesMil.length < 3 ||
            !PcbScene3dStaticBodyPlacementBuilder.#usesSourceCoordinateFrame(
                componentBody,
                geometry.verticesMil
            )
        ) {
            return geometry
        }

        const center =
            PcbScene3dStaticBodyPlacementBuilder.#polygonBoundsCenter(
                geometry.verticesMil
            )

        return {
            ...geometry,
            verticesMil: geometry.verticesMil.map((vertex) => ({
                x: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                    Number(vertex?.x || 0) - center.x
                ),
                y: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                    Number(vertex?.y || 0) - center.y
                )
            }))
        }
    }

    /**
     * Checks whether polygon vertices use board/source coordinates instead of
     * small body-local coordinates.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {{ x?: number, y?: number }[]} vertices Vertices.
     * @returns {boolean}
     */
    static #usesSourceCoordinateFrame(componentBody, vertices) {
        const center =
            PcbScene3dStaticBodyPlacementBuilder.#polygonBoundsCenter(vertices)
        const source =
            PcbScene3dStaticBodyPlacementBuilder.#sourcePosition(componentBody)

        return (
            Math.max(
                Math.abs(center.x),
                Math.abs(center.y),
                Math.abs(source.x),
                Math.abs(source.y)
            ) > 1000
        )
    }

    /**
     * Resolves the axis-aligned polygon bounds center.
     * @param {{ x?: number, y?: number }[]} vertices Vertices.
     * @returns {{ x: number, y: number }}
     */
    static #polygonBoundsCenter(vertices) {
        const points = (Array.isArray(vertices) ? vertices : []).map(
            (vertex) => ({
                x: Number(vertex?.x || 0),
                y: Number(vertex?.y || 0)
            })
        )
        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)

        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        }
    }

    /**
     * Resolves optional display metadata for static body rendering.
     * @param {{ bodyColor?: object, bodyOpacity?: number | string }} componentBody Component body.
     * @returns {{ bodyColor?: object, bodyOpacity?: number }}
     */
    static #displayMetadata(componentBody) {
        const metadata = {}
        if (
            componentBody?.bodyColor &&
            typeof componentBody.bodyColor === 'object'
        ) {
            metadata.bodyColor = componentBody.bodyColor
        }

        const opacity = Number(componentBody?.bodyOpacity)
        if (Number.isFinite(opacity)) {
            metadata.bodyOpacity = opacity
        }

        return metadata
    }

    /**
     * Checks whether an unowned static body is likely a translucent mechanical
     * overlay instead of a component package.
     * @param {{ componentIndex?: number, embedded?: boolean, bodyOpacity?: number | string, identifier?: string, name?: string, positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {object} geometry Static geometry.
     * @param {{ componentIndex?: number, x?: number, y?: number, pattern?: string, source?: string, modelPath?: string, description?: string, parameters?: object, provenance?: object }[]} components Components.
     * @returns {boolean}
     */
    static #shouldSuppressStaticBody(componentBody, geometry, components) {
        return (
            PcbScene3dStaticBodyPlacementBuilder.#isTranslucentBody(
                componentBody
            ) &&
            !PcbScene3dStaticBodyPlacementBuilder.#hasLikelyComponentOwner(
                componentBody,
                geometry,
                components
            )
        )
    }

    /**
     * Checks whether a body was authored with visible partial transparency.
     * @param {{ bodyOpacity?: number | string }} componentBody Component body.
     * @returns {boolean}
     */
    static #isTranslucentBody(componentBody) {
        const opacity = Number(componentBody?.bodyOpacity)

        return Number.isFinite(opacity) && opacity >= 0 && opacity < 1
    }

    /**
     * Checks whether an otherwise unmatched body still has a plausible owning
     * component.
     * @param {{ componentIndex?: number, embedded?: boolean, identifier?: string, name?: string, positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {object} geometry Static geometry.
     * @param {{ componentIndex?: number, x?: number, y?: number, pattern?: string, source?: string, modelPath?: string, description?: string, parameters?: object, provenance?: object }[]} components Components.
     * @returns {boolean}
     */
    static #hasLikelyComponentOwner(componentBody, geometry, components) {
        if (componentBody?.embedded) {
            return true
        }

        const componentIndex = Number(componentBody?.componentIndex)
        if (
            Number.isInteger(componentIndex) &&
            (Array.isArray(components) ? components : []).some(
                (component) =>
                    Number(component?.componentIndex) === componentIndex
            )
        ) {
            return true
        }

        const maxSpanMil =
            PcbScene3dStaticBodyPlacementBuilder.#geometryMaxSpan(geometry)
        const genericMechanical =
            PcbScene3dStaticBodyPlacementBuilder.#hasGenericMechanicalIdentity(
                componentBody
            )

        return (Array.isArray(components) ? components : []).some(
            (component) => {
                const distance =
                    PcbScene3dStaticBodyPlacementBuilder.#distanceBetweenBodyAndComponent(
                        componentBody,
                        component
                    )
                const affinityScore =
                    PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                        componentBody,
                        component
                    )

                return (
                    (!genericMechanical &&
                        affinityScore > 0 &&
                        distance <=
                            PcbScene3dStaticBodyPlacementBuilder
                                .#OWNER_AFFINITY_DISTANCE_MIL) ||
                    (!genericMechanical &&
                        distance <=
                            PcbScene3dStaticBodyPlacementBuilder
                                .#OWNER_EXACT_DISTANCE_MIL &&
                        maxSpanMil <=
                            PcbScene3dStaticBodyPlacementBuilder
                                .#OWNER_EXACT_MAX_SPAN_MIL)
                )
            }
        )
    }

    /**
     * Checks for generic mechanical labels that are too weak to prove package
     * ownership for translucent static bodies.
     * @param {{ identifier?: string, name?: string }} componentBody Component body.
     * @returns {boolean}
     */
    static #hasGenericMechanicalIdentity(componentBody) {
        return PcbScene3dStaticBodyPlacementBuilder.#identityTokens(
            componentBody
        ).some((token) =>
            PcbScene3dStaticBodyPlacementBuilder.#GENERIC_MECHANICAL_IDENTITY_TOKENS.has(
                token
            )
        )
    }

    /**
     * Collects normalized identity tokens from one body row.
     * @param {{ identifier?: string, name?: string }} componentBody Component body.
     * @returns {string[]}
     */
    static #identityTokens(componentBody) {
        return [componentBody?.identifier, componentBody?.name]
            .join(' ')
            .toLowerCase()
            .split(/[^a-z0-9]+/g)
            .flatMap((fragment) => fragment.match(/[a-z]+|\d+/g) || [])
            .filter(Boolean)
    }

    /**
     * Resolves the largest horizontal span of a static body.
     * @param {object} geometry Static geometry.
     * @returns {number}
     */
    static #geometryMaxSpan(geometry) {
        if (
            Array.isArray(geometry?.verticesMil) &&
            geometry.verticesMil.length
        ) {
            const points = geometry.verticesMil.map((vertex) => ({
                x: Number(vertex?.x || 0),
                y: Number(vertex?.y || 0)
            }))
            const xs = points.map((point) => point.x)
            const ys = points.map((point) => point.y)

            return Math.max(
                Math.max(...xs) - Math.min(...xs),
                Math.max(...ys) - Math.min(...ys)
            )
        }

        const radius = Number(geometry?.radiusMil)

        return Number.isFinite(radius) && radius > 0 ? radius * 2 : 0
    }

    /**
     * Returns the euclidean distance between body and component anchors.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {{ x?: number, y?: number }} component Component.
     * @returns {number}
     */
    static #distanceBetweenBodyAndComponent(componentBody, component) {
        return Math.hypot(
            Number(component?.x || 0) -
                Number(componentBody?.positionMil?.x || 0),
            Number(component?.y || 0) -
                Number(componentBody?.positionMil?.y || 0)
        )
    }

    /**
     * Returns the native body anchor.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @returns {{ x: number, y: number }}
     */
    static #sourcePosition(componentBody) {
        return {
            x: Number(componentBody?.positionMil?.x || 0),
            y: Number(componentBody?.positionMil?.y || 0)
        }
    }

    /**
     * Resolves static body height from geometry metadata.
     * @param {object} geometry Static geometry.
     * @returns {number}
     */
    static #geometryHeight(geometry) {
        const height = Number(geometry?.heightMil)
        if (Number.isFinite(height) && height > 0) {
            return height
        }

        const radius = Number(geometry?.radiusMil)
        if (Number.isFinite(radius) && radius > 0) {
            return radius * 2
        }

        return 0
    }

    /**
     * Returns true when one body anchor lies close enough to the board.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {{ minX?: number, minY?: number, widthMil?: number, heightMil?: number }} board Board.
     * @returns {boolean}
     */
    static #isBodyPositionNearBoard(componentBody, board) {
        const bodyX = Number(componentBody?.positionMil?.x || 0)
        const bodyY = Number(componentBody?.positionMil?.y || 0)
        const xOverhang =
            PcbScene3dStaticBodyPlacementBuilder.#unmatchedBodyOverhang(
                board?.widthMil
            )
        const yOverhang =
            PcbScene3dStaticBodyPlacementBuilder.#unmatchedBodyOverhang(
                board?.heightMil
            )
        const minX = Number(board?.minX || 0) - xOverhang
        const minY = Number(board?.minY || 0) - yOverhang
        const maxX =
            Number(board?.minX || 0) + Number(board?.widthMil || 0) + xOverhang
        const maxY =
            Number(board?.minY || 0) + Number(board?.heightMil || 0) + yOverhang

        return bodyX >= minX && bodyX <= maxX && bodyY >= minY && bodyY <= maxY
    }

    /**
     * Resolves a proportional unresolved-body margin for one board axis.
     * @param {number | string | undefined} spanMil Board axis span.
     * @returns {number}
     */
    static #unmatchedBodyOverhang(spanMil) {
        const proportional =
            Math.max(Number(spanMil || 0), 0) *
            PcbScene3dStaticBodyPlacementBuilder.#UNMATCHED_BODY_OVERHANG_RATIO

        return Math.min(
            PcbScene3dStaticBodyPlacementBuilder
                .#UNMATCHED_BODY_MAX_OVERHANG_MIL,
            Math.max(
                proportional,
                PcbScene3dStaticBodyPlacementBuilder
                    .#UNMATCHED_BODY_MIN_OVERHANG_MIL
            )
        )
    }

    /**
     * Rounds one mil value for stable scene output.
     * @param {number} value Candidate value.
     * @returns {number}
     */
    static #roundMil(value) {
        const rounded = Math.round(Number(value) * 10000) / 10000
        return Object.is(rounded, -0) ? 0 : rounded
    }

    /**
     * Normalizes one angle into the range [0, 360).
     * @param {number} angle Candidate angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }
}
