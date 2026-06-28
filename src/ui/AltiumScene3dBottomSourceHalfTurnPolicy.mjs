const BOTTOM_SOURCE_HALF_TURN_PACKAGE_PATTERN =
    /(?:^|[^a-z0-9])(?:[a-z0-9]*qfn[a-z0-9]*|[a-z0-9]*dfn[a-z0-9]*)(?:$|[^a-z0-9])/i

/**
 * Resolves whether a bottom-side source-model half-turn is part of the
 * package's contact-side frame and must survive mount-side normalization.
 */
export class AltiumScene3dBottomSourceHalfTurnPolicy {
    /**
     * Checks whether a bottom-side model X half-turn should be preserved.
     * @param {{ component?: object | null, componentBody?: object | null, placement?: object | null, modelTransform?: object | null }} context Placement context.
     * @returns {boolean}
     */
    static shouldPreserve(context = {}) {
        if (
            !AltiumScene3dBottomSourceHalfTurnPolicy.#hasSourceHalfTurn(context)
        ) {
            return false
        }

        return BOTTOM_SOURCE_HALF_TURN_PACKAGE_PATTERN.test(
            AltiumScene3dBottomSourceHalfTurnPolicy.#packageIdentityText(
                context
            )
        )
    }

    /**
     * Checks whether source data carries an X-axis half-turn.
     * @param {{ componentBody?: object | null, modelTransform?: object | null }} context Placement context.
     * @returns {boolean}
     */
    static #hasSourceHalfTurn(context) {
        const sourceRotation = context?.componentBody?.modelRotationDeg
        const renderRotation = context?.modelTransform?.rotationDeg
        const sourceX =
            sourceRotation?.x !== undefined
                ? sourceRotation.x
                : renderRotation?.x

        return (
            AltiumScene3dBottomSourceHalfTurnPolicy.#normalizeAngle(sourceX) ===
            180
        )
    }

    /**
     * Builds identity text from the component, source body, and placement.
     * @param {{ component?: object | null, componentBody?: object | null, placement?: object | null }} context Placement context.
     * @returns {string}
     */
    static #packageIdentityText(context) {
        const component = context?.component || {}
        const componentBody = context?.componentBody || {}
        const placement = context?.placement || {}

        return [
            component?.pattern,
            component?.source,
            component?.description,
            ...AltiumScene3dBottomSourceHalfTurnPolicy.#recordValues(
                component?.parameters
            ),
            componentBody?.identifier,
            componentBody?.modelId,
            componentBody?.name,
            placement?.externalModel?.name
        ]
            .map((value) => String(value || ''))
            .join(' ')
    }

    /**
     * Resolves stringable values from one optional metadata record.
     * @param {Record<string, unknown> | null | undefined} record Source record.
     * @returns {unknown[]}
     */
    static #recordValues(record) {
        return record && typeof record === 'object' ? Object.values(record) : []
    }

    /**
     * Normalizes one angle into the positive 0-359 degree range.
     * @param {unknown} angle Source angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const numericAngle = Number(angle || 0)
        const normalized = numericAngle % 360

        return normalized < 0 ? normalized + 360 : normalized
    }
}
