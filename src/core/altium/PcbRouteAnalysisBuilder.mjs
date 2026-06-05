// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic routed-net summaries from normalized PCB primitives.
 */
export class PcbRouteAnalysisBuilder {
    static SCHEMA = 'altium-toolkit.pcb.route-analysis.a1'

    /**
     * Builds a route-analysis read model.
     * @param {object} pcb Normalized PCB model and metadata.
     * @returns {object}
     */
    static build(pcb = {}) {
        const layerLookup = PcbRouteAnalysisBuilder.#layerLookup(pcb)
        const routePrimitives = PcbRouteAnalysisBuilder.#routePrimitives(
            pcb,
            layerLookup
        )
        const viaRows = PcbRouteAnalysisBuilder.#viaRows(pcb, layerLookup)
        const netRows = PcbRouteAnalysisBuilder.#netRows(
            pcb,
            routePrimitives,
            viaRows
        )
        const summary = PcbRouteAnalysisBuilder.#summary(
            pcb,
            routePrimitives,
            viaRows,
            netRows
        )

        return {
            schema: PcbRouteAnalysisBuilder.SCHEMA,
            units: {
                coordinate: 'mil',
                length: 'mil',
                angle: 'deg'
            },
            summary,
            byNet: netRows,
            classes: PcbRouteAnalysisBuilder.#classRows(pcb, netRows),
            differentialPairs: PcbRouteAnalysisBuilder.#differentialPairRows(
                pcb,
                netRows
            )
        }
    }

    /**
     * Builds layer descriptors keyed by id.
     * @param {object} pcb Normalized PCB model.
     * @returns {Map<number, object>}
     */
    static #layerLookup(pcb) {
        const lookup = new Map()

        for (const layer of [
            ...(pcb?.layers || []),
            ...(pcb?.primitiveLayers || [])
        ]) {
            const layerId = PcbRouteAnalysisBuilder.#layerId(layer)
            if (!Number.isInteger(layerId) || lookup.has(layerId)) {
                continue
            }
            lookup.set(layerId, {
                layerId,
                layerKey: 'L' + layerId,
                displayName:
                    layer.displayName || layer.name || 'Layer ' + layerId
            })
        }

        return lookup
    }

    /**
     * Builds route primitive rows for tracks and arcs.
     * @param {object} pcb Normalized PCB model.
     * @param {Map<number, object>} layerLookup Layer lookup.
     * @returns {object[]}
     */
    static #routePrimitives(pcb, layerLookup) {
        return [
            ...(pcb?.tracks || []).map((track, index) =>
                PcbRouteAnalysisBuilder.#trackRow(track, index, layerLookup)
            ),
            ...(pcb?.arcs || []).map((arc, index) =>
                PcbRouteAnalysisBuilder.#arcRow(arc, index, layerLookup)
            )
        ].filter((primitive) => primitive.netName && primitive.lengthMil > 0)
    }

    /**
     * Builds one track route row.
     * @param {object} track Track primitive.
     * @param {number} index Track index.
     * @param {Map<number, object>} layerLookup Layer lookup.
     * @returns {object}
     */
    static #trackRow(track, index, layerLookup) {
        const layer = PcbRouteAnalysisBuilder.#primitiveLayer(
            track,
            layerLookup
        )
        const start = PcbRouteAnalysisBuilder.#point(track.x1, track.y1)
        const end = PcbRouteAnalysisBuilder.#point(track.x2, track.y2)

        return PcbRouteAnalysisBuilder.#stripEmpty({
            primitiveKey: 'track-' + index,
            kind: 'track',
            netName: PcbRouteAnalysisBuilder.#netName(track),
            layerId: layer?.layerId,
            layerKey: layer?.layerKey,
            layerDisplayName: layer?.displayName,
            lengthMil: PcbRouteAnalysisBuilder.#round(
                PcbRouteAnalysisBuilder.#distance(start, end)
            ),
            endpoints: [start, end]
        })
    }

    /**
     * Builds one arc route row.
     * @param {object} arc Arc primitive.
     * @param {number} index Arc index.
     * @param {Map<number, object>} layerLookup Layer lookup.
     * @returns {object}
     */
    static #arcRow(arc, index, layerLookup) {
        const layer = PcbRouteAnalysisBuilder.#primitiveLayer(arc, layerLookup)
        const endpoints = PcbRouteAnalysisBuilder.#arcEndpoints(arc)

        return PcbRouteAnalysisBuilder.#stripEmpty({
            primitiveKey: 'arc-' + index,
            kind: 'arc',
            netName: PcbRouteAnalysisBuilder.#netName(arc),
            layerId: layer?.layerId,
            layerKey: layer?.layerKey,
            layerDisplayName: layer?.displayName,
            lengthMil: PcbRouteAnalysisBuilder.#round(
                Number(arc.radius || 0) *
                    Math.abs(PcbRouteAnalysisBuilder.#arcSweepRadians(arc))
            ),
            endpoints
        })
    }

    /**
     * Builds via participation rows.
     * @param {object} pcb Normalized PCB model.
     * @param {Map<number, object>} layerLookup Layer lookup.
     * @returns {object[]}
     */
    static #viaRows(pcb, layerLookup) {
        return (pcb?.vias || [])
            .map((via, index) => {
                const layer = PcbRouteAnalysisBuilder.#primitiveLayer(
                    via,
                    layerLookup
                )

                return PcbRouteAnalysisBuilder.#stripEmpty({
                    primitiveKey: 'via-' + index,
                    kind: 'via',
                    netName: PcbRouteAnalysisBuilder.#netName(via),
                    layerId: layer?.layerId,
                    layerKey: layer?.layerKey,
                    layerDisplayName: layer?.displayName,
                    point: PcbRouteAnalysisBuilder.#point(via.x, via.y)
                })
            })
            .filter((via) => via.netName)
    }

    /**
     * Builds deterministic net route rows.
     * @param {object} pcb Normalized PCB model.
     * @param {object[]} routePrimitives Route primitives.
     * @param {object[]} viaRows Via rows.
     * @returns {object[]}
     */
    static #netRows(pcb, routePrimitives, viaRows) {
        const netNames = new Set([
            ...(pcb?.nets || []).map((net) => net.name).filter(Boolean),
            ...routePrimitives.map((primitive) => primitive.netName),
            ...viaRows.map((via) => via.netName)
        ])

        return [...netNames]
            .map((netName) =>
                PcbRouteAnalysisBuilder.#netRow(
                    netName,
                    routePrimitives.filter(
                        (primitive) => primitive.netName === netName
                    ),
                    viaRows.filter((via) => via.netName === netName)
                )
            )
            .filter((net) => net.totalLengthMil > 0 || net.viaCount > 0)
            .sort((left, right) =>
                left.netName.localeCompare(right.netName, undefined, {
                    numeric: true
                })
            )
    }

    /**
     * Builds one net route row.
     * @param {string} netName Net name.
     * @param {object[]} primitives Route primitives.
     * @param {object[]} vias Via rows.
     * @returns {object}
     */
    static #netRow(netName, primitives, vias) {
        const trackRows = primitives.filter(
            (primitive) => primitive.kind === 'track'
        )
        const arcRows = primitives.filter(
            (primitive) => primitive.kind === 'arc'
        )

        return {
            netName,
            totalLengthMil: PcbRouteAnalysisBuilder.#sumLength(primitives),
            trackLengthMil: PcbRouteAnalysisBuilder.#sumLength(trackRows),
            arcLengthMil: PcbRouteAnalysisBuilder.#sumLength(arcRows),
            trackCount: trackRows.length,
            arcCount: arcRows.length,
            viaCount: vias.length,
            layers: PcbRouteAnalysisBuilder.#layerKeys(primitives, vias),
            layerParticipation: PcbRouteAnalysisBuilder.#layerParticipation(
                primitives,
                vias
            ),
            connectedRouteGroups:
                PcbRouteAnalysisBuilder.#connectedRouteGroups(primitives)
        }
    }

    /**
     * Builds per-net-class length summaries.
     * @param {object} pcb Normalized PCB model.
     * @param {object[]} netRows Net rows.
     * @returns {object[]}
     */
    static #classRows(pcb, netRows) {
        const lengthByNet = PcbRouteAnalysisBuilder.#lengthByNet(netRows)
        const knownNetNames = new Set(netRows.map((net) => net.netName))

        return (pcb?.classes || [])
            .filter((classRecord) =>
                PcbRouteAnalysisBuilder.#isNetClass(classRecord)
            )
            .map((classRecord) => {
                const netNames = (classRecord.members || [])
                    .filter((member) => knownNetNames.has(member))
                    .sort((left, right) =>
                        left.localeCompare(right, undefined, { numeric: true })
                    )

                return PcbRouteAnalysisBuilder.#stripEmpty({
                    name: classRecord.name,
                    kindName: classRecord.kindName,
                    members: [...(classRecord.members || [])],
                    netNames,
                    totalLengthMil: PcbRouteAnalysisBuilder.#round(
                        netNames.reduce(
                            (total, netName) =>
                                total + Number(lengthByNet.get(netName) || 0),
                            0
                        )
                    )
                })
            })
            .filter((classRow) => classRow.name && classRow.netNames?.length)
            .sort((left, right) =>
                left.name.localeCompare(right.name, undefined, {
                    numeric: true
                })
            )
    }

    /**
     * Builds differential-pair route summaries.
     * @param {object} pcb Normalized PCB model.
     * @param {object[]} netRows Net rows.
     * @returns {object[]}
     */
    static #differentialPairRows(pcb, netRows) {
        const lengthByNet = PcbRouteAnalysisBuilder.#lengthByNet(netRows)

        return (pcb?.differentialPairs || [])
            .map((pair) => {
                const positiveLength = Number(
                    lengthByNet.get(pair.positiveNetName) || 0
                )
                const negativeLength = Number(
                    lengthByNet.get(pair.negativeNetName) || 0
                )

                return PcbRouteAnalysisBuilder.#stripEmpty({
                    name: pair.name,
                    positiveNetName: pair.positiveNetName,
                    negativeNetName: pair.negativeNetName,
                    positiveLengthMil:
                        PcbRouteAnalysisBuilder.#round(positiveLength),
                    negativeLengthMil:
                        PcbRouteAnalysisBuilder.#round(negativeLength),
                    skewLengthMil: PcbRouteAnalysisBuilder.#round(
                        Math.abs(positiveLength - negativeLength)
                    ),
                    classes: pair.classNames || []
                })
            })
            .filter(
                (pair) =>
                    pair.name &&
                    (pair.positiveLengthMil > 0 || pair.negativeLengthMil > 0)
            )
            .sort((left, right) =>
                left.name.localeCompare(right.name, undefined, {
                    numeric: true
                })
            )
    }

    /**
     * Builds top-level route summary counters.
     * @param {object} pcb Normalized PCB model.
     * @param {object[]} routePrimitives Route primitives.
     * @param {object[]} viaRows Via rows.
     * @param {object[]} netRows Net rows.
     * @returns {object}
     */
    static #summary(pcb, routePrimitives, viaRows, netRows) {
        return {
            netCount: (pcb?.nets || []).length || netRows.length,
            routedNetCount: netRows.length,
            totalLengthMil: PcbRouteAnalysisBuilder.#sumLength(routePrimitives),
            trackCount: routePrimitives.filter(
                (primitive) => primitive.kind === 'track'
            ).length,
            arcCount: routePrimitives.filter(
                (primitive) => primitive.kind === 'arc'
            ).length,
            viaCount: viaRows.length,
            connectedRouteGroupCount: netRows.reduce(
                (total, net) => total + net.connectedRouteGroups.length,
                0
            ),
            differentialPairCount: (pcb?.differentialPairs || []).filter(
                (pair) =>
                    netRows.some(
                        (net) =>
                            net.netName === pair.positiveNetName ||
                            net.netName === pair.negativeNetName
                    )
            ).length
        }
    }

    /**
     * Builds connected route groups from shared endpoints.
     * @param {object[]} primitives Route primitives for one net.
     * @returns {object[]}
     */
    static #connectedRouteGroups(primitives) {
        const parent = primitives.map((_, index) => index)
        const endpointOwners = new Map()

        primitives.forEach((primitive, primitiveIndex) => {
            for (const endpoint of primitive.endpoints || []) {
                const key = PcbRouteAnalysisBuilder.#pointKey(endpoint)
                if (endpointOwners.has(key)) {
                    PcbRouteAnalysisBuilder.#union(
                        parent,
                        primitiveIndex,
                        endpointOwners.get(key)
                    )
                } else {
                    endpointOwners.set(key, primitiveIndex)
                }
            }
        })

        const groups = new Map()
        primitives.forEach((primitive, primitiveIndex) => {
            const groupIndex = PcbRouteAnalysisBuilder.#find(
                parent,
                primitiveIndex
            )
            if (!groups.has(groupIndex)) {
                groups.set(groupIndex, [])
            }
            groups.get(groupIndex).push(primitive)
        })

        return [...groups.values()]
            .map((group, index) => ({
                groupIndex: index,
                primitiveKeys: group.map((primitive) => primitive.primitiveKey),
                lengthMil: PcbRouteAnalysisBuilder.#sumLength(group),
                layerIds: PcbRouteAnalysisBuilder.#layerIds(group, []),
                layerKeys: PcbRouteAnalysisBuilder.#layerKeys(group, []),
                endpoints: PcbRouteAnalysisBuilder.#groupEndpoints(group)
            }))
            .sort((left, right) => left.groupIndex - right.groupIndex)
    }

    /**
     * Builds layer participation rows.
     * @param {object[]} primitives Route primitives.
     * @param {object[]} vias Via rows.
     * @returns {object[]}
     */
    static #layerParticipation(primitives, vias) {
        const rowsByKey = new Map()

        for (const row of [...primitives, ...vias]) {
            const layerKey = row.layerKey || ''
            if (!layerKey) {
                continue
            }
            if (!rowsByKey.has(layerKey)) {
                rowsByKey.set(layerKey, {
                    layerId: row.layerId,
                    layerKey,
                    displayName: row.layerDisplayName,
                    totalLengthMil: 0,
                    primitiveCount: 0,
                    viaCount: 0
                })
            }
            const entry = rowsByKey.get(layerKey)
            entry.totalLengthMil += Number(row.lengthMil || 0)
            entry.primitiveCount += row.kind === 'via' ? 0 : 1
            entry.viaCount += row.kind === 'via' ? 1 : 0
        }

        return [...rowsByKey.values()]
            .map((entry) => ({
                ...entry,
                totalLengthMil: PcbRouteAnalysisBuilder.#round(
                    entry.totalLengthMil
                )
            }))
            .sort((left, right) =>
                left.layerKey.localeCompare(right.layerKey, undefined, {
                    numeric: true
                })
            )
    }

    /**
     * Returns layer keys used by primitive rows.
     * @param {object[]} primitives Route primitives.
     * @param {object[]} vias Via rows.
     * @returns {string[]}
     */
    static #layerKeys(primitives, vias) {
        return [
            ...new Set(
                [...primitives, ...vias]
                    .map((row) => row.layerKey)
                    .filter(Boolean)
            )
        ].sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
    }

    /**
     * Returns layer ids used by primitive rows.
     * @param {object[]} primitives Route primitives.
     * @param {object[]} vias Via rows.
     * @returns {number[]}
     */
    static #layerIds(primitives, vias) {
        return [
            ...new Set(
                [...primitives, ...vias]
                    .map((row) => row.layerId)
                    .filter((layerId) => Number.isInteger(layerId))
            )
        ].sort((left, right) => left - right)
    }

    /**
     * Builds deduplicated group endpoint rows.
     * @param {object[]} group Route group primitives.
     * @returns {object[]}
     */
    static #groupEndpoints(group) {
        const endpointsByKey = new Map()
        for (const primitive of group) {
            for (const endpoint of primitive.endpoints || []) {
                endpointsByKey.set(
                    PcbRouteAnalysisBuilder.#pointKey(endpoint),
                    endpoint
                )
            }
        }
        return [...endpointsByKey.values()]
    }

    /**
     * Resolves one primitive layer descriptor.
     * @param {object} primitive Primitive row.
     * @param {Map<number, object>} layerLookup Layer lookup.
     * @returns {object | null}
     */
    static #primitiveLayer(primitive, layerLookup) {
        const layerId = PcbRouteAnalysisBuilder.#layerId(primitive)
        if (!Number.isInteger(layerId)) {
            return null
        }

        return (
            layerLookup.get(layerId) || {
                layerId,
                layerKey: 'L' + layerId,
                displayName: 'Layer ' + layerId
            }
        )
    }

    /**
     * Resolves a layer id from several native field spellings.
     * @param {object} value Candidate object.
     * @returns {number | undefined}
     */
    static #layerId(value) {
        for (const key of ['layerId', 'layerCode', 'id', 'index']) {
            const number = Number(value?.[key])
            if (Number.isInteger(number)) {
                return number
            }
        }

        return undefined
    }

    /**
     * Resolves a primitive net name.
     * @param {object} primitive Primitive row.
     * @returns {string}
     */
    static #netName(primitive) {
        return String(
            primitive?.netName || primitive?.net || primitive?.netLabel || ''
        ).trim()
    }

    /**
     * Builds a normalized point.
     * @param {unknown} x X coordinate.
     * @param {unknown} y Y coordinate.
     * @returns {{ x: number, y: number }}
     */
    static #point(x, y) {
        return {
            x: PcbRouteAnalysisBuilder.#round(x),
            y: PcbRouteAnalysisBuilder.#round(y)
        }
    }

    /**
     * Computes Euclidean distance between two points.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {number}
     */
    static #distance(start, end) {
        return Math.hypot(
            Number(end.x) - Number(start.x),
            Number(end.y) - Number(start.y)
        )
    }

    /**
     * Builds approximate endpoints for an arc primitive.
     * @param {object} arc Arc primitive.
     * @returns {object[]}
     */
    static #arcEndpoints(arc) {
        const radius = Number(arc.radius || 0)
        const centerX = Number(arc.x || arc.centerX || 0)
        const centerY = Number(arc.y || arc.centerY || 0)
        const startAngle = (Number(arc.startAngle || 0) * Math.PI) / 180
        const endAngle = (Number(arc.endAngle || 0) * Math.PI) / 180

        return [
            PcbRouteAnalysisBuilder.#point(
                centerX + radius * Math.cos(startAngle),
                centerY + radius * Math.sin(startAngle)
            ),
            PcbRouteAnalysisBuilder.#point(
                centerX + radius * Math.cos(endAngle),
                centerY + radius * Math.sin(endAngle)
            )
        ]
    }

    /**
     * Resolves an arc sweep in radians.
     * @param {object} arc Arc primitive.
     * @returns {number}
     */
    static #arcSweepRadians(arc) {
        if (Number.isFinite(Number(arc.sweepAngle))) {
            return (Number(arc.sweepAngle) * Math.PI) / 180
        }

        const start = Number(arc.startAngle || 0)
        const end = Number(arc.endAngle || 0)
        let sweep = end - start
        while (sweep <= -180) sweep += 360
        while (sweep > 180) sweep -= 360
        return (sweep * Math.PI) / 180
    }

    /**
     * Builds a stable endpoint key with small coordinate tolerance.
     * @param {{ x: number, y: number }} point Endpoint.
     * @returns {string}
     */
    static #pointKey(point) {
        return (
            PcbRouteAnalysisBuilder.#round(point.x).toFixed(3) +
            ',' +
            PcbRouteAnalysisBuilder.#round(point.y).toFixed(3)
        )
    }

    /**
     * Returns a map of net names to routed length.
     * @param {object[]} netRows Net rows.
     * @returns {Map<string, number>}
     */
    static #lengthByNet(netRows) {
        return new Map(
            netRows.map((net) => [net.netName, Number(net.totalLengthMil || 0)])
        )
    }

    /**
     * Sums route primitive lengths.
     * @param {object[]} primitives Route primitive rows.
     * @returns {number}
     */
    static #sumLength(primitives) {
        return PcbRouteAnalysisBuilder.#round(
            (primitives || []).reduce(
                (total, primitive) => total + Number(primitive.lengthMil || 0),
                0
            )
        )
    }

    /**
     * Returns true when a class describes nets.
     * @param {object} classRecord Class row.
     * @returns {boolean}
     */
    static #isNetClass(classRecord) {
        return (
            classRecord?.kindName === 'net' || Number(classRecord?.kind) === 0
        )
    }

    /**
     * Finds a union-find root.
     * @param {number[]} parent Parent table.
     * @param {number} index Entry index.
     * @returns {number}
     */
    static #find(parent, index) {
        if (parent[index] !== index) {
            parent[index] = PcbRouteAnalysisBuilder.#find(parent, parent[index])
        }
        return parent[index]
    }

    /**
     * Unions two route group indexes.
     * @param {number[]} parent Parent table.
     * @param {number} left Left index.
     * @param {number} right Right index.
     */
    static #union(parent, left, right) {
        const leftRoot = PcbRouteAnalysisBuilder.#find(parent, left)
        const rightRoot = PcbRouteAnalysisBuilder.#find(parent, right)
        if (leftRoot !== rightRoot) {
            parent[rightRoot] = leftRoot
        }
    }

    /**
     * Rounds numeric values for stable JSON.
     * @param {unknown} value Candidate numeric value.
     * @returns {number}
     */
    static #round(value) {
        const number = Number(value || 0)
        return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0
    }

    /**
     * Removes empty object fields while preserving false and zero.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) {
                    return entryValue.length > 0
                }
                return (
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
                )
            })
        )
    }
}
