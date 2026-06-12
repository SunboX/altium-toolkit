// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves 3D component-body identity and mount-side hints.
 */
export class PcbScene3dPlacementSideResolver {
    static #NEARBY_SIDE_HINT_MAX_DISTANCE_MIL = 600
    static #NEGATIVE_STANDOFF_SIDE_RATIO = 0.3
    static #MIN_NEGATIVE_STANDOFF_SIDE_MIL = 20

    /**
     * Resolves which board side one explicit model should mount on.
     * @param {{ layer?: string, positionMil?: { x?: number, y?: number }, standoffHeightMil?: number | null, overallHeightMil?: number | null }} componentBody
     * @param {{ layer?: string } | null} matchedComponent
     * @param {{ layer?: string, pattern?: string, source?: string, modelPath?: string, x?: number, y?: number }[]} components
     * @param {{ minX?: number, minY?: number, widthMil?: number, heightMil?: number } | null} board
     * @returns {'top' | 'bottom'}
     */
    static resolvePlacementSide(
        componentBody,
        matchedComponent,
        components = [],
        board = null
    ) {
        const matchedSide =
            PcbScene3dPlacementSideResolver.#resolveComponentLayerSide(
                matchedComponent?.layer
            )
        if (matchedSide) {
            return matchedSide
        }

        const standoffSide =
            PcbScene3dPlacementSideResolver.#resolveStandoffSide(componentBody)
        if (
            standoffSide &&
            PcbScene3dPlacementSideResolver.#isBodyAnchorInsideBoard(
                componentBody,
                board
            )
        ) {
            return standoffSide
        }

        const nearbySide =
            PcbScene3dPlacementSideResolver.#resolveNearbyComponentSide(
                componentBody,
                components
            )
        if (nearbySide) {
            return nearbySide
        }

        const mechanicalSide =
            PcbScene3dPlacementSideResolver.#resolveMechanicalLayerSide(
                componentBody?.layer
            )
        if (mechanicalSide) {
            return mechanicalSide
        }

        return standoffSide || 'top'
    }

    /**
     * Resolves the grouping key for repeated component-body matching.
     * @param {{ modelId?: string, name?: string, identifier?: string }} componentBody
     * @returns {string}
     */
    static resolveBodyGroupKey(componentBody) {
        return PcbScene3dPlacementSideResolver.#normalizeLookupToken(
            componentBody?.modelId ||
                componentBody?.name ||
                componentBody?.identifier
        )
    }

    /**
     * Scores how strongly one component record appears to belong to one body
     * record based on shared model/footprint tokens.
     * @param {{ name?: string, identifier?: string }} componentBody
     * @param {{ pattern?: string, source?: string, modelPath?: string }} component
     * @returns {number}
     */
    static scoreBodyComponentAffinity(componentBody, component) {
        const bodyTokens =
            PcbScene3dPlacementSideResolver.#collectMeaningfulTokens([
                componentBody?.identifier,
                String(componentBody?.name || '').replace(/\.[^.]+$/, '')
            ])
        const componentTokens =
            PcbScene3dPlacementSideResolver.#collectMeaningfulTokens([
                component?.pattern,
                component?.source,
                component?.modelPath
            ])
        let score = 0

        bodyTokens.forEach((token) => {
            if (componentTokens.has(token)) {
                score += token.length
            }
        })

        return score
    }

    /**
     * Resolves side from the normalized component layer.
     * @param {string | undefined} layer
     * @returns {'top' | 'bottom' | null}
     */
    static #resolveComponentLayerSide(layer) {
        const normalized = String(layer || '')
            .trim()
            .toUpperCase()

        if (!normalized) {
            return null
        }

        if (normalized.includes('BOTTOM') || normalized === 'BOT') {
            return 'bottom'
        }

        if (normalized.includes('TOP')) {
            return 'top'
        }

        return null
    }

    /**
     * Resolves underside bodies from significant negative standoff metadata.
     * @param {{ standoffHeightMil?: number | null, overallHeightMil?: number | null } | null} componentBody
     * @returns {'bottom' | null}
     */
    static #resolveStandoffSide(componentBody) {
        const standoff = Number(componentBody?.standoffHeightMil)
        const overallHeight = Number(componentBody?.overallHeightMil)

        if (!Number.isFinite(standoff) || standoff >= 0) {
            return null
        }

        const threshold =
            Number.isFinite(overallHeight) && overallHeight > 0
                ? Math.max(
                      overallHeight *
                          PcbScene3dPlacementSideResolver
                              .#NEGATIVE_STANDOFF_SIDE_RATIO,
                      PcbScene3dPlacementSideResolver
                          .#MIN_NEGATIVE_STANDOFF_SIDE_MIL
                  )
                : PcbScene3dPlacementSideResolver
                      .#MIN_NEGATIVE_STANDOFF_SIDE_MIL

        return Math.abs(standoff) >= threshold ? 'bottom' : null
    }

    /**
     * Returns true when one body anchor sits inside the normalized board bounds.
     * @param {{ positionMil?: { x?: number, y?: number } } | null} componentBody
     * @param {{ minX?: number, minY?: number, widthMil?: number, heightMil?: number } | null} board
     * @returns {boolean}
     */
    static #isBodyAnchorInsideBoard(componentBody, board) {
        const x = Number(componentBody?.positionMil?.x)
        const y = Number(componentBody?.positionMil?.y)
        const minX = Number(board?.minX)
        const minY = Number(board?.minY)
        const width = Number(board?.widthMil)
        const height = Number(board?.heightMil)

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return false
        }

        return x >= minX && x <= minX + width && y >= minY && y <= minY + height
    }

    /**
     * Resolves side from the nearest footprint-compatible component.
     * @param {{ positionMil?: { x?: number, y?: number } } & { name?: string, identifier?: string }} componentBody
     * @param {{ layer?: string, pattern?: string, source?: string, modelPath?: string, x?: number, y?: number }[]} components
     * @returns {'top' | 'bottom' | null}
     */
    static #resolveNearbyComponentSide(componentBody, components) {
        const candidates = (Array.isArray(components) ? components : [])
            .map((component) => ({
                component,
                side: PcbScene3dPlacementSideResolver.#resolveComponentLayerSide(
                    component?.layer
                ),
                score: PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                    componentBody,
                    component
                ),
                distance:
                    PcbScene3dPlacementSideResolver.#distanceBetweenBodyAndComponent(
                        componentBody,
                        component
                    )
            }))
            .filter(
                (candidate) =>
                    candidate.side &&
                    candidate.score > 0 &&
                    candidate.distance <=
                        PcbScene3dPlacementSideResolver
                            .#NEARBY_SIDE_HINT_MAX_DISTANCE_MIL
            )
            .sort(
                (left, right) =>
                    right.score - left.score || left.distance - right.distance
            )

        return candidates[0]?.side || null
    }

    /**
     * Resolves a common Altium top/bottom mechanical layer pair.
     * @param {string | undefined} layer
     * @returns {'top' | 'bottom' | null}
     */
    static #resolveMechanicalLayerSide(layer) {
        const match = String(layer || '').match(/^MECHANICAL\s*(\d+)$/i)
        if (!match) {
            return null
        }

        return Number(match[1]) % 2 === 0 ? 'bottom' : 'top'
    }

    /**
     * Returns the euclidean distance between one body anchor and one component
     * anchor.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody
     * @param {{ x?: number, y?: number }} component
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
     * Collects normalized model tokens from free-form strings.
     * @param {(string | undefined)[]} values
     * @returns {Set<string>}
     */
    static #collectMeaningfulTokens(values) {
        const tokens = new Set()

        ;(Array.isArray(values) ? values : []).forEach((value) => {
            String(value || '')
                .toLowerCase()
                .split(/[^a-z0-9]+/g)
                .forEach((fragment) => {
                    ;(fragment.match(/[a-z]+|\d+/g) || []).forEach((token) => {
                        if (
                            PcbScene3dPlacementSideResolver.#isMeaningfulToken(
                                token
                            )
                        ) {
                            tokens.add(token)
                        }
                    })
                })
        })

        return tokens
    }

    /**
     * Returns true when one normalized token carries useful model identity.
     * @param {string} token
     * @returns {boolean}
     */
    static #isMeaningfulToken(token) {
        return (
            String(token || '').length >= 2 &&
            !new Set(['con', 'step', 'stp', 'model', 'default', 'black']).has(
                String(token || '')
            )
        )
    }

    /**
     * Normalizes one lookup token for repeated-model grouping.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #normalizeLookupToken(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
    }
}
