// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Shares primitive eligibility and physical layer metadata across PCB views.
 */
export class PcbInteractionSourceMetadata {
    /**
     * Returns zone sources in selectable-item extraction order.
     * @param {object} pcb PCB model.
     * @returns {object[]}
     */
    static zoneSources(pcb) {
        return [
            ...(Array.isArray(pcb?.regions) ? pcb.regions : []),
            ...(Array.isArray(pcb?.shapeBasedRegions)
                ? pcb.shapeBasedRegions
                : []),
            ...(Array.isArray(pcb?.polygons) ? pcb.polygons : [])
        ]
    }

    /**
     * Identifies selectable zone geometry without constructing its points.
     * @param {object} zone Zone-like source.
     * @returns {'points' | 'segments' | 'bounds' | null}
     */
    static zoneGeometryKind(zone) {
        if (Array.isArray(zone?.points) && zone.points.length >= 3) {
            return 'points'
        }
        if (Array.isArray(zone?.segments) && zone.segments.length >= 3) {
            return 'segments'
        }
        if (
            Number.isFinite(Number(zone?.x1)) &&
            Number.isFinite(Number(zone?.y1)) &&
            Number.isFinite(Number(zone?.x2)) &&
            Number.isFinite(Number(zone?.y2))
        ) {
            return 'bounds'
        }
        return null
    }

    /**
     * Creates a layer-name resolver for layer-id based primitives.
     * @param {object} pcb PCB model.
     * @returns {(item: object) => string[]}
     */
    static layerNameResolver(pcb) {
        const byId = new Map()
        const layers = [
            ...(Array.isArray(pcb?.layers) ? pcb.layers : []),
            ...(Array.isArray(pcb?.primitiveLayers) ? pcb.primitiveLayers : [])
        ]

        for (const layer of layers) {
            const layerId = Number(layer?.layerId)
            const name = String(layer?.name || '').trim()
            if (Number.isInteger(layerId) && name) {
                byId.set(layerId, name)
            }
        }

        return (item) => {
            const directLayer = String(item?.layer || '').trim()
            if (directLayer) return [directLayer]

            const layerId = Number(item?.layerId ?? item?.layerCode)
            if (Number.isInteger(layerId) && byId.has(layerId)) {
                return [byId.get(layerId)]
            }

            return []
        }
    }

    /**
     * Collects ordered physical layer keys without building selectable geometry.
     * @param {object} pcb PCB model.
     * @returns {Map<string, Set<string>>}
     */
    static layersByObject(pcb) {
        const layerNameFor = PcbInteractionSourceMetadata.layerNameResolver(pcb)
        const layersByObject = new Map()
        const groups = [
            ['zones', PcbInteractionSourceMetadata.zoneSources(pcb)],
            ['tracks', Array.isArray(pcb?.tracks) ? pcb.tracks : []],
            ['pads', Array.isArray(pcb?.pads) ? pcb.pads : []],
            ['footprint-text', Array.isArray(pcb?.texts) ? pcb.texts : []]
        ]

        // Vias and component bodies have no physical layer keys in the index.
        for (const [objectKey, sources] of groups) {
            const layerSet = new Set()
            layersByObject.set(objectKey, layerSet)
            if (objectKey === 'pads') layersByObject.set('holes', layerSet)

            for (const source of sources) {
                if (
                    objectKey === 'zones' &&
                    !PcbInteractionSourceMetadata.zoneGeometryKind(source)
                ) {
                    continue
                }
                if (
                    objectKey === 'footprint-text' &&
                    source?.visible === false
                ) {
                    continue
                }
                for (const layerKey of layerNameFor(source)) {
                    layerSet.add(layerKey)
                }
            }
        }

        return layersByObject
    }
}
