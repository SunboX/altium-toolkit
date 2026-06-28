// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbEdgeFacingGlyphNormalizer } from './PcbEdgeFacingGlyphNormalizer.mjs'
import { PcbScene3dBoardOutlineRefiner } from './PcbScene3dBoardOutlineRefiner.mjs'
import { PcbScene3dDrillCutoutBuilder } from './PcbScene3dDrillCutoutBuilder.mjs'
import { AltiumScene3dExternalPlacementAdapter } from './AltiumScene3dExternalPlacementAdapter.mjs'
import { AltiumScene3dBottomPadRotationAdapter } from './AltiumScene3dBottomPadRotationAdapter.mjs'
import { AltiumScene3dComponentBodyAdapter } from './AltiumScene3dComponentBodyAdapter.mjs'
import { AltiumScene3dAuthoredBodyAnchorAdapter } from './AltiumScene3dAuthoredBodyAnchorAdapter.mjs'
import { AltiumScene3dShapeStackOwnerAdapter } from './AltiumScene3dShapeStackOwnerAdapter.mjs'
import { PcbFootprintPrimitiveSelector } from './PcbFootprintPrimitiveSelector.mjs'
import { PcbScene3dPadLocalSpanResolver } from './PcbScene3dPadLocalSpanResolver.mjs'
import { PcbScene3dPackages } from './PcbScene3dPackages.mjs'
import { PcbScene3dPlacementSideResolver } from './PcbScene3dPlacementSideResolver.mjs'
import { PcbScene3dStaticBodyPlacementBuilder } from './PcbScene3dStaticBodyPlacementBuilder.mjs'
import { PcbScene3dPadYawResolver } from './PcbScene3dPadYawResolver.mjs'
import { PcbScene3dTextBoxLayoutResolver } from './PcbScene3dTextBoxLayoutResolver.mjs'
import { PcbFootprintPadAxisNormalizer } from './PcbFootprintPadAxisNormalizer.mjs'
import { PcbScene3dCopperRegionDetailBuilder } from './PcbScene3dCopperRegionDetailBuilder.mjs'
import { AltiumScene3dBottomSourceHalfTurnPolicy } from './AltiumScene3dBottomSourceHalfTurnPolicy.mjs'

/**
 * Builds deterministic 3D scene data from the normalized PCB model.
 */
export class PcbScene3dBuilder {
    static #DENSE_OVERLAY_FILL_COLOR = 0xf8f6ef
    static #DENSE_OVERLAY_MIN_REGION_AREA_RATIO = 0.2
    static #DENSE_OVERLAY_MIN_TRACK_COUNT = 250
    static #DENSE_OVERLAY_KNOCKOUT_COLOR = 0x2f6a2c
    static #PRECISE_BODY_MATCH_TOLERANCE_MIL = 20
    static #EXACT_BODY_MISMATCH_TOLERANCE_MIL = 1
    static #NEAR_PACKAGE_AFFINITY_DISTANCE_MIL = 100
    static #UNMATCHED_BODY_OVERHANG_RATIO = 0.25
    static #UNMATCHED_BODY_MIN_OVERHANG_MIL = 150
    static #UNMATCHED_BODY_MAX_OVERHANG_MIL = 600
    static #OVERSIZED_GENERIC_FALLBACK_MAX_MIL = 800
    static #TIMING_STACK_BODY_RADIUS_MIL = 220
    static #TRUETYPE_TEXT_WIDTH_RATIO = 0.55
    static #LOW_CONFIDENCE_GENERIC_FOOTPRINT_PATTERN =
        /(?:^|[^a-z0-9])(?:edge|finger|fingers|contact|contacts|mech|mechanical|jumper|jump)(?:$|[^a-z0-9])/i
    static #AUTHORED_BODY_IDENTITY_PATTERN =
        /(?:^|[^a-z0-9])(?:antenna|coax|conn|connector|edge|flex|fpc|frame|hardware|header|jack|mechanical|module|mount|shield|sma|socket|usb)(?:$|[^a-z0-9])/i
    static #AUTHORED_COVER_STACK_IDENTITY_PATTERN =
        /(?:^|[^a-z0-9])(?:emi|rf|rfi|shield|cover|can)(?:$|[^a-z0-9])/i
    static #MECHANICAL_SHIELD_FALLBACK_PATTERN =
        /(?:^|[^a-z0-9])(?:emi|rfi|shield|cover|can)(?:$|[^a-z0-9])/i
    static #MECHANICAL_SHIELD_FRAME_OWNER_TOKENS = [
        'emi',
        'rfi',
        'rf',
        'shield',
        'can'
    ]
    static #MECHANICAL_SHIELD_FRAME_BODY_PATTERN =
        /(?:^|[^a-z0-9])(?:frame[0-9]*|leg|rail|side|wall)(?:$|[^a-z0-9])/i
    static #MECHANICAL_SHIELD_FRAME_OWNER_RADIUS_MIL = 750
    static #COMPONENT_PACKAGE_BODY_PATTERN =
        /(?:^|[^a-z0-9])(?:[a-z0-9]*dfn[a-z0-9]*|[a-z0-9]*qfn[a-z0-9]*|bga|cap|capacitor|crystal|diode|ferrite|ind|inductor|lga|lqg[a-z0-9]*|lqw[a-z0-9]*|osc|qfp|res|resistor|sot|transistor|xtal)(?:$|[^a-z0-9])/i
    static #TIMING_STACK_COMPONENT_PATTERN =
        /(?:^|[^a-z0-9])(?:clock|crystal|osc|oscillator|resonator|tcxo|txco|xtal)(?:$|[^a-z0-9])/i
    static #TIMING_STACK_DESIGNATOR_PATTERN = /^(?:y|xo)\d+[a-z]?$/i
    static #TIMING_STACK_HEIGHT_TOLERANCE_MIL = 0.1
    static #TIMING_STACK_CARRIER_BOUNDS_TOLERANCE_MIL = 5

    /**
     * Builds a scene description for host 3D renderers.
     * @param {{ pcb?: { boardOutline?: { widthMil?: number, heightMil?: number, minX?: number, minY?: number, segments?: Array<Record<string, number | string>> }, primitiveLayers?: { layerId: number, name: string }[], pads?: { x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[], tracks?: any[], arcs?: any[], fills?: any[], vias?: any[], polygons?: any[], embeddedModels?: any[], componentBodies?: { modelId?: string, checksum?: number | null, embedded?: boolean, name?: string, identifier?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, modelRotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number, staticGeometry?: object }[], components?: { designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null, source?: string, modelPath?: string }[] } }} documentModel
     * @param {{ modelRegistry?: { resolveComponentModel: (component: any) => { name: string, relativePath: string, format: string } | null, resolveComponentBodyModel?: (componentBody: any) => { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } | null, resolveBoardAssemblyModel?: (documentModel: any) => { origin: string, name: string, format: string, file?: File | Blob | null, relativePath?: string } | null } | null, boardThicknessMil?: number }} [options]
     * @returns {{ board: { widthMil: number, heightMil: number, thicknessMil: number, minX: number, minY: number, centerX: number, centerY: number, segments: Array<Record<string, number | string>> }, boardAssemblyModel: { origin: string, name: string, format: string, file?: File | Blob | null, relativePath?: string } | null, components: { designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, boardPositionMil: { x: number, y: number, z: number }, pattern: string, source: string, body: { family: string, sizeMil: { width: number, depth: number, height: number } }, externalModel: { name: string, relativePath: string, format: string } | null }[], externalPlacements: { designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, bodyRotationDeg: number, modelTransform: { rotationDeg: { x: number, y: number, z: number }, dzMil: number }, externalModel: { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } }[], staticBodyPlacements: { designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, geometry: object }[], detail: { pads: any[], tracks: any[], arcs: any[], fills: any[], vias: any[], polygons: any[], silkscreen: { top: { fills: any[], tracks: any[], arcs: any[], texts: any[], fillColor?: number, strokeColor?: number }, bottom: { fills: any[], tracks: any[], arcs: any[], texts: any[], fillColor?: number, strokeColor?: number } } } }}
     */
    static build(documentModel, options = {}) {
        const sceneDocumentModel =
            PcbFootprintPadAxisNormalizer.apply(documentModel)
        const pcb = sceneDocumentModel?.pcb || {}
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
        const regionFills = PcbScene3dCopperRegionDetailBuilder.build(pcb)
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
        const componentBodyModels = componentBodies.map((componentBody) =>
            PcbScene3dBuilder.#shouldRenderStaticGeometryOnly(componentBody) ||
            PcbScene3dBuilder.#shouldSuppressLayerlessBodyPlaceholder(
                componentBody,
                componentBodies,
                board
            )
                ? null
                : PcbScene3dBuilder.#resolveComponentBodyModel(
                      componentBody,
                      modelRegistry
                  )
        )
        const bodyMatches = PcbScene3dBuilder.#resolveComponentBodyMatches(
            componentBodies,
            components,
            componentBodyModels
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

        const sceneComponents = components
            .map((component) =>
                PcbScene3dBuilder.#buildComponent(
                    component,
                    pads,
                    board,
                    thicknessMil,
                    modelRegistry
                )
            )
            .filter(Boolean)
        const externalPlacements = componentBodies
            .map((componentBody, index) =>
                PcbScene3dBuilder.#buildExternalPlacement(
                    componentBody,
                    bodyMatches[index],
                    componentBodyModels[index],
                    components,
                    pads,
                    board,
                    thicknessMil,
                    componentBodies
                )
            )
            .filter(Boolean)
        const staticBodyPlacements = PcbScene3dStaticBodyPlacementBuilder.build(
            componentBodies,
            bodyMatches,
            components,
            pads,
            board,
            thicknessMil
        )

        const sceneDescription = {
            sourceFormat: 'altium',
            board,
            boardAssemblyModel:
                modelRegistry?.resolveBoardAssemblyModel?.(documentModel) ||
                null,
            components:
                PcbScene3dBuilder.#suppressExternallyCoveredFallbackBodies(
                    sceneComponents,
                    components,
                    externalPlacements,
                    pads
                ),
            externalPlacements,
            staticBodyPlacements,
            detail: {
                embeddedFonts: Array.isArray(pcb.embeddedFonts)
                    ? pcb.embeddedFonts
                    : [],
                pads,
                tracks,
                arcs,
                fills: [...fills, ...regionFills],
                vias,
                polygons: Array.isArray(pcb.polygons) ? pcb.polygons : [],
                silkscreen: {
                    top: topSilkscreen,
                    bottom: bottomSilkscreen
                }
            }
        }

        return AltiumScene3dAuthoredBodyAnchorAdapter.apply(
            AltiumScene3dBottomPadRotationAdapter.apply(
                AltiumScene3dComponentBodyAdapter.apply(
                    AltiumScene3dExternalPlacementAdapter.apply(
                        AltiumScene3dShapeStackOwnerAdapter.apply(
                            PcbScene3dBoardOutlineRefiner.refine(
                                sceneDescription,
                                sceneDocumentModel
                            ),
                            sceneDocumentModel
                        ),
                        sceneDocumentModel
                    ),
                    sceneDocumentModel
                )
            )
        )
    }

    /**
     * Builds one procedural component scene entry.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null, source?: string, description?: string, parameters?: Record<string, unknown>, modelPath?: string }} component
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[]} pads
     * @param {{ centerX: number, centerY: number }} board
     * @param {number} thicknessMil
     * @param {{ resolveComponentModel: (component: any) => { name: string, relativePath: string, format: string } | null } | null} modelRegistry
     * @returns {{ componentIndex: number | null, designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, boardPositionMil: { x: number, y: number, z: number }, pattern: string, source: string, description: string, parameters: Record<string, unknown>, body: { family: string, sizeMil: { width: number, depth: number, height: number } }, externalModel: { name: string, relativePath: string, format: string } | null, renderFallbackBody?: boolean } | null}
     */
    static #buildComponent(
        component,
        pads,
        board,
        thicknessMil,
        modelRegistry
    ) {
        const mountSide = PcbScene3dBuilder.#resolveMountSide(component)
        const rotationDeg = PcbScene3dBuilder.#resolveComponentRotation(
            component,
            pads,
            mountSide
        )
        const padSpan = PcbScene3dBuilder.#resolvePadSpan(
            component,
            pads,
            rotationDeg
        )
        const body = PcbScene3dPackages.resolve(component, padSpan)
        const externalModel = modelRegistry
            ? modelRegistry.resolveComponentModel(component)
            : null
        const suppressFallbackBody =
            PcbScene3dBuilder.#shouldSuppressProceduralComponent(
                component,
                body,
                externalModel
            )

        const halfBoardThickness = thicknessMil / 2
        const halfBodyHeight = body.sizeMil.height / 2
        const z =
            mountSide === 'bottom'
                ? -(halfBoardThickness + halfBodyHeight)
                : halfBoardThickness + halfBodyHeight

        return {
            componentIndex: Number.isFinite(Number(component.componentIndex))
                ? Number(component.componentIndex)
                : null,
            designator: component.designator,
            mountSide,
            rotationDeg,
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
            description: String(component.description || ''),
            parameters:
                component.parameters &&
                typeof component.parameters === 'object' &&
                !Array.isArray(component.parameters)
                    ? { ...component.parameters }
                    : {},
            body,
            externalModel,
            ...(suppressFallbackBody ? { renderFallbackBody: false } : {})
        }
    }

    /**
     * Checks whether one generated fallback body is too uncertain to render.
     * @param {{ pattern?: string, source?: string, description?: string }} component Source component.
     * @param {{ family?: string, sizeMil?: { width?: number, depth?: number } }} body Procedural body.
     * @param {object | null} externalModel Resolved external model.
     * @returns {boolean}
     */
    static #shouldSuppressProceduralComponent(component, body, externalModel) {
        return (
            !externalModel &&
            body?.family === 'generic' &&
            ((PcbScene3dBuilder.#isOversizedGenericFallback(body) &&
                PcbScene3dBuilder.#isLowConfidenceGenericFootprint(
                    component
                )) ||
                PcbScene3dBuilder.#isMechanicalShieldFallback(component))
        )
    }

    /**
     * Suppresses procedural fallbacks when explicit body placements already
     * cover every drilled pad owned by the same component.
     * @param {object[]} sceneComponents Scene component rows.
     * @param {object[]} sourceComponents Source PCB component rows.
     * @param {object[]} externalPlacements Built external placements.
     * @param {object[]} pads PCB pad rows.
     * @returns {object[]}
     */
    static #suppressExternallyCoveredFallbackBodies(
        sceneComponents,
        sourceComponents,
        externalPlacements,
        pads
    ) {
        const sourceByDesignator = new Map(
            (Array.isArray(sourceComponents) ? sourceComponents : []).map(
                (component) => [String(component?.designator || ''), component]
            )
        )

        return (Array.isArray(sceneComponents) ? sceneComponents : []).map(
            (component) =>
                PcbScene3dBuilder.#hasExternalPlacementPadCoverage(
                    sourceByDesignator.get(
                        String(component?.designator || '')
                    ) || component,
                    component,
                    externalPlacements,
                    pads
                )
                    ? { ...component, renderFallbackBody: false }
                    : component
        )
    }

    /**
     * Checks whether explicit placements occupy all drilled pads for a component.
     * @param {object} sourceComponent Source PCB component.
     * @param {object} sceneComponent Scene component.
     * @param {object[]} externalPlacements Built external placements.
     * @param {object[]} pads PCB pad rows.
     * @returns {boolean}
     */
    static #hasExternalPlacementPadCoverage(
        sourceComponent,
        sceneComponent,
        externalPlacements,
        pads
    ) {
        if (sceneComponent?.renderFallbackBody === false) {
            return false
        }

        const designator = String(sceneComponent?.designator || '')
        const componentPads = PcbScene3dBuilder.#componentPads(
            sourceComponent,
            pads
        ).filter((pad) => PcbScene3dBuilder.#hasDrilledPadOpening(pad))
        if (componentPads.length < 2) {
            return false
        }

        const placements = (
            Array.isArray(externalPlacements) ? externalPlacements : []
        ).filter(
            (placement) => String(placement?.designator || '') === designator
        )
        if (placements.length < componentPads.length) {
            return false
        }

        return componentPads.every((pad) =>
            placements.some((placement) =>
                PcbScene3dBuilder.#placementCoversPad(placement, pad)
            )
        )
    }

    /**
     * Checks whether one external placement anchor covers one drilled pad.
     * @param {object} placement External model placement.
     * @param {object} pad PCB pad row.
     * @returns {boolean}
     */
    static #placementCoversPad(placement, pad) {
        const point = placement?.bodyPositionMil
        if (
            !Number.isFinite(Number(point?.x)) ||
            !Number.isFinite(Number(point?.y))
        ) {
            return false
        }

        return (
            PcbScene3dBuilder.#distanceToPadAnchor(point, pad) <=
            PcbScene3dBuilder.#EXACT_BODY_MISMATCH_TOLERANCE_MIL
        )
    }

    /**
     * Checks whether a generic component row describes authored shield
     * hardware that should not become a filled fallback box.
     * @param {{ pattern?: string, source?: string, description?: string, parameters?: Record<string, unknown>, provenance?: Record<string, unknown> }} component Source component.
     * @returns {boolean}
     */
    static #isMechanicalShieldFallback(component) {
        return PcbScene3dBuilder.#MECHANICAL_SHIELD_FALLBACK_PATTERN.test(
            PcbScene3dBuilder.#componentIdentityText(component)
        )
    }

    /**
     * Builds normalized free-text identity for component classification.
     * @param {{ pattern?: string, source?: string, description?: string, parameters?: Record<string, unknown>, provenance?: Record<string, unknown> }} component Source component.
     * @returns {string}
     */
    static #componentIdentityText(component) {
        return [
            component?.pattern,
            component?.source,
            component?.description,
            component?.provenance?.sourceLibReference,
            component?.provenance?.footprintDescription,
            ...Object.values(component?.parameters || {})
        ]
            .map((value) => String(value || ''))
            .join(' ')
    }

    /**
     * Checks whether one generic fallback body spans too much of the board.
     * @param {{ sizeMil?: { width?: number, depth?: number } }} body Procedural body.
     * @returns {boolean}
     */
    static #isOversizedGenericFallback(body) {
        return (
            Math.max(
                Number(body?.sizeMil?.width || 0),
                Number(body?.sizeMil?.depth || 0)
            ) > PcbScene3dBuilder.#OVERSIZED_GENERIC_FALLBACK_MAX_MIL
        )
    }

    /**
     * Checks for footprint identities that describe board features or
     * mechanical placeholders more often than physical package bodies.
     * @param {{ pattern?: string, source?: string, description?: string }} component Source component.
     * @returns {boolean}
     */
    static #isLowConfidenceGenericFootprint(component) {
        return PcbScene3dBuilder.#LOW_CONFIDENCE_GENERIC_FOOTPRINT_PATTERN.test(
            [
                component?.pattern,
                component?.source,
                component?.description
            ].join(' ')
        )
    }

    /**
     * Resolves one component-body model through the active registry.
     * @param {{ modelId?: string, checksum?: number | null, name?: string }} componentBody Component body metadata.
     * @param {{ resolveComponentBodyModel?: (componentBody: any) => { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } | null } | null} modelRegistry Model registry.
     * @returns {{ origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } | null}
     */
    static #resolveComponentBodyModel(componentBody, modelRegistry) {
        return modelRegistry?.resolveComponentBodyModel?.(componentBody) || null
    }

    /**
     * Builds one explicit external-model placement from normalized component
     * body metadata.
     * @param {{ modelId?: string, checksum?: number | null, embedded?: boolean, name?: string, identifier?: string, layer?: string, positionMil?: { x?: number, y?: number }, rotationDeg?: number, modelRotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number, bodyOpacity?: number | string }} componentBody
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, rotation?: number, height?: number | null } | null} matchedComponent
     * @param {{ origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } | null} resolvedModel
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[]} pads
     * @param {{ centerX: number, centerY: number }} board
     * @param {number} thicknessMil
     * @param {object[]} componentBodies All source component bodies.
     * @returns {{ designator: string, mountSide: string, rotationDeg: number, positionMil: { x: number, y: number, z: number }, bodyPositionMil: { x: number, y: number }, bodyRotationDeg: number, modelTransform: { rotationDeg: { x: number, y: number, z: number }, dzMil: number }, externalModel: { origin: string, name: string, format: string, payloadText?: string, sourceStream?: string, relativePath?: string } } | null}
     */
    static #buildExternalPlacement(
        componentBody,
        matchedComponent,
        resolvedModel,
        components,
        pads,
        board,
        thicknessMil,
        componentBodies
    ) {
        if (PcbScene3dBuilder.#shouldRenderStaticGeometryOnly(componentBody)) {
            return null
        }

        if (!resolvedModel) {
            return null
        }

        const sourcePosition =
            PcbScene3dBuilder.#resolveExternalPlacementSourcePosition(
                componentBody
            )
        const resolvedMatchedComponent =
            matchedComponent ||
            PcbScene3dBuilder.#resolveComponentFromOwnedDrilledPad(
                sourcePosition,
                components,
                pads
            )

        if (
            PcbScene3dBuilder.#isPositiveTimingStackPackageBody(
                componentBody,
                resolvedMatchedComponent,
                components,
                componentBodies
            )
        ) {
            return null
        }

        if (
            !resolvedMatchedComponent &&
            PcbScene3dBuilder.#shouldDropUnmatchedPackageBody(
                componentBody,
                components
            )
        ) {
            return null
        }

        if (
            !resolvedMatchedComponent &&
            !PcbScene3dBuilder.#isBodyPositionNearBoard(componentBody, board)
        ) {
            return null
        }

        const mountSide = PcbScene3dPlacementSideResolver.resolvePlacementSide(
            componentBody,
            resolvedMatchedComponent,
            components,
            board
        )
        const halfBoardThickness = thicknessMil / 2
        const modelRotation = PcbScene3dBuilder.#resolveExternalModelRotation(
            componentBody,
            resolvedMatchedComponent,
            pads,
            mountSide
        )

        return {
            designator:
                resolvedMatchedComponent?.designator ||
                String(
                    componentBody.identifier || componentBody.name || '3D model'
                ),
            mountSide,
            rotationDeg: PcbScene3dBuilder.#resolveExternalPlacementRotation(
                componentBody,
                resolvedMatchedComponent
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
                dzMil: PcbScene3dBuilder.#resolveComponentBodyVerticalOffset(
                    componentBody,
                    resolvedMatchedComponent,
                    mountSide
                )
            },
            projection: PcbScene3dBuilder.#resolveProjectionDiagnostics(
                componentBody,
                resolvedMatchedComponent,
                pads,
                resolvedModel
            ),
            ...PcbScene3dBuilder.#componentBodyDisplayMetadata(componentBody),
            externalModel: resolvedModel
        }
    }

    /**
     * Resolves optional component-body display metadata for external renderers.
     * @param {{ bodyOpacity?: number | string }} componentBody Component body.
     * @returns {{ bodyOpacity?: number }}
     */
    static #componentBodyDisplayMetadata(componentBody) {
        const opacity = Number(componentBody?.bodyOpacity)

        return Number.isFinite(opacity) && opacity > 0 && opacity < 1
            ? { bodyOpacity: opacity }
            : {}
    }

    /**
     * Resolves the vertical offset that should remain after the viewer seats
     * raw model bounds on the board face.
     * @param {{ dzMil?: number, standoffHeightMil?: number | null }} componentBody Component-body placement metadata.
     * @param {object | null} matchedComponent Matched owner component.
     * @param {'top' | 'bottom'} mountSide Resolved mount side.
     * @returns {number}
     */
    static #resolveComponentBodyVerticalOffset(
        componentBody,
        matchedComponent = null,
        mountSide = 'top'
    ) {
        const standoffHeightMil = Number(componentBody?.standoffHeightMil)
        if (Number.isFinite(standoffHeightMil)) {
            if (
                PcbScene3dBuilder.#shouldPreserveNegativeBodyOffset(
                    standoffHeightMil,
                    componentBody,
                    mountSide
                ) ||
                (standoffHeightMil > 0 &&
                    PcbScene3dBuilder.#shouldPreservePositiveBodyStandoff(
                        componentBody,
                        matchedComponent
                    ))
            ) {
                return PcbScene3dBuilder.#toMountSideVerticalOffset(
                    standoffHeightMil,
                    mountSide
                )
            }
        }

        const dzMil = Number(componentBody?.dzMil)
        return Number.isFinite(dzMil) &&
            (PcbScene3dBuilder.#shouldPreserveNegativeBodyOffset(
                dzMil,
                componentBody,
                mountSide
            ) ||
                (dzMil > 0 &&
                    PcbScene3dBuilder.#shouldPreservePositiveBodyStandoff(
                        componentBody,
                        matchedComponent
                    )))
            ? PcbScene3dBuilder.#toMountSideVerticalOffset(dzMil, mountSide)
            : 0
    }

    /**
     * Converts preserved source Z offsets to the viewer mount-side convention.
     * @param {number} value Source vertical offset.
     * @param {'top' | 'bottom'} mountSide Resolved mount side.
     * @returns {number}
     */
    static #toMountSideVerticalOffset(value, mountSide) {
        return String(mountSide || '').toLowerCase() === 'bottom' && value < 0
            ? Math.abs(value)
            : value
    }

    /**
     * Checks whether a negative source offset describes intentional top-side
     * model penetration instead of a source-origin seating artifact.
     * @param {number} value Source vertical offset.
     * @param {{ overallHeightMil?: number | null }} componentBody Component-body placement metadata.
     * @param {'top' | 'bottom'} mountSide Resolved mount side.
     * @returns {boolean}
     */
    static #shouldPreserveNegativeBodyOffset(value, componentBody, mountSide) {
        const offset = Number(value)
        if (
            !Number.isFinite(offset) ||
            offset >= 0 ||
            String(mountSide || '').toLowerCase() !== 'top'
        ) {
            return false
        }

        const overallHeight = Number(componentBody?.overallHeightMil)
        return (
            !Number.isFinite(overallHeight) ||
            overallHeight <= 0 ||
            Math.abs(offset) < overallHeight
        )
    }

    /**
     * Checks whether a positive shape-body standoff is part of an authored
     * stack instead of a model-origin quirk that should be seated on the board.
     * @param {object | null | undefined} componentBody Component-body row.
     * @param {object | null} matchedComponent Matched owner component.
     * @returns {boolean}
     */
    static #shouldPreservePositiveBodyStandoff(
        componentBody,
        matchedComponent
    ) {
        return (
            (!matchedComponent &&
                PcbScene3dBuilder.#isShapeBasedComponentBody(componentBody)) ||
            PcbScene3dBuilder.#hasAuthoredCoverStackStandoff(
                componentBody,
                matchedComponent
            )
        )
    }

    /**
     * Checks whether a positive standoff describes a real mechanical cover
     * stack instead of an embedded model source-origin air gap.
     * @param {object | null | undefined} componentBody Component-body row.
     * @param {object | null} matchedComponent Matched owner component.
     * @returns {boolean}
     */
    static #hasAuthoredCoverStackStandoff(componentBody, matchedComponent) {
        if (!matchedComponent || !componentBody?.embedded) {
            return false
        }

        const standoff = Number(componentBody?.standoffHeightMil)
        const overallHeight = Number(componentBody?.overallHeightMil)
        if (
            !Number.isFinite(standoff) ||
            !Number.isFinite(overallHeight) ||
            standoff <= 0 ||
            overallHeight <= standoff
        ) {
            return false
        }

        const identityText = [
            componentBody?.identifier,
            componentBody?.name,
            matchedComponent?.pattern,
            matchedComponent?.source
        ].join(' ')

        return PcbScene3dBuilder.#AUTHORED_COVER_STACK_IDENTITY_PATTERN.test(
            identityText
        )
    }

    /**
     * Checks whether one body row came from shape-based 3D body metadata.
     * @param {object | null | undefined} componentBody Component-body row.
     * @returns {boolean}
     */
    static #isShapeBasedComponentBody(componentBody) {
        return (
            String(componentBody?.sourceStream || '').includes(
                'ShapeBasedComponentBodies'
            ) ||
            Boolean(componentBody?.staticGeometry) ||
            Boolean(componentBody?.modelTypeName)
        )
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
     * @param {({ origin: string, name: string, format: string } | null)[]} resolvedBodyModels
     * @returns {({ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string } | null)[]}
     */
    static #resolveComponentBodyMatches(
        componentBodies,
        components,
        resolvedBodyModels
    ) {
        const matches = new Array(componentBodies.length).fill(null)
        const assignedBodyIndexes = new Set()
        const assignedComponentIndexes = new Set()
        const closeCandidates = []
        const matchContext = PcbScene3dBuilder.#buildBodyMatchContext(
            componentBodies,
            components,
            resolvedBodyModels
        )

        componentBodies.forEach((componentBody, bodyIndex) => {
            if (
                !PcbScene3dBuilder.#isMatchableComponentBody(
                    componentBody,
                    resolvedBodyModels,
                    bodyIndex
                )
            ) {
                return
            }

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
                    const affinityScore =
                        PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                            componentBody,
                            component
                        )
                    const sideCompatible =
                        PcbScene3dBuilder.#isBodyComponentSideCompatible(
                            componentBody,
                            component
                        )
                    const precise =
                        PcbScene3dBuilder.#isPreciseBodyComponentDistance(
                            distance
                        )

                    closeCandidates.push({
                        bodyIndex,
                        componentIndex,
                        affinityScore,
                        nearPackageAffinityScore:
                            PcbScene3dBuilder.#nearPackageAffinityScore(
                                componentBody,
                                affinityScore,
                                distance
                            ),
                        preciseOwnerScore:
                            precise && (sideCompatible || affinityScore > 0)
                                ? 1
                                : 0,
                        sideAffinityScore:
                            sideCompatible && affinityScore > 0 ? 1 : 0,
                        distance
                    })
                }
            })
        })

        closeCandidates
            .sort(
                (left, right) =>
                    right.nearPackageAffinityScore -
                        left.nearPackageAffinityScore ||
                    right.preciseOwnerScore - left.preciseOwnerScore ||
                    right.sideAffinityScore - left.sideAffinityScore ||
                    right.affinityScore - left.affinityScore ||
                    left.distance - right.distance
            )
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
            if (
                !PcbScene3dBuilder.#isMatchableComponentBody(
                    componentBody,
                    resolvedBodyModels,
                    bodyIndex
                )
            ) {
                return
            }

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

        PcbScene3dBuilder.#assignStaticShieldFrameBodyMatches(
            matches,
            componentBodies,
            components
        )

        return matches
    }

    /**
     * Assigns static shield-frame sub-bodies to their nearest shield-frame
     * component owner. These bodies are renderable without external models, so
     * the external-model ownership pass does not see them.
     * @param {({ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string } | null)[]} matches Mutable match array.
     * @param {{ identifier?: string, name?: string, layer?: string, positionMil?: { x?: number, y?: number }, staticGeometry?: object }[]} componentBodies Component bodies.
     * @param {{ designator: string, x: number, y: number, layer?: string, pattern?: string, source?: string, modelPath?: string }[]} components PCB components.
     */
    static #assignStaticShieldFrameBodyMatches(
        matches,
        componentBodies,
        components
    ) {
        const shieldFrameOwners = components.filter((component) =>
            PcbScene3dBuilder.#isMechanicalShieldFrameOwner(component)
        )

        if (!shieldFrameOwners.length) {
            return
        }

        const shieldFrameOwnerSet = new Set(shieldFrameOwners)

        componentBodies.forEach((componentBody, bodyIndex) => {
            if (!PcbScene3dBuilder.#isStaticShieldFrameBody(componentBody)) {
                return
            }

            const currentOwner = matches[bodyIndex]
            if (currentOwner && shieldFrameOwnerSet.has(currentOwner)) {
                return
            }

            let owner = null
            let ownerAffinityScore = -Infinity
            let ownerDistance = Infinity

            shieldFrameOwners.forEach((component) => {
                if (
                    !PcbScene3dBuilder.#isBodyComponentSideCompatible(
                        componentBody,
                        component
                    )
                ) {
                    return
                }

                const distance =
                    PcbScene3dBuilder.#distanceBetweenBodyAndComponent(
                        componentBody,
                        component
                    )

                if (
                    !Number.isFinite(distance) ||
                    distance >
                        PcbScene3dBuilder
                            .#MECHANICAL_SHIELD_FRAME_OWNER_RADIUS_MIL
                ) {
                    return
                }

                const affinityScore =
                    PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                        componentBody,
                        component
                    )
                const betterOwner =
                    affinityScore > ownerAffinityScore ||
                    (affinityScore === ownerAffinityScore &&
                        distance < ownerDistance)

                if (betterOwner) {
                    owner = component
                    ownerAffinityScore = affinityScore
                    ownerDistance = distance
                }
            })

            if (owner) {
                matches[bodyIndex] = owner
            }
        })
    }

    /**
     * Checks whether one component is a mechanical shield-frame owner.
     * @param {{ pattern?: string, source?: string, description?: string, parameters?: Record<string, unknown>, provenance?: Record<string, unknown> }} component Source component.
     * @returns {boolean}
     */
    static #isMechanicalShieldFrameOwner(component) {
        const identityTokens = PcbScene3dBuilder.#componentIdentityTokens(
            PcbScene3dBuilder.#componentIdentityText(component)
        )

        return (
            identityTokens.has('frame') &&
            PcbScene3dBuilder.#MECHANICAL_SHIELD_FRAME_OWNER_TOKENS.some(
                (token) => identityTokens.has(token)
            )
        )
    }

    /**
     * Splits component identity text into lowercase alphanumeric tokens.
     * @param {string} identityText Component identity text.
     * @returns {Set<string>}
     */
    static #componentIdentityTokens(identityText) {
        return new Set(
            String(identityText || '')
                .toLowerCase()
                .split(/[^a-z0-9]+/u)
                .filter(Boolean)
        )
    }

    /**
     * Checks whether one static body is a shield-frame sub-body.
     * @param {{ identifier?: string, name?: string, staticGeometry?: object }} componentBody Component body.
     * @returns {boolean}
     */
    static #isStaticShieldFrameBody(componentBody) {
        const geometry = componentBody?.staticGeometry || {}
        const completeGeometry =
            geometry.status === 'complete' &&
            Array.isArray(geometry.verticesMil) &&
            geometry.verticesMil.length >= 3
        const recoverableGeometry =
            geometry.status !== 'complete' && Number(geometry.heightMil) > 0

        return (
            String(geometry.kind || '').toLowerCase() === 'extruded-polygon' &&
            (completeGeometry || recoverableGeometry) &&
            PcbScene3dBuilder.#MECHANICAL_SHIELD_FRAME_BODY_PATTERN.test(
                [componentBody?.identifier, componentBody?.name]
                    .map((value) => String(value || ''))
                    .join(' ')
            )
        )
    }

    /**
     * Builds reusable identity statistics for body/component matching.
     * @param {{ modelId?: string, name?: string, identifier?: string }[]} componentBodies
     * @param {{ pattern?: string, source?: string, modelPath?: string }[]} components
     * @param {({ origin: string, name: string, format: string } | null)[]} resolvedBodyModels
     * @returns {{ bodyGroupCounts: Map<string, number>, candidateComponentCounts: Map<string, number> }}
     */
    static #buildBodyMatchContext(
        componentBodies,
        components,
        resolvedBodyModels
    ) {
        const bodyGroupCounts = new Map()
        const bodyByGroup = new Map()
        const candidateComponentCounts = new Map()

        componentBodies.forEach((componentBody, bodyIndex) => {
            if (
                !PcbScene3dBuilder.#isMatchableComponentBody(
                    componentBody,
                    resolvedBodyModels,
                    bodyIndex
                )
            ) {
                return
            }

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
        })

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
     * Returns true when one body row can participate in owner matching.
     * @param {object | null | undefined} componentBody Component body row.
     * @param {unknown[]} resolvedBodyModels Resolved body-model entries.
     * @param {number} bodyIndex Body index.
     * @returns {boolean}
     */
    static #isMatchableComponentBody(
        componentBody,
        resolvedBodyModels,
        bodyIndex
    ) {
        return (
            PcbScene3dBuilder.#isResolvableComponentBody(
                resolvedBodyModels,
                bodyIndex
            ) ||
            PcbScene3dBuilder.#isAnonymousLayerlessStaticBodyGeometry(
                componentBody
            )
        )
    }

    /**
     * Returns true when one body row can produce a renderable external model.
     * @param {unknown[]} resolvedBodyModels Resolved body-model entries.
     * @param {number} bodyIndex Body index.
     * @returns {boolean}
     */
    static #isResolvableComponentBody(resolvedBodyModels, bodyIndex) {
        return Boolean(
            Array.isArray(resolvedBodyModels)
                ? resolvedBodyModels[bodyIndex]
                : true
        )
    }

    /**
     * Checks whether one anonymous layerless body row already carries
     * renderable static geometry.
     * @param {object | null | undefined} componentBody Component body row.
     * @returns {boolean}
     */
    static #isAnonymousLayerlessStaticBodyGeometry(componentBody) {
        const identityText = [componentBody?.identifier, componentBody?.name]
            .map((value) => String(value || '').trim())
            .join('')

        return (
            identityText.length === 0 &&
            String(componentBody?.layer || '').trim().length === 0 &&
            Boolean(componentBody?.staticGeometry) &&
            String(componentBody.staticGeometry?.status || '').toLowerCase() ===
                'complete'
        )
    }

    /**
     * Returns true when the body/component anchors are close enough to be
     * considered an explicit placement match.
     * @param {number} distanceMil Body/component anchor distance in mil.
     * @returns {boolean}
     */
    static #isPreciseBodyComponentDistance(distanceMil) {
        return (
            Number(distanceMil) <=
            PcbScene3dBuilder.#PRECISE_BODY_MATCH_TOLERANCE_MIL
        )
    }

    /**
     * Checks whether the authored mechanical layer agrees with the component
     * layer. Unknown sides remain neutral so generic mechanical bodies can
     * still match from distance and identity.
     * @param {{ layer?: string }} componentBody Component-body record.
     * @param {{ layer?: string }} component Component record.
     * @returns {boolean}
     */
    static #isBodyComponentSideCompatible(componentBody, component) {
        const bodySide = PcbScene3dBuilder.#resolveMechanicalLayerSide(
            componentBody?.layer
        )
        const componentSide = PcbScene3dBuilder.#resolveComponentLayerSide(
            component?.layer
        )

        return !bodySide || !componentSide || bodySide === componentSide
    }

    /**
     * Resolves a component layer to a board side.
     * @param {string | undefined} layer Component layer.
     * @returns {'top' | 'bottom' | null}
     */
    static #resolveComponentLayerSide(layer) {
        const normalized = String(layer || '')
            .trim()
            .toUpperCase()

        if (!normalized) {
            return null
        }

        if (normalized.includes('BOTTOM') || normalized === 'BOT') {
            return 'bottom'
        }

        if (normalized.includes('TOP')) {
            return 'top'
        }

        return null
    }

    /**
     * Resolves common paired Altium mechanical layer numbers to a board side.
     * @param {string | undefined} layer Mechanical layer.
     * @returns {'top' | 'bottom' | null}
     */
    static #resolveMechanicalLayerSide(layer) {
        const match = String(layer || '').match(/^MECHANICAL\s*(\d+)$/i)
        if (!match) {
            return null
        }

        return Number(match[1]) % 2 === 0 ? 'bottom' : 'top'
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
        const affinityScore =
            PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                componentBody,
                component
            )
        const sideCompatible = PcbScene3dBuilder.#isBodyComponentSideCompatible(
            componentBody,
            component
        )

        if (PcbScene3dBuilder.#isPreciseBodyComponentDistance(distanceMil)) {
            if (!sideCompatible && affinityScore <= 0) {
                return false
            }

            return !PcbScene3dBuilder.#isIncompatiblePackageBodyMatch(
                componentBody,
                component,
                distanceMil
            )
        }

        if (affinityScore <= 0) {
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
     * Scores short-range package metadata matches above no-affinity anchors.
     * @param {{ name?: string, identifier?: string }} componentBody Component-body record.
     * @param {number} affinityScore Shared body/component identity score.
     * @param {number} distanceMil Body/component anchor distance.
     * @returns {number}
     */
    static #nearPackageAffinityScore(
        componentBody,
        affinityScore,
        distanceMil
    ) {
        return PcbScene3dBuilder.#isComponentPackageBody(componentBody) &&
            Number(affinityScore || 0) > 0 &&
            Number(distanceMil || 0) <=
                PcbScene3dBuilder.#NEAR_PACKAGE_AFFINITY_DISTANCE_MIL
            ? 1
            : 0
    }

    /**
     * Checks whether an unmatched package-like body should be suppressed
     * because it sits on an exact but incompatible component anchor.
     * @param {{ name?: string, identifier?: string, positionMil?: { x?: number, y?: number } }} componentBody Component-body record.
     * @param {{ x: number, y: number, pattern?: string, source?: string, modelPath?: string }[]} components PCB components.
     * @returns {boolean}
     */
    static #shouldDropUnmatchedPackageBody(componentBody, components) {
        if (
            !PcbScene3dBuilder.#isComponentPackageBody(componentBody) ||
            PcbScene3dBuilder.#isAuthoredBodyIdentity(componentBody)
        ) {
            return false
        }

        const exactComponents = (
            Array.isArray(components) ? components : []
        ).filter(
            (component) =>
                PcbScene3dBuilder.#distanceBetweenBodyAndComponent(
                    componentBody,
                    component
                ) <= PcbScene3dBuilder.#EXACT_BODY_MISMATCH_TOLERANCE_MIL
        )

        return (
            exactComponents.length > 0 &&
            exactComponents.every(
                (component) =>
                    PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                        componentBody,
                        component
                    ) <= 0
            )
        )
    }

    /**
     * Checks whether a package-like shape body is an unowned timing-stack
     * support body that is outside a matching carrier surface.
     * @param {object} componentBody Component-body record.
     * @param {object | null} matchedComponent Matched component.
     * @param {{ designator?: string, x?: number, y?: number, pattern?: string, source?: string, description?: string, provenance?: object, parameters?: object }[]} components PCB components.
     * @param {object[]} componentBodies All source component bodies.
     * @returns {boolean}
     */
    static #isPositiveTimingStackPackageBody(
        componentBody,
        matchedComponent,
        components,
        componentBodies
    ) {
        const standoff = Number(componentBody?.standoffHeightMil)
        const hasTimingOwner = matchedComponent
            ? PcbScene3dBuilder.#isTimingStackComponent(matchedComponent)
            : PcbScene3dBuilder.#hasNearbyTimingStackOwner(
                  componentBody,
                  components
              )
        const hasLocalComponentOwner =
            PcbScene3dBuilder.#hasNearbyNonTimingPackageOwner(
                componentBody,
                components
            )

        return (
            PcbScene3dBuilder.#isShapeBasedComponentBody(componentBody) &&
            componentBody?.embedded === true &&
            Number.isFinite(standoff) &&
            standoff > 0 &&
            PcbScene3dBuilder.#isComponentPackageBody(componentBody) &&
            !PcbScene3dBuilder.#isTimingStackBodyIdentity(componentBody) &&
            !PcbScene3dBuilder.#isAuthoredBodyIdentity(componentBody) &&
            hasTimingOwner &&
            !hasLocalComponentOwner &&
            !PcbScene3dBuilder.#isRaisedBodySeatedOnCarrier(
                componentBody,
                componentBodies
            )
        )
    }

    /**
     * Checks whether one raised body sits on a same-height authored carrier.
     * @param {{ standoffHeightMil?: number, positionMil?: { x?: number, y?: number } }} componentBody Raised component body.
     * @param {object[]} componentBodies All source component bodies.
     * @returns {boolean}
     */
    static #isRaisedBodySeatedOnCarrier(componentBody, componentBodies) {
        const standoff = Number(componentBody?.standoffHeightMil)
        if (!Number.isFinite(standoff) || standoff <= 0) {
            return false
        }

        return (Array.isArray(componentBodies) ? componentBodies : []).some(
            (candidate) =>
                candidate !== componentBody &&
                PcbScene3dBuilder.#shouldRenderStaticGeometryOnly(candidate) &&
                Math.abs(
                    Number(
                        candidate?.staticGeometry?.heightMil ??
                            candidate?.overallHeightMil ??
                            0
                    ) - standoff
                ) <= PcbScene3dBuilder.#TIMING_STACK_HEIGHT_TOLERANCE_MIL &&
                PcbScene3dBuilder.#carrierBoundsContainPoint(
                    candidate,
                    componentBody?.positionMil
                )
        )
    }

    /**
     * Checks whether a carrier polygon's source or local bounds contain a point.
     * @param {{ positionMil?: { x?: number, y?: number }, rotationDeg?: number, staticGeometry?: { verticesMil?: object[] } }} carrierBody Carrier body.
     * @param {{ x?: number, y?: number } | undefined} point Source point.
     * @returns {boolean}
     */
    static #carrierBoundsContainPoint(carrierBody, point) {
        const vertices = carrierBody?.staticGeometry?.verticesMil
        if (!Array.isArray(vertices) || vertices.length < 3) {
            return false
        }

        const sourcePoint = {
            x: Number(point?.x),
            y: Number(point?.y)
        }
        if (
            !Number.isFinite(sourcePoint.x) ||
            !Number.isFinite(sourcePoint.y)
        ) {
            return false
        }

        const anchor = {
            x: Number(carrierBody?.positionMil?.x || 0),
            y: Number(carrierBody?.positionMil?.y || 0)
        }
        const rotationRad =
            (-Number(carrierBody?.rotationDeg || 0) * Math.PI) / 180
        const dx = sourcePoint.x - anchor.x
        const dy = sourcePoint.y - anchor.y
        const localPoint = {
            x: dx * Math.cos(rotationRad) - dy * Math.sin(rotationRad),
            y: dx * Math.sin(rotationRad) + dy * Math.cos(rotationRad)
        }

        return (
            PcbScene3dBuilder.#boundsContainPoint(sourcePoint, vertices) ||
            PcbScene3dBuilder.#boundsContainPoint(localPoint, vertices)
        )
    }

    /**
     * Checks whether one axis-aligned vertex bounds contains a point.
     * @param {{ x: number, y: number }} point Candidate point.
     * @param {{ x?: number, y?: number }[]} vertices Bounds vertices.
     * @returns {boolean}
     */
    static #boundsContainPoint(point, vertices) {
        const points = vertices.map((vertex) => ({
            x: Number(vertex?.x || 0),
            y: Number(vertex?.y || 0)
        }))
        const xs = points.map((vertex) => vertex.x)
        const ys = points.map((vertex) => vertex.y)
        const tolerance =
            PcbScene3dBuilder.#TIMING_STACK_CARRIER_BOUNDS_TOLERANCE_MIL

        return (
            point.x >= Math.min(...xs) - tolerance &&
            point.x <= Math.max(...xs) + tolerance &&
            point.y >= Math.min(...ys) - tolerance &&
            point.y <= Math.max(...ys) + tolerance
        )
    }

    /**
     * Checks whether a shape-based sub-body is the actual timing package
     * rather than a passive support part inside the timing stack.
     * @param {{ name?: string, identifier?: string }} componentBody Component-body record.
     * @returns {boolean}
     */
    static #isTimingStackBodyIdentity(componentBody) {
        return PcbScene3dBuilder.#TIMING_STACK_COMPONENT_PATTERN.test(
            [componentBody?.identifier, componentBody?.name]
                .map((value) => String(value || ''))
                .join(' ')
        )
    }

    /**
     * Checks whether one package-like body is the authored timing package for
     * a timing-stack component.
     * @param {{ name?: string, identifier?: string }} componentBody Component-body record.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isTimingStackBodyComponentPair(componentBody, component) {
        return (
            PcbScene3dBuilder.#isTimingStackBodyIdentity(componentBody) &&
            PcbScene3dBuilder.#isTimingStackComponent(component)
        )
    }

    /**
     * Checks whether a positive package body has its own nearby non-timing
     * component and should not be treated as an unowned timing-stack detail.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component-body record.
     * @param {object[]} components PCB components.
     * @returns {boolean}
     */
    static #hasNearbyNonTimingPackageOwner(componentBody, components) {
        return (Array.isArray(components) ? components : []).some(
            (component) =>
                !PcbScene3dBuilder.#isTimingStackComponent(component) &&
                PcbScene3dBuilder.#distanceBetweenBodyAndComponent(
                    componentBody,
                    component
                ) <= PcbScene3dBuilder.#EXACT_BODY_MISMATCH_TOLERANCE_MIL &&
                PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                    componentBody,
                    component
                ) > 0
        )
    }

    /**
     * Checks whether an unmatched body sits inside a timing-package stack.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Component-body record.
     * @param {object[]} components PCB components.
     * @returns {boolean}
     */
    static #hasNearbyTimingStackOwner(componentBody, components) {
        return (Array.isArray(components) ? components : []).some(
            (component) =>
                PcbScene3dBuilder.#isTimingStackComponent(component) &&
                PcbScene3dBuilder.#distanceBetweenBodyAndComponent(
                    componentBody,
                    component
                ) <= PcbScene3dBuilder.#TIMING_STACK_BODY_RADIUS_MIL
        )
    }

    /**
     * Checks whether one component is a timing-package stack owner.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isTimingStackComponent(component) {
        const designator = String(component?.designator || '').trim()
        if (
            PcbScene3dBuilder.#TIMING_STACK_DESIGNATOR_PATTERN.test(designator)
        ) {
            return true
        }

        return PcbScene3dBuilder.#TIMING_STACK_COMPONENT_PATTERN.test(
            [
                component?.pattern,
                component?.source,
                component?.description,
                component?.provenance?.footprintDescription,
                ...Object.values(component?.parameters || {})
            ]
                .map((value) => String(value || ''))
                .join(' ')
        )
    }

    /**
     * Checks whether a body already has complete static geometry and should
     * not also be emitted as an external model placement.
     * @param {{ embedded?: boolean, staticGeometry?: { status?: string } }} componentBody Component-body record.
     * @returns {boolean}
     */
    static #shouldRenderStaticGeometryOnly(componentBody) {
        return (
            PcbScene3dBuilder.#isShapeBasedComponentBody(componentBody) &&
            !componentBody?.embedded &&
            String(
                componentBody?.staticGeometry?.status || ''
            ).toLowerCase() === 'complete'
        )
    }

    /**
     * Checks whether a precise body/component pair is a package-family mismatch.
     * @param {{ name?: string, identifier?: string }} componentBody Component-body record.
     * @param {{ pattern?: string, source?: string, modelPath?: string }} component PCB component.
     * @param {number} distanceMil Body/component anchor distance.
     * @returns {boolean}
     */
    static #isIncompatiblePackageBodyMatch(
        componentBody,
        component,
        distanceMil
    ) {
        return (
            Number(distanceMil || 0) <=
                PcbScene3dBuilder.#EXACT_BODY_MISMATCH_TOLERANCE_MIL &&
            PcbScene3dBuilder.#isComponentPackageBody(componentBody) &&
            !PcbScene3dBuilder.#isTimingStackBodyComponentPair(
                componentBody,
                component
            ) &&
            !PcbScene3dBuilder.#isAuthoredBodyIdentity(componentBody) &&
            PcbScene3dPlacementSideResolver.scoreBodyComponentAffinity(
                componentBody,
                component
            ) <= 0
        )
    }

    /**
     * Checks whether a component body names a package model rather than an
     * authored board mechanical.
     * @param {{ name?: string, identifier?: string }} componentBody Component-body record.
     * @returns {boolean}
     */
    static #isComponentPackageBody(componentBody) {
        return PcbScene3dBuilder.#COMPONENT_PACKAGE_BODY_PATTERN.test(
            PcbScene3dBuilder.#componentBodyIdentityText(componentBody)
        )
    }

    /**
     * Checks whether a component body identity describes an authored hardware
     * or connector anchor that can legitimately sit away from a footprint
     * center.
     * @param {{ name?: string, identifier?: string }} componentBody Component-body record.
     * @returns {boolean}
     */
    static #isAuthoredBodyIdentity(componentBody) {
        return PcbScene3dBuilder.#AUTHORED_BODY_IDENTITY_PATTERN.test(
            PcbScene3dBuilder.#componentBodyIdentityText(componentBody)
        )
    }

    /**
     * Checks whether a layerless component body is a footprint-library
     * placeholder rather than a board-side placement.
     * @param {{ layer?: string, name?: string, identifier?: string, modelId?: string, checksum?: number | null, positionMil?: { x?: number, y?: number } }} componentBody Component body record.
     * @param {object[]} componentBodies All component body records.
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number }} board Board envelope.
     * @returns {boolean}
     */
    static #shouldSuppressLayerlessBodyPlaceholder(
        componentBody,
        componentBodies,
        board
    ) {
        if (
            !PcbScene3dBuilder.#isLayerlessComponentBody(componentBody) ||
            PcbScene3dBuilder.#isAuthoredBodyIdentity(componentBody)
        ) {
            return false
        }

        return (
            !PcbScene3dBuilder.#isBodyPositionNearBoard(componentBody, board) ||
            PcbScene3dBuilder.#hasLayeredEquivalentPackageBody(
                componentBody,
                componentBodies
            )
        )
    }

    /**
     * Checks whether a body lacks an authored mechanical layer.
     * @param {{ layer?: string }} componentBody Component body record.
     * @returns {boolean}
     */
    static #isLayerlessComponentBody(componentBody) {
        return String(componentBody?.layer || '').trim() === ''
    }

    /**
     * Checks whether a layerless body duplicates a real board-side body.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Candidate layerless body.
     * @param {object[]} componentBodies All component body records.
     * @returns {boolean}
     */
    static #hasLayeredEquivalentPackageBody(componentBody, componentBodies) {
        return (Array.isArray(componentBodies) ? componentBodies : []).some(
            (candidate) =>
                candidate !== componentBody &&
                !PcbScene3dBuilder.#isLayerlessComponentBody(candidate) &&
                PcbScene3dBuilder.#componentBodiesShareModelIdentity(
                    componentBody,
                    candidate
                ) &&
                PcbScene3dBuilder.#distanceBetweenBodies(
                    componentBody,
                    candidate
                ) <= PcbScene3dBuilder.#EXACT_BODY_MISMATCH_TOLERANCE_MIL
        )
    }

    /**
     * Checks whether two component bodies refer to the same external package.
     * @param {{ name?: string, identifier?: string, modelId?: string, checksum?: number | null }} left First body.
     * @param {{ name?: string, identifier?: string, modelId?: string, checksum?: number | null }} right Second body.
     * @returns {boolean}
     */
    static #componentBodiesShareModelIdentity(left, right) {
        const leftModelId = PcbScene3dBuilder.#normalizeIdentityToken(
            left?.modelId
        )
        const rightModelId = PcbScene3dBuilder.#normalizeIdentityToken(
            right?.modelId
        )
        if (leftModelId && rightModelId && leftModelId === rightModelId) {
            return true
        }

        const leftChecksum = Number(left?.checksum)
        const rightChecksum = Number(right?.checksum)
        if (
            Number.isFinite(leftChecksum) &&
            Number.isFinite(rightChecksum) &&
            leftChecksum === rightChecksum
        ) {
            return true
        }

        const leftName = PcbScene3dBuilder.#normalizeBodyNameToken(left)
        const rightName = PcbScene3dBuilder.#normalizeBodyNameToken(right)

        return Boolean(leftName && rightName && leftName === rightName)
    }

    /**
     * Normalizes a body model name or identifier for duplicate detection.
     * @param {{ name?: string, identifier?: string }} componentBody Component body.
     * @returns {string}
     */
    static #normalizeBodyNameToken(componentBody) {
        return PcbScene3dBuilder.#normalizeIdentityToken(
            componentBody?.name || componentBody?.identifier
        ).replace(/\.[a-z0-9]+$/i, '')
    }

    /**
     * Normalizes an identity token for case-insensitive comparisons.
     * @param {unknown} value Raw token.
     * @returns {string}
     */
    static #normalizeIdentityToken(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
    }

    /**
     * Builds searchable identity text for one component body.
     * @param {{ name?: string, identifier?: string, modelId?: string }} componentBody Component-body record.
     * @returns {string}
     */
    static #componentBodyIdentityText(componentBody) {
        return [
            componentBody?.identifier,
            componentBody?.name,
            componentBody?.modelId
        ]
            .map((value) => String(value || ''))
            .join(' ')
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
     * @param {{ modelRotationDeg?: { x?: number, y?: number, z?: number } }} componentBody Component body.
     * @param {{ componentIndex?: number, layer?: string } | null} matchedComponent Matched component.
     * @param {object[]} pads PCB pads.
     * @param {'top' | 'bottom'} mountSide Placement mount side.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolveExternalModelRotation(
        componentBody,
        matchedComponent,
        pads,
        mountSide
    ) {
        const rotation = {
            x: -Number(componentBody?.modelRotationDeg?.x || 0),
            y: -Number(componentBody?.modelRotationDeg?.y || 0),
            z: 0
        }

        if (
            mountSide === 'bottom' &&
            PcbScene3dBuilder.#normalizeAngle(rotation.x) === 180 &&
            !AltiumScene3dBottomSourceHalfTurnPolicy.shouldPreserve({
                component: matchedComponent,
                componentBody,
                modelTransform: { rotationDeg: rotation }
            }) &&
            !PcbScene3dBuilder.#componentHasThroughHolePads(
                matchedComponent,
                pads
            )
        ) {
            rotation.x = 0
        }

        return rotation
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
                    PcbScene3dBuilder.#includesLayerName(layer?.name, needle)
                )
                .map((layer) => Number(layer.layerId))
                .filter((layerId) => Number.isInteger(layerId))
        )
    }

    /**
     * Returns true when one layer name matches a spaced or compact target.
     * @param {string} layerName
     * @param {string} needle
     * @returns {boolean}
     */
    static #includesLayerName(layerName, needle) {
        return PcbScene3dBuilder.#compactLayerName(layerName).includes(
            PcbScene3dBuilder.#compactLayerName(needle)
        )
    }

    /**
     * Normalizes layer labels so compact names such as TopOverlay match
     * spaced Altium labels such as Top Overlay.
     * @param {string} layerName
     * @returns {string}
     */
    static #compactLayerName(layerName) {
        return String(layerName || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
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
     * Resolves the owned or nearby pad-span box around one component.
     * @param {{ x: number, y: number, componentIndex?: number, layer?: string, rotation?: number }} component
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }[]} pads
     * @param {number} [rotationDeg] Body-local rotation used for span measurement.
     * @returns {{ width: number, depth: number }}
     */
    static #resolvePadSpan(
        component,
        pads,
        rotationDeg = Number(component?.rotation || 0)
    ) {
        const componentPads = PcbScene3dBuilder.#componentPads(component, pads)
        const nearbyPads = pads.filter((pad) =>
            PcbScene3dBuilder.#isPadNearComponent(component, pad)
        )
        const spanPads = componentPads.length ? componentPads : nearbyPads

        if (!spanPads.length) {
            return { width: 0, depth: 0 }
        }

        const mountSide = PcbScene3dBuilder.#resolveMountSide(component)
        return (
            PcbScene3dPadLocalSpanResolver.resolve(
                { ...component, rotation: rotationDeg },
                spanPads,
                mountSide
            ) || { width: 0, depth: 0 }
        )
    }

    /**
     * Resolves the visible procedural component rotation.
     * @param {{ componentIndex?: number, rotation?: number }} component PCB component.
     * @param {object[]} pads PCB pads.
     * @param {string} mountSide Component mount side.
     * @returns {number}
     */
    static #resolveComponentRotation(component, pads, mountSide) {
        return (
            PcbScene3dPadYawResolver.resolve(component, pads, mountSide) ??
            Number(component?.rotation || 0)
        )
    }

    /**
     * Resolves a component owner when an external body anchor sits on a drilled
     * pad owned by that component.
     * @param {{ x?: number, y?: number } | null | undefined} sourcePosition External body anchor.
     * @param {{ componentIndex?: number, x?: number, y?: number }[]} components PCB components.
     * @param {object[]} pads PCB pads.
     * @returns {object | null}
     */
    static #resolveComponentFromOwnedDrilledPad(
        sourcePosition,
        components,
        pads
    ) {
        const sourceX = Number(sourcePosition?.x)
        const sourceY = Number(sourcePosition?.y)
        if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
            return null
        }

        const candidates = (Array.isArray(components) ? components : [])
            .flatMap((component) =>
                PcbScene3dBuilder.#componentPads(component, pads)
                    .filter((pad) =>
                        PcbScene3dBuilder.#hasDrilledPadOpening(pad)
                    )
                    .map((pad) => ({
                        component,
                        padDistance: PcbScene3dBuilder.#distanceToPadAnchor(
                            { x: sourceX, y: sourceY },
                            pad
                        ),
                        componentDistance: Math.hypot(
                            Number(component?.x || 0) - sourceX,
                            Number(component?.y || 0) - sourceY
                        )
                    }))
            )
            .filter(
                (candidate) =>
                    candidate.padDistance <=
                    PcbScene3dBuilder.#EXACT_BODY_MISMATCH_TOLERANCE_MIL
            )
            .sort(
                (left, right) =>
                    left.padDistance - right.padDistance ||
                    left.componentDistance - right.componentDistance
            )

        return candidates[0]?.component || null
    }

    /**
     * Measures the distance from a source point to a drilled pad's effective
     * anchor area.
     * @param {{ x: number, y: number }} sourcePosition External body anchor.
     * @param {object} pad PCB pad.
     * @returns {number}
     */
    static #distanceToPadAnchor(sourcePosition, pad) {
        const centerDistance = Math.hypot(
            Number(pad?.x || 0) - Number(sourcePosition.x || 0),
            Number(pad?.y || 0) - Number(sourcePosition.y || 0)
        )
        const radius = PcbScene3dBuilder.#padAnchorRadiusMil(pad)

        return radius > 0
            ? Math.max(0, centerDistance - radius)
            : Number.POSITIVE_INFINITY
    }

    /**
     * Resolves the effective XY radius around a drilled pad center.
     * @param {object} pad PCB pad.
     * @returns {number}
     */
    static #padAnchorRadiusMil(pad) {
        const holeGeometry = pad?.holeGeometry || {}
        const diameter = Math.max(
            Number(pad?.sizeTopX || 0),
            Number(pad?.sizeTopY || 0),
            Number(pad?.sizeMidX || 0),
            Number(pad?.sizeMidY || 0),
            Number(pad?.sizeBottomX || 0),
            Number(pad?.sizeBottomY || 0),
            Number(pad?.holeDiameter || 0),
            Number(pad?.drillDiameter || 0),
            Number(pad?.holeSlotLength || 0),
            Number(pad?.slotLength || 0),
            Number(holeGeometry?.diameter || 0),
            Number(holeGeometry?.length || 0),
            Number(holeGeometry?.slotLength || 0)
        )

        return Number.isFinite(diameter) && diameter > 0 ? diameter / 2 : 0
    }

    /**
     * Checks whether a component owns drilled or slotted pads.
     * @param {{ componentIndex?: number, layer?: string } | null} component PCB component.
     * @param {object[]} pads PCB pads.
     * @returns {boolean}
     */
    static #componentHasThroughHolePads(component, pads) {
        return PcbScene3dBuilder.#componentPads(component, pads).some((pad) =>
            PcbScene3dBuilder.#hasDrilledPadOpening(pad)
        )
    }

    /**
     * Resolves pads explicitly owned by one component, preferring pads on the
     * mounted surface when paste-mask side metadata is available.
     * @param {{ componentIndex?: number, layer?: string }} component PCB component.
     * @param {object[]} pads PCB pads.
     * @returns {object[]}
     */
    static #componentPads(component, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return []
        }

        const ownedPads = pads.filter(
            (pad) => Number(pad?.componentIndex) === componentIndex
        )
        const mountSide = PcbScene3dBuilder.#resolveMountSide(component)
        const surfacePads = ownedPads.filter((pad) =>
            PcbScene3dBuilder.#isSurfacePad(pad, mountSide)
        )

        return surfacePads.length ? surfacePads : ownedPads
    }

    /**
     * Checks whether one pad belongs to the requested component surface.
     * @param {object} pad PCB pad.
     * @param {'top' | 'bottom'} mountSide Component mount side.
     * @returns {boolean}
     */
    static #isSurfacePad(pad, mountSide) {
        return mountSide === 'bottom'
            ? Boolean(pad?.hasBottomPasteMaskOpening)
            : Boolean(pad?.hasTopPasteMaskOpening)
    }

    /**
     * Checks whether one pad contains a drilled or slotted board opening.
     * @param {object} pad PCB pad.
     * @returns {boolean}
     */
    static #hasDrilledPadOpening(pad) {
        const holeGeometry = pad?.holeGeometry || {}

        return [
            pad?.holeDiameter,
            pad?.drillDiameter,
            pad?.holeSlotLength,
            pad?.slotLength,
            holeGeometry?.diameter,
            holeGeometry?.length,
            holeGeometry?.slotLength
        ].some((value) => Number(value || 0) > 0)
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
     * Resolves the PCB surface a component is mounted on.
     * @param {{ layer?: string }} component PCB component.
     * @returns {'top' | 'bottom'}
     */
    static #resolveMountSide(component) {
        return String(component?.layer || 'TOP').toUpperCase() === 'BOTTOM'
            ? 'bottom'
            : 'top'
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
     * Returns the euclidean distance between two component body anchors.
     * @param {{ positionMil?: { x?: number, y?: number } }} left First body.
     * @param {{ positionMil?: { x?: number, y?: number } }} right Second body.
     * @returns {number}
     */
    static #distanceBetweenBodies(left, right) {
        return Math.hypot(
            Number(left?.positionMil?.x || 0) -
                Number(right?.positionMil?.x || 0),
            Number(left?.positionMil?.y || 0) -
                Number(right?.positionMil?.y || 0)
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
