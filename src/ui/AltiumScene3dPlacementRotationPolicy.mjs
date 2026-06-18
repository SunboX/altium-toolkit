const PASSIVE_BODY_PATTERN =
    /(?:^|[^a-z0-9])(?:cap|capacitor|res|resistor|ind|inductor|ferrite|bead|crystal|xtal|lqw|lqg)(?:$|[^a-z0-9])/i
const PIN_ONE_CORNER_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:[avw]?qfn|vfqfn|wqfn|v?qfp|lqfp|tqfp|pqfp|mqfp)(?:[0-9]+)?(?:$|[^a-z0-9])/i
const FIVE_LEAD_SOT_PATTERN =
    /(?:^|[^a-z0-9])sot[-_ ]?(?:23[-_ ]?5|25|5)(?:$|[^a-z0-9])/i
const EDGE_CONNECTOR_TOKENS = new Set([
    'antenna',
    'coax',
    'connector',
    'edge',
    'rf',
    'sma',
    'socket'
])

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
            AltiumScene3dPlacementRotationPolicy.#needsFiveLeadSotCorrection(
                context
            ) ||
            AltiumScene3dPlacementRotationPolicy.#needsTiltedEdgeCorrection(
                context
            )
        )
    }

    /**
     * Detects square IC packages whose embedded source frame places the
     * pin-one marker opposite the rendered footprint.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #needsSquarePinOneCorrection(context) {
        const { placement, component, componentBody } = context || {}
        if (
            !AltiumScene3dPlacementRotationPolicy.#isAnchoredOrPadFallback(
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
                  componentBody
              )
            : false
    }

    /**
     * Checks whether a square package side/source-frame combination needs a
     * half-turn to align model pin one with the footprint convention.
     * @param {object | undefined} placement External model placement.
     * @param {object} component PCB component.
     * @param {object | null | undefined} componentBody Source component body.
     * @returns {boolean}
     */
    static #hasSquarePinOneFrameMismatch(placement, component, componentBody) {
        const mountSide = String(placement?.mountSide || '').toLowerCase()
        if (mountSide === 'top') {
            return true
        }

        return (
            mountSide === 'bottom' &&
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
     * Detects exact five-lead SOT packages whose STEP source pin-one
     * convention is opposite the asymmetric footprint pad convention.
     * @param {{ placement?: object, component?: object | null, componentBody?: object | null, pads?: object[], isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #needsFiveLeadSotCorrection(context) {
        const { component, componentBody, pads } = context || {}
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

        return AltiumScene3dPlacementRotationPolicy.#hasAsymmetricFivePads(
            component,
            pads
        )
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
     * Checks whether one placement is exact-anchored or pad-fallback projected.
     * @param {{ placement?: object, isExactAnchoredOwner?: boolean }} context Rotation context.
     * @returns {boolean}
     */
    static #isAnchoredOrPadFallback(context) {
        return (
            Boolean(context?.isExactAnchoredOwner) ||
            String(context?.placement?.projection?.source || '') ===
                'pad-fallback'
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
     * Collects surface pads owned by one component.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {object[]}
     */
    static #surfacePads(component, pads) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) {
            return []
        }

        const ownedPads = (Array.isArray(pads) ? pads : []).filter(
            (pad) => Number(pad?.componentIndex) === componentIndex
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
}
