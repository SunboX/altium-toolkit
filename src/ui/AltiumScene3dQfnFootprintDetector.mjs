/**
 * Detects QFN-style exposed-pad footprints from normalized PCB pads.
 */
export class AltiumScene3dQfnFootprintDetector {
    /**
     * Checks whether a component owns a centered exposed pad plus source-ordered
     * perimeter pads around the package edges.
     * @param {object} component PCB component.
     * @param {object[]} pads Source PCB pads.
     * @returns {boolean}
     */
    static hasExposedPadPerimeterSequence(component, pads) {
        const surfacePads = AltiumScene3dQfnFootprintDetector.#surfacePads(
            component,
            pads
        ).filter((pad) =>
            AltiumScene3dQfnFootprintDetector.#hasFinitePosition(pad)
        )
        if (surfacePads.length < 9) {
            return false
        }

        const centerPad = AltiumScene3dQfnFootprintDetector.#centerPad(
            component,
            surfacePads
        )
        if (!centerPad) {
            return false
        }

        const perimeterPads = surfacePads.filter((pad) => pad !== centerPad)
        if (perimeterPads.length < 8) {
            return false
        }

        const perimeterBounds =
            AltiumScene3dQfnFootprintDetector.#bounds(perimeterPads)
        if (
            !AltiumScene3dQfnFootprintDetector.#hasBalancedPerimeter(
                perimeterBounds
            )
        ) {
            return false
        }

        const edgeSequence = AltiumScene3dQfnFootprintDetector.#edgeSequence(
            perimeterPads,
            perimeterBounds
        )

        return AltiumScene3dQfnFootprintDetector.#isOrderedRing(edgeSequence)
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
     * Finds an exposed pad close to the component origin and larger than the
     * perimeter pads.
     * @param {object} component PCB component.
     * @param {object[]} surfacePads Surface pads owned by the component.
     * @returns {object | null}
     */
    static #centerPad(component, surfacePads) {
        const componentX = Number(component?.x)
        const componentY = Number(component?.y)
        if (!Number.isFinite(componentX) || !Number.isFinite(componentY)) {
            return null
        }

        const footprintBounds =
            AltiumScene3dQfnFootprintDetector.#bounds(surfacePads)
        const diagonal = Math.hypot(
            footprintBounds.maxX - footprintBounds.minX,
            footprintBounds.maxY - footprintBounds.minY
        )
        const centerTolerance = Math.max(2, diagonal * 0.05)
        const candidates = surfacePads
            .map((pad) => ({
                pad,
                distance: Math.hypot(
                    Number(pad?.x) - componentX,
                    Number(pad?.y) - componentY
                ),
                area: AltiumScene3dQfnFootprintDetector.#padArea(pad)
            }))
            .filter(
                (candidate) =>
                    candidate.distance <= centerTolerance && candidate.area > 0
            )
            .sort(
                (first, second) =>
                    first.distance - second.distance || second.area - first.area
            )
        if (!candidates.length) {
            return null
        }

        const centerCandidate = candidates[0]
        const perimeterAreas = surfacePads
            .filter((pad) => pad !== centerCandidate.pad)
            .map((pad) => AltiumScene3dQfnFootprintDetector.#padArea(pad))
            .filter((area) => area > 0)
        if (!perimeterAreas.length) {
            return null
        }

        return centerCandidate.area >
            AltiumScene3dQfnFootprintDetector.#median(perimeterAreas) * 1.5
            ? centerCandidate.pad
            : null
    }

    /**
     * Checks whether perimeter pads form a roughly square or rectangular ring.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds Pad bounds.
     * @returns {boolean}
     */
    static #hasBalancedPerimeter(bounds) {
        const spreadX = bounds.maxX - bounds.minX
        const spreadY = bounds.maxY - bounds.minY
        if (spreadX <= 0 || spreadY <= 0) {
            return false
        }

        const ratio = spreadX / spreadY

        return ratio >= 0.6 && ratio <= 1.67
    }

    /**
     * Resolves the compressed edge labels in source pad order.
     * @param {object[]} perimeterPads Perimeter pads in source order.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds Pad bounds.
     * @returns {string[]}
     */
    static #edgeSequence(perimeterPads, bounds) {
        const spread = Math.max(
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        )
        const edgeTolerance = Math.max(2, spread * 0.12)
        const sequence = []

        for (const pad of perimeterPads) {
            const edge = AltiumScene3dQfnFootprintDetector.#nearestEdge(
                pad,
                bounds,
                edgeTolerance
            )
            if (!edge) {
                return []
            }
            if (sequence.at(-1) !== edge) {
                sequence.push(edge)
            }
        }

        return sequence
    }

    /**
     * Finds the closest perimeter edge for one pad.
     * @param {object} pad Source PCB pad.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds Pad bounds.
     * @param {number} tolerance Maximum distance from a perimeter edge.
     * @returns {string | null}
     */
    static #nearestEdge(pad, bounds, tolerance) {
        const distances = [
            ['right', Math.abs(bounds.maxX - Number(pad?.x))],
            ['top', Math.abs(bounds.maxY - Number(pad?.y))],
            ['left', Math.abs(Number(pad?.x) - bounds.minX)],
            ['bottom', Math.abs(Number(pad?.y) - bounds.minY)]
        ].sort((first, second) => first[1] - second[1])

        return distances[0][1] <= tolerance ? distances[0][0] : null
    }

    /**
     * Checks whether compressed edge labels follow a perimeter walk.
     * @param {string[]} sequence Compressed edge labels.
     * @returns {boolean}
     */
    static #isOrderedRing(sequence) {
        if (sequence.length !== 4) {
            return false
        }

        const clockwise = ['right', 'bottom', 'left', 'top']
        const counterClockwise = ['right', 'top', 'left', 'bottom']

        return (
            AltiumScene3dQfnFootprintDetector.#isRotationOf(
                sequence,
                clockwise
            ) ||
            AltiumScene3dQfnFootprintDetector.#isRotationOf(
                sequence,
                counterClockwise
            )
        )
    }

    /**
     * Checks whether one sequence is a rotation of another sequence.
     * @param {string[]} candidate Candidate sequence.
     * @param {string[]} ordered Ordered sequence.
     * @returns {boolean}
     */
    static #isRotationOf(candidate, ordered) {
        return ordered.some((_, index) =>
            candidate.every(
                (value, candidateIndex) =>
                    value === ordered[(index + candidateIndex) % ordered.length]
            )
        )
    }

    /**
     * Measures pad bounds.
     * @param {object[]} pads Source PCB pads.
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    static #bounds(pads) {
        const xs = pads.map((pad) => Number(pad?.x))
        const ys = pads.map((pad) => Number(pad?.y))

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        }
    }

    /**
     * Checks whether a pad has finite center coordinates.
     * @param {object} pad Source PCB pad.
     * @returns {boolean}
     */
    static #hasFinitePosition(pad) {
        return (
            Number.isFinite(Number(pad?.x)) && Number.isFinite(Number(pad?.y))
        )
    }

    /**
     * Measures the largest available pad area.
     * @param {object} pad Source PCB pad.
     * @returns {number}
     */
    static #padArea(pad) {
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

        return width * depth
    }

    /**
     * Calculates the median of a non-empty numeric array.
     * @param {number[]} values Values to inspect.
     * @returns {number}
     */
    static #median(values) {
        const sorted = [...values].sort((first, second) => first - second)
        const midpoint = Math.floor(sorted.length / 2)

        return sorted.length % 2 === 0
            ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
            : sorted[midpoint]
    }
}
