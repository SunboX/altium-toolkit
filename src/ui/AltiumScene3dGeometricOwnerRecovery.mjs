// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumScene3dRecoverySpatialIndex } from './AltiumScene3dRecoverySpatialIndex.mjs'

/**
 * Recovers component ownership for Altium STEP bodies whose native rows omit
 * a direct owner reference.
 */
export class AltiumScene3dGeometricOwnerRecovery {
    static #ANCHOR_TOLERANCE_MIL = 8
    static #BODY_INDEX_CELL_MIL = 8
    static #COMPONENT_INDEX_CELL_MIL = 500
    static #MINIMUM_SCORE = 12
    static #MINIMUM_SCORE_MARGIN = 4
    static #PAD_CENTROID_TOLERANCE_MIL = 12

    /**
     * Applies geometry-backed owner recovery to final external placements.
     * @param {object} sceneDescription Built scene description.
     * @param {object} documentModel Parsed Altium document.
     * @returns {object}
     */
    static apply(sceneDescription, documentModel) {
        if (
            String(sceneDescription?.sourceFormat || '').toLowerCase() !==
                'altium' ||
            !Array.isArray(sceneDescription?.externalPlacements)
        ) {
            return sceneDescription
        }

        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        const bodies = Array.isArray(documentModel?.pcb?.componentBodies)
            ? documentModel.pcb.componentBodies
            : []
        const pads = Array.isArray(documentModel?.pcb?.pads)
            ? documentModel.pcb.pads
            : []
        if (!components.length || !bodies.length || !pads.length) {
            return sceneDescription
        }

        const componentsByDesignator = new Map(
            components.map((component) => [
                String(component?.designator || ''),
                component
            ])
        )
        const padsByComponent =
            AltiumScene3dRecoverySpatialIndex.padsByComponent(pads)
        const geometryByComponent = new Map(
            components.map((component) => [
                component,
                AltiumScene3dGeometricOwnerRecovery.#componentPadGeometry(
                    component,
                    padsByComponent.get(Number(component?.componentIndex)) || []
                )
            ])
        )
        const recoveryContext = {
            componentsByDesignator,
            bodyIndex: AltiumScene3dRecoverySpatialIndex.create(
                bodies,
                AltiumScene3dGeometricOwnerRecovery.#BODY_INDEX_CELL_MIL,
                (body) => body?.positionMil
            ),
            geometryByComponent,
            componentIndex: AltiumScene3dRecoverySpatialIndex.create(
                components
                    .map((component) => ({
                        component,
                        geometry: geometryByComponent.get(component)
                    }))
                    .filter(({ geometry }) => geometry),
                AltiumScene3dGeometricOwnerRecovery.#COMPONENT_INDEX_CELL_MIL,
                ({ component }) => component
            ),
            board: sceneDescription?.board
        }

        return {
            ...sceneDescription,
            externalPlacements: sceneDescription.externalPlacements.map(
                (placement) =>
                    AltiumScene3dGeometricOwnerRecovery.#recoverPlacement(
                        placement,
                        recoveryContext
                    )
            )
        }
    }

    /**
     * Recovers one placement or applies exact-owner package corrections.
     * @param {object} placement External placement.
     * @param {object} context Pre-indexed recovery data.
     * @returns {object}
     */
    static #recoverPlacement(placement, context) {
        const body = AltiumScene3dGeometricOwnerRecovery.#resolveComponentBody(
            placement,
            context.bodyIndex
        )
        if (!body) return placement

        const currentOwner = context.componentsByDesignator.get(
            String(placement?.designator || '')
        )
        if (currentOwner) return placement

        const match =
            AltiumScene3dGeometricOwnerRecovery.#resolveGeometricOwner(
                placement,
                body,
                context
            )
        if (!match) return placement

        return AltiumScene3dGeometricOwnerRecovery.#withOwner(
            placement,
            body,
            match,
            context.board
        )
    }

    /**
     * Resolves the source body row occupying a placement anchor.
     * @param {object} placement External placement.
     * @param {Map<string, object[]>} bodyIndex Spatial body index.
     * @returns {object | null}
     */
    static #resolveComponentBody(placement, bodyIndex) {
        const anchor = placement?.bodyPositionMil
        if (!anchor) return null

        const matches = AltiumScene3dRecoverySpatialIndex.nearby(
            bodyIndex,
            anchor,
            AltiumScene3dGeometricOwnerRecovery.#BODY_INDEX_CELL_MIL,
            1
        )
            .map((body) => ({
                body,
                distance: AltiumScene3dGeometricOwnerRecovery.#distance(
                    anchor,
                    body?.positionMil
                ),
                identity:
                    AltiumScene3dGeometricOwnerRecovery.#bodyIdentityScore(
                        placement,
                        body
                    )
            }))
            .filter(
                (candidate) =>
                    candidate.distance <=
                    AltiumScene3dGeometricOwnerRecovery.#ANCHOR_TOLERANCE_MIL
            )
            .sort(
                (left, right) =>
                    right.identity - left.identity ||
                    left.distance - right.distance
            )

        const best = matches[0]
        const second = matches[1]
        if (
            second &&
            best.identity === second.identity &&
            Math.abs(best.distance - second.distance) < 1e-6
        ) {
            return null
        }
        return best?.body || null
    }

    /**
     * Scores body identity without requiring vendor or library tokens.
     * @param {object} placement External placement.
     * @param {object} body Source body.
     * @returns {number}
     */
    static #bodyIdentityScore(placement, body) {
        const placementText =
            AltiumScene3dGeometricOwnerRecovery.#normalizeIdentity([
                placement?.designator,
                placement?.externalModel?.name
            ])
        const bodyText = AltiumScene3dGeometricOwnerRecovery.#normalizeIdentity(
            [body?.identifier, body?.name]
        )

        return placementText && bodyText && placementText.includes(bodyText)
            ? bodyText.length
            : 0
    }

    /**
     * Selects only components within the model-dependent recovery radius.
     * @param {object} placement External placement.
     * @param {Map<string, object[]>} componentIndex Component spatial index.
     * @returns {{ component: object, geometry: object }[]}
     */
    static #nearbyComponentGeometry(placement, componentIndex) {
        const longestModelDimension = Math.max(
            0,
            ...AltiumScene3dGeometricOwnerRecovery.#modelDimensions(placement)
        )
        const radiusMil = Math.max(300, longestModelDimension)
        const cellRadius = Math.ceil(
            radiusMil /
                AltiumScene3dGeometricOwnerRecovery.#COMPONENT_INDEX_CELL_MIL
        )
        return AltiumScene3dRecoverySpatialIndex.nearby(
            componentIndex,
            placement?.bodyPositionMil,
            AltiumScene3dGeometricOwnerRecovery.#COMPONENT_INDEX_CELL_MIL,
            cellRadius
        ).filter(
            ({ component }) =>
                AltiumScene3dGeometricOwnerRecovery.#distance(
                    placement?.bodyPositionMil,
                    component
                ) <= radiusMil
        )
    }

    /**
     * Resolves a unique geometry-backed owner candidate.
     * @param {object} placement External placement.
     * @param {object} body Source component body.
     * @param {object} context Pre-indexed recovery data.
     * @returns {{ component: object, mode: string, score: number } | null}
     */
    static #resolveGeometricOwner(placement, body, context) {
        const candidates =
            AltiumScene3dGeometricOwnerRecovery.#nearbyComponentGeometry(
                placement,
                context.componentIndex
            )
                .map(({ component, geometry }) =>
                    AltiumScene3dGeometricOwnerRecovery.#scoreCandidate(
                        placement,
                        body,
                        component,
                        geometry
                    )
                )
                .filter(Boolean)
                .sort(
                    (left, right) =>
                        right.score - left.score ||
                        left.distance - right.distance
                )
        const best = candidates[0]
        const second = candidates[1]

        if (
            !best ||
            best.score < AltiumScene3dGeometricOwnerRecovery.#MINIMUM_SCORE ||
            (second &&
                best.score - second.score <
                    AltiumScene3dGeometricOwnerRecovery.#MINIMUM_SCORE_MARGIN)
        ) {
            return null
        }

        return best
    }

    /**
     * Scores one candidate from owned pad geometry and source dimensions.
     * @param {object} placement External placement.
     * @param {object} body Source component body.
     * @param {object} component Candidate component.
     * @param {object | null} geometry Precomputed pad geometry.
     * @returns {{ component: object, mode: string, score: number, distance: number } | null}
     */
    static #scoreCandidate(placement, body, component, geometry) {
        if (!geometry || geometry.pads.length < 2) return null

        const anchor = placement?.bodyPositionMil || {}
        const distance = AltiumScene3dGeometricOwnerRecovery.#distance(
            anchor,
            component
        )
        const centroidDistance = AltiumScene3dGeometricOwnerRecovery.#distance(
            anchor,
            geometry.center
        )
        const corner = AltiumScene3dGeometricOwnerRecovery.#isModelCornerOrigin(
            placement,
            component,
            geometry
        )
        const rowOrigin = AltiumScene3dGeometricOwnerRecovery.#isMultiRowOrigin(
            placement,
            geometry
        )
        const heightAgreement =
            AltiumScene3dGeometricOwnerRecovery.#hasHeightAgreement(
                body,
                component
            )
        const nearFootprint =
            AltiumScene3dGeometricOwnerRecovery.#isNearFootprint(
                anchor,
                geometry,
                50
            )
        let score = 0
        let mode = ''

        if (
            centroidDistance <=
            AltiumScene3dGeometricOwnerRecovery.#PAD_CENTROID_TOLERANCE_MIL
        ) {
            score = 24
            mode = 'pad-centroid'
        } else if (corner) {
            score = 20
            mode = 'model-corner'
        } else if (rowOrigin) {
            score = 18
            mode = 'multi-row-origin'
        } else if (heightAgreement && nearFootprint && distance <= 250) {
            score = 14
            mode = 'height-backed-origin'
        }

        if (!score) return null
        if (heightAgreement) score += 2
        score += Math.max(0, 3 - distance / 100)

        return { component, mode, score, distance }
    }

    /**
     * Builds bounds and topology for pads owned by one component.
     * @param {object} component PCB component.
     * @param {object[]} ownedPads Pads already indexed to this component.
     * @returns {object | null}
     */
    static #componentPadGeometry(component, ownedPads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) return null
        if (!ownedPads.length) return null

        const centerXs = ownedPads.map((pad) => Number(pad?.x || 0))
        const centerYs = ownedPads.map((pad) => Number(pad?.y || 0))
        const center = {
            x:
                centerXs.reduce((sum, value) => sum + value, 0) /
                centerXs.length,
            y: centerYs.reduce((sum, value) => sum + value, 0) / centerYs.length
        }
        const localPads = ownedPads.map((pad) => ({
            source: pad,
            ...AltiumScene3dGeometricOwnerRecovery.#toLocalPoint(
                pad,
                center,
                component?.rotation
            )
        }))
        const localXs = localPads.map((pad) => pad.x)
        const localYs = localPads.map((pad) => pad.y)
        const minX = Math.min(
            ...ownedPads.map(
                (pad) =>
                    Number(pad?.x || 0) -
                    AltiumScene3dGeometricOwnerRecovery.#padWidth(pad) / 2
            )
        )
        const maxX = Math.max(
            ...ownedPads.map(
                (pad) =>
                    Number(pad?.x || 0) +
                    AltiumScene3dGeometricOwnerRecovery.#padWidth(pad) / 2
            )
        )
        const minY = Math.min(
            ...ownedPads.map(
                (pad) =>
                    Number(pad?.y || 0) -
                    AltiumScene3dGeometricOwnerRecovery.#padDepth(pad) / 2
            )
        )
        const maxY = Math.max(
            ...ownedPads.map(
                (pad) =>
                    Number(pad?.y || 0) +
                    AltiumScene3dGeometricOwnerRecovery.#padDepth(pad) / 2
            )
        )

        return {
            pads: ownedPads,
            localPads,
            center,
            bounds: { minX, maxX, minY, maxY },
            width: maxX - minX,
            depth: maxY - minY,
            xCount: AltiumScene3dGeometricOwnerRecovery.#distinctCoordinateCount(
                localXs
            ),
            yCount: AltiumScene3dGeometricOwnerRecovery.#distinctCoordinateCount(
                localYs
            )
        }
    }

    /**
     * Rotates one board point into the component-local footprint frame.
     * @param {object} point Board point.
     * @param {object} center Footprint center.
     * @param {unknown} rotationDeg Component rotation.
     * @returns {{ x: number, y: number }}
     */
    static #toLocalPoint(point, center, rotationDeg) {
        const radians =
            (-AltiumScene3dGeometricOwnerRecovery.#normalizeAngle(rotationDeg) *
                Math.PI) /
            180
        const dx = Number(point?.x || 0) - Number(center?.x || 0)
        const dy = Number(point?.y || 0) - Number(center?.y || 0)
        return {
            x: dx * Math.cos(radians) - dy * Math.sin(radians),
            y: dx * Math.sin(radians) + dy * Math.cos(radians)
        }
    }

    /**
     * Checks whether a body anchor is the opposite corner of measured model
     * dimensions from the component origin.
     * @param {object} placement External placement.
     * @param {object} component Candidate component.
     * @param {object} geometry Owned pad geometry.
     * @returns {boolean}
     */
    static #isModelCornerOrigin(placement, component, geometry) {
        const offsetDimensions = [
            Math.abs(
                Number(placement?.bodyPositionMil?.x || 0) -
                    Number(component?.x || 0)
            ) * 2,
            Math.abs(
                Number(placement?.bodyPositionMil?.y || 0) -
                    Number(component?.y || 0)
            ) * 2
        ]
        if (offsetDimensions.some((dimension) => dimension < 20)) return false

        const modelDimensions =
            AltiumScene3dGeometricOwnerRecovery.#modelDimensions(placement)
        const offsetMatchesModel =
            AltiumScene3dGeometricOwnerRecovery.#matchesDimensionPair(
                offsetDimensions,
                modelDimensions,
                0.12,
                25
            )
        const modelMatchesFootprint =
            AltiumScene3dGeometricOwnerRecovery.#matchesDimensionPair(
                [geometry.width, geometry.depth],
                modelDimensions,
                0.3,
                45
            )

        return offsetMatchesModel && modelMatchesFootprint
    }

    /**
     * Checks whether a multi-row footprint and model share the same long span.
     * @param {object} placement External placement.
     * @param {object} geometry Owned pad geometry.
     * @returns {boolean}
     */
    static #isMultiRowOrigin(placement, geometry) {
        const isGrid =
            geometry.pads.length >= 6 &&
            ((geometry.xCount >= 3 && geometry.yCount === 2) ||
                (geometry.yCount >= 3 && geometry.xCount === 2))
        if (!isGrid) return false
        if (
            !AltiumScene3dGeometricOwnerRecovery.#isNearFootprint(
                placement?.bodyPositionMil,
                geometry,
                10
            )
        ) {
            return false
        }

        const modelDimensions =
            AltiumScene3dGeometricOwnerRecovery.#modelDimensions(placement)
        const modelLong = Math.max(...modelDimensions)
        const footprintLong = Math.max(geometry.width, geometry.depth)

        return AltiumScene3dGeometricOwnerRecovery.#matchesDimension(
            modelLong,
            footprintLong,
            0.18,
            50
        )
    }

    /**
     * Checks whether source and component heights agree.
     * @param {object} body Source body.
     * @param {object} component Candidate component.
     * @returns {boolean}
     */
    static #hasHeightAgreement(body, component) {
        const sourceHeight = body?.overallHeightMil
        const componentHeight = component?.height
        if (
            sourceHeight === null ||
            sourceHeight === undefined ||
            sourceHeight === '' ||
            componentHeight === null ||
            componentHeight === undefined ||
            componentHeight === ''
        ) {
            return false
        }
        const normalizedSourceHeight = Number(sourceHeight)
        const normalizedComponentHeight = Number(componentHeight)
        if (
            !Number.isFinite(normalizedSourceHeight) ||
            normalizedSourceHeight <= 0 ||
            !Number.isFinite(normalizedComponentHeight) ||
            normalizedComponentHeight <= 0
        ) {
            return false
        }
        return AltiumScene3dGeometricOwnerRecovery.#matchesDimension(
            normalizedSourceHeight,
            normalizedComponentHeight,
            0.08,
            3
        )
    }

    /**
     * Applies a recovered owner and preserves only proven authored offsets.
     * @param {object} placement External placement.
     * @param {object} body Source body.
     * @param {{ component: object, mode: string }} match Owner match.
     * @param {object} board Board metadata.
     * @returns {object}
     */
    static #withOwner(placement, body, match, board) {
        const component = match.component
        const mountSide =
            AltiumScene3dGeometricOwnerRecovery.#componentSide(component)
        const preserveAnchor =
            match.mode === 'pad-centroid' ||
            match.mode === 'height-backed-origin'
        const offset = {
            x:
                Number(placement?.bodyPositionMil?.x || 0) -
                Number(component?.x || 0),
            y:
                Number(placement?.bodyPositionMil?.y || 0) -
                Number(component?.y || 0)
        }
        const verticalOffset =
            AltiumScene3dGeometricOwnerRecovery.#verticalOffset(
                body,
                mountSide,
                placement?.modelTransform
            )
        const modelTransform = {
            ...(placement?.modelTransform || {}),
            dzMil: verticalOffset
        }

        if (match.mode === 'height-backed-origin') {
            modelTransform.preserveSourceAnchor = true
        }

        if (!preserveAnchor) {
            modelTransform.ownerAnchorOffsetMil = offset
            modelTransform.offsetMil = { x: 0, y: 0, z: verticalOffset }
        } else if (modelTransform.offsetMil) {
            modelTransform.offsetMil = {
                ...modelTransform.offsetMil,
                z: verticalOffset
            }
        }

        return {
            ...placement,
            designator: String(component?.designator || placement.designator),
            mountSide,
            positionMil: {
                ...placement.positionMil,
                ...(preserveAnchor
                    ? {}
                    : {
                          x:
                              Number(component?.x || 0) -
                              Number(board?.centerX || 0),
                          y:
                              Number(component?.y || 0) -
                              Number(board?.centerY || 0)
                      }),
                z: AltiumScene3dGeometricOwnerRecovery.#faceZ(mountSide, board)
            },
            modelTransform
        }
    }

    /**
     * Resolves a body vertical offset after a late owner recovery.
     * @param {object} body Source body.
     * @param {'top' | 'bottom'} mountSide Recovered side.
     * @param {object} currentTransform Existing model transform.
     * @returns {number}
     */
    static #verticalOffset(body, mountSide, currentTransform) {
        const standoff = Number(body?.standoffHeightMil)
        const overallHeight = Number(body?.overallHeightMil)
        if (
            mountSide === 'top' &&
            Number.isFinite(standoff) &&
            standoff < 0 &&
            (!Number.isFinite(overallHeight) ||
                overallHeight <= 0 ||
                Math.abs(standoff) < overallHeight)
        ) {
            return standoff
        }
        if (Number.isFinite(standoff) && Math.abs(standoff) < 1e-6) return 0

        const current = Number(
            currentTransform?.offsetMil?.z ?? currentTransform?.dzMil ?? 0
        )
        return Number.isFinite(current) ? current : 0
    }

    /**
     * Returns measured model dimensions.
     * @param {object} placement External placement.
     * @returns {number[]}
     */
    static #modelDimensions(placement) {
        return [
            Number(placement?.projection?.boundsMil?.width),
            Number(placement?.projection?.boundsMil?.depth),
            Number(placement?.projection?.boundsMil?.height)
        ].filter((dimension) => Number.isFinite(dimension) && dimension > 0)
    }

    /**
     * Checks whether two source dimensions match any distinct model axes.
     * @param {number[]} sourceDimensions Two source dimensions.
     * @param {number[]} modelDimensions Candidate model dimensions.
     * @param {number} ratio Relative tolerance.
     * @param {number} minimum Absolute tolerance.
     * @returns {boolean}
     */
    static #matchesDimensionPair(
        sourceDimensions,
        modelDimensions,
        ratio,
        minimum
    ) {
        if (sourceDimensions.length < 2 || modelDimensions.length < 2) {
            return false
        }

        return modelDimensions.some((first, firstIndex) =>
            modelDimensions.some(
                (second, secondIndex) =>
                    firstIndex !== secondIndex &&
                    ((AltiumScene3dGeometricOwnerRecovery.#matchesDimension(
                        sourceDimensions[0],
                        first,
                        ratio,
                        minimum
                    ) &&
                        AltiumScene3dGeometricOwnerRecovery.#matchesDimension(
                            sourceDimensions[1],
                            second,
                            ratio,
                            minimum
                        )) ||
                        (AltiumScene3dGeometricOwnerRecovery.#matchesDimension(
                            sourceDimensions[0],
                            second,
                            ratio,
                            minimum
                        ) &&
                            AltiumScene3dGeometricOwnerRecovery.#matchesDimension(
                                sourceDimensions[1],
                                first,
                                ratio,
                                minimum
                            )))
            )
        )
    }

    /**
     * Checks one dimension with combined absolute and relative tolerance.
     * @param {number} actual Actual dimension.
     * @param {number} expected Expected dimension.
     * @param {number} ratio Relative tolerance.
     * @param {number} minimum Absolute tolerance.
     * @returns {boolean}
     */
    static #matchesDimension(actual, expected, ratio, minimum) {
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
            return false
        }
        const tolerance = Math.max(minimum, Math.abs(expected) * ratio)
        return Math.abs(actual - expected) <= tolerance
    }

    /**
     * Checks whether a point lies within expanded footprint bounds.
     * @param {object} point Board point.
     * @param {object} geometry Pad geometry.
     * @param {number} expansion Bounds expansion.
     * @returns {boolean}
     */
    static #isNearFootprint(point, geometry, expansion) {
        return (
            Number(point?.x) >= geometry.bounds.minX - expansion &&
            Number(point?.x) <= geometry.bounds.maxX + expansion &&
            Number(point?.y) >= geometry.bounds.minY - expansion &&
            Number(point?.y) <= geometry.bounds.maxY + expansion
        )
    }

    /**
     * Counts coordinates after grouping native numeric noise.
     * @param {number[]} values Coordinates.
     * @returns {number}
     */
    static #distinctCoordinateCount(values) {
        return new Set(values.map((value) => Math.round(value * 10))).size
    }

    /**
     * Resolves effective pad width.
     * @param {object} pad PCB pad.
     * @returns {number}
     */
    static #padWidth(pad) {
        return Math.max(
            Number(pad?.sizeTopX || 0),
            Number(pad?.sizeMidX || 0),
            Number(pad?.sizeBottomX || 0)
        )
    }

    /**
     * Resolves effective pad depth.
     * @param {object} pad PCB pad.
     * @returns {number}
     */
    static #padDepth(pad) {
        return Math.max(
            Number(pad?.sizeTopY || 0),
            Number(pad?.sizeMidY || 0),
            Number(pad?.sizeBottomY || 0)
        )
    }

    /**
     * Resolves component side.
     * @param {object} component PCB component.
     * @returns {'top' | 'bottom'}
     */
    static #componentSide(component) {
        return /bottom|bot/i.test(String(component?.layer || ''))
            ? 'bottom'
            : 'top'
    }

    /**
     * Resolves board face Z.
     * @param {'top' | 'bottom'} mountSide Placement side.
     * @param {object} board Board metadata.
     * @returns {number}
     */
    static #faceZ(mountSide, board) {
        const halfThickness = Number(board?.thicknessMil || 63) / 2
        return mountSide === 'bottom' ? -halfThickness : halfThickness
    }

    /**
     * Measures planar distance.
     * @param {object} first First point.
     * @param {object} second Second point.
     * @returns {number}
     */
    static #distance(first, second) {
        return Math.hypot(
            Number(first?.x || 0) - Number(second?.x || 0),
            Number(first?.y || 0) - Number(second?.y || 0)
        )
    }

    /**
     * Normalizes identity text.
     * @param {unknown[]} values Identity values.
     * @returns {string}
     */
    static #normalizeIdentity(values) {
        return values
            .map((value) =>
                String(value || '')
                    .replace(/\.[^.]+$/, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '')
            )
            .filter(Boolean)
            .join(' ')
    }

    /**
     * Normalizes one angle.
     * @param {unknown} angle Angle value.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360
        return normalized < 0 ? normalized + 360 : normalized
    }
}

Object.freeze(AltiumScene3dGeometricOwnerRecovery.prototype)
Object.freeze(AltiumScene3dGeometricOwnerRecovery)
