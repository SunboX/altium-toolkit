import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'

const { createSvgText, escapeHtml, formatNumber, projectSchematicY } =
    SchematicSvgUtils

/**
 * Renders normalized schematic directives into SVG markup.
 */
export class SchematicDirectiveRenderer {
    /**
     * Builds directive markup for supported schematic directive primitives.
     * @param {{ x: number, y: number, color: string, name: string, orientation?: number }[]} directives
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static buildMarkup(directives, sheetHeight, sheet) {
        return directives
            .map((directive) =>
                SchematicDirectiveRenderer.#buildDirectiveMarkup(
                    directive,
                    sheetHeight,
                    sheet
                )
            )
            .join('')
    }

    /**
     * Builds one supported directive glyph.
     * @param {{ x: number, y: number, color: string, name: string, orientation?: number }} directive
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static #buildDirectiveMarkup(directive, sheetHeight, sheet) {
        switch (String(directive?.name || '').toUpperCase()) {
            case 'DIFFPAIR':
                return SchematicDirectiveRenderer.#buildDiffPairMarkup(
                    directive,
                    sheetHeight
                )
            case 'DIFFPAIRROUTING':
                return SchematicDirectiveRenderer.#buildRouteMarkup(
                    directive,
                    sheetHeight,
                    sheet
                )
            default:
                return ''
        }
    }

    /**
     * Builds the labeled route-callout marker for one differential-pair
     * routing directive.
     * @param {{ x: number, y: number, color: string, orientation?: number }} directive
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static #buildRouteMarkup(directive, sheetHeight, sheet) {
        const color = SchematicColorResolver.resolveColor(
            directive.color,
            '--schematic-alert-color'
        )
        const projectedY = projectSchematicY(sheetHeight, directive.y)
        const verticalDirection =
            Number(directive.orientation || 0) === 3 ? 1 : -1
        const circleRadius = 7
        const circleCenterY = projectedY + verticalDirection * 18
        const leaderEndY = circleCenterY - verticalDirection * circleRadius
        const labelOptions =
            SchematicTypography.buildViewerSchematicFontOptions(sheet)
        const infoOptions = {
            ...labelOptions,
            fontSize: Math.max(Number(labelOptions.fontSize || 9) - 1, 6),
            fontWeight: 700
        }
        const labelY =
            circleCenterY +
            verticalDirection *
                (circleRadius + Number(labelOptions.fontSize || 9))

        return (
            '<g class="schematic-directive schematic-directive--route">' +
            '<line x1="' +
            formatNumber(directive.x) +
            '" y1="' +
            formatNumber(projectedY) +
            '" x2="' +
            formatNumber(directive.x) +
            '" y2="' +
            formatNumber(leaderEndY) +
            '" stroke="' +
            escapeHtml(color) +
            '" stroke-width="1" />' +
            '<circle cx="' +
            formatNumber(directive.x) +
            '" cy="' +
            formatNumber(circleCenterY) +
            '" r="' +
            formatNumber(circleRadius) +
            '" fill="none" stroke="' +
            escapeHtml(color) +
            '" stroke-width="1" />' +
            createSvgText(
                'schematic-directive-label',
                directive.x,
                labelY,
                String(directive.name || ''),
                color,
                'middle',
                labelOptions
            ) +
            createSvgText(
                'schematic-directive-info',
                directive.x,
                circleCenterY + Number(infoOptions.fontSize || 8) * 0.34,
                'i',
                color,
                'middle',
                infoOptions
            ) +
            '</g>'
        )
    }

    /**
     * Builds the paired-trace differential-pair marker glyph.
     * @param {{ x: number, y: number, color: string }} directive
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildDiffPairMarkup(directive, sheetHeight) {
        const color = SchematicColorResolver.resolveColor(
            directive.color,
            '--schematic-alert-color'
        )
        const centerY = projectSchematicY(sheetHeight, directive.y)
        const topPoints = [
            [directive.x - 10, centerY - 2],
            [directive.x - 4, centerY - 2],
            [directive.x, centerY - 6],
            [directive.x + 4, centerY - 6],
            [directive.x + 8, centerY - 2],
            [directive.x + 14, centerY - 2]
        ]
        const bottomPoints = topPoints.map(([x, y]) => [x, y + 8])

        return (
            '<g class="schematic-directive schematic-directive--pair">' +
            SchematicDirectiveRenderer.#buildPolyline(topPoints, color) +
            SchematicDirectiveRenderer.#buildPolyline(bottomPoints, color) +
            '</g>'
        )
    }

    /**
     * Builds one open SVG polyline for a directive glyph.
     * @param {number[][]} points
     * @param {string} color
     * @returns {string}
     */
    static #buildPolyline(points, color) {
        return (
            '<polyline points="' +
            escapeHtml(
                points
                    .map(([x, y]) => formatNumber(x) + ',' + formatNumber(y))
                    .join(' ')
            ) +
            '" fill="none" stroke="' +
            escapeHtml(color) +
            '" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" />'
        )
    }
}
