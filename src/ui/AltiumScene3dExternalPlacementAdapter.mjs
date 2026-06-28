import { AltiumScene3dIdentityTokens } from './AltiumScene3dIdentityTokens.mjs'
import { AltiumScene3dAuthoredConnectorYawPolicy } from './AltiumScene3dAuthoredConnectorYawPolicy.mjs'
import { AltiumScene3dPlacementRotationPolicy } from './AltiumScene3dPlacementRotationPolicy.mjs'
import { AltiumScene3dRepeatedModelOwnerRepair } from './AltiumScene3dRepeatedModelOwnerRepair.mjs'
import { AltiumScene3dBottomSourceHalfTurnPolicy } from './AltiumScene3dBottomSourceHalfTurnPolicy.mjs'

/**
 * Repairs Altium explicit 3D body placements after toolkit scene conversion.
 */
export class AltiumScene3dExternalPlacementAdapter {
    static #EXACT_ANCHOR_TOLERANCE_MIL = 5
    static #NEAR_ANCHOR_TOLERANCE_MIL = 20
    static #FAR_OWNER_DISTANCE_MIL = 100
    static #MODEL_ANCHOR_NEAR_OWNER_TOLERANCE_MIL = 35
    static #MODEL_ANCHOR_PAD_PROXIMITY_TOLERANCE_MIL = 10
    static #MODEL_ANCHOR_METADATA_PROXIMITY_MIL = 350
    static #DEFAULT_BOARD_THICKNESS_MIL = 63
    static #PASSIVE_BODY_PATTERN =
        /(?:^|[^a-z0-9])(?:cap|capacitor|res|resistor|ind|inductor|ferrite|bead|crystal|xtal|lqw|lqg)(?:$|[^a-z0-9])/i
    static #MECHANICAL_OWNER_PATTERN =
        /(?:^|[^a-z0-9])(?:mech|mechanical|shield|frame|cover|hardware)(?:$|[^a-z0-9])/i
    static #MODEL_ANCHOR_OWNER_PATTERN =
        /(?:pin\s*header|pinheader|header|connector|socket|fpc|flex|jtag)/i

    /**
     * Applies exact-anchor repairs to Altium external 3D placements.
     * @param {object} sceneDescription Built scene description.
     * @param {object} documentModel Source document model.
     * @returns {object}
     */
    static apply(sceneDescription, documentModel) {
        if (
            String(sceneDescription?.sourceFormat || '').toLowerCase() !==
                'altium' ||
            !Array.isArray(sceneDescription?.externalPlacements)
        ) {
            return sceneDescription
        }

        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        const pads = Array.isArray(documentModel?.pcb?.pads)
            ? documentModel.pcb.pads
            : []
        const componentBodies = Array.isArray(
            documentModel?.pcb?.componentBodies
        )
            ? documentModel.pcb.componentBodies
            : []
        if (!components.length) {
            return sceneDescription
        }

        const componentByDesignator = new Map(
            components.map((component) => [
                String(component?.designator || ''),
                component
            ])
        )

        const repairedScene = {
            ...sceneDescription,
            externalPlacements: sceneDescription.externalPlacements
                .map((placement) =>
                    AltiumScene3dExternalPlacementAdapter.#repairPlacement(
                        placement,
                        components,
                        componentByDesignator,
                        componentBodies,
                        pads,
                        sceneDescription?.board
                    )
                )
                .filter(Boolean)
        }

        return AltiumScene3dRepeatedModelOwnerRepair.apply(
            repairedScene,
            documentModel
        )
    }

    /** Repairs one placement when a weak name match displaced an anchor. */
    static #repairPlacement(
        placement,
        components,
        componentByDesignator,
        componentBodies,
        pads,
        board
    ) {
        if (!placement?.bodyPositionMil || !placement?.positionMil) {
            return placement
        }
        if (
            AltiumScene3dExternalPlacementAdapter.#isAuthoredShapeStackPlacement(
                placement
            )
        ) {
            return placement
        }

        const componentBody =
            AltiumScene3dExternalPlacementAdapter.#resolveComponentBody(
                placement,
                componentBodies
            )
        const currentComponent = componentByDesignator.get(
            String(placement?.designator || '')
        )
        const currentDistance = currentComponent
            ? AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                  placement,
                  currentComponent
              )
            : Number.POSITIVE_INFINITY
        const currentHasOwnedDrilledPadAnchor = currentComponent
            ? AltiumScene3dExternalPlacementAdapter.#distanceToNearestOwnedPad(
                  placement,
                  currentComponent,
                  pads
              ) <=
              AltiumScene3dExternalPlacementAdapter
                  .#MODEL_ANCHOR_PAD_PROXIMITY_TOLERANCE_MIL
            : false
        const currentHasMetadataAffinity = currentComponent
            ? AltiumScene3dExternalPlacementAdapter.#hasMetadataAffinity(
                  placement,
                  componentBody,
                  currentComponent
              )
            : false
        const currentHasPartCodeAffinity = currentComponent
            ? AltiumScene3dExternalPlacementAdapter.#hasPartCodeAffinity(
                  placement,
                  componentBody,
                  currentComponent
              )
            : false
        const currentIsMechanicalOwner =
            currentComponent &&
            AltiumScene3dExternalPlacementAdapter.#MECHANICAL_OWNER_PATTERN.test(
                AltiumScene3dExternalPlacementAdapter.#packageIdentityText(
                    currentComponent,
                    componentBody
                )
            )
        const exactComponent =
            AltiumScene3dExternalPlacementAdapter.#resolveAnchorComponent(
                placement,
                currentComponent,
                components,
                currentHasMetadataAffinity,
                currentHasPartCodeAffinity,
                componentBody,
                pads
            )
        const isExactAnchoredOwner =
            (currentComponent &&
                currentDistance <=
                    AltiumScene3dExternalPlacementAdapter
                        .#EXACT_ANCHOR_TOLERANCE_MIL) ||
            currentHasOwnedDrilledPadAnchor ||
            (exactComponent &&
                AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                    placement,
                    exactComponent
                ) <=
                    AltiumScene3dExternalPlacementAdapter
                        .#EXACT_ANCHOR_TOLERANCE_MIL)
        const isFarCurrentOwner =
            currentComponent &&
            !currentHasOwnedDrilledPadAnchor &&
            currentDistance >
                AltiumScene3dExternalPlacementAdapter.#FAR_OWNER_DISTANCE_MIL
        const metadataComponent =
            !exactComponent &&
            (!currentComponent ||
                (isFarCurrentOwner && !currentHasPartCodeAffinity))
                ? AltiumScene3dExternalPlacementAdapter.#resolveMetadataComponent(
                      placement,
                      componentBody,
                      components
                  )
                : null

        if (
            isFarCurrentOwner &&
            !exactComponent &&
            !metadataComponent &&
            !currentHasMetadataAffinity &&
            !currentIsMechanicalOwner
        ) {
            return null
        }

        const resolvedComponent =
            exactComponent || metadataComponent || currentComponent
        const mountSide = resolvedComponent
            ? AltiumScene3dExternalPlacementAdapter.#resolveComponentMountSide(
                  resolvedComponent
              ) || placement.mountSide
            : placement.mountSide
        const shouldCenterResolvedModelAnchor =
            AltiumScene3dExternalPlacementAdapter.#shouldCenterResolvedModelAnchor(
                placement,
                resolvedComponent,
                componentBody,
                pads
            )
        const ownerAnchorOffset = shouldCenterResolvedModelAnchor
            ? AltiumScene3dExternalPlacementAdapter.#ownerAnchorOffset(
                  placement,
                  resolvedComponent
              )
            : null
        const nextPlacement =
            exactComponent || metadataComponent
                ? {
                      ...placement,
                      designator: String(
                          resolvedComponent?.designator || placement.designator
                      ),
                      mountSide,
                      positionMil: {
                          ...placement.positionMil,
                          ...(shouldCenterResolvedModelAnchor
                              ? AltiumScene3dExternalPlacementAdapter.#ownerPositionMil(
                                    resolvedComponent,
                                    board
                                )
                              : {}),
                          z: AltiumScene3dExternalPlacementAdapter.#resolveFaceZ(
                              mountSide,
                              board
                          )
                      },
                      modelTransform: shouldCenterResolvedModelAnchor
                          ? AltiumScene3dExternalPlacementAdapter.#withRenderableOwnerAnchorOffset(
                                placement,
                                ownerAnchorOffset
                            )
                          : placement.modelTransform
                  }
                : placement
        const shouldPreserveAuthoredConnectorYaw =
            AltiumScene3dAuthoredConnectorYawPolicy.shouldPreserve({
                placement: nextPlacement,
                component: resolvedComponent,
                pads,
                ownerOffsetToleranceMil:
                    AltiumScene3dExternalPlacementAdapter
                        .#MODEL_ANCHOR_NEAR_OWNER_TOLERANCE_MIL
            })
        const shouldUseComponentYaw =
            !shouldPreserveAuthoredConnectorYaw &&
            (Boolean(metadataComponent && !exactComponent) ||
                Boolean(
                    !exactComponent &&
                    isFarCurrentOwner &&
                    currentHasMetadataAffinity &&
                    !currentIsMechanicalOwner
                ))
        const rotationContext = {
            placement: nextPlacement,
            component: resolvedComponent,
            componentBody,
            pads,
            isExactAnchoredOwner
        }
        const footprintYaw =
            AltiumScene3dPlacementRotationPolicy.resolveFootprintYaw(
                rotationContext
            )

        const repairedPlacement =
            AltiumScene3dExternalPlacementAdapter.#repairRotation(
                nextPlacement,
                resolvedComponent,
                componentBody,
                shouldUseComponentYaw,
                AltiumScene3dPlacementRotationPolicy.shouldCorrectYaw(
                    rotationContext
                ),
                footprintYaw,
                AltiumScene3dPlacementRotationPolicy.shouldMirrorSourceZ(
                    rotationContext
                ),
                pads
            )

        return AltiumScene3dExternalPlacementAdapter.#withContactPadHints(
            repairedPlacement,
            resolvedComponent,
            pads,
            board
        )
    }

    /** Adds pad contact hints for mixed SMT/mechanical connector footprints. */
    static #withContactPadHints(placement, component, pads, board) {
        const contactPads =
            AltiumScene3dExternalPlacementAdapter.#resolveContactPads(
                placement,
                component,
                pads,
                board
            )
        if (!contactPads.length) {
            return placement
        }

        return {
            ...placement,
            modelTransform: {
                ...(placement?.modelTransform || {}),
                contactPadsMil: contactPads
            }
        }
    }

    /**
     * Checks whether an earlier adapter already resolved an authored carrier
     * stack placement.
     * @param {object} placement External model placement.
     * @returns {boolean}
     */
    static #isAuthoredShapeStackPlacement(placement) {
        return (
            String(placement?.projection?.source || '').toLowerCase() ===
            'authored-shape-stack'
        )
    }

    /**
     * Resolves board-local SMT pad centers for mixed connector footprints.
     * @param {object} placement External model placement.
     * @param {object | null | undefined} component Owning component.
     * @param {object[]} pads Source PCB pads.
     * @param {object} board Scene board metadata.
     * @returns {{ x: number, y: number, width: number, depth: number }[]}
     */
    static #resolveContactPads(placement, component, pads, board) {
        if (
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            String(placement?.projection?.source || '') !==
                'model-anchor-fallback'
        ) {
            return []
        }

        const componentPads =
            AltiumScene3dExternalPlacementAdapter.#componentPads(
                component,
                pads
            )
        const surfacePads = componentPads.filter((pad) =>
            AltiumScene3dExternalPlacementAdapter.#isTopSurfacePad(pad)
        )
        const mechanicalPads = componentPads.filter((pad) =>
            AltiumScene3dExternalPlacementAdapter.#isMechanicalAnchorPad(pad)
        )
        if (surfacePads.length < 2 || !mechanicalPads.length) {
            return []
        }

        const centerX = Number(board?.centerX || 0)
        const centerY = Number(board?.centerY || 0)

        return surfacePads
            .map((pad) => ({
                x: Number(pad?.x || 0) - centerX,
                y: Number(pad?.y || 0) - centerY,
                width: Number(pad?.sizeTopX || pad?.sizeMidX || 0),
                depth: Number(pad?.sizeTopY || pad?.sizeMidY || 0)
            }))
            .filter(
                (pad) =>
                    Number.isFinite(pad.x) &&
                    Number.isFinite(pad.y) &&
                    pad.width > 0 &&
                    pad.depth > 0
            )
    }

    /**
     * Returns pads owned by one component index.
     * @param {object} component Owning component.
     * @param {object[]} pads Source PCB pads.
     * @returns {object[]}
     */
    static #componentPads(component, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return []
        }

        return (Array.isArray(pads) ? pads : []).filter(
            (pad) => Number(pad?.componentIndex) === componentIndex
        )
    }

    /**
     * Checks whether a component owns drilled or slotted pads.
     * @param {object | null | undefined} component Owning component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #componentHasThroughHolePads(component, pads) {
        return AltiumScene3dExternalPlacementAdapter.#componentPads(
            component,
            pads
        ).some((pad) =>
            AltiumScene3dExternalPlacementAdapter.#hasDrilledPadOpening(pad)
        )
    }

    /**
     * Checks whether one pad contains a drilled or slotted board opening.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #hasDrilledPadOpening(pad) {
        const holeGeometry = pad?.holeGeometry || {}

        return [
            pad?.holeDiameter,
            pad?.drillDiameter,
            pad?.holeSize,
            pad?.holeSlotLength,
            pad?.slotLength,
            holeGeometry?.diameter,
            holeGeometry?.length,
            holeGeometry?.slotLength
        ].some((value) => Number(value || 0) > 0)
    }

    /**
     * Checks whether a pad exposes top paste and should be soldered on the
     * top face.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #isTopSurfacePad(pad) {
        return (
            Boolean(pad?.hasTopPasteMaskOpening) &&
            Number(pad?.sizeTopX || 0) > 0 &&
            Number(pad?.sizeTopY || 0) > 0
        )
    }

    /**
     * Checks whether a pad is a non-paste mechanical lock or guide.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #isMechanicalAnchorPad(pad) {
        return (
            !pad?.hasTopPasteMaskOpening &&
            (Number(pad?.holeSize || 0) > 0 ||
                Number(pad?.holeShape || 0) > 0 ||
                Number(pad?.layerCode || 0) > 16)
        )
    }

    /**
     * Resolves an anchor component only when the current owner is not close.
     * @param {object} placement External model placement.
     * @param {object | undefined} currentComponent Current matched component.
     * @param {object[]} components PCB components.
     * @param {boolean} currentHasMetadataAffinity Whether source metadata confirms the current owner.
     * @param {boolean} currentHasPartCodeAffinity Whether a strong part code confirms the current owner.
     * @param {object | null} componentBody Source component body.
     * @param {object[]} pads Source PCB pads.
     * @returns {object | null}
     */
    static #resolveAnchorComponent(
        placement,
        currentComponent,
        components,
        currentHasMetadataAffinity,
        currentHasPartCodeAffinity,
        componentBody,
        pads
    ) {
        const currentDistance = currentComponent
            ? AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                  placement,
                  currentComponent
              )
            : Number.POSITIVE_INFINITY
        if (
            currentComponent &&
            currentDistance <=
                AltiumScene3dExternalPlacementAdapter
                    .#EXACT_ANCHOR_TOLERANCE_MIL
        ) {
            return null
        }

        const exactComponent =
            AltiumScene3dExternalPlacementAdapter.#nearestAnchorComponent(
                placement,
                components,
                AltiumScene3dExternalPlacementAdapter
                    .#EXACT_ANCHOR_TOLERANCE_MIL
            )
        if (exactComponent) {
            if (
                currentHasMetadataAffinity &&
                !AltiumScene3dExternalPlacementAdapter.#isGenericPassiveComponent(
                    currentComponent
                ) &&
                AltiumScene3dExternalPlacementAdapter.#isGenericPassiveComponent(
                    exactComponent
                ) &&
                AltiumScene3dExternalPlacementAdapter.#metadataScore(
                    AltiumScene3dExternalPlacementAdapter.#bodyIdentityTokens(
                        placement,
                        componentBody
                    ),
                    exactComponent
                ) === 0
            ) {
                return null
            }

            return exactComponent
        }

        if (
            currentDistance <=
            AltiumScene3dExternalPlacementAdapter.#FAR_OWNER_DISTANCE_MIL
        ) {
            return null
        }
        if (currentHasPartCodeAffinity) {
            return null
        }
        if (
            String(placement?.projection?.source || '') ===
            'model-anchor-fallback'
        ) {
            return AltiumScene3dExternalPlacementAdapter.#nearestModelAnchorOwner(
                placement,
                componentBody,
                components,
                pads
            )
        }

        return AltiumScene3dExternalPlacementAdapter.#nearestCompatibleAnchorComponent(
            placement,
            componentBody,
            components,
            AltiumScene3dExternalPlacementAdapter.#NEAR_ANCHOR_TOLERANCE_MIL
        )
    }

    /**
     * Finds a nearby compatible owner for a model-anchor fallback body.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object[]} components PCB components.
     * @param {object[]} pads Source PCB pads.
     * @returns {object | null}
     */
    static #nearestModelAnchorOwner(
        placement,
        componentBody,
        components,
        pads
    ) {
        const candidates = components
            .map((component) => ({
                component,
                distance: AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                    placement,
                    component
                ),
                padDistance:
                    AltiumScene3dExternalPlacementAdapter.#distanceToNearestOwnedPad(
                        placement,
                        component,
                        pads
                    )
            }))
            .filter(
                (candidate) =>
                    (candidate.distance <=
                        AltiumScene3dExternalPlacementAdapter
                            .#MODEL_ANCHOR_NEAR_OWNER_TOLERANCE_MIL ||
                        candidate.padDistance <=
                            AltiumScene3dExternalPlacementAdapter
                                .#MODEL_ANCHOR_PAD_PROXIMITY_TOLERANCE_MIL) &&
                    AltiumScene3dExternalPlacementAdapter.#hasModelAnchorOwnerAffinity(
                        placement,
                        componentBody,
                        candidate.component
                    )
            )
            .sort((left, right) => left.distance - right.distance)

        return candidates[0]?.component || null
    }

    /**
     * Measures how far one model anchor sits outside pads owned by a component.
     * @param {object} placement External model placement.
     * @param {object} component Candidate owner component.
     * @param {object[]} pads Source PCB pads.
     * @returns {number}
     */
    static #distanceToNearestOwnedPad(placement, component, pads) {
        const ownedPads = AltiumScene3dExternalPlacementAdapter.#componentPads(
            component,
            pads
        ).filter((pad) =>
            AltiumScene3dExternalPlacementAdapter.#hasDrilledPadOpening(pad)
        )

        if (!ownedPads.length) {
            return Number.POSITIVE_INFINITY
        }

        return Math.min(
            ...ownedPads.map((pad) => {
                const distance =
                    AltiumScene3dExternalPlacementAdapter.#distanceBetweenPoints(
                        placement?.bodyPositionMil,
                        { x: pad?.x, y: pad?.y }
                    )
                const radius =
                    AltiumScene3dExternalPlacementAdapter.#padAnchorRadiusMil(
                        pad
                    )

                return radius > 0
                    ? Math.max(0, distance - radius)
                    : Number.POSITIVE_INFINITY
            })
        )
    }

    /**
     * Resolves the effective XY radius around a drilled pad center.
     * @param {object} pad Source PCB pad.
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
            Number(pad?.holeSize || 0),
            Number(pad?.holeSlotLength || 0),
            Number(pad?.slotLength || 0),
            Number(holeGeometry?.diameter || 0),
            Number(holeGeometry?.length || 0),
            Number(holeGeometry?.slotLength || 0)
        )

        return Number.isFinite(diameter) && diameter > 0 ? diameter / 2 : 0
    }

    /**
     * Checks whether a resolved model-anchor fallback should be centered on
     * its nearby compatible owner.
     * @param {object} placement External model placement.
     * @param {object | null | undefined} component Resolved owner component.
     * @param {object | null} componentBody Source component body.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #shouldCenterResolvedModelAnchor(
        placement,
        component,
        componentBody,
        pads
    ) {
        const projectionSource = String(placement?.projection?.source || '')
        if (
            !component ||
            (projectionSource !== 'model-anchor-fallback' &&
                projectionSource !== 'model-bounds')
        ) {
            return false
        }

        if (
            AltiumScene3dExternalPlacementAdapter.#distanceToNearestOwnedPad(
                placement,
                component,
                pads
            ) <=
            AltiumScene3dExternalPlacementAdapter.#EXACT_ANCHOR_TOLERANCE_MIL
        ) {
            return false
        }

        if (
            AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                placement,
                component
            ) <=
                AltiumScene3dExternalPlacementAdapter
                    .#MODEL_ANCHOR_NEAR_OWNER_TOLERANCE_MIL &&
            AltiumScene3dExternalPlacementAdapter.#hasModelAnchorOwnerAffinity(
                placement,
                componentBody,
                component
            )
        ) {
            return true
        }

        return (
            (AltiumScene3dExternalPlacementAdapter.#hasPartCodeAffinity(
                placement,
                componentBody,
                component
            ) ||
                AltiumScene3dExternalPlacementAdapter.#hasModelAnchorOwnerAffinity(
                    placement,
                    componentBody,
                    component
                )) &&
            AltiumScene3dExternalPlacementAdapter.#hasModelAnchorOwnerComponentAffinity(
                component
            ) &&
            AltiumScene3dExternalPlacementAdapter.#hasOwnedPadGeometry(
                component,
                pads
            )
        )
    }

    /**
     * Checks whether model-anchor and component identity both describe
     * connector/header-like hardware.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #hasModelAnchorOwnerAffinity(placement, componentBody, component) {
        return (
            AltiumScene3dExternalPlacementAdapter.#MODEL_ANCHOR_OWNER_PATTERN.test(
                [
                    placement?.designator,
                    placement?.externalModel?.name,
                    placement?.externalModel?.relativePath,
                    componentBody?.identifier,
                    componentBody?.name
                ]
                    .map((value) => String(value || ''))
                    .join(' ')
            ) &&
            AltiumScene3dExternalPlacementAdapter.#MODEL_ANCHOR_OWNER_PATTERN.test(
                [
                    component?.designator,
                    component?.pattern,
                    component?.source,
                    component?.description,
                    ...Object.values(component?.parameters || {})
                ]
                    .map((value) => String(value || ''))
                    .join(' ')
            )
        )
    }

    /**
     * Checks whether component metadata describes connector/header hardware.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #hasModelAnchorOwnerComponentAffinity(component) {
        return AltiumScene3dExternalPlacementAdapter.#MODEL_ANCHOR_OWNER_PATTERN.test(
            [
                component?.designator,
                component?.pattern,
                component?.source,
                component?.description,
                ...Object.values(component?.parameters || {})
            ]
                .map((value) => String(value || ''))
                .join(' ')
        )
    }

    /**
     * Checks whether the owner has measurable pad geometry for centering.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasOwnedPadGeometry(component, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return false
        }

        return (
            (Array.isArray(pads) ? pads : []).filter(
                (pad) =>
                    Number(pad?.componentIndex) === componentIndex &&
                    AltiumScene3dExternalPlacementAdapter.#isMeasurablePad(pad)
            ).length >= 2
        )
    }

    /**
     * Checks whether one pad has finite coordinates and non-zero dimensions.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #isMeasurablePad(pad) {
        const width = Math.max(
            Number(pad?.sizeTopX || 0),
            Number(pad?.sizeMidX || 0),
            Number(pad?.sizeBottomX || 0)
        )
        const depth = Math.max(
            Number(pad?.sizeTopY || 0),
            Number(pad?.sizeMidY || 0),
            Number(pad?.sizeBottomY || 0)
        )

        return (
            Number.isFinite(Number(pad?.x)) &&
            Number.isFinite(Number(pad?.y)) &&
            width > 0 &&
            depth > 0
        )
    }

    /**
     * Resolves a component-centered scene position.
     * @param {object} component PCB component.
     * @param {object | undefined} board Scene board metadata.
     * @returns {{ x: number, y: number }}
     */
    static #ownerPositionMil(component, board) {
        return {
            x: Number(component?.x || 0) - Number(board?.centerX || 0),
            y: Number(component?.y || 0) - Number(board?.centerY || 0)
        }
    }

    /**
     * Resolves the source body anchor offset from its component owner.
     * @param {object} placement External model placement.
     * @param {object} component PCB component.
     * @returns {{ x: number, y: number }}
     */
    static #ownerAnchorOffset(placement, component) {
        return {
            x:
                Number(placement?.bodyPositionMil?.x || 0) -
                Number(component?.x || 0),
            y:
                Number(placement?.bodyPositionMil?.y || 0) -
                Number(component?.y || 0)
        }
    }

    /**
     * Adds owner anchor provenance and a viewer-applied local model offset.
     * @param {object} placement External model placement.
     * @param {{ x?: number, y?: number } | null} offset Source-origin offset.
     * @returns {object}
     */
    static #withRenderableOwnerAnchorOffset(placement, offset) {
        const modelTransform = placement?.modelTransform || {}
        const offsetX = Number(offset?.x || 0)
        const offsetY = Number(offset?.y || 0)
        const renderableOffset =
            AltiumScene3dExternalPlacementAdapter.#renderableOwnerAnchorOffset(
                placement,
                { x: offsetX, y: offsetY }
            )
        const offsetZ = Number(
            modelTransform?.offsetMil?.z ?? modelTransform?.dzMil ?? 0
        )
        const renderableZ = Number.isFinite(offsetZ) ? offsetZ : 0

        return {
            ...(modelTransform || {}),
            dzMil: renderableZ,
            offsetMil: {
                ...(modelTransform?.offsetMil || {}),
                x: renderableOffset.x,
                y: renderableOffset.y,
                z: renderableZ
            },
            ownerAnchorOffsetMil: {
                x: offsetX,
                y: offsetY
            }
        }
    }

    /**
     * Converts a board-space owner anchor offset into mount-rig local XY.
     * @param {{ mountSide?: string, rotationDeg?: number }} placement External placement.
     * @param {{ x: number, y: number }} offset Board-space owner offset.
     * @returns {{ x: number, y: number }}
     */
    static #renderableOwnerAnchorOffset(placement, offset) {
        const rotationRad =
            (-AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
                Number(placement?.rotationDeg || 0)
            ) *
                Math.PI) /
            180
        const cos = Math.cos(rotationRad)
        const sin = Math.sin(rotationRad)
        const sourceY =
            AltiumScene3dExternalPlacementAdapter.#isBottomPlacement(placement)
                ? -Number(offset?.y || 0)
                : Number(offset?.y || 0)
        const x = Number(offset?.x || 0) * cos - sourceY * sin
        const y = Number(offset?.x || 0) * sin + sourceY * cos

        return {
            x: Math.abs(x) < Number.EPSILON ? 0 : Number(x.toFixed(10)),
            y: AltiumScene3dExternalPlacementAdapter.#isBottomPlacement(
                placement
            )
                ? Math.abs(y) < Number.EPSILON
                    ? 0
                    : Number((-y).toFixed(10))
                : Math.abs(y) < Number.EPSILON
                  ? 0
                  : Number(y.toFixed(10))
        }
    }

    /**
     * Checks whether one placement mounts on the board bottom face.
     * @param {{ mountSide?: string } | null | undefined} placement External placement.
     * @returns {boolean}
     */
    static #isBottomPlacement(placement) {
        return String(placement?.mountSide || '').toLowerCase() === 'bottom'
    }

    /**
     * Repairs orientation fields once a source body and owner are known.
     * @param {object} placement External model placement.
     * @param {object | null | undefined} component Owning component.
     * @param {object | null} componentBody Source component body.
     * @param {boolean} useComponentYaw Whether component yaw should override body yaw.
     * @param {boolean} correctPinOneYaw Whether a square IC pin-one correction applies.
     * @param {number | null} footprintYaw Footprint-derived yaw when available.
     * @param {boolean} mirrorSourceZ Whether the model source length should be mirrored.
     * @param {object[]} pads Source PCB pads.
     * @returns {object}
     */
    static #repairRotation(
        placement,
        component,
        componentBody,
        useComponentYaw,
        correctPinOneYaw,
        footprintYaw,
        mirrorSourceZ,
        pads
    ) {
        const baseModelTransform =
            AltiumScene3dExternalPlacementAdapter.#repairModelTransform(
                placement?.modelTransform,
                componentBody
            )
        const isGenericPassiveBody =
            AltiumScene3dExternalPlacementAdapter.#isGenericPassiveBody(
                componentBody
            )
        const componentYaw =
            AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
                Number(component?.rotation || 0)
            )
        const placementYaw =
            AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
                Number(placement?.rotationDeg || 0)
            )
        const hasFootprintYaw =
            footprintYaw !== null &&
            footprintYaw !== undefined &&
            Number.isFinite(Number(footprintYaw))
        const baseRotation =
            component && hasFootprintYaw
                ? AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
                      Number(footprintYaw)
                  )
                : component && useComponentYaw && !isGenericPassiveBody
                  ? componentYaw
                  : placementYaw
        const rotationDeg =
            correctPinOneYaw && !isGenericPassiveBody
                ? AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
                      baseRotation + 180
                  )
                : baseRotation
        const yawAdjustedModelTransform =
            AltiumScene3dExternalPlacementAdapter.#withFootprintRelativeModelYaw(
                baseModelTransform,
                placement,
                componentBody,
                hasFootprintYaw && !isGenericPassiveBody,
                rotationDeg
            )
        const mirroredModelTransform =
            mirrorSourceZ && !isGenericPassiveBody
                ? AltiumScene3dExternalPlacementAdapter.#withMirroredSourceZScale(
                      yawAdjustedModelTransform
                  )
                : yawAdjustedModelTransform
        const modelTransform =
            AltiumScene3dExternalPlacementAdapter.#normalizeBottomSurfaceMountHalfTurn(
                mirroredModelTransform,
                placement,
                component,
                componentBody,
                pads
            )

        const repairedPlacement = {
            ...placement,
            rotationDeg,
            modelTransform
        }

        return modelTransform?.ownerAnchorOffsetMil
            ? {
                  ...repairedPlacement,
                  modelTransform:
                      AltiumScene3dExternalPlacementAdapter.#withRenderableOwnerAnchorOffset(
                          repairedPlacement,
                          modelTransform.ownerAnchorOffsetMil
                      )
              }
            : repairedPlacement
    }

    /**
     * Preserves authored embedded-model yaw relative to a footprint yaw
     * override by moving the signed yaw delta into the model-local transform.
     * @param {object | null | undefined} modelTransform Placement transform.
     * @param {object | null | undefined} placement External placement.
     * @param {object | null | undefined} componentBody Source component body.
     * @param {boolean} enabled Whether footprint yaw overrode body yaw.
     * @param {number} placementYawDeg Final board-facing placement yaw.
     * @returns {object | null | undefined}
     */
    static #withFootprintRelativeModelYaw(
        modelTransform,
        placement,
        componentBody,
        enabled,
        placementYawDeg
    ) {
        const sourceYaw = Number(
            componentBody?.modelRotationDeg?.z ?? placement?.rotationDeg
        )
        if (!enabled || !Number.isFinite(sourceYaw)) {
            return modelTransform
        }

        const rotationDeg = modelTransform?.rotationDeg || {}
        const localYaw =
            AltiumScene3dExternalPlacementAdapter.#resolveFootprintRelativeModelYaw(
                placement,
                sourceYaw,
                placementYawDeg
            )

        return {
            ...(modelTransform || {}),
            rotationDeg: {
                ...rotationDeg,
                z: localYaw
            }
        }
    }

    /**
     * Resolves model-local yaw after a footprint yaw override. Model-bounds
     * placements retain full source geometry, so their source yaw delta uses
     * the opposite sign from pad-fallback bodies that were synthesized from
     * footprint pads.
     * @param {object | null | undefined} placement External placement.
     * @param {number} sourceYaw Source STEP yaw.
     * @param {number} placementYawDeg Board-facing placement yaw.
     * @returns {number}
     */
    static #resolveFootprintRelativeModelYaw(
        placement,
        sourceYaw,
        placementYawDeg
    ) {
        const projectionSource = String(
            placement?.projection?.source || ''
        ).toLowerCase()
        const delta =
            projectionSource === 'model-bounds'
                ? sourceYaw - Number(placementYawDeg || 0)
                : Number(placementYawDeg || 0) - sourceYaw

        return AltiumScene3dExternalPlacementAdapter.#normalizeSignedAngle(
            delta
        )
    }

    /**
     * Mirrors a source model along its local Z axis while preserving any
     * existing caller-provided scale on the other axes.
     * @param {object | null | undefined} modelTransform Placement transform.
     * @returns {object}
     */
    static #withMirroredSourceZScale(modelTransform) {
        const scale = modelTransform?.scale || {}
        const zScale = Number(scale.z ?? 1)
        const mirroredZScale =
            Number.isFinite(zScale) && zScale !== 0 ? -Math.abs(zScale) : -1

        return {
            ...(modelTransform || {}),
            scale: {
                ...scale,
                z: mirroredZScale
            }
        }
    }

    /**
     * Clears bottom-side surface-mount half-turns that the mount rig already
     * supplies through its underside mirror.
     * @param {object | null | undefined} modelTransform Placement transform.
     * @param {object} placement External placement.
     * @param {object | null | undefined} component Owning component.
     * @param {object | null | undefined} componentBody Source component body.
     * @param {object[]} pads Source PCB pads.
     * @returns {object | null | undefined}
     */
    static #normalizeBottomSurfaceMountHalfTurn(
        modelTransform,
        placement,
        component,
        componentBody,
        pads
    ) {
        const rotation = modelTransform?.rotationDeg || {}
        if (
            String(placement?.mountSide || '').toLowerCase() !== 'bottom' ||
            !component ||
            AltiumScene3dExternalPlacementAdapter.#normalizeAngle(
                rotation.x
            ) !== 180 ||
            AltiumScene3dBottomSourceHalfTurnPolicy.shouldPreserve({
                component,
                componentBody,
                placement,
                modelTransform
            }) ||
            AltiumScene3dExternalPlacementAdapter.#componentHasThroughHolePads(
                component,
                pads
            )
        ) {
            return modelTransform
        }

        return {
            ...(modelTransform || {}),
            rotationDeg: {
                ...rotation,
                x: 0
            }
        }
    }

    /**
     * Finds the nearest component whose anchor is effectively the body anchor.
     * @param {object} placement External model placement.
     * @param {object[]} components PCB components.
     * @returns {object | null}
     */
    static #nearestAnchorComponent(placement, components, toleranceMil) {
        const candidates = components
            .map((component) => ({
                component,
                distance: AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                    placement,
                    component
                )
            }))
            .filter((candidate) => candidate.distance <= toleranceMil)
            .sort((left, right) => left.distance - right.distance)
        return candidates[0]?.component || null
    }

    /**
     * Finds the nearest component anchor that is compatible with a weak body
     * fallback assignment.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object[]} components PCB components.
     * @param {number} toleranceMil Maximum XY body-to-component distance.
     * @returns {object | null}
     */
    static #nearestCompatibleAnchorComponent(
        placement,
        componentBody,
        components,
        toleranceMil
    ) {
        const candidates = components
            .map((component) => ({
                component,
                distance: AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                    placement,
                    component
                )
            }))
            .filter(
                (candidate) =>
                    candidate.distance <= toleranceMil &&
                    AltiumScene3dExternalPlacementAdapter.#canUseNearAnchorComponent(
                        placement,
                        componentBody,
                        candidate.component
                    )
            )
            .sort((left, right) => left.distance - right.distance)

        return candidates[0]?.component || null
    }

    /**
     * Checks whether a near-anchor owner is strong enough for a weak fallback.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #canUseNearAnchorComponent(placement, componentBody, component) {
        if (
            !AltiumScene3dExternalPlacementAdapter.#hasPlacementComponentSideConflict(
                placement,
                component
            )
        ) {
            return true
        }

        return (
            AltiumScene3dExternalPlacementAdapter.#hasMetadataAffinity(
                placement,
                componentBody,
                component
            ) ||
            AltiumScene3dExternalPlacementAdapter.#hasPartCodeAffinity(
                placement,
                componentBody,
                component
            )
        )
    }

    /**
     * Checks whether a placement and candidate owner are on opposite board
     * faces.
     * @param {object} placement External model placement.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #hasPlacementComponentSideConflict(placement, component) {
        const placementSide =
            AltiumScene3dExternalPlacementAdapter.#normalizeMountSide(
                placement?.mountSide
            )
        const componentSide =
            AltiumScene3dExternalPlacementAdapter.#resolveComponentMountSide(
                component
            )

        return Boolean(
            placementSide && componentSide && placementSide !== componentSide
        )
    }

    /**
     * Normalizes external placement mount-side labels.
     * @param {unknown} value Source mount-side value.
     * @returns {'top' | 'bottom' | null}
     */
    static #normalizeMountSide(value) {
        const side = String(value || '').toLowerCase()

        return side === 'top' || side === 'bottom' ? side : null
    }

    /**
     * Builds package metadata text for generic package-family checks.
     * @param {object} component PCB component.
     * @param {object | null} componentBody Source component body.
     * @returns {string}
     */
    static #packageIdentityText(component, componentBody) {
        const parameterValues = Object.values(component?.parameters || {})
            .map((value) => String(value || ''))
            .join(' ')

        return [
            component?.pattern,
            component?.source,
            component?.description,
            component?.provenance?.footprintDescription,
            parameterValues,
            componentBody?.identifier,
            componentBody?.name
        ]
            .map((value) => String(value || ''))
            .join(' ')
    }

    /**
     * Matches a standalone offset body back to a component from metadata.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object[]} components PCB components.
     * @returns {object | null}
     */
    static #resolveMetadataComponent(placement, componentBody, components) {
        if (
            AltiumScene3dExternalPlacementAdapter.#isGenericPassiveBody(
                componentBody
            )
        ) {
            return null
        }

        const tokens =
            AltiumScene3dExternalPlacementAdapter.#bodyIdentityTokens(
                placement,
                componentBody
            )
        if (!tokens.length) {
            return null
        }

        const candidates = components
            .map((component) => ({
                component,
                score: AltiumScene3dExternalPlacementAdapter.#metadataScore(
                    tokens,
                    component
                ),
                distance: AltiumScene3dExternalPlacementAdapter.#distanceToBody(
                    placement,
                    component
                )
            }))
            .filter((candidate) => candidate.score > 0)
            .sort(
                (left, right) =>
                    right.score - left.score || left.distance - right.distance
            )

        const nearbyModelAnchorCandidate =
            AltiumScene3dExternalPlacementAdapter.#nearestModelAnchorMetadataCandidate(
                placement,
                componentBody,
                candidates
            )
        if (nearbyModelAnchorCandidate) {
            return nearbyModelAnchorCandidate
        }

        return candidates[0]?.component || null
    }

    /**
     * Resolves nearby model-anchor owners before stronger far metadata claims
     * steal repeated sub-bodies from their physical connector row.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {{ component: object, score: number, distance: number }[]} candidates Metadata candidates.
     * @returns {object | null}
     */
    static #nearestModelAnchorMetadataCandidate(
        placement,
        componentBody,
        candidates
    ) {
        if (
            String(placement?.projection?.source || '') !==
            'model-anchor-fallback'
        ) {
            return null
        }

        const nearbyCandidates = candidates
            .filter(
                (candidate) =>
                    candidate.distance <=
                        AltiumScene3dExternalPlacementAdapter
                            .#MODEL_ANCHOR_METADATA_PROXIMITY_MIL &&
                    AltiumScene3dExternalPlacementAdapter.#hasPartCodeAffinity(
                        placement,
                        componentBody,
                        candidate.component
                    )
            )
            .sort(
                (left, right) =>
                    left.distance - right.distance || right.score - left.score
            )

        return nearbyCandidates[0]?.component || null
    }

    /**
     * Checks whether a weak far owner is still supported by source metadata.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #hasMetadataAffinity(placement, componentBody, component) {
        const tokens =
            AltiumScene3dExternalPlacementAdapter.#bodyIdentityTokens(
                placement,
                componentBody
            )

        return (
            tokens.length > 0 &&
            AltiumScene3dExternalPlacementAdapter.#metadataScore(
                tokens,
                component
            ) > 0
        )
    }

    /**
     * Checks whether source metadata confirms ownership with a part-like code
     * instead of only generic package words.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #hasPartCodeAffinity(placement, componentBody, component) {
        const haystack =
            AltiumScene3dExternalPlacementAdapter.#metadataHaystack(component)

        return AltiumScene3dExternalPlacementAdapter.#bodyIdentityTokens(
            placement,
            componentBody
        ).some(
            (token) =>
                /\d/u.test(token) &&
                (/[a-z]/u.test(token) || token.length >= 6) &&
                haystack.includes(token)
        )
    }

    /**
     * Scores one component against body identity tokens.
     * @param {string[]} tokens Body identity tokens.
     * @param {object} component PCB component.
     * @returns {number}
     */
    static #metadataScore(tokens, component) {
        const haystack =
            AltiumScene3dExternalPlacementAdapter.#metadataHaystack(component)

        return tokens.reduce(
            (score, token) =>
                score + (haystack.includes(token) ? token.length : 0),
            0
        )
    }

    /**
     * Builds searchable component metadata text.
     * @param {object} component PCB component.
     * @returns {string}
     */
    static #metadataHaystack(component) {
        const parameterValues = Object.values(component?.parameters || {})
            .map((value) => String(value || ''))
            .join(' ')

        return AltiumScene3dExternalPlacementAdapter.#normalizeIdentityText([
            component?.designator,
            component?.pattern,
            component?.source,
            component?.modelPath,
            parameterValues
        ])
    }

    /**
     * Collects body identity tokens suitable for exact metadata matching.
     * @param {object} placement External model placement.
     * @param {object | null} componentBody Source component body.
     * @returns {string[]}
     */
    static #bodyIdentityTokens(placement, componentBody) {
        const text = [
            placement?.designator,
            placement?.externalModel?.name,
            placement?.externalModel?.relativePath,
            componentBody?.identifier,
            componentBody?.name
        ]
            .map((value) =>
                String(value || '')
                    .replace(/\.[^.]+$/, '')
                    .trim()
            )
            .filter(Boolean)

        return [
            ...new Set(
                text.flatMap((value) =>
                    AltiumScene3dIdentityTokens.fromText(value)
                )
            )
        ]
    }

    /**
     * Resolves the source component body row for one placement.
     * @param {object} placement External model placement.
     * @param {object[]} componentBodies Source component body rows.
     * @returns {object | null}
     */
    static #resolveComponentBody(placement, componentBodies) {
        const candidates = componentBodies
            .map((componentBody) => ({
                componentBody,
                distance:
                    AltiumScene3dExternalPlacementAdapter.#distanceBetweenPoints(
                        placement?.bodyPositionMil,
                        componentBody?.positionMil
                    ),
                identityScore:
                    AltiumScene3dExternalPlacementAdapter.#bodyPlacementIdentityScore(
                        placement,
                        componentBody
                    )
            }))
            .filter((candidate) => candidate.distance <= 0.01)
            .sort(
                (left, right) =>
                    right.identityScore - left.identityScore ||
                    left.distance - right.distance
            )

        return candidates[0]?.componentBody || null
    }

    /**
     * Scores whether a source body row belongs to one placement.
     * @param {object} placement External model placement.
     * @param {object} componentBody Source component body.
     * @returns {number}
     */
    static #bodyPlacementIdentityScore(placement, componentBody) {
        const placementText =
            AltiumScene3dExternalPlacementAdapter.#normalizeIdentityText([
                placement?.designator,
                placement?.externalModel?.name
            ])
        const bodyText =
            AltiumScene3dExternalPlacementAdapter.#normalizeIdentityText([
                componentBody?.identifier,
                componentBody?.name
            ])

        return placementText && bodyText && placementText.includes(bodyText)
            ? bodyText.length
            : 0
    }

    /**
     * Repairs model-local Altium rotation signs for embedded body transforms.
     * @param {object | null | undefined} modelTransform Placement transform.
     * @param {object | null} componentBody Source component body.
     * @returns {object | null | undefined}
     */
    static #repairModelTransform(modelTransform, componentBody) {
        const rotationDeg = modelTransform?.rotationDeg || {}
        const repairedTransform = {
            ...(modelTransform || {}),
            dzMil: AltiumScene3dExternalPlacementAdapter.#repairVerticalOffset(
                modelTransform,
                componentBody
            )
        }
        if (modelTransform?.offsetMil) {
            repairedTransform.offsetMil = {
                ...modelTransform.offsetMil,
                z: repairedTransform.dzMil
            }
        }

        return {
            ...repairedTransform,
            rotationDeg: {
                ...rotationDeg,
                x: Number(rotationDeg.x ?? 0),
                y: Number(rotationDeg.y ?? 0),
                z: Number(rotationDeg.z ?? 0)
            }
        }
    }

    /**
     * Clamps only negative standoffs that exceed the source model's height
     * envelope and would sink a seated STEP model through the PCB face.
     * @param {object | null | undefined} modelTransform Placement transform.
     * @param {object | null} componentBody Source component body.
     * @returns {number}
     */
    static #repairVerticalOffset(modelTransform, componentBody) {
        const offsetMil = modelTransform?.offsetMil || {}
        const value = Number(offsetMil.z ?? modelTransform?.dzMil ?? 0)
        if (!Number.isFinite(value)) {
            return 0
        }

        if (value >= 0) {
            return value
        }
        const overallHeight = Number(componentBody?.overallHeightMil || 0)
        if (overallHeight > 0 && Math.abs(value) < overallHeight) {
            return value
        }
        return 0
    }

    /**
     * Checks whether a body is a generic passive package where body yaw is safe.
     * @param {object | null} componentBody Source component body.
     * @returns {boolean}
     */
    static #isGenericPassiveBody(componentBody) {
        return AltiumScene3dExternalPlacementAdapter.#PASSIVE_BODY_PATTERN.test(
            [componentBody?.identifier, componentBody?.name].join(' ')
        )
    }

    /**
     * Checks whether a component's footprint metadata looks like a generic
     * passive package.
     * @param {object | null | undefined} component PCB component.
     * @returns {boolean}
     */
    static #isGenericPassiveComponent(component) {
        const parameterValues = Object.values(component?.parameters || {})
            .map((value) => String(value || ''))
            .join(' ')

        return AltiumScene3dExternalPlacementAdapter.#PASSIVE_BODY_PATTERN.test(
            [
                component?.pattern,
                component?.source,
                component?.modelPath,
                parameterValues
            ].join(' ')
        )
    }

    /**
     * Measures the XY distance between one body anchor and one component.
     * @param {object} placement External model placement.
     * @param {object} component PCB component.
     * @returns {number}
     */
    static #distanceToBody(placement, component) {
        return AltiumScene3dExternalPlacementAdapter.#distanceBetweenPoints(
            { x: component?.x, y: component?.y },
            placement?.bodyPositionMil
        )
    }

    /**
     * Measures the XY distance between two points.
     * @param {{ x?: number, y?: number } | null | undefined} first First point.
     * @param {{ x?: number, y?: number } | null | undefined} second Second point.
     * @returns {number}
     */
    static #distanceBetweenPoints(first, second) {
        return Math.hypot(
            Number(first?.x || 0) - Number(second?.x || 0),
            Number(first?.y || 0) - Number(second?.y || 0)
        )
    }

    /**
     * Resolves one component's board side from its layer.
     * @param {object} component PCB component.
     * @returns {'top' | 'bottom' | null}
     */
    static #resolveComponentMountSide(component) {
        const layer = String(component?.layer || '').toUpperCase()
        if (layer.includes('BOTTOM') || layer === 'BOT') {
            return 'bottom'
        }

        if (layer.includes('TOP')) {
            return 'top'
        }

        return null
    }

    /**
     * Resolves the board face Z coordinate for one mount side.
     * @param {string} mountSide Mount side.
     * @param {object} board Scene board metadata.
     * @returns {number}
     */
    static #resolveFaceZ(mountSide, board) {
        const thickness =
            Number(board?.thicknessMil) ||
            AltiumScene3dExternalPlacementAdapter.#DEFAULT_BOARD_THICKNESS_MIL
        const halfThickness = thickness / 2

        return String(mountSide || '').toLowerCase() === 'bottom'
            ? -halfThickness
            : halfThickness
    }

    /**
     * Normalizes one angle into [0, 360).
     * @param {number} angle Source angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }

    /**
     * Normalizes one angle into the compact signed range [-180, 180).
     * @param {number} angle Candidate angle.
     * @returns {number}
     */
    static #normalizeSignedAngle(angle) {
        const normalized =
            AltiumScene3dExternalPlacementAdapter.#normalizeAngle(angle)

        return normalized >= 180 ? normalized - 360 : normalized
    }

    /**
     * Normalizes identity strings for exact substring matching.
     * @param {unknown[]} values Source values.
     * @returns {string}
     */
    static #normalizeIdentityText(values) {
        return values
            .map((value) => String(value || '').toLowerCase())
            .join(' ')
            .replace(/\.[a-z0-9]+\\b/g, '')
            .replace(/[^a-z0-9]+/g, '')
    }
}
