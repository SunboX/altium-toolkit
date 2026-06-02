// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils
const RELAXED_STANDARD_PAGE_MAX_SLACK_RATIO = 0.35
const ISO_A_PORTRAIT_SHEETS = [
    { label: 'A5', width: 583, height: 827 },
    { label: 'A4', width: 827, height: 1169 },
    { label: 'A3', width: 1169, height: 1654 },
    { label: 'A2', width: 1654, height: 2339 },
    { label: 'A1', width: 2339, height: 3307 },
    { label: 'A0', width: 3307, height: 4681 }
]

/**
 * Computes schematic content transforms and clipping for normalized pages.
 */
export class SchematicContentLayout {
    /**
     * Builds one deterministic clip-path identifier for one schematic SVG.
     * @param {number} width
     * @param {number} height
     * @param {{ sheet?: { marginWidth?: number }, lines?: unknown[], texts?: unknown[], components?: unknown[], pins?: unknown[], regions?: unknown[] }} schematic
     * @returns {string}
     */
    static buildClipId(width, height, schematic) {
        return [
            'schematic-content-clip',
            Math.round(Number(width || 0)),
            Math.round(Number(height || 0)),
            Math.round(Number(schematic?.sheet?.marginWidth || 20)),
            (schematic?.lines || []).length,
            (schematic?.texts || []).length,
            (schematic?.components || []).length,
            (schematic?.pins || []).length,
            (schematic?.regions || []).length
        ].join('-')
    }

    /**
     * Builds the clip-path that confines schematic primitives to the sheet
     * inner frame.
     * @param {number} width
     * @param {number} height
     * @param {{ sheet?: { marginWidth?: number } }} schematic
     * @param {string} clipId
     * @returns {string}
     */
    static buildClipMarkup(width, height, schematic, clipId) {
        const margin = Math.max(Number(schematic?.sheet?.marginWidth || 20), 10)

        return (
            '<defs><clipPath id="' +
            escapeHtml(clipId) +
            '"><rect x="' +
            formatNumber(margin) +
            '" y="' +
            formatNumber(margin) +
            '" width="' +
            formatNumber(Math.max(width - margin * 2, 10)) +
            '" height="' +
            formatNumber(Math.max(height - margin * 2, 10)) +
            '" /></clipPath></defs>'
        )
    }

    /**
     * Builds one uniform SVG transform that scales recovered schematic
     * primitives from their source inner frame into a larger normalized page.
     * @param {number} width
     * @param {number} height
     * @param {{ sheet?: { marginWidth?: number, sourceWidth?: number, sourceHeight?: number, fonts?: Record<string, { size?: number }> }, lines?: { x1: number, y1: number, x2: number, y2: number }[], polygons?: { points: { x: number, y: number }[] }[], rectangles?: { x: number, y: number, width: number, height: number }[], regions?: { x: number, y: number, width: number, height: number }[], ellipses?: { x: number, y: number, radiusX: number, radiusY: number }[], arcs?: { x: number, y: number, radius: number }[], texts?: { x: number, y: number }[], components?: { x: number, y: number }[], pins?: { x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[], ports?: { x: number, y: number, width: number, height: number, direction?: 'left' | 'right' | 'up' | 'down' }[], crosses?: { x: number, y: number, size?: number }[] }} schematic
     * @returns {string}
     */
    static buildTransform(width, height, schematic) {
        const sheet = schematic?.sheet
        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        const bounds = SchematicContentLayout.#collectRenderedContentBounds(
            schematic,
            height
        )
        const contentPadding = SchematicContentLayout.#resolveContentPadding(
            sheet,
            margin
        )
        const footerReserve = SchematicContentLayout.#resolveFooterReserve(
            sheet,
            margin
        )

        if (!bounds) {
            return ''
        }

        const normalizedTransform =
            SchematicContentLayout.#buildNormalizedSheetTransform(
                width,
                height,
                schematic,
                sheet,
                margin,
                bounds,
                contentPadding,
                footerReserve
            )
        if (normalizedTransform) {
            return normalizedTransform
        }

        return SchematicContentLayout.#buildSparseCustomSheetTransform(
            width,
            height,
            sheet,
            margin,
            bounds,
            contentPadding,
            footerReserve
        )
    }

    /**
     * Builds the existing normalized-sheet transform for pages that have been
     * expanded beyond their original source size.
     * @param {number} width
     * @param {number} height
     * @param {{ rectangles?: { x: number, y: number, width: number, height: number }[], regions?: { x: number, y: number, width: number, height: number }[] }} schematic
     * @param {{ sourceWidth?: number, sourceHeight?: number } | undefined} sheet
     * @param {number} margin
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} contentPadding
     * @param {number} footerReserve
     * @returns {string}
     */
    static #buildNormalizedSheetTransform(
        width,
        height,
        schematic,
        sheet,
        margin,
        bounds,
        contentPadding,
        footerReserve
    ) {
        const normalizedScaleLimit =
            SchematicContentLayout.#buildNormalizedSheetScaleLimit(
                width,
                height,
                sheet,
                margin
            )

        if (!normalizedScaleLimit) {
            return ''
        }

        const usedWidth = bounds.maxX - bounds.minX
        const usedHeight = bounds.maxY - bounds.minY

        if (usedWidth <= 0 || usedHeight <= 0) {
            return ''
        }

        const topLimit = margin + contentPadding * 0.2
        const bottomLimit = height - margin - footerReserve
        const dominantAnchorBounds =
            SchematicContentLayout.#resolveNormalizedAnchorBounds(
                schematic,
                height,
                bounds
            )
        const anchorDeltaY = dominantAnchorBounds.minY - bounds.minY
        const rightFitScaleLimit =
            (width - margin - contentPadding - bounds.minX) / usedWidth
        const bottomFitScaleLimit =
            (bottomLimit - topLimit) / (bounds.maxY - dominantAnchorBounds.minY)
        const scale = Math.min(
            normalizedScaleLimit,
            rightFitScaleLimit,
            bottomFitScaleLimit
        )

        if (!Number.isFinite(scale) || scale <= 1) {
            return ''
        }

        const targetMinY = topLimit - anchorDeltaY * scale

        return (
            ' transform="translate(' +
            formatNumber(bounds.minX) +
            ' ' +
            formatNumber(targetMinY) +
            ') scale(' +
            SchematicContentLayout.#formatScale(scale) +
            ') translate(' +
            formatNumber(-bounds.minX) +
            ' ' +
            formatNumber(-bounds.minY) +
            ')"'
        )
    }

    /**
     * Builds a bottom-left-anchored scale transform for sparse custom sheets
     * whose declared page is larger than the recovered content envelope.
     * @param {number} width
     * @param {number} height
     * @param {{ paperSize?: string, sourceWidth?: number, sourceHeight?: number } | undefined} sheet
     * @param {number} margin
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} contentPadding
     * @param {number} footerReserve
     * @returns {string}
     */
    static #buildSparseCustomSheetTransform(
        width,
        height,
        sheet,
        margin,
        bounds,
        contentPadding,
        footerReserve
    ) {
        if (
            sheet?.paperSize ||
            width !== Number(sheet?.sourceWidth || 0) ||
            height !== Number(sheet?.sourceHeight || 0)
        ) {
            return ''
        }

        const virtualSourceSheet =
            SchematicContentLayout.#resolveVirtualStandardSourceSheet(
                width,
                height,
                margin,
                bounds
            )

        if (!virtualSourceSheet) {
            return ''
        }

        const virtualInnerWidth = virtualSourceSheet.width - margin * 2
        const targetScale = (width - margin * 2) / virtualInnerWidth

        if (!Number.isFinite(targetScale) || targetScale <= 1) {
            return ''
        }

        const topLimit = margin + contentPadding * 0.2
        const bottomLimit = height - margin - footerReserve
        const rightLimit = width - margin
        const usedWidth = bounds.maxX - bounds.minX
        const usedHeight = bounds.maxY - bounds.minY

        if (usedWidth <= 0 || usedHeight <= 0) {
            return ''
        }

        const scale = Math.min(
            targetScale,
            SchematicContentLayout.#resolveContentScaleLimit(
                bounds.minX,
                bounds.maxX,
                margin,
                rightLimit
            ),
            SchematicContentLayout.#resolveContentScaleLimit(
                bounds.minY,
                bounds.maxY,
                topLimit,
                bottomLimit
            )
        )

        if (!Number.isFinite(scale) || scale <= 1) {
            return ''
        }

        const targetMinX =
            SchematicContentLayout.#resolveCenteredContentTargetMinX(
                bounds,
                scale,
                margin,
                rightLimit
            )
        const projectedMinX = targetMinX
        const projectedMaxX = targetMinX + usedWidth * scale
        const targetMinY = bottomLimit - usedHeight * scale
        const projectedMinY = targetMinY
        const projectedMaxY = bottomLimit

        if (
            projectedMinX < margin - 0.01 ||
            projectedMaxX > rightLimit + 0.01 ||
            projectedMinY < topLimit - 0.01 ||
            projectedMaxY > bottomLimit + 0.01
        ) {
            return ''
        }

        return (
            ' transform="translate(' +
            formatNumber(targetMinX) +
            ' ' +
            formatNumber(targetMinY) +
            ') scale(' +
            SchematicContentLayout.#formatScale(scale) +
            ') translate(' +
            formatNumber(-bounds.minX) +
            ' ' +
            formatNumber(-bounds.minY) +
            ')"'
        )
    }

    /**
     * Resolves one scale cap that keeps a horizontally centered content
     * envelope inside the sheet frame.
     * @param {number} minCoordinate
     * @param {number} maxCoordinate
     * @param {number} minLimit
     * @param {number} maxLimit
     * @returns {number}
     */
    static #resolveContentScaleLimit(
        minCoordinate,
        maxCoordinate,
        minLimit,
        maxLimit
    ) {
        const usedWidth = maxCoordinate - minCoordinate
        const availableWidth = maxLimit - minLimit

        return usedWidth > 0 && availableWidth > 0
            ? availableWidth / usedWidth
            : Infinity
    }

    /**
     * Formats SVG transform scales with enough precision to avoid visible
     * placement drift on large schematic sheets.
     * @param {number} value
     * @returns {string}
     */
    static #formatScale(value) {
        return Number(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    }

    /**
     * Resolves the target SVG x-coordinate for a scaled content envelope.
     * @param {{ minX: number, maxX: number }} bounds
     * @param {number} scale
     * @param {number} leftLimit
     * @param {number} rightLimit
     * @returns {number}
     */
    static #resolveCenteredContentTargetMinX(
        bounds,
        scale,
        leftLimit,
        rightLimit
    ) {
        const scaledWidth = (bounds.maxX - bounds.minX) * scale
        const availableWidth = rightLimit - leftLimit
        const remainingWidth = Math.max(availableWidth - scaledWidth, 0)

        return leftLimit + remainingWidth / 2
    }

    /**
     * Resolves per-edge maximum scale factors for a bottom-left pivot.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} pivotX
     * @param {number} pivotY
     * @param {number} leftLimit
     * @param {number} topLimit
     * @param {number} rightLimit
     * @param {number} bottomLimit
     * @returns {number[]}
     */
    static #resolvePivotScaleLimits(
        bounds,
        pivotX,
        pivotY,
        leftLimit,
        topLimit,
        rightLimit,
        bottomLimit
    ) {
        return [
            SchematicContentLayout.#resolvePivotScaleLimit(
                pivotX,
                bounds.minX,
                leftLimit,
                'min'
            ),
            SchematicContentLayout.#resolvePivotScaleLimit(
                pivotX,
                bounds.maxX,
                rightLimit,
                'max'
            ),
            SchematicContentLayout.#resolvePivotScaleLimit(
                pivotY,
                bounds.minY,
                topLimit,
                'min'
            ),
            SchematicContentLayout.#resolvePivotScaleLimit(
                pivotY,
                bounds.maxY,
                bottomLimit,
                'max'
            )
        ]
    }

    /**
     * Resolves one axis scale cap from an edge limit.
     * @param {number} pivot
     * @param {number} coordinate
     * @param {number} limit
     * @param {'min' | 'max'} mode
     * @returns {number}
     */
    static #resolvePivotScaleLimit(pivot, coordinate, limit, mode) {
        if (mode === 'min') {
            return coordinate < pivot
                ? (pivot - limit) / (pivot - coordinate)
                : Infinity
        }

        return coordinate > pivot
            ? (limit - pivot) / (coordinate - pivot)
            : Infinity
    }

    /**
     * Resolves the maximum sheet-wide scale implied by source and normalized
     * page sizes.
     * @param {number} width
     * @param {number} height
     * @param {{ sourceWidth?: number, sourceHeight?: number }} sheet
     * @param {number} margin
     * @returns {number}
     */
    static #buildNormalizedSheetScaleLimit(width, height, sheet, margin) {
        const sourceWidth = Number(sheet?.sourceWidth || 0)
        const sourceHeight = Number(sheet?.sourceHeight || 0)

        if (
            sourceWidth <= margin * 2 ||
            sourceHeight <= margin * 2 ||
            (width <= sourceWidth && height <= sourceHeight)
        ) {
            return 0
        }

        return Math.min(
            (width - margin * 2) / (sourceWidth - margin * 2),
            (height - margin * 2) / (sourceHeight - margin * 2)
        )
    }

    /**
     * Resolves a looser standard-page proxy for sparse custom sheets so the
     * viewer can scale their content into the authored page without shrinking
     * the sheet itself.
     * @param {number} width
     * @param {number} height
     * @param {number} margin
     * @param {{ minY: number, maxX: number }} bounds
     * @returns {{ label: string, width: number, height: number } | null}
     */
    static #resolveVirtualStandardSourceSheet(width, height, margin, bounds) {
        const requiredWidth = Math.max(Number(bounds.maxX || 0) + margin * 2, 0)
        const requiredHeight = Math.max(
            height - Number(bounds.minY || 0) + margin * 2,
            0
        )
        const landscape = requiredWidth >= requiredHeight
        const candidates = ISO_A_PORTRAIT_SHEETS.map((sheet) => ({
            label: sheet.label,
            width: landscape ? sheet.height : sheet.width,
            height: landscape ? sheet.width : sheet.height
        }))
        const matchingSheet =
            candidates.find(
                (sheet) =>
                    sheet.width >= requiredWidth &&
                    sheet.height >= requiredHeight
            ) || null

        if (!matchingSheet) {
            return null
        }

        const widthSlackRatio =
            (matchingSheet.width - requiredWidth) / requiredWidth
        const heightSlackRatio =
            (matchingSheet.height - requiredHeight) / requiredHeight

        if (
            widthSlackRatio > RELAXED_STANDARD_PAGE_MAX_SLACK_RATIO ||
            heightSlackRatio > RELAXED_STANDARD_PAGE_MAX_SLACK_RATIO ||
            matchingSheet.width >= width
        ) {
            return null
        }

        return {
            ...matchingSheet,
            width: SchematicContentLayout.#resolveTightVirtualDimension(
                requiredWidth,
                matchingSheet.width,
                margin
            )
        }
    }

    /**
     * Drops near-zero standard-page rounding slack from the scale axis so
     * custom sheets that almost fill a standard source size do not render with
     * a visible artificial gutter.
     * @param {number} requiredDimension
     * @param {number} candidateDimension
     * @param {number} margin
     * @returns {number}
     */
    static #resolveTightVirtualDimension(
        requiredDimension,
        candidateDimension,
        margin
    ) {
        const slack = candidateDimension - requiredDimension

        return slack > 0 && slack <= margin
            ? requiredDimension
            : candidateDimension
    }

    /**
     * Resolves one conservative padding band so scaled content leaves room for
     * visible labels and stroke caps inside the sheet frame.
     * @param {{ fonts?: Record<string, { size?: number }> } | undefined} sheet
     * @param {number} margin
     * @returns {number}
     */
    static #resolveContentPadding(sheet, margin) {
        const fontSizes = Object.values(sheet?.fonts || {}).map(
            (font) =>
                SchematicTypography.resolveViewerFontSize(
                    Number(font?.size || 0)
                ) || 0
        )
        const maxViewerFontSize = Math.max(...fontSizes, 0)

        return Math.max(maxViewerFontSize * 1.5, margin)
    }

    /**
     * Reserves a small bottom band when the page footer/title block is shown
     * so vertically scaled content sits in the main drawing area instead of
     * visually sagging toward the footer.
     * @param {{ titleBlockOn?: boolean } | undefined} sheet
     * @param {number} margin
     * @returns {number}
     */
    static #resolveFooterReserve(sheet, margin) {
        if (!sheet?.titleBlockOn) {
            return 0
        }

        return margin
    }

    /**
     * Resolves the dominant rendered box that should guide normalized-sheet
     * top anchoring when a large authored frame sits below smaller outliers.
     * @param {{ rectangles?: { x: number, y: number, width: number, height: number }[], regions?: { x: number, y: number, width: number, height: number }[] }} schematic
     * @param {number} sheetHeight
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #resolveNormalizedAnchorBounds(schematic, sheetHeight, bounds) {
        const totalWidth = bounds.maxX - bounds.minX
        const totalHeight = bounds.maxY - bounds.minY

        if (totalWidth <= 0 || totalHeight <= 0) {
            return bounds
        }

        const minimumWidth = totalWidth * 0.45
        const minimumHeight = totalHeight * 0.2
        const minimumArea = totalWidth * totalHeight * 0.12
        const candidates = [
            ...SchematicContentLayout.#collectRenderedBoxBounds(
                schematic?.rectangles,
                sheetHeight
            ),
            ...SchematicContentLayout.#collectRenderedBoxBounds(
                schematic?.regions,
                sheetHeight
            )
        ].filter((candidate) => {
            const width = candidate.maxX - candidate.minX
            const height = candidate.maxY - candidate.minY
            const area = width * height

            return (
                candidate.minY > bounds.minY &&
                width >= minimumWidth &&
                height >= minimumHeight &&
                area >= minimumArea
            )
        })

        if (!candidates.length) {
            return bounds
        }

        candidates.sort(
            (left, right) =>
                left.minY - right.minY ||
                (right.maxX - right.minX) * (right.maxY - right.minY) -
                    (left.maxX - left.minX) * (left.maxY - left.minY)
        )

        return candidates[0]
    }

    /**
     * Collects one approximate visible content envelope in rendered SVG
     * coordinates.
     * @param {{ lines?: { x1: number, y1: number, x2: number, y2: number }[], polygons?: { points: { x: number, y: number }[] }[], rectangles?: { x: number, y: number, width: number, height: number }[], regions?: { x: number, y: number, width: number, height: number }[], ellipses?: { x: number, y: number, radiusX: number, radiusY: number }[], arcs?: { x: number, y: number, radius: number }[], texts?: { x: number, y: number }[], components?: { x: number, y: number }[], pins?: { x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[], ports?: { x: number, y: number, width: number, height: number, direction?: 'left' | 'right' | 'up' | 'down' }[], crosses?: { x: number, y: number, size?: number }[] }} schematic
     * @param {number} sheetHeight
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #collectRenderedContentBounds(schematic, sheetHeight) {
        const coordinates = []

        for (const line of schematic?.lines || []) {
            coordinates.push(
                [line.x1, projectSchematicY(sheetHeight, line.y1)],
                [line.x2, projectSchematicY(sheetHeight, line.y2)]
            )
        }

        for (const polygon of schematic?.polygons || []) {
            for (const point of polygon.points || []) {
                coordinates.push([
                    point.x,
                    projectSchematicY(sheetHeight, point.y)
                ])
            }
        }

        for (const rectangle of schematic?.rectangles || []) {
            coordinates.push(
                [
                    rectangle.x,
                    projectSchematicY(
                        sheetHeight,
                        rectangle.y + rectangle.height
                    )
                ],
                [
                    rectangle.x + rectangle.width,
                    projectSchematicY(sheetHeight, rectangle.y)
                ]
            )
        }

        for (const region of schematic?.regions || []) {
            coordinates.push(
                [
                    region.x,
                    projectSchematicY(sheetHeight, region.y + region.height)
                ],
                [
                    region.x + region.width,
                    projectSchematicY(sheetHeight, region.y)
                ]
            )
        }

        for (const ellipse of schematic?.ellipses || []) {
            coordinates.push(
                [
                    ellipse.x - Math.max(Number(ellipse.radiusX || 0), 0),
                    projectSchematicY(
                        sheetHeight,
                        ellipse.y + Math.max(Number(ellipse.radiusY || 0), 0)
                    )
                ],
                [
                    ellipse.x + Math.max(Number(ellipse.radiusX || 0), 0),
                    projectSchematicY(
                        sheetHeight,
                        ellipse.y - Math.max(Number(ellipse.radiusY || 0), 0)
                    )
                ]
            )
        }

        for (const arc of schematic?.arcs || []) {
            const radius = Math.max(Number(arc.radius || 0), 0)
            coordinates.push(
                [
                    arc.x - radius,
                    projectSchematicY(sheetHeight, arc.y + radius)
                ],
                [arc.x + radius, projectSchematicY(sheetHeight, arc.y - radius)]
            )
        }

        for (const text of schematic?.texts || []) {
            coordinates.push([text.x, projectSchematicY(sheetHeight, text.y)])
        }

        for (const component of schematic?.components || []) {
            if (!SchematicContentLayout.#isDrawableComponentAnchor(component)) {
                continue
            }

            coordinates.push([
                component.x,
                projectSchematicY(sheetHeight, component.y)
            ])
        }

        for (const pin of schematic?.pins || []) {
            const geometry = SchematicContentLayout.#projectPinGeometry(pin)
            if (!geometry) {
                continue
            }

            coordinates.push(
                [
                    geometry.bodyX,
                    projectSchematicY(sheetHeight, geometry.bodyY)
                ],
                [
                    geometry.outerX,
                    projectSchematicY(sheetHeight, geometry.outerY)
                ]
            )
        }

        for (const port of schematic?.ports || []) {
            if (port.direction === 'up' || port.direction === 'down') {
                const halfWidth = Number(port.height || 0) / 2
                coordinates.push(
                    [
                        port.x - halfWidth,
                        projectSchematicY(sheetHeight, port.y + port.width)
                    ],
                    [port.x + halfWidth, projectSchematicY(sheetHeight, port.y)]
                )
                continue
            }

            coordinates.push(
                [port.x, projectSchematicY(sheetHeight, port.y + port.height)],
                [port.x + port.width, projectSchematicY(sheetHeight, port.y)]
            )
        }

        for (const cross of schematic?.crosses || []) {
            const half = Math.max(Number(cross.size || 6), 4) / 2
            coordinates.push(
                [
                    cross.x - half,
                    projectSchematicY(sheetHeight, cross.y) - half
                ],
                [cross.x + half, projectSchematicY(sheetHeight, cross.y) + half]
            )
        }

        if (!coordinates.length) {
            return null
        }

        return {
            minX: Math.min(...coordinates.map(([x]) => x)),
            minY: Math.min(...coordinates.map(([, y]) => y)),
            maxX: Math.max(...coordinates.map(([x]) => x)),
            maxY: Math.max(...coordinates.map(([, y]) => y))
        }
    }

    /**
     * Returns true when one component anchor can produce visible fallback
     * markup and should therefore influence layout bounds.
     * @param {{ x?: number, y?: number, designator?: string }} component
     * @returns {boolean}
     */
    static #isDrawableComponentAnchor(component) {
        if (!component) return false

        const hasCoordinates =
            Number.isFinite(component.x) &&
            Number.isFinite(component.y) &&
            (component.x !== 0 || component.y !== 0)
        const hasDesignator =
            Boolean(component.designator) && component.designator !== 'U?'

        return hasCoordinates && hasDesignator
    }

    /**
     * Projects authored rectangles or regions into rendered SVG bounds.
     * @param {{ x: number, y: number, width: number, height: number }[] | undefined} boxes
     * @param {number} sheetHeight
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }[]}
     */
    static #collectRenderedBoxBounds(boxes, sheetHeight) {
        return (boxes || []).map((box) => ({
            minX: box.x,
            minY: projectSchematicY(sheetHeight, box.y + box.height),
            maxX: box.x + box.width,
            maxY: projectSchematicY(sheetHeight, box.y)
        }))
    }

    /**
     * Computes the inner endpoint for one schematic pin stub.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ bodyX: number, bodyY: number, outerX: number, outerY: number } | null}
     */
    static #projectPinGeometry(pin) {
        switch (pin.orientation) {
            case 'left':
                return {
                    bodyX: pin.x,
                    bodyY: pin.y,
                    outerX: pin.x - pin.length,
                    outerY: pin.y
                }
            case 'right':
                return {
                    bodyX: pin.x,
                    bodyY: pin.y,
                    outerX: pin.x + pin.length,
                    outerY: pin.y
                }
            case 'top':
                return {
                    bodyX: pin.x,
                    bodyY: pin.y,
                    outerX: pin.x,
                    outerY: pin.y + pin.length
                }
            case 'bottom':
                return {
                    bodyX: pin.x,
                    bodyY: pin.y,
                    outerX: pin.x,
                    outerY: pin.y - pin.length
                }
            default:
                return null
        }
    }
}
