// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

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
        const points = (signalHarness.points || [])
            .map(
                (point) =>
                    formatNumber(point.x) +
                    ',' +
                    formatNumber(projectSchematicY(sheetHeight, point.y))
            )
            .join(' ')

        if (!points) return ''

        return (
            '<polyline class="schematic-signal-harness" points="' +
            escapeHtml(points) +
            '" fill="none" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveNonTextColor(
                    signalHarness.color,
                    '--schematic-default-ink-color',
                    true
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(Number(signalHarness.lineWidth) || 1, 1)) +
            '" stroke-linecap="round" stroke-linejoin="round" />'
        )
    }

    /**
     * Builds one harness connector with its entry labels and type label.
     * @param {{ x: number, y: number, width: number, height: number, side?: 'left' | 'right' | 'top' | 'bottom', primaryConnectionPosition?: number, lineWidth?: number, color?: string, fill?: string, entries?: object[], typeLabel?: object }} connector
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static #buildConnectorMarkup(connector, sheetHeight, sheet) {
        const stroke = SchematicColorResolver.resolveNonTextColor(
            connector.color,
            '--schematic-default-ink-color',
            true
        )
        const fill = SchematicColorResolver.resolveFill(
            connector.fill,
            '--schematic-fill-light-color'
        )
        const textOptions =
            SchematicTypography.buildDefaultSchematicFontOptions(sheet)
        const entryMarkup = (connector.entries || [])
            .map((entry) =>
                SchematicHarnessRenderer.#buildEntryMarkup(
                    connector,
                    entry,
                    sheetHeight,
                    textOptions,
                    stroke
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
            '<polygon points="' +
            escapeHtml(
                SchematicHarnessRenderer.#connectorPoints(
                    connector,
                    sheetHeight
                )
            ) +
            '" fill="' +
            escapeHtml(fill) +
            '" stroke="' +
            escapeHtml(stroke) +
            '" stroke-width="' +
            formatNumber(Math.max(Number(connector.lineWidth) || 1, 1)) +
            '" stroke-linejoin="round" />' +
            entryMarkup +
            typeMarkup +
            '</g>'
        )
    }

    /**
     * Builds the concave connector outline from its primary connection side.
     * @param {{ x: number, y: number, width: number, height: number, side?: 'left' | 'right' | 'top' | 'bottom', primaryConnectionPosition?: number }} connector
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #connectorPoints(connector, sheetHeight) {
        const x = Number(connector.x) || 0
        const y = Number(connector.y) || 0
        const width = Math.max(Number(connector.width) || 0, 1)
        const height = Math.max(Number(connector.height) || 0, 1)
        const inset = Math.min(12, width / 3, height / 3)
        const primary = Math.min(
            Math.max(Number(connector.primaryConnectionPosition) || 0, 0),
            connector.side === 'top' || connector.side === 'bottom'
                ? width
                : height
        )
        const side = connector.side || 'left'
        let points

        if (side === 'right') {
            points = [
                { x, y },
                { x: x + width - inset, y },
                { x: x + width, y: y - primary },
                { x: x + width - inset, y: y - height },
                { x, y: y - height }
            ]
        } else if (side === 'top') {
            points = [
                { x, y: y - inset },
                { x: x + primary, y },
                { x: x + width, y: y - inset },
                { x: x + width, y: y - height },
                { x, y: y - height }
            ]
        } else if (side === 'bottom') {
            points = [
                { x, y },
                { x: x + width, y },
                { x: x + width, y: y - height + inset },
                { x: x + primary, y: y - height },
                { x, y: y - height + inset }
            ]
        } else {
            points = [
                { x: x + inset, y },
                { x: x + width, y },
                { x: x + width, y: y - height },
                { x: x + inset, y: y - height },
                { x, y: y - primary }
            ]
        }

        return points
            .map(
                (point) =>
                    formatNumber(point.x) +
                    ',' +
                    formatNumber(projectSchematicY(sheetHeight, point.y))
            )
            .join(' ')
    }

    /**
     * Builds one harness-entry stub and label.
     * @param {{ x: number, y: number, width: number, height: number }} connector
     * @param {{ name?: string, side?: 'left' | 'right' | 'top' | 'bottom', distanceFromTop?: number, textColor?: string }} entry
     * @param {number} sheetHeight
     * @param {{ fontSize: number, fontFamily: string, fontWeight: number }} textOptions
     * @param {string} connectorStroke
     * @returns {string}
     */
    static #buildEntryMarkup(
        connector,
        entry,
        sheetHeight,
        textOptions,
        connectorStroke
    ) {
        const placement = SchematicHarnessRenderer.#entryPlacement(
            connector,
            entry,
            sheetHeight
        )
        const labelColor = SchematicColorResolver.resolveColor(
            entry.textColor,
            '--schematic-default-ink-color',
            true
        )

        return (
            '<g class="schematic-harness-entry"><line x1="' +
            formatNumber(placement.x1) +
            '" y1="' +
            formatNumber(placement.y1) +
            '" x2="' +
            formatNumber(placement.x2) +
            '" y2="' +
            formatNumber(placement.y2) +
            '" stroke="' +
            escapeHtml(connectorStroke) +
            '" />' +
            createSvgText(
                'schematic-harness-entry-label',
                placement.labelX,
                placement.labelY,
                entry.name || '',
                labelColor,
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
     * @returns {{ x1: number, y1: number, x2: number, y2: number, labelX: number, labelY: number, anchor: 'start' | 'middle' | 'end' }}
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
                x1: x,
                y1: entryY,
                x2: x - 10,
                y2: entryY,
                labelX: x - 14,
                labelY: entryY + baselineLift,
                anchor: 'end'
            }
        }
        if (side === 'top') {
            const entryX = x + distance
            const entryY = projectSchematicY(sheetHeight, y)
            return {
                x1: entryX,
                y1: entryY,
                x2: entryX,
                y2: entryY - 10,
                labelX: entryX,
                labelY: entryY - 13,
                anchor: 'middle'
            }
        }
        if (side === 'bottom') {
            const entryX = x + distance
            const entryY = projectSchematicY(sheetHeight, y - height)
            return {
                x1: entryX,
                y1: entryY,
                x2: entryX,
                y2: entryY + 10,
                labelX: entryX,
                labelY: entryY + 19,
                anchor: 'middle'
            }
        }

        const entryY = projectSchematicY(sheetHeight, y - distance)
        return {
            x1: x + width,
            y1: entryY,
            x2: x + width + 10,
            y2: entryY,
            labelX: x + width + 14,
            labelY: entryY + baselineLift,
            anchor: 'start'
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
            SchematicColorResolver.resolveColor(
                typeLabel.color,
                '--schematic-default-ink-color',
                true
            ),
            'start',
            textOptions
        )
    }
}
