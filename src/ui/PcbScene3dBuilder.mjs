// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbEdgeFacingGlyphNormalizer } from './PcbEdgeFacingGlyphNormalizer.mjs'
import { PcbScene3dBoardOutlineRefiner } from './PcbScene3dBoardOutlineRefiner.mjs'
import { PcbScene3dDrillCutoutBuilder } from './PcbScene3dDrillCutoutBuilder.mjs'
import { PcbFootprintPrimitiveSelector } from './PcbFootprintPrimitiveSelector.mjs'
import { PcbScene3dPackages } from './PcbScene3dPackages.mjs'
import { PcbScene3dPlacementSideResolver } from './PcbScene3dPlacementSideResolver.mjs'
import { PcbScene3dTextBoxLayoutResolver } from './PcbScene3dTextBoxLayoutResolver.mjs'

/**
 * Builds deterministic 3D scene data from the normalized PCB model.
 */
export class PcbScene3dBuilder {
    static #DENSE_OVERLAY_FILL_COLOR = 0xf8f6ef
    static #DENSE_OVERLAY_MIN_REGION_AREA_RATIO = 0.2
    static #DENSE_OVERLAY_MIN_TRACK_COUNT = 250
    static #DENSE_OVERLAY_KNOCKOUT_COLOR = 0x2f6a2c
    static #PRECISE_BODY_MATCH_TOLERANCE_MIL = 20
    static #UNMATCHED_BODY_OVERHANG_RATIO = 0.25
    static #UNMATCHED_BODY_MIN_OVERHANG_MIL = 150
    static #UNMATCHED_BODY_MAX_OVERHANG_MIL = 600
    static #TRUETYPE_TEXT_WIDTH_RATIO = 0.55

    /**
     * Builds a scene description for host 3D renderers.
     * @param {{ pcb?: { boardOutline?: { widthMil?: number, heightMil?: number, minX?: number, minY?: number, segments?: Array<Record<string, number | string>> }, primitiveLayers?: { layerId: number, name: string }[], pads?: { x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[], tracks?: any[], arcs?: any[], fills?: any[], vias?: any[], polygons?: any[], embeddedModels?: any[], componentBodies?: { modelId?: string, checksum?: number | null, embedded?: boolean, name?: string, identifier?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, modelRotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number }[], components?: { designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null, source?: string, modelPath?: string }[] } }} documentModel
     * @param {{ modelRegistry?: { resolveComponentModel: (component: any) => { name: string, relativePath: string, format: string } | null, resolveComponentBodyModel?: (componentBody: any) => { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } | null, resolveBoardAssemblyModel?: (documentModel: any) => { origin: string, name: string, format: string, file?: File | Blob | null, relativePath?: string } | null } | null, boardThicknessMil?: number }} [options]
     * @returns {{ board: { widthMil: number, heightMil: number, thicknessMil: number, minX: number, minY: number, centerX: number, centerY: number, segments: Array<Record<string, number | string>> }, boardAssemblyModel: { origin: string, name: string, format: string, file?: File | Blob | null, relativePath?: string } | null, components: { designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, boardPositionMil: { x: number, y: number, z: number }, pattern: string, source: string, body: { family: string, sizeMil: { width: number, depth: number, height: number } }, externalModel: { name: string, relativePath: string, format: string } | null }[], externalPlacements: { designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, bodyRotationDeg: number, modelTransform: { rotationDeg: { x: number, y: number, z: number }, dzMil: number }, externalModel: { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } }[], detail: { pads: any[], tracks: any[], arcs: any[], fills: any[], vias: any[], polygons: any[], silkscreen: { top: { fills: any[], tracks: any[], arcs: any[], texts: any[], fillColor?: number, strokeColor?: number }, bottom: { fills: any[], tracks: any[], arcs: any[], texts: any[], fillColor?: number, strokeColor?: number } } } }}
     */
    static build(documentModel, options = {}) {
        const pcb = documentModel?.pcb || {}
        const appearance3d = pcb.appearance3d || {}
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
        const texts = Array.isArray(pcb.texts) ? pcb.texts : []
        const vias = Array.isArray(pcb.vias) ? pcb.vias : []
        const silkscreenRegions =
            PcbScene3dBuilder.#resolveSilkscreenRegions(pcb)
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
            surfaceColor: Number.isInteger(appearance3d.solderMaskTopColor)
                ? appearance3d.solderMaskTopColor
                : appearance3d.solderMaskBottomColor,
            edgeColor: appearance3d.boardCoreColor,
            segments: Array.isArray(boardOutline.segments)
                ? boardOutline.segments
                : []
        }
        const bodyMatches = PcbScene3dBuilder.#resolveComponentBodyMatches(
            componentBodies,
            components
        )
        const topSilkscreen = PcbScene3dBuilder.#buildSilkscreenSide(
            primitiveLayers,
            fills,
            tracks,
            arcs,
            texts,
            silkscreenRegions,
            boardOutline,
            'top',
            pads,
            vias
        )
        const bottomSilkscreen = PcbScene3dBuilder.#buildSilkscreenSide(
            primitiveLayers,
            fills,
            tracks,
            arcs,
            texts,
            silkscreenRegions,
            boardOutline,
            'bottom',
            pads,
            vias
        )

        PcbScene3dBuilder.#applySilkscreenAppearance(
            topSilkscreen,
            bottomSilkscreen,
            board,
            appearance3d
        )

        const sceneDescription = {
            sourceFormat: 'altium',
            board,
            boardAssemblyModel:
                modelRegistry?.resolveBoardAssemblyModel?.(documentModel) ||
                null,
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
                        components,
                        pads,
                        board,
                        thicknessMil,
                        modelRegistry
                    )
                )
                .filter(Boolean),
            detail: {
                embeddedFonts: Array.isArray(pcb.embeddedFonts)
                    ? pcb.embeddedFonts
                    : [],
                pads,
                tracks,
                arcs,
                fills,
                vias,
                polygons: Array.isArray(pcb.polygons) ? pcb.polygons : [],
                silkscreen: {
                    top: topSilkscreen,
                    bottom: bottomSilkscreen
                }
            }
        }

        return PcbScene3dBoardOutlineRefiner.refine(
            sceneDescription,
            documentModel
        )
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
     * @param {{ modelId?: string, checksum?: number | null, embedded?: boolean, name?: string, identifier?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, modelRotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number }} componentBody
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null} matchedComponent
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[]} pads
     * @param {{ centerX: number, centerY: number }} board
     * @param {number} thicknessMil
     * @param {{ resolveComponentBodyModel?: (componentBody: any) => { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } | null } | null} modelRegistry
     * @returns {{ designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, bodyRotationDeg: number, modelTransform: { rotationDeg: { x: number, y: number, z: number }, dzMil: number }, externalModel: { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } } | null}
     */
    static #buildExternalPlacement(
        componentBody,
        matchedComponent,
        components,
        pads,
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

        const mountSide = PcbScene3dPlacementSideResolver.resolvePlacementSide(
            componentBody,
            matchedComponent,
            components
        )
        const halfBoardThickness = thicknessMil / 2
        const sourcePosition =
            PcbScene3dBuilder.#resolveExternalPlacementSourcePosition(
                componentBody
            )
        const modelRotation =
            PcbScene3dBuilder.#resolveExternalModelRotation(componentBody)

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
                rotationDeg: modelRotation,
                dzMil: Number(componentBody.dzMil || 0)
            },
            projection: PcbScene3dBuilder.#resolveProjectionDiagnostics(
                componentBody,
                matchedComponent,
                pads,
                resolvedModel
            ),
            externalModel: resolvedModel
        }
    }

    /**
     * Explains which footprint projection source informed one external model.
     * @param {object} componentBody Normalized component body row.
     * @param {{ x: number, y: number, height?: number | null } | null} matchedComponent Matched component.
     * @param {object[]} pads Normalized pad rows.
     * @param {object | null} resolvedModel Resolved model metadata.
     * @returns {{ source: string, reason: string, boundsMil: { width: number, depth: number, height: number } }}
     */
    static #resolveProjectionDiagnostics(
        componentBody,
        matchedComponent,
        pads,
        resolvedModel
    ) {
        const authoredBounds = PcbScene3dBuilder.#firstBounds([
            componentBody?.projectionOverrideMil,
            componentBody?.projectionOverride?.boundsMil,
            componentBody?.projectionBoundsMil
        ])
        if (authoredBounds) {
            return {
                source: 'authored-override',
                reason: 'Component body carried an explicit projection override.',
                boundsMil: authoredBounds
            }
        }

        const modelBounds = PcbScene3dBuilder.#firstBounds([
            componentBody?.modelBoundsMil,
            resolvedModel?.boundsMil
        ])
        if (modelBounds) {
            return {
                source: 'model-bounds',
                reason: 'Resolved 3D model bounds were available.',
                boundsMil: modelBounds
            }
        }

        if (matchedComponent) {
            const padSpan = PcbScene3dBuilder.#resolvePadSpan(
                matchedComponent,
                pads
            )
            if (padSpan.width > 0 || padSpan.depth > 0) {
                return {
                    source: 'pad-fallback',
                    reason: 'Projection fell back to nearby component pad span.',
                    boundsMil: {
                        width: padSpan.width,
                        depth: padSpan.depth,
                        height: Number(matchedComponent.height || 0)
                    }
                }
            }

            const body = PcbScene3dPackages.resolve(matchedComponent, padSpan)
            return {
                source: 'component-fallback',
                reason: 'Projection fell back to the procedural component body.',
                boundsMil: {
                    width: body.sizeMil.width,
                    depth: body.sizeMil.depth,
                    height: body.sizeMil.height
                }
            }
        }

        return {
            source: 'model-anchor-fallback',
            reason: 'Projection used the model anchor because no owner geometry was available.',
            boundsMil: { width: 0, depth: 0, height: 0 }
        }
    }

    /**
     * Returns the first complete bounds object from candidate metadata.
     * @param {unknown[]} candidates Candidate bounds records.
     * @returns {{ width: number, depth: number, height: number } | null}
     */
    static #firstBounds(candidates) {
        for (const candidate of candidates || []) {
            const bounds = PcbScene3dBuilder.#normalizeBounds(candidate)
            if (bounds) {
                return bounds
            }
        }

        return null
    }

    /**
     * Normalizes width/depth/height bounds metadata.
     * @param {unknown} candidate Candidate bounds record.
     * @returns {{ width: number, depth: number, height: number } | null}
     */
    static #normalizeBounds(candidate) {
        if (!candidate || typeof candidate !== 'object') {
            return null
        }

        const width = Number(candidate.width ?? candidate.x ?? candidate.sizeX)
        const depth = Number(candidate.depth ?? candidate.y ?? candidate.sizeY)
        const height = Number(
            candidate.height ?? candidate.z ?? candidate.sizeZ
        )

        if (
            !Number.isFinite(width) ||
            !Number.isFinite(depth) ||
            !Number.isFinite(height)
        ) {
            return null
        }

        return { width, depth, height }
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
        const matchContext = PcbScene3dBuilder.#buildBodyMatchContext(
            componentBodies,
            components
        )

        componentBodies.forEach((componentBody, bodyIndex) => {
            components.forEach((component, componentIndex) => {
                const distance =
                    PcbScene3dBuilder.#distanceBetweenBodyAndComponent(
                        componentBody,
                        component
                    )

                if (
                    distance <= 600 &&
                    PcbScene3dBuilder.#canUseCloseBodyComponentMatch(
                        componentBody,
                        component,
                        matchContext,
                        distance
                    )
                ) {
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
                PcbScene3dPlacementSideResolver.resolveBodyGroupKey(
                    componentBody
                )
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
                        PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
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
     * Builds reusable identity statistics for body/component matching.
     * @param {{ modelId?: string, name?: string, identifier?: string }[]} componentBodies
     * @param {{ pattern?: string, source?: string, modelPath?: string }[]} components
     * @returns {{ bodyGroupCounts: Map<string, number>, candidateComponentCounts: Map<string, number> }}
     */
    static #buildBodyMatchContext(componentBodies, components) {
        const bodyGroupCounts = new Map()
        const bodyByGroup = new Map()
        const candidateComponentCounts = new Map()

        for (const componentBody of componentBodies) {
            const groupKey =
                PcbScene3dPlacementSideResolver.resolveBodyGroupKey(
                    componentBody
                )
            bodyGroupCounts.set(
                groupKey,
                (bodyGroupCounts.get(groupKey) || 0) + 1
            )
            if (!bodyByGroup.has(groupKey)) {
                bodyByGroup.set(groupKey, componentBody)
            }
        }

        bodyByGroup.forEach((componentBody, groupKey) => {
            candidateComponentCounts.set(
                groupKey,
                components.filter(
                    (component) =>
                        PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                            componentBody,
                            component
                        ) > 0
                ).length
            )
        })

        return { bodyGroupCounts, candidateComponentCounts }
    }

    /**
     * Returns true when a close body/component pair is identity-compatible and
     * the body group can be matched one-to-one to component anchors.
     * @param {{ modelId?: string, name?: string, identifier?: string }} componentBody
     * @param {{ pattern?: string, source?: string, modelPath?: string }} component
     * @param {{ bodyGroupCounts: Map<string, number>, candidateComponentCounts: Map<string, number> }} matchContext
     * @param {number} distanceMil Distance between body and component anchors.
     * @returns {boolean}
     */
    static #canUseCloseBodyComponentMatch(
        componentBody,
        component,
        matchContext,
        distanceMil
    ) {
        if (
            Number(distanceMil) <=
            PcbScene3dBuilder.#PRECISE_BODY_MATCH_TOLERANCE_MIL
        ) {
            return true
        }

        if (
            PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                componentBody,
                component
            ) <= 0
        ) {
            return false
        }

        const groupKey =
            PcbScene3dPlacementSideResolver.resolveBodyGroupKey(componentBody)
        const bodyCount = matchContext.bodyGroupCounts.get(groupKey) || 0
        const candidateCount =
            matchContext.candidateComponentCounts.get(groupKey) || 0

        return bodyCount > 0 && bodyCount <= candidateCount
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
     * Returns the native body anchor that should be used for one explicit model
     * placement.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody
     * @returns {{ x: number, y: number }}
     */
    static #resolveExternalPlacementSourcePosition(componentBody) {
        return {
            x: Number(componentBody?.positionMil?.x || 0),
            y: Number(componentBody?.positionMil?.y || 0)
        }
    }

    /**
     * Resolves the authored placement rotation for one explicit external model.
     * Altium stores the 3D model's board-facing yaw in MODEL.3D.ROTZ.
     * @param {{ rotationDeg?: number }} componentBody
     * @param {{ rotation?: number } | null} matchedComponent
     * @returns {number}
     */
    static #resolveExternalPlacementRotation(componentBody, matchedComponent) {
        const modelRotationZ = Number(componentBody?.modelRotationDeg?.z)
        if (Number.isFinite(modelRotationZ)) {
            return PcbScene3dBuilder.#normalizeAngle(modelRotationZ)
        }

        return PcbScene3dBuilder.#normalizeAngle(
            Number(componentBody?.rotationDeg || 0) +
                Number(matchedComponent?.rotation || 0)
        )
    }

    /**
     * Resolves model-local rotations after converting Altium's positive local
     * rotation fields into the renderer's signed 3D model convention.
     * @param {{ modelRotationDeg?: { x?: number, y?: number, z?: number } }} componentBody
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolveExternalModelRotation(componentBody) {
        return {
            x: -Number(componentBody?.modelRotationDeg?.x || 0),
            y: -Number(componentBody?.modelRotationDeg?.y || 0),
            z: 0
        }
    }

    /**
     * Selects and normalizes one board-side silkscreen primitive set.
     * @param {{ layerId: number, name: string }[]} primitiveLayers
     * @param {{ x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[]} fills
     * @param {{ x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[]} tracks
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[]} arcs
     * @param {{ text?: string, value?: string, x?: number, y?: number, height?: number, strokeWidth?: number, layerCode?: number, layerId?: number, visible?: boolean }[]} texts
     * @param {{ points?: object[], holes?: object[][], layerCode?: number, layerId?: number }[]} regions
     * @param {{ minX?: number, minY?: number, widthMil?: number, heightMil?: number }} boardOutline
     * @param {'top' | 'bottom'} side
     * @param {{ x?: number, y?: number, holeDiameter?: number, drillDiameter?: number, holeSlotLength?: number, slotLength?: number, rotation?: number, holeRotation?: number }[]} pads
     * @param {{ x?: number, y?: number, holeDiameter?: number, drillDiameter?: number }[]} vias
     * @returns {{ fills: object[], tracks: object[], arcs: object[], regions: object[], texts: object[], nativeTextKnockouts: boolean }}
     */
    static #buildSilkscreenSide(
        primitiveLayers,
        fills,
        tracks,
        arcs,
        texts,
        regions,
        boardOutline,
        side,
        pads,
        vias
    ) {
        const normalized = PcbEdgeFacingGlyphNormalizer.normalize(
            PcbFootprintPrimitiveSelector.select(
                primitiveLayers,
                fills,
                tracks,
                arcs,
                regions,
                side
            ),
            boardOutline
        )
        const fillsWithRegions = [
            ...(normalized.fills || []),
            ...(normalized.regions || [])
        ]
        const denseOverlayArtwork = PcbScene3dBuilder.#isDenseOverlayArtwork(
            {
                fills: fillsWithRegions,
                tracks: normalized.tracks,
                arcs: normalized.arcs
            },
            boardOutline
        )

        const drillCutouts = PcbScene3dDrillCutoutBuilder.buildCutouts(
            pads,
            vias
        )

        return {
            ...normalized,
            denseOverlayArtwork,
            nativeTextKnockouts: PcbScene3dBuilder.#hasNativeTextKnockouts(
                fillsWithRegions,
                normalized,
                boardOutline
            ),
            texts: PcbScene3dBuilder.#selectSilkscreenTexts(
                primitiveLayers,
                texts,
                side
            ),
            tracks: normalized.tracks,
            fills: PcbScene3dDrillCutoutBuilder.clipFillsWithCutouts(
                fillsWithRegions,
                drillCutouts
            ),
            drillCutouts: drillCutouts.map((cutout) => cutout.points)
        }
    }

    /**
     * Applies optional appearance hints for overlay artwork that carries broad
     * silkscreen graphics plus dense board-colored linework.
     * @param {{ fills?: any[], tracks?: any[], arcs?: any[], fillColor?: number, strokeColor?: number }} topSilkscreen
     * @param {{ fills?: any[], tracks?: any[], arcs?: any[], fillColor?: number, strokeColor?: number }} bottomSilkscreen
     * @param {{ widthMil?: number, heightMil?: number }} board
     * @param {{ silkscreenTopColor?: number, silkscreenBottomColor?: number }} appearance3d
     * @returns {void}
     */
    static #applySilkscreenAppearance(
        topSilkscreen,
        bottomSilkscreen,
        board,
        appearance3d
    ) {
        PcbScene3dBuilder.#styleSilkscreenArtwork(
            topSilkscreen,
            board,
            appearance3d.silkscreenTopColor
        )
        PcbScene3dBuilder.#styleSilkscreenArtwork(
            bottomSilkscreen,
            board,
            appearance3d.silkscreenBottomColor
        )
    }

    /**
     * Applies silkscreen colors and marks dense overlay art as light filled
     * areas with app-board-colored strokes.
     * @param {{ fills?: any[], tracks?: any[], arcs?: any[], fillColor?: number, strokeColor?: number, knockoutColor?: number, denseOverlayArtwork?: boolean }} side
     * @param {{ widthMil?: number, heightMil?: number }} board
     * @param {number | undefined} silkscreenColor
     * @returns {void}
     */
    static #styleSilkscreenArtwork(side, board, silkscreenColor) {
        if (Number.isInteger(silkscreenColor)) {
            side.strokeColor = silkscreenColor
        }

        if (
            !side?.denseOverlayArtwork &&
            !PcbScene3dBuilder.#isDenseOverlayArtwork(side, board)
        ) {
            return
        }

        side.fillColor = Number.isInteger(silkscreenColor)
            ? silkscreenColor
            : PcbScene3dBuilder.#DENSE_OVERLAY_FILL_COLOR
        side.strokeColor = side.fillColor
        side.knockoutColor = PcbScene3dBuilder.#DENSE_OVERLAY_KNOCKOUT_COLOR
    }

    /**
     * Selects visible side-specific silkscreen texts.
     * @param {{ layerId: number, name: string }[]} primitiveLayers
     * @param {{ text?: string, value?: string, x?: number, y?: number, height?: number, strokeWidth?: number, layerCode?: number, layerId?: number, visible?: boolean }[]} texts
     * @param {'top' | 'bottom'} side
     * @returns {object[]}
     */
    static #selectSilkscreenTexts(primitiveLayers, texts, side) {
        const layerIds = PcbScene3dBuilder.#resolveSilkscreenLayerIds(
            primitiveLayers,
            side
        )

        return (Array.isArray(texts) ? texts : [])
            .filter((text) => text?.visible !== false)
            .filter((text) => layerIds.has(Number(text?.layerId)))
            .map((text) =>
                PcbScene3dBuilder.#normalizeSilkscreenText(text, side)
            )
    }

    /**
     * Resolves layer IDs that belong to one overlay side.
     * @param {{ layerId: number, name: string }[]} primitiveLayers
     * @param {'top' | 'bottom'} side
     * @returns {Set<number>}
     */
    static #resolveSilkscreenLayerIds(primitiveLayers, side) {
        const needle = side === 'bottom' ? 'BOTTOM OVERLAY' : 'TOP OVERLAY'

        return new Set(
            (Array.isArray(primitiveLayers) ? primitiveLayers : [])
                .filter((layer) =>
                    String(layer?.name || '')
                        .trim()
                        .toUpperCase()
                        .includes(needle)
                )
                .map((layer) => Number(layer.layerId))
                .filter((layerId) => Number.isInteger(layerId))
        )
    }

    /**
     * Normalizes one Altium overlay text into the runtime stroke-text shape.
     * @param {{ text?: string, value?: string, x?: number, y?: number, height?: number, strokeWidth?: number, rotation?: number, mirrored?: boolean | number | string, isMirrored?: boolean | number | string, mirrorFlag?: boolean | number | string, Mirrored?: boolean | number | string, IsMirrored?: boolean | number | string, MirrorFlag?: boolean | number | string, layerId?: number }} text
     * @param {'top' | 'bottom'} side
     * @returns {object}
     */
    static #normalizeSilkscreenText(text, side) {
        const height = Math.max(Number(text?.height || 0), 1)
        const textBox = PcbScene3dTextBoxLayoutResolver.resolve(text)

        return {
            ...text,
            ...(textBox ? { textBox } : {}),
            text: String(text?.text ?? text?.value ?? ''),
            value: String(text?.text ?? text?.value ?? ''),
            sizeX: height,
            sizeY:
                height *
                PcbScene3dBuilder.#resolveSilkscreenTextWidthRatio(text),
            thickness: Math.max(Number(text?.strokeWidth || 0), 1),
            hAlign: 'left',
            vAlign: 'bottom',
            mirrored: PcbScene3dBuilder.#resolveSilkscreenTextMirrored(text),
            side,
            rotation: PcbScene3dBuilder.#resolveSilkscreenTextRotation(text)
        }
    }

    /**
     * Converts screen-space Altium text rotation for the shared 3D text factories.
     * @param {{ rotation?: number | string }} text
     * @returns {number}
     */
    static #resolveSilkscreenTextRotation(text) {
        return PcbScene3dBuilder.#normalizeAngle(
            360 - Number(text?.rotation || 0)
        )
    }

    /**
     * Checks whether one silkscreen text primitive uses TrueType glyphs.
     * @param {{ fontTypeName?: string, fontType?: number | string, isTrueType?: boolean }} text
     * @returns {boolean}
     */
    static #isTrueTypeSilkscreenText(text) {
        const fontTypeName = String(text?.fontTypeName || '').toUpperCase()

        return (
            text?.isTrueType === true ||
            Number(text?.fontType) === 1 ||
            fontTypeName.includes('TRUETYPE')
        )
    }

    /**
     * Resolves the horizontal glyph scale used by the 3D stroke approximation.
     * @param {{ fontTypeName?: string, fontType?: number | string, isTrueType?: boolean }} text
     * @returns {number}
     */
    static #resolveSilkscreenTextWidthRatio(text) {
        return PcbScene3dBuilder.#isTrueTypeSilkscreenText(text)
            ? PcbScene3dBuilder.#TRUETYPE_TEXT_WIDTH_RATIO
            : 1
    }

    /**
     * Resolves Altium's explicit per-text mirror flag.
     * @param {{ mirrored?: boolean | number | string, isMirrored?: boolean | number | string, mirrorFlag?: boolean | number | string, Mirrored?: boolean | number | string, IsMirrored?: boolean | number | string, MirrorFlag?: boolean | number | string }} text
     * @returns {boolean}
     */
    static #resolveSilkscreenTextMirrored(text) {
        const value =
            text?.mirrored ??
            text?.isMirrored ??
            text?.mirrorFlag ??
            text?.Mirrored ??
            text?.IsMirrored ??
            text?.MirrorFlag

        if (typeof value === 'boolean') return value
        if (typeof value === 'number') return value !== 0

        return /^(1|true|yes|y)$/iu.test(String(value ?? '').trim())
    }

    /**
     * Detects dense Altium overlay regions that already carry text knockouts
     * as native fill holes.
     * @param {any[]} fills
     * @param {{ tracks?: any[], arcs?: any[] }} primitives
     * @param {{ widthMil?: number, heightMil?: number }} board
     * @returns {boolean}
     */
    static #hasNativeTextKnockouts(fills, primitives, board) {
        return (
            (Boolean(primitives?.denseOverlayArtwork) ||
                PcbScene3dBuilder.#isDenseOverlayArtwork(
                    {
                        fills,
                        tracks: primitives?.tracks,
                        arcs: primitives?.arcs
                    },
                    board
                )) &&
            (Array.isArray(fills) ? fills : []).some(
                (fill) => Array.isArray(fill?.holes) && fill.holes.length > 0
            )
        )
    }

    /**
     * Detects overlay art from structural density rather than file-specific
     * labels or source identifiers.
     * @param {{ fills?: any[], tracks?: any[], arcs?: any[] }} side
     * @param {{ widthMil?: number, heightMil?: number }} board
     * @returns {boolean}
     */
    static #isDenseOverlayArtwork(side, board) {
        const strokeCount =
            (Array.isArray(side?.tracks) ? side.tracks.length : 0) +
            (Array.isArray(side?.arcs) ? side.arcs.length : 0)

        return (
            strokeCount >= PcbScene3dBuilder.#DENSE_OVERLAY_MIN_TRACK_COUNT &&
            PcbScene3dBuilder.#maxFillAreaRatio(side?.fills, board) >=
                PcbScene3dBuilder.#DENSE_OVERLAY_MIN_REGION_AREA_RATIO
        )
    }

    /**
     * Resolves the largest fill-to-board bounding-box area ratio.
     * @param {any[] | undefined} fills
     * @param {{ widthMil?: number, heightMil?: number }} board
     * @returns {number}
     */
    static #maxFillAreaRatio(fills, board) {
        const boardArea =
            Math.max(Number(board?.widthMil || 0), 0) *
            Math.max(Number(board?.heightMil || 0), 0)
        if (!boardArea) {
            return 0
        }

        return (Array.isArray(fills) ? fills : []).reduce((maxRatio, fill) => {
            const bounds = PcbScene3dBuilder.#resolveFillBounds(fill)
            if (!bounds) {
                return maxRatio
            }

            const fillArea =
                Math.max(bounds.maxX - bounds.minX, 0) *
                Math.max(bounds.maxY - bounds.minY, 0)

            return Math.max(maxRatio, fillArea / boardArea)
        }, 0)
    }

    /**
     * Resolves rough authored bounds for one rectangular or polygon fill.
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number, points?: { x?: number, y?: number }[] }} fill
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveFillBounds(fill) {
        const points = Array.isArray(fill?.points)
            ? fill.points
                  .map((point) => ({
                      x: Number(point?.x),
                      y: Number(point?.y)
                  }))
                  .filter(
                      (point) =>
                          Number.isFinite(point.x) && Number.isFinite(point.y)
                  )
            : [
                  { x: Number(fill?.x1), y: Number(fill?.y1) },
                  { x: Number(fill?.x2), y: Number(fill?.y2) }
              ].filter(
                  (point) =>
                      Number.isFinite(point.x) && Number.isFinite(point.y)
              )

        if (points.length < 2) {
            return null
        }

        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys)
        }
    }

    /**
     * Resolves region primitives that can contribute filled silkscreen artwork.
     * @param {{ regions?: object[], shapeBasedRegions?: object[] }} pcb
     * @returns {object[]}
     */
    static #resolveSilkscreenRegions(pcb) {
        if (
            Array.isArray(pcb?.shapeBasedRegions) &&
            pcb.shapeBasedRegions.length
        ) {
            return pcb.shapeBasedRegions.map((region) => ({
                ...region,
                isShapeBased: true
            }))
        }

        return Array.isArray(pcb?.regions) ? pcb.regions : []
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
     * Returns true when one unresolved body anchor still lies close enough to
     * the board envelope to be renderable without a component match.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number }} board
     * @returns {boolean}
     */
    static #isBodyPositionNearBoard(componentBody, board) {
        const bodyX = Number(componentBody?.positionMil?.x || 0)
        const bodyY = Number(componentBody?.positionMil?.y || 0)
        const xOverhang = PcbScene3dBuilder.#resolveUnmatchedBodyOverhang(
            board?.widthMil
        )
        const yOverhang = PcbScene3dBuilder.#resolveUnmatchedBodyOverhang(
            board?.heightMil
        )
        const minX = Number(board?.minX || 0) - xOverhang
        const minY = Number(board?.minY || 0) - yOverhang
        const maxX =
            Number(board?.minX || 0) + Number(board?.widthMil || 0) + xOverhang
        const maxY =
            Number(board?.minY || 0) + Number(board?.heightMil || 0) + yOverhang

        return bodyX >= minX && bodyX <= maxX && bodyY >= minY && bodyY <= maxY
    }

    /**
     * Resolves a proportional unresolved-body margin for one board axis.
     * @param {number | string | undefined} spanMil Board axis span.
     * @returns {number}
     */
    static #resolveUnmatchedBodyOverhang(spanMil) {
        const proportional =
            Math.max(Number(spanMil || 0), 0) *
            PcbScene3dBuilder.#UNMATCHED_BODY_OVERHANG_RATIO

        return Math.min(
            PcbScene3dBuilder.#UNMATCHED_BODY_MAX_OVERHANG_MIL,
            Math.max(
                proportional,
                PcbScene3dBuilder.#UNMATCHED_BODY_MIN_OVERHANG_MIL
            )
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
