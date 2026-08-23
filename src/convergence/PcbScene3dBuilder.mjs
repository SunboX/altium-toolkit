// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dBuilder as HistoricalPcbScene3dBuilder } from '../ui/PcbScene3dBuilder.mjs'
import { AltiumScene3dGeometricOwnerRecovery } from '../ui/AltiumScene3dGeometricOwnerRecovery.mjs'

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
        const scene = AltiumScene3dGeometricOwnerRecovery.apply(
            HistoricalPcbScene3dBuilder.build(documentModel, options),
            documentModel
        )
        if (!Array.isArray(scene?.externalPlacements)) {
            return scene
        }

        return {
            ...scene,
            externalPlacements: scene.externalPlacements.map((placement) =>
                PcbScene3dBuilder.#normalizePlacement(
                    placement,
                    documentModel?.pcb?.componentBodies,
                    documentModel?.pcb?.components
                )
            )
        }
    }

    /**
     * Preserves one bottom placement half-turn when its source geometry is
     * predominantly below the authored origin.
     * @param {object} placement Built external placement.
     * @param {object[] | undefined} componentBodies Source component bodies.
     * @param {object[] | undefined} components Source PCB components.
     * @returns {object}
     */
    static #normalizePlacement(placement, componentBodies, components) {
        const componentBody = PcbScene3dBuilder.#resolveComponentBody(
            placement,
            componentBodies
        )
        const normalizedPlacement =
            PcbScene3dBuilder.#normalizeRecoveredOwnerVerticalOffset(
                placement,
                componentBody,
                components
            )

        if (
            String(normalizedPlacement?.mountSide || '').toLowerCase() !==
                'bottom' ||
            !PcbScene3dBuilder.#isDominantlyNegativeSourceZ(
                normalizedPlacement?.externalModel?.sourceBoundsMil
            )
        ) {
            return normalizedPlacement
        }

        if (
            PcbScene3dBuilder.#normalizeAngle(
                componentBody?.modelRotationDeg?.x ??
                    normalizedPlacement?.externalModel?.transform?.rotationDeg
                        ?.x
            ) !== 180
        ) {
            return normalizedPlacement
        }

        return {
            ...normalizedPlacement,
            modelTransform: {
                ...(normalizedPlacement.modelTransform || {}),
                rotationDeg: {
                    ...(normalizedPlacement.modelTransform?.rotationDeg || {}),
                    x: -180
                }
            }
        }
    }

    /**
     * Applies owned-package seating after a later adapter recovered the owner.
     * @param {object} placement Built external placement.
     * @param {object | null} componentBody Resolved source component body.
     * @param {object[] | undefined} components Source PCB components.
     * @returns {object}
     */
    static #normalizeRecoveredOwnerVerticalOffset(
        placement,
        componentBody,
        components
    ) {
        if (
            !PcbScene3dBuilder.#hasResolvedOwner(placement, components) ||
            !PcbScene3dBuilder.#hasZeroAuthoredStandoff(componentBody) ||
            !PcbScene3dBuilder.#retainsPositiveSourceOffset(
                placement,
                componentBody
            )
        ) {
            return placement
        }

        return {
            ...placement,
            modelTransform: {
                ...(placement.modelTransform || {}),
                dzMil: 0
            }
        }
    }

    /**
     * Checks whether the final placement designator resolves a source owner.
     * @param {object} placement Built external placement.
     * @param {object[] | undefined} components Source PCB components.
     * @returns {boolean}
     */
    static #hasResolvedOwner(placement, components) {
        const designator = String(placement?.designator || '')
        return (
            designator.length > 0 &&
            (Array.isArray(components) ? components : []).some(
                (component) =>
                    String(component?.designator || '') === designator
            )
        )
    }

    /**
     * Checks whether the source explicitly authors zero model standoff.
     * @param {object | null} componentBody Resolved source component body.
     * @returns {boolean}
     */
    static #hasZeroAuthoredStandoff(componentBody) {
        const sourceStandoff = componentBody?.standoffHeightMil
        if (
            sourceStandoff === null ||
            sourceStandoff === undefined ||
            sourceStandoff === ''
        ) {
            return false
        }

        const standoff = Number(sourceStandoff)
        return (
            Number.isFinite(standoff) &&
            Math.abs(standoff) <= POSITION_EPSILON_MIL
        )
    }

    /**
     * Checks whether the final placement still carries the positive source Z.
     * @param {object} placement Built external placement.
     * @param {object | null} componentBody Resolved source component body.
     * @returns {boolean}
     */
    static #retainsPositiveSourceOffset(placement, componentBody) {
        const sourceOffset = Number(componentBody?.dzMil)
        const placementOffset = Number(placement?.modelTransform?.dzMil)

        return (
            Number.isFinite(sourceOffset) &&
            sourceOffset > 0 &&
            Number.isFinite(placementOffset) &&
            Math.abs(placementOffset - sourceOffset) <= POSITION_EPSILON_MIL
        )
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
