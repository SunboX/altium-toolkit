// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Normalizes embedded component-body placements into viewer coordinates.
 */
export class PcbComponentBodyPlacementNormalizer {
    /**
     * Flips embedded component-body placements into the viewer coordinate
     * system.
     * @param {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null }[]} componentBodies
     * @param {{ minY: number, heightMil: number }} boardOutline
     * @returns {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null }[]}
     */
    static normalizeComponentBodies(componentBodies, boardOutline) {
        const maxY =
            Number(boardOutline?.minY || 0) +
            Number(boardOutline?.heightMil || 0)
        const mirrorY = (value) =>
            Number(boardOutline?.minY || 0) + maxY - Number(value || 0)

        return componentBodies.map((componentBody) => ({
            ...componentBody,
            positionMil: {
                x: Number(componentBody.positionMil?.x || 0),
                y: mirrorY(componentBody.positionMil?.y || 0)
            },
            rotationDeg: PcbComponentBodyPlacementNormalizer.#normalizeAngle(
                360 - Number(componentBody.rotationDeg || 0)
            ),
            modelRotationDeg: {
                x: Number(componentBody.modelRotationDeg?.x || 0),
                y: Number(componentBody.modelRotationDeg?.y || 0),
                z: PcbComponentBodyPlacementNormalizer.#normalizeAngle(
                    360 - Number(componentBody.modelRotationDeg?.z || 0)
                )
            }
        }))
    }

    /**
     * Normalizes one angle into the range [0, 360).
     * @param {number} angle
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }
}
