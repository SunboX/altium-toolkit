// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'
import { SchematicOwnerPinLabelLayout } from './SchematicOwnerPinLabelLayout.mjs'

const { createSvgText, escapeHtml, formatNumber, projectSchematicY } =
    SchematicSvgUtils

/**
 * Renders one normalized schematic pin into SVG markup.
 */
export class SchematicPinSvgRenderer {
    /**
     * Builds one schematic pin including its stub and visible labels.
     * @param {{ x: number, y: number, length: number, name: string, nameSegments?: { text: string, overline: boolean }[], designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number, color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex?: string }} pin
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @param {Set<string>} rotatedVerticalNumberOwners
     * @param {Set<string>} explicitOwnerPinNameLabels
     * @param {Map<string, number>} explicitOwnerPinLabelOffsets
     * @returns {string}
     */
    static buildMarkup(
        pin,
        sheetHeight,
        sheet,
        rotatedVerticalNumberOwners,
        explicitOwnerPinNameLabels,
        explicitOwnerPinLabelOffsets
    ) {
        const geometry =
            SchematicPinSvgRenderer.#projectSchematicPinGeometry(pin)
        if (!geometry) return ''

        const textOptions =
            SchematicTypography.buildViewerSchematicFontOptions(sheet)
        const projectedY = projectSchematicY(sheetHeight, pin.y)
        const projectedInnerY = projectSchematicY(sheetHeight, geometry.bodyY)
        const projectedOuterY = projectSchematicY(sheetHeight, geometry.outerY)
        const texts = []
        const labelColor = SchematicColorResolver.resolveColor(
            pin.labelColor || pin.color,
            '--schematic-text-color'
        )
        const labelMode = pin.labelMode || 'name-and-number'
        const outerMarkerStyle =
            SchematicPinSvgRenderer.#resolveSchematicOuterPinMarkerStyle(pin)
        const rotateTopNumber =
            pin.orientation === 'top' &&
            rotatedVerticalNumberOwners.has(String(pin.ownerIndex || ''))
        const ownerPinLabelKey =
            SchematicOwnerPinLabelLayout.buildOwnerPinLabelKey(
                pin.ownerIndex,
                pin.name
            )
        const hasExplicitOwnerPinName =
            Boolean(pin.name) &&
            explicitOwnerPinNameLabels.has(ownerPinLabelKey)

        if (pin.orientation === 'left') {
            if (labelMode !== 'hidden' && labelMode !== 'name-only') {
                const defaultNumberX =
                    geometry.bodyX -
                    SchematicPinSvgRenderer.#resolveHorizontalPinNumberClearance(
                        outerMarkerStyle
                    )
                const numberX = hasExplicitOwnerPinName
                    ? SchematicOwnerPinLabelLayout.resolveExplicitOwnerPinNumberX(
                          pin,
                          defaultNumberX,
                          explicitOwnerPinLabelOffsets
                      )
                    : defaultNumberX
                texts.push(
                    createSvgText(
                        'schematic-pin-number',
                        numberX,
                        projectedY - 1,
                        pin.designator,
                        labelColor,
                        'end',
                        textOptions
                    )
                )
            }

            if (
                labelMode !== 'hidden' &&
                labelMode !== 'number-only' &&
                pin.name &&
                pin.name !== pin.designator &&
                !hasExplicitOwnerPinName
            ) {
                texts.push(
                    SchematicPinSvgRenderer.#buildPinNameTextMarkup(
                        'schematic-pin-name',
                        geometry.bodyX + (labelMode === 'name-only' ? 10 : 4),
                        projectedY + 3,
                        pin,
                        labelColor,
                        'start',
                        textOptions
                    )
                )
            }
        }

        if (pin.orientation === 'right') {
            if (labelMode !== 'hidden' && labelMode !== 'name-only') {
                const defaultNumberX =
                    geometry.bodyX +
                    SchematicPinSvgRenderer.#resolveHorizontalPinNumberClearance(
                        outerMarkerStyle
                    )
                const numberX = hasExplicitOwnerPinName
                    ? SchematicOwnerPinLabelLayout.resolveExplicitOwnerPinNumberX(
                          pin,
                          defaultNumberX,
                          explicitOwnerPinLabelOffsets
                      )
                    : defaultNumberX
                texts.push(
                    createSvgText(
                        'schematic-pin-number',
                        numberX,
                        projectedY - 1,
                        pin.designator,
                        labelColor,
                        'start',
                        textOptions
                    )
                )
            }

            if (
                labelMode !== 'hidden' &&
                labelMode !== 'number-only' &&
                pin.name &&
                pin.name !== pin.designator &&
                !hasExplicitOwnerPinName
            ) {
                texts.push(
                    SchematicPinSvgRenderer.#buildPinNameTextMarkup(
                        'schematic-pin-name',
                        geometry.bodyX - (labelMode === 'name-only' ? 10 : 4),
                        projectedY + 3,
                        pin,
                        labelColor,
                        'end',
                        textOptions
                    )
                )
            }
        }

        if (
            labelMode !== 'hidden' &&
            labelMode !== 'name-only' &&
            (pin.orientation === 'top' || pin.orientation === 'bottom')
        ) {
            texts.push(
                createSvgText(
                    'schematic-pin-number',
                    geometry.bodyX - 2,
                    pin.orientation === 'top'
                        ? projectedInnerY - 6
                        : projectedInnerY + 7,
                    pin.designator,
                    labelColor,
                    'middle',
                    pin.orientation === 'top' && !rotateTopNumber
                        ? textOptions
                        : { ...textOptions, rotation: -90 }
                )
            )
        }

        if (
            labelMode !== 'hidden' &&
            labelMode !== 'number-only' &&
            pin.name &&
            pin.name !== pin.designator &&
            !hasExplicitOwnerPinName &&
            (pin.orientation === 'top' || pin.orientation === 'bottom')
        ) {
            texts.push(
                SchematicPinSvgRenderer.#buildPinNameTextMarkup(
                    'schematic-pin-name',
                    pin.orientation === 'top'
                        ? geometry.bodyX
                        : geometry.bodyX + 4,
                    pin.orientation === 'top'
                        ? projectedInnerY + 4
                        : projectedInnerY - 4,
                    pin,
                    labelColor,
                    pin.orientation === 'top' ? 'end' : 'start',
                    { ...textOptions, rotation: -90 }
                )
            )
        }

        const markerMarkup = SchematicPinSvgRenderer.#buildPinMarkerMarkup(
            pin,
            geometry,
            sheetHeight
        )

        return (
            '<g class="schematic-pin"><line class="schematic-pin-line" x1="' +
            formatNumber(geometry.bodyX) +
            '" y1="' +
            formatNumber(projectedInnerY) +
            '" x2="' +
            formatNumber(geometry.outerX) +
            '" y2="' +
            formatNumber(projectedOuterY) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    pin.color,
                    '--schematic-accent-ink-color'
                )
            ) +
            '" />' +
            markerMarkup +
            texts.join('') +
            '</g>'
        )
    }

    /**
     * Builds the authored or electrical pin marker for one horizontal pin.
     * @param {{ electrical?: number, symbolOuter?: number, orientation: 'left' | 'right' | 'top' | 'bottom', labelColor?: string, color: string }} pin
     * @param {{ bodyX: number, bodyY: number }} geometry
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildPinMarkerMarkup(pin, geometry, sheetHeight) {
        const outerMarkerStyle =
            SchematicPinSvgRenderer.#resolveSchematicOuterPinMarkerStyle(pin)
        if (outerMarkerStyle) {
            return SchematicPinSvgRenderer.#buildOuterPinMarkerMarkup(
                pin,
                geometry,
                sheetHeight,
                outerMarkerStyle
            )
        }

        if (Number(pin.electrical || 0) !== 1) {
            return ''
        }

        if (pin.orientation !== 'left' && pin.orientation !== 'right') {
            return ''
        }

        const direction = pin.orientation === 'left' ? 1 : -1
        const bodyTipX = geometry.bodyX
        const bodyBaseX = geometry.bodyX - direction * 5
        const wireBaseX = geometry.bodyX - direction * 8
        const wireTipX = geometry.bodyX - direction * 13
        const halfHeight = 3
        const projectedY = projectSchematicY(sheetHeight, geometry.bodyY)
        const fillColor = SchematicColorResolver.resolveFill(
            'var(--schematic-pin-marker-fill)',
            '--schematic-fill-light-color'
        )
        const strokeColor = SchematicColorResolver.resolveColor(
            pin.labelColor || pin.color,
            '--schematic-text-color'
        )

        return (
            '<g class="schematic-pin-marker"><polygon points="' +
            escapeHtml(
                [
                    [bodyBaseX, projectedY - halfHeight],
                    [bodyBaseX, projectedY + halfHeight],
                    [bodyTipX, projectedY]
                ]
                    .map(([x, y]) => formatNumber(x) + ',' + formatNumber(y))
                    .join(' ')
            ) +
            '" fill="' +
            escapeHtml(fillColor) +
            '" stroke="' +
            escapeHtml(strokeColor) +
            '" stroke-width="0.75" vector-effect="non-scaling-stroke" /><polygon points="' +
            escapeHtml(
                [
                    [wireBaseX, projectedY - halfHeight],
                    [wireBaseX, projectedY + halfHeight],
                    [wireTipX, projectedY]
                ]
                    .map(([x, y]) => formatNumber(x) + ',' + formatNumber(y))
                    .join(' ')
            ) +
            '" fill="' +
            escapeHtml(fillColor) +
            '" stroke="' +
            escapeHtml(strokeColor) +
            '" stroke-width="0.75" vector-effect="non-scaling-stroke" /></g>'
        )
    }

    /**
     * Builds one authored outer pin glyph from the normalized marker style.
     * @param {{ orientation: 'left' | 'right' | 'top' | 'bottom', labelColor?: string, color: string }} pin
     * @param {{ bodyX: number, bodyY: number }} geometry
     * @param {number} sheetHeight
     * @param {'single-in' | 'single-out' | 'double'} markerStyle
     * @returns {string}
     */
    static #buildOuterPinMarkerMarkup(pin, geometry, sheetHeight, markerStyle) {
        const halfHeight = 3
        const projectedY = projectSchematicY(sheetHeight, geometry.bodyY)
        const fillColor = SchematicColorResolver.resolveFill(
            'var(--schematic-pin-marker-fill)',
            '--schematic-fill-light-color'
        )
        const strokeColor = SchematicColorResolver.resolveColor(
            pin.labelColor || pin.color,
            '--schematic-text-color'
        )

        const polygons = SchematicPinSvgRenderer.#buildOuterPinMarkerPolygons(
            geometry.bodyX,
            projectedY,
            pin.orientation,
            halfHeight,
            markerStyle
        )

        return (
            '<g class="schematic-pin-marker">' +
            polygons
                .map(
                    (points) =>
                        '<polygon points="' +
                        escapeHtml(
                            points
                                .map(
                                    ([x, y]) =>
                                        formatNumber(x) + ',' + formatNumber(y)
                                )
                                .join(' ')
                        ) +
                        '" fill="' +
                        escapeHtml(fillColor) +
                        '" stroke="' +
                        escapeHtml(strokeColor) +
                        '" stroke-width="0.75" vector-effect="non-scaling-stroke" />'
                )
                .join('') +
            '</g>'
        )
    }

    /**
     * Returns the horizontal pin-number clearance needed by an authored marker.
     * @param {'single-in' | 'single-out' | 'double' | null} markerStyle
     * @returns {number}
     */
    static #resolveHorizontalPinNumberClearance(markerStyle) {
        switch (markerStyle) {
            case 'double':
                return 17
            case 'single-in':
            case 'single-out':
                return 8
            default:
                return 2
        }
    }

    /**
     * Builds one or two authored outer-marker polygons for one horizontal pin.
     * @param {number} bodyX
     * @param {number} projectedY
     * @param {'left' | 'right' | 'top' | 'bottom'} orientation
     * @param {number} halfHeight
     * @param {'single-in' | 'single-out' | 'double'} markerStyle
     * @returns {number[][][]}
     */
    static #buildOuterPinMarkerPolygons(
        bodyX,
        projectedY,
        orientation,
        halfHeight,
        markerStyle
    ) {
        const direction = orientation === 'left' ? 1 : -1
        const inwardTriangle = [
            [bodyX - direction * 6, projectedY - halfHeight],
            [bodyX - direction * 6, projectedY + halfHeight],
            [bodyX, projectedY]
        ]
        const outwardTriangle = [
            [bodyX, projectedY - halfHeight],
            [bodyX, projectedY + halfHeight],
            [bodyX - direction * 6, projectedY]
        ]

        if (markerStyle === 'single-in') {
            return [inwardTriangle]
        }

        if (markerStyle === 'single-out') {
            return [outwardTriangle]
        }

        return [
            inwardTriangle,
            [
                [bodyX - direction * 9, projectedY - halfHeight],
                [bodyX - direction * 9, projectedY + halfHeight],
                [bodyX - direction * 15, projectedY]
            ]
        ]
    }

    /**
     * Resolves one authored outer pin marker style from the stored symbol flag.
     * @param {{ symbolOuter?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {'single-in' | 'single-out' | 'double' | null}
     */
    static #resolveSchematicOuterPinMarkerStyle(pin) {
        if (pin.orientation !== 'left' && pin.orientation !== 'right') {
            return null
        }

        const symbolOuter = Number(pin.symbolOuter || 0)
        switch (symbolOuter) {
            case 1:
            case 33:
                return 'single-out'
            case 2:
                return 'single-in'
            case 34:
                return 'double'
            default:
                return null
        }
    }

    /**
     * Builds one pin-name text element, including overline tspans when needed.
     * @param {string} className
     * @param {number} x
     * @param {number} y
     * @param {{ name: string, nameSegments?: { text: string, overline: boolean }[] }} pin
     * @param {string} color
     * @param {'start' | 'end' | 'middle'} anchor
     * @param {{ fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number }} options
     * @returns {string}
     */
    static #buildPinNameTextMarkup(
        className,
        x,
        y,
        pin,
        color,
        anchor,
        options
    ) {
        return createSvgText(className, x, y, pin.name, color, anchor, {
            ...options,
            segments: pin.nameSegments
        })
    }

    /**
     * Computes the inner endpoint for a schematic pin stub.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ bodyX: number, bodyY: number, outerX: number, outerY: number } | null}
     */
    static #projectSchematicPinGeometry(pin) {
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
