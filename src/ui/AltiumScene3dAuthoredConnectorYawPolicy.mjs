/**
 * Decides when explicit Altium connector-body yaw should win over footprint
 * rotation for off-anchor 3D bodies.
 */
export class AltiumScene3dAuthoredConnectorYawPolicy {
    static #CONNECTOR_OWNER_PATTERN =
        /(?:pin\s*header|pinheader|header|connector|socket|fpc|flex|jtag)/i

    /**
     * Checks whether an offset connector body should keep Altium's authored
     * body yaw instead of adopting the footprint yaw.
     * @param {{ placement?: object, component?: object | null, pads?: object[], ownerOffsetToleranceMil?: number }} context Placement context.
     * @returns {boolean}
     */
    static shouldPreserve(context) {
        const placement = context?.placement
        const component = context?.component
        const ownerOffsetToleranceMil = Number(
            context?.ownerOffsetToleranceMil || 0
        )

        if (
            !component ||
            !AltiumScene3dAuthoredConnectorYawPolicy.#supportsProjection(
                placement
            ) ||
            AltiumScene3dAuthoredConnectorYawPolicy.#distanceToBody(
                placement,
                component
            ) <= ownerOffsetToleranceMil ||
            !AltiumScene3dAuthoredConnectorYawPolicy.#hasConnectorOwnerIdentity(
                component
            )
        ) {
            return false
        }

        return AltiumScene3dAuthoredConnectorYawPolicy.#hasSingleRowPadGeometry(
            component,
            context?.pads
        )
    }

    /**
     * Checks whether one projection can carry an authored off-center connector
     * source yaw.
     * @param {object | null | undefined} placement External placement.
     * @returns {boolean}
     */
    static #supportsProjection(placement) {
        const source = String(placement?.projection?.source || '').toLowerCase()

        return source === 'pad-fallback' || source === 'model-bounds'
    }

    /**
     * Checks whether component metadata describes connector/header hardware.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #hasConnectorOwnerIdentity(component) {
        return AltiumScene3dAuthoredConnectorYawPolicy.#CONNECTOR_OWNER_PATTERN.test(
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
     * Checks whether owned pads form one long connector row.
     * @param {object} component PCB component.
     * @param {object[] | undefined} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasSingleRowPadGeometry(component, pads) {
        const measurablePads =
            AltiumScene3dAuthoredConnectorYawPolicy.#componentPads(
                component,
                pads
            ).filter((pad) =>
                AltiumScene3dAuthoredConnectorYawPolicy.#isMeasurablePad(pad)
            )
        if (measurablePads.length < 3) {
            return false
        }

        const xs = measurablePads.map((pad) => Number(pad?.x || 0))
        const ys = measurablePads.map((pad) => Number(pad?.y || 0))
        const spreadX = Math.max(...xs) - Math.min(...xs)
        const spreadY = Math.max(...ys) - Math.min(...ys)
        const majorSpread = Math.max(spreadX, spreadY)
        const minorSpread = Math.min(spreadX, spreadY)
        const maxPadSpan = Math.max(
            ...measurablePads.map((pad) =>
                Math.max(
                    Number(pad?.sizeTopX || 0),
                    Number(pad?.sizeTopY || 0),
                    Number(pad?.sizeMidX || 0),
                    Number(pad?.sizeMidY || 0),
                    Number(pad?.sizeBottomX || 0),
                    Number(pad?.sizeBottomY || 0)
                )
            )
        )

        return (
            majorSpread >= Math.max(100, maxPadSpan * 3) &&
            minorSpread <= Math.max(10, maxPadSpan * 1.25)
        )
    }

    /**
     * Returns pads owned by one component index.
     * @param {object} component Owning component.
     * @param {object[] | undefined} pads Source PCB pads.
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
     * Measures planar distance from placement body anchor to component origin.
     * @param {object} placement External model placement.
     * @param {object} component PCB component.
     * @returns {number}
     */
    static #distanceToBody(placement, component) {
        const dx =
            Number(placement?.bodyPositionMil?.x || 0) -
            Number(component?.x || 0)
        const dy =
            Number(placement?.bodyPositionMil?.y || 0) -
            Number(component?.y || 0)

        return Math.hypot(dx, dy)
    }
}
