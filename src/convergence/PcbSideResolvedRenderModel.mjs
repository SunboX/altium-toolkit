// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbLayerGroups } from '../core/altium/PcbLayerGroups.mjs'
import { PcbSideResolvedRenderModel as HistoricalPcbSideResolvedRenderModel } from '../ui/PcbSideResolvedRenderModel.mjs'

/**
 * Adds side-correct fabrication detail filtering around the preserved native
 * Altium side projection.
 */
export class PcbSideResolvedRenderModel {
    /**
     * Resolves a normalized PCB model for the requested board side.
     * @param {object | null} board
     * @param {'front' | 'back' | { side?: 'front' | 'back' }} [options]
     * @returns {object | null}
     */
    static resolve(board, options = {}) {
        const side = PcbSideResolvedRenderModel.#normalizeSide(options)
        const resolved = HistoricalPcbSideResolvedRenderModel.resolve(
            board,
            options
        )
        if (!resolved?.pcb) return resolved

        const pcb = resolved.pcb
        return {
            ...resolved,
            pcb: {
                ...pcb,
                fills: PcbSideResolvedRenderModel.#filterPrimitives(
                    pcb.fills,
                    side
                ),
                tracks: PcbSideResolvedRenderModel.#filterPrimitives(
                    pcb.tracks,
                    side
                ),
                arcs: PcbSideResolvedRenderModel.#filterPrimitives(
                    pcb.arcs,
                    side
                ),
                regions: PcbSideResolvedRenderModel.#filterPrimitives(
                    pcb.regions,
                    side
                ),
                shapeBasedRegions: PcbSideResolvedRenderModel.#filterPrimitives(
                    pcb.shapeBasedRegions,
                    side
                ),
                boardRegions: PcbSideResolvedRenderModel.#filterPrimitives(
                    pcb.boardRegions,
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
        return HistoricalPcbSideResolvedRenderModel.isCopperPrimitive(primitive)
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
     * Filters one primitive collection to the requested surface.
     * @param {readonly object[] | undefined} primitives
     * @param {'front' | 'back'} side
     * @returns {object[]}
     */
    static #filterPrimitives(primitives, side) {
        return (primitives || []).filter((primitive) =>
            PcbSideResolvedRenderModel.#isPrimitiveVisibleOnSide(
                primitive,
                side
            )
        )
    }

    /**
     * Checks whether a primitive belongs to the requested surface or a shared
     * non-surface layer.
     * @param {object | null} primitive
     * @param {'front' | 'back'} side
     * @returns {boolean}
     */
    static #isPrimitiveVisibleOnSide(primitive, side) {
        const layerId = primitive?.layerId ?? primitive?.layerCode
        if (PcbLayerGroups.isCopper(layerId)) return true

        const layerSide = PcbLayerGroups.describeLayer(layerId).side
        if (layerSide === 'top') return side === 'front'
        if (layerSide === 'bottom') return side === 'back'
        return true
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
