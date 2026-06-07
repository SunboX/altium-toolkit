// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds drill overlay and draw-order review metadata.
 */
export class PcbReviewDrillMetadataBuilder {
    /**
     * Builds drill review and draw-order metadata.
     * @param {object} pcb Normalized PCB model.
     * @returns {{ overlays: object[], layerDrawOrder: object[] }}
     */
    static build(pcb = {}) {
        return {
            overlays: [
                ...PcbReviewDrillMetadataBuilder.#drillRows(
                    'via',
                    pcb.vias || []
                ),
                ...PcbReviewDrillMetadataBuilder.#drillRows(
                    'pad',
                    pcb.pads || []
                )
            ],
            layerDrawOrder: PcbReviewDrillMetadataBuilder.#layerDrawOrder(pcb)
        }
    }

    /**
     * Builds drill overlay rows for one drill-owner collection.
     * @param {'via' | 'pad'} ownerKind Drill owner kind.
     * @param {object[]} owners Drill owners.
     * @returns {object[]}
     */
    static #drillRows(ownerKind, owners) {
        return (owners || [])
            .map((owner, index) => {
                if (!PcbReviewDrillMetadataBuilder.#hasHole(owner)) {
                    return null
                }
                const ownerKey = ownerKind + '-' + index
                const holeKind = PcbReviewDrillMetadataBuilder.#holeKind(owner)
                const plating =
                    owner?.isPlated === false ? 'non-plated' : 'plated'
                const renderState =
                    PcbReviewDrillMetadataBuilder.#drillRenderState(owner)

                return PcbReviewDrillMetadataBuilder.#stripEmpty({
                    elementKey: 'pcb-' + ownerKind + '-hole-' + String(index),
                    ownerKind,
                    ownerKey,
                    holeKind,
                    plating,
                    renderState,
                    overlayKind: PcbReviewDrillMetadataBuilder.#overlayKind(
                        ownerKind,
                        holeKind,
                        plating,
                        renderState
                    ),
                    layerKeys: PcbReviewDrillMetadataBuilder.#sortedStrings([
                        PcbReviewDrillMetadataBuilder.#layerKey(owner)
                    ])
                })
            })
            .filter(Boolean)
    }

    /**
     * Builds layer draw-order rows for visual review.
     * @param {object} pcb PCB model.
     * @returns {object[]}
     */
    static #layerDrawOrder(pcb) {
        const descriptors = new Map()
        for (const layer of [
            ...(pcb.layers || []),
            ...(pcb.primitiveLayers || [])
        ]) {
            const layerId = PcbReviewDrillMetadataBuilder.#layerId(layer)
            if (!Number.isInteger(layerId) || descriptors.has(layerId)) {
                continue
            }
            descriptors.set(layerId, {
                layerKey: 'L' + layerId,
                layerId,
                displayName:
                    layer.displayName || layer.name || 'Layer ' + layerId,
                role: PcbReviewDrillMetadataBuilder.#layerRole(layer, layerId)
            })
        }

        let internalOrder = 0
        return [...descriptors.values()]
            .sort((left, right) => left.layerId - right.layerId)
            .map((layer, drawOrder) => {
                const row = { ...layer, drawOrder }
                if (layer.role === 'internal') {
                    internalOrder += 1
                    row.internalOrder = internalOrder
                }
                return row
            })
    }

    /**
     * Returns true when a drill owner has a visible hole.
     * @param {object} owner Drill owner primitive.
     * @returns {boolean}
     */
    static #hasHole(owner) {
        return Number(owner?.holeDiameter || owner?.drillDiameter || 0) > 0
    }

    /**
     * Resolves a drill owner hole kind.
     * @param {object} owner Drill owner primitive.
     * @returns {'round' | 'slot'}
     */
    static #holeKind(owner) {
        const holeShape = String(owner?.holeShape || '').toLowerCase()
        if (
            Number(owner?.holeSlotLength || owner?.slotLength || 0) > 0 ||
            holeShape.includes('slot')
        ) {
            return 'slot'
        }

        return 'round'
    }

    /**
     * Resolves drill rendering state from explicit and via-protection metadata.
     * @param {object} owner Drill owner primitive.
     * @returns {'open' | 'covered' | 'filled' | 'capped'}
     */
    static #drillRenderState(owner) {
        const explicit =
            owner?.drillRenderState ||
            owner?.renderState ||
            owner?.drill?.renderState
        if (explicit) {
            return PcbReviewDrillMetadataBuilder.#normalizeRenderState(explicit)
        }

        const featureText = (owner?.viaProtection?.features || [])
            .flatMap((feature) => [feature.type, feature.material])
            .join(' ')
            .toLowerCase()

        if (/cap/u.test(featureText)) return 'capped'
        if (/fill|plug/u.test(featureText)) return 'filled'
        if (/cover|tent|mask/u.test(featureText)) return 'covered'

        const ipcType = Number(
            owner?.ipc4761Type ?? owner?.viaProtection?.ipc4761Type
        )
        if (ipcType === 6 || ipcType === 7) return 'capped'
        if (ipcType === 3 || ipcType === 4 || ipcType === 5) return 'filled'
        if (ipcType === 1 || ipcType === 2) return 'covered'

        return 'open'
    }

    /**
     * Normalizes a render-state label.
     * @param {unknown} value Raw render-state value.
     * @returns {'open' | 'covered' | 'filled' | 'capped'}
     */
    static #normalizeRenderState(value) {
        const normalized = String(value || '').toLowerCase()
        if (/cap/u.test(normalized)) return 'capped'
        if (/fill|plug/u.test(normalized)) return 'filled'
        if (/cover|tent|mask/u.test(normalized)) return 'covered'
        return 'open'
    }

    /**
     * Resolves a deterministic overlay kind.
     * @param {'via' | 'pad'} ownerKind Drill owner kind.
     * @param {'round' | 'slot'} holeKind Hole kind.
     * @param {'plated' | 'non-plated'} plating Plating state.
     * @param {'open' | 'covered' | 'filled' | 'capped'} renderState Render state.
     * @returns {string}
     */
    static #overlayKind(ownerKind, holeKind, plating, renderState) {
        if (plating === 'non-plated') {
            return holeKind === 'slot' ? 'non-plated-slot' : 'non-plated-hole'
        }
        if (ownerKind === 'via' && ['filled', 'capped'].includes(renderState)) {
            return 'filled-or-capped-via'
        }
        if (ownerKind === 'via' && renderState === 'covered') {
            return 'covered-via'
        }
        return holeKind === 'slot' ? 'plated-slot' : 'plated-hole'
    }

    /**
     * Resolves a layer role suitable for visual draw order.
     * @param {object} layer Layer row.
     * @param {number} layerId Layer id.
     * @returns {string}
     */
    static #layerRole(layer, layerId) {
        const label = [layer?.role, layer?.kind, layer?.name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        if (label.includes('overlay') || label.includes('silk')) {
            return 'overlay'
        }
        if (layerId === 1 || layerId === 32) {
            return 'surface'
        }
        if (layerId > 1 && layerId < 32) {
            return 'internal'
        }
        if (label.includes('mechanical')) {
            return 'mechanical'
        }
        return label.includes('copper') ? 'surface' : 'other'
    }

    /**
     * Resolves a layer key from a primitive.
     * @param {object} value Primitive row.
     * @returns {string}
     */
    static #layerKey(value) {
        const layerId = PcbReviewDrillMetadataBuilder.#layerId(value)
        if (Number.isInteger(layerId)) {
            return 'L' + layerId
        }

        const layer = String(value?.layer || value?.layerName || '').trim()
        return layer ? 'L-' + PcbReviewDrillMetadataBuilder.#slug(layer) : ''
    }

    /**
     * Resolves a numeric layer id.
     * @param {object} value Primitive or layer descriptor.
     * @returns {number | undefined}
     */
    static #layerId(value) {
        for (const key of ['layerId', 'layerCode', 'id', 'index']) {
            const layerId = Number(value?.[key])
            if (Number.isInteger(layerId)) {
                return layerId
            }
        }

        return undefined
    }

    /**
     * Sorts and deduplicates strings naturally.
     * @param {string[]} values Source values.
     * @returns {string[]}
     */
    static #sortedStrings(values) {
        return [...new Set((values || []).filter(Boolean))].sort(
            (left, right) =>
                left.localeCompare(right, undefined, { numeric: true })
        )
    }

    /**
     * Converts a value to a deterministic lowercase key segment.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #slug(value) {
        return (
            String(value || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, '-')
                .replace(/^-+|-+$/gu, '') || 'item'
        )
    }

    /**
     * Removes empty fields while preserving zeros and false.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) return entryValue.length > 0
                return (
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
                )
            })
        )
    }
}
