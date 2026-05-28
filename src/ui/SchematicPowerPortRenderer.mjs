// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'

const { createSvgText, escapeHtml, formatNumber, projectSchematicY } =
    SchematicSvgUtils

/**
 * Builds schematic power-port symbols from normalized text records.
 */
export class SchematicPowerPortRenderer {
    /**
     * Renders one power-port symbol and label.
     * @param {{ x: number, y: number, text: string, color: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, anchor?: 'start' | 'middle' | 'end', powerPortDirection?: 'up' | 'down' | 'left' | 'right' }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildMarkup(text, lines, pins, sheetHeight) {
        const x = text.x
        const y = projectSchematicY(sheetHeight, text.y)
        const direction = SchematicPowerPortRenderer.resolveOutwardDirection(
            text,
            lines,
            pins
        )
        const labelOptions = SchematicTypography.withViewerFontSize({
            fontSize: Number(text.fontSize || 10),
            fontFamily: text.fontFamily,
            fontWeight: text.fontWeight
        })
        const fontSize = Number(labelOptions.fontSize || 9)
        const resolvedColor = SchematicColorResolver.resolveColor(
            text.color,
            '--schematic-power-color'
        )

        if (Number(text.style) === 4) {
            return (
                '<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round">' +
                SchematicPowerPortRenderer.#buildGroundLines(
                    x,
                    y,
                    direction,
                    resolvedColor
                ) +
                SchematicPowerPortRenderer.#buildDirectionalLabel(
                    text,
                    direction,
                    x,
                    y,
                    fontSize,
                    labelOptions,
                    resolvedColor,
                    lines,
                    sheetHeight
                ) +
                '</g>'
            )
        }

        return (
            '<g class="schematic-power-port schematic-power-port--rail" stroke-linecap="round">' +
            SchematicPowerPortRenderer.#buildRailLine(
                x,
                y,
                direction,
                resolvedColor
            ) +
            SchematicPowerPortRenderer.#buildDirectionalLabel(
                text,
                direction,
                x,
                y,
                fontSize,
                labelOptions,
                resolvedColor,
                lines,
                sheetHeight
            ) +
            '</g>'
        )
    }

    /**
     * Picks the symbol direction away from the attached wire or pin stub.
     * @param {{ x: number, y: number, style?: number, powerPortDirection?: 'up' | 'down' | 'left' | 'right' }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {'up' | 'down' | 'left' | 'right'}
     */
    static resolveOutwardDirection(text, lines, pins) {
        if (text.powerPortDirection) {
            return text.powerPortDirection
        }

        const candidates = []

        for (const line of lines) {
            const lineDirection =
                SchematicPowerPortRenderer.#resolveLineDirection(text, line)

            if (lineDirection) {
                candidates.push(lineDirection)
            }
        }

        for (const pin of pins) {
            const pinDirection =
                SchematicPowerPortRenderer.#resolvePinDirection(text, pin)

            if (pinDirection) {
                candidates.push(pinDirection)
            }
        }

        if (!candidates.length) {
            return Number(text.style) === 4 ? 'down' : 'up'
        }

        const counts = new Map()

        for (const candidate of candidates) {
            counts.set(candidate, (counts.get(candidate) || 0) + 1)
        }

        return [...counts.entries()].sort((left, right) => {
            const countDelta = right[1] - left[1]

            if (countDelta !== 0) {
                return countDelta
            }

            return (
                SchematicPowerPortRenderer.#resolveDirectionPriority(
                    text,
                    right[0]
                ) -
                SchematicPowerPortRenderer.#resolveDirectionPriority(
                    text,
                    left[0]
                )
            )
        })[0][0]
    }

    /**
     * Breaks directional ties for symbols whose connectivity touches more than
     * one branch at the same attachment point.
     * @param {{ style?: number }} text
     * @param {'up' | 'down' | 'left' | 'right'} direction
     * @returns {number}
     */
    static #resolveDirectionPriority(text, direction) {
        if (Number(text.style) !== 4) {
            return 0
        }

        switch (direction) {
            case 'down':
                return 2
            case 'up':
                return 1
            default:
                return 0
        }
    }

    /**
     * Resolves one attached line segment into the direction the symbol should
     * point away from.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @returns {'up' | 'down' | 'left' | 'right' | null}
     */
    static #resolveLineDirection(text, line) {
        if (
            Math.abs(line.x1 - text.x) <= 2 &&
            Math.abs(line.y1 - text.y) <= 2
        ) {
            return SchematicPowerPortRenderer.#invertDirection(
                SchematicPowerPortRenderer.#directionFromPointDelta(
                    line.x2 - text.x,
                    line.y2 - text.y
                )
            )
        }

        if (
            Math.abs(line.x2 - text.x) <= 2 &&
            Math.abs(line.y2 - text.y) <= 2
        ) {
            return SchematicPowerPortRenderer.#invertDirection(
                SchematicPowerPortRenderer.#directionFromPointDelta(
                    line.x1 - text.x,
                    line.y1 - text.y
                )
            )
        }

        return null
    }

    /**
     * Resolves one attached pin stub into the direction the symbol should
     * point away from.
     * @param {{ x: number, y: number }} text
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {'up' | 'down' | 'left' | 'right' | null}
     */
    static #resolvePinDirection(text, pin) {
        const endpoint =
            SchematicPowerPortRenderer.#projectPinOuterEndpoint(pin)

        if (
            !endpoint ||
            Math.abs(endpoint.x - text.x) > 2 ||
            Math.abs(endpoint.y - text.y) > 2
        ) {
            return null
        }

        return SchematicPowerPortRenderer.#invertDirection(
            SchematicPowerPortRenderer.#directionFromPointDelta(
                pin.x - text.x,
                pin.y - text.y
            )
        )
    }

    /**
     * Maps one delta into the dominant cardinal direction.
     * @param {number} dx
     * @param {number} dy
     * @returns {'up' | 'down' | 'left' | 'right'}
     */
    static #directionFromPointDelta(dx, dy) {
        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx < 0 ? 'left' : 'right'
        }

        return dy < 0 ? 'down' : 'up'
    }

    /**
     * Flips one cardinal direction.
     * @param {'up' | 'down' | 'left' | 'right'} direction
     * @returns {'up' | 'down' | 'left' | 'right'}
     */
    static #invertDirection(direction) {
        switch (direction) {
            case 'up':
                return 'down'
            case 'down':
                return 'up'
            case 'left':
                return 'right'
            default:
                return 'left'
        }
    }

    /**
     * Projects one pin into its outer connection endpoint.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ x: number, y: number } | null}
     */
    static #projectPinOuterEndpoint(pin) {
        switch (pin.orientation) {
            case 'left':
                return { x: pin.x - pin.length, y: pin.y }
            case 'right':
                return { x: pin.x + pin.length, y: pin.y }
            case 'top':
                return { x: pin.x, y: pin.y + pin.length }
            case 'bottom':
                return { x: pin.x, y: pin.y - pin.length }
            default:
                return null
        }
    }

    /**
     * Builds the ground symbol linework for one direction.
     * @param {number} x
     * @param {number} y
     * @param {'up' | 'down' | 'left' | 'right'} direction
     * @param {string} color
     * @returns {string}
     */
    static #buildGroundLines(x, y, direction, color) {
        const stroke = escapeHtml(color)

        if (direction === 'up') {
            return (
                '<line x1="' +
                formatNumber(x) +
                '" y1="' +
                formatNumber(y) +
                '" x2="' +
                formatNumber(x) +
                '" y2="' +
                formatNumber(y - 7) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x - 7) +
                '" y1="' +
                formatNumber(y - 7) +
                '" x2="' +
                formatNumber(x + 7) +
                '" y2="' +
                formatNumber(y - 7) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x - 5) +
                '" y1="' +
                formatNumber(y - 10) +
                '" x2="' +
                formatNumber(x + 5) +
                '" y2="' +
                formatNumber(y - 10) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x - 3) +
                '" y1="' +
                formatNumber(y - 13) +
                '" x2="' +
                formatNumber(x + 3) +
                '" y2="' +
                formatNumber(y - 13) +
                '" stroke="' +
                stroke +
                '" />'
            )
        }

        if (direction === 'right') {
            return (
                '<line x1="' +
                formatNumber(x) +
                '" y1="' +
                formatNumber(y) +
                '" x2="' +
                formatNumber(x + 7) +
                '" y2="' +
                formatNumber(y) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x + 7) +
                '" y1="' +
                formatNumber(y - 7) +
                '" x2="' +
                formatNumber(x + 7) +
                '" y2="' +
                formatNumber(y + 7) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x + 10) +
                '" y1="' +
                formatNumber(y - 5) +
                '" x2="' +
                formatNumber(x + 10) +
                '" y2="' +
                formatNumber(y + 5) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x + 13) +
                '" y1="' +
                formatNumber(y - 3) +
                '" x2="' +
                formatNumber(x + 13) +
                '" y2="' +
                formatNumber(y + 3) +
                '" stroke="' +
                stroke +
                '" />'
            )
        }

        if (direction === 'left') {
            return (
                '<line x1="' +
                formatNumber(x) +
                '" y1="' +
                formatNumber(y) +
                '" x2="' +
                formatNumber(x - 7) +
                '" y2="' +
                formatNumber(y) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x - 7) +
                '" y1="' +
                formatNumber(y - 7) +
                '" x2="' +
                formatNumber(x - 7) +
                '" y2="' +
                formatNumber(y + 7) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x - 10) +
                '" y1="' +
                formatNumber(y - 5) +
                '" x2="' +
                formatNumber(x - 10) +
                '" y2="' +
                formatNumber(y + 5) +
                '" stroke="' +
                stroke +
                '" /><line x1="' +
                formatNumber(x - 13) +
                '" y1="' +
                formatNumber(y - 3) +
                '" x2="' +
                formatNumber(x - 13) +
                '" y2="' +
                formatNumber(y + 3) +
                '" stroke="' +
                stroke +
                '" />'
            )
        }

        return (
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(y) +
            '" x2="' +
            formatNumber(x) +
            '" y2="' +
            formatNumber(y + 7) +
            '" stroke="' +
            stroke +
            '" /><line x1="' +
            formatNumber(x - 7) +
            '" y1="' +
            formatNumber(y + 7) +
            '" x2="' +
            formatNumber(x + 7) +
            '" y2="' +
            formatNumber(y + 7) +
            '" stroke="' +
            stroke +
            '" /><line x1="' +
            formatNumber(x - 5) +
            '" y1="' +
            formatNumber(y + 10) +
            '" x2="' +
            formatNumber(x + 5) +
            '" y2="' +
            formatNumber(y + 10) +
            '" stroke="' +
            stroke +
            '" /><line x1="' +
            formatNumber(x - 3) +
            '" y1="' +
            formatNumber(y + 13) +
            '" x2="' +
            formatNumber(x + 3) +
            '" y2="' +
            formatNumber(y + 13) +
            '" stroke="' +
            stroke +
            '" />'
        )
    }

    /**
     * Builds the rail power-port linework for one direction.
     * @param {number} x
     * @param {number} y
     * @param {'up' | 'down' | 'left' | 'right'} direction
     * @param {string} color
     * @returns {string}
     */
    static #buildRailLine(x, y, direction, color) {
        const stroke = escapeHtml(color)
        const x2 =
            direction === 'left' ? x - 12 : direction === 'right' ? x + 12 : x
        const y2 =
            direction === 'up' ? y - 12 : direction === 'down' ? y + 12 : y

        return (
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(y) +
            '" x2="' +
            formatNumber(x2) +
            '" y2="' +
            formatNumber(y2) +
            '" stroke="' +
            stroke +
            '" />'
        )
    }

    /**
     * Places the power-port label beyond the symbol linework.
     * @param {{ text: string }} text
     * @param {'up' | 'down' | 'left' | 'right'} direction
     * @param {number} x
     * @param {number} y
     * @param {number} fontSize
     * @param {{ fontSize?: number, fontFamily?: string, fontWeight?: number }} labelOptions
     * @param {string} color
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildDirectionalLabel(
        text,
        direction,
        x,
        y,
        fontSize,
        labelOptions,
        color,
        lines = [],
        sheetHeight = 0
    ) {
        const placement = SchematicPowerPortRenderer.#resolveLabelPlacement(
            text,
            direction,
            x,
            y,
            fontSize,
            lines,
            sheetHeight
        )

        return createSvgText(
            'schematic-power-port-label',
            placement.x,
            placement.y,
            text.text,
            color,
            placement.anchor,
            labelOptions
        )
    }

    /**
     * Resolves label placement and avoids nearby horizontal net-line overlap
     * for upward rail labels in dense schematic areas.
     * @param {{ text: string, style?: number }} text
     * @param {'up' | 'down' | 'left' | 'right'} direction
     * @param {number} x
     * @param {number} y
     * @param {number} fontSize
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {number} sheetHeight
     * @returns {{ x: number, y: number, anchor: 'start' | 'middle' | 'end' }}
     */
    static #resolveLabelPlacement(
        text,
        direction,
        x,
        y,
        fontSize,
        lines,
        sheetHeight
    ) {
        if (direction === 'up') {
            return {
                x,
                y: SchematicPowerPortRenderer.#resolveUpwardRailLabelY(
                    text,
                    x,
                    y,
                    y - 16,
                    fontSize,
                    lines,
                    sheetHeight
                ),
                anchor: 'middle'
            }
        }

        if (direction === 'right') {
            return { x: x + 18, y: y + fontSize * 0.36, anchor: 'start' }
        }

        if (direction === 'left') {
            return { x: x - 18, y: y + fontSize * 0.36, anchor: 'end' }
        }

        return { x, y: y + 25, anchor: 'middle' }
    }

    /**
     * Shifts an upward rail label below close parallel net lines when the
     * default placement would draw text through an existing wire.
     * @param {{ text: string, style?: number }} text
     * @param {number} x
     * @param {number} connectionY
     * @param {number} defaultY
     * @param {number} fontSize
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {number} sheetHeight
     * @returns {number}
     */
    static #resolveUpwardRailLabelY(
        text,
        x,
        connectionY,
        defaultY,
        fontSize,
        lines,
        sheetHeight
    ) {
        if (Number(text.style || 0) === 4) {
            return defaultY
        }

        let labelY = defaultY

        for (const line of lines) {
            const horizontalLine =
                SchematicPowerPortRenderer.#projectHorizontalLine(
                    line,
                    sheetHeight
                )

            if (!horizontalLine) {
                continue
            }

            if (
                !SchematicPowerPortRenderer.#horizontalLineIntersectsLabel(
                    horizontalLine,
                    text.text,
                    x,
                    labelY,
                    fontSize
                )
            ) {
                continue
            }

            labelY = Math.min(
                connectionY - 4,
                Math.max(labelY, horizontalLine.y + fontSize + 4)
            )
        }

        return labelY
    }

    /**
     * Projects one source horizontal line into SVG coordinates.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {number} sheetHeight
     * @returns {{ y: number, minX: number, maxX: number } | null}
     */
    static #projectHorizontalLine(line, sheetHeight) {
        const y1 = projectSchematicY(sheetHeight, line.y1)
        const y2 = projectSchematicY(sheetHeight, line.y2)

        if (Math.abs(y1 - y2) > 0.01) {
            return null
        }

        return {
            y: y1,
            minX: Math.min(line.x1, line.x2),
            maxX: Math.max(line.x1, line.x2)
        }
    }

    /**
     * Checks whether a projected horizontal line crosses an estimated text box.
     * @param {{ y: number, minX: number, maxX: number }} line
     * @param {string} label
     * @param {number} x
     * @param {number} labelY
     * @param {number} fontSize
     * @returns {boolean}
     */
    static #horizontalLineIntersectsLabel(line, label, x, labelY, fontSize) {
        const textWidth = SchematicPowerPortRenderer.#estimateLabelWidth(
            label,
            fontSize
        )
        const textMinX = x - textWidth / 2
        const textMaxX = x + textWidth / 2
        const textTopY = labelY - fontSize
        const textBottomY = labelY + fontSize * 0.25

        return (
            line.maxX >= textMinX &&
            line.minX <= textMaxX &&
            line.y >= textTopY &&
            line.y <= textBottomY
        )
    }

    /**
     * Estimates one power-port label width for clearance checks.
     * @param {string} label
     * @param {number} fontSize
     * @returns {number}
     */
    static #estimateLabelWidth(label, fontSize) {
        return String(label || '').length * fontSize * 0.56
    }
}
