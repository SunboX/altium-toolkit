// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Prepares normalized Altium PCB models for side-specific top-oriented renderers.
 */
export class PcbSideResolvedRenderModel {
    /**
     * Resolves a normalized PCB model for the requested board side.
     * @param {object | null} board
     * @param {'front' | 'back' | { side?: 'front' | 'back' }} [options]
     * @returns {object | null}
     */
    static resolve(board, options = {}) {
        if (!board?.pcb) return board || null

        const side = PcbSideResolvedRenderModel.#normalizeSide(options)
        const pcb = board.pcb
        return {
            ...board,
            pcb: {
                ...pcb,
                components: (pcb.components || []).filter((component) =>
                    PcbSideResolvedRenderModel.#isComponentVisibleOnSide(
                        component,
                        side
                    )
                ),
                primitiveLayers:
                    PcbSideResolvedRenderModel.#preparePrimitiveLayersForSide(
                        pcb.primitiveLayers || [],
                        side
                    ),
                polygons: PcbSideResolvedRenderModel.#preparePolygonsForSide(
                    pcb.polygons || [],
                    side
                ),
                fills: PcbSideResolvedRenderModel.#preparePrimitivesForSide(
                    pcb.fills || [],
                    side
                ),
                tracks: PcbSideResolvedRenderModel.#preparePrimitivesForSide(
                    pcb.tracks || [],
                    side
                ),
                arcs: PcbSideResolvedRenderModel.#preparePrimitivesForSide(
                    pcb.arcs || [],
                    side
                ),
                regions: PcbSideResolvedRenderModel.#preparePrimitivesForSide(
                    pcb.regions || [],
                    side
                ),
                shapeBasedRegions:
                    PcbSideResolvedRenderModel.#preparePrimitivesForSide(
                        pcb.shapeBasedRegions || [],
                        side
                    ),
                boardRegions:
                    PcbSideResolvedRenderModel.#preparePrimitivesForSide(
                        pcb.boardRegions || [],
                        side
                    ),
                vias: PcbSideResolvedRenderModel.#prepareViasForSide(
                    pcb.vias || [],
                    side
                ),
                pads: PcbSideResolvedRenderModel.#preparePadsForSide(
                    pcb.pads || [],
                    side
                )
            }
        }
    }

    /**
     * Checks whether a primitive belongs to an Altium copper signal layer.
     * @param {object | null} primitive
     * @returns {boolean}
     */
    static isCopperPrimitive(primitive) {
        const layerId = Number(primitive?.layerId)
        return Number.isInteger(layerId) && layerId >= 1 && layerId <= 32
    }

    /**
     * Normalizes the caller side option.
     * @param {'front' | 'back' | { side?: 'front' | 'back' }} options
     * @returns {'front' | 'back'}
     */
    static #normalizeSide(options) {
        if (options === 'back') return 'back'
        if (options && typeof options === 'object' && options.side === 'back') {
            return 'back'
        }
        return 'front'
    }

    /**
     * Checks whether a component should be visible for a requested side.
     * @param {object | null} component
     * @param {'front' | 'back'} side
     * @returns {boolean}
     */
    static #isComponentVisibleOnSide(component, side) {
        const layer = String(component?.layer || '')
            .trim()
            .toLowerCase()
        const isBottom = layer.includes('bottom') || layer === 'bot'
        return side === 'back' ? isBottom : !isBottom
    }

    /**
     * Projects primitive layer names for a top-oriented renderer.
     * @param {readonly object[]} primitiveLayers
     * @param {'front' | 'back'} side
     * @returns {object[]}
     */
    static #preparePrimitiveLayersForSide(primitiveLayers, side) {
        if (side !== 'back') return Array.from(primitiveLayers)

        return primitiveLayers.map((layer) => ({
            ...layer,
            name: PcbSideResolvedRenderModel.#backLayerNameForTopRenderer(
                layer.name
            )
        }))
    }

    /**
     * Converts top/bottom layer labels for back-side top-oriented rendering.
     * @param {unknown} name
     * @returns {string}
     */
    static #backLayerNameForTopRenderer(name) {
        const value = String(name || '')
        if (/\bbottom\b/iu.test(value)) {
            return value.replace(/\bbottom\b/giu, 'Top')
        }
        if (/\btop\b/iu.test(value)) {
            return value.replace(/\btop\b/giu, 'Hidden')
        }
        return value
    }

    /**
     * Projects polygon side labels for a top-oriented renderer.
     * @param {readonly object[]} polygons
     * @param {'front' | 'back'} side
     * @returns {object[]}
     */
    static #preparePolygonsForSide(polygons, side) {
        if (side !== 'back') return Array.from(polygons)

        return polygons.map((polygon) => {
            const layer = String(polygon?.layer || '')
                .trim()
                .toUpperCase()
            if (layer === 'BOTTOM' || layer === 'BOT') {
                return { ...polygon, layer: 'TOP' }
            }
            if (layer === 'TOP') {
                return { ...polygon, layer: 'HIDDEN' }
            }
            return { ...polygon }
        })
    }

    /**
     * Projects primitive layer codes for a top-oriented renderer.
     * @param {readonly object[]} primitives
     * @param {'front' | 'back'} side
     * @returns {object[]}
     */
    static #preparePrimitivesForSide(primitives, side) {
        if (side !== 'back') return Array.from(primitives)

        return primitives.map((primitive) => {
            if (!PcbSideResolvedRenderModel.isCopperPrimitive(primitive)) {
                return { ...primitive }
            }

            const layerCode = Number(primitive.layerCode)
            const fallbackCode = Number(primitive.layerId)
            return {
                ...primitive,
                layerCode: -(Number.isFinite(layerCode)
                    ? layerCode
                    : fallbackCode || 0)
            }
        })
    }

    /**
     * Filters vias to those visible from the requested side.
     * @param {readonly object[]} vias
     * @param {'front' | 'back'} side
     * @returns {object[]}
     */
    static #prepareViasForSide(vias, side) {
        return vias
            .filter((via) =>
                PcbSideResolvedRenderModel.#isViaVisibleOnSide(via, side)
            )
            .map((via) => ({ ...via }))
    }

    /**
     * Checks whether a via spans the requested surface layer.
     * @param {object | null} via
     * @param {'front' | 'back'} side
     * @returns {boolean}
     */
    static #isViaVisibleOnSide(via, side) {
        const start = Number(via?.layerStartId)
        const end = Number(via?.layerEndId)
        if (!Number.isInteger(start) || !Number.isInteger(end)) return true

        const surfaceLayerId = side === 'back' ? 32 : 1
        return (
            surfaceLayerId >= Math.min(start, end) &&
            surfaceLayerId <= Math.max(start, end)
        )
    }

    /**
     * Filters and projects pads to the requested side.
     * @param {readonly object[]} pads
     * @param {'front' | 'back'} side
     * @returns {object[]}
     */
    static #preparePadsForSide(pads, side) {
        const visiblePads = pads.filter((pad) =>
            PcbSideResolvedRenderModel.#isPadVisibleOnSide(pad, side)
        )
        if (side !== 'back') return visiblePads.map((pad) => ({ ...pad }))

        return visiblePads.map((pad) => {
            const layerId = PcbSideResolvedRenderModel.#effectivePadLayerId(pad)
            return {
                ...pad,
                sizeTopX: PcbSideResolvedRenderModel.#firstFiniteValue(
                    pad.sizeBottomX,
                    pad.sizeMidX,
                    pad.sizeTopX
                ),
                sizeTopY: PcbSideResolvedRenderModel.#firstFiniteValue(
                    pad.sizeBottomY,
                    pad.sizeMidY,
                    pad.sizeTopY
                ),
                shapeTop: PcbSideResolvedRenderModel.#firstFiniteValue(
                    pad.shapeBottom,
                    pad.shapeMid,
                    pad.shapeTop
                ),
                roundedRectShapeTop:
                    PcbSideResolvedRenderModel.#firstFiniteValue(
                        pad.roundedRectShapeBottom,
                        pad.roundedRectShapeMid,
                        pad.roundedRectShapeTop
                    ),
                cornerRadiusTop: PcbSideResolvedRenderModel.#firstFiniteValue(
                    pad.cornerRadiusBottom,
                    pad.cornerRadiusMid,
                    pad.cornerRadiusTop
                ),
                layerCode: layerId === 32 ? 1 : pad.layerCode,
                layerId: layerId === 32 ? 1 : pad.layerId
            }
        })
    }

    /**
     * Checks whether a pad should be visible on the requested side.
     * @param {object | null} pad
     * @param {'front' | 'back'} side
     * @returns {boolean}
     */
    static #isPadVisibleOnSide(pad, side) {
        const layerId = PcbSideResolvedRenderModel.#effectivePadLayerId(pad)
        if (layerId === 1) return side === 'front'
        if (layerId === 32) return side === 'back'
        return true
    }

    /**
     * Resolves the authored Altium layer id for a pad.
     * @param {object | null} pad
     * @returns {number | null}
     */
    static #effectivePadLayerId(pad) {
        const layerId = Number(pad?.layerId)
        if (Number.isInteger(layerId) && layerId > 0) return layerId

        const legacyLayerId = Number(pad?.legacyLayerId)
        if (Number.isInteger(legacyLayerId) && legacyLayerId > 0) {
            return legacyLayerId
        }

        return null
    }

    /**
     * Returns the first finite numeric value.
     * @param {...unknown} values
     * @returns {number | undefined}
     */
    static #firstFiniteValue(...values) {
        for (const value of values) {
            const number = Number(value)
            if (Number.isFinite(number)) return number
        }
        return undefined
    }
}

/**
 * Resolves a normalized PCB model for the requested board side.
 * @param {object | null} board
 * @param {'front' | 'back' | { side?: 'front' | 'back' }} [options]
 * @returns {object | null}
 */
export function preparePcbSideResolvedRenderModel(board, options = {}) {
    return PcbSideResolvedRenderModel.resolve(board, options)
}

/**
 * Checks whether a primitive belongs to an Altium copper signal layer.
 * @param {object | null} primitive
 * @returns {boolean}
 */
export function isCopperPrimitive(primitive) {
    return PcbSideResolvedRenderModel.isCopperPrimitive(primitive)
}
