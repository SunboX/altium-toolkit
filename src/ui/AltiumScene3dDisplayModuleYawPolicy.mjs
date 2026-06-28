const DISPLAY_MODULE_PATTERN =
    /(?:^|[^a-z0-9])(?:display|lcd|oled|screen|tft)(?:$|[^a-z0-9])/i
const MIN_DIRECTIONAL_COSINE = 0.25

/**
 * Detects display modules whose footprint yaw is more reliable than the
 * embedded body yaw.
 */
export class AltiumScene3dDisplayModuleYawPolicy {
    /**
     * Checks whether one placement should use the component yaw.
     * @param {{ placement?: object, component?: object | null, pads?: object[], identityText?: string }} context Placement context.
     * @returns {boolean}
     */
    static shouldUseComponentYaw(context) {
        const { placement, component, pads, identityText } = context || {}
        if (
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            String(placement?.projection?.source || '').toLowerCase() !==
                'pad-fallback' ||
            String(placement?.externalModel?.origin || '').toLowerCase() !==
                'embedded' ||
            !DISPLAY_MODULE_PATTERN.test(String(identityText || ''))
        ) {
            return false
        }

        return AltiumScene3dDisplayModuleYawPolicy.#hasOffsetSingleRowPads(
            component,
            pads
        )
    }

    /**
     * Checks whether a model-bounds display source points away from its edge
     * pad row and needs a half-turn around the board normal.
     * @param {{ placement?: object, component?: object | null, pads?: object[], identityText?: string }} context Placement context.
     * @returns {boolean}
     */
    static shouldReverseModelBoundsYaw(context) {
        const { placement, component, pads, identityText } = context || {}
        if (
            !component ||
            String(placement?.mountSide || '').toLowerCase() !== 'top' ||
            String(placement?.projection?.source || '').toLowerCase() !==
                'model-bounds' ||
            String(placement?.externalModel?.origin || '').toLowerCase() !==
                'embedded' ||
            !DISPLAY_MODULE_PATTERN.test(String(identityText || ''))
        ) {
            return false
        }

        const padOffset =
            AltiumScene3dDisplayModuleYawPolicy.#offsetSingleRowPadVector(
                component,
                pads
            )
        const sourceOffset =
            AltiumScene3dDisplayModuleYawPolicy.#modelBoundsSourceVector(
                placement
            )
        if (!padOffset || !sourceOffset) {
            return false
        }

        const alignment = AltiumScene3dDisplayModuleYawPolicy.#cosineSimilarity(
            padOffset,
            sourceOffset
        )

        return (
            Number.isFinite(alignment) && alignment <= -MIN_DIRECTIONAL_COSINE
        )
    }

    /**
     * Checks whether the footprint has one edge-mounted contact row.
     * @param {object} component PCB component.
     * @param {object[] | undefined} pads Source PCB pads.
     * @returns {boolean}
     */
    static #hasOffsetSingleRowPads(component, pads) {
        return Boolean(
            AltiumScene3dDisplayModuleYawPolicy.#offsetSingleRowPadVector(
                component,
                pads
            )
        )
    }

    /**
     * Resolves the component-to-pad-row vector for an edge-mounted display
     * connector.
     * @param {object} component PCB component.
     * @param {object[] | undefined} pads Source PCB pads.
     * @returns {{ x: number, y: number } | null}
     */
    static #offsetSingleRowPadVector(component, pads) {
        const measurablePads = AltiumScene3dDisplayModuleYawPolicy.#surfacePads(
            component,
            pads
        ).filter((pad) =>
            AltiumScene3dDisplayModuleYawPolicy.#isMeasurablePad(pad)
        )
        if (measurablePads.length < 6) {
            return null
        }

        const xValues = measurablePads.map((pad) => Number(pad?.x || 0))
        const yValues = measurablePads.map((pad) => Number(pad?.y || 0))
        const spreadX = Math.max(...xValues) - Math.min(...xValues)
        const spreadY = Math.max(...yValues) - Math.min(...yValues)
        const rowAxis = spreadX >= spreadY ? 'x' : 'y'
        const crossAxis = rowAxis === 'x' ? 'y' : 'x'
        const majorSpread = Math.max(spreadX, spreadY)
        const minorSpread = Math.min(spreadX, spreadY)
        const maxPadSpan = Math.max(
            ...measurablePads.map((pad) =>
                AltiumScene3dDisplayModuleYawPolicy.#maxPadSpan(pad)
            )
        )
        const componentCross = Number(component?.[crossAxis])
        const rowCross =
            measurablePads.reduce(
                (sum, pad) => sum + Number(pad?.[crossAxis] || 0),
                0
            ) / measurablePads.length
        const componentX = Number(component?.x)
        const componentY = Number(component?.y)
        const rowX =
            measurablePads.reduce((sum, pad) => sum + Number(pad?.x || 0), 0) /
            measurablePads.length
        const rowY =
            measurablePads.reduce((sum, pad) => sum + Number(pad?.y || 0), 0) /
            measurablePads.length
        if (
            !Number.isFinite(componentCross) ||
            !Number.isFinite(rowCross) ||
            !Number.isFinite(componentX) ||
            !Number.isFinite(componentY) ||
            !Number.isFinite(rowX) ||
            !Number.isFinite(rowY) ||
            majorSpread < Math.max(150, maxPadSpan * 2) ||
            minorSpread > Math.max(10, maxPadSpan * 0.25)
        ) {
            return null
        }

        if (
            Math.abs(rowCross - componentCross) <
            Math.max(100, maxPadSpan * 1.5)
        ) {
            return null
        }

        return { x: rowX - componentX, y: rowY - componentY }
    }

    /**
     * Estimates the scene-space vector from a model-bounds source origin to
     * the dominant display body center.
     * @param {object | null | undefined} placement External placement.
     * @returns {{ x: number, y: number } | null}
     */
    static #modelBoundsSourceVector(placement) {
        const bounds = placement?.projection?.boundsMil || {}
        const width = Math.abs(Number(bounds?.width || 0))
        const depth = Math.abs(Number(bounds?.depth || 0))
        if (
            !Number.isFinite(width) ||
            !Number.isFinite(depth) ||
            width <= 0 ||
            depth <= 0
        ) {
            return null
        }

        const rotationRad =
            (AltiumScene3dDisplayModuleYawPolicy.#normalizeAngle(
                Number(placement?.rotationDeg || 0)
            ) *
                Math.PI) /
            180
        const cos = Math.cos(rotationRad)
        const sin = Math.sin(rotationRad)

        return depth >= width
            ? { x: -sin * (depth / 2), y: cos * (depth / 2) }
            : { x: cos * (width / 2), y: sin * (width / 2) }
    }

    /**
     * Computes the cosine similarity between two planar vectors.
     * @param {{ x?: number, y?: number }} left First vector.
     * @param {{ x?: number, y?: number }} right Second vector.
     * @returns {number}
     */
    static #cosineSimilarity(left, right) {
        const leftX = Number(left?.x || 0)
        const leftY = Number(left?.y || 0)
        const rightX = Number(right?.x || 0)
        const rightY = Number(right?.y || 0)
        const leftMagnitude = Math.hypot(leftX, leftY)
        const rightMagnitude = Math.hypot(rightX, rightY)
        if (leftMagnitude <= 0 || rightMagnitude <= 0) {
            return Number.NaN
        }

        return (
            (leftX * rightX + leftY * rightY) / leftMagnitude / rightMagnitude
        )
    }

    /**
     * Normalizes an angle into the renderer's [0, 360) degree range.
     * @param {number} value Raw angle.
     * @returns {number}
     */
    static #normalizeAngle(value) {
        const angle = Number(value || 0) % 360

        return angle < 0 ? angle + 360 : angle
    }

    /**
     * Collects surface pads owned by one component.
     * @param {object} component PCB component.
     * @param {object[] | undefined} pads Source PCB pads.
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
     * Checks whether one pad has finite coordinates and non-zero dimensions.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #isMeasurablePad(pad) {
        return (
            Number.isFinite(Number(pad?.x)) &&
            Number.isFinite(Number(pad?.y)) &&
            AltiumScene3dDisplayModuleYawPolicy.#maxPadSpan(pad) > 0
        )
    }

    /**
     * Measures the largest available pad dimension.
     * @param {object} pad Source PCB pad.
     * @returns {number}
     */
    static #maxPadSpan(pad) {
        return Math.max(
            Number(pad?.sizeTopX || 0),
            Number(pad?.sizeTopY || 0),
            Number(pad?.sizeMidX || 0),
            Number(pad?.sizeMidY || 0),
            Number(pad?.sizeBottomX || 0),
            Number(pad?.sizeBottomY || 0)
        )
    }
}
