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
     * @param {Map<string, 'left' | 'right'>} compactExternalNumberLabelSides
     * @param {Map<string, { left: number, right: number }>} internalNumberLabelBoxes
     * @param {Set<string>} explicitOwnerPinNumberLabelKeys
     * @param {Set<string>} overlappingExternalNumberLabelKeys
     * @returns {string}
     */
    static buildMarkup(
        pin,
        sheetHeight,
        sheet,
        rotatedVerticalNumberOwners,
        explicitOwnerPinNameLabels,
        explicitOwnerPinLabelOffsets,
        compactExternalNumberLabelSides = new Map(),
        internalNumberLabelBoxes = new Map(),
        explicitOwnerPinNumberLabelKeys = new Set(),
        overlappingExternalNumberLabelKeys = new Set()
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
        const markerStyle =
            outerMarkerStyle ||
            SchematicPinSvgRenderer.#resolveSchematicElectricalPinMarkerStyle(
                pin
            )
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
        const compactExternalNumberLabelSide =
            compactExternalNumberLabelSides.get(String(pin.ownerIndex || '')) ||
            null
        const internalNumberLabelBox =
            internalNumberLabelBoxes.get(String(pin.ownerIndex || '')) || null
        const ownerPinNumberLabelKey =
            SchematicOwnerPinLabelLayout.buildOwnerPinLabelKey(
                pin.ownerIndex,
                pin.designator
            )
        const shouldRenderExternalNumber =
            !explicitOwnerPinNumberLabelKeys.has(ownerPinNumberLabelKey) &&
            !overlappingExternalNumberLabelKeys.has(ownerPinNumberLabelKey)

        if (pin.orientation === 'left') {
            if (labelMode !== 'hidden' && labelMode !== 'name-only') {
                const internalNumberPlacement =
                    SchematicPinSvgRenderer.#resolveInternalHorizontalNumberPlacement(
                        pin,
                        internalNumberLabelBox
                    )
                if (internalNumberPlacement) {
                    texts.push(
                        SchematicPinSvgRenderer.#buildPinNameTextMarkup(
                            'schematic-pin-name',
                            internalNumberPlacement.x,
                            projectedY + 3,
                            pin,
                            labelColor,
                            internalNumberPlacement.anchor,
                            textOptions
                        )
                    )
                }

                const defaultNumberX =
                    SchematicPinSvgRenderer.#resolveExternalHorizontalNumberX(
                        pin,
                        geometry,
                        markerStyle,
                        compactExternalNumberLabelSide,
                        internalNumberLabelBox
                    )
                const numberX = hasExplicitOwnerPinName
                    ? SchematicOwnerPinLabelLayout.resolveExplicitOwnerPinNumberX(
                          pin,
                          defaultNumberX,
                          explicitOwnerPinLabelOffsets
                      )
                    : defaultNumberX
                if (shouldRenderExternalNumber) {
                    texts.push(
                        createSvgText(
                            'schematic-pin-number',
                            numberX,
                            projectedY - 1,
                            pin.designator,
                            labelColor,
                            SchematicPinSvgRenderer.#resolveExternalHorizontalNumberAnchor(
                                pin,
                                markerStyle
                            ),
                            textOptions
                        )
                    )
                }
            }

            if (
                labelMode !== 'hidden' &&
                labelMode !== 'number-only' &&
                SchematicPinSvgRenderer.#shouldRenderHorizontalPinName(
                    pin,
                    hasExplicitOwnerPinName
                )
            ) {
                texts.push(
                    SchematicPinSvgRenderer.#buildPinNameTextMarkup(
                        'schematic-pin-name',
                        geometry.bodyX +
                            SchematicPinSvgRenderer.#resolveHorizontalPinNameInset(
                                pin,
                                labelMode
                            ),
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
                const internalNumberPlacement =
                    SchematicPinSvgRenderer.#resolveInternalHorizontalNumberPlacement(
                        pin,
                        internalNumberLabelBox
                    )
                if (internalNumberPlacement) {
                    texts.push(
                        SchematicPinSvgRenderer.#buildPinNameTextMarkup(
                            'schematic-pin-name',
                            internalNumberPlacement.x,
                            projectedY + 3,
                            pin,
                            labelColor,
                            internalNumberPlacement.anchor,
                            textOptions
                        )
                    )
                }

                const defaultNumberX =
                    SchematicPinSvgRenderer.#resolveExternalHorizontalNumberX(
                        pin,
                        geometry,
                        markerStyle,
                        compactExternalNumberLabelSide,
                        internalNumberLabelBox
                    )
                const numberX = hasExplicitOwnerPinName
                    ? SchematicOwnerPinLabelLayout.resolveExplicitOwnerPinNumberX(
                          pin,
                          defaultNumberX,
                          explicitOwnerPinLabelOffsets
                      )
                    : defaultNumberX
                if (shouldRenderExternalNumber) {
                    texts.push(
                        createSvgText(
                            'schematic-pin-number',
                            numberX,
                            projectedY - 1,
                            pin.designator,
                            labelColor,
                            SchematicPinSvgRenderer.#resolveExternalHorizontalNumberAnchor(
                                pin,
                                markerStyle
                            ),
                            textOptions
                        )
                    )
                }
            }

            if (
                labelMode !== 'hidden' &&
                labelMode !== 'number-only' &&
                SchematicPinSvgRenderer.#shouldRenderHorizontalPinName(
                    pin,
                    hasExplicitOwnerPinName
                )
            ) {
                texts.push(
                    SchematicPinSvgRenderer.#buildPinNameTextMarkup(
                        'schematic-pin-name',
                        geometry.bodyX -
                            SchematicPinSvgRenderer.#resolveHorizontalPinNameInset(
                                pin,
                                labelMode
                            ),
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
            shouldRenderExternalNumber &&
            (pin.orientation === 'top' || pin.orientation === 'bottom')
        ) {
            texts.push(
                createSvgText(
                    'schematic-pin-number',
                    compactExternalNumberLabelSide
                        ? SchematicPinSvgRenderer.#resolveCompactExternalVerticalNumberX(
                              geometry,
                              compactExternalNumberLabelSide
                          )
                        : geometry.bodyX - 2,
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
            escapeHtml(SchematicPinSvgRenderer.#resolvePinStrokeColor(pin)) +
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

        const electricalMarkerStyle =
            SchematicPinSvgRenderer.#resolveSchematicElectricalPinMarkerStyle(
                pin
            )
        if (electricalMarkerStyle) {
            return SchematicPinSvgRenderer.#buildOuterPinMarkerMarkup(
                pin,
                geometry,
                sheetHeight,
                electricalMarkerStyle
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
     * @param {'single-in' | 'single-out' | 'double' | 'cross'} markerStyle
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

        if (markerStyle === 'cross') {
            return SchematicPinSvgRenderer.#buildOuterPinCrossMarkerMarkup(
                geometry.bodyX,
                projectedY,
                pin.orientation,
                strokeColor
            )
        }

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
     * Returns the horizontal pin-number clearance needed by the pin geometry.
     * @param {'single-in' | 'single-out' | 'double' | 'cross' | null} markerStyle
     * @param {{ length?: number, electrical?: number }} pin
     * @returns {number}
     */
    static #resolveHorizontalPinNumberClearance(markerStyle, pin) {
        switch (markerStyle) {
            case 'double':
                return 21
            case 'cross':
                return 9
            case 'single-in':
            case 'single-out':
                return 8
            default:
                if (Number(pin?.electrical || 0) === 1) {
                    return 16
                }

                return SchematicPinSvgRenderer.#resolveLongPinInset(pin, 2)
        }
    }

    /**
     * Returns whether a horizontal pin name should be rendered inside the body.
     * Numeric name/designator matches are duplicate pin numbers; nonnumeric
     * matches such as PAD are valid body labels.
     * @param {{ name?: string, designator?: string }} pin Pin primitive.
     * @param {boolean} hasExplicitOwnerPinName Whether an explicit owner text already draws the label.
     * @returns {boolean}
     */
    static #shouldRenderHorizontalPinName(pin, hasExplicitOwnerPinName) {
        const name = String(pin?.name || '').trim()
        const designator = String(pin?.designator || '').trim()

        if (!name || hasExplicitOwnerPinName) {
            return false
        }

        if (name !== designator) {
            return true
        }

        return !/^\d+$/u.test(name)
    }

    /**
     * Returns the horizontal pin-name inset used inside the symbol body.
     * @param {{ length?: number }} pin
     * @param {'hidden' | 'number-only' | 'name-only' | 'name-and-number'} labelMode
     * @returns {number}
     */
    static #resolveHorizontalPinNameInset(pin, labelMode) {
        if (labelMode === 'name-only') {
            return 10
        }

        return SchematicPinSvgRenderer.#resolveLongPinInset(pin, 7)
    }

    /**
     * Adds extra text clearance for long connector-style pin stubs.
     * @param {{ length?: number }} pin
     * @param {number} fallback
     * @returns {number}
     */
    static #resolveLongPinInset(pin, fallback) {
        const length = Math.abs(Number(pin?.length || 0))

        if (length < 30) {
            return fallback
        }

        return fallback === 2 ? 10 : 8
    }

    /**
     * Places synthetic horizontal pin numbers outside the symbol body. Owner
     * bodies with internal numeric labels need a stub-side offset so the
     * outside contact number does not collapse onto the inside duplicate.
     * @param {{ length?: number, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number }} pin
     * @param {{ bodyX: number }} geometry
     * @param {'single-in' | 'single-out' | 'double' | 'cross' | null} markerStyle
     * @param {'left' | 'right' | null} compactExternalNumberLabelSide
     * @param {{ left: number, right: number } | null} internalNumberLabelBox
     * @returns {number}
     */
    static #resolveExternalHorizontalNumberX(
        pin,
        geometry,
        markerStyle,
        compactExternalNumberLabelSide,
        internalNumberLabelBox
    ) {
        const clearance =
            SchematicPinSvgRenderer.#resolveHorizontalPinNumberClearance(
                markerStyle,
                pin
            )
        const offset =
            compactExternalNumberLabelSide || internalNumberLabelBox
                ? Math.max(
                      clearance,
                      SchematicPinSvgRenderer.#resolveCompactExternalHorizontalNumberOffset(
                          pin
                      )
                  )
                : clearance

        if (pin.orientation === 'left') {
            return geometry.bodyX - offset
        }

        if (pin.orientation === 'right') {
            return geometry.bodyX + offset
        }

        return geometry.bodyX
    }

    /**
     * Resolves the text edge used for external horizontal pin numbers.
     * Double/electrical marker labels are authored from the route side back
     * toward the marker, while ordinary pins extend away from the body.
     * @param {{ orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number }} pin Pin primitive.
     * @param {'single-in' | 'single-out' | 'double' | 'cross' | null} markerStyle Marker style.
     * @returns {'start' | 'end'}
     */
    static #resolveExternalHorizontalNumberAnchor(pin, markerStyle) {
        const routeFacing =
            markerStyle === 'double' ||
            (!markerStyle && Number(pin?.electrical || 0) === 1)

        if (routeFacing) {
            return pin.orientation === 'left' ? 'start' : 'end'
        }

        return pin.orientation === 'left' ? 'end' : 'start'
    }

    /**
     * Places numeric-only labels just inside a rectangular owner body.
     * @param {{ name?: string, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @param {{ left: number, right: number } | null} box
     * @returns {{ x: number, anchor: 'middle' } | null}
     */
    static #resolveInternalHorizontalNumberPlacement(pin, box) {
        if (
            !box ||
            (pin.orientation !== 'left' && pin.orientation !== 'right') ||
            !/^\d+$/u.test(String(pin.name || '').trim())
        ) {
            return null
        }

        const left = Number(box.left)
        const right = Number(box.right)

        if (
            !Number.isFinite(left) ||
            !Number.isFinite(right) ||
            right <= left
        ) {
            return null
        }

        const inset = Math.min(10, Math.max(6, (right - left) / 6))

        return {
            x: pin.orientation === 'left' ? left + inset : right - inset,
            anchor: 'middle'
        }
    }

    /**
     * Places compact owner-drawn side pin numbers near the external pin stub.
     * @param {{ length?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @param {{ bodyX: number }} geometry
     * @returns {number}
     */
    static #resolveCompactExternalHorizontalNumberX(pin, geometry) {
        const offset =
            SchematicPinSvgRenderer.#resolveCompactExternalHorizontalNumberOffset(
                pin
            )

        if (pin.orientation === 'left') {
            return geometry.bodyX - offset
        }

        if (pin.orientation === 'right') {
            return geometry.bodyX + offset
        }

        return geometry.bodyX
    }

    /**
     * Resolves a stub-side offset for compact external horizontal numbers.
     * @param {{ length?: number }} pin
     * @returns {number}
     */
    static #resolveCompactExternalHorizontalNumberOffset(pin) {
        const length = Math.abs(Number(pin.length || 0))

        return Math.max(8, Math.min(length - 6, 12))
    }

    /**
     * Places compact owner-drawn vertical pin numbers on the same side as the
     * horizontal terminal contacts.
     * @param {{ bodyX: number }} geometry
     * @param {'left' | 'right'} side
     * @returns {number}
     */
    static #resolveCompactExternalVerticalNumberX(geometry, side) {
        return geometry.bodyX + (side === 'left' ? -10 : 10)
    }

    /**
     * Builds an authored outer pin cross marker.
     * @param {number} bodyX
     * @param {number} projectedY
     * @param {'left' | 'right' | 'top' | 'bottom'} orientation
     * @param {string} strokeColor
     * @returns {string}
     */
    static #buildOuterPinCrossMarkerMarkup(
        bodyX,
        projectedY,
        orientation,
        strokeColor
    ) {
        const direction = orientation === 'left' ? 1 : -1
        const centerX = bodyX - direction * 8
        const halfSize = 3

        return (
            '<g class="schematic-pin-marker"><line x1="' +
            formatNumber(centerX - halfSize) +
            '" y1="' +
            formatNumber(projectedY - halfSize) +
            '" x2="' +
            formatNumber(centerX + halfSize) +
            '" y2="' +
            formatNumber(projectedY + halfSize) +
            '" stroke="' +
            escapeHtml(strokeColor) +
            '" stroke-width="0.75" vector-effect="non-scaling-stroke" /><line x1="' +
            formatNumber(centerX - halfSize) +
            '" y1="' +
            formatNumber(projectedY + halfSize) +
            '" x2="' +
            formatNumber(centerX + halfSize) +
            '" y2="' +
            formatNumber(projectedY - halfSize) +
            '" stroke="' +
            escapeHtml(strokeColor) +
            '" stroke-width="0.75" vector-effect="non-scaling-stroke" /></g>'
        )
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
     * @returns {'single-in' | 'single-out' | 'double' | 'cross' | null}
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
            case 6:
                return 'cross'
            case 34:
                return 'double'
            default:
                return null
        }
    }

    /**
     * Resolves marker styles derived from the pin electrical type. The
     * bidirectional type keeps its legacy two-triangle geometry path.
     * @param {{ electrical?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {'single-in' | 'single-out' | null}
     */
    static #resolveSchematicElectricalPinMarkerStyle(pin) {
        if (pin.orientation !== 'left' && pin.orientation !== 'right') {
            return null
        }

        switch (Number(pin.electrical)) {
            case 0:
                return 'single-in'
            case 2:
                return 'single-out'
            default:
                return null
        }
    }

    /**
     * Resolves the visible stroke for a schematic pin stub.
     * @param {{ color?: string }} pin
     * @returns {string}
     */
    static #resolvePinStrokeColor(pin) {
        return SchematicColorResolver.resolveNonTextColor(
            pin?.color,
            '--schematic-accent-ink-color'
        )
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
