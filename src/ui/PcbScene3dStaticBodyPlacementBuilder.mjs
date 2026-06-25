// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dPlacementSideResolver } from './PcbScene3dPlacementSideResolver.mjs'
import { PcbScene3dStaticBodyOwnerPromotion } from './PcbScene3dStaticBodyOwnerPromotion.mjs'
import { PcbScene3dStaticBodyRecovery } from './PcbScene3dStaticBodyRecovery.mjs'
import { PcbScene3dStaticBodySelectionKeyBuilder } from './PcbScene3dStaticBodySelectionKeyBuilder.mjs'

/**
 * Builds scene placements for static shape-based 3D bodies.
 */
export class PcbScene3dStaticBodyPlacementBuilder {
    static #UNMATCHED_BODY_OVERHANG_RATIO = 0.25
    static #UNMATCHED_BODY_MIN_OVERHANG_MIL = 150
    static #UNMATCHED_BODY_MAX_OVERHANG_MIL = 600
    static #OWNER_AFFINITY_DISTANCE_MIL = 600
    static #OWNER_BOUNDS_TOLERANCE_MIL = 20
    static #OWNER_EXACT_DISTANCE_MIL = 5
    static #OWNER_EXACT_MAX_SPAN_MIL = 500
    static #SOURCE_COORDINATE_MIRROR_TOLERANCE_MIL = 5
    static #SOURCE_COORDINATE_MIRROR_MIN_OFFSET_MIL = 20
    static #GENERIC_MECHANICAL_IDENTITY_TOKENS = new Set([
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
     * Builds static shape-body scene placements.
     * @param {{ componentIndex?: number, identifier?: string, name?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, standoffHeightMil?: number | null, overallHeightMil?: number | null, bodyOpacity?: number | string, staticGeometry?: object }[]} componentBodies Component bodies.
     * @param {({ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null)[]} bodyMatches Matched components.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components Components.
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[]} pads Pads.
     * @param {{ centerX: number, centerY: number, minX?: number, minY?: number, widthMil?: number, heightMil?: number }} board Board.
     * @param {number} thicknessMil Board thickness.
     * @returns {{ designator: string, selectionKey: string, sourceIdentityKey: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, geometry: object }[]}
     */
    static build(
        componentBodies,
        bodyMatches,
        components,
        pads,
        board,
        thicknessMil
    ) {
        const recoveredBodies = PcbScene3dStaticBodyRecovery.recover(
            componentBodies,
            bodyMatches
        )

        const placementRows = recoveredBodies
            .map((componentBody, index) =>
                PcbScene3dStaticBodyPlacementBuilder.#buildPlacementRow(
                    componentBody,
                    bodyMatches?.[index] || null,
                    components,
                    board,
                    thicknessMil
                )
            )
            .filter(Boolean)

        PcbScene3dStaticBodyOwnerPromotion.promote(
            placementRows,
            components,
            board
        )

        return PcbScene3dStaticBodySelectionKeyBuilder.assign(placementRows)
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
     * Builds one static body placement row with its matched owner context.
     * @param {{ componentIndex?: number, embedded?: boolean, identifier?: string, name?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, standoffHeightMil?: number | null, overallHeightMil?: number | null, bodyOpacity?: number | string, staticGeometry?: object }} componentBody Component body.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null} matchedComponent Matched component.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components Components.
     * @param {{ centerX: number, centerY: number, minX?: number, minY?: number, widthMil?: number, heightMil?: number }} board Board.
     * @param {number} thicknessMil Board thickness.
     * @returns {{ placement: { designator: string, sourceIdentityKey: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, geometry: object }, matchedComponent: object | null } | null}
     */
    static #buildPlacementRow(
        componentBody,
        matchedComponent,
        components,
        board,
        thicknessMil
    ) {
        const placement = PcbScene3dStaticBodyPlacementBuilder.#buildPlacement(
            componentBody,
            matchedComponent,
            components,
            board,
            thicknessMil
        )

        return placement
            ? {
                  placement,
                  matchedComponent
              }
            : null
    }

    /**
     * Builds one static shape-body scene placement.
     * @param {{ componentIndex?: number, embedded?: boolean, identifier?: string, name?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, standoffHeightMil?: number | null, overallHeightMil?: number | null, bodyOpacity?: number | string, staticGeometry?: object }} componentBody Component body.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null} matchedComponent Matched component.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components Components.
     * @param {{ centerX: number, centerY: number, minX?: number, minY?: number, widthMil?: number, heightMil?: number }} board Board.
     * @param {number} thicknessMil Board thickness.
     * @returns {{ designator: string, sourceIdentityKey: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, geometry: object } | null}
     */
    static #buildPlacement(
        componentBody,
        matchedComponent,
        components,
        board,
        thicknessMil
    ) {
        const staticGeometry =
            PcbScene3dStaticBodyPlacementBuilder.#normalizeStaticGeometry(
                componentBody,
                componentBody?.staticGeometry,
                matchedComponent
            )
        const geometry = staticGeometry.geometry

        if (
            !PcbScene3dStaticBodyPlacementBuilder.#isCompleteGeometry(geometry)
        ) {
            return null
        }
        const sourcePosition =
            staticGeometry.placementCenterMil ||
            PcbScene3dStaticBodyPlacementBuilder.#sourcePosition(componentBody)

        if (
            !matchedComponent &&
            PcbScene3dStaticBodyPlacementBuilder.#shouldSuppressStaticBody(
                componentBody,
                geometry,
                components,
                sourcePosition
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
        const renderGeometry =
            PcbScene3dStaticBodyPlacementBuilder.#placementGeometry(
                geometry,
                staticGeometry,
                mountSide
            )

        return {
            designator:
                matchedComponent?.designator ||
                String(
                    componentBody.identifier || componentBody.name || '3D body'
                ),
            sourceIdentityKey:
                PcbScene3dStaticBodyPlacementBuilder.#sourceIdentityKey(
                    componentBody
                ),
            sourceCoordinateFrame: Boolean(
                staticGeometry.sourceCoordinateFrame
            ),
            mountSideLocked:
                PcbScene3dStaticBodyPlacementBuilder.#hasExplicitMountSide(
                    componentBody,
                    matchedComponent
                ),
            mountSide,
            rotationDeg:
                PcbScene3dStaticBodyPlacementBuilder.#placementRotationDeg(
                    componentBody,
                    matchedComponent,
                    staticGeometry
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
            geometry: renderGeometry
        }
    }

    /**
     * Checks whether one body carries explicit top/bottom side evidence.
     * @param {{ componentIndex?: number | string, layer?: string, standoffHeightMil?: number | string | null }} componentBody Component body.
     * @param {{ layer?: string } | null} matchedComponent Matched owner component.
     * @returns {boolean}
     */
    static #hasExplicitMountSide(componentBody, matchedComponent) {
        if (
            matchedComponent &&
            Number.isInteger(Number(componentBody?.componentIndex))
        ) {
            return true
        }

        const layer = String(componentBody?.layer || '').trim()
        if (!layer) {
            const standoffMil = Number(componentBody?.standoffHeightMil)
            return Number.isFinite(standoffMil) && standoffMil < 0
        }

        if (
            !PcbScene3dStaticBodyPlacementBuilder.#isAuthoredMechanicalBody(
                componentBody
            )
        ) {
            return false
        }

        if (/(^|[^a-z])(top|bottom)([^a-z]|$)/i.test(layer)) {
            return true
        }

        return /^MECHANICAL\s*\d+$/i.test(layer)
    }

    /**
     * Checks whether one body identity looks like authored board mechanics.
     * @param {{ identifier?: string, name?: string, modelTypeName?: string }} componentBody Component body.
     * @returns {boolean}
     */
    static #isAuthoredMechanicalBody(componentBody) {
        return PcbScene3dStaticBodyPlacementBuilder.#identityTokens(
            componentBody
        ).some((token) =>
            PcbScene3dStaticBodyPlacementBuilder.#GENERIC_MECHANICAL_IDENTITY_TOKENS.has(
                token
            )
        )
    }

    /**
     * Resolves the rendered rotation for one static shape body.
     * @param {{ rotationDeg?: number }} componentBody Component body.
     * @param {{ rotation?: number } | null} matchedComponent Matched owner component.
     * @param {{ sourceCoordinateFrame?: boolean }} normalizedStaticGeometry Normalized static geometry context.
     * @returns {number}
     */
    static #placementRotationDeg(
        componentBody,
        matchedComponent,
        normalizedStaticGeometry
    ) {
        const ownerRotation = normalizedStaticGeometry?.sourceCoordinateFrame
            ? 0
            : Number(matchedComponent?.rotation || 0)

        return PcbScene3dStaticBodyPlacementBuilder.#normalizeAngle(
            Number(componentBody.rotationDeg || 0) + ownerRotation
        )
    }

    /**
     * Converts normalized static geometry into the renderer mount-local frame.
     * @param {object} geometry Normalized render geometry.
     * @param {{ sourceCoordinateFrame?: boolean }} normalizedStaticGeometry Normalized static geometry context.
     * @param {string} mountSide Resolved mount side.
     * @returns {object}
     */
    static #placementGeometry(geometry, normalizedStaticGeometry, mountSide) {
        if (
            !normalizedStaticGeometry?.sourceCoordinateFrame ||
            String(mountSide || 'top').toLowerCase() !== 'bottom' ||
            !Array.isArray(geometry?.verticesMil)
        ) {
            return geometry
        }

        return {
            ...geometry,
            verticesMil: geometry.verticesMil.map((vertex) => ({
                x: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                    Number(vertex?.x || 0)
                ),
                y: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                    -Number(vertex?.y || 0)
                )
            }))
        }
    }

    /**
     * Converts source-space polygon vertices into render-local geometry.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {object | undefined} geometry Static geometry.
     * @param {{ x?: number, y?: number } | null} matchedComponent Matched owner component.
     * @returns {{ geometry: object | undefined, placementCenterMil?: { x: number, y: number }, sourceCoordinateFrame: boolean }}
     */
    static #normalizeStaticGeometry(componentBody, geometry, matchedComponent) {
        if (
            String(geometry?.kind || '').toLowerCase() !== 'extruded-polygon' ||
            !Array.isArray(geometry?.verticesMil) ||
            geometry.verticesMil.length < 3
        ) {
            return { geometry, sourceCoordinateFrame: false }
        }

        if (
            !PcbScene3dStaticBodyPlacementBuilder.#usesSourceCoordinateFrame(
                componentBody,
                geometry.verticesMil
            )
        ) {
            return { geometry, sourceCoordinateFrame: false }
        }

        const center =
            PcbScene3dStaticBodyPlacementBuilder.#polygonBoundsCenter(
                geometry.verticesMil
            )
        const mirror =
            PcbScene3dStaticBodyPlacementBuilder.#sourceCoordinateMirror(
                componentBody,
                center,
                matchedComponent
            )
        const placementCenter = mirror?.placementCenterMil || center

        return {
            placementCenterMil: placementCenter,
            sourceCoordinateFrame: true,
            geometry: {
                ...geometry,
                verticesMil: geometry.verticesMil.map((vertex) => {
                    const normalizedVertex =
                        PcbScene3dStaticBodyPlacementBuilder.#normalizeVertex(
                            vertex,
                            mirror
                        )

                    return {
                        x: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                            normalizedVertex.x - placementCenter.x
                        ),
                        y: PcbScene3dStaticBodyPlacementBuilder.#roundMil(
                            normalizedVertex.y - placementCenter.y
                        )
                    }
                })
            }
        }
    }

    /**
     * Resolves owner-axis mirror transforms for source-coordinate polygons
     * whose body anchor is opposite their raw polygon bounds.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {{ x: number, y: number }} boundsCenter Source-coordinate polygon bounds center.
     * @param {{ x?: number, y?: number } | null} matchedComponent Matched owner component.
     * @returns {{ mirrorAxisX?: number, mirrorAxisY?: number, placementCenterMil: { x: number, y: number } } | null}
     */
    static #sourceCoordinateMirror(
        componentBody,
        boundsCenter,
        matchedComponent
    ) {
        const source =
            PcbScene3dStaticBodyPlacementBuilder.#sourcePosition(componentBody)
        const xDecision =
            PcbScene3dStaticBodyPlacementBuilder.#sourceCoordinateMirrorAxis(
                boundsCenter.x,
                source.x,
                Number(matchedComponent?.x)
            )
        const yDecision =
            PcbScene3dStaticBodyPlacementBuilder.#sourceCoordinateMirrorAxis(
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
                : undefined,
            placementCenterMil: {
                x: source.x,
                y: source.y
            }
        }
    }

    /**
     * Checks whether one source-coordinate axis is aligned or mirrored.
     * @param {number} center Raw polygon center coordinate.
     * @param {number} source Body source coordinate.
     * @param {number} ownerAxis Owner coordinate.
     * @returns {{ valid: boolean, mirrored: boolean }}
     */
    static #sourceCoordinateMirrorAxis(center, source, ownerAxis) {
        const tolerance =
            PcbScene3dStaticBodyPlacementBuilder
                .#SOURCE_COORDINATE_MIRROR_TOLERANCE_MIL
        const offset = Math.abs(Number(center || 0) - Number(source || 0))
        if (offset <= tolerance) {
            return { valid: true, mirrored: false }
        }

        const mirroredCenter = 2 * Number(ownerAxis) - Number(center || 0)
        const mirrorError = Math.abs(mirroredCenter - Number(source || 0))

        return {
            valid:
                Number.isFinite(ownerAxis) &&
                offset >
                    PcbScene3dStaticBodyPlacementBuilder
                        .#SOURCE_COORDINATE_MIRROR_MIN_OFFSET_MIL &&
                mirrorError <= tolerance,
            mirrored: true
        }
    }

    /**
     * Converts one source-space vertex into render source-space coordinates.
     * @param {{ x?: number, y?: number }} vertex Source vertex.
     * @param {{ mirrorAxisX?: number, mirrorAxisY?: number } | null} mirror Optional mirror transform.
     * @returns {{ x: number, y: number }}
     */
    static #normalizeVertex(vertex, mirror) {
        const sourceX = Number(vertex?.x || 0)
        const sourceY = Number(vertex?.y || 0)

        return {
            x: Number.isFinite(mirror?.mirrorAxisX)
                ? 2 * mirror.mirrorAxisX - sourceX
                : sourceX,
            y: Number.isFinite(mirror?.mirrorAxisY)
                ? 2 * mirror.mirrorAxisY - sourceY
                : sourceY
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

        const opacity = PcbScene3dStaticBodyRecovery.renderableOpacity(
            componentBody?.bodyOpacity
        )
        if (opacity !== undefined) {
            metadata.bodyOpacity = opacity
        }

        return metadata
    }

    /**
     * Resolves the stable source identity shared by sibling static bodies.
     * @param {{ identifier?: string, name?: string, modelId?: string }} componentBody Component body.
     * @returns {string}
     */
    static #sourceIdentityKey(componentBody) {
        return String(
            componentBody?.identifier ||
                componentBody?.name ||
                componentBody?.modelId ||
                ''
        ).trim()
    }

    /**
     * Checks whether an unowned static body is likely a translucent mechanical
     * overlay instead of a component package.
     * @param {{ componentIndex?: number, embedded?: boolean, bodyOpacity?: number | string, identifier?: string, name?: string, positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {object} geometry Static geometry.
     * @param {{ componentIndex?: number, x?: number, y?: number, pattern?: string, source?: string, modelPath?: string, description?: string, parameters?: object, provenance?: object }[]} components Components.
     * @param {{ x: number, y: number }} sourcePosition Source-space placement center.
     * @returns {boolean}
     */
    static #shouldSuppressStaticBody(
        componentBody,
        geometry,
        components,
        sourcePosition
    ) {
        return (
            PcbScene3dStaticBodyPlacementBuilder.#isTranslucentBody(
                componentBody
            ) &&
            !PcbScene3dStaticBodyPlacementBuilder.#hasLikelyComponentOwner(
                componentBody,
                geometry,
                components,
                sourcePosition
            )
        )
    }

    /**
     * Checks whether a body was authored with visible partial transparency.
     * @param {{ bodyOpacity?: number | string }} componentBody Component body.
     * @returns {boolean}
     */
    static #isTranslucentBody(componentBody) {
        return (
            PcbScene3dStaticBodyRecovery.renderableOpacity(
                componentBody?.bodyOpacity
            ) !== undefined
        )
    }

    /**
     * Checks whether an otherwise unmatched body still has a plausible owning
     * component.
     * @param {{ componentIndex?: number, embedded?: boolean, identifier?: string, name?: string, positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {object} geometry Static geometry.
     * @param {{ componentIndex?: number, x?: number, y?: number, pattern?: string, source?: string, modelPath?: string, description?: string, parameters?: object, provenance?: object }[]} components Components.
     * @param {{ x: number, y: number }} sourcePosition Source-space placement center.
     * @returns {boolean}
     */
    static #hasLikelyComponentOwner(
        componentBody,
        geometry,
        components,
        sourcePosition
    ) {
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
        const sourceBounds =
            PcbScene3dStaticBodyPlacementBuilder.#geometrySourceBounds(
                geometry,
                sourcePosition
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
                    (genericMechanical &&
                        PcbScene3dStaticBodyPlacementBuilder.#isShieldOwner(
                            component
                        ) &&
                        (distance <=
                            PcbScene3dStaticBodyPlacementBuilder
                                .#OWNER_AFFINITY_DISTANCE_MIL ||
                            PcbScene3dStaticBodyPlacementBuilder.#boundsContainPoint(
                                sourceBounds,
                                component,
                                PcbScene3dStaticBodyPlacementBuilder
                                    .#OWNER_BOUNDS_TOLERANCE_MIL
                            ))) ||
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
     * Resolves source-space bounds for one static polygon geometry.
     * @param {object} geometry Static geometry.
     * @param {{ x?: number, y?: number }} sourcePosition Source-space placement center.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #geometrySourceBounds(geometry, sourcePosition) {
        if (
            !Array.isArray(geometry?.verticesMil) ||
            !geometry.verticesMil.length
        ) {
            return null
        }

        const points = geometry.verticesMil
            .map((vertex) => ({
                x: Number(vertex?.x || 0) + Number(sourcePosition?.x || 0),
                y: Number(vertex?.y || 0) + Number(sourcePosition?.y || 0)
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
        if (!points.length) {
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
     * Checks whether bounds contain a component point with tolerance.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Bounds.
     * @param {{ x?: number, y?: number }} point Candidate point.
     * @param {number} toleranceMil Bounds tolerance.
     * @returns {boolean}
     */
    static #boundsContainPoint(bounds, point, toleranceMil) {
        if (!bounds) {
            return false
        }

        const x = Number(point?.x || 0)
        const y = Number(point?.y || 0)
        const tolerance = Math.max(Number(toleranceMil || 0), 0)

        return (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            x >= bounds.minX - tolerance &&
            x <= bounds.maxX + tolerance &&
            y >= bounds.minY - tolerance &&
            y <= bounds.maxY + tolerance
        )
    }

    /**
     * Checks whether a component identity describes a shield owner strongly
     * enough to keep generic translucent shield sub-bodies.
     * @param {{ designator?: string, pattern?: string, source?: string, description?: string, parameters?: object, provenance?: object }} component Component row.
     * @returns {boolean}
     */
    static #isShieldOwner(component) {
        const identityText = [
            component?.pattern,
            component?.source,
            component?.description,
            ...Object.values(component?.parameters || {}),
            ...Object.values(component?.provenance || {})
        ]
            .join(' ')
            .toLowerCase()

        return /(?:^|[^a-z0-9])(?:emi|rfi|shield)(?:$|[^a-z0-9])/u.test(
            identityText
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
            .replace(/([a-z])([A-Z])/gu, '$1 $2')
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
