// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils

/**
 * Renders normalized schematic shape primitives into SVG markup.
 */
export class SchematicShapeRenderer {
    /**
     * Builds one schematic polygon primitive.
     * @param {{ points: { x: number, y: number }[], color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, lineStyle?: number }} polygon
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildPolygonMarkup(polygon, sheetHeight) {
        if (
            !polygon?.points?.length ||
            polygon.transparent ||
            !polygon.isSolid
        ) {
            return ''
        }

        return (
            '<polygon class="schematic-polygon" points="' +
            escapeHtml(
                polygon.points
                    .map(
                        (point) =>
                            formatNumber(point.x) +
                            ',' +
                            formatNumber(
                                projectSchematicY(sheetHeight, point.y)
                            )
                    )
                    .join(' ')
            ) +
            '" fill="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextFill(
                    polygon.fill || 'none',
                    '--schematic-fill-color',
                    true
                )
            ) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextColor(
                    polygon.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(polygon.lineWidth || 1, 0.8)) +
            '"' +
            SchematicShapeRenderer.#buildSchematicStrokeStyleAttributes(
                polygon.lineWidth,
                polygon.lineStyle
            ) +
            ' stroke-linejoin="round" />'
        )
    }

    /**
     * Builds one schematic cubic Bezier primitive.
     * @param {{ segments: { start: { x: number, y: number }, control1: { x: number, y: number }, control2: { x: number, y: number }, end: { x: number, y: number } }[], color: string, width: number, lineStyle?: number }} bezier
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildBezierMarkup(bezier, sheetHeight) {
        const segments = Array.isArray(bezier?.segments) ? bezier.segments : []
        if (!segments.length) {
            return ''
        }

        const path = segments
            .map((segment, index) => {
                const start = SchematicShapeRenderer.#projectPoint(
                    segment.start,
                    sheetHeight
                )
                const control1 = SchematicShapeRenderer.#projectPoint(
                    segment.control1,
                    sheetHeight
                )
                const control2 = SchematicShapeRenderer.#projectPoint(
                    segment.control2,
                    sheetHeight
                )
                const end = SchematicShapeRenderer.#projectPoint(
                    segment.end,
                    sheetHeight
                )
                const move =
                    index === 0
                        ? 'M ' +
                          formatNumber(start.x) +
                          ' ' +
                          formatNumber(start.y) +
                          ' '
                        : ''

                return (
                    move +
                    'C ' +
                    formatNumber(control1.x) +
                    ' ' +
                    formatNumber(control1.y) +
                    ' ' +
                    formatNumber(control2.x) +
                    ' ' +
                    formatNumber(control2.y) +
                    ' ' +
                    formatNumber(end.x) +
                    ' ' +
                    formatNumber(end.y)
                )
            })
            .join(' ')

        return (
            '<path class="schematic-bezier" d="' +
            escapeHtml(path) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextColor(
                    bezier.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(bezier.width || 1, 0.8)) +
            '"' +
            SchematicShapeRenderer.#buildSchematicStrokeStyleAttributes(
                bezier.width,
                bezier.lineStyle
            ) +
            ' fill="none" />'
        )
    }

    /**
     * Builds one schematic pie/wedge primitive.
     * @param {{ x: number, y: number, radius: number, radiusY?: number, startAngle: number, endAngle: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number }} pie
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildPieMarkup(pie, sheetHeight) {
        const radiusX = Math.max(Number(pie.radius) || 0, 0.8)
        const radiusY = Math.max(Number(pie.radiusY ?? pie.radius) || 0, 0.8)
        const delta = SchematicShapeRenderer.#normalizeArcDelta(
            pie.startAngle,
            pie.endAngle
        )
        const sweep = SchematicShapeRenderer.#resolvePieSweep(delta)
        const center = {
            x: Number(pie.x) || 0,
            y: projectSchematicY(sheetHeight, Number(pie.y) || 0)
        }
        const start = SchematicShapeRenderer.#projectArcPoint(
            pie,
            pie.startAngle,
            sheetHeight,
            radiusX,
            radiusY
        )
        const end = SchematicShapeRenderer.#projectArcPoint(
            pie,
            pie.endAngle,
            sheetHeight,
            radiusX,
            radiusY
        )
        const largeArc = Math.abs(delta) > 180 ? 1 : 0
        const path =
            'M ' +
            formatNumber(center.x) +
            ' ' +
            formatNumber(center.y) +
            ' L ' +
            formatNumber(start.x) +
            ' ' +
            formatNumber(start.y) +
            ' A ' +
            formatNumber(radiusX) +
            ' ' +
            formatNumber(radiusY) +
            ' 0 ' +
            largeArc +
            ' ' +
            sweep +
            ' ' +
            formatNumber(end.x) +
            ' ' +
            formatNumber(end.y) +
            ' Z'

        return (
            '<path class="schematic-pie" d="' +
            escapeHtml(path) +
            '" fill="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextFill(
                    SchematicShapeRenderer.#resolveSchematicPieFill(pie),
                    '--schematic-fill-color',
                    true
                )
            ) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextColor(
                    pie.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(pie.lineWidth || 1, 0.8)) +
            '" />'
        )
    }

    /**
     * Builds one schematic rectangle primitive.
     * @param {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, lineStyle?: number, ownerIndex?: string }} rectangle
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildRectangleMarkup(rectangle, sheetHeight) {
        const preserveSourceColors =
            SchematicShapeRenderer.#isOwnerColorStrip(rectangle)
        const fill = SchematicShapeRenderer.#resolveSchematicRectangleFill(
            rectangle,
            preserveSourceColors
        )

        return (
            '<rect class="schematic-rectangle" x="' +
            formatNumber(rectangle.x) +
            '" y="' +
            formatNumber(
                projectSchematicY(sheetHeight, rectangle.y + rectangle.height)
            ) +
            '" width="' +
            formatNumber(rectangle.width) +
            '" height="' +
            formatNumber(rectangle.height) +
            '" fill="' +
            escapeHtml(
                preserveSourceColors
                    ? SchematicColorResolver.resolveMutedSourceFill(
                          fill,
                          '--schematic-fill-color'
                      )
                    : SchematicColorResolver.resolveNonTextFill(
                          fill,
                          '--schematic-fill-color'
                      )
            ) +
            '" stroke="' +
            escapeHtml(
                preserveSourceColors
                    ? SchematicColorResolver.resolveMutedSourceColor(
                          rectangle.color,
                          '--schematic-default-ink-color'
                      )
                    : SchematicColorResolver.resolveNonTextColor(
                          rectangle.color,
                          '--schematic-default-ink-color'
                      )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(rectangle.lineWidth || 1, 0.8)) +
            '"' +
            SchematicShapeRenderer.#buildSchematicStrokeStyleAttributes(
                rectangle.lineWidth,
                rectangle.lineStyle
            ) +
            ' />'
        )
    }

    /**
     * Builds one schematic rounded-rectangle primitive.
     * @param {{ x: number, y: number, width: number, height: number, radius?: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, lineStyle?: number, ownerIndex?: string }} rectangle
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildRoundedRectangleMarkup(rectangle, sheetHeight) {
        const radius = Math.max(Number(rectangle.radius || 0), 0)
        const preserveSourceColors =
            SchematicShapeRenderer.#isOwnerColorStrip(rectangle)
        const fill = SchematicShapeRenderer.#resolveSchematicRectangleFill(
            rectangle,
            preserveSourceColors
        )

        return (
            '<rect class="schematic-rounded-rectangle" x="' +
            formatNumber(rectangle.x) +
            '" y="' +
            formatNumber(
                projectSchematicY(sheetHeight, rectangle.y + rectangle.height)
            ) +
            '" width="' +
            formatNumber(rectangle.width) +
            '" height="' +
            formatNumber(rectangle.height) +
            '" rx="' +
            formatNumber(radius) +
            '" ry="' +
            formatNumber(radius) +
            '" fill="' +
            escapeHtml(
                preserveSourceColors
                    ? SchematicColorResolver.resolveMutedSourceFill(
                          fill,
                          '--schematic-fill-color'
                      )
                    : SchematicColorResolver.resolveNonTextFill(
                          fill,
                          '--schematic-fill-color'
                      )
            ) +
            '" stroke="' +
            escapeHtml(
                preserveSourceColors
                    ? SchematicColorResolver.resolveMutedSourceColor(
                          rectangle.color,
                          '--schematic-default-ink-color'
                      )
                    : SchematicColorResolver.resolveNonTextColor(
                          rectangle.color,
                          '--schematic-default-ink-color'
                      )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(rectangle.lineWidth || 1, 0.8)) +
            '"' +
            SchematicShapeRenderer.#buildSchematicStrokeStyleAttributes(
                rectangle.lineWidth,
                rectangle.lineStyle
            ) +
            ' />'
        )
    }

    /**
     * Builds one schematic IEEE-symbol primitive.
     * @param {{ x: number, y: number, symbolName?: string, size?: number, color: string, lineWidth?: number }} symbol
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildIeeeSymbolMarkup(symbol, sheetHeight) {
        const name = String(symbol?.symbolName || 'unknown')
        const size = Math.max(Number(symbol?.size || 12), 1)
        const x = Number(symbol?.x || 0)
        const y = projectSchematicY(sheetHeight, Number(symbol?.y || 0))
        const color = escapeHtml(
            SchematicColorResolver.resolveNonTextColor(
                symbol.color,
                '--schematic-default-ink-color'
            )
        )
        const strokeWidth = formatNumber(Math.max(symbol.lineWidth || 1, 0.8))

        return (
            '<g class="schematic-ieee-symbol schematic-ieee-symbol--' +
            escapeHtml(name) +
            '">' +
            SchematicShapeRenderer.#buildIeeeSymbolShape(
                name,
                x,
                y,
                size,
                color,
                strokeWidth
            ) +
            '</g>'
        )
    }

    /**
     * Builds one schematic arc primitive as an SVG path.
     * Record-11 curves may supply `radiusY` for ellipse segments.
     * @param {{ x: number, y: number, radius: number, radiusY?: number, startAngle: number, endAngle: number, color: string, width: number }} arc
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildArcMarkup(arc, sheetHeight) {
        const radiusX = Math.max(Number(arc.radius) || 0, 0.8)
        const radiusY = Math.max(Number(arc.radiusY ?? arc.radius) || 0, 0.8)
        const delta = SchematicShapeRenderer.#normalizeArcDelta(
            arc.startAngle,
            arc.endAngle
        )
        const sweep = delta >= 0 ? 0 : 1
        const path =
            Math.abs(delta) >= 359.999
                ? SchematicShapeRenderer.#buildFullCircleArcPath(
                      arc,
                      radiusX,
                      radiusY,
                      sheetHeight,
                      sweep
                  )
                : SchematicShapeRenderer.#buildPartialArcPath(
                      arc,
                      radiusX,
                      radiusY,
                      sheetHeight,
                      delta,
                      sweep
                  )

        return (
            '<path class="schematic-arc" d="' +
            path +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextColor(
                    arc.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(arc.width || 1, 0.8)) +
            '" fill="none" />'
        )
    }

    /**
     * Builds one schematic ellipse primitive.
     * @param {{ x: number, y: number, radiusX: number, radiusY: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number }} ellipse
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildEllipseMarkup(ellipse, sheetHeight) {
        return (
            '<ellipse class="schematic-ellipse" cx="' +
            formatNumber(ellipse.x) +
            '" cy="' +
            formatNumber(projectSchematicY(sheetHeight, ellipse.y)) +
            '" rx="' +
            formatNumber(Math.max(Number(ellipse.radiusX) || 0, 0.8)) +
            '" ry="' +
            formatNumber(Math.max(Number(ellipse.radiusY) || 0, 0.8)) +
            '" fill="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextFill(
                    SchematicShapeRenderer.#resolveSchematicEllipseFill(
                        ellipse
                    ),
                    '--schematic-fill-light-color'
                )
            ) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextColor(
                    ellipse.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(ellipse.lineWidth || 1, 0.8)) +
            '" />'
        )
    }

    /**
     * Resolves the visible fill for one schematic rectangle primitive.
     * @param {{ fill: string, isSolid: boolean, transparent: boolean }} rectangle
     * @param {boolean} preserveSourceFill
     * @returns {string}
     */
    static #resolveSchematicRectangleFill(rectangle, preserveSourceFill) {
        if (rectangle.transparent || !rectangle.isSolid) {
            if (
                preserveSourceFill &&
                SchematicShapeRenderer.#hasVisibleSourceFill(rectangle)
            ) {
                return rectangle.fill
            }

            return 'none'
        }

        return rectangle.fill || 'none'
    }

    /**
     * Returns true when a transparent owner color strip still carries an
     * authored fill color that encodes symbol-side rail intent.
     * @param {{ fill?: string }} rectangle
     * @returns {boolean}
     */
    static #hasVisibleSourceFill(rectangle) {
        const fill = String(rectangle?.fill || '')
            .trim()
            .toLowerCase()

        return Boolean(fill) && fill !== 'none' && fill !== 'transparent'
    }

    /**
     * Returns true for narrow symbol-owned color swatches such as per-section
     * strips that carry source palette meaning.
     * @param {{ width: number, height: number, ownerIndex?: string }} rectangle
     * @returns {boolean}
     */
    static #isOwnerColorStrip(rectangle) {
        if (!rectangle?.ownerIndex) {
            return false
        }

        const width = Math.abs(Number(rectangle.width || 0))
        const height = Math.abs(Number(rectangle.height || 0))
        const shortSide = Math.min(width, height)
        const longSide = Math.max(width, height)

        return shortSide > 0 && shortSide <= 8 && longSide >= 20
    }

    /**
     * Resolves the visible fill for one schematic ellipse primitive.
     * @param {{ fill: string, isSolid: boolean, transparent: boolean }} ellipse
     * @returns {string}
     */
    static #resolveSchematicEllipseFill(ellipse) {
        if (ellipse.transparent || !ellipse.isSolid) {
            return 'none'
        }

        return ellipse.fill || 'none'
    }

    /**
     * Resolves the visible fill for one schematic pie primitive.
     * @param {{ fill: string, isSolid: boolean, transparent: boolean }} pie
     * @returns {string}
     */
    static #resolveSchematicPieFill(pie) {
        if (pie.transparent || !pie.isSolid) {
            return 'none'
        }

        return pie.fill || 'none'
    }

    /**
     * Builds the inner geometry for one normalized IEEE symbol.
     * @param {string} name Symbol name.
     * @param {number} x Center X.
     * @param {number} y Center Y.
     * @param {number} size Symbol size.
     * @param {string} color SVG color.
     * @param {string} strokeWidth SVG stroke width.
     * @returns {string}
     */
    static #buildIeeeSymbolShape(name, x, y, size, color, strokeWidth) {
        const half = size / 2
        const left = x - half
        const right = x + half
        const top = y - half
        const bottom = y + half

        if (name === 'inverter' || name === 'buffer') {
            const bubble =
                name === 'inverter'
                    ? '<circle cx="' +
                      formatNumber(right + size * 0.18) +
                      '" cy="' +
                      formatNumber(y) +
                      '" r="' +
                      formatNumber(size * 0.18) +
                      '" fill="none" stroke="' +
                      color +
                      '" stroke-width="' +
                      strokeWidth +
                      '" />'
                    : ''

            return (
                '<path d="M ' +
                formatNumber(left) +
                ' ' +
                formatNumber(top) +
                ' L ' +
                formatNumber(left) +
                ' ' +
                formatNumber(bottom) +
                ' L ' +
                formatNumber(right) +
                ' ' +
                formatNumber(y) +
                ' Z" fill="none" stroke="' +
                color +
                '" stroke-width="' +
                strokeWidth +
                '" stroke-linejoin="round" />' +
                bubble
            )
        }

        if (name === 'clock') {
            return (
                '<path d="M ' +
                formatNumber(left) +
                ' ' +
                formatNumber(top) +
                ' L ' +
                formatNumber(x) +
                ' ' +
                formatNumber(y) +
                ' L ' +
                formatNumber(left) +
                ' ' +
                formatNumber(bottom) +
                '" fill="none" stroke="' +
                color +
                '" stroke-width="' +
                strokeWidth +
                '" stroke-linejoin="round" />'
            )
        }

        return (
            '<circle cx="' +
            formatNumber(x) +
            '" cy="' +
            formatNumber(y) +
            '" r="' +
            formatNumber(half) +
            '" fill="none" stroke="' +
            color +
            '" stroke-width="' +
            strokeWidth +
            '" />'
        )
    }

    /**
     * Projects one schematic coordinate pair into SVG coordinates.
     * @param {{ x: number, y: number }} point Source point.
     * @param {number} sheetHeight Sheet height.
     * @returns {{ x: number, y: number }}
     */
    static #projectPoint(point, sheetHeight) {
        return {
            x: Number(point?.x) || 0,
            y: projectSchematicY(sheetHeight, Number(point?.y) || 0)
        }
    }

    /**
     * Returns SVG stroke attributes for one schematic outline style.
     * @param {number | undefined} lineWidth
     * @param {number | undefined} lineStyle
     * @returns {string}
     */
    static #buildSchematicStrokeStyleAttributes(lineWidth, lineStyle) {
        const resolvedLineStyle = Number(lineStyle || 0)
        if (
            resolvedLineStyle !== 1 &&
            resolvedLineStyle !== 2 &&
            resolvedLineStyle !== 3
        )
            return ''

        const dashLength = Math.max(Number(lineWidth || 1) * 8, 8)
        const gapLength = Math.max(Number(lineWidth || 1) * 5, 5)
        const dotLength = Math.max(Number(lineWidth || 1) * 1.5, 1.5)
        const dashPattern =
            resolvedLineStyle === 1
                ? [dashLength, gapLength]
                : resolvedLineStyle === 2
                  ? [dotLength, gapLength]
                  : [dashLength, gapLength, dotLength, gapLength]

        return (
            ' stroke-dasharray="' +
            dashPattern.map((part) => formatNumber(part)).join(' ') +
            '" stroke-linecap="round"'
        )
    }

    /**
     * Builds one non-circular SVG arc path.
     * @param {{ x: number, y: number, radius: number, radiusY?: number, startAngle: number, endAngle: number }} arc
     * @param {number} radiusX
     * @param {number} radiusY
     * @param {number} sheetHeight
     * @param {number} delta
     * @param {0 | 1} sweep
     * @returns {string}
     */
    static #buildPartialArcPath(
        arc,
        radiusX,
        radiusY,
        sheetHeight,
        delta,
        sweep
    ) {
        const start = SchematicShapeRenderer.#projectArcPoint(
            arc,
            arc.startAngle,
            sheetHeight,
            radiusX,
            radiusY,
            true
        )
        const end = SchematicShapeRenderer.#projectArcPoint(
            arc,
            arc.endAngle,
            sheetHeight,
            radiusX,
            radiusY,
            true
        )

        return (
            'M ' +
            formatNumber(start.x) +
            ' ' +
            formatNumber(start.y) +
            ' A ' +
            formatNumber(radiusX) +
            ' ' +
            formatNumber(radiusY) +
            ' 0 ' +
            (Math.abs(delta) > 180 ? '1' : '0') +
            ' ' +
            sweep +
            ' ' +
            formatNumber(end.x) +
            ' ' +
            formatNumber(end.y)
        )
    }

    /**
     * Builds one full-circle arc path from two half-arc segments.
     * @param {{ x: number, y: number, startAngle: number }} arc
     * @param {number} radiusX
     * @param {number} radiusY
     * @param {number} sheetHeight
     * @param {0 | 1} sweep
     * @returns {string}
     */
    static #buildFullCircleArcPath(arc, radiusX, radiusY, sheetHeight, sweep) {
        const startAngle = Number(arc.startAngle) || 0
        const midAngle = startAngle + (sweep === 0 ? 180 : -180)
        const start = SchematicShapeRenderer.#projectArcPoint(
            arc,
            startAngle,
            sheetHeight,
            radiusX,
            radiusY,
            true
        )
        const mid = SchematicShapeRenderer.#projectArcPoint(
            arc,
            midAngle,
            sheetHeight,
            radiusX,
            radiusY,
            true
        )

        return (
            'M ' +
            formatNumber(start.x) +
            ' ' +
            formatNumber(start.y) +
            ' A ' +
            formatNumber(radiusX) +
            ' ' +
            formatNumber(radiusY) +
            ' 0 0 ' +
            sweep +
            ' ' +
            formatNumber(mid.x) +
            ' ' +
            formatNumber(mid.y) +
            ' A ' +
            formatNumber(radiusX) +
            ' ' +
            formatNumber(radiusY) +
            ' 0 0 ' +
            sweep +
            ' ' +
            formatNumber(start.x) +
            ' ' +
            formatNumber(start.y)
        )
    }

    /**
     * Projects one schematic arc point into the SVG coordinate system.
     * @param {{ x: number, y: number }} arc
     * @param {number} angle
     * @param {number} sheetHeight
     * @param {number} radiusX
     * @param {number} radiusY
     * @param {boolean} [convertEllipseAngle]
     * @returns {{ x: number, y: number }}
     */
    static #projectArcPoint(
        arc,
        angle,
        sheetHeight,
        radiusX,
        radiusY,
        convertEllipseAngle = false
    ) {
        const projectedAngle = convertEllipseAngle
            ? SchematicShapeRenderer.#projectEllipticalArcAngle(
                  angle,
                  radiusX,
                  radiusY
              )
            : Number(angle)
        const radians = (projectedAngle * Math.PI) / 180

        return {
            x: Number(arc.x) + radiusX * Math.cos(radians),
            y: projectSchematicY(
                sheetHeight,
                Number(arc.y) + radiusY * Math.sin(radians)
            )
        }
    }

    /**
     * Converts an authored physical ellipse angle into an SVG parametric
     * ellipse angle.
     * @param {number} angle Source angle in degrees.
     * @param {number} radiusX Horizontal radius.
     * @param {number} radiusY Vertical radius.
     * @returns {number}
     */
    static #projectEllipticalArcAngle(angle, radiusX, radiusY) {
        if (Math.abs(Number(radiusX) - Number(radiusY)) < 0.000001) {
            return Number(angle)
        }

        const radians = (Number(angle) * Math.PI) / 180
        return (
            (Math.atan2(
                Number(radiusX) * Math.sin(radians),
                Number(radiusY) * Math.cos(radians)
            ) *
                180) /
            Math.PI
        )
    }

    /**
     * Keeps one schematic arc delta inside a single turn.
     * @param {number} startAngle
     * @param {number} endAngle
     * @returns {number}
     */
    static #normalizeArcDelta(startAngle, endAngle) {
        let delta = Number(endAngle) - Number(startAngle)

        while (delta <= -360) {
            delta += 360
        }

        while (delta > 360) {
            delta -= 360
        }

        return delta
    }

    /**
     * Resolves SVG sweep direction for filled Altium pie primitives.
     * @param {number} delta Normalized source angle delta.
     * @returns {number}
     */
    static #resolvePieSweep(delta) {
        const magnitude = Math.abs(Number(delta) || 0)

        if (Math.abs(magnitude - 180) <= 0.001) {
            return 0
        }

        return delta >= 0 ? 0 : 1
    }
}
