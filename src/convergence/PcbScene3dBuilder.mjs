// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dBuilder as HistoricalPcbScene3dBuilder } from '../ui/PcbScene3dBuilder.mjs'

const NEGATIVE_SOURCE_Z_DOMINANCE_RATIO = 0.8
const POSITION_EPSILON_MIL = 1e-6

/**
 * Adds signed-source model orientation correction around the preserved native
 * scene builder.
 */
export class PcbScene3dBuilder {
    /**
     * Builds a scene and preserves structurally negative-Z source half-turns.
     * @param {object} documentModel Parsed Altium document model.
     * @param {object} [options] Native scene-builder options.
     * @returns {object}
     */
    static build(documentModel, options = {}) {
        const scene = HistoricalPcbScene3dBuilder.build(documentModel, options)
        if (!Array.isArray(scene?.externalPlacements)) {
            return scene
        }

        return {
            ...scene,
            externalPlacements: scene.externalPlacements.map((placement) =>
                PcbScene3dBuilder.#normalizePlacement(
                    placement,
                    documentModel?.pcb?.componentBodies
                )
            )
        }
    }

    /**
     * Preserves one bottom placement half-turn when its source geometry is
     * predominantly below the authored origin.
     * @param {object} placement Built external placement.
     * @param {object[] | undefined} componentBodies Source component bodies.
     * @returns {object}
     */
    static #normalizePlacement(placement, componentBodies) {
        if (
            String(placement?.mountSide || '').toLowerCase() !== 'bottom' ||
            !PcbScene3dBuilder.#isDominantlyNegativeSourceZ(
                placement?.externalModel?.sourceBoundsMil
            )
        ) {
            return placement
        }

        const componentBody = PcbScene3dBuilder.#resolveComponentBody(
            placement,
            componentBodies
        )
        if (
            PcbScene3dBuilder.#normalizeAngle(
                componentBody?.modelRotationDeg?.x ??
                    placement?.externalModel?.transform?.rotationDeg?.x
            ) !== 180
        ) {
            return placement
        }

        return {
            ...placement,
            modelTransform: {
                ...(placement.modelTransform || {}),
                rotationDeg: {
                    ...(placement.modelTransform?.rotationDeg || {}),
                    x: -180
                }
            }
        }
    }

    /**
     * Resolves the source body associated with one built placement.
     * @param {object} placement Built external placement.
     * @param {object[] | undefined} componentBodies Source component bodies.
     * @returns {object | null}
     */
    static #resolveComponentBody(placement, componentBodies) {
        const bodyPosition = placement?.bodyPositionMil || {}
        const modelName = String(placement?.externalModel?.name || '')

        return (
            (Array.isArray(componentBodies) ? componentBodies : []).find(
                (componentBody) =>
                    String(componentBody?.name || '') === modelName &&
                    PcbScene3dBuilder.#positionsMatch(
                        componentBody?.positionMil,
                        bodyPosition
                    )
            ) || null
        )
    }

    /**
     * Checks whether two model positions represent the same authored anchor.
     * @param {{ x?: number, y?: number } | undefined} left Left position.
     * @param {{ x?: number, y?: number } | undefined} right Right position.
     * @returns {boolean}
     */
    static #positionsMatch(left, right) {
        return (
            Math.abs(Number(left?.x) - Number(right?.x)) <=
                POSITION_EPSILON_MIL &&
            Math.abs(Number(left?.y) - Number(right?.y)) <= POSITION_EPSILON_MIL
        )
    }

    /**
     * Checks whether at least four fifths of the source Z span lies below the
     * authored origin.
     * @param {{ minZ?: number, maxZ?: number } | null | undefined} sourceBoundsMil Signed source-model bounds.
     * @returns {boolean}
     */
    static #isDominantlyNegativeSourceZ(sourceBoundsMil) {
        const minZ = Number(sourceBoundsMil?.minZ)
        const maxZ = Number(sourceBoundsMil?.maxZ)
        if (!Number.isFinite(minZ) || !Number.isFinite(maxZ) || maxZ <= minZ) {
            return false
        }

        const negativeSpan = Math.max(0, Math.min(0, maxZ) - minZ)
        return negativeSpan / (maxZ - minZ) >= NEGATIVE_SOURCE_Z_DOMINANCE_RATIO
    }

    /**
     * Normalizes one angle into the positive 0-359 degree range.
     * @param {unknown} angle Source angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const numericAngle = Number(angle || 0)
        const normalized = numericAngle % 360

        return normalized < 0 ? normalized + 360 : normalized
    }
}
