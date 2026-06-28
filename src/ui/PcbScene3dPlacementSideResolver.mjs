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
    static #IGNORED_IDENTITY_TOKENS = new Set([
        'con',
        'step',
        'stp',
        'model',
        'default',
        'black'
    ])
    static #BODY_TOKEN_CACHE = new WeakMap()
    static #COMPONENT_TOKEN_CACHE = new WeakMap()
    static #AFFINITY_SCORE_CACHE = new WeakMap()

    /**
     * Resolves which board side one explicit model should mount on.
     * @param {{ layer?: string, positionMil?: { x?: number, y?: number }, dzMil?: number | null, standoffHeightMil?: number | null, overallHeightMil?: number | null }} componentBody
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
        const trustedStandoffSide =
            PcbScene3dPlacementSideResolver.#shouldTrustStandoffSide(
                componentBody,
                standoffSide
            )
                ? standoffSide
                : null
        if (
            trustedStandoffSide &&
            PcbScene3dPlacementSideResolver.#isBodyAnchorInsideBoard(
                componentBody,
                board
            )
        ) {
            return trustedStandoffSide
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

        return trustedStandoffSide || 'top'
    }

    /**
     * Resolves which board side one authored static shape body should mount on.
     * Shape bodies carry explicit mechanical-layer intent, so that side wins
     * over loose nearby-package identity unless the body was directly matched.
     * @param {{ layer?: string, positionMil?: { x?: number, y?: number }, dzMil?: number | null, standoffHeightMil?: number | null, overallHeightMil?: number | null }} componentBody
     * @param {{ layer?: string } | null} matchedComponent
     * @param {{ layer?: string, pattern?: string, source?: string, modelPath?: string, x?: number, y?: number }[]} components
     * @param {{ minX?: number, minY?: number, widthMil?: number, heightMil?: number } | null} board
     * @returns {'top' | 'bottom'}
     */
    static resolveStaticBodyPlacementSide(
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
        const trustedStandoffSide =
            PcbScene3dPlacementSideResolver.#shouldTrustStandoffSide(
                componentBody,
                standoffSide
            )
                ? standoffSide
                : null
        if (
            trustedStandoffSide &&
            PcbScene3dPlacementSideResolver.#isBodyAnchorInsideBoard(
                componentBody,
                board
            )
        ) {
            return trustedStandoffSide
        }

        const mechanicalSide =
            PcbScene3dPlacementSideResolver.#resolveMechanicalLayerSide(
                componentBody?.layer
            )
        if (mechanicalSide) {
            return mechanicalSide
        }

        const nearbySide =
            PcbScene3dPlacementSideResolver.#resolveNearbyComponentSide(
                componentBody,
                components
            )
        if (nearbySide) {
            return nearbySide
        }

        return trustedStandoffSide || 'top'
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
     * @param {{ pattern?: string, source?: string, modelPath?: string, description?: string, parameters?: object, provenance?: object }} component
     * @returns {number}
     */
    static scoreBodyComponentAffinity(componentBody, component) {
        const bodyValues =
            PcbScene3dPlacementSideResolver.#bodyAffinityValues(componentBody)
        const componentValues =
            PcbScene3dPlacementSideResolver.#componentAffinityValues(component)
        const bodyKey =
            PcbScene3dPlacementSideResolver.#cacheIdentityKey(bodyValues)
        const componentKey =
            PcbScene3dPlacementSideResolver.#cacheIdentityKey(componentValues)
        const cachedScore =
            PcbScene3dPlacementSideResolver.#cachedAffinityScore(
                componentBody,
                component,
                bodyKey,
                componentKey
            )
        if (cachedScore !== null) {
            return cachedScore
        }

        const bodyTokens =
            PcbScene3dPlacementSideResolver.#cachedMeaningfulTokens(
                PcbScene3dPlacementSideResolver.#BODY_TOKEN_CACHE,
                componentBody,
                bodyKey,
                bodyValues
            )
        const componentTokens =
            PcbScene3dPlacementSideResolver.#cachedMeaningfulTokens(
                PcbScene3dPlacementSideResolver.#COMPONENT_TOKEN_CACHE,
                component,
                componentKey,
                componentValues
            )
        let score = 0

        bodyTokens.forEach((token) => {
            if (componentTokens.has(token)) {
                score += token.length
            }
        })

        PcbScene3dPlacementSideResolver.#cacheAffinityScore(
            componentBody,
            component,
            bodyKey,
            componentKey,
            score
        )

        return score
    }

    /**
     * Resolves body identity fields used for affinity scoring.
     * @param {{ name?: string, identifier?: string } | null | undefined} componentBody Component-body record.
     * @returns {(string | undefined)[]}
     */
    static #bodyAffinityValues(componentBody) {
        return [
            componentBody?.identifier,
            String(componentBody?.name || '').replace(/\.[^.]+$/, '')
        ]
    }

    /**
     * Resolves component identity fields used for affinity scoring.
     * @param {{ pattern?: string, source?: string, modelPath?: string, description?: string, parameters?: object, provenance?: object } | null | undefined} component Component record.
     * @returns {(string | undefined)[]}
     */
    static #componentAffinityValues(component) {
        return [
            component?.pattern,
            component?.source,
            component?.modelPath,
            component?.description,
            ...PcbScene3dPlacementSideResolver.#componentPackageMetadata(
                component
            )
        ]
    }

    /**
     * Resolves a deterministic key for identity fields.
     * @param {unknown[]} values Identity field values.
     * @returns {string}
     */
    static #cacheIdentityKey(values) {
        return (Array.isArray(values) ? values : [])
            .map((value) => String(value || ''))
            .join('\u0000')
    }

    /**
     * Returns a cached score when both input identity keys still match.
     * @param {unknown} componentBody Component-body record.
     * @param {unknown} component Component record.
     * @param {string} bodyKey Current body identity key.
     * @param {string} componentKey Current component identity key.
     * @returns {number | null}
     */
    static #cachedAffinityScore(
        componentBody,
        component,
        bodyKey,
        componentKey
    ) {
        if (
            !PcbScene3dPlacementSideResolver.#isObjectLike(componentBody) ||
            !PcbScene3dPlacementSideResolver.#isObjectLike(component)
        ) {
            return null
        }

        const componentScores =
            PcbScene3dPlacementSideResolver.#AFFINITY_SCORE_CACHE.get(
                componentBody
            )
        const cachedScore = componentScores?.get(component)

        return cachedScore?.bodyKey === bodyKey &&
            cachedScore?.componentKey === componentKey
            ? cachedScore.score
            : null
    }

    /**
     * Caches one body/component affinity score.
     * @param {unknown} componentBody Component-body record.
     * @param {unknown} component Component record.
     * @param {string} bodyKey Current body identity key.
     * @param {string} componentKey Current component identity key.
     * @param {number} score Affinity score.
     * @returns {void}
     */
    static #cacheAffinityScore(
        componentBody,
        component,
        bodyKey,
        componentKey,
        score
    ) {
        if (
            !PcbScene3dPlacementSideResolver.#isObjectLike(componentBody) ||
            !PcbScene3dPlacementSideResolver.#isObjectLike(component)
        ) {
            return
        }

        let componentScores =
            PcbScene3dPlacementSideResolver.#AFFINITY_SCORE_CACHE.get(
                componentBody
            )
        if (!componentScores) {
            componentScores = new WeakMap()
            PcbScene3dPlacementSideResolver.#AFFINITY_SCORE_CACHE.set(
                componentBody,
                componentScores
            )
        }

        componentScores.set(component, { bodyKey, componentKey, score })
    }

    /**
     * Collects cached normalized identity tokens.
     * @param {WeakMap<object, { key: string, tokens: Set<string> }>} cache Token cache.
     * @param {unknown} owner Source object that owns the identity fields.
     * @param {string} key Current identity key.
     * @param {unknown[]} values Identity field values.
     * @returns {Set<string>}
     */
    static #cachedMeaningfulTokens(cache, owner, key, values) {
        if (!PcbScene3dPlacementSideResolver.#isObjectLike(owner)) {
            return PcbScene3dPlacementSideResolver.#collectMeaningfulTokens(
                values
            )
        }

        const cached = cache.get(owner)
        if (cached?.key === key) {
            return cached.tokens
        }

        const tokens =
            PcbScene3dPlacementSideResolver.#collectMeaningfulTokens(values)
        cache.set(owner, { key, tokens })
        return tokens
    }

    /**
     * Returns true when a value can be used as a WeakMap key.
     * @param {unknown} value Candidate value.
     * @returns {boolean}
     */
    static #isObjectLike(value) {
        return (
            (typeof value === 'object' && value !== null) ||
            typeof value === 'function'
        )
    }

    /**
     * Resolves package-related component metadata that can identify generic
     * embedded 3D bodies when pattern/source only name the electrical part.
     * @param {{ parameters?: object, provenance?: object } | null | undefined} component Component record.
     * @returns {string[]}
     */
    static #componentPackageMetadata(component) {
        const parameters =
            component?.parameters && typeof component.parameters === 'object'
                ? component.parameters
                : {}
        const provenance =
            component?.provenance && typeof component.provenance === 'object'
                ? component.provenance
                : {}

        return [
            parameters['Package / Case'],
            parameters['Supplier Device Package'],
            parameters['Part Description'],
            parameters.Package,
            provenance.footprintDescription,
            provenance.sourceLibReference,
            provenance.sourceFootprintLibrary,
            provenance.sourceFootprintLibraryName
        ].map((value) => String(value || ''))
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
     * Checks whether negative standoff metadata is reliable enough to infer
     * the board side before nearby package or mechanical-layer evidence.
     * @param {{ dzMil?: number | null, standoffHeightMil?: number | null, overallHeightMil?: number | null } | null} componentBody Component body row.
     * @param {'bottom' | null} standoffSide Side inferred from the standoff.
     * @returns {boolean}
     */
    static #shouldTrustStandoffSide(componentBody, standoffSide) {
        if (!standoffSide) {
            return false
        }

        return !PcbScene3dPlacementSideResolver.#hasInEnvelopeDzAgainstOverlargeStandoff(
            componentBody
        )
    }

    /**
     * Returns true for source-origin artifacts where Altium's standoff exceeds
     * the model envelope but the authored dz offset is still physically valid.
     * @param {{ dzMil?: number | null, standoffHeightMil?: number | null, overallHeightMil?: number | null } | null} componentBody Component body row.
     * @returns {boolean}
     */
    static #hasInEnvelopeDzAgainstOverlargeStandoff(componentBody) {
        const standoff = Number(componentBody?.standoffHeightMil)
        const dz = Number(componentBody?.dzMil)
        const overallHeight = Number(componentBody?.overallHeightMil)

        return (
            Number.isFinite(standoff) &&
            standoff < 0 &&
            Number.isFinite(dz) &&
            dz < 0 &&
            Number.isFinite(overallHeight) &&
            overallHeight > 0 &&
            Math.abs(standoff) > overallHeight &&
            Math.abs(dz) < overallHeight
        )
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
            !PcbScene3dPlacementSideResolver.#IGNORED_IDENTITY_TOKENS.has(
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
