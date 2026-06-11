// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Splits native Altium footer/template primitives from scalable schematic
 * content when a standard template page is larger than the stored custom size.
 */
export class SchematicNativeFooterPartitioner {
    /**
     * Partitions render primitives into scalable content and fixed footer
     * chrome.
     * @param {{ lines?: object[], polygons?: object[], rectangles?: object[], roundedRectangles?: object[], ellipses?: object[], arcs?: object[], beziers?: object[], pies?: object[], ieeeSymbols?: object[], texts?: object[], images?: object[] }} primitives Primitive families.
     * @param {{ width?: number, height?: number, sourceWidth?: number, sourceHeight?: number, marginWidth?: number, paperSize?: string, borderOn?: boolean }} sheet Sheet metadata.
     * @returns {{ content: Record<string, object[]>, footer: Record<string, object[]>, footerBounds: { minX: number, minY: number, maxX: number, maxY: number } | null }}
     */
    static partitionPrimitives(primitives, sheet) {
        const families = [
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
        ]
        const content = {}
        const footer = {}

        for (const family of families) {
            const values = primitives?.[family] || []
            content[family] = values.filter(
                (primitive) =>
                    !SchematicNativeFooterPartitioner.#isNativeFooterPrimitive(
                        primitive,
                        sheet
                    )
            )
            footer[family] = values.filter((primitive) =>
                SchematicNativeFooterPartitioner.#isNativeFooterPrimitive(
                    primitive,
                    sheet
                )
            )
        }

        return {
            content,
            footer,
            footerBounds:
                SchematicNativeFooterPartitioner.#resolvePrimitiveSetBounds(
                    Object.values(footer).flat()
                )
        }
    }

    /**
     * Returns true when one primitive is native lower-page footer chrome.
     * @param {object} primitive Primitive candidate.
     * @param {{ width?: number, height?: number, sourceWidth?: number, sourceHeight?: number, marginWidth?: number, paperSize?: string, borderOn?: boolean }} sheet Sheet metadata.
     * @returns {boolean}
     */
    static #isNativeFooterPrimitive(primitive, sheet) {
        if (!SchematicNativeFooterPartitioner.#shouldSplitNativeFooter(sheet)) {
            return false
        }
        if (!String(primitive?.ownerIndex || '').trim()) {
            return false
        }

        const bounds =
            SchematicNativeFooterPartitioner.#resolvePrimitiveBounds(primitive)
        if (!bounds) {
            return false
        }

        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        const footerLimit = Math.max(margin * 6, 120)
        const footerStartX = Math.max(Number(sheet?.width || 0), 0) * 0.5

        return bounds.maxY <= footerLimit && bounds.maxX >= footerStartX
    }

    /**
     * Returns true when promoted standard-sheet content needs fixed native
     * footer handling.
     * @param {{ width?: number, height?: number, sourceWidth?: number, sourceHeight?: number, paperSize?: string, borderOn?: boolean }} sheet Sheet metadata.
     * @returns {boolean}
     */
    static #shouldSplitNativeFooter(sheet) {
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
     * Resolves one primitive's document-space bounds.
     * @param {object} primitive Primitive candidate.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePrimitiveBounds(primitive) {
        const points =
            SchematicNativeFooterPartitioner.#collectPrimitivePoints(primitive)
        if (!points.length) {
            return null
        }

        return {
            minX: Math.min(...points.map((point) => point.x)),
            minY: Math.min(...points.map((point) => point.y)),
            maxX: Math.max(...points.map((point) => point.x)),
            maxY: Math.max(...points.map((point) => point.y))
        }
    }

    /**
     * Resolves combined bounds for a set of primitives.
     * @param {object[]} primitives Primitive candidates.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePrimitiveSetBounds(primitives) {
        const bounds = primitives
            .map((primitive) =>
                SchematicNativeFooterPartitioner.#resolvePrimitiveBounds(
                    primitive
                )
            )
            .filter(Boolean)

        if (!bounds.length) {
            return null
        }

        return {
            minX: Math.min(...bounds.map((bound) => bound.minX)),
            minY: Math.min(...bounds.map((bound) => bound.minY)),
            maxX: Math.max(...bounds.map((bound) => bound.maxX)),
            maxY: Math.max(...bounds.map((bound) => bound.maxY))
        }
    }

    /**
     * Collects point coordinates from one normalized primitive.
     * @param {object} primitive Primitive candidate.
     * @returns {{ x: number, y: number }[]}
     */
    static #collectPrimitivePoints(primitive) {
        if (Array.isArray(primitive?.points)) {
            return primitive.points
                .map((point) =>
                    SchematicNativeFooterPartitioner.#point(point?.x, point?.y)
                )
                .filter(Boolean)
        }
        if (Array.isArray(primitive?.segments)) {
            return primitive.segments.flatMap((segment) =>
                [
                    SchematicNativeFooterPartitioner.#point(
                        segment?.x1,
                        segment?.y1
                    ),
                    SchematicNativeFooterPartitioner.#point(
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
                SchematicNativeFooterPartitioner.#point(
                    primitive.x1,
                    primitive.y1
                ),
                SchematicNativeFooterPartitioner.#point(
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
                SchematicNativeFooterPartitioner.#point(
                    primitive.x,
                    primitive.y
                ),
                SchematicNativeFooterPartitioner.#point(
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
                SchematicNativeFooterPartitioner.#point(
                    primitive.x,
                    primitive.y
                ),
                SchematicNativeFooterPartitioner.#point(
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
                SchematicNativeFooterPartitioner.#point(
                    Number(primitive.x || 0) - radiusX,
                    Number(primitive.y || 0) - radiusY
                ),
                SchematicNativeFooterPartitioner.#point(
                    Number(primitive.x || 0) + radiusX,
                    Number(primitive.y || 0) + radiusY
                )
            ]
        }

        return [
            SchematicNativeFooterPartitioner.#point(primitive?.x, primitive?.y)
        ].filter(Boolean)
    }

    /**
     * Builds one finite point.
     * @param {number | string | undefined} x Raw x coordinate.
     * @param {number | string | undefined} y Raw y coordinate.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(x, y) {
        const normalizedX = Number(x)
        const normalizedY = Number(y)

        if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
            return null
        }

        return { x: normalizedX, y: normalizedY }
    }
}
