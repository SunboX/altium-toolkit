// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Recovers missing anonymous static-body polygons from complete same-model rows.
 */
export class PcbScene3dStaticBodyPrototypeRecovery {
    /**
     * Recovers repeated anonymous body rows that omit their vertex payload.
     * @param {object[] | undefined} componentBodies Component bodies.
     * @returns {object[]}
     */
    static recover(componentBodies) {
        const bodies = Array.isArray(componentBodies) ? componentBodies : []
        const prototypes =
            PcbScene3dStaticBodyPrototypeRecovery.#prototypeMap(bodies)

        if (!prototypes.size) {
            return bodies
        }

        return bodies.map((componentBody) =>
            PcbScene3dStaticBodyPrototypeRecovery.#recoverBody(
                componentBody,
                prototypes
            )
        )
    }

    /**
     * Builds reusable complete-geometry prototypes by exact model identity.
     * @param {object[]} componentBodies Component bodies.
     * @returns {Map<string, object[]>}
     */
    static #prototypeMap(componentBodies) {
        const prototypes = new Map()

        componentBodies
            .filter((componentBody) =>
                PcbScene3dStaticBodyPrototypeRecovery.#isPrototype(
                    componentBody
                )
            )
            .forEach((componentBody) => {
                const key =
                    PcbScene3dStaticBodyPrototypeRecovery.#bodyFamilyKey(
                        componentBody
                    )
                if (!key) {
                    return
                }

                if (!prototypes.has(key)) {
                    prototypes.set(key, [])
                }
                prototypes.get(key)?.push(componentBody)
            })

        return prototypes
    }

    /**
     * Recovers one missing body from the closest compatible prototype.
     * @param {object} componentBody Target body.
     * @param {Map<string, object[]>} prototypes Complete prototype rows.
     * @returns {object}
     */
    static #recoverBody(componentBody, prototypes) {
        if (
            !PcbScene3dStaticBodyPrototypeRecovery.#isRecoverableTarget(
                componentBody
            )
        ) {
            return componentBody
        }

        const key =
            PcbScene3dStaticBodyPrototypeRecovery.#bodyFamilyKey(componentBody)
        const prototype =
            PcbScene3dStaticBodyPrototypeRecovery.#nearestPrototype(
                componentBody,
                prototypes.get(key)
            )

        return prototype
            ? PcbScene3dStaticBodyPrototypeRecovery.#withPrototypeGeometry(
                  componentBody,
                  prototype
              )
            : componentBody
    }

    /**
     * Checks whether a row can provide reusable static geometry.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #isPrototype(componentBody) {
        return (
            PcbScene3dStaticBodyPrototypeRecovery.#isAnonymous(componentBody) &&
            PcbScene3dStaticBodyPrototypeRecovery.#isCompleteExtrudedPolygon(
                componentBody
            ) &&
            Boolean(
                PcbScene3dStaticBodyPrototypeRecovery.#bodyFamilyKey(
                    componentBody
                )
            )
        )
    }

    /**
     * Checks whether a row is missing renderable static polygon vertices.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #isRecoverableTarget(componentBody) {
        return (
            PcbScene3dStaticBodyPrototypeRecovery.#isAnonymous(componentBody) &&
            PcbScene3dStaticBodyPrototypeRecovery.#isExtrudedPolygonBody(
                componentBody
            ) &&
            !PcbScene3dStaticBodyPrototypeRecovery.#isCompleteExtrudedPolygon(
                componentBody
            ) &&
            PcbScene3dStaticBodyPrototypeRecovery.#hasRecoverablePosition(
                componentBody
            ) &&
            PcbScene3dStaticBodyPrototypeRecovery.#heightMil(componentBody) > 0
        )
    }

    /**
     * Checks whether the body row has no authored identity text.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #isAnonymous(componentBody) {
        return ![componentBody?.identifier, componentBody?.name]
            .map((value) => String(value || '').trim())
            .some(Boolean)
    }

    /**
     * Checks whether a body row describes an extruded polygon model.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #isExtrudedPolygonBody(componentBody) {
        return (
            PcbScene3dStaticBodyPrototypeRecovery.#geometryKind(
                componentBody
            ) === 'extruded-polygon'
        )
    }

    /**
     * Checks whether a row already has complete extruded polygon vertices.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #isCompleteExtrudedPolygon(componentBody) {
        const geometry = componentBody?.staticGeometry

        return (
            PcbScene3dStaticBodyPrototypeRecovery.#isExtrudedPolygonBody(
                componentBody
            ) &&
            String(geometry?.status || '').toLowerCase() === 'complete' &&
            Array.isArray(geometry?.verticesMil) &&
            geometry.verticesMil.length >= 3
        )
    }

    /**
     * Builds the exact model-family key used for prototype reuse.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {string}
     */
    static #bodyFamilyKey(componentBody) {
        const identity = [
            componentBody?.modelId,
            componentBody?.checksum,
            PcbScene3dStaticBodyPrototypeRecovery.#geometryKind(componentBody),
            PcbScene3dStaticBodyPrototypeRecovery.#numberKey(
                PcbScene3dStaticBodyPrototypeRecovery.#heightMil(componentBody)
            ),
            PcbScene3dStaticBodyPrototypeRecovery.#numberKey(
                PcbScene3dStaticBodyPrototypeRecovery.#standoffMil(
                    componentBody
                )
            )
        ]
            .map((value) =>
                String(value ?? '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)

        return identity.length >= 4 ? identity.join('|') : ''
    }

    /**
     * Chooses the closest layer-compatible prototype for one target row.
     * @param {object} componentBody Target body.
     * @param {object[] | undefined} candidates Candidate prototypes.
     * @returns {object | null}
     */
    static #nearestPrototype(componentBody, candidates) {
        const normalizedCandidates = Array.isArray(candidates) ? candidates : []

        return (
            normalizedCandidates
                .filter((candidate) =>
                    PcbScene3dStaticBodyPrototypeRecovery.#compatibleLayers(
                        componentBody,
                        candidate
                    )
                )
                .map((candidate) => ({
                    candidate,
                    distance:
                        PcbScene3dStaticBodyPrototypeRecovery.#distanceBetweenBodies(
                            componentBody,
                            candidate
                        )
                }))
                .sort((left, right) => left.distance - right.distance)[0]
                ?.candidate || null
        )
    }

    /**
     * Returns a cloned target row with translated prototype vertices.
     * @param {object} componentBody Target body.
     * @param {object} prototype Complete prototype body.
     * @returns {object}
     */
    static #withPrototypeGeometry(componentBody, prototype) {
        const geometry = componentBody?.staticGeometry || {}
        const prototypeGeometry = prototype?.staticGeometry || {}
        const heightMil =
            PcbScene3dStaticBodyPrototypeRecovery.#heightMil(componentBody) ||
            PcbScene3dStaticBodyPrototypeRecovery.#heightMil(prototype)
        const standoffHeightMil =
            PcbScene3dStaticBodyPrototypeRecovery.#standoffMil(componentBody) ||
            PcbScene3dStaticBodyPrototypeRecovery.#standoffMil(prototype)

        return {
            ...componentBody,
            staticGeometry: {
                ...prototypeGeometry,
                ...geometry,
                kind: 'extruded-polygon',
                status: 'complete',
                units: geometry.units || prototypeGeometry.units || 'mil',
                minZMil: Number(
                    geometry.minZMil ?? prototypeGeometry.minZMil ?? 0
                ),
                maxZMil: Number(
                    geometry.maxZMil ??
                        prototypeGeometry.maxZMil ??
                        heightMil + standoffHeightMil
                ),
                heightMil,
                standoffHeightMil,
                verticesMil:
                    PcbScene3dStaticBodyPrototypeRecovery.#prototypeVerticesForTarget(
                        componentBody,
                        prototype
                    )
            }
        }
    }

    /**
     * Translates prototype vertices into the target body's coordinate frame.
     * @param {object} componentBody Target body.
     * @param {object} prototype Complete prototype body.
     * @returns {{ x: number, y: number }[]}
     */
    static #prototypeVerticesForTarget(componentBody, prototype) {
        const vertices = Array.isArray(prototype?.staticGeometry?.verticesMil)
            ? prototype.staticGeometry.verticesMil
            : []

        if (
            !PcbScene3dStaticBodyPrototypeRecovery.#usesSourceCoordinateFrame(
                prototype,
                vertices
            )
        ) {
            return vertices.map((vertex) => ({
                x: Number(vertex?.x || 0),
                y: Number(vertex?.y || 0)
            }))
        }

        const prototypeSource =
            PcbScene3dStaticBodyPrototypeRecovery.#sourcePosition(prototype)
        const targetSource =
            PcbScene3dStaticBodyPrototypeRecovery.#sourcePosition(componentBody)

        return vertices.map((vertex) => ({
            x: targetSource.x + Number(vertex?.x || 0) - prototypeSource.x,
            y: targetSource.y + Number(vertex?.y || 0) - prototypeSource.y
        }))
    }

    /**
     * Checks whether explicit mechanical layer values are compatible.
     * @param {object | undefined} left Left body.
     * @param {object | undefined} right Right body.
     * @returns {boolean}
     */
    static #compatibleLayers(left, right) {
        const leftLayer = String(left?.layer || '')
            .trim()
            .toLowerCase()
        const rightLayer = String(right?.layer || '')
            .trim()
            .toLowerCase()

        return !leftLayer || !rightLayer || leftLayer === rightLayer
    }

    /**
     * Resolves the lower-case geometry kind for a body row.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {string}
     */
    static #geometryKind(componentBody) {
        return String(
            componentBody?.staticGeometry?.kind ||
                componentBody?.modelTypeName ||
                ''
        )
            .trim()
            .toLowerCase()
    }

    /**
     * Resolves the body extrusion height.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {number}
     */
    static #heightMil(componentBody) {
        const height = Number(
            componentBody?.staticGeometry?.heightMil ??
                componentBody?.overallHeightMil
        )

        return Number.isFinite(height) ? height : 0
    }

    /**
     * Resolves the body standoff height.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {number}
     */
    static #standoffMil(componentBody) {
        const standoff = Number(
            componentBody?.staticGeometry?.standoffHeightMil ??
                componentBody?.standoffHeightMil
        )

        return Number.isFinite(standoff) ? standoff : 0
    }

    /**
     * Checks whether the body row has a finite source anchor.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {boolean}
     */
    static #hasRecoverablePosition(componentBody) {
        const source =
            PcbScene3dStaticBodyPrototypeRecovery.#sourcePosition(componentBody)

        return Number.isFinite(source.x) && Number.isFinite(source.y)
    }

    /**
     * Resolves a body source position.
     * @param {object | undefined} componentBody Candidate body.
     * @returns {{ x: number, y: number }}
     */
    static #sourcePosition(componentBody) {
        return {
            x: Number(componentBody?.positionMil?.x),
            y: Number(componentBody?.positionMil?.y)
        }
    }

    /**
     * Measures the source-anchor distance between two body rows.
     * @param {object} left Left body.
     * @param {object} right Right body.
     * @returns {number}
     */
    static #distanceBetweenBodies(left, right) {
        const leftSource =
            PcbScene3dStaticBodyPrototypeRecovery.#sourcePosition(left)
        const rightSource =
            PcbScene3dStaticBodyPrototypeRecovery.#sourcePosition(right)

        return Math.hypot(
            leftSource.x - rightSource.x,
            leftSource.y - rightSource.y
        )
    }

    /**
     * Checks whether polygon vertices use board/source coordinates.
     * @param {object} componentBody Component body.
     * @param {{ x?: number, y?: number }[]} vertices Vertices.
     * @returns {boolean}
     */
    static #usesSourceCoordinateFrame(componentBody, vertices) {
        const source =
            PcbScene3dStaticBodyPrototypeRecovery.#sourcePosition(componentBody)
        const coordinates = (Array.isArray(vertices) ? vertices : []).flatMap(
            (vertex) => [Number(vertex?.x || 0), Number(vertex?.y || 0)]
        )

        return (
            Math.max(Math.abs(source.x), Math.abs(source.y), ...coordinates) >
            1000
        )
    }

    /**
     * Converts a number into a stable key fragment.
     * @param {number | string | undefined | null} value Candidate value.
     * @returns {string}
     */
    static #numberKey(value) {
        const number = Number(value)

        return Number.isFinite(number)
            ? String(Math.round(number * 10000) / 10000)
            : ''
    }
}
