import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'

/**
 * Removes ownerless Altium free graphics that sit fully outside the authored
 * schematic sheet bounds.
 */
export class AltiumSchematicSheetBoundsNormalizer {
    static #BOUNDS_TOLERANCE = 0.001

    /**
     * Applies sheet-bound filtering to parsed schematic primitives.
     * @param {object} documentModel Parsed document model.
     * @returns {object}
     */
    static normalize(documentModel) {
        const schematic = documentModel?.schematic
        const bounds =
            AltiumSchematicSheetBoundsNormalizer.#resolveSourceBounds(
                schematic?.sheet
            )
        if (!schematic || !bounds) {
            return documentModel
        }

        const originalLines = schematic.lines
        schematic.lines = AltiumSchematicSheetBoundsNormalizer.#filterLines(
            schematic.lines,
            bounds
        )
        if (
            Array.isArray(originalLines) &&
            schematic.lines.length !== originalLines.length
        ) {
            AltiumSchematicSheetBoundsNormalizer.#shrinkSheetToRemainingContent(
                schematic
            )
        }

        return documentModel
    }

    /**
     * Returns the source sheet rectangle when finite dimensions are available.
     * @param {object | null | undefined} sheet Parsed sheet metadata.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveSourceBounds(sheet) {
        const width =
            AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                sheet?.sourceWidth
            ) ||
            AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                sheet?.width
            )
        const height =
            AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                sheet?.sourceHeight
            ) ||
            AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                sheet?.height
            )

        if (!width || !height) {
            return null
        }

        return {
            minX: 0,
            minY: 0,
            maxX: width,
            maxY: height
        }
    }

    /**
     * Filters unsupported off-sheet free graphic lines while preserving wires.
     * @param {object[] | undefined} lines Parsed line primitives.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Source sheet bounds.
     * @returns {object[] | undefined}
     */
    static #filterLines(lines, bounds) {
        if (!Array.isArray(lines)) {
            return lines
        }

        return lines.filter(
            (line) =>
                !AltiumSchematicSheetBoundsNormalizer.#isOffSheetFreeLine(
                    line,
                    bounds
                )
        )
    }

    /**
     * Recomputes inflated sheet dimensions from the remaining drawable model.
     * @param {object} schematic Parsed schematic model.
     * @returns {void}
     */
    static #shrinkSheetToRemainingContent(schematic) {
        const sheet = schematic?.sheet
        if (!sheet || typeof sheet !== 'object') {
            return
        }

        const baseSheet =
            AltiumSchematicSheetBoundsNormalizer.#sourceSizedSheet(sheet)
        const resolvedSheet = AltiumLayoutParser.resolveSchematicSheetSize(
            baseSheet,
            [],
            schematic.lines || [],
            schematic.texts || [],
            schematic.components || [],
            schematic.pins || [],
            [
                ...(schematic.rectangles || []),
                ...(schematic.roundedRectangles || [])
            ],
            schematic.regions || [],
            schematic.ports || [],
            schematic.crosses || []
        )

        AltiumSchematicSheetBoundsNormalizer.#applyShrunkenSheetSize(
            sheet,
            resolvedSheet
        )
    }

    /**
     * Builds a sheet metadata copy using source dimensions as declared bounds.
     * @param {object} sheet Parsed sheet metadata.
     * @returns {object}
     */
    static #sourceSizedSheet(sheet) {
        return {
            ...sheet,
            width:
                AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                    sheet?.sourceWidth
                ) ||
                AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                    sheet?.width
                ),
            height:
                AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                    sheet?.sourceHeight
                ) ||
                AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                    sheet?.height
                )
        }
    }

    /**
     * Applies only smaller resolved dimensions to avoid expanding content.
     * @param {object} sheet Mutable sheet metadata.
     * @param {object | null | undefined} resolvedSheet Recomputed sheet metadata.
     * @returns {void}
     */
    static #applyShrunkenSheetSize(sheet, resolvedSheet) {
        const currentWidth =
            AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                sheet?.width
            )
        const currentHeight =
            AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                sheet?.height
            )
        const resolvedWidth =
            AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                resolvedSheet?.width
            )
        const resolvedHeight =
            AltiumSchematicSheetBoundsNormalizer.#finitePositiveNumber(
                resolvedSheet?.height
            )

        if (resolvedWidth && currentWidth && resolvedWidth < currentWidth) {
            sheet.width = resolvedWidth
        }
        if (resolvedHeight && currentHeight && resolvedHeight < currentHeight) {
            sheet.height = resolvedHeight
        }
        if (
            (sheet.width === resolvedWidth ||
                sheet.height === resolvedHeight) &&
            Object.prototype.hasOwnProperty.call(
                resolvedSheet || {},
                'paperSize'
            )
        ) {
            sheet.paperSize = resolvedSheet.paperSize
        }
    }

    /**
     * Returns true when one free drawing line lies wholly outside the sheet.
     * @param {object | null | undefined} line Parsed line primitive.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Source sheet bounds.
     * @returns {boolean}
     */
    static #isOffSheetFreeLine(line, bounds) {
        if (
            String(line?.recordType || '') !== '6' ||
            AltiumSchematicSheetBoundsNormalizer.#hasOwner(line) ||
            line?.isBus === true
        ) {
            return false
        }

        const lineBounds =
            AltiumSchematicSheetBoundsNormalizer.#resolveLineBounds(line)
        if (!lineBounds) {
            return false
        }

        return !AltiumSchematicSheetBoundsNormalizer.#boundsIntersect(
            lineBounds,
            bounds
        )
    }

    /**
     * Returns true when a primitive has an owner reference.
     * @param {object | null | undefined} primitive Parsed primitive.
     * @returns {boolean}
     */
    static #hasOwner(primitive) {
        return String(primitive?.ownerIndex || '').trim() !== ''
    }

    /**
     * Resolves finite bounds for one line primitive.
     * @param {object | null | undefined} line Parsed line primitive.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveLineBounds(line) {
        const x1 = Number(line?.x1)
        const y1 = Number(line?.y1)
        const x2 = Number(line?.x2)
        const y2 = Number(line?.y2)

        if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2)
        ) {
            return null
        }

        return {
            minX: Math.min(x1, x2),
            minY: Math.min(y1, y2),
            maxX: Math.max(x1, x2),
            maxY: Math.max(y1, y2)
        }
    }

    /**
     * Returns true when two bounds overlap within tolerance.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} left First bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} right Second bounds.
     * @returns {boolean}
     */
    static #boundsIntersect(left, right) {
        const tolerance = AltiumSchematicSheetBoundsNormalizer.#BOUNDS_TOLERANCE

        return !(
            left.maxX < right.minX - tolerance ||
            left.minX > right.maxX + tolerance ||
            left.maxY < right.minY - tolerance ||
            left.minY > right.maxY + tolerance
        )
    }

    /**
     * Converts a value to a finite positive number.
     * @param {unknown} value Candidate number.
     * @returns {number | null}
     */
    static #finitePositiveNumber(value) {
        const number = Number(value)
        return Number.isFinite(number) && number > 0 ? number : null
    }
}
