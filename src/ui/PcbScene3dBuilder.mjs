import { PcbEdgeFacingGlyphNormalizer } from './PcbEdgeFacingGlyphNormalizer.mjs'
import { PcbFootprintPrimitiveSelector } from './PcbFootprintPrimitiveSelector.mjs'
import { PcbScene3dPackages } from './PcbScene3dPackages.mjs'

/**
 * Builds deterministic 3D scene data from the normalized PCB model.
 */
export class PcbScene3dBuilder {
    /**
     * Builds a scene description for host 3D renderers.
     * @param {{ pcb?: { boardOutline?: { widthMil?: number, heightMil?: number, minX?: number, minY?: number, segments?: Array<Record<string, number | string>> }, primitiveLayers?: { layerId: number, name: string }[], pads?: { x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[], tracks?: any[], arcs?: any[], fills?: any[], vias?: any[], polygons?: any[], embeddedModels?: any[], componentBodies?: { modelId?: string, checksum?: number | null, embedded?: boolean, name?: string, identifier?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, modelRotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number }[], components?: { designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null, source?: string, modelPath?: string }[] } }} documentModel
     * @param {{ modelRegistry?: { resolveComponentModel: (component: any) => { name: string, relativePath: string, format: string } | null, resolveComponentBodyModel?: (componentBody: any) => { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } | null } | null, boardThicknessMil?: number }} [options]
     * @returns {{ board: { widthMil: number, heightMil: number, thicknessMil: number, minX: number, minY: number, centerX: number, centerY: number, segments: Array<Record<string, number | string>> }, components: { designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, boardPositionMil: { x: number, y: number, z: number }, pattern: string, source: string, body: { family: string, sizeMil: { width: number, depth: number, height: number } }, externalModel: { name: string, relativePath: string, format: string } | null }[], externalPlacements: { designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, bodyRotationDeg: number, modelTransform: { rotationDeg: { x: number, y: number, z: number }, dzMil: number }, externalModel: { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } }[], detail: { pads: any[], tracks: any[], arcs: any[], fills: any[], vias: any[], polygons: any[], silkscreen: { top: { fills: any[], tracks: any[], arcs: any[] }, bottom: { fills: any[], tracks: any[], arcs: any[] } } } }}
     */
    static build(documentModel, options = {}) {
        const pcb = documentModel?.pcb || {}
        const boardOutline = pcb.boardOutline || {}
        const primitiveLayers = Array.isArray(pcb.primitiveLayers)
            ? pcb.primitiveLayers
            : []
        const components = Array.isArray(pcb.components) ? pcb.components : []
        const componentBodies = Array.isArray(pcb.componentBodies)
            ? pcb.componentBodies
            : []
        const pads = Array.isArray(pcb.pads) ? pcb.pads : []
        const tracks = Array.isArray(pcb.tracks) ? pcb.tracks : []
        const arcs = Array.isArray(pcb.arcs) ? pcb.arcs : []
        const fills = Array.isArray(pcb.fills) ? pcb.fills : []
        const thicknessMil = Number(options.boardThicknessMil || 63) || 63
        const modelRegistry = options.modelRegistry || null
        const board = {
            widthMil: Number(boardOutline.widthMil || 0),
            heightMil: Number(boardOutline.heightMil || 0),
            thicknessMil,
            minX: Number(boardOutline.minX || 0),
            minY: Number(boardOutline.minY || 0),
            centerX:
                Number(boardOutline.minX || 0) +
                Number(boardOutline.widthMil || 0) / 2,
            centerY:
                Number(boardOutline.minY || 0) +
                Number(boardOutline.heightMil || 0) / 2,
            segments: Array.isArray(boardOutline.segments)
                ? boardOutline.segments
                : []
        }
        const bodyMatches = PcbScene3dBuilder.#resolveComponentBodyMatches(
            componentBodies,
            components
        )

        return {
            board,
            components: components.map((component) =>
                PcbScene3dBuilder.#buildComponent(
                    component,
                    pads,
                    board,
                    thicknessMil,
                    modelRegistry
                )
            ),
            externalPlacements: componentBodies
                .map((componentBody, index) =>
                    PcbScene3dBuilder.#buildExternalPlacement(
                        componentBody,
                        bodyMatches[index],
                        board,
                        thicknessMil,
                        modelRegistry
                    )
                )
                .filter(Boolean),
            detail: {
                pads,
                tracks,
                arcs,
                fills,
                vias: Array.isArray(pcb.vias) ? pcb.vias : [],
                polygons: Array.isArray(pcb.polygons) ? pcb.polygons : [],
                silkscreen: {
                    top: PcbEdgeFacingGlyphNormalizer.normalize(
                        PcbFootprintPrimitiveSelector.select(
                            primitiveLayers,
                            fills,
                            tracks,
                            arcs,
                            'top'
                        ),
                        boardOutline
                    ),
                    bottom: PcbEdgeFacingGlyphNormalizer.normalize(
                        PcbFootprintPrimitiveSelector.select(
                            primitiveLayers,
                            fills,
                            tracks,
                            arcs,
                            'bottom'
                        ),
                        boardOutline
                    )
                }
            }
        }
    }

    /**
     * Builds one procedural component scene entry.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null, source?: string, modelPath?: string }} component
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[]} pads
     * @param {{ centerX: number, centerY: number }} board
     * @param {number} thicknessMil
     * @param {{ resolveComponentModel: (component: any) => { name: string, relativePath: string, format: string } | null } | null} modelRegistry
     * @returns {{ designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, boardPositionMil: { x: number, y: number, z: number }, pattern: string, source: string, body: { family: string, sizeMil: { width: number, depth: number, height: number } }, externalModel: { name: string, relativePath: string, format: string } | null }}
     */
    static #buildComponent(
        component,
        pads,
        board,
        thicknessMil,
        modelRegistry
    ) {
        const mountSide =
            String(component.layer || 'TOP').toUpperCase() === 'BOTTOM'
                ? 'bottom'
                : 'top'
        const padSpan = PcbScene3dBuilder.#resolvePadSpan(component, pads)
        const body = PcbScene3dPackages.resolve(component, padSpan)
        const halfBoardThickness = thicknessMil / 2
        const halfBodyHeight = body.sizeMil.height / 2
        const z =
            mountSide === 'bottom'
                ? -(halfBoardThickness + halfBodyHeight)
                : halfBoardThickness + halfBodyHeight

        return {
            designator: component.designator,
            mountSide,
            rotationDeg: Number(component.rotation || 0),
            positionMil: {
                x: Number(component.x || 0) - Number(board.centerX || 0),
                y: Number(component.y || 0) - Number(board.centerY || 0),
                z
            },
            boardPositionMil: {
                x: Number(component.x || 0),
                y: Number(component.y || 0),
                z
            },
            pattern: String(component.pattern || ''),
            source: String(component.source || ''),
            body,
            externalModel: modelRegistry
                ? modelRegistry.resolveComponentModel(component)
                : null
        }
    }

    /**
     * Builds one explicit external-model placement from normalized component
     * body metadata.
     * @param {{ modelId?: string, checksum?: number | null, embedded?: boolean, name?: string, identifier?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, modelRotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number }} componentBody
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null} matchedComponent
     * @param {{ centerX: number, centerY: number }} board
     * @param {number} thicknessMil
     * @param {{ resolveComponentBodyModel?: (componentBody: any) => { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } | null } | null} modelRegistry
     * @returns {{ designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, bodyRotationDeg: number, modelTransform: { rotationDeg: { x: number, y: number, z: number }, dzMil: number }, externalModel: { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } } | null}
     */
    static #buildExternalPlacement(
        componentBody,
        matchedComponent,
        board,
        thicknessMil,
        modelRegistry
    ) {
        const resolvedModel =
            modelRegistry?.resolveComponentBodyModel?.(componentBody) || null
        if (!resolvedModel) {
            return null
        }

        if (
            !matchedComponent &&
            !PcbScene3dBuilder.#isBodyPositionNearBoard(componentBody, board)
        ) {
            return null
        }

        const mountSide =
            String(matchedComponent?.layer || 'TOP').toUpperCase() === 'BOTTOM'
                ? 'bottom'
                : 'top'
        const halfBoardThickness = thicknessMil / 2
        const sourcePosition =
            PcbScene3dBuilder.#resolveExternalPlacementSourcePosition(
                componentBody,
                matchedComponent
            )

        return {
            designator:
                matchedComponent?.designator ||
                String(
                    componentBody.identifier || componentBody.name || '3D model'
                ),
            mountSide,
            rotationDeg: PcbScene3dBuilder.#resolveExternalPlacementRotation(
                componentBody,
                matchedComponent
            ),
            positionMil: {
                x: Number(sourcePosition.x || 0) - Number(board.centerX || 0),
                y: Number(sourcePosition.y || 0) - Number(board.centerY || 0),
                z:
                    mountSide === 'bottom'
                        ? -halfBoardThickness
                        : halfBoardThickness
            },
            bodyPositionMil: {
                x: Number(componentBody.positionMil?.x || 0),
                y: Number(componentBody.positionMil?.y || 0)
            },
            bodyRotationDeg: Number(componentBody.rotationDeg || 0),
            modelTransform: {
                rotationDeg: {
                    x: Number(componentBody.modelRotationDeg?.x || 0),
                    y: Number(componentBody.modelRotationDeg?.y || 0),
                    z: Number(componentBody.modelRotationDeg?.z || 0)
                },
                dzMil: Number(componentBody.dzMil || 0)
            },
            externalModel: resolvedModel
        }
    }

    /**
     * Resolves explicit body placements to component anchors using a unique
     * nearest-neighbor pass plus an ordered-affinity fallback for repeated
     * footprints whose body coordinates are offset from their owning
     * components.
     * @param {{ modelId?: string, name?: string, identifier?: string, positionMil?: { x?: number, y?: number } }[]} componentBodies
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components
     * @returns {({ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string } | null)[]}
     */
    static #resolveComponentBodyMatches(componentBodies, components) {
        const matches = new Array(componentBodies.length).fill(null)
        const assignedBodyIndexes = new Set()
        const assignedComponentIndexes = new Set()
        const closeCandidates = []

        componentBodies.forEach((componentBody, bodyIndex) => {
            components.forEach((component, componentIndex) => {
                const distance =
                    PcbScene3dBuilder.#distanceBetweenBodyAndComponent(
                        componentBody,
                        component
                    )

                if (distance <= 600) {
                    closeCandidates.push({
                        bodyIndex,
                        componentIndex,
                        distance
                    })
                }
            })
        })

        closeCandidates
            .sort((left, right) => left.distance - right.distance)
            .forEach(({ bodyIndex, componentIndex }) => {
                if (
                    assignedBodyIndexes.has(bodyIndex) ||
                    assignedComponentIndexes.has(componentIndex)
                ) {
                    return
                }

                matches[bodyIndex] = components[componentIndex]
                assignedBodyIndexes.add(bodyIndex)
                assignedComponentIndexes.add(componentIndex)
            })

        const groupedBodyIndexes = new Map()
        componentBodies.forEach((componentBody, bodyIndex) => {
            const groupKey =
                PcbScene3dBuilder.#resolveBodyGroupKey(componentBody)
            if (!groupedBodyIndexes.has(groupKey)) {
                groupedBodyIndexes.set(groupKey, [])
            }

            groupedBodyIndexes.get(groupKey).push(bodyIndex)
        })

        groupedBodyIndexes.forEach((bodyIndexes) => {
            const unresolvedCount = bodyIndexes.filter(
                (bodyIndex) => !matches[bodyIndex]
            ).length
            if (!unresolvedCount) {
                return
            }

            const referenceBody = componentBodies[bodyIndexes[0]]
            const candidateComponentIndexes = components
                .map((component, componentIndex) => ({
                    component,
                    componentIndex
                }))
                .filter(
                    ({ componentIndex, component }) =>
                        (matches.indexOf(components[componentIndex]) === -1 ||
                            bodyIndexes.includes(
                                matches.indexOf(components[componentIndex])
                            )) &&
                        PcbScene3dBuilder.#scoreBodyComponentAffinity(
                            referenceBody,
                            component
                        ) > 0
                )
                .map(({ componentIndex }) => componentIndex)

            const orderedPairs =
                PcbScene3dBuilder.#pairBodyGroupByOrderedAffinity(
                    bodyIndexes,
                    candidateComponentIndexes,
                    componentBodies,
                    components
                )

            if (orderedPairs.length !== bodyIndexes.length) {
                return
            }

            bodyIndexes.forEach((bodyIndex) => {
                matches[bodyIndex] = null
                assignedBodyIndexes.delete(bodyIndex)
            })

            orderedPairs.forEach(([bodyIndex, componentIndex]) => {
                matches[bodyIndex] = components[componentIndex]
                assignedBodyIndexes.add(bodyIndex)
            })
        })

        return matches
    }

    /**
     * Pairs one unresolved repeated body group with a repeated component group
     * by preserving the dominant ordering axis and choosing the pairing that
     * yields the most consistent translation offset.
     * @param {number[]} bodyIndexes
     * @param {number[]} componentIndexes
     * @param {{ positionMil?: { x?: number, y?: number } }[]} componentBodies
     * @param {{ x: number, y: number }[]} components
     * @returns {[number, number][]}
     */
    static #pairBodyGroupByOrderedAffinity(
        bodyIndexes,
        componentIndexes,
        componentBodies,
        components
    ) {
        if (
            !Array.isArray(bodyIndexes) ||
            !Array.isArray(componentIndexes) ||
            componentIndexes.length < bodyIndexes.length
        ) {
            return []
        }

        const orderingAxis = PcbScene3dBuilder.#resolveOrderingAxis(
            bodyIndexes,
            componentIndexes,
            componentBodies,
            components
        )
        const sortedBodyIndexes = [...bodyIndexes].sort(
            (leftIndex, rightIndex) =>
                Number(
                    componentBodies[leftIndex]?.positionMil?.[orderingAxis] || 0
                ) -
                Number(
                    componentBodies[rightIndex]?.positionMil?.[orderingAxis] ||
                        0
                )
        )
        const sortedComponentIndexes = [...componentIndexes].sort(
            (leftIndex, rightIndex) =>
                Number(components[leftIndex]?.[orderingAxis] || 0) -
                Number(components[rightIndex]?.[orderingAxis] || 0)
        )
        let bestOrderedComponents = []
        let bestScore = Number.POSITIVE_INFINITY

        ;[
            sortedComponentIndexes,
            [...sortedComponentIndexes].reverse()
        ].forEach((orderedComponents) => {
            for (
                let startIndex = 0;
                startIndex <=
                orderedComponents.length - sortedBodyIndexes.length;
                startIndex += 1
            ) {
                const candidateOrdering = orderedComponents.slice(
                    startIndex,
                    startIndex + sortedBodyIndexes.length
                )
                const score = PcbScene3dBuilder.#scoreOrderedPairing(
                    sortedBodyIndexes,
                    candidateOrdering,
                    componentBodies,
                    components
                )

                if (score < bestScore) {
                    bestScore = score
                    bestOrderedComponents = candidateOrdering
                }
            }
        })

        return sortedBodyIndexes.map((bodyIndex, pairIndex) => [
            bodyIndex,
            bestOrderedComponents[pairIndex]
        ])
    }

    /**
     * Scores one ordered body/component pairing by how consistent the implied
     * XY translation is across the whole group.
     * @param {number[]} bodyIndexes
     * @param {number[]} componentIndexes
     * @param {{ positionMil?: { x?: number, y?: number } }[]} componentBodies
     * @param {{ x: number, y: number }[]} components
     * @returns {number}
     */
    static #scoreOrderedPairing(
        bodyIndexes,
        componentIndexes,
        componentBodies,
        components
    ) {
        const deltas = bodyIndexes.map((bodyIndex, pairIndex) => ({
            dx:
                Number(components[componentIndexes[pairIndex]]?.x || 0) -
                Number(componentBodies[bodyIndex]?.positionMil?.x || 0),
            dy:
                Number(components[componentIndexes[pairIndex]]?.y || 0) -
                Number(componentBodies[bodyIndex]?.positionMil?.y || 0)
        }))
        const averageDx =
            deltas.reduce((sum, delta) => sum + delta.dx, 0) / deltas.length
        const averageDy =
            deltas.reduce((sum, delta) => sum + delta.dy, 0) / deltas.length

        return deltas.reduce(
            (sum, delta) =>
                sum +
                Math.abs(delta.dx - averageDx) +
                Math.abs(delta.dy - averageDy),
            0
        )
    }

    /**
     * Chooses the dominant ordering axis for one repeated model/component
     * group.
     * @param {number[]} bodyIndexes
     * @param {number[]} componentIndexes
     * @param {{ positionMil?: { x?: number, y?: number } }[]} componentBodies
     * @param {{ x: number, y: number }[]} components
     * @returns {'x' | 'y'}
     */
    static #resolveOrderingAxis(
        bodyIndexes,
        componentIndexes,
        componentBodies,
        components
    ) {
        const bodyXs = bodyIndexes.map((index) =>
            Number(componentBodies[index]?.positionMil?.x || 0)
        )
        const bodyYs = bodyIndexes.map((index) =>
            Number(componentBodies[index]?.positionMil?.y || 0)
        )
        const componentXs = componentIndexes.map((index) =>
            Number(components[index]?.x || 0)
        )
        const componentYs = componentIndexes.map((index) =>
            Number(components[index]?.y || 0)
        )
        const xSpread =
            Math.max(...bodyXs, ...componentXs) -
            Math.min(...bodyXs, ...componentXs)
        const ySpread =
            Math.max(...bodyYs, ...componentYs) -
            Math.min(...bodyYs, ...componentYs)

        return xSpread >= ySpread ? 'x' : 'y'
    }

    /**
     * Returns the component anchor that should be used for one resolved body
     * placement.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody
     * @param {{ x: number, y: number } | null} matchedComponent
     * @returns {{ x: number, y: number }}
     */
    static #resolveExternalPlacementSourcePosition(
        componentBody,
        matchedComponent
    ) {
        if (matchedComponent) {
            return {
                x: Number(matchedComponent.x || 0),
                y: Number(matchedComponent.y || 0)
            }
        }

        return {
            x: Number(componentBody?.positionMil?.x || 0),
            y: Number(componentBody?.positionMil?.y || 0)
        }
    }

    /**
     * Resolves the authored placement rotation for one explicit external
     * model, combining the matched component orientation with any additional
     * 2D model rotation offset carried by the body metadata.
     * @param {{ rotationDeg?: number }} componentBody
     * @param {{ rotation?: number } | null} matchedComponent
     * @returns {number}
     */
    static #resolveExternalPlacementRotation(componentBody, matchedComponent) {
        return PcbScene3dBuilder.#normalizeAngle(
            Number(matchedComponent?.rotation || 0) +
                Number(componentBody?.rotationDeg || 0)
        )
    }

    /**
     * Resolves a rough pad-span box around one component.
     * @param {{ x: number, y: number }} component
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[]} pads
     * @returns {{ width: number, depth: number }}
     */
    static #resolvePadSpan(component, pads) {
        const nearbyPads = pads.filter((pad) =>
            PcbScene3dBuilder.#isPadNearComponent(component, pad)
        )

        if (!nearbyPads.length) {
            return { width: 0, depth: 0 }
        }

        const xs = []
        const ys = []

        for (const pad of nearbyPads) {
            const size = PcbScene3dBuilder.#resolvePadSize(pad)
            xs.push(pad.x - size.width / 2, pad.x + size.width / 2)
            ys.push(pad.y - size.depth / 2, pad.y + size.depth / 2)
        }

        return {
            width: Math.max(...xs) - Math.min(...xs),
            depth: Math.max(...ys) - Math.min(...ys)
        }
    }

    /**
     * Returns true when one pad lies inside the component's local search area.
     * @param {{ x: number, y: number }} component
     * @param {{ x: number, y: number }} pad
     * @returns {boolean}
     */
    static #isPadNearComponent(component, pad) {
        return (
            Math.abs(Number(pad.x || 0) - Number(component.x || 0)) <= 160 &&
            Math.abs(Number(pad.y || 0) - Number(component.y || 0)) <= 160
        )
    }

    /**
     * Resolves one visible pad size.
     * @param {{ sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }} pad
     * @returns {{ width: number, depth: number }}
     */
    static #resolvePadSize(pad) {
        return {
            width:
                Number(pad.sizeTopX || pad.sizeMidX || pad.sizeBottomX || 24) ||
                24,
            depth:
                Number(pad.sizeTopY || pad.sizeMidY || pad.sizeBottomY || 24) ||
                24
        }
    }

    /**
     * Returns the euclidean distance between one body anchor and one component
     * anchor.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody
     * @param {{ x: number, y: number }} component
     * @returns {number}
     */
    static #distanceBetweenBodyAndComponent(componentBody, component) {
        return Math.hypot(
            Number(component?.x || 0) -
                Number(componentBody?.positionMil?.x || 0),
            Number(component?.y || 0) -
                Number(componentBody?.positionMil?.y || 0)
        )
    }

    /**
     * Resolves the grouping key for repeated component-body matching.
     * @param {{ modelId?: string, name?: string, identifier?: string }} componentBody
     * @returns {string}
     */
    static #resolveBodyGroupKey(componentBody) {
        return PcbScene3dBuilder.#normalizeLookupToken(
            componentBody?.modelId ||
                componentBody?.name ||
                componentBody?.identifier
        )
    }

    /**
     * Scores how strongly one component record appears to belong to one body
     * record based on shared model/footprint tokens.
     * @param {{ name?: string, identifier?: string }} componentBody
     * @param {{ pattern?: string, source?: string, modelPath?: string }} component
     * @returns {number}
     */
    static #scoreBodyComponentAffinity(componentBody, component) {
        const bodyTokens = PcbScene3dBuilder.#collectMeaningfulTokens([
            componentBody?.identifier,
            String(componentBody?.name || '').replace(/\.[^.]+$/, '')
        ])
        const componentTokens = PcbScene3dBuilder.#collectMeaningfulTokens([
            component?.pattern,
            component?.source,
            component?.modelPath
        ])
        let score = 0

        bodyTokens.forEach((token) => {
            if (componentTokens.has(token)) {
                score += token.length
            }
        })

        return score
    }

    /**
     * Collects normalized model tokens from free-form strings.
     * @param {(string | undefined)[]} values
     * @returns {Set<string>}
     */
    static #collectMeaningfulTokens(values) {
        const tokens = new Set()

        ;(Array.isArray(values) ? values : []).forEach((value) => {
            String(value || '')
                .toLowerCase()
                .split(/[^a-z0-9]+/g)
                .forEach((fragment) => {
                    ;(fragment.match(/[a-z]+|\d+/g) || []).forEach((token) => {
                        if (PcbScene3dBuilder.#isMeaningfulToken(token)) {
                            tokens.add(token)
                        }
                    })
                })
        })

        return tokens
    }

    /**
     * Returns true when one normalized token carries useful model identity.
     * @param {string} token
     * @returns {boolean}
     */
    static #isMeaningfulToken(token) {
        return (
            String(token || '').length >= 2 &&
            !new Set(['con', 'step', 'stp', 'model', 'default', 'black']).has(
                String(token || '')
            )
        )
    }

    /**
     * Returns true when one unresolved body anchor still lies close enough to
     * the board envelope to be renderable without a component match.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number }} board
     * @returns {boolean}
     */
    static #isBodyPositionNearBoard(componentBody, board) {
        const bodyX = Number(componentBody?.positionMil?.x || 0)
        const bodyY = Number(componentBody?.positionMil?.y || 0)
        const minX = Number(board?.minX || 0) - 600
        const minY = Number(board?.minY || 0) - 600
        const maxX =
            Number(board?.minX || 0) + Number(board?.widthMil || 0) + 600
        const maxY =
            Number(board?.minY || 0) + Number(board?.heightMil || 0) + 600

        return bodyX >= minX && bodyX <= maxX && bodyY >= minY && bodyY <= maxY
    }

    /**
     * Normalizes one lookup token for repeated-model grouping.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #normalizeLookupToken(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
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
