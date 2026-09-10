// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbInteractionSourceMetadata } from './PcbInteractionSourceMetadata.mjs'

const VIRTUAL_LAYER_DEFINITIONS = [
    { key: 'tracks', label: 'Tracks' },
    { key: 'vias', label: 'Vias' },
    { key: 'pads', label: 'Pads' },
    { key: 'holes', label: 'Holes' },
    { key: 'zones', label: 'Zones' },
    { key: 'footprint-text', label: 'Footprint text' }
]

/**
 * Builds a PCB layer summary with physical layers and virtual controls.
 */
export class PcbInteractionLayerModel {
    /**
     * Resolves physical and virtual interaction layers.
     * @param {object} documentModel Toolkit document model.
     * @returns {{ physicalLayers: object[], virtualLayers: object[] }}
     */
    static resolve(documentModel) {
        const pcb = documentModel?.pcb || {}
        const physicalLayers = PcbInteractionLayerModel.#physicalLayers(pcb)
        const layersByObject = PcbInteractionSourceMetadata.layersByObject(pcb)

        return {
            physicalLayers,
            virtualLayers: VIRTUAL_LAYER_DEFINITIONS.map((definition) => ({
                ...definition,
                physicalLayerKeys: Array.from(
                    layersByObject.get(definition.key) || []
                )
            }))
        }
    }

    /**
     * Resolves physical layer rows from board and primitive layer metadata.
     * @param {object} pcb PCB model.
     * @returns {object[]}
     */
    static #physicalLayers(pcb) {
        const seen = new Set()
        const layers = []
        const sources = [
            ...(Array.isArray(pcb?.layers) ? pcb.layers : []),
            ...(Array.isArray(pcb?.primitiveLayers) ? pcb.primitiveLayers : [])
        ]

        for (const layer of sources) {
            const key = String(layer?.name || layer?.layer || '').trim()
            if (!key || seen.has(key)) continue
            seen.add(key)
            const row = {
                key,
                label: key,
                layerId: Number.isFinite(Number(layer?.layerId))
                    ? Number(layer.layerId)
                    : null
            }
            if (Number.isFinite(Number(layer?.legacyLayerId))) {
                row.legacyLayerId = Number(layer.legacyLayerId)
            }
            layers.push(row)
        }

        return layers
    }
}
