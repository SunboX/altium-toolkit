// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

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
     * @param {{ x: number, y: number, color: string, name: string, orientation?: number, style?: number }[]} directives
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
     * @param {{ x: number, y: number, color: string, name: string, orientation?: number, style?: number }} directive
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
                    sheet,
                    'route'
                )
            default:
                return directive?.name
                    ? SchematicDirectiveRenderer.#buildRouteMarkup(
                          directive,
                          sheetHeight,
                          sheet,
                          'parameter-set'
                      )
                    : ''
        }
    }

    /**
     * Builds the labeled info-callout marker for one parameter-set directive.
     * @param {{ x: number, y: number, color: string, name: string, orientation?: number, style?: number }} directive
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @param {string} classModifier
     * @returns {string}
     */
    static #buildRouteMarkup(directive, sheetHeight, sheet, classModifier) {
        if (
            classModifier === 'parameter-set' &&
            Number(directive?.style) === 1
        ) {
            return SchematicDirectiveRenderer.#buildCompactParameterSetMarkup(
                directive,
                sheetHeight,
                classModifier
            )
        }

        const color = SchematicColorResolver.resolveColor(
            directive.color,
            '--schematic-alert-color'
        )
        const projectedY = projectSchematicY(sheetHeight, directive.y)
        const direction = SchematicDirectiveRenderer.#resolveCalloutDirection(
            directive.orientation
        )
        const circleRadius = 7
        const calloutDistance =
            SchematicDirectiveRenderer.#resolveCalloutDistance(direction)
        const circleCenterX = directive.x + direction.x * calloutDistance
        const circleCenterY = projectedY + direction.y * calloutDistance
        const leaderEndX = circleCenterX - direction.x * circleRadius
        const leaderEndY = circleCenterY - direction.y * circleRadius
        const labelOptions =
            SchematicTypography.buildViewerSchematicFontOptions(sheet)
        const infoOptions = {
            ...labelOptions,
            fontSize: Math.max(Number(labelOptions.fontSize || 9) - 1, 6),
            fontWeight: 700
        }
        const labelPlacement =
            SchematicDirectiveRenderer.#resolveLabelPlacement(
                circleCenterX,
                circleCenterY,
                direction,
                circleRadius,
                Number(labelOptions.fontSize || 9)
            )

        return (
            '<g class="schematic-directive schematic-directive--' +
            escapeHtml(classModifier) +
            '">' +
            '<line x1="' +
            formatNumber(directive.x) +
            '" y1="' +
            formatNumber(projectedY) +
            '" x2="' +
            formatNumber(leaderEndX) +
            '" y2="' +
            formatNumber(leaderEndY) +
            '" stroke="' +
            escapeHtml(color) +
            '" stroke-width="1" />' +
            '<circle cx="' +
            formatNumber(circleCenterX) +
            '" cy="' +
            formatNumber(circleCenterY) +
            '" r="' +
            formatNumber(circleRadius) +
            '" fill="none" stroke="' +
            escapeHtml(color) +
            '" stroke-width="1" />' +
            createSvgText(
                'schematic-directive-label',
                labelPlacement.x,
                labelPlacement.y,
                String(directive.name || ''),
                color,
                labelPlacement.anchor,
                labelOptions
            ) +
            createSvgText(
                'schematic-directive-info',
                circleCenterX,
                circleCenterY +
                    SchematicDirectiveRenderer.#baselineOffset(
                        Number(infoOptions.fontSize || 8)
                    ),
                'i',
                color,
                'middle',
                infoOptions
            ) +
            '</g>'
        )
    }

    /**
     * Builds the compact style-1 parameter-set marker used for connection
     * adornments whose class name is carried as metadata rather than text.
     * @param {{ x: number, y: number, color: string, orientation?: number }} directive
     * @param {number} sheetHeight
     * @param {string} classModifier
     * @returns {string}
     */
    static #buildCompactParameterSetMarkup(
        directive,
        sheetHeight,
        classModifier
    ) {
        const color = SchematicColorResolver.resolveColor(
            directive.color,
            '--schematic-alert-color'
        )
        const projectedY = projectSchematicY(sheetHeight, directive.y)
        const direction = SchematicDirectiveRenderer.#resolveCalloutDirection(
            directive.orientation
        )
        const circleRadius = 3
        const circleCenterX = directive.x + direction.x * 6
        const circleCenterY = projectedY + direction.y * 6
        const leaderEndX = circleCenterX - direction.x * circleRadius
        const leaderEndY = circleCenterY - direction.y * circleRadius

        return (
            '<g class="schematic-directive schematic-directive--' +
            escapeHtml(classModifier) +
            '">' +
            '<line x1="' +
            formatNumber(directive.x) +
            '" y1="' +
            formatNumber(projectedY) +
            '" x2="' +
            formatNumber(leaderEndX) +
            '" y2="' +
            formatNumber(leaderEndY) +
            '" stroke="' +
            escapeHtml(color) +
            '" stroke-width="1" />' +
            '<circle cx="' +
            formatNumber(circleCenterX) +
            '" cy="' +
            formatNumber(circleCenterY) +
            '" r="' +
            formatNumber(circleRadius) +
            '" fill="none" stroke="' +
            escapeHtml(color) +
            '" stroke-width="1" />' +
            '</g>'
        )
    }

    /**
     * Resolves Altium's four-way callout orientation into an outward vector.
     * @param {number | undefined} orientation
     * @returns {{ x: number, y: number }}
     */
    static #resolveCalloutDirection(orientation) {
        switch (Number(orientation || 0)) {
            case 1:
                return { x: 0, y: -1 }
            case 2:
                return { x: -1, y: 0 }
            case 3:
                return { x: 0, y: 1 }
            default:
                return { x: 1, y: 0 }
        }
    }

    /**
     * Resolves the distance from a directive anchor to its info marker center.
     * @param {{ x: number, y: number }} direction
     * @returns {number}
     */
    static #resolveCalloutDistance(direction) {
        return direction.y < 0 ? 12 : 18
    }

    /**
     * Resolves label placement outside one directive info marker.
     * @param {number} circleCenterX
     * @param {number} circleCenterY
     * @param {{ x: number, y: number }} direction
     * @param {number} circleRadius
     * @param {number} fontSize
     * @returns {{ x: number, y: number, anchor: 'start' | 'middle' | 'end' }}
     */
    static #resolveLabelPlacement(
        circleCenterX,
        circleCenterY,
        direction,
        circleRadius,
        fontSize
    ) {
        const labelDistance = circleRadius + fontSize

        if (direction.x < 0) {
            return {
                x: circleCenterX - labelDistance,
                y:
                    circleCenterY +
                    SchematicDirectiveRenderer.#baselineOffset(fontSize),
                anchor: 'end'
            }
        }

        if (direction.x > 0) {
            return {
                x: circleCenterX + labelDistance,
                y:
                    circleCenterY +
                    SchematicDirectiveRenderer.#baselineOffset(fontSize),
                anchor: 'start'
            }
        }

        if (direction.y < 0) {
            return {
                x: circleCenterX,
                y: circleCenterY - circleRadius - 2,
                anchor: 'middle'
            }
        }

        return {
            x: circleCenterX,
            y: circleCenterY + direction.y * labelDistance,
            anchor: 'middle'
        }
    }

    /**
     * Returns a baseline offset that visually centers text around a marker.
     * @param {number} fontSize
     * @returns {number}
     */
    static #baselineOffset(fontSize) {
        return fontSize * 0.34
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
