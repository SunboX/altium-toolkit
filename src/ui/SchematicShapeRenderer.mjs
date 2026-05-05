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
                SchematicColorResolver.resolveFill(
                    polygon.fill || 'none',
                    '--schematic-fill-color',
                    true
                )
            ) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
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
     * Builds one schematic rectangle primitive.
     * @param {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, lineStyle?: number }} rectangle
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildRectangleMarkup(rectangle, sheetHeight) {
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
                SchematicColorResolver.resolveFill(
                    SchematicShapeRenderer.#resolveSchematicRectangleFill(
                        rectangle
                    ),
                    '--schematic-fill-color'
                )
            ) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
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
                SchematicColorResolver.resolveColor(
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
                SchematicColorResolver.resolveFill(
                    SchematicShapeRenderer.#resolveSchematicEllipseFill(
                        ellipse
                    ),
                    '--schematic-fill-light-color'
                )
            ) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
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
     * @returns {string}
     */
    static #resolveSchematicRectangleFill(rectangle) {
        if (rectangle.transparent || !rectangle.isSolid) {
            return 'none'
        }

        return rectangle.fill || 'none'
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
     * Returns SVG stroke attributes for one schematic outline style.
     * @param {number | undefined} lineWidth
     * @param {number | undefined} lineStyle
     * @returns {string}
     */
    static #buildSchematicStrokeStyleAttributes(lineWidth, lineStyle) {
        if (Number(lineStyle || 0) !== 1) {
            return ''
        }

        const dashLength = Math.max(Number(lineWidth || 1) * 8, 8)
        const gapLength = Math.max(Number(lineWidth || 1) * 5, 5)

        return (
            ' stroke-dasharray="' +
            formatNumber(dashLength) +
            ' ' +
            formatNumber(gapLength) +
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
            radiusY
        )
        const end = SchematicShapeRenderer.#projectArcPoint(
            arc,
            arc.endAngle,
            sheetHeight,
            radiusX,
            radiusY
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
            radiusY
        )
        const mid = SchematicShapeRenderer.#projectArcPoint(
            arc,
            midAngle,
            sheetHeight,
            radiusX,
            radiusY
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
     * @returns {{ x: number, y: number }}
     */
    static #projectArcPoint(arc, angle, sheetHeight, radiusX, radiusY) {
        const radians = (Number(angle) * Math.PI) / 180

        return {
            x: Number(arc.x) + radiusX * Math.cos(radians),
            y: projectSchematicY(
                sheetHeight,
                Number(arc.y) + radiusY * Math.sin(radians)
            )
        }
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
}
