// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'
import { SchematicNoErcSymbolResolver } from './SchematicNoErcSymbolResolver.mjs'
import { SchematicPinDesignatorInferer } from './SchematicPinDesignatorInferer.mjs'
import { SchematicTextRunParser } from './SchematicTextRunParser.mjs'

/**
 * Helpers for normalized schematic pins, ports, and crosses.
 */
export class SchematicPinParser {
    /**
     * Normalizes schematic pin records into drawable pin primitives.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {{ ownerDrawnInternalPinOwners?: Set<string>, numericEndpointLabelOwners?: Set<string> }} [options]
     * @returns {{ x: number, y: number, length: number, name: string, nameSegments?: { text: string, overline: boolean }[], designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number, color: string, labelColor: string, labelMode: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex: string }[]}
     */
    static parseSchematicPins(records, options = {}) {
        const groups = new Map()
        const ownerDrawnInternalPinOwners =
            options.ownerDrawnInternalPinOwners || new Set()
        const numericEndpointLabelOwners =
            options.numericEndpointLabelOwners || new Set()

        for (const record of records) {
            const ownerIndex = ParserUtils.getField(record.fields, 'OwnerIndex')
            const x = ParserUtils.parseNumericField(record.fields, 'Location.X')
            const y = ParserUtils.parseNumericField(record.fields, 'Location.Y')
            const length = ParserUtils.parseNumericField(
                record.fields,
                'PinLength'
            )
            const orientation =
                SchematicPinParser.#inferSchematicPinOrientation(
                    ParserUtils.parseNumericField(
                        record.fields,
                        'PinConglomerate'
                    )
                )

            if (
                x === null ||
                y === null ||
                length === null ||
                length <= 0 ||
                !orientation
            ) {
                continue
            }

            if (!groups.has(ownerIndex)) {
                groups.set(ownerIndex, [])
            }

            groups.get(ownerIndex).push({
                x,
                y,
                length,
                conglomerate:
                    ParserUtils.parseNumericField(
                        record.fields,
                        'PinConglomerate'
                    ) || undefined,
                ...SchematicPinParser.#parseSchematicPinName(
                    ParserUtils.getField(record.fields, 'Name')
                ),
                designator: ParserUtils.getField(record.fields, 'Designator'),
                orientation,
                electrical: SchematicPinParser.#parseSchematicPinElectrical(
                    record.fields
                ),
                symbolOuter:
                    ParserUtils.parseNumericField(
                        record.fields,
                        'SymBol_Outer'
                    ) || undefined,
                color: ParserUtils.toColor(record.fields.Color, '#000000'),
                labelColor: ParserUtils.toColor(
                    record.fields.TextColor,
                    '#1f1f1f'
                ),
                ownerIndex
            })
        }

        return [...groups.values()].flatMap((pins) =>
            SchematicPinParser.#normalizeSchematicPinGroup(
                pins,
                ownerDrawnInternalPinOwners,
                numericEndpointLabelOwners
            )
        )
    }

    /**
     * Parses Altium's pin electrical type, including its omitted-field default.
     * Formal schematic pin records omit Electrical for input pins and serialize
     * passive pins explicitly as Electrical=4.
     * @param {Record<string, string | string[]>} fields Pin record fields.
     * @returns {number | undefined}
     */
    static #parseSchematicPinElectrical(fields) {
        const explicitElectrical = ParserUtils.parseNumericField(
            fields,
            'Electrical'
        )

        if (explicitElectrical !== null) {
            return explicitElectrical
        }

        if (ParserUtils.parseNumericField(fields, 'FormalType') !== null) {
            return 0
        }

        return undefined
    }

    /**
     * Normalizes schematic port records into drawable port boxes.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} [lines]
     * @returns {{ x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction: 'left' | 'right' | 'up' | 'down', shape: 'single' | 'double' | 'plain' }[]}
     */
    static parseSchematicPorts(records, lines = []) {
        return records
            .map((record) => {
                const x =
                    ParserUtils.parseNumericField(
                        record.fields,
                        'Location.X'
                    ) || 0
                const y =
                    ParserUtils.parseNumericField(
                        record.fields,
                        'Location.Y'
                    ) || 0
                const width =
                    ParserUtils.parseNumericField(record.fields, 'Width') || 40

                return {
                    x,
                    y,
                    width,
                    height:
                        ParserUtils.parseNumericField(
                            record.fields,
                            'Height'
                        ) || 10,
                    name: ParserUtils.getField(record.fields, 'Name'),
                    fill: ParserUtils.toColor(
                        record.fields.AreaColor,
                        '#ffe16f'
                    ),
                    color: ParserUtils.toColor(
                        record.fields.TextColor || record.fields.Color,
                        '#8d2b2b'
                    ),
                    shape: SchematicPinParser.#resolveSchematicPortShape(
                        record.fields
                    ),
                    direction:
                        SchematicPinParser.#resolveSchematicPortDirection(
                            record.fields,
                            x,
                            y,
                            width,
                            lines
                        )
                }
            })
            .filter((port) => port.name)
    }

    /**
     * Resolves which horizontal port silhouette Altium requested.
     * @param {Record<string, string | string[]>} fields
     * @returns {'single' | 'double' | 'plain'}
     */
    static #resolveSchematicPortShape(fields) {
        if (ParserUtils.parseNumericField(fields, 'Style') === 4) {
            return 'single'
        }

        if (ParserUtils.getField(fields, 'IOType') === '3') {
            return 'double'
        }

        if (
            !ParserUtils.getField(fields, 'Alignment') &&
            !ParserUtils.getField(fields, 'IOType')
        ) {
            return 'plain'
        }

        return 'single'
    }

    /**
     * Resolves which side of an off-sheet port should taper.
     * @param {Record<string, string | string[]>} fields
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @returns {'left' | 'right' | 'up' | 'down'}
     */
    static #resolveSchematicPortDirection(fields, x, y, width, lines) {
        if (ParserUtils.parseNumericField(fields, 'Style') === 4) {
            const verticalWireSide =
                SchematicPinParser.#findSchematicVerticalPortWireSide(
                    x,
                    y,
                    width,
                    lines
                )

            return verticalWireSide || 'up'
        }

        const wireSide = SchematicPinParser.#findSchematicPortWireSide(
            x,
            y,
            width,
            lines
        )
        const ioType = ParserUtils.getField(fields, 'IOType')

        if (wireSide && ioType) {
            return SchematicPinParser.#inferSchematicPortDirectionFromIoType(
                ioType,
                wireSide
            )
        }

        return SchematicPinParser.#inferSchematicPortDirectionFromAlignment(
            ParserUtils.getField(fields, 'Alignment')
        )
    }

    /**
     * Returns which horizontal side a recovered wire touches for one port.
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @returns {'left' | 'right' | null}
     */
    static #findSchematicPortWireSide(x, y, width, lines) {
        const tolerance = 0.01
        let touchesLeft = false
        let touchesRight = false

        for (const line of lines) {
            if (
                Math.abs(Number(line.y1) - y) > tolerance ||
                Math.abs(Number(line.y2) - y) > tolerance
            ) {
                continue
            }

            touchesLeft =
                touchesLeft ||
                Math.abs(Number(line.x1) - x) <= tolerance ||
                Math.abs(Number(line.x2) - x) <= tolerance
            touchesRight =
                touchesRight ||
                Math.abs(Number(line.x1) - (x + width)) <= tolerance ||
                Math.abs(Number(line.x2) - (x + width)) <= tolerance

            if (touchesLeft && touchesRight) {
                return null
            }
        }

        if (touchesLeft) {
            return 'left'
        }

        if (touchesRight) {
            return 'right'
        }

        return null
    }

    /**
     * Returns which vertical side of one style-4 port touches recovered wire
     * geometry. Those ports use `x` as the vertical centerline and `y` as the
     * lower bound of the callout footprint.
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @returns {'up' | 'down' | null}
     */
    static #findSchematicVerticalPortWireSide(x, y, width, lines) {
        const topPoint = {
            x,
            y: y + width
        }
        const bottomPoint = {
            x,
            y
        }
        let touchesTop = false
        let touchesBottom = false

        for (const line of lines) {
            touchesTop =
                touchesTop ||
                SchematicPinParser.#pointTouchesLine(topPoint, line, 0.01)
            touchesBottom =
                touchesBottom ||
                SchematicPinParser.#pointTouchesLine(bottomPoint, line, 0.01)

            if (touchesTop && touchesBottom) {
                return null
            }
        }

        if (touchesTop) {
            return 'up'
        }

        if (touchesBottom) {
            return 'down'
        }

        return null
    }

    /**
     * Infers the tapered side from port IO type plus attached wire side.
     * @param {string} ioType
     * @param {'left' | 'right'} wireSide
     * @returns {'left' | 'right'}
     */
    static #inferSchematicPortDirectionFromIoType(ioType, wireSide) {
        if (String(ioType) === '2') {
            return wireSide
        }

        return wireSide === 'left' ? 'right' : 'left'
    }

    /**
     * Infers which side of an off-sheet port should taper from legacy
     * alignment data when no better connectivity clue is available.
     * @param {string} alignment
     * @returns {'left' | 'right'}
     */
    static #inferSchematicPortDirectionFromAlignment(alignment) {
        return String(alignment || '') === '2' ? 'right' : 'left'
    }

    /**
     * Returns true when a point lands on one line endpoint or on an
     * axis-aligned segment within a small tolerance.
     * @param {{ x: number, y: number }} point
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {number} tolerance
     * @returns {boolean}
     */
    static #pointTouchesLine(point, line, tolerance) {
        const effectiveTolerance = Math.max(Number(tolerance || 0.01), 0.01)
        const touchesStart =
            Math.abs(Number(line.x1) - point.x) <= effectiveTolerance &&
            Math.abs(Number(line.y1) - point.y) <= effectiveTolerance
        const touchesEnd =
            Math.abs(Number(line.x2) - point.x) <= effectiveTolerance &&
            Math.abs(Number(line.y2) - point.y) <= effectiveTolerance

        if (touchesStart || touchesEnd) {
            return true
        }

        const minX =
            Math.min(Number(line.x1), Number(line.x2)) - effectiveTolerance
        const maxX =
            Math.max(Number(line.x1), Number(line.x2)) + effectiveTolerance
        const minY =
            Math.min(Number(line.y1), Number(line.y2)) - effectiveTolerance
        const maxY =
            Math.max(Number(line.y1), Number(line.y2)) + effectiveTolerance

        if (
            Math.abs(Number(line.x1) - Number(line.x2)) <= effectiveTolerance &&
            Math.abs(point.x - Number(line.x1)) <= effectiveTolerance &&
            point.y >= minY &&
            point.y <= maxY
        ) {
            return true
        }

        if (
            Math.abs(Number(line.y1) - Number(line.y2)) <= effectiveTolerance &&
            Math.abs(point.y - Number(line.y1)) <= effectiveTolerance &&
            point.x >= minX &&
            point.x <= maxX
        ) {
            return true
        }

        return false
    }

    /**
     * Normalizes no-connect crosses from schematic records.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, size: number, color: string, symbol: number | null, symbolName: string }[]}
     */
    static parseSchematicCrosses(records) {
        return records
            .map((record) => {
                const rawSymbol = ParserUtils.getField(record.fields, 'Symbol')
                const symbol = ParserUtils.parseNumericField(
                    record.fields,
                    'Symbol'
                )

                return {
                    x:
                        ParserUtils.parseNumericField(
                            record.fields,
                            'Location.X'
                        ) || 0,
                    y:
                        ParserUtils.parseNumericField(
                            record.fields,
                            'Location.Y'
                        ) || 0,
                    size: 6,
                    color: ParserUtils.toColor(record.fields.Color, '#ff0000'),
                    symbol,
                    symbolName: SchematicNoErcSymbolResolver.resolveSymbolName(
                        rawSymbol || symbol
                    )
                }
            })
            .filter((cross) => cross.x || cross.y)
    }

    /**
     * Expands a schematic polyline record into drawable line segments.
     * @param {Record<string, string | string[]>} fields
     * @param {{ isBus?: boolean, recordType?: string }} [options]
     * @returns {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle: number, isBus?: boolean, recordType?: string, omittedEndpointAxis?: 'x' | 'y', sourceLocationCount?: number }[]}
     */
    static parseSchematicPolyline(fields, options = {}) {
        const points = SchematicPinParser.#collectSchematicPointList(fields)

        const segments = []
        const lineStyle = SchematicPinParser.#resolveSchematicLineStyle(fields)
        const startMarker = SchematicPinParser.#resolvePolylineMarker(
            fields,
            'Start'
        )
        const endMarker = SchematicPinParser.#resolvePolylineMarker(
            fields,
            'End'
        )

        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1]
            const current = points[index]
            const omittedEndpointAxis =
                SchematicPinParser.#resolveOmittedPointAxis(current)

            segments.push({
                x1: previous.x,
                y1: previous.y,
                x2: current.x,
                y2: current.y,
                color: ParserUtils.toColor(
                    fields.Color,
                    SchematicPinParser.#resolveDefaultPolylineColor(
                        fields,
                        options.recordType
                    )
                ),
                width: ParserUtils.parseSchematicLineWidth(fields),
                lineStyle,
                isBus: options.isBus === true ? true : undefined,
                recordType: options.recordType || undefined,
                omittedEndpointAxis: omittedEndpointAxis || undefined,
                sourceLocationCount: points.length,
                ...(index === 1 && startMarker ? { startMarker } : {}),
                ...(index === points.length - 1 && endMarker
                    ? { endMarker }
                    : {})
            })
        }

        return segments
    }

    /**
     * Expands a schematic polygon record into closed drawable line segments.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle: number }[]}
     */
    static parseSchematicPolygon(fields) {
        const points = SchematicPinParser.#collectSchematicPointList(fields)

        if (points.length < 2) {
            return []
        }

        const segments = []
        const lineStyle = SchematicPinParser.#resolveSchematicLineStyle(fields)

        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1]
            const current = points[index]

            segments.push({
                x1: previous.x,
                y1: previous.y,
                x2: current.x,
                y2: current.y,
                color: ParserUtils.toColor(
                    fields.Color,
                    SchematicPinParser.#resolveDefaultPolylineColor(fields, '7')
                ),
                width: ParserUtils.parseSchematicLineWidth(fields),
                lineStyle
            })
        }

        const firstPoint = points[0]
        const lastPoint = points[points.length - 1]

        segments.push({
            x1: lastPoint.x,
            y1: lastPoint.y,
            x2: firstPoint.x,
            y2: firstPoint.y,
            color: ParserUtils.toColor(
                fields.Color,
                SchematicPinParser.#resolveDefaultPolylineColor(fields, '7')
            ),
            width: ParserUtils.parseSchematicLineWidth(fields),
            lineStyle
        })

        return segments
    }

    /**
     * Resolves Altium's legacy and extended schematic line style fields.
     * @param {Record<string, string | string[]>} fields
     * @returns {number}
     */
    static #resolveSchematicLineStyle(fields) {
        const extendedStyle = ParserUtils.parseNumericField(
            fields,
            'LineStyleExt'
        )

        if (extendedStyle !== null) {
            return extendedStyle
        }

        return ParserUtils.parseNumericField(fields, 'LineStyle') || 0
    }

    /**
     * Resolves the fallback stroke color for schematic drawing primitives.
     * @param {Record<string, string | string[]>} fields
     * @param {string | undefined} recordType
     * @returns {string}
     */
    static #resolveDefaultPolylineColor(fields, recordType) {
        const resolvedRecordType =
            recordType || ParserUtils.getField(fields, 'RECORD')

        return resolvedRecordType === '6' || resolvedRecordType === '7'
            ? '#000000'
            : '#a44a1b'
    }

    /**
     * Resolves one authored polyline endpoint marker.
     * @param {Record<string, string | string[]>} fields Source record fields.
     * @param {'Start' | 'End'} edge Endpoint prefix.
     * @returns {{ shape: number, shapeName: string, size: number } | null}
     */
    static #resolvePolylineMarker(fields, edge) {
        const shape = SchematicPinParser.#parseFirstNumericField(fields, [
            edge + 'LineShape',
            edge + 'LineMarker',
            edge + 'MarkerShape',
            edge + 'ArrowKind'
        ])

        if (shape === null || shape <= 0) {
            return null
        }

        const size =
            SchematicPinParser.#parseFirstNumericField(fields, [
                edge + 'LineShapeSize',
                edge + 'LineMarkerSize',
                edge + 'MarkerSize',
                edge + 'ArrowSize'
            ]) || 6

        return {
            shape,
            shapeName:
                SchematicPinParser.#resolvePolylineMarkerShapeName(shape),
            size
        }
    }

    /**
     * Parses the first present numeric field from a candidate list.
     * @param {Record<string, string | string[]>} fields Source record fields.
     * @param {string[]} names Candidate field names.
     * @returns {number | null}
     */
    static #parseFirstNumericField(fields, names) {
        for (const name of names) {
            const value = ParserUtils.parseNumericField(fields, name)
            if (value !== null) {
                return value
            }
        }

        return null
    }

    /**
     * Maps native polyline marker codes onto stable renderer labels.
     * @param {number} shape Numeric marker code.
     * @returns {string}
     */
    static #resolvePolylineMarkerShapeName(shape) {
        switch (shape) {
            case 1:
                return 'arrow'
            case 2:
                return 'filled-arrow'
            case 3:
                return 'tail'
            case 4:
                return 'filled-tail'
            case 5:
                return 'circle'
            case 6:
                return 'square'
            default:
                return 'marker-' + shape
        }
    }

    /**
     * Collects a schematic point list, carrying forward a missing coordinate
     * axis from the preceding point when Altium omitted an unchanged value.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number }[]}
     */
    static #collectSchematicPointList(fields) {
        const locationCount = ParserUtils.parseNumericField(
            fields,
            'LocationCount'
        )
        const closesPolygon = ParserUtils.getField(fields, 'RECORD') === '7'

        if (locationCount === null || locationCount < 2) {
            return []
        }

        const points = []
        let previousX = null
        let previousY = null

        for (let index = 1; index <= locationCount; index += 1) {
            const x = ParserUtils.parseNumericField(fields, 'X' + index)
            const y = ParserUtils.parseNumericField(fields, 'Y' + index)

            if (x === null && y === null) {
                break
            }

            const pointX = x === null ? previousX : x
            const pointY = y === null ? previousY : y

            if (pointX === null || pointY === null) {
                break
            }

            const point =
                closesPolygon && index === locationCount
                    ? SchematicPinParser.#resolveCollapsedFinalPolygonPoint(
                          x,
                          y,
                          pointX,
                          pointY,
                          points
                      )
                    : { x: pointX, y: pointY }

            points.push({ ...point, sourceX: x, sourceY: y })
            previousX = point.x
            previousY = point.y
        }

        return points
    }

    /**
     * Resolves which coordinate axis was omitted on one source point.
     * @param {{ sourceX?: number | null, sourceY?: number | null }} point
     * @returns {'x' | 'y' | null}
     */
    static #resolveOmittedPointAxis(point) {
        if (point.sourceX === null && point.sourceY !== null) {
            return 'x'
        }

        if (point.sourceX !== null && point.sourceY === null) {
            return 'y'
        }

        return null
    }

    /**
     * Recovers a closed polygon's final omitted axis when carrying the previous
     * point would collapse the last side into a duplicate point.
     * @param {number | null} sourceX
     * @param {number | null} sourceY
     * @param {number} pointX
     * @param {number} pointY
     * @param {{ x: number, y: number }[]} points
     * @returns {{ x: number, y: number }}
     */
    static #resolveCollapsedFinalPolygonPoint(
        sourceX,
        sourceY,
        pointX,
        pointY,
        points
    ) {
        const previousPoint = points.at(-1)
        const firstPoint = points[0]

        if (!previousPoint || !firstPoint) {
            return { x: pointX, y: pointY }
        }

        if (
            sourceY === null &&
            sourceX !== null &&
            firstPoint.y !== previousPoint.y
        ) {
            if (pointX === previousPoint.x && pointY === previousPoint.y) {
                return { x: pointX, y: firstPoint.y }
            }
        }

        if (
            sourceX === null &&
            sourceY !== null &&
            firstPoint.x !== previousPoint.x
        ) {
            if (pointX === previousPoint.x && pointY === previousPoint.y) {
                return { x: firstPoint.x, y: pointY }
            }
        }

        return { x: pointX, y: pointY }
    }

    /**
     * Deduces the visible pins for one schematic symbol owner.
     * @param {{ x: number, y: number, length: number, conglomerate?: number, name: string, nameSegments?: { text: string, overline: boolean }[], designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number, color?: string, labelColor?: string, ownerIndex: string }[]} pins
     * @param {Set<string>} ownerDrawnInternalPinOwners
     * @param {Set<string>} numericEndpointLabelOwners
     * @returns {{ x: number, y: number, length: number, name: string, nameSegments?: { text: string, overline: boolean }[], designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number, color: string, labelColor: string, labelMode: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex: string }[]}
     */
    static #normalizeSchematicPinGroup(
        pins,
        ownerDrawnInternalPinOwners,
        numericEndpointLabelOwners
    ) {
        const deduped = SchematicPinParser.#dedupeSchematicPins(pins)
        const inferredSequentialDesignators =
            SchematicPinDesignatorInferer.inferSequentialCompactFourPinDesignators(
                deduped
            )
        const inferredTwoColumnDesignators = inferredSequentialDesignators
            ? null
            : SchematicPinDesignatorInferer.inferCompactTwoColumnDesignators(
                  deduped
              )
        const inferredSingleColumnDesignators =
            inferredSequentialDesignators || inferredTwoColumnDesignators
                ? null
                : SchematicPinDesignatorInferer.inferSingleColumnDesignators(
                      deduped
                  )
        const normalizedPins =
            inferredSequentialDesignators ||
            inferredTwoColumnDesignators ||
            inferredSingleColumnDesignators ||
            deduped
        const names = [
            ...new Set(normalizedPins.map((pin) => pin.name).filter(Boolean))
        ]
        const orientationCount = new Set(
            normalizedPins.map((pin) => pin.orientation)
        ).size
        const allPassive = names.every((name) =>
            SchematicPinParser.#isPassivePinName(name)
        )
        const semanticNames = names.filter(
            (name) => !SchematicPinParser.#isPassivePinName(name)
        )
        const allNumberedPins =
            normalizedPins.length > 0 &&
            normalizedPins.every(
                (pin) =>
                    /^\d+$/.test(String(pin.designator || '').trim()) &&
                    (!pin.name || /^\d+$/.test(String(pin.name || '').trim()))
            )
        const ownerIndex = normalizedPins[0]?.ownerIndex || ''
        let labelMode = 'name-and-number'

        if (
            inferredSequentialDesignators ||
            SchematicPinParser.#isDenseTwoSidedHorizontal4850Family(
                normalizedPins
            )
        ) {
            labelMode = 'number-only'
        }

        if (allPassive && orientationCount > 2) {
            // Keep dense multi-side connector symbols whose contacts are only
            // identified by numbers; dropping them loses both pin numbers and
            // any power-port attachment geometry recovered from those pins.
            if (normalizedPins.length > 4 && !allNumberedPins) {
                return []
            }

            labelMode = 'number-only'
        }

        if (
            numericEndpointLabelOwners.has(ownerIndex) &&
            SchematicPinParser.#isTwoPinNumericEndpointGroup(normalizedPins)
        ) {
            labelMode = 'number-only'
        } else if (
            SchematicPinParser.#isCompactSinglePinMarkerGroup(
                normalizedPins,
                names
            )
        ) {
            labelMode = 'hidden'
        } else if (allPassive && normalizedPins.length <= 2) {
            labelMode = SchematicPinParser.#isCanonicalPassiveTwoPinGroup(
                normalizedPins
            )
                ? 'hidden'
                : 'number-only'
        } else if (
            ownerDrawnInternalPinOwners.has(ownerIndex) &&
            SchematicPinParser.#isCompactNumberedFetTerminalGroup(
                normalizedPins,
                semanticNames,
                orientationCount
            )
        ) {
            labelMode = 'number-only'
        } else if (
            SchematicPinParser.#isOwnerDrawnTerminalGlyphGroup(
                normalizedPins,
                semanticNames,
                orientationCount
            )
        ) {
            labelMode = 'hidden'
        } else if (
            ownerDrawnInternalPinOwners.has(ownerIndex) &&
            SchematicPinParser.#isCompactInternalTerminalGroup(
                normalizedPins,
                names,
                orientationCount
            )
        ) {
            labelMode = 'hidden'
        } else if (
            ownerDrawnInternalPinOwners.has(ownerIndex) &&
            SchematicPinParser.#isCompactTwoPinInternalTerminalGroup(
                normalizedPins,
                names,
                orientationCount
            )
        ) {
            labelMode = 'number-only'
        } else if (
            ownerDrawnInternalPinOwners.has(ownerIndex) &&
            SchematicPinParser.#isCompactCommonTerminalDiodeGroup(
                normalizedPins,
                names,
                orientationCount
            )
        ) {
            labelMode = 'number-only'
        } else if (!semanticNames.length && orientationCount <= 2) {
            labelMode = 'number-only'
        } else if (
            semanticNames.length >= Math.max(names.length - 1, 3) &&
            orientationCount <= 2 &&
            normalizedPins.length <= 4
        ) {
            labelMode = 'name-only'
        }

        return normalizedPins.map(({ conglomerate, ...pin }) => ({
            ...pin,
            color: pin.color || '#000000',
            labelColor: pin.labelColor || '#1f1f1f',
            labelMode
        }))
    }

    /**
     * Returns true when a single owner pin belongs to compact marker artwork
     * rather than to a visibly numbered electrical contact.
     * @param {{ designator: string, name: string, length: number, electrical?: number }[]} pins
     * @param {string[]} names
     * @returns {boolean}
     */
    static #isCompactSinglePinMarkerGroup(pins, names) {
        if (pins.length !== 1 || names.length !== 0) {
            return false
        }

        const pin = pins[0]
        const designator = String(pin.designator || '').trim()
        const length = Math.abs(Number(pin.length || 0))
        const electrical = Number(pin.electrical)

        return (
            /^\d+$/.test(designator) &&
            length > 0 &&
            length <= 15 &&
            (!Number.isFinite(electrical) || electrical === 4)
        )
    }

    /**
     * Returns true when a compact owner-drawn FET body uses semantic terminal
     * names internally but still exposes external numeric contact labels.
     * @param {{ designator: string, name: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {string[]} semanticNames
     * @param {number} orientationCount
     * @returns {boolean}
     */
    static #isCompactNumberedFetTerminalGroup(
        pins,
        semanticNames,
        orientationCount
    ) {
        if (
            pins.length !== 4 ||
            orientationCount < 3 ||
            semanticNames.length !== pins.length ||
            !pins.every((pin) => /^\d+$/.test(String(pin.designator || '')))
        ) {
            return false
        }

        return semanticNames.every((name) =>
            SchematicPinParser.#isFetTerminalName(name)
        )
    }

    /**
     * Returns true when a compact multi-side owner has transistor-like terminal
     * letters that are part of the drawn symbol body, not external pin labels.
     * @param {{ designator: string, name: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {string[]} semanticNames
     * @param {number} orientationCount
     * @returns {boolean}
     */
    static #isOwnerDrawnTerminalGlyphGroup(
        pins,
        semanticNames,
        orientationCount
    ) {
        if (
            pins.length < 3 ||
            pins.length > 4 ||
            orientationCount < 3 ||
            !SchematicPinParser.#hasOptionalNumericPinDesignators(pins)
        ) {
            return false
        }

        if (semanticNames.length !== pins.length) {
            return false
        }

        return semanticNames.every((name) =>
            SchematicPinParser.#isTransistorTerminalName(name)
        )
    }

    /**
     * Returns true when a compact owner-drawn body carries repeated internal
     * terminal names that belong to the symbol body, not external labels.
     * @param {{ designator: string, name: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {string[]} names
     * @param {number} orientationCount
     * @returns {boolean}
     */
    static #isCompactInternalTerminalGroup(pins, names, orientationCount) {
        if (
            pins.length < 3 ||
            pins.length > 4 ||
            orientationCount < 3 ||
            names.length >= pins.length ||
            !SchematicPinParser.#hasOptionalNumericPinDesignators(pins)
        ) {
            return false
        }

        return (
            names.length > 0 &&
            names.every((name) =>
                SchematicPinParser.#isInternalTerminalName(name)
            )
        )
    }

    /**
     * Returns true when a compact two-pin owner-drawn symbol stores internal
     * placeholder terminal names that should not be rendered as labels.
     * @param {{ designator: string, name: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {string[]} names
     * @param {number} orientationCount
     * @returns {boolean}
     */
    static #isCompactTwoPinInternalTerminalGroup(
        pins,
        names,
        orientationCount
    ) {
        if (
            pins.length !== 2 ||
            orientationCount < 2 ||
            names.length !== pins.length ||
            !SchematicPinParser.#hasOptionalNumericPinDesignators(pins)
        ) {
            return false
        }

        return names.every((name) =>
            SchematicPinParser.#isInternalTerminalName(name)
        )
    }

    /**
     * Returns true when a compact owner-drawn diode-like section exposes one
     * ordinary anode/cathode terminal and one common terminal name internally.
     * @param {{ designator: string, name: string, length: number, electrical?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {string[]} names
     * @param {number} orientationCount
     * @returns {boolean}
     */
    static #isCompactCommonTerminalDiodeGroup(pins, names, orientationCount) {
        if (
            pins.length !== 2 ||
            orientationCount !== 2 ||
            names.length !== pins.length ||
            !SchematicPinParser.#hasOptionalNumericPinDesignators(pins)
        ) {
            return false
        }

        if (
            pins.some((pin) => {
                const length = Math.abs(Number(pin.length || 0))
                const electrical = Number(pin.electrical)
                return (
                    length <= 0 ||
                    length > 15 ||
                    (Number.isFinite(electrical) && electrical !== 4)
                )
            })
        ) {
            return false
        }

        const hasDiodeTerminal = names.some((name) =>
            SchematicPinParser.#isDiodeTerminalName(name)
        )
        const hasCommonTerminal = names.some((name) =>
            SchematicPinParser.#isCommonDiodeTerminalName(name)
        )

        return hasDiodeTerminal && hasCommonTerminal
    }

    /**
     * Returns true when compact owner-drawn terminal glyph pins have either no
     * external designators or ordinary numeric pin numbers.
     * @param {{ designator: string }[]} pins
     * @returns {boolean}
     */
    static #hasOptionalNumericPinDesignators(pins) {
        return pins.every((pin) => {
            const designator = String(pin.designator || '').trim()
            return !designator || /^\d+$/.test(designator)
        })
    }

    /**
     * Returns true for one-letter terminal glyphs commonly drawn inside
     * transistor-style schematic symbols.
     * @param {string} name
     * @returns {boolean}
     */
    static #isTransistorTerminalName(name) {
        return /^[BCDEGS]$/i.test(String(name || '').trim())
    }

    /**
     * Returns true for FET terminal names, including numbered gate/source
     * variants used by dual-gate symbols.
     * @param {string} name
     * @returns {boolean}
     */
    static #isFetTerminalName(name) {
        return /^(?:[DS]|[GS]\d*)$/i.test(String(name || '').trim())
    }

    /**
     * Returns true for compact internal terminal labels usually drawn inside
     * owner-authored symbol bodies.
     * @param {string} name
     * @returns {boolean}
     */
    static #isInternalTerminalName(name) {
        return /^(x|y|gnd|agnd|dgnd|pgnd|vcc|vdd|vee|vss|nc)$/i.test(
            String(name || '').trim()
        )
    }

    /**
     * Returns true for one-letter terminals used inside diode-style symbols.
     * @param {string} name
     * @returns {boolean}
     */
    static #isDiodeTerminalName(name) {
        return /^[AKC]$/i.test(String(name || '').trim())
    }

    /**
     * Returns true for common-terminal names used by multipart diode symbols.
     * @param {string} name
     * @returns {boolean}
     */
    static #isCommonDiodeTerminalName(name) {
        return /^COM[AC]$/i.test(String(name || '').trim())
    }

    /**
     * Returns true when one passive two-pin symbol uses the ordinary 1/2 pin
     * numbering that should stay hidden for simple resistor-like parts.
     * @param {{ designator: string }[]} pins
     * @returns {boolean}
     */
    static #isCanonicalPassiveTwoPinGroup(pins) {
        if (pins.length !== 2) {
            return false
        }

        const designators = pins
            .map((pin) => String(pin.designator || '').trim())
            .sort((left, right) => Number(left) - Number(right))

        return designators[0] === '1' && designators[1] === '2'
    }

    /**
     * Returns true when one owner exposes exactly two numeric endpoints.
     * @param {{ designator: string, name: string }[]} pins
     * @returns {boolean}
     */
    static #isTwoPinNumericEndpointGroup(pins) {
        if (pins.length !== 2) {
            return false
        }

        return pins.every((pin) => {
            const designator = String(pin.designator || '').trim()
            const name = String(pin.name || '').trim()

            return /^\d+$/.test(designator) && (!name || /^\d+$/.test(name))
        })
    }

    /**
     * Returns true when one owner uses the dense two-sided horizontal 48/50
     * pin family whose semantic names belong to the owner-drawn symbol body
     * rather than to visible external pin labels.
     * @param {{ conglomerate?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {boolean}
     */
    static #isDenseTwoSidedHorizontal4850Family(pins) {
        if (pins.length < 6) {
            return false
        }

        if (
            pins.some(
                (pin) =>
                    pin.orientation !== 'left' && pin.orientation !== 'right'
            )
        ) {
            return false
        }

        const conglomerates = new Set(
            pins.map((pin) => Number(pin.conglomerate || 0))
        )

        return (
            conglomerates.size > 0 &&
            [...conglomerates].every(
                (conglomerate) => conglomerate === 48 || conglomerate === 50
            )
        )
    }

    /**
     * Removes duplicate pin records emitted for alternate display modes.
     * @param {{ x: number, y: number, length: number, conglomerate?: number, name: string, nameSegments?: { text: string, overline: boolean }[], designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number, color?: string, labelColor?: string, ownerIndex: string }[]} pins
     * @returns {{ x: number, y: number, length: number, conglomerate?: number, name: string, nameSegments?: { text: string, overline: boolean }[], designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number, color?: string, labelColor?: string, ownerIndex: string }[]}
     */
    static #dedupeSchematicPins(pins) {
        const seen = new Set()
        const deduped = []

        for (const pin of pins) {
            const key = [
                pin.ownerIndex,
                pin.x,
                pin.y,
                pin.length,
                pin.name,
                pin.designator,
                pin.orientation,
                pin.electrical,
                pin.symbolOuter || '',
                SchematicPinParser.#serializeSchematicPinNameSegments(
                    pin.nameSegments
                )
            ].join('::')

            if (seen.has(key)) continue

            seen.add(key)
            deduped.push(pin)
        }

        return deduped
    }

    /**
     * Decodes Altium backslash suffix markers into visible pin text and
     * overline runs for active-low labels.
     * @param {string} name
     * @returns {{ name: string, nameSegments?: { text: string, overline: boolean }[] }}
     */
    static #parseSchematicPinName(name) {
        const parsed = SchematicTextRunParser.parseOptionalOverlineRuns(name)

        return {
            name: parsed.text,
            nameSegments: parsed.segments
        }
    }

    /**
     * Serializes overline runs into a dedupe-safe signature.
     * @param {{ text: string, overline: boolean }[] | undefined} nameSegments
     * @returns {string}
     */
    static #serializeSchematicPinNameSegments(nameSegments) {
        return (nameSegments || [])
            .map(
                (segment) => (segment.overline ? '1' : '0') + ':' + segment.text
            )
            .join('|')
    }

    /**
     * Returns true when a pin name looks like a passive-symbol terminal.
     * @param {string} name
     * @returns {boolean}
     */
    static #isPassivePinName(name) {
        return /^(\d+|[AK])$/i.test(String(name || '').trim())
    }

    /**
     * Maps Altium pin conglomerate flags into a side orientation.
     * @param {number | null} conglomerate
     * @returns {'left' | 'right' | 'top' | 'bottom' | null}
     */
    static #inferSchematicPinOrientation(conglomerate) {
        switch (conglomerate) {
            case 34:
            case 42:
            case 50:
            case 58:
                return 'left'
            case 32:
            case 40:
            case 48:
            case 56:
                return 'right'
            case 33:
            case 49:
            case 57:
                return 'top'
            case 35:
            case 51:
            case 59:
                return 'bottom'
            default:
                return null
        }
    }
}
