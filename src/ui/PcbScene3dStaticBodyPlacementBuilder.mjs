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

    /**
     * Builds static shape-body scene placements.
     * @param {{ identifier?: string, name?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, standoffHeightMil?: number | null, overallHeightMil?: number | null, staticGeometry?: object }[]} componentBodies Component bodies.
     * @param {({ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null)[]} bodyMatches Matched components.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components Components.
     * @param {{ centerX: number, centerY: number, minX?: number, minY?: number, widthMil?: number, heightMil?: number }} board Board.
     * @param {number} thicknessMil Board thickness.
     * @returns {{ designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, geometry: object }[]}
     */
    static build(
        componentBodies,
        bodyMatches,
        components,
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
     * Builds one static shape-body scene placement.
     * @param {{ identifier?: string, name?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, standoffHeightMil?: number | null, overallHeightMil?: number | null, staticGeometry?: object }} componentBody Component body.
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
        const geometry = componentBody?.staticGeometry

        if (!geometry || geometry.status !== 'complete') {
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

        const mountSide = PcbScene3dPlacementSideResolver.resolvePlacementSide(
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
            geometry
        }
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
