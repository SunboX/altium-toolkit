// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Classifies Altium PCB layer identifiers into stable public groups.
 */
export class PcbLayerGroups {
    static #GROUP_PRESENTATION = {
        'top-copper': { color: '#c05032', drawPriority: 600 },
        'mid-copper': { color: '#8e6bbf', drawPriority: 550 },
        'bottom-copper': { color: '#2f6f9f', drawPriority: 500 },
        'internal-plane': { color: '#7a8f2a', drawPriority: 450 },
        overlay: { color: '#f5f7fa', drawPriority: 900 },
        paste: { color: '#b9c0c7', drawPriority: 800 },
        'solder-mask': { color: '#2ca25f', drawPriority: 700 },
        drill: { color: '#3c4043', drawPriority: 300 },
        'drill-hole': { color: '#202124', drawPriority: 950 },
        keepout: { color: '#d93025', drawPriority: 1000 },
        mechanical: { color: '#7f8c8d', drawPriority: 100 },
        'multi-layer': { color: '#8f5bd3', drawPriority: 650 },
        unknown: { color: '#9aa0a6', drawPriority: 0 }
    }

    /**
     * Returns true when the layer is top copper.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isTopCopper(layerId) {
        return PcbLayerGroups.#layerId(layerId) === 1
    }

    /**
     * Returns true when the layer is bottom copper.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isBottomCopper(layerId) {
        return PcbLayerGroups.#layerId(layerId) === 32
    }

    /**
     * Returns true when the layer is an internal signal layer.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isMidCopper(layerId) {
        const layer = PcbLayerGroups.#layerId(layerId)
        return layer >= 2 && layer <= 31
    }

    /**
     * Returns true when the layer is any signal copper layer.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isCopper(layerId) {
        const layer = PcbLayerGroups.#layerId(layerId)
        return layer >= 1 && layer <= 32
    }

    /**
     * Returns true when the layer is an internal plane.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isInternalPlane(layerId) {
        const layer = PcbLayerGroups.#layerId(layerId)
        return layer >= 39 && layer <= 54
    }

    /**
     * Returns true when the layer is a silkscreen overlay.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isOverlay(layerId) {
        return [33, 34].includes(PcbLayerGroups.#layerId(layerId))
    }

    /**
     * Returns true when the layer is a solder paste layer.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isPaste(layerId) {
        return [35, 36].includes(PcbLayerGroups.#layerId(layerId))
    }

    /**
     * Returns true when the layer is a solder mask layer.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isSolderMask(layerId) {
        return [37, 38].includes(PcbLayerGroups.#layerId(layerId))
    }

    /**
     * Returns true when the layer is mechanical.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isMechanical(layerId) {
        const layer = PcbLayerGroups.#layerId(layerId)
        return layer >= 57 && layer <= 72
    }

    /**
     * Returns true when the layer carries drill drawing/guide output.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isDrill(layerId) {
        return [55, 73].includes(PcbLayerGroups.#layerId(layerId))
    }

    /**
     * Returns true when the layer represents a pad or via hole helper layer.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isDrillHole(layerId) {
        return [81, 82].includes(PcbLayerGroups.#layerId(layerId))
    }

    /**
     * Returns true when the layer spans multiple copper layers.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isMultiLayer(layerId) {
        return PcbLayerGroups.#layerId(layerId) === 74
    }

    /**
     * Returns true when the layer is the keepout layer.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isKeepout(layerId) {
        return PcbLayerGroups.#layerId(layerId) === 56
    }

    /**
     * Returns true for electrically meaningful layers plus silkscreen.
     * @param {unknown} layerId Layer identifier.
     * @returns {boolean}
     */
    static isSignalOrSilk(layerId) {
        return (
            PcbLayerGroups.isCopper(layerId) ||
            PcbLayerGroups.isInternalPlane(layerId) ||
            PcbLayerGroups.isOverlay(layerId) ||
            PcbLayerGroups.isMultiLayer(layerId)
        )
    }

    /**
     * Resolves one stable group name for a layer id.
     * @param {unknown} layerId Layer identifier.
     * @returns {string}
     */
    static groupForLayerId(layerId) {
        if (PcbLayerGroups.isTopCopper(layerId)) return 'top-copper'
        if (PcbLayerGroups.isBottomCopper(layerId)) return 'bottom-copper'
        if (PcbLayerGroups.isMidCopper(layerId)) return 'mid-copper'
        if (PcbLayerGroups.isInternalPlane(layerId)) return 'internal-plane'
        if (PcbLayerGroups.isOverlay(layerId)) return 'overlay'
        if (PcbLayerGroups.isPaste(layerId)) return 'paste'
        if (PcbLayerGroups.isSolderMask(layerId)) return 'solder-mask'
        if (PcbLayerGroups.isDrill(layerId)) return 'drill'
        if (PcbLayerGroups.isDrillHole(layerId)) return 'drill-hole'
        if (PcbLayerGroups.isKeepout(layerId)) return 'keepout'
        if (PcbLayerGroups.isMechanical(layerId)) return 'mechanical'
        if (PcbLayerGroups.isMultiLayer(layerId)) return 'multi-layer'
        return 'unknown'
    }

    /**
     * Describes one layer for diagnostics and reports.
     * @param {unknown} layerId Layer identifier.
     * @returns {{ layerId: number | null, group: string, side?: string, signalOrSilk: boolean }}
     */
    static describeLayer(layerId) {
        const normalizedLayerId = PcbLayerGroups.#layerId(layerId)
        return PcbLayerGroups.#stripUndefined({
            layerId: normalizedLayerId,
            group: PcbLayerGroups.groupForLayerId(layerId),
            side: PcbLayerGroups.#sideForLayerId(normalizedLayerId),
            signalOrSilk: PcbLayerGroups.isSignalOrSilk(layerId)
        })
    }

    /**
     * Resolves a deterministic display color for a layer id.
     * @param {unknown} layerId Layer identifier.
     * @returns {string}
     */
    static colorForLayerId(layerId) {
        return PcbLayerGroups.#presentationForGroup(
            PcbLayerGroups.groupForLayerId(layerId)
        ).color
    }

    /**
     * Resolves the deterministic draw priority for a layer id.
     * @param {unknown} layerId Layer identifier.
     * @returns {number}
     */
    static drawPriorityForLayerId(layerId) {
        return PcbLayerGroups.#presentationForGroup(
            PcbLayerGroups.groupForLayerId(layerId)
        ).drawPriority
    }

    /**
     * Describes grouping, side, color, and draw priority for one layer id.
     * @param {unknown} layerId Layer identifier.
     * @returns {{ layerId: number | null, group: string, side?: string, signalOrSilk: boolean, color: string, drawPriority: number }}
     */
    static presentationForLayerId(layerId) {
        return {
            ...PcbLayerGroups.describeLayer(layerId),
            color: PcbLayerGroups.colorForLayerId(layerId),
            drawPriority: PcbLayerGroups.drawPriorityForLayerId(layerId)
        }
    }

    /**
     * Sorts layer ids from lowest to highest deterministic draw priority.
     * @param {unknown[]} layerIds Layer identifiers.
     * @returns {unknown[]}
     */
    static sortByDrawPriority(layerIds) {
        return [...(Array.isArray(layerIds) ? layerIds : [])].sort(
            (left, right) => {
                const priorityDelta =
                    PcbLayerGroups.drawPriorityForLayerId(left) -
                    PcbLayerGroups.drawPriorityForLayerId(right)

                if (priorityDelta !== 0) return priorityDelta

                return (
                    Number(PcbLayerGroups.#layerId(left) ?? 0) -
                    Number(PcbLayerGroups.#layerId(right) ?? 0)
                )
            }
        )
    }

    /**
     * Resolves the physical side represented by one layer id.
     * @param {number | null} layerId Normalized layer id.
     * @returns {string | undefined}
     */
    static #sideForLayerId(layerId) {
        if ([1, 33, 35, 37].includes(layerId)) return 'top'
        if ([32, 34, 36, 38].includes(layerId)) return 'bottom'
        if (
            PcbLayerGroups.isMidCopper(layerId) ||
            PcbLayerGroups.isInternalPlane(layerId)
        ) {
            return 'internal'
        }
        if (
            PcbLayerGroups.isMultiLayer(layerId) ||
            PcbLayerGroups.isDrillHole(layerId)
        ) {
            return 'all'
        }
        return undefined
    }

    /**
     * Resolves presentation metadata for one stable group.
     * @param {string} group Layer group name.
     * @returns {{ color: string, drawPriority: number }}
     */
    static #presentationForGroup(group) {
        return (
            PcbLayerGroups.#GROUP_PRESENTATION[group] ||
            PcbLayerGroups.#GROUP_PRESENTATION.unknown
        )
    }

    /**
     * Normalizes one layer id.
     * @param {unknown} layerId Layer identifier.
     * @returns {number | null}
     */
    static #layerId(layerId) {
        const normalized = Number(layerId)
        return Number.isInteger(normalized) ? normalized : null
    }

    /**
     * Removes undefined fields from a report row.
     * @param {object} row Report row.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
