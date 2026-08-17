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
     * @param {'front' | 'back' | { side?: 'front' | 'back', includeOppositeCopper?: boolean }} [options]
     * @returns {object | null}
     */
    static resolve(board, options = {}) {
        const side = PcbSideResolvedRenderModel.#normalizeSide(options)
        const includeOppositeCopper =
            PcbSideResolvedRenderModel.#includeOppositeCopper(options)
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
                ),
                pads: includeOppositeCopper
                    ? PcbSideResolvedRenderModel.#prepareContextPads(
                          board?.pcb?.pads,
                          side
                      )
                    : pcb.pads
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
     * @param {'front' | 'back' | { side?: 'front' | 'back', includeOppositeCopper?: boolean }} options
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
     * Checks whether the caller requested opposite-side copper context.
     * @param {'front' | 'back' | { side?: 'front' | 'back', includeOppositeCopper?: boolean }} options
     * @returns {boolean}
     */
    static #includeOppositeCopper(options) {
        return Boolean(
            options &&
            typeof options === 'object' &&
            options.includeOppositeCopper === true
        )
    }

    /**
     * Projects every copper-bearing pad into the requested composite view.
     * @param {readonly object[] | undefined} pads Source pads.
     * @param {'front' | 'back'} side Requested board side.
     * @returns {object[]}
     */
    static #prepareContextPads(pads, side) {
        return (pads || []).map((pad) =>
            PcbSideResolvedRenderModel.#projectPadForTopRenderer(pad, side)
        )
    }

    /**
     * Projects the authored aperture for one pad into the top-oriented
     * renderer while retaining front-only apertures as opposite-side context.
     * @param {object} pad Source pad.
     * @param {'front' | 'back'} side Requested board side.
     * @returns {object}
     */
    static #projectPadForTopRenderer(pad, side) {
        const layerId = PcbSideResolvedRenderModel.#effectivePadLayerId(pad)
        const apertureSide =
            layerId === 1 ? 'front' : layerId === 32 ? 'back' : side
        if (apertureSide !== 'back') return { ...pad }

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
            roundedRectShapeTop: PcbSideResolvedRenderModel.#firstFiniteValue(
                pad.roundedRectShapeBottom,
                pad.roundedRectShapeMid,
                pad.roundedRectShapeTop
            ),
            cornerRadiusTop: PcbSideResolvedRenderModel.#firstFiniteValue(
                pad.cornerRadiusBottom,
                pad.cornerRadiusMid,
                pad.cornerRadiusTop
            )
        }
    }

    /**
     * Resolves the authored Altium layer id for a pad.
     * @param {object | null} pad Pad to inspect.
     * @returns {number | null}
     */
    static #effectivePadLayerId(pad) {
        const layerId = Number(pad?.layerId)
        if (Number.isInteger(layerId) && layerId > 0) return layerId

        const legacyLayerId = Number(pad?.legacyLayerId)
        return Number.isInteger(legacyLayerId) && legacyLayerId > 0
            ? legacyLayerId
            : null
    }

    /**
     * Returns the first finite numeric value.
     * @param {...unknown} values Values to inspect.
     * @returns {number | undefined}
     */
    static #firstFiniteValue(...values) {
        for (const value of values) {
            const number = Number(value)
            if (Number.isFinite(number)) return number
        }
        return undefined
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
 * @param {'front' | 'back' | { side?: 'front' | 'back', includeOppositeCopper?: boolean }} [options]
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
