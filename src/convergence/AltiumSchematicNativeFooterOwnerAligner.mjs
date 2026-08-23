// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

const PRIMITIVE_FAMILIES = Object.freeze([
    'lines',
    'polygons',
    'rectangles',
    'roundedRectangles',
    'ellipses',
    'arcs',
    'beziers',
    'pies',
    'ieeeSymbols',
    'texts',
    'images'
])

/**
 * Aligns complete authored footer-owner groups before the preserved historical
 * renderer partitions individual native footer primitives.
 */
export class AltiumSchematicNativeFooterOwnerAligner {
    /**
     * Builds a render-only schematic view whose non-seed footer-owner members
     * receive the same effective translation as the historical footer group.
     * @param {Record<string, any>} documentModel Native renderer document.
     * @returns {Record<string, any>} Owner-aligned render document.
     */
    static align(documentModel) {
        const schematic = documentModel?.schematic
        const sheet = schematic?.sheet
        if (
            !schematic ||
            !AltiumSchematicNativeFooterOwnerAligner.#shouldAlign(sheet)
        ) {
            return documentModel
        }

        const seededOwners = new Set()
        let seedMaximumX = -Infinity
        for (const family of PRIMITIVE_FAMILIES) {
            for (const primitive of schematic[family] || []) {
                if (
                    !AltiumSchematicNativeFooterOwnerAligner.#isFooterSeed(
                        primitive,
                        sheet
                    )
                ) {
                    continue
                }

                const owner =
                    AltiumSchematicNativeFooterOwnerAligner.#owner(primitive)
                const bounds =
                    AltiumSchematicNativeFooterOwnerAligner.#bounds(primitive)
                seededOwners.add(owner)
                seedMaximumX = Math.max(seedMaximumX, bounds.maxX)
            }
        }
        if (!seededOwners.size) return documentModel

        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        const offset = Math.max(Number(sheet.width) - margin - seedMaximumX, 0)
        if (!(offset > 0)) return documentModel
        const alignedFamilies = {}
        let changed = false

        for (const family of PRIMITIVE_FAMILIES) {
            const primitives = schematic[family]
            if (!Array.isArray(primitives)) continue

            let familyChanged = false
            const alignedPrimitives = primitives.map((primitive) => {
                if (
                    !seededOwners.has(
                        AltiumSchematicNativeFooterOwnerAligner.#owner(
                            primitive
                        )
                    ) ||
                    AltiumSchematicNativeFooterOwnerAligner.#isFooterSeed(
                        primitive,
                        sheet
                    )
                ) {
                    return primitive
                }

                familyChanged = true
                return AltiumSchematicNativeFooterOwnerAligner.#translate(
                    primitive,
                    offset
                )
            })

            if (familyChanged) {
                alignedFamilies[family] = alignedPrimitives
                changed = true
            }
        }

        if (!changed) return documentModel

        return {
            ...documentModel,
            schematic: {
                ...schematic,
                ...alignedFamilies
            }
        }
    }

    /**
     * Returns true when a promoted standard sheet requires native-footer
     * alignment.
     * @param {Record<string, any> | undefined} sheet Sheet metadata.
     * @returns {boolean} Whether alignment can apply.
     */
    static #shouldAlign(sheet) {
        const width = Number(sheet?.width || 0)
        const height = Number(sheet?.height || 0)
        const sourceWidth = Number(sheet?.sourceWidth || 0)
        const sourceHeight = Number(sheet?.sourceHeight || 0)

        return Boolean(
            sheet?.borderOn &&
            sheet?.paperSize &&
            sourceWidth > 0 &&
            sourceHeight > 0 &&
            (width > sourceWidth || height > sourceHeight)
        )
    }

    /**
     * Returns true when one primitive triggers the preserved lower-right
     * native-footer partitioning predicate.
     * @param {Record<string, any>} primitive Primitive candidate.
     * @param {Record<string, any>} sheet Sheet metadata.
     * @returns {boolean} Whether the primitive seeds a footer owner.
     */
    static #isFooterSeed(primitive, sheet) {
        if (!AltiumSchematicNativeFooterOwnerAligner.#owner(primitive)) {
            return false
        }

        const bounds =
            AltiumSchematicNativeFooterOwnerAligner.#bounds(primitive)
        if (!bounds) return false

        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        const footerLimit = Math.max(margin * 6, 120)
        const footerStartX = Math.max(Number(sheet?.width || 0), 0) * 0.5

        return bounds.maxY <= footerLimit && bounds.maxX >= footerStartX
    }

    /**
     * Normalizes one primitive owner for structural grouping.
     * @param {Record<string, any> | undefined} primitive Primitive candidate.
     * @returns {string} Normalized owner key.
     */
    static #owner(primitive) {
        return String(primitive?.ownerIndex || '').trim()
    }

    /**
     * Resolves the document-space bounds of one normalized primitive.
     * @param {Record<string, any>} primitive Primitive candidate.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null} Primitive bounds.
     */
    static #bounds(primitive) {
        const points =
            AltiumSchematicNativeFooterOwnerAligner.#primitivePoints(primitive)
        if (!points.length) return null

        return {
            minX: Math.min(...points.map((point) => point.x)),
            minY: Math.min(...points.map((point) => point.y)),
            maxX: Math.max(...points.map((point) => point.x)),
            maxY: Math.max(...points.map((point) => point.y))
        }
    }

    /**
     * Collects finite point coordinates from one normalized primitive.
     * @param {Record<string, any>} primitive Primitive candidate.
     * @returns {{ x: number, y: number }[]} Primitive points.
     */
    static #primitivePoints(primitive) {
        if (Array.isArray(primitive?.points)) {
            return primitive.points
                .map((point) =>
                    AltiumSchematicNativeFooterOwnerAligner.#point(
                        point?.x,
                        point?.y
                    )
                )
                .filter(Boolean)
        }
        if (Array.isArray(primitive?.segments)) {
            return primitive.segments.flatMap((segment) =>
                [
                    AltiumSchematicNativeFooterOwnerAligner.#point(
                        segment?.x1,
                        segment?.y1
                    ),
                    AltiumSchematicNativeFooterOwnerAligner.#point(
                        segment?.x2,
                        segment?.y2
                    )
                ].filter(Boolean)
            )
        }
        if (
            Number.isFinite(Number(primitive?.x1)) &&
            Number.isFinite(Number(primitive?.y1)) &&
            Number.isFinite(Number(primitive?.x2)) &&
            Number.isFinite(Number(primitive?.y2))
        ) {
            return [
                AltiumSchematicNativeFooterOwnerAligner.#point(
                    primitive.x1,
                    primitive.y1
                ),
                AltiumSchematicNativeFooterOwnerAligner.#point(
                    primitive.x2,
                    primitive.y2
                )
            ]
        }
        if (
            Number.isFinite(Number(primitive?.cornerX)) &&
            Number.isFinite(Number(primitive?.cornerY))
        ) {
            return [
                AltiumSchematicNativeFooterOwnerAligner.#point(
                    primitive.x,
                    primitive.y
                ),
                AltiumSchematicNativeFooterOwnerAligner.#point(
                    primitive.cornerX,
                    primitive.cornerY
                )
            ].filter(Boolean)
        }
        if (
            Number.isFinite(Number(primitive?.width)) &&
            Number.isFinite(Number(primitive?.height))
        ) {
            return [
                AltiumSchematicNativeFooterOwnerAligner.#point(
                    primitive.x,
                    primitive.y
                ),
                AltiumSchematicNativeFooterOwnerAligner.#point(
                    Number(primitive.x || 0) + Number(primitive.width || 0),
                    Number(primitive.y || 0) + Number(primitive.height || 0)
                )
            ].filter(Boolean)
        }
        if (
            Number.isFinite(Number(primitive?.radius)) ||
            Number.isFinite(Number(primitive?.radiusX))
        ) {
            const radiusX = Math.max(
                Number(primitive?.radiusX || primitive?.radius || 0),
                0
            )
            const radiusY = Math.max(
                Number(primitive?.radiusY || primitive?.radius || 0),
                0
            )

            return [
                AltiumSchematicNativeFooterOwnerAligner.#point(
                    Number(primitive.x || 0) - radiusX,
                    Number(primitive.y || 0) - radiusY
                ),
                AltiumSchematicNativeFooterOwnerAligner.#point(
                    Number(primitive.x || 0) + radiusX,
                    Number(primitive.y || 0) + radiusY
                )
            ]
        }

        return [
            AltiumSchematicNativeFooterOwnerAligner.#point(
                primitive?.x,
                primitive?.y
            )
        ].filter(Boolean)
    }

    /**
     * Builds one finite point.
     * @param {number | string | undefined} x Raw x coordinate.
     * @param {number | string | undefined} y Raw y coordinate.
     * @returns {{ x: number, y: number } | null} Finite point.
     */
    static #point(x, y) {
        const normalizedX = Number(x)
        const normalizedY = Number(y)
        if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
            return null
        }

        return { x: normalizedX, y: normalizedY }
    }

    /**
     * Copies one primitive while translating each present horizontal geometry
     * coordinate.
     * @param {Record<string, any>} primitive Primitive to translate.
     * @param {number} offset Positive horizontal offset.
     * @returns {Record<string, any>} Translated primitive.
     */
    static #translate(primitive, offset) {
        const translated = { ...primitive }
        for (const field of ['x', 'x1', 'x2', 'cornerX']) {
            if (
                Object.hasOwn(primitive, field) &&
                Number.isFinite(Number(primitive[field]))
            ) {
                translated[field] = Number(primitive[field]) + offset
            }
        }
        if (Array.isArray(primitive.points)) {
            translated.points = primitive.points.map((point) => ({
                ...point,
                ...(Number.isFinite(Number(point?.x))
                    ? { x: Number(point.x) + offset }
                    : {})
            }))
        }
        if (Array.isArray(primitive.segments)) {
            translated.segments = primitive.segments.map((segment) => ({
                ...segment,
                ...(Number.isFinite(Number(segment?.x1))
                    ? { x1: Number(segment.x1) + offset }
                    : {}),
                ...(Number.isFinite(Number(segment?.x2))
                    ? { x2: Number(segment.x2) + offset }
                    : {})
            }))
        }

        return translated
    }
}

Object.freeze(AltiumSchematicNativeFooterOwnerAligner.prototype)
Object.freeze(AltiumSchematicNativeFooterOwnerAligner)
