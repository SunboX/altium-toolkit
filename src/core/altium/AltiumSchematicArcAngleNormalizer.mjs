/**
 * Normalizes Altium schematic arc angles before SVG rendering.
 */
export class AltiumSchematicArcAngleNormalizer {
    static #FULL_CIRCLE_TOLERANCE = 0.001

    /**
     * Rewrites non-full arcs to the shortest authored sweep.
     * @param {object} documentModel Parsed document model.
     * @returns {object}
     */
    static normalize(documentModel) {
        const arcs = documentModel?.schematic?.arcs
        if (!Array.isArray(arcs)) {
            return documentModel
        }

        for (const arc of arcs) {
            AltiumSchematicArcAngleNormalizer.#normalizeArc(arc)
        }

        return documentModel
    }

    /**
     * Normalizes one arc's end angle while preserving full-circle arcs.
     * @param {object} arc Arc primitive.
     * @returns {void}
     */
    static #normalizeArc(arc) {
        const startAngle = Number(arc?.startAngle)
        const endAngle = Number(arc?.endAngle)
        if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle)) {
            return
        }

        const delta =
            AltiumSchematicArcAngleNormalizer.#normalizeSingleTurnDelta(
                endAngle - startAngle
            )
        if (AltiumSchematicArcAngleNormalizer.#isFullCircleDelta(delta)) {
            return
        }

        if (delta > 180) {
            arc.endAngle = endAngle - 360
        } else if (delta < -180) {
            arc.endAngle = endAngle + 360
        }
    }

    /**
     * Keeps a delta inside one signed turn.
     * @param {number} delta Source angle delta.
     * @returns {number}
     */
    static #normalizeSingleTurnDelta(delta) {
        let normalized = delta

        while (normalized <= -360) {
            normalized += 360
        }

        while (normalized > 360) {
            normalized -= 360
        }

        return normalized
    }

    /**
     * Returns true when one normalized delta describes a full circle.
     * @param {number} delta Normalized angle delta.
     * @returns {boolean}
     */
    static #isFullCircleDelta(delta) {
        return (
            Math.abs(Math.abs(delta) - 360) <=
            AltiumSchematicArcAngleNormalizer.#FULL_CIRCLE_TOLERANCE
        )
    }
}
