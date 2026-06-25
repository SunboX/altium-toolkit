// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dStaticBodySymmetricOwnerPromotion } from './PcbScene3dStaticBodySymmetricOwnerPromotion.mjs'

/**
 * Promotes compact static body fragments to one clear touching owner.
 */
export class PcbScene3dStaticBodyOwnerPromotion {
    static #NEAREST_OWNER_DISTANCE_MIL = 20
    static #NEAREST_OWNER_AMBIGUITY_MARGIN_MIL = 2
    static #CLUSTER_CENTER_MAX_SPAN_MIL = 45
    static #GENERIC_SUBPART_OWNER_MAX_SPAN_MIL = 80
    static #GENERIC_SUBPART_TOKENS = new Set(['plastic'])

    /**
     * Promotes generic compact fragments that physically touch one clear owner.
     * @param {{ placement: object, matchedComponent: object | null }[]} placementRows Mutable placement rows.
     * @param {{ designator?: string, x?: number, y?: number, layer?: string }[]} [components] PCB components.
     * @param {{ centerX?: number, centerY?: number } | null} [board] Board context.
     */
    static promote(placementRows, components = [], board = null) {
        PcbScene3dStaticBodyOwnerPromotion.#promoteNearestOwners(
            placementRows,
            components
        )

        PcbScene3dStaticBodySymmetricOwnerPromotion.promote(
            placementRows,
            components
        )

        const clusters =
            PcbScene3dStaticBodyOwnerPromotion.#clusters(placementRows)

        PcbScene3dStaticBodyOwnerPromotion.#promoteClusterCenterOwners(
            placementRows,
            clusters,
            components,
            board
        )

        clusters.forEach((cluster) => {
            const ownerRow = PcbScene3dStaticBodyOwnerPromotion.#uniqueOwnerRow(
                placementRows,
                cluster.indexes
            )
            if (
                !ownerRow ||
                !cluster.indexes.every((index) =>
                    PcbScene3dStaticBodyOwnerPromotion.#canPromote(
                        placementRows[index]
                    )
                )
            ) {
                return
            }

            cluster.indexes.forEach((index) => {
                placementRows[index].matchedComponent =
                    ownerRow.matchedComponent
                placementRows[index].placement =
                    PcbScene3dStaticBodyOwnerPromotion.#withOwner(
                        placementRows[index].placement,
                        ownerRow.matchedComponent
                    )
            })
        })
    }

    /**
     * Reassigns compact clusters to the component nearest the cluster center.
     * @param {{ placement: object, matchedComponent: object | null }[]} placementRows Mutable placement rows.
     * @param {{ indexes: number[], bounds: object }[]} clusters Touching clusters.
     * @param {{ designator?: string, x?: number, y?: number, layer?: string }[]} components PCB components.
     * @param {{ centerX?: number, centerY?: number } | null} board Board context.
     */
    static #promoteClusterCenterOwners(
        placementRows,
        clusters,
        components,
        board
    ) {
        clusters
            .flatMap((cluster) =>
                PcbScene3dStaticBodyOwnerPromotion.#orientationSubclusters(
                    cluster,
                    placementRows
                )
            )
            .forEach((cluster) => {
                if (
                    cluster.indexes.length <= 1 ||
                    PcbScene3dStaticBodyOwnerPromotion.#boundsMaxSpan(
                        cluster.bounds
                    ) >
                        PcbScene3dStaticBodyOwnerPromotion
                            .#CLUSTER_CENTER_MAX_SPAN_MIL ||
                    !cluster.indexes.every((index) =>
                        PcbScene3dStaticBodyOwnerPromotion.#isCompactRow(
                            placementRows[index]
                        )
                    )
                ) {
                    return
                }

                const owner =
                    PcbScene3dStaticBodyOwnerPromotion.#nearestOwnerToSourcePoint(
                        PcbScene3dStaticBodyOwnerPromotion.#clusterSourceCenter(
                            cluster,
                            placementRows,
                            board
                        ),
                        PcbScene3dStaticBodyOwnerPromotion.#componentsForClusterSide(
                            components,
                            cluster.ownerSide
                        )
                    )
                if (!owner) {
                    return
                }

                cluster.indexes.forEach((index) => {
                    placementRows[index].matchedComponent = owner
                    placementRows[index].placement =
                        PcbScene3dStaticBodyOwnerPromotion.#withOwner(
                            placementRows[index].placement,
                            owner
                        )
                })
            })
    }

    /**
     * Splits one touching cluster into dominant-orientation subclusters.
     * @param {{ indexes: number[] }} cluster Touching cluster.
     * @param {{ placement: object }[]} placementRows Placement rows.
     * @returns {{ indexes: number[], bounds: object }[]}
     */
    static #orientationSubclusters(cluster, placementRows) {
        const buckets = new Map()

        cluster.indexes.forEach((index) => {
            const key = PcbScene3dStaticBodyOwnerPromotion.#orientationBucket(
                placementRows[index]?.placement
            )
            if (!buckets.has(key)) {
                buckets.set(key, [])
            }
            buckets.get(key)?.push(index)
        })

        return [...buckets.entries()].map(([key, indexes]) => ({
            indexes,
            ownerSide:
                PcbScene3dStaticBodyOwnerPromotion.#ownerSideFromBucketKey(key),
            bounds: PcbScene3dStaticBodyOwnerPromotion.#boundsForIndexes(
                placementRows,
                indexes
            )
        }))
    }

    /**
     * Filters candidate components by a side-specific cluster key.
     * @param {object[]} components PCB components.
     * @param {string} ownerSide Required owner side.
     * @returns {object[]}
     */
    static #componentsForClusterSide(components, ownerSide) {
        const side = String(ownerSide || '').trim()

        return side
            ? (Array.isArray(components) ? components : []).filter(
                  (component) =>
                      PcbScene3dStaticBodyOwnerPromotion.#componentMountSide(
                          component
                      ) === side
              )
            : components
    }

    /**
     * Resolves a side constraint from an orientation bucket key.
     * @param {string} key Orientation bucket key.
     * @returns {string}
     */
    static #ownerSideFromBucketKey(key) {
        const [orientation, side] = String(key || '').split(':')

        return orientation === 'axis' || orientation === 'unknown'
            ? String(side || '').trim()
            : ''
    }

    /**
     * Builds merged horizontal bounds for selected placement rows.
     * @param {{ placement: object }[]} placementRows Placement rows.
     * @param {number[]} indexes Row indexes.
     * @returns {object}
     */
    static #boundsForIndexes(placementRows, indexes) {
        return indexes
            .map((index) =>
                PcbScene3dStaticBodyOwnerPromotion.#bounds(
                    placementRows[index]?.placement
                )
            )
            .reduce((bounds, candidate) =>
                bounds
                    ? PcbScene3dStaticBodyOwnerPromotion.#merge(
                          bounds,
                          candidate
                      )
                    : candidate
            )
    }

    /**
     * Resolves a broad orientation bucket for compact polygon ownership.
     * @param {{ geometry?: object } | null} placement Static placement.
     * @returns {string}
     */
    static #orientationBucket(placement) {
        const angle = PcbScene3dStaticBodyOwnerPromotion.#dominantEdgeAngle(
            placement?.geometry?.verticesMil
        )
        const side = String(placement?.mountSide || '')
            .trim()
            .toLowerCase()
        if (!Number.isFinite(angle)) {
            return 'unknown:' + side
        }

        const normalized = ((angle % 90) + 90) % 90
        return normalized > 22.5 && normalized < 67.5
            ? 'diagonal'
            : 'axis:' + side
    }

    /**
     * Resolves the longest polygon-edge angle.
     * @param {{ x?: number, y?: number }[] | undefined} vertices Vertices.
     * @returns {number | null}
     */
    static #dominantEdgeAngle(vertices) {
        const points = Array.isArray(vertices) ? vertices : []
        if (points.length < 2) {
            return null
        }

        let bestEdge = null
        points.forEach((point, index) => {
            const next = points[(index + 1) % points.length]
            const dx = Number(next?.x || 0) - Number(point?.x || 0)
            const dy = Number(next?.y || 0) - Number(point?.y || 0)
            const length = Math.hypot(dx, dy)
            if (!bestEdge || length > bestEdge.length) {
                bestEdge = {
                    length,
                    angle: Math.atan2(dy, dx) * (180 / Math.PI)
                }
            }
        })

        return bestEdge ? ((bestEdge.angle % 180) + 180) % 180 : null
    }

    /**
     * Promotes compact generic fragments that sit directly on one component.
     * @param {{ placement: object, matchedComponent: object | null }[]} placementRows Mutable placement rows.
     * @param {{ designator?: string, x?: number, y?: number, layer?: string }[]} components PCB components.
     */
    static #promoteNearestOwners(placementRows, components) {
        placementRows.forEach((row) => {
            if (
                !PcbScene3dStaticBodyOwnerPromotion.#canPromoteNearestOwner(row)
            ) {
                return
            }

            const owner =
                PcbScene3dStaticBodyOwnerPromotion.#nearestOwnerForPlacement(
                    row.placement,
                    components
                )
            if (!owner) {
                return
            }

            row.matchedComponent = owner
            row.placement = PcbScene3dStaticBodyOwnerPromotion.#withOwner(
                row.placement,
                owner
            )
        })
    }

    /**
     * Resolves one owner for a compact placement using distance and offset axis.
     * @param {{ bodyPositionMil?: { x?: number, y?: number }, mountSide?: string, mountSideLocked?: boolean }} placement Static placement.
     * @param {{ designator?: string, x?: number, y?: number, rotation?: number, layer?: string }[]} components PCB components.
     * @returns {object | null}
     */
    static #nearestOwnerForPlacement(placement, components) {
        const position =
            PcbScene3dStaticBodyOwnerPromotion.#sourceBodyPosition(placement)
        if (!position) {
            return null
        }
        const lockedPlacementSide = placement?.mountSideLocked
            ? PcbScene3dStaticBodyOwnerPromotion.#normalizeMountSide(
                  placement?.mountSide
              )
            : null

        const candidates = (Array.isArray(components) ? components : [])
            .map((component) => ({
                component,
                distance: Math.hypot(
                    Number(component?.x || 0) - position.x,
                    Number(component?.y || 0) - position.y
                )
            }))
            .filter(
                ({ component, distance }) =>
                    String(component?.designator || '').trim() &&
                    Number.isFinite(distance) &&
                    distance <=
                        PcbScene3dStaticBodyOwnerPromotion
                            .#NEAREST_OWNER_DISTANCE_MIL &&
                    (!lockedPlacementSide ||
                        PcbScene3dStaticBodyOwnerPromotion.#componentMountSide(
                            component
                        ) === lockedPlacementSide) &&
                    PcbScene3dStaticBodyOwnerPromotion.#componentOffsetCompatible(
                        position,
                        component,
                        distance
                    )
            )
            .sort((left, right) => left.distance - right.distance)

        return PcbScene3dStaticBodyOwnerPromotion.#unambiguousNearest(
            candidates
        )
    }

    /**
     * Resolves one unambiguous nearby owner for a source-space point.
     * @param {{ x: number, y: number } | null} position Source-space point.
     * @param {{ designator?: string, x?: number, y?: number }[]} components PCB components.
     * @returns {object | null}
     */
    static #nearestOwnerToSourcePoint(position, components) {
        if (!position) {
            return null
        }

        const candidates = (Array.isArray(components) ? components : [])
            .map((component) => ({
                component,
                distance: Math.hypot(
                    Number(component?.x || 0) - position.x,
                    Number(component?.y || 0) - position.y
                )
            }))
            .filter(
                ({ component, distance }) =>
                    String(component?.designator || '').trim() &&
                    Number.isFinite(distance) &&
                    distance <=
                        PcbScene3dStaticBodyOwnerPromotion
                            .#NEAREST_OWNER_DISTANCE_MIL
            )
            .sort((left, right) => left.distance - right.distance)

        return PcbScene3dStaticBodyOwnerPromotion.#unambiguousNearest(
            candidates
        )
    }

    /**
     * Resolves an unambiguous nearest component from distance candidates.
     * @param {{ component: object, distance: number }[]} candidates Candidates.
     * @returns {object | null}
     */
    static #unambiguousNearest(candidates) {
        const nearest = candidates[0]
        if (!nearest) {
            return null
        }

        const nextNearest = candidates[1]
        const ambiguityMargin =
            nearest.distance <= 1
                ? 0.25
                : PcbScene3dStaticBodyOwnerPromotion
                      .#NEAREST_OWNER_AMBIGUITY_MARGIN_MIL
        if (
            nextNearest &&
            nextNearest.distance - nearest.distance <= ambiguityMargin
        ) {
            return null
        }

        return nearest.component
    }

    /**
     * Checks whether a fragment offset aligns with a component's package axis.
     * @param {{ x: number, y: number }} position Fragment source position.
     * @param {{ x?: number, y?: number, rotation?: number }} component Candidate component.
     * @param {number} distanceMil Fragment/component distance.
     * @returns {boolean}
     */
    static #componentOffsetCompatible(position, component, distanceMil) {
        if (Number(distanceMil || 0) <= 1) {
            return true
        }

        const dx = position.x - Number(component?.x || 0)
        const dy = position.y - Number(component?.y || 0)
        const offsetAngle = Math.atan2(dy, dx) * (180 / Math.PI)
        const delta = PcbScene3dStaticBodyOwnerPromotion.#axisAngleDifference(
            offsetAngle,
            Number(component?.rotation || 0)
        )

        return delta <= 30
    }

    /**
     * Resolves the acute difference between two 180-degree axes.
     * @param {number} leftAngle First angle in degrees.
     * @param {number} rightAngle Second angle in degrees.
     * @returns {number}
     */
    static #axisAngleDifference(leftAngle, rightAngle) {
        const normalized = (((leftAngle - rightAngle) % 180) + 180) % 180

        return Math.min(normalized, 180 - normalized)
    }

    /**
     * Resolves a touching cluster center in source-space coordinates.
     * @param {{ indexes: number[], bounds: { minX: number, minY: number, maxX: number, maxY: number } }} cluster Touching cluster.
     * @param {{ placement: object }[]} placementRows Placement rows.
     * @param {{ centerX?: number, centerY?: number } | null} board Board context.
     * @returns {{ x: number, y: number } | null}
     */
    static #clusterSourceCenter(cluster, placementRows, board) {
        const center = PcbScene3dStaticBodyOwnerPromotion.#boundsCenter(
            cluster.bounds
        )
        const boardCenter = PcbScene3dStaticBodyOwnerPromotion.#boardCenter(
            board,
            placementRows[cluster.indexes[0]]?.placement
        )
        if (!center || !boardCenter) {
            return null
        }

        return {
            x: center.x + boardCenter.x,
            y: center.y + boardCenter.y
        }
    }

    /**
     * Resolves board center from explicit board data or one placement row.
     * @param {{ centerX?: number, centerY?: number } | null} board Board context.
     * @param {{ positionMil?: { x?: number, y?: number }, bodyPositionMil?: { x?: number, y?: number } } | null} placement Placement row.
     * @returns {{ x: number, y: number } | null}
     */
    static #boardCenter(board, placement) {
        const boardX = Number(board?.centerX)
        const boardY = Number(board?.centerY)
        if (Number.isFinite(boardX) && Number.isFinite(boardY)) {
            return { x: boardX, y: boardY }
        }

        const bodyX = Number(placement?.bodyPositionMil?.x)
        const bodyY = Number(placement?.bodyPositionMil?.y)
        const positionX = Number(placement?.positionMil?.x)
        const positionY = Number(placement?.positionMil?.y)

        return Number.isFinite(bodyX) &&
            Number.isFinite(bodyY) &&
            Number.isFinite(positionX) &&
            Number.isFinite(positionY)
            ? { x: bodyX - positionX, y: bodyY - positionY }
            : null
    }

    /**
     * Resolves the center of horizontal bounds.
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
     * Resolves the largest span of one bounds record.
     * @param {{ minX?: number, minY?: number, maxX?: number, maxY?: number } | null} bounds Bounds.
     * @returns {number}
     */
    static #boundsMaxSpan(bounds) {
        if (!bounds) {
            return Infinity
        }

        return Math.max(
            Number(bounds.maxX || 0) - Number(bounds.minX || 0),
            Number(bounds.maxY || 0) - Number(bounds.minY || 0)
        )
    }

    /**
     * Resolves the source-space body anchor used for owner proximity.
     * @param {{ bodyPositionMil?: { x?: number, y?: number } }} placement Static placement.
     * @returns {{ x: number, y: number } | null}
     */
    static #sourceBodyPosition(placement) {
        const x = Number(placement?.bodyPositionMil?.x)
        const y = Number(placement?.bodyPositionMil?.y)

        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
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
     * Builds touching placement clusters across source identities and sides.
     * @param {{ placement: object }[]} placementRows Placement rows.
     * @returns {{ indexes: number[], bounds: { minX: number, minY: number, maxX: number, maxY: number } }[]}
     */
    static #clusters(placementRows) {
        const clusters = []

        placementRows.forEach((row, index) => {
            const bounds = PcbScene3dStaticBodyOwnerPromotion.#bounds(
                row.placement
            )
            const touching = clusters.filter((cluster) =>
                PcbScene3dStaticBodyOwnerPromotion.#touches(
                    cluster.bounds,
                    bounds,
                    2
                )
            )

            if (!touching.length) {
                clusters.push({ indexes: [index], bounds })
                return
            }

            const target = touching[0]
            target.indexes.push(index)
            target.bounds = PcbScene3dStaticBodyOwnerPromotion.#merge(
                target.bounds,
                bounds
            )
            touching.slice(1).forEach((cluster) => {
                target.indexes.push(...cluster.indexes)
                target.bounds = PcbScene3dStaticBodyOwnerPromotion.#merge(
                    target.bounds,
                    cluster.bounds
                )
                clusters.splice(clusters.indexOf(cluster), 1)
            })
        })

        return clusters
    }

    /**
     * Resolves one unambiguous owner row for a touching cluster.
     * @param {{ placement: object, matchedComponent: object | null }[]} placementRows Placement rows.
     * @param {number[]} indexes Cluster indexes.
     * @returns {{ placement: object, matchedComponent: object } | null}
     */
    static #uniqueOwnerRow(placementRows, indexes) {
        const owners = indexes
            .map((index) => placementRows[index])
            .filter((row) => row.matchedComponent)
        const designators = new Set(
            owners.map((row) =>
                String(row.matchedComponent?.designator || '').trim()
            )
        )

        return designators.size === 1 ? owners[0] : null
    }

    /**
     * Checks whether one row may inherit a touching cluster owner.
     * @param {{ placement: object, matchedComponent: object | null }} row Placement row.
     * @returns {boolean}
     */
    static #canPromote(row) {
        if (row.matchedComponent) {
            return true
        }

        return (
            PcbScene3dStaticBodyOwnerPromotion.#isGenericDesignator(
                row.placement
            ) &&
            PcbScene3dStaticBodyOwnerPromotion.#maxSpan(
                row.placement?.geometry
            ) <= 40
        )
    }

    /**
     * Checks whether one row may claim the nearest exact physical owner.
     * @param {{ placement: object, matchedComponent: object | null }} row Placement row.
     * @returns {boolean}
     */
    static #canPromoteNearestOwner(row) {
        if (
            PcbScene3dStaticBodyOwnerPromotion.#canPromote(row) ||
            PcbScene3dStaticBodyOwnerPromotion.#isCompactRow(row)
        ) {
            return true
        }

        return (
            PcbScene3dStaticBodyOwnerPromotion.#isGenericSubpartDesignator(
                row.placement
            ) &&
            PcbScene3dStaticBodyOwnerPromotion.#maxSpan(
                row.placement?.geometry
            ) <=
                PcbScene3dStaticBodyOwnerPromotion
                    .#GENERIC_SUBPART_OWNER_MAX_SPAN_MIL
        )
    }

    /**
     * Checks whether one row is compact enough for cluster-center ownership.
     * @param {{ placement: object }} row Placement row.
     * @returns {boolean}
     */
    static #isCompactRow(row) {
        return (
            PcbScene3dStaticBodyOwnerPromotion.#maxSpan(
                row.placement?.geometry
            ) <= 40
        )
    }

    /**
     * Checks whether a placement uses only the generic static-body label.
     * @param {{ designator?: string } | null} placement Static placement.
     * @returns {boolean}
     */
    static #isGenericDesignator(placement) {
        const designator = String(placement?.designator || '').trim()
        return !designator || designator === '3D body'
    }

    /**
     * Checks whether a placement identity names a generic package sub-part.
     * @param {{ designator?: string, sourceIdentityKey?: string } | null} placement Static placement.
     * @returns {boolean}
     */
    static #isGenericSubpartDesignator(placement) {
        return PcbScene3dStaticBodyOwnerPromotion.#identityTokens(
            placement
        ).some((token) =>
            PcbScene3dStaticBodyOwnerPromotion.#GENERIC_SUBPART_TOKENS.has(
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
     * Applies a mount side while preserving the placement's XY anchor.
     * @param {object} placement Static placement.
     * @param {string | undefined} mountSide Owner mount side.
     * @returns {object}
     */
    static #withMountSide(placement, mountSide) {
        const currentSide =
            PcbScene3dStaticBodyOwnerPromotion.#normalizeMountSide(
                placement?.mountSide
            )
        const side = PcbScene3dStaticBodyOwnerPromotion.#normalizeMountSide(
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
                    : PcbScene3dStaticBodyOwnerPromotion.#mirrorSourceCoordinateGeometry(
                          placement
                      )
        }
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
    static #mirrorSourceCoordinateGeometry(placement) {
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
                x: PcbScene3dStaticBodyOwnerPromotion.#roundMil(
                    Number(vertex?.x || 0)
                ),
                y: PcbScene3dStaticBodyOwnerPromotion.#roundMil(
                    -Number(vertex?.y || 0)
                )
            }))
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
            ...PcbScene3dStaticBodyOwnerPromotion.#withMountSide(
                placement,
                PcbScene3dStaticBodyOwnerPromotion.#componentMountSide(owner)
            ),
            designator:
                String(owner?.designator || '').trim() || placement?.designator
        }
    }

    /**
     * Builds horizontal bounds for one static placement.
     * @param {{ positionMil?: { x?: number, y?: number }, geometry?: object }} placement Static placement.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #bounds(placement) {
        const centerX = Number(placement?.positionMil?.x || 0)
        const centerY = Number(placement?.positionMil?.y || 0)
        const vertices = Array.isArray(placement?.geometry?.verticesMil)
            ? placement.geometry.verticesMil
            : []
        if (!vertices.length) {
            return {
                minX: centerX,
                minY: centerY,
                maxX: centerX,
                maxY: centerY
            }
        }

        const xs = vertices.map((vertex) => Number(vertex?.x || 0))
        const ys = vertices.map((vertex) => Number(vertex?.y || 0))

        return {
            minX: centerX + Math.min(...xs),
            minY: centerY + Math.min(...ys),
            maxX: centerX + Math.max(...xs),
            maxY: centerY + Math.max(...ys)
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
     * Checks whether two horizontal bounds overlap or nearly touch.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} left Bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} right Bounds.
     * @param {number} toleranceMil Tolerance in mils.
     * @returns {boolean}
     */
    static #touches(left, right, toleranceMil) {
        const tolerance = Math.max(Number(toleranceMil || 0), 0)

        return (
            left.minX <= right.maxX + tolerance &&
            left.maxX >= right.minX - tolerance &&
            left.minY <= right.maxY + tolerance &&
            left.maxY >= right.minY - tolerance
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

    /**
     * Merges two bounds records.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} left Bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} right Bounds.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #merge(left, right) {
        return {
            minX: Math.min(left.minX, right.minX),
            minY: Math.min(left.minY, right.minY),
            maxX: Math.max(left.maxX, right.maxX),
            maxY: Math.max(left.maxY, right.maxY)
        }
    }
}
