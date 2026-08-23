// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'

const { createSvgText, escapeHtml, formatNumber, projectSchematicY } =
    SchematicSvgUtils

/**
 * Renders normalized signal harness trunks, connectors, entries, and labels.
 */
export class SchematicHarnessRenderer {
    /**
     * Builds complete harness markup.
     * @param {{ connectors?: object[], signalHarnesses?: object[] } | null | undefined} harnesses
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static buildMarkup(harnesses, sheetHeight, sheet) {
        const signalHarnessMarkup = (harnesses?.signalHarnesses || [])
            .map((signalHarness) =>
                SchematicHarnessRenderer.#buildSignalHarnessMarkup(
                    signalHarness,
                    sheetHeight
                )
            )
            .join('')
        const connectorMarkup = (harnesses?.connectors || [])
            .map((connector) =>
                SchematicHarnessRenderer.#buildConnectorMarkup(
                    connector,
                    sheetHeight,
                    sheet
                )
            )
            .join('')

        return signalHarnessMarkup + connectorMarkup
    }

    /**
     * Builds one signal-harness polyline.
     * @param {{ points?: { x: number, y: number }[], color?: string, lineWidth?: number }} signalHarness
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildSignalHarnessMarkup(signalHarness, sheetHeight) {
        const projectedPoints = (signalHarness.points || [])
            .map((point) => ({
                x: Number(point?.x),
                y: projectSchematicY(sheetHeight, Number(point?.y))
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
        const points = projectedPoints
            .map((point) => formatNumber(point.x) + ',' + formatNumber(point.y))
            .join(' ')

        if (projectedPoints.length < 2) return ''

        const railWidth = Math.max(
            (Number(signalHarness.lineWidth) || 1) * 4,
            8
        )

        return (
            '<g class="schematic-signal-harness">' +
            '<polyline class="schematic-signal-harness__outline" points="' +
            escapeHtml(points) +
            '" fill="none" stroke="var(--schematic-accent-ink-color)" stroke-opacity="0.28" stroke-width="' +
            formatNumber(railWidth + 2) +
            '" stroke-linecap="round" stroke-linejoin="round" />' +
            '<polyline class="schematic-signal-harness__rail" points="' +
            escapeHtml(points) +
            '" fill="none" stroke="var(--schematic-pin-marker-fill)" stroke-width="' +
            formatNumber(railWidth) +
            '" stroke-linecap="round" stroke-linejoin="round" />' +
            SchematicHarnessRenderer.#buildSignalHarnessMarks(
                projectedPoints,
                railWidth
            ) +
            '</g>'
        )
    }

    /**
     * Builds repeated diagonal marks along every projected harness segment.
     * @param {{ x: number, y: number }[]} points Projected harness points.
     * @param {number} railWidth Rendered harness width.
     * @returns {string}
     */
    static #buildSignalHarnessMarks(points, railWidth) {
        const marks = []
        const spacing = Math.max(railWidth * 1.45, 10)

        for (let index = 1; index < points.length; index += 1) {
            const start = points[index - 1]
            const end = points[index]
            const deltaX = end.x - start.x
            const deltaY = end.y - start.y
            const length = Math.hypot(deltaX, deltaY)

            if (!Number.isFinite(length) || length <= 0.001) continue

            const tangentX = deltaX / length
            const tangentY = deltaY / length
            const normalX = -tangentY
            const normalY = tangentX
            const halfAlong = railWidth * 0.32
            const halfNormal = railWidth * 0.42
            const markCount = Math.min(
                Math.max(Math.floor(length / spacing), 1),
                4096
            )

            for (let markIndex = 0; markIndex < markCount; markIndex += 1) {
                const distance = ((markIndex + 0.5) * length) / markCount
                const centerX = start.x + tangentX * distance
                const centerY = start.y + tangentY * distance
                const x1 = centerX - tangentX * halfAlong - normalX * halfNormal
                const y1 = centerY - tangentY * halfAlong - normalY * halfNormal
                const x2 = centerX + tangentX * halfAlong + normalX * halfNormal
                const y2 = centerY + tangentY * halfAlong + normalY * halfNormal

                marks.push(
                    '<line class="schematic-signal-harness__mark" x1="' +
                        formatNumber(x1) +
                        '" y1="' +
                        formatNumber(y1) +
                        '" x2="' +
                        formatNumber(x2) +
                        '" y2="' +
                        formatNumber(y2) +
                        '" stroke="var(--schematic-accent-ink-color)" stroke-opacity="0.32" stroke-width="1.4" stroke-linecap="round" />'
                )
            }
        }

        return marks.join('')
    }

    /**
     * Builds one harness connector with its entry labels and type label.
     * @param {{ x: number, y: number, width: number, height: number, side?: 'left' | 'right' | 'top' | 'bottom', primaryConnectionPosition?: number, lineWidth?: number, color?: string, fill?: string, entries?: object[], typeLabel?: object }} connector
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static #buildConnectorMarkup(connector, sheetHeight, sheet) {
        const textOptions =
            SchematicTypography.buildDefaultSchematicFontOptions(sheet)
        const geometry = SchematicHarnessRenderer.#connectorGeometry(
            connector,
            sheetHeight
        )
        const entryMarkup = (connector.entries || [])
            .map((entry) =>
                SchematicHarnessRenderer.#buildEntryMarkup(
                    connector,
                    entry,
                    sheetHeight,
                    textOptions
                )
            )
            .join('')
        const typeMarkup = connector.typeLabel
            ? SchematicHarnessRenderer.#buildTypeLabelMarkup(
                  connector.typeLabel,
                  sheetHeight,
                  textOptions
              )
            : ''

        return (
            '<g class="schematic-harness-connector">' +
            '<path class="schematic-harness-connector__body" d="' +
            escapeHtml(geometry.bodyPath) +
            '" fill="var(--schematic-pin-marker-fill)" stroke="none" />' +
            '<path class="schematic-harness-connector__bracket" d="' +
            escapeHtml(geometry.bracketPath) +
            '" fill="none" stroke="var(--schematic-accent-ink-color)" stroke-opacity="0.46" stroke-width="' +
            formatNumber(Math.max(Number(connector.lineWidth) || 1, 1)) +
            '" stroke-linecap="round" />' +
            entryMarkup +
            typeMarkup +
            '</g>'
        )
    }

    /**
     * Builds the filled connector region and open primary-side bracket.
     * @param {{ x: number, y: number, width: number, height: number, side?: 'left' | 'right' | 'top' | 'bottom', primaryConnectionPosition?: number }} connector
     * @param {number} sheetHeight
     * @returns {{ bodyPath: string, bracketPath: string }}
     */
    static #connectorGeometry(connector, sheetHeight) {
        const x = Number(connector.x) || 0
        const width = Math.max(Number(connector.width) || 0, 1)
        const height = Math.max(Number(connector.height) || 0, 1)
        const inset = Math.min(12, width / 3, height / 3)
        const top = projectSchematicY(sheetHeight, Number(connector.y) || 0)
        const bottom = top + height
        const left = x
        const right = x + width
        const side = connector.side || 'left'
        const primaryExtent =
            side === 'top' || side === 'bottom' ? width : height
        const primary = Math.min(
            Math.max(Number(connector.primaryConnectionPosition) || 0, 0),
            primaryExtent
        )
        const primaryX = left + primary
        const primaryY = top + primary
        const xCurve = inset * 0.7
        const yUpperCurve = Math.max((primaryY - top) * 0.45, 1)
        const yLowerCurve = Math.max((bottom - primaryY) * 0.45, 1)
        const xLeftCurve = Math.max((primaryX - left) * 0.45, 1)
        const xRightCurve = Math.max((right - primaryX) * 0.45, 1)

        if (side === 'right') {
            const inner = right - inset
            const forward =
                'M ' +
                formatNumber(inner) +
                ' ' +
                formatNumber(top) +
                ' C ' +
                formatNumber(inner + xCurve) +
                ' ' +
                formatNumber(top) +
                ' ' +
                formatNumber(right) +
                ' ' +
                formatNumber(primaryY - yUpperCurve) +
                ' ' +
                formatNumber(right) +
                ' ' +
                formatNumber(primaryY) +
                ' C ' +
                formatNumber(right) +
                ' ' +
                formatNumber(primaryY + yLowerCurve) +
                ' ' +
                formatNumber(inner + xCurve) +
                ' ' +
                formatNumber(bottom) +
                ' ' +
                formatNumber(inner) +
                ' ' +
                formatNumber(bottom)
            return {
                bracketPath: forward,
                bodyPath:
                    forward +
                    ' H ' +
                    formatNumber(left) +
                    ' V ' +
                    formatNumber(top) +
                    ' Z'
            }
        }

        if (side === 'top') {
            const inner = top + inset
            const forward =
                'M ' +
                formatNumber(left) +
                ' ' +
                formatNumber(inner) +
                ' C ' +
                formatNumber(left) +
                ' ' +
                formatNumber(inner - xCurve) +
                ' ' +
                formatNumber(primaryX - xLeftCurve) +
                ' ' +
                formatNumber(top) +
                ' ' +
                formatNumber(primaryX) +
                ' ' +
                formatNumber(top) +
                ' C ' +
                formatNumber(primaryX + xRightCurve) +
                ' ' +
                formatNumber(top) +
                ' ' +
                formatNumber(right) +
                ' ' +
                formatNumber(inner - xCurve) +
                ' ' +
                formatNumber(right) +
                ' ' +
                formatNumber(inner)
            return {
                bracketPath: forward,
                bodyPath:
                    forward +
                    ' V ' +
                    formatNumber(bottom) +
                    ' H ' +
                    formatNumber(left) +
                    ' Z'
            }
        }

        if (side === 'bottom') {
            const inner = bottom - inset
            const forward =
                'M ' +
                formatNumber(left) +
                ' ' +
                formatNumber(inner) +
                ' C ' +
                formatNumber(left) +
                ' ' +
                formatNumber(inner + xCurve) +
                ' ' +
                formatNumber(primaryX - xLeftCurve) +
                ' ' +
                formatNumber(bottom) +
                ' ' +
                formatNumber(primaryX) +
                ' ' +
                formatNumber(bottom) +
                ' C ' +
                formatNumber(primaryX + xRightCurve) +
                ' ' +
                formatNumber(bottom) +
                ' ' +
                formatNumber(right) +
                ' ' +
                formatNumber(inner + xCurve) +
                ' ' +
                formatNumber(right) +
                ' ' +
                formatNumber(inner)
            return {
                bracketPath: forward,
                bodyPath:
                    forward +
                    ' V ' +
                    formatNumber(top) +
                    ' H ' +
                    formatNumber(left) +
                    ' Z'
            }
        }

        const inner = left + inset
        const forward =
            'M ' +
            formatNumber(inner) +
            ' ' +
            formatNumber(top) +
            ' C ' +
            formatNumber(inner - xCurve) +
            ' ' +
            formatNumber(top) +
            ' ' +
            formatNumber(left) +
            ' ' +
            formatNumber(primaryY - yUpperCurve) +
            ' ' +
            formatNumber(left) +
            ' ' +
            formatNumber(primaryY) +
            ' C ' +
            formatNumber(left) +
            ' ' +
            formatNumber(primaryY + yLowerCurve) +
            ' ' +
            formatNumber(inner - xCurve) +
            ' ' +
            formatNumber(bottom) +
            ' ' +
            formatNumber(inner) +
            ' ' +
            formatNumber(bottom)
        return {
            bracketPath: forward,
            bodyPath:
                forward +
                ' H ' +
                formatNumber(right) +
                ' V ' +
                formatNumber(top) +
                ' Z'
        }
    }

    /**
     * Builds one harness-entry stub and label.
     * @param {{ x: number, y: number, width: number, height: number }} connector
     * @param {{ name?: string, side?: 'left' | 'right' | 'top' | 'bottom', distanceFromTop?: number, textColor?: string }} entry
     * @param {number} sheetHeight
     * @param {{ fontSize: number, fontFamily: string, fontWeight: number }} textOptions
     * @returns {string}
     */
    static #buildEntryMarkup(connector, entry, sheetHeight, textOptions) {
        const placement = SchematicHarnessRenderer.#entryPlacement(
            connector,
            entry,
            sheetHeight
        )

        return (
            '<g class="schematic-harness-entry"><circle class="schematic-harness-entry-dot" cx="' +
            formatNumber(placement.dotX) +
            '" cy="' +
            formatNumber(placement.dotY) +
            '" r="1.5" fill="var(--schematic-default-ink-color)" />' +
            createSvgText(
                'schematic-harness-entry-label',
                placement.labelX,
                placement.labelY,
                entry.name || '',
                'var(--schematic-default-ink-color)',
                placement.anchor,
                textOptions
            ) +
            '</g>'
        )
    }

    /**
     * Resolves the entry stub and text placement for every connector side.
     * @param {{ x: number, y: number, width: number, height: number }} connector
     * @param {{ side?: 'left' | 'right' | 'top' | 'bottom', distanceFromTop?: number }} entry
     * @param {number} sheetHeight
     * @returns {{ dotX: number, dotY: number, labelX: number, labelY: number, anchor: 'start' | 'middle' | 'end' }}
     */
    static #entryPlacement(connector, entry, sheetHeight) {
        const x = Number(connector.x) || 0
        const y = Number(connector.y) || 0
        const width = Number(connector.width) || 0
        const height = Number(connector.height) || 0
        const distance = Number(entry.distanceFromTop) || 0
        const side = entry.side || 'right'
        const baselineLift = 3

        if (side === 'left') {
            const entryY = projectSchematicY(sheetHeight, y - distance)
            return {
                dotX: x,
                dotY: entryY,
                labelX: x + 8,
                labelY: entryY + baselineLift,
                anchor: 'start'
            }
        }
        if (side === 'top') {
            const entryX = x + distance
            const entryY = projectSchematicY(sheetHeight, y)
            return {
                dotX: entryX,
                dotY: entryY,
                labelX: entryX,
                labelY: entryY + 12,
                anchor: 'middle'
            }
        }
        if (side === 'bottom') {
            const entryX = x + distance
            const entryY = projectSchematicY(sheetHeight, y - height)
            return {
                dotX: entryX,
                dotY: entryY,
                labelX: entryX,
                labelY: entryY - 5,
                anchor: 'middle'
            }
        }

        const entryY = projectSchematicY(sheetHeight, y - distance)
        return {
            dotX: x + width,
            dotY: entryY,
            labelX: x + width - 8,
            labelY: entryY + baselineLift,
            anchor: 'end'
        }
    }

    /**
     * Builds the connector harness-type label.
     * @param {{ text?: string, x: number, y: number, color?: string }} typeLabel
     * @param {number} sheetHeight
     * @param {{ fontSize: number, fontFamily: string, fontWeight: number }} textOptions
     * @returns {string}
     */
    static #buildTypeLabelMarkup(typeLabel, sheetHeight, textOptions) {
        return createSvgText(
            'schematic-harness-type',
            typeLabel.x,
            projectSchematicY(sheetHeight, typeLabel.y),
            typeLabel.text || '',
            'var(--schematic-default-ink-color)',
            'start',
            textOptions
        )
    }
}
