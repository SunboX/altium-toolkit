const TIMING_BODY_IDENTITY_PATTERN =
    /(?:^|[^a-z0-9])(?:clock|crystal|osc|oscillator|resonator|tcxo|txco|xtal)(?:$|[^a-z0-9])/i
const STACK_DETAIL_BODY_IDENTITY_PATTERN =
    /(?:^|[^a-z0-9])(?:cap|capacitor|clock|crystal|ferrite|ind|inductor|osc|oscillator|res|resistor|resonator|tcxo|txco|xtal)(?:$|[^a-z0-9])/i
const TIMING_DESIGNATOR_PATTERN = /^(?:y|xo)\d+[a-z]?$/i
const TIMING_PARAMETER_NAME_PATTERN =
    /(?:^|[^a-z0-9])(?:comment|description|device|function|part|type|value)(?:$|[^a-z0-9])/i

/**
 * Resolves ambiguous ownership around authored Altium shape stacks.
 */
export class AltiumScene3dShapeStackOwnerConflictPolicy {
    /**
     * Checks whether a component is a timing-package owner.
     * @param {object} component Source component.
     * @returns {boolean}
     */
    static isTimingComponent(component) {
        const designator = String(component?.designator || '').trim()

        return (
            TIMING_DESIGNATOR_PATTERN.test(designator) ||
            TIMING_BODY_IDENTITY_PATTERN.test(
                AltiumScene3dShapeStackOwnerConflictPolicy.#timingIdentityText(
                    component
                )
            )
        )
    }

    /**
     * Scores how strongly a component looks like the fitted stack owner.
     * @param {object} component Source component.
     * @returns {number}
     */
    static ownerRank(component) {
        const parameters = Object.values(component?.parameters || {}).filter(
            (value) => String(value || '').trim()
        )
        return (
            parameters.length * 10 +
            (TIMING_DESIGNATOR_PATTERN.test(component?.designator) ? 5 : 0) +
            (TIMING_BODY_IDENTITY_PATTERN.test(
                [
                    component?.pattern,
                    component?.source,
                    component?.description,
                    component?.provenance?.footprintDescription
                ]
                    .map((value) => String(value || ''))
                    .join(' ')
            )
                ? 3
                : 0)
        )
    }

    /**
     * Keeps carrier stacks on the side of a clearly nearest timing owner.
     * @param {{ x?: number, y?: number }} anchor Carrier base anchor.
     * @param {object[]} owners Nearby timing owner candidates.
     * @param {number} oppositeSideMarginMil Required distance margin.
     * @returns {object[]}
     */
    static preferredSideOwners(anchor, owners, oppositeSideMarginMil) {
        const ownerRows = (Array.isArray(owners) ? owners : [])
            .map((owner) => ({
                owner,
                side: AltiumScene3dShapeStackOwnerConflictPolicy.#mountSide(
                    owner
                ),
                distance: AltiumScene3dShapeStackOwnerConflictPolicy.#distance(
                    anchor,
                    owner
                )
            }))
            .filter((row) => Number.isFinite(row.distance))
            .sort((left, right) => left.distance - right.distance)
        const nearest = ownerRows[0]
        if (!nearest) {
            return []
        }

        const oppositeSideNearest = ownerRows.find(
            (row) => row.side !== nearest.side
        )
        if (
            !oppositeSideNearest ||
            oppositeSideNearest.distance - nearest.distance <=
                Number(oppositeSideMarginMil || 0)
        ) {
            return owners
        }

        return owners.filter(
            (owner) =>
                AltiumScene3dShapeStackOwnerConflictPolicy.#mountSide(owner) ===
                nearest.side
        )
    }

    /**
     * Checks whether a raised body is better explained by a distinct
     * opposite-side component than by the candidate stack owner.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Source component-body row.
     * @param {object} stackOwner Candidate stack owner.
     * @param {object[]} components Source components.
     * @param {number} marginMil Required closer-owner distance margin.
     * @returns {boolean}
     */
    static hasConflictingComponentOwner(
        componentBody,
        stackOwner,
        components,
        marginMil
    ) {
        const bodyPosition = AltiumScene3dShapeStackOwnerConflictPolicy.#point(
            componentBody?.positionMil
        )
        const stackDistance =
            AltiumScene3dShapeStackOwnerConflictPolicy.#distance(
                bodyPosition,
                stackOwner
            )
        if (!Number.isFinite(stackDistance)) {
            return false
        }

        return (Array.isArray(components) ? components : []).some(
            (component) => {
                if (
                    String(component?.designator || '') ===
                    String(stackOwner?.designator || '')
                ) {
                    return false
                }
                if (
                    AltiumScene3dShapeStackOwnerConflictPolicy.#mountSide(
                        component
                    ) ===
                    AltiumScene3dShapeStackOwnerConflictPolicy.#mountSide(
                        stackOwner
                    )
                ) {
                    return false
                }

                const componentDistance =
                    AltiumScene3dShapeStackOwnerConflictPolicy.#distance(
                        bodyPosition,
                        component
                    )

                return (
                    Number.isFinite(componentDistance) &&
                    componentDistance + Number(marginMil || 0) < stackDistance
                )
            }
        )
    }

    /**
     * Checks whether the raised body is exactly anchored on an opposite-side
     * component and should therefore remain as that component's placement.
     * @param {{ positionMil?: { x?: number, y?: number } }} componentBody Source component-body row.
     * @param {object} stackOwner Candidate stack owner.
     * @param {object[]} components Source components.
     * @param {number} toleranceMil Exact-owner tolerance.
     * @returns {boolean}
     */
    static hasExactOppositeSideOwner(
        componentBody,
        stackOwner,
        components,
        toleranceMil
    ) {
        return (Array.isArray(components) ? components : []).some(
            (component) =>
                AltiumScene3dShapeStackOwnerConflictPolicy.#mountSide(
                    component
                ) !==
                    AltiumScene3dShapeStackOwnerConflictPolicy.#mountSide(
                        stackOwner
                    ) &&
                AltiumScene3dShapeStackOwnerConflictPolicy.#distance(
                    componentBody?.positionMil,
                    component
                ) <= Number(toleranceMil || 0)
        )
    }

    /**
     * Checks whether one raised body identifies itself as a timing-package
     * detail rather than a generic nearby package body.
     * @param {{ name?: string, identifier?: string }} componentBody Source body.
     * @returns {boolean}
     */
    static hasTimingBodyIdentity(componentBody) {
        return TIMING_BODY_IDENTITY_PATTERN.test(
            [
                componentBody?.name,
                componentBody?.identifier,
                componentBody?.modelTypeName
            ]
                .map((value) => String(value || ''))
                .join(' ')
        )
    }

    /**
     * Checks whether one raised body identifies itself as a stack detail that
     * may belong to an authored carrier even when a nearby opposite-side owner
     * is closer in XY.
     * @param {{ name?: string, identifier?: string, modelTypeName?: string }} componentBody Source body.
     * @returns {boolean}
     */
    static hasStackDetailBodyIdentity(componentBody) {
        return STACK_DETAIL_BODY_IDENTITY_PATTERN.test(
            [
                componentBody?.name,
                componentBody?.identifier,
                componentBody?.modelTypeName
            ]
                .map((value) => String(value || ''))
                .join(' ')
        )
    }

    /**
     * Builds timing-relevant component identity text.
     * @param {object} component Source component.
     * @returns {string}
     */
    static #timingIdentityText(component) {
        return [
            component?.pattern,
            component?.source,
            component?.description,
            component?.provenance?.footprintDescription,
            ...AltiumScene3dShapeStackOwnerConflictPolicy.#timingParameterValues(
                component?.parameters
            )
        ]
            .map((value) => String(value || ''))
            .join(' ')
    }

    /**
     * Returns parameter values whose names describe component identity.
     * @param {object | undefined} parameters Source component parameters.
     * @returns {unknown[]}
     */
    static #timingParameterValues(parameters) {
        if (!parameters || typeof parameters !== 'object') {
            return []
        }

        return Object.entries(parameters)
            .filter(([key]) =>
                TIMING_PARAMETER_NAME_PATTERN.test(String(key || ''))
            )
            .map(([, value]) => value)
    }

    /**
     * Resolves one component's mount side.
     * @param {object} component Source component.
     * @returns {'top' | 'bottom'}
     */
    static #mountSide(component) {
        const layer = String(component?.layer || '').toUpperCase()
        return layer.includes('BOTTOM') || layer === 'BOT' ? 'bottom' : 'top'
    }

    /**
     * Measures the XY distance between two board points.
     * @param {object | undefined} first First point.
     * @param {object | undefined} second Second point.
     * @returns {number}
     */
    static #distance(first, second) {
        return Math.hypot(
            Number(first?.x || 0) - Number(second?.x || 0),
            Number(first?.y || 0) - Number(second?.y || 0)
        )
    }

    /**
     * Normalizes one point.
     * @param {object | undefined} point Source point.
     * @returns {{ x: number, y: number }}
     */
    static #point(point) {
        return {
            x: Number(point?.x || 0),
            y: Number(point?.y || 0)
        }
    }
}
