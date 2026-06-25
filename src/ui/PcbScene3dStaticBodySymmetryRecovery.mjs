// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Recovers incomplete static-body rows from symmetric sibling geometry.
 */
export class PcbScene3dStaticBodySymmetryRecovery {
    static #RECOVERY_TOLERANCE_MIL = 5
    static #MIRROR_MIN_OFFSET_MIL = 20
    static #FRAME_EDGE_TOLERANCE_MIL = 80
    static #FRAME_SIDE_MIN_THICKNESS_MIL = 1

    /**
     * Recovers same-family symmetric rows and inferred frame sides.
     * @param {object[] | undefined} componentBodies Component bodies.
     * @param {(object | null)[] | undefined} bodyMatches Matched owners.
     * @returns {object[]}
     */
    static recover(componentBodies, bodyMatches = []) {
        const bodies = Array.isArray(componentBodies) ? componentBodies : []
        const matches = Array.isArray(bodyMatches) ? bodyMatches : []
        const siblingRecoveredBodies = bodies.map((componentBody, index) =>
            PcbScene3dStaticBodySymmetryRecovery.#recoverSiblingGeometry(
                componentBody,
                index,
                bodies,
                matches
            )
        )

        return siblingRecoveredBodies.map((componentBody, index) =>
            PcbScene3dStaticBodySymmetryRecovery.#recoverFrameSideGeometry(
                componentBody,
                index,
                siblingRecoveredBodies,
                matches
            )
        )
    }

    /**
     * Copies complete sibling vertices when an incomplete row is mirrored.
     * @param {object} componentBody Target body.
     * @param {number} index Target index.
     * @param {object[]} componentBodies All original bodies.
     * @param {(object | null)[]} bodyMatches Matched owners.
     * @returns {object}
     */
    static #recoverSiblingGeometry(
        componentBody,
        index,
        componentBodies,
        bodyMatches
    ) {
        if (
            !PcbScene3dStaticBodySymmetryRecovery.#isIncompleteExtrudedPolygon(
                componentBody
            )
        ) {
            return componentBody
        }

        const candidate =
            PcbScene3dStaticBodySymmetryRecovery.#siblingRecoveryCandidates(
                componentBody,
                index,
                componentBodies,
                bodyMatches
            )[0]
        if (
            !candidate ||
            candidate.distance >
                PcbScene3dStaticBodySymmetryRecovery.#RECOVERY_TOLERANCE_MIL
        ) {
            return componentBody
        }

        return PcbScene3dStaticBodySymmetryRecovery.#withRecoveredVertices(
            componentBody,
            candidate.componentBody?.staticGeometry?.verticesMil
        )
    }

    /**
     * Infers missing orthogonal frame sides from complete same-family rows.
     * @param {object} componentBody Target body.
     * @param {number} index Target index.
     * @param {object[]} componentBodies Bodies after sibling recovery.
     * @param {(object | null)[]} bodyMatches Matched owners.
     * @returns {object}
     */
    static #recoverFrameSideGeometry(
        componentBody,
        index,
        componentBodies,
        bodyMatches
    ) {
        if (
            !PcbScene3dStaticBodySymmetryRecovery.#isIncompleteExtrudedPolygon(
                componentBody
            ) ||
            !PcbScene3dStaticBodySymmetryRecovery.#hasFrameIdentity(
                componentBody
            )
        ) {
            return componentBody
        }

        const source =
            PcbScene3dStaticBodySymmetryRecovery.#sourcePosition(componentBody)
        const entries =
            PcbScene3dStaticBodySymmetryRecovery.#completeFrameSiblingEntries(
                componentBody,
                index,
                componentBodies,
                bodyMatches
            )
        if (entries.length < 2) {
            return componentBody
        }

        const groupBounds = PcbScene3dStaticBodySymmetryRecovery.#mergeBounds(
            entries.map((entry) => entry.bounds)
        )
        const edge = PcbScene3dStaticBodySymmetryRecovery.#nearestFrameEdge(
            source,
            groupBounds
        )
        if (
            !edge ||
            edge.distance >
                PcbScene3dStaticBodySymmetryRecovery.#FRAME_EDGE_TOLERANCE_MIL
        ) {
            return componentBody
        }

        const thickness =
            PcbScene3dStaticBodySymmetryRecovery.#frameSideThickness(entries)
        const bounds =
            PcbScene3dStaticBodySymmetryRecovery.#frameSideBoundsFromSource(
                source,
                groupBounds,
                edge.name,
                thickness
            )
        if (!bounds) {
            return componentBody
        }

        return PcbScene3dStaticBodySymmetryRecovery.#withRecoveredVertices(
            componentBody,
            PcbScene3dStaticBodySymmetryRecovery.#boundsToVertices(bounds)
        )
    }

    /**
     * Finds complete same-family sibling rows ordered by symmetry distance.
     * @param {object} componentBody Target body.
     * @param {number} index Target index.
     * @param {object[]} componentBodies All bodies.
     * @param {(object | null)[]} bodyMatches Matched owners.
     * @returns {{ componentBody: object, distance: number }[]}
     */
    static #siblingRecoveryCandidates(
        componentBody,
        index,
        componentBodies,
        bodyMatches
    ) {
        return componentBodies
            .map((candidate, candidateIndex) => ({
                candidate,
                candidateIndex
            }))
            .filter(
                ({ candidate, candidateIndex }) =>
                    candidateIndex !== index &&
                    PcbScene3dStaticBodySymmetryRecovery.#isCompleteExtrudedPolygon(
                        candidate
                    ) &&
                    PcbScene3dStaticBodySymmetryRecovery.#canShareGeometry(
                        componentBody,
                        candidate,
                        index,
                        candidateIndex,
                        bodyMatches
                    )
            )
            .map(({ candidate, candidateIndex }) => ({
                componentBody: candidate,
                distance: PcbScene3dStaticBodySymmetryRecovery.#siblingDistance(
                    componentBody,
                    candidate,
                    index,
                    candidateIndex,
                    bodyMatches
                )
            }))
            .sort((left, right) => left.distance - right.distance)
    }

    /**
     * Returns complete same-family rows with source-effective bounds.
     * @param {object} componentBody Target body.
     * @param {number} index Target index.
     * @param {object[]} componentBodies Bodies after sibling recovery.
     * @param {(object | null)[]} bodyMatches Matched owners.
     * @returns {{ componentBody: object, bounds: object }[]}
     */
    static #completeFrameSiblingEntries(
        componentBody,
        index,
        componentBodies,
        bodyMatches
    ) {
        return componentBodies
            .map((candidate, candidateIndex) => ({
                candidate,
                candidateIndex
            }))
            .filter(
                ({ candidate, candidateIndex }) =>
                    candidateIndex !== index &&
                    PcbScene3dStaticBodySymmetryRecovery.#isCompleteExtrudedPolygon(
                        candidate
                    ) &&
                    PcbScene3dStaticBodySymmetryRecovery.#canShareGeometry(
                        componentBody,
                        candidate,
                        index,
                        candidateIndex,
                        bodyMatches
                    )
            )
            .map(({ candidate, candidateIndex }) => ({
                componentBody: candidate,
                bounds: PcbScene3dStaticBodySymmetryRecovery.#effectiveGeometryBounds(
                    candidate,
                    bodyMatches[candidateIndex]
                )
            }))
            .filter((entry) => Boolean(entry.bounds))
    }

    /**
     * Checks whether two rows can share recovered static geometry.
     * @param {object} left Left body.
     * @param {object} right Right body.
     * @param {number} leftIndex Left body index.
     * @param {number} rightIndex Right body index.
     * @param {(object | null)[]} bodyMatches Matched owners.
     * @returns {boolean}
     */
    static #canShareGeometry(left, right, leftIndex, rightIndex, bodyMatches) {
        return (
            PcbScene3dStaticBodySymmetryRecovery.#sameBodyFamily(left, right) &&
            PcbScene3dStaticBodySymmetryRecovery.#compatibleLayers(
                left,
                right
            ) &&
            PcbScene3dStaticBodySymmetryRecovery.#sameComponentIndex(
                left,
                right
            ) &&
            PcbScene3dStaticBodySymmetryRecovery.#sameMatchedOwner(
                bodyMatches[leftIndex],
                bodyMatches[rightIndex]
            )
        )
    }

    /**
     * Measures the closest direct or owner-mirrored center distance.
     * @param {object} componentBody Target body.
     * @param {object} candidate Complete candidate body.
     * @param {number} index Target index.
     * @param {number} candidateIndex Candidate index.
     * @param {(object | null)[]} bodyMatches Matched owners.
     * @returns {number}
     */
    static #siblingDistance(
        componentBody,
        candidate,
        index,
        candidateIndex,
        bodyMatches
    ) {
        const source =
            PcbScene3dStaticBodySymmetryRecovery.#sourcePosition(componentBody)
        const bounds = PcbScene3dStaticBodySymmetryRecovery.#geometryBounds(
            candidate?.staticGeometry?.verticesMil
        )
        const center =
            PcbScene3dStaticBodySymmetryRecovery.#boundsCenter(bounds)
        const owner = bodyMatches[index] || bodyMatches[candidateIndex] || null
        const centers =
            PcbScene3dStaticBodySymmetryRecovery.#candidateMirrorCenters(
                center,
                owner
            )

        return Math.min(
            ...centers.map((candidateCenter) =>
                Math.hypot(
                    source.x - candidateCenter.x,
                    source.y - candidateCenter.y
                )
            )
        )
    }

    /**
     * Builds direct and mirrored candidate centers around an owner.
     * @param {{ x: number, y: number } | null} center Raw bounds center.
     * @param {{ x?: number, y?: number } | null} owner Matched owner.
     * @returns {{ x: number, y: number }[]}
     */
    static #candidateMirrorCenters(center, owner) {
        if (!center) {
            return []
        }

        const ownerX = Number(owner?.x)
        const ownerY = Number(owner?.y)
        const xValues = [center.x]
        const yValues = [center.y]
        if (Number.isFinite(ownerX)) {
            xValues.push(2 * ownerX - center.x)
        }
        if (Number.isFinite(ownerY)) {
            yValues.push(2 * ownerY - center.y)
        }

        return xValues.flatMap((x) => yValues.map((y) => ({ x, y })))
    }

    /**
     * Resolves bounds after applying the source-coordinate mirror transform.
     * @param {object} componentBody Candidate body.
     * @param {{ x?: number, y?: number } | null} matchedComponent Owner.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #effectiveGeometryBounds(componentBody, matchedComponent) {
        const vertices = componentBody?.staticGeometry?.verticesMil
        const bounds =
            PcbScene3dStaticBodySymmetryRecovery.#geometryBounds(vertices)
        if (
            !bounds ||
            !PcbScene3dStaticBodySymmetryRecovery.#usesSourceCoordinateFrame(
                componentBody,
                vertices
            )
        ) {
            return bounds
        }

        const mirror =
            PcbScene3dStaticBodySymmetryRecovery.#sourceCoordinateMirror(
                componentBody,
                PcbScene3dStaticBodySymmetryRecovery.#boundsCenter(bounds),
                matchedComponent
            )

        return mirror
            ? PcbScene3dStaticBodySymmetryRecovery.#mirrorBounds(bounds, mirror)
            : bounds
    }

    /**
     * Resolves owner-axis mirrors for a source-coordinate body.
     * @param {object} componentBody Candidate body.
     * @param {{ x: number, y: number }} boundsCenter Raw bounds center.
     * @param {{ x?: number, y?: number } | null} matchedComponent Owner.
     * @returns {{ mirrorAxisX?: number, mirrorAxisY?: number } | null}
     */
    static #sourceCoordinateMirror(
        componentBody,
        boundsCenter,
        matchedComponent
    ) {
        const source =
            PcbScene3dStaticBodySymmetryRecovery.#sourcePosition(componentBody)
        const xDecision =
            PcbScene3dStaticBodySymmetryRecovery.#axisMirrorDecision(
                boundsCenter.x,
                source.x,
                Number(matchedComponent?.x)
            )
        const yDecision =
            PcbScene3dStaticBodySymmetryRecovery.#axisMirrorDecision(
                boundsCenter.y,
                source.y,
                Number(matchedComponent?.y)
            )

        if (
            !xDecision.valid ||
            !yDecision.valid ||
            (!xDecision.mirrored && !yDecision.mirrored)
        ) {
            return null
        }

        return {
            mirrorAxisX: xDecision.mirrored
                ? Number(matchedComponent?.x)
                : undefined,
            mirrorAxisY: yDecision.mirrored
                ? Number(matchedComponent?.y)
                : undefined
        }
    }

    /**
     * Decides whether one axis is aligned, mirrored, or invalid.
     * @param {number} center Raw center coordinate.
     * @param {number} source Source body coordinate.
     * @param {number} ownerAxis Owner coordinate.
     * @returns {{ valid: boolean, mirrored: boolean }}
     */
    static #axisMirrorDecision(center, source, ownerAxis) {
        const offset = Math.abs(Number(center || 0) - Number(source || 0))
        if (
            offset <=
            PcbScene3dStaticBodySymmetryRecovery.#RECOVERY_TOLERANCE_MIL
        ) {
            return { valid: true, mirrored: false }
        }

        const mirroredSource = 2 * Number(ownerAxis) - Number(center || 0)
        const mirrorError = Math.abs(mirroredSource - Number(source || 0))

        return {
            valid:
                Number.isFinite(ownerAxis) &&
                offset >
                    PcbScene3dStaticBodySymmetryRecovery
                        .#MIRROR_MIN_OFFSET_MIL &&
                mirrorError <=
                    PcbScene3dStaticBodySymmetryRecovery
                        .#RECOVERY_TOLERANCE_MIL,
            mirrored: true
        }
    }

    /**
     * Mirrors one bounds record around selected axes.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Bounds.
     * @param {{ mirrorAxisX?: number, mirrorAxisY?: number }} mirror Mirror axes.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #mirrorBounds(bounds, mirror) {
        const xValues = Number.isFinite(mirror?.mirrorAxisX)
            ? [
                  2 * mirror.mirrorAxisX - bounds.minX,
                  2 * mirror.mirrorAxisX - bounds.maxX
              ]
            : [bounds.minX, bounds.maxX]
        const yValues = Number.isFinite(mirror?.mirrorAxisY)
            ? [
                  2 * mirror.mirrorAxisY - bounds.minY,
                  2 * mirror.mirrorAxisY - bounds.maxY
              ]
            : [bounds.minY, bounds.maxY]

        return {
            minX: Math.min(...xValues),
            maxX: Math.max(...xValues),
            minY: Math.min(...yValues),
            maxY: Math.max(...yValues)
        }
    }

    /**
     * Finds the nearest frame edge to an incomplete row source.
     * @param {{ x: number, y: number }} point Source point.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Group bounds.
     * @returns {{ name: string, distance: number } | null}
     */
    static #nearestFrameEdge(point, bounds) {
        if (!bounds) {
            return null
        }

        const tolerance =
            PcbScene3dStaticBodySymmetryRecovery.#FRAME_EDGE_TOLERANCE_MIL
        return [
            {
                name: 'left',
                distance: Math.abs(point.x - bounds.minX),
                inSpan:
                    point.y >= bounds.minY - tolerance &&
                    point.y <= bounds.maxY + tolerance
            },
            {
                name: 'right',
                distance: Math.abs(point.x - bounds.maxX),
                inSpan:
                    point.y >= bounds.minY - tolerance &&
                    point.y <= bounds.maxY + tolerance
            },
            {
                name: 'bottom',
                distance: Math.abs(point.y - bounds.minY),
                inSpan:
                    point.x >= bounds.minX - tolerance &&
                    point.x <= bounds.maxX + tolerance
            },
            {
                name: 'top',
                distance: Math.abs(point.y - bounds.maxY),
                inSpan:
                    point.x >= bounds.minX - tolerance &&
                    point.x <= bounds.maxX + tolerance
            }
        ]
            .filter((edge) => edge.inSpan)
            .sort((left, right) => left.distance - right.distance)[0]
    }

    /**
     * Resolves frame side thickness from complete sibling minor spans.
     * @param {{ bounds: object }[]} entries Complete sibling entries.
     * @returns {number}
     */
    static #frameSideThickness(entries) {
        const thicknesses = entries
            .map((entry) =>
                Math.min(
                    entry.bounds.maxX - entry.bounds.minX,
                    entry.bounds.maxY - entry.bounds.minY
                )
            )
            .filter(
                (thickness) =>
                    Number.isFinite(thickness) &&
                    thickness >=
                        PcbScene3dStaticBodySymmetryRecovery
                            .#FRAME_SIDE_MIN_THICKNESS_MIL
            )

        return Math.min(...thicknesses)
    }

    /**
     * Builds source-coordinate bounds for a recovered frame side.
     * @param {{ x: number, y: number }} source Source point.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Group bounds.
     * @param {string} edgeName Edge name.
     * @param {number} thickness Side thickness.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #frameSideBoundsFromSource(source, bounds, edgeName, thickness) {
        if (!bounds || !Number.isFinite(thickness) || thickness <= 0) {
            return null
        }

        const halfThickness = thickness / 2
        if (edgeName === 'left' || edgeName === 'right') {
            return {
                minX: source.x - halfThickness,
                maxX: source.x + halfThickness,
                minY: bounds.minY,
                maxY: bounds.maxY
            }
        }
        if (edgeName === 'bottom' || edgeName === 'top') {
            return {
                minX: bounds.minX,
                maxX: bounds.maxX,
                minY: source.y - halfThickness,
                maxY: source.y + halfThickness
            }
        }

        return null
    }

    /**
     * Checks whether a body is an incomplete extruded polygon.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #isIncompleteExtrudedPolygon(componentBody) {
        const geometry = componentBody?.staticGeometry

        return (
            String(geometry?.kind || '').toLowerCase() === 'extruded-polygon' &&
            geometry?.status !== 'complete' &&
            (!Array.isArray(geometry?.verticesMil) ||
                geometry.verticesMil.length < 3) &&
            Number(geometry?.heightMil) > 0
        )
    }

    /**
     * Checks whether a body is a complete extruded polygon.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #isCompleteExtrudedPolygon(componentBody) {
        const geometry = componentBody?.staticGeometry

        return (
            String(geometry?.kind || '').toLowerCase() === 'extruded-polygon' &&
            geometry?.status === 'complete' &&
            Array.isArray(geometry?.verticesMil) &&
            geometry.verticesMil.length >= 3
        )
    }

    /**
     * Checks whether a row identity describes a generic frame piece.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #hasFrameIdentity(componentBody) {
        return PcbScene3dStaticBodySymmetryRecovery.#identityTokens(
            componentBody
        ).some((token) => token === 'frame')
    }

    /**
     * Checks whether two bodies have equivalent row family metadata.
     * @param {object} left Left body.
     * @param {object} right Right body.
     * @returns {boolean}
     */
    static #sameBodyFamily(left, right) {
        const leftKey =
            PcbScene3dStaticBodySymmetryRecovery.#bodyFamilyKey(left)
        const rightKey =
            PcbScene3dStaticBodySymmetryRecovery.#bodyFamilyKey(right)

        return Boolean(leftKey && leftKey === rightKey)
    }

    /**
     * Builds a row-family key for symmetric geometry reuse.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {string}
     */
    static #bodyFamilyKey(componentBody) {
        const geometry = componentBody?.staticGeometry || {}
        const identityKey = [componentBody?.identifier, componentBody?.name]
            .map((value) =>
                String(value ?? '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)
            .join('|')
        const anonymousModelKey = identityKey
            ? ''
            : [componentBody?.modelId, componentBody?.checksum]
                  .map((value) =>
                      String(value ?? '')
                          .trim()
                          .toLowerCase()
                  )
                  .filter(Boolean)
                  .join('|')
        const bodyIdentityKey = identityKey || anonymousModelKey
        if (!bodyIdentityKey) {
            return ''
        }

        return [
            bodyIdentityKey,
            geometry.kind,
            PcbScene3dStaticBodySymmetryRecovery.#numberKey(geometry.heightMil),
            PcbScene3dStaticBodySymmetryRecovery.#numberKey(
                geometry.standoffHeightMil ?? componentBody?.standoffHeightMil
            )
        ]
            .map((value) =>
                String(value ?? '')
                    .trim()
                    .toLowerCase()
            )
            .join('|')
    }

    /**
     * Checks whether explicit mechanical layer values are compatible.
     * @param {object | undefined} left Left body.
     * @param {object | undefined} right Right body.
     * @returns {boolean}
     */
    static #compatibleLayers(left, right) {
        const leftLayer = String(left?.layer || '')
            .trim()
            .toLowerCase()
        const rightLayer = String(right?.layer || '')
            .trim()
            .toLowerCase()

        return !leftLayer || !rightLayer || leftLayer === rightLayer
    }

    /**
     * Checks whether explicit component indexes are compatible.
     * @param {object} left Left body.
     * @param {object} right Right body.
     * @returns {boolean}
     */
    static #sameComponentIndex(left, right) {
        const leftIndex = Number(left?.componentIndex)
        const rightIndex = Number(right?.componentIndex)

        return (
            !Number.isInteger(leftIndex) ||
            !Number.isInteger(rightIndex) ||
            leftIndex === rightIndex
        )
    }

    /**
     * Checks whether matched owners are compatible.
     * @param {object | null | undefined} leftOwner Left owner.
     * @param {object | null | undefined} rightOwner Right owner.
     * @returns {boolean}
     */
    static #sameMatchedOwner(leftOwner, rightOwner) {
        if (!leftOwner || !rightOwner) {
            return true
        }

        return (
            String(leftOwner.designator || '') ===
            String(rightOwner.designator || '')
        )
    }

    /**
     * Checks whether polygon vertices use source coordinates.
     * @param {object} componentBody Component body.
     * @param {{ x?: number, y?: number }[] | undefined} vertices Vertices.
     * @returns {boolean}
     */
    static #usesSourceCoordinateFrame(componentBody, vertices) {
        const bounds =
            PcbScene3dStaticBodySymmetryRecovery.#geometryBounds(vertices)
        const source =
            PcbScene3dStaticBodySymmetryRecovery.#sourcePosition(componentBody)
        if (!bounds) {
            return false
        }

        return (
            Math.max(
                Math.abs(bounds.minX),
                Math.abs(bounds.maxX),
                Math.abs(bounds.minY),
                Math.abs(bounds.maxY),
                Math.abs(source.x),
                Math.abs(source.y)
            ) > 1000
        )
    }

    /**
     * Returns a source position for one body.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {{ x: number, y: number }}
     */
    static #sourcePosition(componentBody) {
        return {
            x: Number(componentBody?.positionMil?.x || 0),
            y: Number(componentBody?.positionMil?.y || 0)
        }
    }

    /**
     * Resolves axis-aligned bounds for vertices.
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

        return {
            minX: Math.min(...points.map((point) => point.x)),
            maxX: Math.max(...points.map((point) => point.x)),
            minY: Math.min(...points.map((point) => point.y)),
            maxY: Math.max(...points.map((point) => point.y))
        }
    }

    /**
     * Resolves the center of bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Bounds.
     * @returns {{ x: number, y: number } | null}
     */
    static #boundsCenter(bounds) {
        return bounds
            ? {
                  x: (bounds.minX + bounds.maxX) / 2,
                  y: (bounds.minY + bounds.maxY) / 2
              }
            : null
    }

    /**
     * Merges bounds records.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }[]} boundsList Bounds list.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #mergeBounds(boundsList) {
        const normalized = boundsList.filter(Boolean)
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
     * Converts bounds to clockwise polygon vertices.
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
     * Returns a cloned body with complete recovered vertices.
     * @param {object} componentBody Target body.
     * @param {{ x?: number, y?: number }[] | undefined} vertices Vertices.
     * @returns {object}
     */
    static #withRecoveredVertices(componentBody, vertices) {
        return {
            ...componentBody,
            staticGeometry: {
                ...componentBody.staticGeometry,
                status: 'complete',
                verticesMil: (Array.isArray(vertices) ? vertices : []).map(
                    (vertex) => ({
                        x: Number(vertex?.x || 0),
                        y: Number(vertex?.y || 0)
                    })
                )
            }
        }
    }

    /**
     * Converts a number into a stable key fragment.
     * @param {number | string | undefined | null} value Candidate value.
     * @returns {string}
     */
    static #numberKey(value) {
        const number = Number(value)

        return Number.isFinite(number)
            ? String(Math.round(number * 10000) / 10000)
            : ''
    }

    /**
     * Collects normalized identity tokens from one body row.
     * @param {object | undefined} componentBody Component body.
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
}
