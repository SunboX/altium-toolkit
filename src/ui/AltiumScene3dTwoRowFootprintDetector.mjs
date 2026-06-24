/**
 * Detects two-row surface-mount footprints from normalized PCB pads.
 */
export class AltiumScene3dTwoRowFootprintDetector {
    /**
     * Checks whether a component owns a symmetric two-row surface footprint.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static hasTwoRowSurfaceFootprint(component, pads) {
        const surfacePads = AltiumScene3dTwoRowFootprintDetector.#surfacePads(
            component,
            pads
        )
        if (surfacePads.length < 6) {
            return false
        }

        const xSpread = AltiumScene3dTwoRowFootprintDetector.#spread(
            surfacePads,
            'x'
        )
        const ySpread = AltiumScene3dTwoRowFootprintDetector.#spread(
            surfacePads,
            'y'
        )
        const rowAxis = xSpread >= ySpread ? 'y' : 'x'
        const lineAxis = rowAxis === 'x' ? 'y' : 'x'
        const rowSpread = AltiumScene3dTwoRowFootprintDetector.#spread(
            surfacePads,
            rowAxis
        )
        const lineSpread = AltiumScene3dTwoRowFootprintDetector.#spread(
            surfacePads,
            lineAxis
        )
        if (rowSpread <= 0 || lineSpread <= 0) {
            return false
        }

        const values = surfacePads.map((pad) => Number(pad?.[rowAxis] || 0))
        const midpoint = (Math.min(...values) + Math.max(...values)) / 2
        const lowerCount = values.filter((value) => value <= midpoint).length
        const upperCount = values.length - lowerCount

        return Math.min(lowerCount, upperCount) >= 3
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
}
