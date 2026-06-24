// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dStaticBodySymmetryRecovery } from './PcbScene3dStaticBodySymmetryRecovery.mjs'

/**
 * Recovers renderable static-body geometry and display metadata.
 */
export class PcbScene3dStaticBodyRecovery {
    static #COVER_SIDE_EDGE_TOLERANCE_MIL = 80
    static #COVER_SIDE_CLUSTER_TOLERANCE_MIL = 600
    static #COVER_SIDE_DEFAULT_THICKNESS_MIL = 10
    static #COVER_SIDE_MIN_THICKNESS_MIL = 1
    static #COVER_FAMILY_IDENTITY_TOKENS = new Set([
        'can',
        'cover',
        'emi',
        'enclosure',
        'lid',
        'rfi',
        'shield'
    ])
    static #COVER_SIDE_IDENTITY_TOKENS = new Set([
        'edge',
        'frame',
        'rail',
        'side',
        'wall'
    ])
    static #COVER_TOP_IDENTITY_TOKENS = new Set(['lid', 'top'])

    /**
     * Recovers static geometries and inherited display metadata.
     * @param {object[] | undefined} componentBodies Component bodies.
     * @param {(object | null)[] | undefined} bodyMatches Matched owners.
     * @returns {object[]}
     */
    static recover(componentBodies, bodyMatches = []) {
        const bodies = Array.isArray(componentBodies) ? componentBodies : []
        const symmetricRecoveredBodies =
            PcbScene3dStaticBodySymmetryRecovery.recover(bodies, bodyMatches)
        const topRecoveredBodies = symmetricRecoveredBodies.map(
            (componentBody) =>
                PcbScene3dStaticBodyRecovery.#recoverCoverTopGeometry(
                    componentBody,
                    symmetricRecoveredBodies
                )
        )
        const recoveredBodies = topRecoveredBodies.map((componentBody) =>
            PcbScene3dStaticBodyRecovery.#recoverCoverSideGeometry(
                componentBody,
                topRecoveredBodies
            )
        )

        return PcbScene3dStaticBodyRecovery.#inheritBodyOpacity(recoveredBodies)
    }

    /**
     * Normalizes opacity to values that should be sent to the renderer.
     * @param {number | string | undefined} candidate Candidate opacity.
     * @returns {number | undefined}
     */
    static renderableOpacity(candidate) {
        const opacity = Number(candidate)

        return Number.isFinite(opacity) && opacity > 0 && opacity < 1
            ? opacity
            : undefined
    }

    /**
     * Copies positive translucency from matching sibling bodies when a row has
     * omitted or zero opacity metadata.
     * @param {object[]} componentBodies Component bodies.
     * @returns {object[]}
     */
    static #inheritBodyOpacity(componentBodies) {
        const opacityByIdentityKey =
            PcbScene3dStaticBodyRecovery.#bodyOpacityByIdentityKey(
                componentBodies
            )
        const opacityByFamilyKey =
            PcbScene3dStaticBodyRecovery.#bodyOpacityByFamilyKey(
                componentBodies
            )

        return componentBodies.map((componentBody) => {
            const explicitOpacity =
                PcbScene3dStaticBodyRecovery.renderableOpacity(
                    componentBody?.bodyOpacity
                )
            if (explicitOpacity !== undefined) {
                return componentBody
            }

            const identityKey =
                PcbScene3dStaticBodyRecovery.#bodyOpacityIdentityKey(
                    componentBody
                )
            const familyKey =
                PcbScene3dStaticBodyRecovery.#bodyOpacityFamilyKey(
                    componentBody
                )
            const inheritedOpacity =
                opacityByIdentityKey.get(identityKey) ??
                opacityByFamilyKey.get(familyKey)
            if (inheritedOpacity === undefined) {
                return componentBody
            }

            return {
                ...componentBody,
                bodyOpacity: inheritedOpacity
            }
        })
    }

    /**
     * Builds a lookup of positive opacity values by exact body identity.
     * @param {object[]} componentBodies Component bodies.
     * @returns {Map<string, number>}
     */
    static #bodyOpacityByIdentityKey(componentBodies) {
        const opacityByIdentityKey = new Map()
        const bodies = Array.isArray(componentBodies) ? componentBodies : []

        bodies.forEach((componentBody) => {
            const identityKey =
                PcbScene3dStaticBodyRecovery.#bodyOpacityIdentityKey(
                    componentBody
                )
            const opacity = PcbScene3dStaticBodyRecovery.renderableOpacity(
                componentBody?.bodyOpacity
            )

            if (!identityKey || opacity === undefined) {
                return
            }

            opacityByIdentityKey.set(identityKey, opacity)
        })

        return opacityByIdentityKey
    }

    /**
     * Builds a lookup of positive opacity values by cover/shield family.
     * @param {object[]} componentBodies Component bodies.
     * @returns {Map<string, number>}
     */
    static #bodyOpacityByFamilyKey(componentBodies) {
        const opacityByFamilyKey = new Map()
        const bodies = Array.isArray(componentBodies) ? componentBodies : []

        bodies.forEach((componentBody) => {
            const familyKey =
                PcbScene3dStaticBodyRecovery.#bodyOpacityFamilyKey(
                    componentBody
                )
            const opacity = PcbScene3dStaticBodyRecovery.renderableOpacity(
                componentBody?.bodyOpacity
            )

            if (!familyKey || opacity === undefined) {
                return
            }

            opacityByFamilyKey.set(familyKey, opacity)
        })

        return opacityByFamilyKey
    }

    /**
     * Builds the exact identity key used for sibling opacity inheritance.
     * @param {{ identifier?: string, name?: string }} componentBody Component body.
     * @returns {string}
     */
    static #bodyOpacityIdentityKey(componentBody) {
        return [componentBody?.identifier, componentBody?.name]
            .map((value) =>
                String(value || '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)
            .join('|')
    }

    /**
     * Builds a cover/shield family key for opacity inheritance.
     * @param {{ identifier?: string, name?: string }} componentBody Component body.
     * @returns {string}
     */
    static #bodyOpacityFamilyKey(componentBody) {
        return PcbScene3dStaticBodyRecovery.#identityTokens(componentBody)
            .filter((token) =>
                PcbScene3dStaticBodyRecovery.#COVER_FAMILY_IDENTITY_TOKENS.has(
                    token
                )
            )
            .sort()
            .join('|')
    }

    /**
     * Recovers a missing cover-top polygon from sibling cover side-wall bounds.
     * @param {object} componentBody Candidate component body.
     * @param {object[]} componentBodies All component bodies.
     * @returns {object}
     */
    static #recoverCoverTopGeometry(componentBody, componentBodies) {
        if (
            !PcbScene3dStaticBodyRecovery.#isRecoverableCoverTopBody(
                componentBody
            )
        ) {
            return componentBody
        }

        const bounds = PcbScene3dStaticBodyRecovery.#coverTopRecoveryBounds(
            componentBody,
            componentBodies
        )
        if (!bounds) {
            return componentBody
        }

        return {
            ...componentBody,
            staticGeometry: {
                ...componentBody.staticGeometry,
                status: 'complete',
                verticesMil:
                    PcbScene3dStaticBodyRecovery.#boundsToVertices(bounds)
            }
        }
    }

    /**
     * Checks whether one incomplete body is a safe cover-top recovery target.
     * @param {object | undefined} componentBody Candidate component body.
     * @returns {boolean}
     */
    static #isRecoverableCoverTopBody(componentBody) {
        const geometry = componentBody?.staticGeometry
        const tokens =
            PcbScene3dStaticBodyRecovery.#identityTokenSet(componentBody)
        const heightMil = Number(geometry?.heightMil)

        return (
            String(geometry?.kind || '').toLowerCase() === 'extruded-polygon' &&
            geometry?.status !== 'complete' &&
            (!Array.isArray(geometry?.verticesMil) ||
                geometry.verticesMil.length < 3) &&
            Number.isFinite(heightMil) &&
            heightMil > 0 &&
            PcbScene3dStaticBodyRecovery.#hasToken(
                tokens,
                PcbScene3dStaticBodyRecovery.#COVER_TOP_IDENTITY_TOKENS
            ) &&
            PcbScene3dStaticBodyRecovery.#hasToken(
                tokens,
                PcbScene3dStaticBodyRecovery.#COVER_FAMILY_IDENTITY_TOKENS
            )
        )
    }

    /**
     * Recovers a missing cover-side polygon from a sibling cover top.
     * @param {object} componentBody Candidate component body.
     * @param {object[]} componentBodies All component bodies after top recovery.
     * @returns {object}
     */
    static #recoverCoverSideGeometry(componentBody, componentBodies) {
        if (
            !PcbScene3dStaticBodyRecovery.#isRecoverableCoverSideBody(
                componentBody
            )
        ) {
            return componentBody
        }

        const bounds = PcbScene3dStaticBodyRecovery.#coverSideRecoveryBounds(
            componentBody,
            componentBodies
        )
        if (!bounds) {
            return componentBody
        }

        return {
            ...componentBody,
            staticGeometry: {
                ...componentBody.staticGeometry,
                status: 'complete',
                verticesMil:
                    PcbScene3dStaticBodyRecovery.#boundsToVertices(bounds)
            }
        }
    }

    /**
     * Checks whether one incomplete body is a safe cover-side recovery target.
     * @param {object | undefined} componentBody Candidate component body.
     * @returns {boolean}
     */
    static #isRecoverableCoverSideBody(componentBody) {
        const geometry = componentBody?.staticGeometry
        const tokens =
            PcbScene3dStaticBodyRecovery.#identityTokenSet(componentBody)
        const heightMil = Number(geometry?.heightMil)

        return (
            String(geometry?.kind || '').toLowerCase() === 'extruded-polygon' &&
            geometry?.status !== 'complete' &&
            (!Array.isArray(geometry?.verticesMil) ||
                geometry.verticesMil.length < 3) &&
            Number.isFinite(heightMil) &&
            heightMil > 0 &&
            PcbScene3dStaticBodyRecovery.#hasToken(
                tokens,
                PcbScene3dStaticBodyRecovery.#COVER_SIDE_IDENTITY_TOKENS
            ) &&
            PcbScene3dStaticBodyRecovery.#hasToken(
                tokens,
                PcbScene3dStaticBodyRecovery.#COVER_FAMILY_IDENTITY_TOKENS
            )
        )
    }

    /**
     * Resolves the source-coordinate bounds for an inferred cover top.
     * @param {object} componentBody Recoverable cover-top body.
     * @param {object[]} componentBodies All component bodies.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #coverTopRecoveryBounds(componentBody, componentBodies) {
        const source =
            PcbScene3dStaticBodyRecovery.#sourcePosition(componentBody)
        const topTokens =
            PcbScene3dStaticBodyRecovery.#identityTokenSet(componentBody)
        const candidates = (
            Array.isArray(componentBodies) ? componentBodies : []
        )
            .filter(
                (candidate) =>
                    candidate !== componentBody &&
                    PcbScene3dStaticBodyRecovery.#isCoverSideBody(
                        candidate,
                        topTokens
                    )
            )
            .map((candidate) => ({
                bounds: PcbScene3dStaticBodyRecovery.#geometryBounds(
                    candidate?.staticGeometry?.verticesMil
                ),
                candidate
            }))
            .filter(({ bounds }) =>
                PcbScene3dStaticBodyRecovery.#boundsOverlapPointAxis(
                    bounds,
                    source
                )
            )
            .map(({ bounds, candidate }) => ({
                bounds,
                candidate,
                distance:
                    PcbScene3dStaticBodyRecovery.#distanceBetweenPointAndBoundsCenter(
                        source,
                        bounds
                    )
            }))
            .sort((left, right) => left.distance - right.distance)

        if (candidates.length < 2) {
            return null
        }

        const closestDistance = candidates[0].distance
        const groupedCandidates = candidates.filter(
            (candidate) =>
                candidate.distance <=
                closestDistance +
                    PcbScene3dStaticBodyRecovery
                        .#COVER_SIDE_CLUSTER_TOLERANCE_MIL
        )
        if (groupedCandidates.length < 2) {
            return null
        }

        const bounds = PcbScene3dStaticBodyRecovery.#mergeBounds(
            groupedCandidates.map((candidate) => candidate.bounds)
        )
        if (
            !bounds ||
            !PcbScene3dStaticBodyRecovery.#boundsContainPoint(bounds, source)
        ) {
            return null
        }

        return bounds
    }

    /**
     * Resolves the source-coordinate bounds for an inferred cover side.
     * @param {object} componentBody Recoverable cover-side body.
     * @param {object[]} componentBodies All component bodies after top recovery.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #coverSideRecoveryBounds(componentBody, componentBodies) {
        const source =
            PcbScene3dStaticBodyRecovery.#sourcePosition(componentBody)
        const sideTokens =
            PcbScene3dStaticBodyRecovery.#identityTokenSet(componentBody)
        const topCandidates = (
            Array.isArray(componentBodies) ? componentBodies : []
        )
            .filter(
                (candidate) =>
                    candidate !== componentBody &&
                    PcbScene3dStaticBodyRecovery.#isCoverTopBody(
                        candidate,
                        sideTokens
                    )
            )
            .map((candidate) => ({
                bounds: PcbScene3dStaticBodyRecovery.#geometryBounds(
                    candidate?.staticGeometry?.verticesMil
                ),
                candidate
            }))
            .filter(({ bounds }) =>
                PcbScene3dStaticBodyRecovery.#boundsContainPointWithTolerance(
                    bounds,
                    source,
                    PcbScene3dStaticBodyRecovery.#COVER_SIDE_EDGE_TOLERANCE_MIL
                )
            )
            .map(({ bounds, candidate }) => ({
                bounds,
                candidate,
                distance:
                    PcbScene3dStaticBodyRecovery.#distanceBetweenPointAndBoundsCenter(
                        source,
                        bounds
                    )
            }))
            .sort((left, right) => left.distance - right.distance)

        if (!topCandidates.length) {
            return null
        }

        const topBounds = topCandidates[0].bounds
        const edge = PcbScene3dStaticBodyRecovery.#nearestCoverEdge(
            source,
            topBounds
        )
        if (
            !edge ||
            edge.distance >
                PcbScene3dStaticBodyRecovery.#COVER_SIDE_EDGE_TOLERANCE_MIL
        ) {
            return null
        }

        const thickness = PcbScene3dStaticBodyRecovery.#coverSideThickness(
            componentBody,
            componentBodies,
            edge
        )
        if (
            !Number.isFinite(thickness) ||
            thickness <
                PcbScene3dStaticBodyRecovery.#COVER_SIDE_MIN_THICKNESS_MIL
        ) {
            return null
        }

        return PcbScene3dStaticBodyRecovery.#coverSideBoundsFromTopBounds(
            topBounds,
            edge.name,
            thickness
        )
    }

    /**
     * Checks whether one complete static body can contribute cover-side bounds.
     * @param {object | undefined} componentBody Candidate side body.
     * @param {Set<string>} topTokens Recoverable top identity tokens.
     * @returns {boolean}
     */
    static #isCoverSideBody(componentBody, topTokens) {
        const geometry = componentBody?.staticGeometry
        const tokens =
            PcbScene3dStaticBodyRecovery.#identityTokenSet(componentBody)

        return (
            String(geometry?.kind || '').toLowerCase() === 'extruded-polygon' &&
            geometry?.status === 'complete' &&
            PcbScene3dStaticBodyRecovery.#hasToken(
                tokens,
                PcbScene3dStaticBodyRecovery.#COVER_SIDE_IDENTITY_TOKENS
            ) &&
            PcbScene3dStaticBodyRecovery.#sharesToken(
                tokens,
                topTokens,
                PcbScene3dStaticBodyRecovery.#COVER_FAMILY_IDENTITY_TOKENS
            )
        )
    }

    /**
     * Checks whether one complete static body can contribute cover-top bounds.
     * @param {object | undefined} componentBody Candidate top body.
     * @param {Set<string>} sideTokens Recoverable side identity tokens.
     * @returns {boolean}
     */
    static #isCoverTopBody(componentBody, sideTokens) {
        const geometry = componentBody?.staticGeometry
        const tokens =
            PcbScene3dStaticBodyRecovery.#identityTokenSet(componentBody)

        return (
            String(geometry?.kind || '').toLowerCase() === 'extruded-polygon' &&
            geometry?.status === 'complete' &&
            PcbScene3dStaticBodyRecovery.#hasToken(
                tokens,
                PcbScene3dStaticBodyRecovery.#COVER_TOP_IDENTITY_TOKENS
            ) &&
            PcbScene3dStaticBodyRecovery.#sharesToken(
                tokens,
                sideTokens,
                PcbScene3dStaticBodyRecovery.#COVER_FAMILY_IDENTITY_TOKENS
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
            .replace(/([a-z])([A-Z])/gu, '$1 $2')
            .toLowerCase()
            .split(/[^a-z0-9]+/g)
            .flatMap((fragment) => fragment.match(/[a-z]+|\d+/g) || [])
            .filter(Boolean)
    }

    /**
     * Collects normalized identity tokens into a set.
     * @param {{ identifier?: string, name?: string }} componentBody Component body.
     * @returns {Set<string>}
     */
    static #identityTokenSet(componentBody) {
        return new Set(
            PcbScene3dStaticBodyRecovery.#identityTokens(componentBody)
        )
    }

    /**
     * Checks whether any expected token is present.
     * @param {Set<string>} tokens Candidate tokens.
     * @param {Set<string>} expectedTokens Expected token set.
     * @returns {boolean}
     */
    static #hasToken(tokens, expectedTokens) {
        return [...expectedTokens].some((token) => tokens.has(token))
    }

    /**
     * Checks whether two token sets share a token from an allowed family.
     * @param {Set<string>} leftTokens First token set.
     * @param {Set<string>} rightTokens Second token set.
     * @param {Set<string>} allowedTokens Allowed shared tokens.
     * @returns {boolean}
     */
    static #sharesToken(leftTokens, rightTokens, allowedTokens) {
        return [...allowedTokens].some(
            (token) => leftTokens.has(token) && rightTokens.has(token)
        )
    }

    /**
     * Resolves axis-aligned bounds for a vertex list.
     * @param {{ x?: number, y?: number }[] | undefined} vertices Vertices.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #geometryBounds(vertices) {
        const points = (Array.isArray(vertices) ? vertices : [])
            .map((vertex) => ({
                x: Number(vertex?.x || 0),
                y: Number(vertex?.y || 0)
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )

        if (points.length < 3) {
            return null
        }

        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys)
        }
    }

    /**
     * Checks whether a point overlaps at least one bounds axis.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Bounds.
     * @param {{ x: number, y: number }} point Point.
     * @returns {boolean}
     */
    static #boundsOverlapPointAxis(bounds, point) {
        if (!bounds) {
            return false
        }

        return (
            (point.x >= bounds.minX && point.x <= bounds.maxX) ||
            (point.y >= bounds.minY && point.y <= bounds.maxY)
        )
    }

    /**
     * Measures distance between a point and the center of bounds.
     * @param {{ x: number, y: number }} point Point.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Bounds.
     * @returns {number}
     */
    static #distanceBetweenPointAndBoundsCenter(point, bounds) {
        return Math.hypot(
            point.x - (bounds.minX + bounds.maxX) / 2,
            point.y - (bounds.minY + bounds.maxY) / 2
        )
    }

    /**
     * Merges several axis-aligned bounds records.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }[]} boundsList Bounds records.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #mergeBounds(boundsList) {
        const normalized = (Array.isArray(boundsList) ? boundsList : []).filter(
            Boolean
        )
        if (!normalized.length) {
            return null
        }

        return {
            minX: Math.min(...normalized.map((bounds) => bounds.minX)),
            minY: Math.min(...normalized.map((bounds) => bounds.minY)),
            maxX: Math.max(...normalized.map((bounds) => bounds.maxX)),
            maxY: Math.max(...normalized.map((bounds) => bounds.maxY))
        }
    }

    /**
     * Checks whether bounds contain a point and describe real area.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Bounds.
     * @param {{ x: number, y: number }} point Point.
     * @returns {boolean}
     */
    static #boundsContainPoint(bounds, point) {
        return (
            bounds.maxX > bounds.minX &&
            bounds.maxY > bounds.minY &&
            point.x >= bounds.minX &&
            point.x <= bounds.maxX &&
            point.y >= bounds.minY &&
            point.y <= bounds.maxY
        )
    }

    /**
     * Checks whether bounds contain a point with an expansion tolerance.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Bounds.
     * @param {{ x: number, y: number }} point Point.
     * @param {number} toleranceMil Expansion tolerance.
     * @returns {boolean}
     */
    static #boundsContainPointWithTolerance(bounds, point, toleranceMil) {
        if (
            !bounds ||
            bounds.maxX <= bounds.minX ||
            bounds.maxY <= bounds.minY
        ) {
            return false
        }

        const tolerance = Math.max(Number(toleranceMil || 0), 0)

        return (
            point.x >= bounds.minX - tolerance &&
            point.x <= bounds.maxX + tolerance &&
            point.y >= bounds.minY - tolerance &&
            point.y <= bounds.maxY + tolerance
        )
    }

    /**
     * Resolves the nearest top-bound edge to a side anchor.
     * @param {{ x: number, y: number }} point Side anchor.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Top bounds.
     * @returns {{ name: 'left' | 'right' | 'bottom' | 'top', distance: number } | null}
     */
    static #nearestCoverEdge(point, bounds) {
        if (!bounds) {
            return null
        }

        return [
            { name: 'left', distance: Math.abs(point.x - bounds.minX) },
            { name: 'right', distance: Math.abs(point.x - bounds.maxX) },
            { name: 'bottom', distance: Math.abs(point.y - bounds.minY) },
            { name: 'top', distance: Math.abs(point.y - bounds.maxY) }
        ].sort((left, right) => left.distance - right.distance)[0]
    }

    /**
     * Resolves recovered cover-side wall thickness.
     * @param {object} componentBody Recoverable side body.
     * @param {object[]} componentBodies All component bodies after top recovery.
     * @param {{ distance: number }} edge Nearest top-bound edge.
     * @returns {number}
     */
    static #coverSideThickness(componentBody, componentBodies, edge) {
        const templateThickness =
            PcbScene3dStaticBodyRecovery.#matchingCompleteSideThickness(
                componentBody,
                componentBodies
            )
        if (templateThickness !== null) {
            return templateThickness
        }

        const inferredThickness = Number(edge?.distance || 0) * 2

        return inferredThickness >=
            PcbScene3dStaticBodyRecovery.#COVER_SIDE_MIN_THICKNESS_MIL
            ? inferredThickness
            : PcbScene3dStaticBodyRecovery.#COVER_SIDE_DEFAULT_THICKNESS_MIL
    }

    /**
     * Finds a complete same-model side wall and reuses its minor span.
     * @param {object} componentBody Recoverable side body.
     * @param {object[]} componentBodies All component bodies after top recovery.
     * @returns {number | null}
     */
    static #matchingCompleteSideThickness(componentBody, componentBodies) {
        const identityKey =
            PcbScene3dStaticBodyRecovery.#bodyModelIdentityKey(componentBody)
        if (!identityKey) {
            return null
        }

        const tokens =
            PcbScene3dStaticBodyRecovery.#identityTokenSet(componentBody)
        const matchingSide = (
            Array.isArray(componentBodies) ? componentBodies : []
        ).find(
            (candidate) =>
                candidate !== componentBody &&
                PcbScene3dStaticBodyRecovery.#bodyModelIdentityKey(
                    candidate
                ) === identityKey &&
                PcbScene3dStaticBodyRecovery.#isCoverSideBody(candidate, tokens)
        )
        const bounds = PcbScene3dStaticBodyRecovery.#geometryBounds(
            matchingSide?.staticGeometry?.verticesMil
        )
        if (!bounds) {
            return null
        }

        const thickness = Math.min(
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        )

        return Number.isFinite(thickness) &&
            thickness >=
                PcbScene3dStaticBodyRecovery.#COVER_SIDE_MIN_THICKNESS_MIL
            ? thickness
            : null
    }

    /**
     * Builds a same-model identity key for side thickness lookup.
     * @param {{ modelId?: string, checksum?: number | string }} componentBody Component body.
     * @returns {string}
     */
    static #bodyModelIdentityKey(componentBody) {
        return [componentBody?.modelId, componentBody?.checksum]
            .map((value) =>
                String(value ?? '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)
            .join('|')
    }

    /**
     * Builds one side-wall bounds record from top bounds and edge name.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Top bounds.
     * @param {'left' | 'right' | 'bottom' | 'top'} edgeName Edge name.
     * @param {number} thickness Side-wall thickness.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #coverSideBoundsFromTopBounds(bounds, edgeName, thickness) {
        if (!bounds || !Number.isFinite(thickness) || thickness <= 0) {
            return null
        }

        switch (edgeName) {
            case 'left':
                return {
                    minX: bounds.minX,
                    maxX: bounds.minX + thickness,
                    minY: bounds.minY,
                    maxY: bounds.maxY
                }
            case 'right':
                return {
                    minX: bounds.maxX - thickness,
                    maxX: bounds.maxX,
                    minY: bounds.minY,
                    maxY: bounds.maxY
                }
            case 'bottom':
                return {
                    minX: bounds.minX,
                    maxX: bounds.maxX,
                    minY: bounds.minY,
                    maxY: bounds.minY + thickness
                }
            case 'top':
                return {
                    minX: bounds.minX,
                    maxX: bounds.maxX,
                    minY: bounds.maxY - thickness,
                    maxY: bounds.maxY
                }
            default:
                return null
        }
    }

    /**
     * Converts bounds to a clockwise polygon.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Bounds.
     * @returns {{ x: number, y: number }[]}
     */
    static #boundsToVertices(bounds) {
        return [
            { x: bounds.minX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.maxY },
            { x: bounds.minX, y: bounds.maxY }
        ]
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
}
