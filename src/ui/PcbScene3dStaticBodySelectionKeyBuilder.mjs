// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Assigns selectable keys to static 3D body placements.
 */
export class PcbScene3dStaticBodySelectionKeyBuilder {
    static #STATIC_SELECTION_CLUSTER_TOLERANCE_MIL = 20

    /**
     * Assigns stable selectable keys while preserving display designators.
     * @param {{ placement: { designator: string, sourceIdentityKey?: string, mountSide?: string, rotationDeg?: number, positionMil?: { x?: number, y?: number }, geometry?: object }, matchedComponent: object | null }[]} placementRows Placement rows.
     * @returns {{ designator: string, selectionKey: string }[]}
     */
    static assign(placementRows) {
        const placements = placementRows.map((row) => ({ ...row.placement }))
        const sourceGroups = new Map()

        placementRows.forEach((row, index) => {
            const groupKey =
                PcbScene3dStaticBodySelectionKeyBuilder.#sourceGroupKey(
                    row.placement
                )
            if (!groupKey) {
                placements[index].selectionKey =
                    PcbScene3dStaticBodySelectionKeyBuilder.#matchedDesignator(
                        row
                    ) || row.placement?.designator
                return
            }

            if (!sourceGroups.has(groupKey)) {
                sourceGroups.set(groupKey, [])
            }
            sourceGroups.get(groupKey)?.push(index)
        })

        sourceGroups.forEach((indexes) => {
            const clusters =
                PcbScene3dStaticBodySelectionKeyBuilder.#clusterPlacementIndexes(
                    placements,
                    indexes
                )

            if (clusters.length <= 1) {
                const matchedDesignator =
                    PcbScene3dStaticBodySelectionKeyBuilder.#uniqueMatchedDesignator(
                        placementRows,
                        indexes
                    )
                indexes.forEach((index) => {
                    placements[index].selectionKey =
                        matchedDesignator || placements[index].designator
                })
                return
            }

            const usedKeys = new Set()
            clusters
                .sort((left, right) =>
                    PcbScene3dStaticBodySelectionKeyBuilder.#compareClusterCenters(
                        left,
                        right
                    )
                )
                .forEach((cluster) => {
                    const matchedDesignator =
                        PcbScene3dStaticBodySelectionKeyBuilder.#uniqueMatchedDesignator(
                            placementRows,
                            cluster.indexes
                        )
                    const selectionKey =
                        matchedDesignator ||
                        PcbScene3dStaticBodySelectionKeyBuilder.#uniqueSelectionKey(
                            placements[cluster.indexes[0]],
                            cluster,
                            usedKeys
                        )
                    cluster.indexes.forEach((index) => {
                        placements[index].selectionKey = selectionKey
                    })
                })
        })

        return placements
    }

    /**
     * Builds the grouping key used to connect sibling static body shapes.
     * @param {{ designator?: string, sourceIdentityKey?: string, mountSide?: string }} placement Static placement.
     * @returns {string}
     */
    static #sourceGroupKey(placement) {
        const sourceIdentity = String(
            placement?.sourceIdentityKey || placement?.designator || ''
        ).trim()
        if (!sourceIdentity) {
            return ''
        }

        return (
            sourceIdentity +
            '\u0000' +
            String(placement?.mountSide || '').trim()
        )
    }

    /**
     * Resolves the matched component designator from one placement row.
     * @param {{ matchedComponent?: { designator?: string } | null }} row Placement row.
     * @returns {string}
     */
    static #matchedDesignator(row) {
        return String(row?.matchedComponent?.designator || '').trim()
    }

    /**
     * Resolves one unambiguous matched owner for a static body cluster.
     * @param {{ matchedComponent?: { designator?: string } | null }[]} placementRows Placement rows.
     * @param {number[]} indexes Cluster indexes.
     * @returns {string}
     */
    static #uniqueMatchedDesignator(placementRows, indexes) {
        const matchedDesignators = new Set(
            indexes
                .map((index) =>
                    PcbScene3dStaticBodySelectionKeyBuilder.#matchedDesignator(
                        placementRows[index]
                    )
                )
                .filter(Boolean)
        )

        return matchedDesignators.size === 1 ? [...matchedDesignators][0] : ''
    }

    /**
     * Clusters static body placements whose horizontal geometry touches.
     * @param {object[]} placements Static body placements.
     * @param {number[]} indexes Placement indexes in one display group.
     * @returns {{ indexes: number[], bounds: { minX: number, minY: number, maxX: number, maxY: number }, center: { x: number, y: number } }[]}
     */
    static #clusterPlacementIndexes(placements, indexes) {
        const clusters = []

        indexes.forEach((index) => {
            const bounds =
                PcbScene3dStaticBodySelectionKeyBuilder.#placementBounds(
                    placements[index]
                )
            const matchingClusters = clusters.filter((cluster) =>
                PcbScene3dStaticBodySelectionKeyBuilder.#boundsTouch(
                    cluster.bounds,
                    bounds,
                    PcbScene3dStaticBodySelectionKeyBuilder
                        .#STATIC_SELECTION_CLUSTER_TOLERANCE_MIL
                )
            )

            if (!matchingClusters.length) {
                clusters.push({
                    indexes: [index],
                    bounds,
                    center: PcbScene3dStaticBodySelectionKeyBuilder.#boundsCenter(
                        bounds
                    )
                })
                return
            }

            const targetCluster = matchingClusters[0]
            targetCluster.indexes.push(index)
            targetCluster.bounds =
                PcbScene3dStaticBodySelectionKeyBuilder.#mergeBounds(
                    targetCluster.bounds,
                    bounds
                )
            targetCluster.center =
                PcbScene3dStaticBodySelectionKeyBuilder.#boundsCenter(
                    targetCluster.bounds
                )

            matchingClusters.slice(1).forEach((cluster) => {
                targetCluster.indexes.push(...cluster.indexes)
                targetCluster.bounds =
                    PcbScene3dStaticBodySelectionKeyBuilder.#mergeBounds(
                        targetCluster.bounds,
                        cluster.bounds
                    )
                targetCluster.center =
                    PcbScene3dStaticBodySelectionKeyBuilder.#boundsCenter(
                        targetCluster.bounds
                    )
                clusters.splice(clusters.indexOf(cluster), 1)
            })
        })

        return clusters
    }

    /**
     * Builds an axis-aligned horizontal bounds record for one placement.
     * @param {{ positionMil?: { x?: number, y?: number }, geometry?: object }} placement Static placement.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #placementBounds(placement) {
        const centerX = Number(placement?.positionMil?.x || 0)
        const centerY = Number(placement?.positionMil?.y || 0)
        const geometry = placement?.geometry || {}
        const vertices = Array.isArray(geometry?.verticesMil)
            ? geometry.verticesMil
            : []

        if (vertices.length) {
            const xs = vertices.map((vertex) => Number(vertex?.x || 0))
            const ys = vertices.map((vertex) => Number(vertex?.y || 0))

            return {
                minX: centerX + Math.min(...xs),
                minY: centerY + Math.min(...ys),
                maxX: centerX + Math.max(...xs),
                maxY: centerY + Math.max(...ys)
            }
        }

        const radius = Number(geometry?.radiusMil || 0)
        const span = Number.isFinite(radius) && radius > 0 ? radius : 0

        return {
            minX: centerX - span,
            minY: centerY - span,
            maxX: centerX + span,
            maxY: centerY + span
        }
    }

    /**
     * Checks whether two bounds overlap or nearly touch.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} left Bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} right Bounds.
     * @param {number} toleranceMil Tolerance in mils.
     * @returns {boolean}
     */
    static #boundsTouch(left, right, toleranceMil) {
        const tolerance = Math.max(Number(toleranceMil || 0), 0)

        return (
            left.minX <= right.maxX + tolerance &&
            left.maxX >= right.minX - tolerance &&
            left.minY <= right.maxY + tolerance &&
            left.maxY >= right.minY - tolerance
        )
    }

    /**
     * Merges two bounds records.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} left Bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} right Bounds.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #mergeBounds(left, right) {
        return {
            minX: Math.min(left.minX, right.minX),
            minY: Math.min(left.minY, right.minY),
            maxX: Math.max(left.maxX, right.maxX),
            maxY: Math.max(left.maxY, right.maxY)
        }
    }

    /**
     * Resolves one bounds center.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Bounds.
     * @returns {{ x: number, y: number }}
     */
    static #boundsCenter(bounds) {
        return {
            x: PcbScene3dStaticBodySelectionKeyBuilder.#roundMil(
                (Number(bounds.minX || 0) + Number(bounds.maxX || 0)) / 2
            ),
            y: PcbScene3dStaticBodySelectionKeyBuilder.#roundMil(
                (Number(bounds.minY || 0) + Number(bounds.maxY || 0)) / 2
            )
        }
    }

    /**
     * Sorts clusters by their stable center coordinates.
     * @param {{ center: { x: number, y: number } }} left Left cluster.
     * @param {{ center: { x: number, y: number } }} right Right cluster.
     * @returns {number}
     */
    static #compareClusterCenters(left, right) {
        return (
            Number(left.center?.y || 0) - Number(right.center?.y || 0) ||
            Number(left.center?.x || 0) - Number(right.center?.x || 0)
        )
    }

    /**
     * Builds a unique selection key for one static body cluster.
     * @param {{ designator?: string, mountSide?: string }} placement Representative placement.
     * @param {{ center: { x: number, y: number } }} cluster Static body cluster.
     * @param {Set<string>} usedKeys Keys already assigned in this group.
     * @returns {string}
     */
    static #uniqueSelectionKey(placement, cluster, usedKeys) {
        const baseDesignator = String(
            placement?.designator || 'static-body'
        ).trim()
        const mountSide = String(placement?.mountSide || 'top').trim() || 'top'
        const baseKey =
            baseDesignator +
            '@' +
            mountSide +
            ':' +
            PcbScene3dStaticBodySelectionKeyBuilder.#selectionCoordinate(
                cluster.center?.x
            ) +
            ',' +
            PcbScene3dStaticBodySelectionKeyBuilder.#selectionCoordinate(
                cluster.center?.y
            )
        let selectionKey = baseKey
        let suffix = 2

        while (usedKeys.has(selectionKey)) {
            selectionKey = baseKey + '#' + suffix
            suffix += 1
        }

        usedKeys.add(selectionKey)
        return selectionKey
    }

    /**
     * Formats a scene coordinate for a static selection key.
     * @param {number | undefined} value Coordinate in mils.
     * @returns {string}
     */
    static #selectionCoordinate(value) {
        return String(
            PcbScene3dStaticBodySelectionKeyBuilder.#roundMil(
                Number(value || 0)
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
}
