import { AltiumScene3dTwoRowFootprintDetector } from './AltiumScene3dTwoRowFootprintDetector.mjs'
import { AltiumScene3dQfnFootprintDetector } from './AltiumScene3dQfnFootprintDetector.mjs'
import { AltiumScene3dDisplayModuleYawPolicy } from './AltiumScene3dDisplayModuleYawPolicy.mjs'

const PASSIVE_BODY_PATTERN =
    /(?:^|[^a-z0-9])(?:cap|capacitor|res|resistor|ind|inductor|ferrite|bead|crystal|xtal|lqw|lqg)(?:$|[^a-z0-9])/i
const CHIP_PASSIVE_BODY_PATTERN =
    /(?:^|[^a-z0-9])(?:cap|capacitor|res|resistor|ind|inductor|ferrite|bead|lqw|lqg)(?:$|[^a-z0-9])/i
const LOCAL_Y_CHIP_PASSIVE_MODEL_PATTERN =
    /(?:^|[^a-z0-9])local[-_ ]?y(?:$|[^a-z0-9])/i
const PIN_ONE_CORNER_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:[auvw]?qfn|[uv]?fqfn|v?qfp|lqfp|tqfp|pqfp|mqfp)(?:[0-9]+)?(?:$|[^a-z0-9])/i
const TWO_ROW_PIN_ONE_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:msop|qsop|soic|sop|ssop|tssop|tsop|vsop)(?:[-_ ]?\d+)?(?:$|[^a-z0-9])/i
const DFN_FOOTPRINT_YAW_PATTERN =
    /(?:^|[^a-z0-9])(?:[a-z0-9]*dfn)(?:[-_ ]?[a-z0-9]+)*(?:$|[^a-z0-9])/i
const FIVE_LEAD_SOT_PATTERN =
    /(?:^|[^a-z0-9])sot[-_ ]?(?:23[-_ ]?5|25|5)(?:$|[^a-z0-9])/i
const THREE_LEAD_SOT23_PATTERN =
    /(?:^|[^a-z0-9])sot[-_ ]?23[-_ ]?3(?:$|[^a-z0-9])/i
const FLAT_SOURCE_X_SOT_PATTERN =
    /(?:^|[^a-z0-9])sot[-_ ]?(?:23[-_ ]?3|23[-_ ]?5|25|5)(?:$|[^a-z0-9])/i
const SOT_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])sot[-_ ]?(?:23|25|323|343|353|523|553)(?:[-_ ]?\d+)?(?:$|[^a-z0-9])/i
const SOT523_PACKAGE_PATTERN = /(?:^|[^a-z0-9])sot[-_ ]?523(?:$|[^a-z0-9])/i
const EDGE_CONNECTOR_TOKENS = new Set([
    'antenna',
    'coax',
    'connector',
    'edge',
    'rf',
    'sma',
    'socket'
])
const THROUGH_HOLE_CONNECTOR_PATTERN =
    /(?:^|[^a-z0-9])(?:connector|header|socket|terminal|wire[-_ ]?to[-_ ]?board)(?:$|[^a-z0-9])/i

/**
 * Resolves generic Altium external-model yaw correction rules.
 */
export class AltiumScene3dPlacementRotationPolicy {
    /**
     * Checks whether an external placement needs a half-turn yaw correction.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[], isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static shouldCorrectYaw(context) {
        return (
            AltiumScene3dPlacementRotationPolicy.#needsSquarePinOneCorrection(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#needsTwoRowPinOneCorrection(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#needsFiveLeadSotCorrection(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#needsThreeLeadSot23Correction(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#needsDisplayModelBoundsEdgeCorrection(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#needsAlignedThroughHoleConnectorCorrection(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#needsTiltedEdgeCorrection(
                context
            )
        )
    }

    /**
     * Checks whether the component footprint yaw should override the source
     * body yaw for anchored or pad-fallback packages whose footprint geometry
     * is more reliable than the source model yaw.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[], isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static shouldUseFootprintYaw(context) {
        const footprintYaw =
            AltiumScene3dPlacementRotationPolicy.resolveFootprintYaw(context)

        return (
            footprintYaw !== null &&
            footprintYaw !== undefined &&
            Number.isFinite(Number(footprintYaw))
        )
    }

    /**
     * Checks whether an embedded source model should be mirrored along its
     * local length axis after the Altium tilt is applied.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[], isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static shouldMirrorSourceZ(context) {
        const { placement, component, componentBody, pads } = context || {}
        if (!component) {
            return false
        }

        const identityText =
            AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                component,
                componentBody
            )

        return (
            AltiumScene3dPlacementRotationPolicy.#isPadFallback(placement) &&
            AltiumScene3dPlacementRotationPolicy.#shouldUseDfnFootprintYaw(
                placement,
                component,
                componentBody,
                pads,
                identityText
            ) &&
            AltiumScene3dPlacementRotationPolicy.#hasPowerDfnPinOneEndPattern(
                component,
                pads
            )
        )
    }

    /**
     * Resolves a board-space yaw from footprint pad geometry when the model
     * source yaw cannot be trusted.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[], isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {number | null}
     */
    static resolveFootprintYaw(context) {
        const { placement, component, componentBody, pads } = context || {}
        const mountSide = String(placement?.mountSide || '').toLowerCase()
        if (
            !AltiumScene3dPlacementRotationPolicy.#isAnchoredOrPadFallback(
                context
            ) ||
            !component ||
            (mountSide !== 'top' && mountSide !== 'bottom')
        ) {
            return null
        }

        const identityText =
            AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                component,
                componentBody
            )
        if (
            PASSIVE_BODY_PATTERN.test(identityText) &&
            AltiumScene3dPlacementRotationPolicy.#hasPassiveFootprint(
                component,
                pads
            ) &&
            AltiumScene3dPlacementRotationPolicy.#shouldUsePassiveFootprintYaw(
                component,
                identityText,
                placement
            )
        ) {
            return AltiumScene3dPlacementRotationPolicy.#resolvePassiveFootprintYaw(
                component,
                pads,
                identityText,
                placement
            )
        }

        if (
            SOT_PACKAGE_PATTERN.test(identityText) &&
            AltiumScene3dPlacementRotationPolicy.#hasSmallSotFootprint(
                component,
                pads
            ) &&
            AltiumScene3dPlacementRotationPolicy.#shouldUseSotFootprintYaw(
                placement,
                identityText,
                componentBody
            )
        ) {
            return AltiumScene3dPlacementRotationPolicy.#resolveSotFootprintYaw(
                component,
                pads,
                identityText,
                componentBody
            )
        }

        if (
            AltiumScene3dDisplayModuleYawPolicy.shouldUseComponentYaw({
                placement,
                component,
                pads,
                identityText
            }) &&
            !AltiumScene3dPlacementRotationPolicy.#sourceYawMatchesComponentYaw(
                placement,
                component,
                componentBody
            )
        ) {
            return AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                Number(component?.rotation || 0)
            )
        }

        if (
            AltiumScene3dPlacementRotationPolicy.#shouldUseDfnFootprintYaw(
                placement,
                component,
                componentBody,
                pads,
                identityText
            )
        ) {
            return AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                Number(component?.rotation || 0)
            )
        }

        return null
    }

    /**
     * Detects square IC packages whose embedded source frame places the
     * pin-one marker opposite the rendered footprint.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #needsSquarePinOneCorrection(context) {
        const { placement, component, componentBody, pads } = context || {}
        if (
            !AltiumScene3dPlacementRotationPolicy.#supportsSquarePinOneProjection(
                context
            ) ||
            !component ||
            AltiumScene3dPlacementRotationPolicy.#isGenericPassiveBody(
                componentBody
            )
        ) {
            return false
        }

        return PIN_ONE_CORNER_PACKAGE_PATTERN.test(
            AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                component,
                componentBody
            )
        )
            ? AltiumScene3dPlacementRotationPolicy.#hasSquarePinOneFrameMismatch(
                  placement,
                  component,
                  componentBody,
                  pads
              )
            : false
    }

    /**
     * Checks whether a square package side/source-frame combination needs a
     * half-turn to align model pin one with the footprint convention.
     * @param {object | undefined} placement External model placement.
     * @param {object} component PCB component.
     * @param {object | null | undefined} componentBody Source component body.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasSquarePinOneFrameMismatch(
        placement,
        component,
        componentBody,
        pads
    ) {
        const mountSide = String(placement?.mountSide || '').toLowerCase()
        if (mountSide === 'top') {
            if (
                !AltiumScene3dPlacementRotationPolicy.#isPadFallback(placement)
            ) {
                if (
                    AltiumScene3dPlacementRotationPolicy.#hasEmbeddedModelBoundsSourceHalfTurn(
                        placement,
                        component
                    ) ||
                    !AltiumScene3dPlacementRotationPolicy.#sourceYawMatchesComponentYaw(
                        placement,
                        component,
                        componentBody
                    )
                ) {
                    return true
                }

                return (
                    (AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                        componentBody
                    ) &&
                        AltiumScene3dQfnFootprintDetector.hasExposedPadPerimeterSequence(
                            component,
                            pads
                        )) ||
                    AltiumScene3dPlacementRotationPolicy.#surfacePads(
                        component,
                        pads
                    ).length === 0
                )
            }
            if (
                AltiumScene3dPlacementRotationPolicy.#hasEmbeddedModelBoundsSourceHalfTurn(
                    placement,
                    component
                ) ||
                !AltiumScene3dPlacementRotationPolicy.#sourceYawMatchesComponentYaw(
                    placement,
                    component,
                    componentBody
                )
            ) {
                return true
            }

            return (
                AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                    componentBody
                ) &&
                AltiumScene3dQfnFootprintDetector.hasExposedPadPerimeterSequence(
                    component,
                    pads
                )
            )
        }

        return (
            mountSide === 'bottom' &&
            AltiumScene3dPlacementRotationPolicy.#isPadFallback(placement) &&
            AltiumScene3dPlacementRotationPolicy.#hasBottomPinOneFrame(
                componentBody
            ) &&
            AltiumScene3dPlacementRotationPolicy.#isHalfTurnAngle(
                placement?.rotationDeg
            ) &&
            AltiumScene3dPlacementRotationPolicy.#isHalfTurnAngle(
                component?.rotation
            ) &&
            AltiumScene3dPlacementRotationPolicy.#isHalfTurnAngle(
                componentBody?.modelRotationDeg?.z ??
                    placement?.modelTransform?.rotationDeg?.z
            )
        )
    }

    /**
     * Checks whether a bottom-side square package source frame needs the
     * mirrored pin-one comparison path.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #hasBottomPinOneFrame(componentBody) {
        return AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
            componentBody
        )
    }

    /**
     * Detects two-row IC packages whose embedded source frame puts the
     * package pin-one corner opposite the footprint convention.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[] }} context Rotation context.
     * @returns {boolean}
     */
    static #needsTwoRowPinOneCorrection(context) {
        const { placement, component, componentBody, pads } = context || {}
        if (
            !AltiumScene3dPlacementRotationPolicy.#isPadFallback(placement) ||
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            AltiumScene3dPlacementRotationPolicy.#isGenericPassiveBody(
                componentBody
            ) ||
            !AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                componentBody
            )
        ) {
            return false
        }

        const identityText =
            AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                component,
                componentBody
            )
        if (!TWO_ROW_PIN_ONE_PACKAGE_PATTERN.test(identityText)) {
            return false
        }

        return AltiumScene3dTwoRowFootprintDetector.hasTwoRowSurfaceFootprint(
            component,
            pads
        )
    }

    /**
     * Checks whether a DFN-style pad-fallback body should follow footprint yaw.
     * @param {object | undefined} placement External model placement.
     * @param {object} component PCB component.
     * @param {object | null | undefined} componentBody Source component body.
     * @param {object[]} pads Source PCB pads.
     * @param {string} identityText Package metadata text.
     * @returns {boolean}
     */
    static #shouldUseDfnFootprintYaw(
        placement,
        component,
        componentBody,
        pads,
        identityText
    ) {
        return (
            String(placement?.mountSide || '').toLowerCase() === 'top' &&
            AltiumScene3dPlacementRotationPolicy.#isFootprintDerivedProjection(
                placement
            ) &&
            String(placement?.externalModel?.origin || '').toLowerCase() ===
                'embedded' &&
            DFN_FOOTPRINT_YAW_PATTERN.test(identityText) &&
            AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                componentBody
            ) &&
            !AltiumScene3dPlacementRotationPolicy.#sourceYawMatchesComponentYaw(
                placement,
                component,
                componentBody
            ) &&
            AltiumScene3dTwoRowFootprintDetector.hasTwoRowSurfaceFootprint(
                component,
                pads
            )
        )
    }

    /**
     * Checks whether placement projection came from footprint geometry or
     * footprint-matched model bounds.
     * @param {object | undefined} placement External placement.
     * @returns {boolean}
     */
    static #isFootprintDerivedProjection(placement) {
        return ['pad-fallback', 'model-bounds'].includes(
            String(placement?.projection?.source || '').toLowerCase()
        )
    }

    /**
     * Detects two-column power DFN footprints where one side is a tied power
     * row and the opposite side has a single isolated control pad at one end.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasPowerDfnPinOneEndPattern(component, pads) {
        const surfacePads = AltiumScene3dPlacementRotationPolicy.#surfacePads(
            component,
            pads
        )
        if (surfacePads.length !== 8) {
            return false
        }

        const xSpread = AltiumScene3dPlacementRotationPolicy.#spread(
            surfacePads,
            'x'
        )
        const ySpread = AltiumScene3dPlacementRotationPolicy.#spread(
            surfacePads,
            'y'
        )
        const sideAxis = xSpread >= ySpread ? 'x' : 'y'
        const endAxis = sideAxis === 'x' ? 'y' : 'x'
        const sides = AltiumScene3dPlacementRotationPolicy.#splitByMidpoint(
            surfacePads,
            sideAxis
        )
        if (sides.lower.length !== 4 || sides.upper.length !== 4) {
            return false
        }

        return (
            (AltiumScene3dPlacementRotationPolicy.#hasUniformNet(sides.lower) &&
                AltiumScene3dPlacementRotationPolicy.#hasThreePlusIsolatedEndNet(
                    sides.upper,
                    endAxis
                )) ||
            (AltiumScene3dPlacementRotationPolicy.#hasUniformNet(sides.upper) &&
                AltiumScene3dPlacementRotationPolicy.#hasThreePlusIsolatedEndNet(
                    sides.lower,
                    endAxis
                ))
        )
    }

    /**
     * Splits pads into two side groups around one axis midpoint.
     * @param {object[]} pads Source PCB pads.
     * @param {'x' | 'y'} axis Axis key.
     * @returns {{ lower: object[], upper: object[] }}
     */
    static #splitByMidpoint(pads, axis) {
        const values = pads.map((pad) => Number(pad?.[axis] || 0))
        const midpoint = (Math.min(...values) + Math.max(...values)) / 2

        return {
            lower: pads.filter((pad) => Number(pad?.[axis] || 0) <= midpoint),
            upper: pads.filter((pad) => Number(pad?.[axis] || 0) > midpoint)
        }
    }

    /**
     * Checks whether every pad in a side group shares one routed net.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasUniformNet(pads) {
        const netKeys = pads
            .map((pad) => AltiumScene3dPlacementRotationPolicy.#netKey(pad))
            .filter(Boolean)

        return netKeys.length === pads.length && new Set(netKeys).size === 1
    }

    /**
     * Checks for a side group with three tied pads plus one isolated end pad.
     * @param {object[]} pads Source PCB pads.
     * @param {'x' | 'y'} endAxis Axis that orders pins along a side.
     * @returns {boolean}
     */
    static #hasThreePlusIsolatedEndNet(pads, endAxis) {
        const groups = new Map()
        for (const pad of pads) {
            const netKey = AltiumScene3dPlacementRotationPolicy.#netKey(pad)
            if (!netKey) {
                return false
            }

            groups.set(netKey, [...(groups.get(netKey) || []), pad])
        }

        const groupSizes = [...groups.values()]
            .map((group) => group.length)
            .sort((a, b) => a - b)
        if (
            groupSizes.length !== 2 ||
            groupSizes[0] !== 1 ||
            groupSizes[1] !== 3
        ) {
            return false
        }

        const isolatedPad = [...groups.values()].find(
            (group) => group.length === 1
        )?.[0]
        const orderedValues = pads.map((pad) => Number(pad?.[endAxis] || 0))
        const isolatedValue = Number(isolatedPad?.[endAxis] || 0)

        return (
            isolatedValue === Math.min(...orderedValues) ||
            isolatedValue === Math.max(...orderedValues)
        )
    }

    /**
     * Builds a stable routed-net key for grouping footprint pads.
     * @param {object} pad Source PCB pad.
     * @returns {string}
     */
    static #netKey(pad) {
        const netName = String(pad?.netName || '').trim()
        if (netName) {
            return 'name:' + netName
        }

        const netIndex = Number(pad?.netIndex)
        return Number.isFinite(netIndex) ? 'index:' + netIndex : ''
    }

    /**
     * Checks whether a source package yaw already matches the footprint and
     * does not need another pin-one half-turn.
     * @param {object | undefined} placement External model placement.
     * @param {object} component PCB component.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #sourceYawMatchesComponentYaw(placement, component, componentBody) {
        const componentYaw =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                Number(component?.rotation || 0)
            )
        const placementYaw =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                Number(placement?.rotationDeg || 0)
            )
        const bodyYaw = AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
            Number(
                componentBody?.modelRotationDeg?.z ??
                    placement?.modelTransform?.rotationDeg?.z ??
                    placement?.rotationDeg ??
                    0
            )
        )

        return placementYaw === componentYaw || bodyYaw === componentYaw
    }

    /**
     * Detects exact five-lead SOT packages whose STEP source pin-one
     * convention is opposite the asymmetric footprint pad convention.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[], isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #needsFiveLeadSotCorrection(context) {
        const { placement, component, componentBody, pads } = context || {}
        if (
            !AltiumScene3dPlacementRotationPolicy.#isAnchoredOrPadFallback(
                context
            ) ||
            !component ||
            !FIVE_LEAD_SOT_PATTERN.test(
                AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                    component,
                    componentBody
                )
            )
        ) {
            return false
        }

        if (
            !AltiumScene3dPlacementRotationPolicy.#hasAsymmetricFivePads(
                component,
                pads
            )
        ) {
            return false
        }

        if (
            AltiumScene3dPlacementRotationPolicy.#hasEmbeddedModelBoundsSourceHalfTurn(
                placement,
                component
            ) ||
            !AltiumScene3dPlacementRotationPolicy.#sourceYawMatchesComponentYaw(
                placement,
                component,
                componentBody
            )
        ) {
            return true
        }

        return AltiumScene3dPlacementRotationPolicy.#hasTopQuarterTurnFiveLeadSotPinSideMismatch(
            placement,
            component,
            componentBody,
            pads
        )
    }

    /**
     * Checks for layerless top SOT23-5 source frames whose yaw equals the
     * component yaw but whose horizontal asymmetric pad row needs a half-turn.
     * @param {object | undefined} placement External model placement.
     * @param {object} component PCB component.
     * @param {object | null | undefined} componentBody Source component body.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasTopQuarterTurnFiveLeadSotPinSideMismatch(
        placement,
        component,
        componentBody,
        pads
    ) {
        const mountSide = String(placement?.mountSide || '').toLowerCase()
        const componentYaw =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                Number(component?.rotation || 0)
            )
        const bodyYaw = AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
            Number(
                componentBody?.modelRotationDeg?.z ??
                    placement?.modelTransform?.rotationDeg?.z ??
                    placement?.rotationDeg ??
                    0
            )
        )
        const surfacePads = AltiumScene3dPlacementRotationPolicy.#surfacePads(
            component,
            pads
        )

        return (
            mountSide === 'top' &&
            AltiumScene3dPlacementRotationPolicy.#isPadFallback(placement) &&
            String(componentBody?.layer || '').trim() === '' &&
            String(componentBody?.sourceStream || '').includes(
                'ShapeBasedComponentBodies'
            ) &&
            AltiumScene3dPlacementRotationPolicy.#isQuarterTurnAngle(
                componentYaw
            ) &&
            bodyYaw === componentYaw &&
            surfacePads.length === 5 &&
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'y') >
                AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'x')
        )
    }

    /**
     * Detects top-side SOT23-3 packages whose embedded source pin side is
     * opposite the asymmetric footprint pad convention.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[], isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #needsThreeLeadSot23Correction(context) {
        const { placement, component, componentBody, pads } = context || {}
        if (
            !AltiumScene3dPlacementRotationPolicy.#isAnchoredOrPadFallback(
                context
            ) ||
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top'
        ) {
            return false
        }

        const identityText =
            AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                component,
                componentBody
            )
        if (!THREE_LEAD_SOT23_PATTERN.test(identityText)) {
            return false
        }
        if (
            AltiumScene3dPlacementRotationPolicy.#sourceYawMatchesComponentYaw(
                placement,
                component,
                componentBody
            )
        ) {
            return false
        }

        return AltiumScene3dPlacementRotationPolicy.#hasAsymmetricThreePads(
            component,
            pads
        )
    }

    /**
     * Detects display modules whose full model-bounds source was authored from
     * the connector edge but currently extends away from its pad row.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[] }} context Rotation context.
     * @returns {boolean}
     */
    static #needsDisplayModelBoundsEdgeCorrection(context) {
        const { placement, component, componentBody, pads } = context || {}
        if (!component) {
            return false
        }

        return AltiumScene3dDisplayModuleYawPolicy.shouldReverseModelBoundsYaw({
            placement,
            component,
            pads,
            identityText:
                AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                    component,
                    componentBody
                )
        })
    }

    /**
     * Detects top-side edge connectors whose tilted model frame points inward
     * unless the authored board-facing yaw is reversed.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null }} context Rotation context.
     * @returns {boolean}
     */
    static #needsTiltedEdgeCorrection(context) {
        const { placement, component, componentBody } = context || {}
        if (
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            !AltiumScene3dPlacementRotationPolicy.#hasInEnvelopeNegativeStandoff(
                componentBody
            ) ||
            !AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                componentBody
            )
        ) {
            return false
        }

        const identityText =
            AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                component,
                componentBody
            )

        return (
            AltiumScene3dPlacementRotationPolicy.#edgeConnectorTokenCount(
                identityText
            ) >= 2
        )
    }

    /**
     * Detects top-side through-hole connectors whose embedded source frame is
     * aligned numerically but board-facing backwards after source mirroring.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[], isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #needsAlignedThroughHoleConnectorCorrection(context) {
        const { placement, component, componentBody, pads } = context || {}
        const hasAuthoredProjection =
            AltiumScene3dPlacementRotationPolicy.#isAuthoredOrAnchoredProjection(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#isModelBoundsProjection(
                placement
            )

        if (
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            String(placement?.externalModel?.origin || '').toLowerCase() !==
                'embedded' ||
            !hasAuthoredProjection ||
            !AltiumScene3dPlacementRotationPolicy.#hasAuthoredBodyYaw(
                componentBody
            ) ||
            !AltiumScene3dPlacementRotationPolicy.#sourceYawMatchesComponentYaw(
                placement,
                component,
                componentBody
            )
        ) {
            return false
        }

        const identityText =
            AltiumScene3dPlacementRotationPolicy.#packageIdentityText(
                component,
                componentBody
            )
        if (!THROUGH_HOLE_CONNECTOR_PATTERN.test(identityText)) {
            return false
        }

        return AltiumScene3dPlacementRotationPolicy.#hasThroughHoleOnlyPads(
            component,
            pads
        )
    }

    /**
     * Checks whether one placement is exact-anchored or pad-fallback projected.
     * @param {{ placement?: object, isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #isAnchoredOrPadFallback(context) {
        return (
            Boolean(context?.isExactAnchoredOwner) ||
            AltiumScene3dPlacementRotationPolicy.#isPadFallback(
                context?.placement
            )
        )
    }

    /**
     * Checks whether one projection can use square-package pin-one correction.
     * @param {{ placement?: object, componentBody?: object | null, isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #supportsSquarePinOneProjection(context) {
        return (
            AltiumScene3dPlacementRotationPolicy.#isAnchoredOrPadFallback(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#isBottomModelBoundsProjection(
                context
            )
        )
    }

    /**
     * Checks whether a bottom-side embedded model-bounds projection still
     * carries the source-frame signals needed for pin-one normalization.
     * @param {{ placement?: object, componentBody?: object | null }} context Rotation context.
     * @returns {boolean}
     */
    static #isBottomModelBoundsProjection(context) {
        const placement = context?.placement || {}

        return (
            String(placement?.projection?.source || '').toLowerCase() ===
                'model-bounds' &&
            String(placement?.mountSide || '').toLowerCase() === 'bottom' &&
            String(placement?.externalModel?.origin || '').toLowerCase() ===
                'embedded' &&
            AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                context?.componentBody
            )
        )
    }

    /**
     * Checks whether a placement was synthesized from footprint pads.
     * @param {object | undefined} placement External model placement.
     * @returns {boolean}
     */
    static #isPadFallback(placement) {
        return String(placement?.projection?.source || '') === 'pad-fallback'
    }

    /**
     * Checks whether one projection keeps an authored Altium owner/body anchor.
     * @param {{ placement?: object, isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #isAuthoredOrAnchoredProjection(context) {
        const projectionSource = String(
            context?.placement?.projection?.source || ''
        ).toLowerCase()

        return (
            AltiumScene3dPlacementRotationPolicy.#isAnchoredOrPadFallback(
                context
            ) || projectionSource === 'authored-body-anchor'
        )
    }

    /**
     * Checks whether one placement was projected from resolved model bounds.
     * @param {object | undefined} placement External model placement.
     * @returns {boolean}
     */
    static #isModelBoundsProjection(placement) {
        return (
            String(placement?.projection?.source || '').toLowerCase() ===
            'model-bounds'
        )
    }

    /**
     * Checks whether recovered embedded model-bounds metadata carries a source
     * yaw opposite the owning footprint yaw.
     * @param {object | undefined} placement External model placement.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #hasEmbeddedModelBoundsSourceHalfTurn(placement, component) {
        if (
            !AltiumScene3dPlacementRotationPolicy.#isModelBoundsProjection(
                placement
            ) ||
            String(placement?.externalModel?.origin || '').toLowerCase() !==
                'embedded'
        ) {
            return false
        }

        const sourceYaw = Number(
            placement?.externalModel?.transform?.rotationDeg?.z
        )
        if (!Number.isFinite(sourceYaw)) {
            return false
        }

        const componentYaw =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                Number(component?.rotation || 0)
            )

        return AltiumScene3dPlacementRotationPolicy.#isHalfTurnAngle(
            sourceYaw - componentYaw
        )
    }

    /**
     * Checks whether a component owns an asymmetric five-pad footprint.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasAsymmetricFivePads(component, pads) {
        const surfacePads = AltiumScene3dPlacementRotationPolicy.#surfacePads(
            component,
            pads
        )
        if (surfacePads.length !== 5) {
            return false
        }

        const axis =
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'x') >=
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'y')
                ? 'x'
                : 'y'
        const values = surfacePads.map((pad) => Number(pad?.[axis] || 0))
        const midpoint = (Math.min(...values) + Math.max(...values)) / 2
        const lowerCount = values.filter((value) => value <= midpoint).length
        const upperCount = values.length - lowerCount

        return (
            Math.min(lowerCount, upperCount) === 2 &&
            Math.max(lowerCount, upperCount) === 3
        )
    }

    /**
     * Checks whether a component owns a three-pad footprint split 2+1 across
     * the package width.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasAsymmetricThreePads(component, pads) {
        const surfacePads = AltiumScene3dPlacementRotationPolicy.#surfacePads(
            component,
            pads
        )
        if (surfacePads.length !== 3) {
            return false
        }

        const axis =
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'x') >=
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'y')
                ? 'x'
                : 'y'
        const values = surfacePads.map((pad) => Number(pad?.[axis] || 0))
        const midpoint = (Math.min(...values) + Math.max(...values)) / 2
        const lowerCount = values.filter((value) => value <= midpoint).length
        const upperCount = values.length - lowerCount

        return (
            Math.min(lowerCount, upperCount) === 1 &&
            Math.max(lowerCount, upperCount) === 2
        )
    }

    /**
     * Checks whether a component owns a two-terminal surface footprint.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasPassiveFootprint(component, pads) {
        return (
            AltiumScene3dPlacementRotationPolicy.#surfacePads(component, pads)
                .length >= 2
        )
    }

    /**
     * Checks whether passive pad geometry should override the authored yaw.
     * @param {object} component PCB component.
     * @param {string} identityText Package metadata text.
     * @param {object | undefined} placement External model placement.
     * @returns {boolean}
     */
    static #shouldUsePassiveFootprintYaw(component, identityText, placement) {
        return (
            AltiumScene3dPlacementRotationPolicy.#hasLocalYPassiveModel(
                identityText,
                placement
            ) ||
            !AltiumScene3dPlacementRotationPolicy.#isRightAngle(
                Number(component?.rotation || 0)
            )
        )
    }

    /**
     * Resolves a passive package yaw from the solder pad axis.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @param {string} identityText Package metadata text.
     * @param {object | undefined} placement External model placement.
     * @returns {number | null}
     */
    static #resolvePassiveFootprintYaw(
        component,
        pads,
        identityText,
        placement
    ) {
        const surfacePads = AltiumScene3dPlacementRotationPolicy.#surfacePads(
            component,
            pads
        )
        const componentYaw =
            AltiumScene3dPlacementRotationPolicy.#sourceFrameAngle(
                Number(component?.rotation || 0),
                placement
            )
        const modelAxisOffset =
            AltiumScene3dPlacementRotationPolicy.#passiveModelAxisOffset(
                identityText,
                placement
            )

        if (surfacePads.length === 2) {
            const angle =
                (Math.atan2(
                    Number(surfacePads[1]?.y || 0) -
                        Number(surfacePads[0]?.y || 0),
                    Number(surfacePads[1]?.x || 0) -
                        Number(surfacePads[0]?.x || 0)
                ) *
                    180) /
                Math.PI

            return AltiumScene3dPlacementRotationPolicy.#nearestLineAngle(
                componentYaw,
                AltiumScene3dPlacementRotationPolicy.#sourceFrameAngle(
                    angle,
                    placement
                ) + modelAxisOffset
            )
        }

        const lineAngle =
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'x') >=
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'y')
                ? 0
                : 90

        return AltiumScene3dPlacementRotationPolicy.#nearestLineAngle(
            componentYaw,
            AltiumScene3dPlacementRotationPolicy.#sourceFrameAngle(
                lineAngle,
                placement
            ) + modelAxisOffset
        )
    }

    /**
     * Returns the model-yaw offset needed to place the body long axis on pads.
     * @param {string} identityText Package metadata text.
     * @param {object | undefined} placement External model placement.
     * @returns {number}
     */
    static #passiveModelAxisOffset(identityText, placement) {
        return AltiumScene3dPlacementRotationPolicy.#hasLocalYPassiveModel(
            identityText,
            placement
        )
            ? -90
            : 0
    }

    /**
     * Checks whether metadata identifies a local-Y chip passive model.
     * @param {string} identityText Package metadata text.
     * @param {object | undefined} placement External model placement.
     * @returns {boolean}
     */
    static #hasLocalYPassiveModel(identityText, placement) {
        const modelText = [
            placement?.model,
            placement?.externalModel?.name,
            placement?.externalModel?.relativePath,
            placement?.externalModel?.sourcePath
        ]
            .map((value) => String(value || ''))
            .join(' ')
        if (
            CHIP_PASSIVE_BODY_PATTERN.test(identityText) &&
            LOCAL_Y_CHIP_PASSIVE_MODEL_PATTERN.test(modelText)
        ) {
            return true
        }

        return false
    }

    /**
     * Converts a board-space visual angle into the model source frame used for
     * embedded Altium STEP placements.
     * @param {number} angle Board-space visual angle.
     * @param {object | undefined} placement External model placement.
     * @returns {number}
     */
    static #sourceFrameAngle(angle, placement) {
        return AltiumScene3dPlacementRotationPolicy.#usesEmbeddedSourceMirror(
            placement
        )
            ? -Number(angle || 0)
            : Number(angle || 0)
    }

    /**
     * Checks whether runtime rendering mirrors the embedded source frame before
     * applying placement yaw.
     * @param {object | undefined} placement External model placement.
     * @returns {boolean}
     */
    static #usesEmbeddedSourceMirror(placement) {
        return (
            String(placement?.externalModel?.origin || '').toLowerCase() ===
            'embedded'
        )
    }

    /**
     * Resolves compact SOT yaw from the two pad rows.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @param {string} identityText Package metadata text.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {number | null}
     */
    static #resolveSotFootprintYaw(
        component,
        pads,
        identityText,
        componentBody
    ) {
        const surfacePads = AltiumScene3dPlacementRotationPolicy.#surfacePads(
            component,
            pads
        )
        if (surfacePads.length < 3) {
            return null
        }

        const componentYaw =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                Number(component?.rotation || 0)
            )
        const rowSpacingAxis =
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'x') >=
            AltiumScene3dPlacementRotationPolicy.#spread(surfacePads, 'y')
                ? 'x'
                : 'y'
        const bodyLongAxisAngle = rowSpacingAxis === 'x' ? 90 : 0
        const modelYaw =
            AltiumScene3dPlacementRotationPolicy.#usesSourceXLongAxisSot(
                identityText,
                componentBody
            )
                ? bodyLongAxisAngle
                : bodyLongAxisAngle - 90
        const bottomFlatTieYaw =
            AltiumScene3dPlacementRotationPolicy.#resolveBottomFlatThreeLeadSotTieYaw(
                component,
                surfacePads,
                identityText,
                componentBody,
                componentYaw,
                modelYaw
            )
        if (bottomFlatTieYaw !== null) {
            return bottomFlatTieYaw
        }

        return AltiumScene3dPlacementRotationPolicy.#nearestLineAngle(
            componentYaw,
            modelYaw
        )
    }

    /**
     * Resolves the mirrored component pin side for flat bottom-side SOT23-3 source
     * models when long-axis alignment has an exact 180-degree tie.
     * @param {object} component PCB component.
     * @param {object[]} surfacePads Surface pads owned by the component.
     * @param {string} identityText Package metadata text.
     * @param {object | null | undefined} componentBody Source component body.
     * @param {number} componentYaw Component yaw.
     * @param {number} modelYaw Candidate footprint yaw.
     * @returns {number | null}
     */
    static #resolveBottomFlatThreeLeadSotTieYaw(
        component,
        surfacePads,
        identityText,
        componentBody,
        componentYaw,
        modelYaw
    ) {
        if (
            !THREE_LEAD_SOT23_PATTERN.test(identityText) ||
            surfacePads.length !== 3 ||
            !AltiumScene3dPlacementRotationPolicy.#isBottomComponent(
                component
            ) ||
            AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                componentBody
            ) ||
            !AltiumScene3dPlacementRotationPolicy.#usesSourceXLongAxisSot(
                identityText,
                componentBody
            )
        ) {
            return null
        }

        const normalizedModelYaw =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(modelYaw)
        const oppositeModelYaw =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                normalizedModelYaw + 180
            )
        const modelDistance =
            AltiumScene3dPlacementRotationPolicy.#angleDistance(
                componentYaw,
                normalizedModelYaw
            )
        const oppositeDistance =
            AltiumScene3dPlacementRotationPolicy.#angleDistance(
                componentYaw,
                oppositeModelYaw
            )

        return Math.abs(modelDistance - oppositeDistance) < 0.001
            ? AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                  componentYaw + 180
              )
            : null
    }

    /**
     * Checks whether SOT pad geometry should override the authored yaw.
     * @param {object | undefined} placement External model placement.
     * @param {string} identityText Package metadata text.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #shouldUseSotFootprintYaw(placement, identityText, componentBody) {
        return (
            String(placement?.mountSide || '').toLowerCase() === 'bottom' &&
            AltiumScene3dPlacementRotationPolicy.#usesSourceXLongAxisSot(
                identityText,
                componentBody
            )
        )
    }

    /**
     * Checks whether a compact SOT source model uses local X as its long body
     * axis after the authored Altium tilt is applied.
     * @param {string} identityText Package metadata text.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #usesSourceXLongAxisSot(identityText, componentBody) {
        const modelYaw = AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
            Number(componentBody?.modelRotationDeg?.z || 0)
        )

        if (
            FLAT_SOURCE_X_SOT_PATTERN.test(identityText) &&
            !AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                componentBody
            ) &&
            (modelYaw === 90 || modelYaw === 270)
        ) {
            return true
        }

        return (
            SOT523_PACKAGE_PATTERN.test(identityText) &&
            AltiumScene3dPlacementRotationPolicy.#hasRightAngleModelTilt(
                componentBody
            ) &&
            modelYaw === 90
        )
    }

    /**
     * Checks whether a component owns a compact SOT-style surface footprint.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasSmallSotFootprint(component, pads) {
        const surfacePads = AltiumScene3dPlacementRotationPolicy.#surfacePads(
            component,
            pads
        )

        return surfacePads.length >= 3 && surfacePads.length <= 8
    }

    /**
     * Collects surface pads owned by one component.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {object[]}
     */
    static #surfacePads(component, pads) {
        const ownedPads = AltiumScene3dPlacementRotationPolicy.#ownedPads(
            component,
            pads
        )
        const bottom =
            String(component?.layer || '')
                .toUpperCase()
                .includes('BOTTOM') ||
            String(component?.layer || '').toUpperCase() === 'BOT'
        const surfacePads = ownedPads.filter((pad) =>
            bottom
                ? Boolean(pad?.hasBottomPasteMaskOpening)
                : Boolean(pad?.hasTopPasteMaskOpening)
        )

        return surfacePads.length ? surfacePads : ownedPads
    }

    /**
     * Checks whether one component has only directional through-hole pads.
     * @param {object} component PCB component.
     * @param {object[] | undefined} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasThroughHoleOnlyPads(component, pads) {
        const measurablePads = AltiumScene3dPlacementRotationPolicy.#ownedPads(
            component,
            pads
        ).filter((pad) =>
            AltiumScene3dPlacementRotationPolicy.#hasMeasurablePadSize(pad)
        )
        if (measurablePads.length < 2) {
            return false
        }

        return measurablePads.every(
            (pad) =>
                AltiumScene3dPlacementRotationPolicy.#hasDrilledPadOpening(
                    pad
                ) &&
                !pad?.hasTopPasteMaskOpening &&
                !pad?.hasBottomPasteMaskOpening
        )
    }

    /**
     * Returns pads owned by one component index.
     * @param {object} component PCB component.
     * @param {object[] | undefined} pads Source PCB pads.
     * @returns {object[]}
     */
    static #ownedPads(component, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return []
        }

        return (Array.isArray(pads) ? pads : []).filter(
            (pad) => Number(pad?.componentIndex) === componentIndex
        )
    }

    /**
     * Checks whether one pad exposes enough physical size to guide yaw.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #hasMeasurablePadSize(pad) {
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

        return width > 0 && depth > 0
    }

    /**
     * Checks whether one pad is drilled or otherwise through-hole-like.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #hasDrilledPadOpening(pad) {
        return (
            Number(pad?.holeDiameter || 0) > 0 ||
            Number(pad?.holeSize || 0) > 0 ||
            Number(pad?.drillDiameter || 0) > 0 ||
            Number(pad?.holeShape || 0) > 0 ||
            Number(pad?.layerCode || 0) > 16
        )
    }

    /**
     * Checks whether a source component is mounted on the PCB bottom.
     * @param {object | null | undefined} component PCB component.
     * @returns {boolean}
     */
    static #isBottomComponent(component) {
        const layer = String(component?.layer || '').toUpperCase()

        return layer.includes('BOTTOM') || layer === 'BOT'
    }

    /**
     * Measures pad center spread on one axis.
     * @param {object[]} pads Source PCB pads.
     * @param {'x' | 'y'} axis Axis key.
     * @returns {number}
     */
    static #spread(pads, axis) {
        const values = pads.map((pad) => Number(pad?.[axis] || 0))

        return Math.max(...values) - Math.min(...values)
    }

    /**
     * Checks whether a body has an intentional negative standoff within its
     * own height envelope.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #hasInEnvelopeNegativeStandoff(componentBody) {
        const standoff = Number(
            componentBody?.standoffHeightMil ?? componentBody?.dzMil
        )
        const overallHeight = Number(componentBody?.overallHeightMil)

        return (
            Number.isFinite(standoff) &&
            Number.isFinite(overallHeight) &&
            standoff < 0 &&
            overallHeight > 0 &&
            Math.abs(standoff) < overallHeight
        )
    }

    /**
     * Checks whether the source model is laid over with a right-angle tilt.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #hasRightAngleModelTilt(componentBody) {
        const angle = AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
            Number(componentBody?.modelRotationDeg?.x || 0)
        )

        return angle === 90 || angle === 270
    }

    /**
     * Checks whether one body row carries an explicit board-facing yaw.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #hasAuthoredBodyYaw(componentBody) {
        return Number.isFinite(Number(componentBody?.modelRotationDeg?.z))
    }

    /**
     * Counts generic edge-connector identity tokens in package metadata.
     * @param {string} identityText Package metadata text.
     * @returns {number}
     */
    static #edgeConnectorTokenCount(identityText) {
        return new Set(
            String(identityText || '')
                .split(/[^a-zA-Z0-9]+/g)
                .map((token) => token.toLowerCase())
                .filter((token) => EDGE_CONNECTOR_TOKENS.has(token))
        ).size
    }

    /**
     * Checks whether a body is a generic passive package where body yaw is safe.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #isGenericPassiveBody(componentBody) {
        return PASSIVE_BODY_PATTERN.test(
            [componentBody?.identifier, componentBody?.name].join(' ')
        )
    }

    /**
     * Builds package metadata text for generic package-family checks.
     * @param {object} component PCB component.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {string}
     */
    static #packageIdentityText(component, componentBody) {
        const parameterValues = Object.values(component?.parameters || {})
            .map((value) => String(value || ''))
            .join(' ')

        return [
            component?.designator,
            component?.pattern,
            component?.source,
            component?.modelPath,
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
     * Normalizes an angle into [0, 360).
     * @param {number} angle Source angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }

    /**
     * Checks whether an angle is a half-turn after normalization.
     * @param {number} angle Source angle.
     * @returns {boolean}
     */
    static #isHalfTurnAngle(angle) {
        return (
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(angle) === 180
        )
    }

    /**
     * Checks whether an angle is a quarter-turn after normalization.
     * @param {number} angle Source angle.
     * @returns {boolean}
     */
    static #isQuarterTurnAngle(angle) {
        const normalized =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(angle)

        return normalized === 90 || normalized === 270
    }

    /**
     * Checks whether an angle is a standard orthogonal footprint yaw.
     * @param {number} angle Source angle.
     * @returns {boolean}
     */
    static #isRightAngle(angle) {
        return (
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(angle) % 90 ===
            0
        )
    }

    /**
     * Chooses the equivalent 180-degree line angle closest to a reference yaw.
     * @param {number} referenceAngle Reference yaw.
     * @param {number} lineAngle Axis angle.
     * @returns {number}
     */
    static #nearestLineAngle(referenceAngle, lineAngle) {
        const normalizedReference =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(referenceAngle)
        const normalizedLine =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(lineAngle)
        const oppositeLine =
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                normalizedLine + 180
            )

        return AltiumScene3dPlacementRotationPolicy.#angleDistance(
            normalizedReference,
            normalizedLine
        ) <=
            AltiumScene3dPlacementRotationPolicy.#angleDistance(
                normalizedReference,
                oppositeLine
            )
            ? normalizedLine
            : oppositeLine
    }

    /**
     * Returns the shortest distance between two normalized angles.
     * @param {number} firstAngle First angle.
     * @param {number} secondAngle Second angle.
     * @returns {number}
     */
    static #angleDistance(firstAngle, secondAngle) {
        const delta = Math.abs(
            AltiumScene3dPlacementRotationPolicy.#normalizeAngle(firstAngle) -
                AltiumScene3dPlacementRotationPolicy.#normalizeAngle(
                    secondAngle
                )
        )

        return Math.min(delta, 360 - delta)
    }
}
