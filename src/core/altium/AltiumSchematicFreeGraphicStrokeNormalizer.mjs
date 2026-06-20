/**
 * Normalizes ownerless Altium drawing primitive strokes to match app rendering.
 */
export class AltiumSchematicFreeGraphicStrokeNormalizer {
    static #SOURCE_THIN_STROKE = 1

    static #APP_THIN_STROKE = 0.85

    /**
     * Applies app-side stroke normalization to free schematic graphics.
     * @param {object} documentModel Parsed document model.
     * @returns {object}
     */
    static normalize(documentModel) {
        const schematic = documentModel?.schematic
        if (!schematic || typeof schematic !== 'object') {
            return documentModel
        }

        AltiumSchematicFreeGraphicStrokeNormalizer.#normalizeLines(
            schematic.lines
        )
        for (const family of [
            schematic.arcs,
            schematic.beziers,
            schematic.pies,
            schematic.polygons,
            schematic.rectangles,
            schematic.roundedRectangles,
            schematic.ellipses
        ]) {
            AltiumSchematicFreeGraphicStrokeNormalizer.#normalizeFreeGraphics(
                family
            )
        }

        return documentModel
    }

    /**
     * Normalizes free drawing line strokes while leaving wires and buses alone.
     * @param {object[] | undefined} lines Parsed line primitives.
     * @returns {void}
     */
    static #normalizeLines(lines) {
        if (!Array.isArray(lines)) {
            return
        }

        for (const line of lines) {
            if (
                line?.recordType === '6' &&
                !line.ownerIndex &&
                line.isBus !== true
            ) {
                AltiumSchematicFreeGraphicStrokeNormalizer.#normalizeStroke(
                    line,
                    'width'
                )
            }
        }
    }

    /**
     * Normalizes ownerless drawing primitive strokes.
     * @param {object[] | undefined} primitives Primitive family.
     * @returns {void}
     */
    static #normalizeFreeGraphics(primitives) {
        if (!Array.isArray(primitives)) {
            return
        }

        for (const primitive of primitives) {
            if (primitive?.ownerIndex) {
                continue
            }

            AltiumSchematicFreeGraphicStrokeNormalizer.#normalizeStroke(
                primitive,
                'width'
            )
            AltiumSchematicFreeGraphicStrokeNormalizer.#normalizeStroke(
                primitive,
                'lineWidth'
            )
        }
    }

    /**
     * Rewrites one source thin-stroke value to the app-normalized width.
     * @param {object} primitive Primitive object.
     * @param {string} key Stroke key.
     * @returns {void}
     */
    static #normalizeStroke(primitive, key) {
        if (
            Number(primitive?.[key]) ===
            AltiumSchematicFreeGraphicStrokeNormalizer.#SOURCE_THIN_STROKE
        ) {
            primitive[key] =
                AltiumSchematicFreeGraphicStrokeNormalizer.#APP_THIN_STROKE
        }
    }
}
