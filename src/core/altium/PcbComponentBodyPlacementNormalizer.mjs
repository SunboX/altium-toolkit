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

        return componentBodies.map((componentBody) => {
            const normalizedBody = {
                ...componentBody,
                positionMil: {
                    x: Number(componentBody.positionMil?.x || 0),
                    y: mirrorY(componentBody.positionMil?.y || 0)
                },
                rotationDeg:
                    PcbComponentBodyPlacementNormalizer.#normalizeAngle(
                        360 - Number(componentBody.rotationDeg || 0)
                    ),
                modelRotationDeg: {
                    x: Number(componentBody.modelRotationDeg?.x || 0),
                    y: Number(componentBody.modelRotationDeg?.y || 0),
                    z: PcbComponentBodyPlacementNormalizer.#normalizeAngle(
                        360 - Number(componentBody.modelRotationDeg?.z || 0)
                    )
                }
            }
            const staticGeometry =
                PcbComponentBodyPlacementNormalizer.#normalizeStaticGeometry(
                    componentBody,
                    mirrorY
                )

            return staticGeometry
                ? {
                      ...normalizedBody,
                      staticGeometry
                  }
                : normalizedBody
        })
    }

    /**
     * Mirrors source-coordinate static geometry into the viewer coordinate
     * system.
     * @param {{ positionMil?: { x?: number, y?: number }, staticGeometry?: object }} componentBody Component body.
     * @param {(value: number | string | undefined) => number} mirrorY Source Y mirror.
     * @returns {object | undefined}
     */
    static #normalizeStaticGeometry(componentBody, mirrorY) {
        const staticGeometry = componentBody?.staticGeometry
        if (!staticGeometry || typeof staticGeometry !== 'object') {
            return staticGeometry
        }

        const vertices = Array.isArray(staticGeometry.verticesMil)
            ? staticGeometry.verticesMil
            : []
        if (
            !PcbComponentBodyPlacementNormalizer.#shouldMirrorStaticVertices(
                componentBody,
                vertices
            )
        ) {
            return staticGeometry
        }

        return {
            ...staticGeometry,
            verticesMil: vertices.map((vertex) => ({
                ...vertex,
                x: Number(vertex?.x || 0),
                y: mirrorY(vertex?.y || 0)
            }))
        }
    }

    /**
     * Checks whether polygon vertices share the body source-coordinate frame.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component body.
     * @param {{ x?: number, y?: number }[]} vertices Static polygon vertices.
     * @returns {boolean}
     */
    static #shouldMirrorStaticVertices(componentBody, vertices) {
        if (vertices.length < 3) {
            return false
        }

        const center =
            PcbComponentBodyPlacementNormalizer.#polygonBoundsCenter(vertices)
        const source = {
            x: Number(componentBody?.positionMil?.x || 0),
            y: Number(componentBody?.positionMil?.y || 0)
        }

        return (
            PcbComponentBodyPlacementNormalizer.#distance(center, source) <= 5
        )
    }

    /**
     * Resolves an axis-aligned polygon bounds center.
     * @param {{ x?: number, y?: number }[]} vertices Static polygon vertices.
     * @returns {{ x: number, y: number }}
     */
    static #polygonBoundsCenter(vertices) {
        const points = vertices.map((vertex) => ({
            x: Number(vertex?.x || 0),
            y: Number(vertex?.y || 0)
        }))
        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)

        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        }
    }

    /**
     * Measures XY distance between two points.
     * @param {{ x?: number, y?: number }} first First point.
     * @param {{ x?: number, y?: number }} second Second point.
     * @returns {number}
     */
    static #distance(first, second) {
        return Math.hypot(
            Number(first?.x || 0) - Number(second?.x || 0),
            Number(first?.y || 0) - Number(second?.y || 0)
        )
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
