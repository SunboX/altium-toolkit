// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Normalizes recovered schematic wire geometry after primitive parsing.
 */
export class SchematicWireNormalizer {
    static #MAX_COLLAPSED_PIN_SPAN = 60
    static #MAX_CALLOUT_LEADER_SPAN = 40
    static #CALLOUT_ARROWHEAD_SCALE = 1.25

    /**
     * Corrects standalone callout arrowhead triangles whose final coordinate
     * was carried from the previous point instead of reflected across the
     * leader direction.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number }[]} lines
     * @param {{ points: { x: number, y: number }[], isSolid?: boolean, transparent?: boolean, ownerIndex?: string, renderOrder?: number }[]} polygons
     * @returns {{ lines: { x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number }[], polygons: { points: { x: number, y: number }[], isSolid?: boolean, transparent?: boolean, ownerIndex?: string, renderOrder?: number }[] }}
     */
    static normalizeStandaloneCalloutArrowheads(lines, polygons) {
        const updates = []
        const normalizedPolygons = polygons.map((polygon) => {
            const normalizedPoints =
                SchematicWireNormalizer.#resolveStandaloneCalloutArrowheadPoints(
                    polygon,
                    lines
                )

            if (!normalizedPoints) {
                return polygon
            }

            updates.push({
                renderOrder: polygon.renderOrder,
                points: normalizedPoints
            })

            return {
                ...polygon,
                points: normalizedPoints
            }
        })

        return {
            lines: lines.map((line) =>
                SchematicWireNormalizer.#normalizeCalloutArrowheadOutlineLine(
                    line,
                    updates
                )
            ),
            polygons: normalizedPolygons
        }
    }

    /**
     * Extends collapsed final wire segments to nearby pin endpoints when an
     * omitted coordinate axis made the segment degenerate.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, omittedEndpointAxis?: 'x' | 'y' }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number }[]} [junctions]
     * @returns {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string }[]}
     */
    static extendCollapsedPolylineEndpoints(lines, pins, junctions = []) {
        const calloutLines =
            SchematicWireNormalizer.#restoreStandaloneCalloutLeaderEndpoints(
                lines
            )
        const crossedLines =
            SchematicWireNormalizer.#restoreCrossedPolylineEndpoints(
                calloutLines,
                pins
            )

        return crossedLines
            .map((line, index) => {
                const extension =
                    SchematicWireNormalizer.#resolveCollapsedEndpoint(
                        line,
                        index,
                        crossedLines,
                        pins,
                        junctions
                    )

                if (!extension) {
                    return line
                }

                return {
                    ...line,
                    x2: extension.x,
                    y2: extension.y
                }
            })
            .map((line) => SchematicWireNormalizer.#stripRecoveryMetadata(line))
    }

    /**
     * Restores the omitted endpoint axis on standalone dashed callout leaders
     * by snapping the leader endpoint to a nearby standalone dashed frame
     * corner.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number, omittedEndpointAxis?: 'x' | 'y' }[]} lines
     * @returns {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number, omittedEndpointAxis?: 'x' | 'y' }[]}
     */
    static #restoreStandaloneCalloutLeaderEndpoints(lines) {
        return lines.map((line, index) => {
            const endpoint =
                SchematicWireNormalizer.#resolveStandaloneCalloutLeaderEndpoint(
                    line,
                    index,
                    lines
                )

            if (!endpoint) {
                return line
            }

            return {
                ...line,
                x2: endpoint.x,
                y2: endpoint.y
            }
        })
    }

    /**
     * Resolves corrected points for one standalone callout arrowhead.
     * @param {{ points: { x: number, y: number }[], isSolid?: boolean, transparent?: boolean, ownerIndex?: string, renderOrder?: number }} polygon
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number }[]} lines
     * @returns {{ x: number, y: number }[] | null}
     */
    static #resolveStandaloneCalloutArrowheadPoints(polygon, lines) {
        if (!SchematicWireNormalizer.#isStandaloneArrowheadPolygon(polygon)) {
            return null
        }

        const [tip, firstBasePoint, carriedBasePoint] = polygon.points
        const leaderLine =
            SchematicWireNormalizer.#findStandaloneArrowheadLeaderLine(
                polygon,
                tip,
                lines
            )

        if (!leaderLine) {
            return null
        }

        const leaderEnd = SchematicWireNormalizer.#resolveOtherEndpoint(
            leaderLine,
            tip
        )
        if (!leaderEnd) {
            return null
        }

        const reflectedPoint = SchematicWireNormalizer.#reflectPointAcrossLine(
            firstBasePoint,
            tip,
            leaderEnd
        )
        const recoveredBasePoint =
            SchematicWireNormalizer.#resolveRecoveredArrowheadBasePoint(
                firstBasePoint,
                carriedBasePoint,
                reflectedPoint
            )

        if (!recoveredBasePoint) {
            return null
        }

        return SchematicWireNormalizer.#expandStandaloneArrowheadPoints(
            tip,
            firstBasePoint,
            recoveredBasePoint
        )
    }

    /**
     * Expands recovered standalone callout arrowheads from the raw truncated
     * polygon dimensions to Altium's rendered arrowhead size.
     * @param {{ x: number, y: number }} tip
     * @param {{ x: number, y: number }} firstBasePoint
     * @param {{ x: number, y: number }} secondBasePoint
     * @returns {{ x: number, y: number }[]}
     */
    static #expandStandaloneArrowheadPoints(
        tip,
        firstBasePoint,
        secondBasePoint
    ) {
        return [
            tip,
            SchematicWireNormalizer.#scalePointFromTip(
                tip,
                firstBasePoint,
                SchematicWireNormalizer.#CALLOUT_ARROWHEAD_SCALE
            ),
            SchematicWireNormalizer.#scalePointFromTip(
                tip,
                secondBasePoint,
                SchematicWireNormalizer.#CALLOUT_ARROWHEAD_SCALE
            )
        ]
    }

    /**
     * Scales one point away from an arrowhead tip.
     * @param {{ x: number, y: number }} tip
     * @param {{ x: number, y: number }} point
     * @param {number} scale
     * @returns {{ x: number, y: number }}
     */
    static #scalePointFromTip(tip, point, scale) {
        return {
            x: SchematicWireNormalizer.#normalizeRecoveredCoordinate(
                tip.x + (point.x - tip.x) * scale
            ),
            y: SchematicWireNormalizer.#normalizeRecoveredCoordinate(
                tip.y + (point.y - tip.y) * scale
            )
        }
    }

    /**
     * Returns true when a polygon has the standalone filled triangle shape used
     * by note callout arrowheads.
     * @param {{ points: { x: number, y: number }[], isSolid?: boolean, transparent?: boolean, ownerIndex?: string }} polygon
     * @returns {boolean}
     */
    static #isStandaloneArrowheadPolygon(polygon) {
        return (
            !polygon.ownerIndex &&
            polygon.isSolid === true &&
            polygon.transparent !== true &&
            polygon.points?.length === 3
        )
    }

    /**
     * Finds the diagonal dashed leader touching one arrowhead tip.
     * @param {{ renderOrder?: number }} polygon
     * @param {{ x: number, y: number }} tip
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number }[]} lines
     * @returns {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number } | null}
     */
    static #findStandaloneArrowheadLeaderLine(polygon, tip, lines) {
        const candidates = lines
            .filter(
                (line) =>
                    line.recordType === '6' &&
                    !line.ownerIndex &&
                    line.lineStyle === 1 &&
                    SchematicWireNormalizer.#isDiagonalLine(line) &&
                    SchematicWireNormalizer.#lineTouchesPoint(line, tip)
            )
            .map((line) => ({
                line,
                orderDistance: Math.abs(
                    Number(polygon.renderOrder || 0) -
                        Number(line.renderOrder || 0)
                )
            }))
            .filter(({ orderDistance }) => orderDistance <= 2)
            .sort((left, right) => left.orderDistance - right.orderDistance)

        return candidates[0]?.line || null
    }

    /**
     * Resolves the missing second base point from the reflected counterpart.
     * @param {{ x: number, y: number }} firstBasePoint
     * @param {{ x: number, y: number }} carriedBasePoint
     * @param {{ x: number, y: number }} reflectedPoint
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveRecoveredArrowheadBasePoint(
        firstBasePoint,
        carriedBasePoint,
        reflectedPoint
    ) {
        if (
            firstBasePoint.y === carriedBasePoint.y &&
            SchematicWireNormalizer.#nearlyEqual(
                reflectedPoint.x,
                carriedBasePoint.x
            )
        ) {
            return {
                x: carriedBasePoint.x,
                y: SchematicWireNormalizer.#normalizeRecoveredCoordinate(
                    reflectedPoint.y
                )
            }
        }

        if (
            firstBasePoint.x === carriedBasePoint.x &&
            SchematicWireNormalizer.#nearlyEqual(
                reflectedPoint.y,
                carriedBasePoint.y
            )
        ) {
            return {
                x: SchematicWireNormalizer.#normalizeRecoveredCoordinate(
                    reflectedPoint.x
                ),
                y: carriedBasePoint.y
            }
        }

        return null
    }

    /**
     * Mirrors one point across a leader axis.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }} lineStart
     * @param {{ x: number, y: number }} lineEnd
     * @returns {{ x: number, y: number }}
     */
    static #reflectPointAcrossLine(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x
        const dy = lineEnd.y - lineStart.y
        const lengthSquared = dx * dx + dy * dy

        if (lengthSquared <= 0) {
            return point
        }

        const projectionScale =
            ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
            lengthSquared
        const projection = {
            x: lineStart.x + projectionScale * dx,
            y: lineStart.y + projectionScale * dy
        }

        return {
            x: projection.x * 2 - point.x,
            y: projection.y * 2 - point.y
        }
    }

    /**
     * Updates one matching record-7 outline segment to the normalized arrowhead
     * points.
     * @param {{ x1: number, y1: number, x2: number, y2: number, recordType?: string, renderOrder?: number }} line
     * @param {{ renderOrder?: number, points: { x: number, y: number }[] }[]} updates
     * @returns {{ x1: number, y1: number, x2: number, y2: number, recordType?: string, renderOrder?: number }}
     */
    static #normalizeCalloutArrowheadOutlineLine(line, updates) {
        for (const update of updates) {
            const segmentIndex =
                SchematicWireNormalizer.#resolveArrowheadOutlineSegmentIndex(
                    line,
                    update.renderOrder
                )

            if (segmentIndex === null) {
                continue
            }

            const startPoint = update.points[segmentIndex]
            const endPoint = update.points[(segmentIndex + 1) % 3]

            return {
                ...line,
                x1: startPoint.x,
                y1: startPoint.y,
                x2: endPoint.x,
                y2: endPoint.y
            }
        }

        return line
    }

    /**
     * Resolves which outline segment a record-7 line belongs to.
     * @param {{ recordType?: string, renderOrder?: number }} line
     * @param {number | undefined} polygonRenderOrder
     * @returns {number | null}
     */
    static #resolveArrowheadOutlineSegmentIndex(line, polygonRenderOrder) {
        if (
            line.recordType !== '7' ||
            !Number.isFinite(line.renderOrder) ||
            !Number.isFinite(polygonRenderOrder)
        ) {
            return null
        }

        const segmentIndex = Math.round(
            (line.renderOrder - polygonRenderOrder) * 100
        )
        const expectedRenderOrder = polygonRenderOrder + segmentIndex / 100

        if (
            segmentIndex < 0 ||
            segmentIndex >= 3 ||
            !SchematicWireNormalizer.#nearlyEqual(
                line.renderOrder,
                expectedRenderOrder
            )
        ) {
            return null
        }

        return segmentIndex
    }

    /**
     * Resolves the nearby dashed frame endpoint for one callout leader.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number, omittedEndpointAxis?: 'x' | 'y' }} line
     * @param {number} index
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, lineStyle?: number, renderOrder?: number }[]} lines
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveStandaloneCalloutLeaderEndpoint(line, index, lines) {
        if (!SchematicWireNormalizer.#isStandaloneCalloutLeader(line)) {
            return null
        }

        const carriedEndpoint = { x: line.x2, y: line.y2 }
        const startPoint = { x: line.x1, y: line.y1 }
        const candidates = []

        for (
            let candidateIndex = 0;
            candidateIndex < lines.length;
            candidateIndex += 1
        ) {
            if (candidateIndex === index) {
                continue
            }

            const frameLine = lines[candidateIndex]
            if (
                !SchematicWireNormalizer.#isStandaloneCalloutFrameLine(
                    frameLine,
                    line
                )
            ) {
                continue
            }

            for (const framePoint of [
                { x: frameLine.x1, y: frameLine.y1 },
                { x: frameLine.x2, y: frameLine.y2 }
            ]) {
                const endpoint =
                    SchematicWireNormalizer.#buildCalloutLeaderEndpoint(
                        line,
                        carriedEndpoint,
                        framePoint
                    )

                if (
                    !endpoint ||
                    !SchematicWireNormalizer.#isDiagonalBetween(
                        startPoint,
                        endpoint
                    )
                ) {
                    continue
                }

                const distance = SchematicWireNormalizer.#axisDistance(
                    carriedEndpoint,
                    endpoint
                )
                if (
                    distance > SchematicWireNormalizer.#MAX_CALLOUT_LEADER_SPAN
                ) {
                    continue
                }

                candidates.push({
                    endpoint,
                    distance,
                    orderDistance: Math.abs(
                        Number(line.renderOrder || 0) -
                            Number(frameLine.renderOrder || 0)
                    )
                })
            }
        }

        candidates.sort(
            (left, right) =>
                left.distance - right.distance ||
                left.orderDistance - right.orderDistance
        )

        return candidates[0]?.endpoint || null
    }

    /**
     * Builds a recovered leader endpoint from one candidate frame point.
     * @param {{ omittedEndpointAxis?: 'x' | 'y' }} line
     * @param {{ x: number, y: number }} carriedEndpoint
     * @param {{ x: number, y: number }} framePoint
     * @returns {{ x: number, y: number } | null}
     */
    static #buildCalloutLeaderEndpoint(line, carriedEndpoint, framePoint) {
        if (
            line.omittedEndpointAxis === 'y' &&
            framePoint.x === carriedEndpoint.x &&
            framePoint.y !== carriedEndpoint.y
        ) {
            return { x: carriedEndpoint.x, y: framePoint.y }
        }

        if (
            line.omittedEndpointAxis === 'x' &&
            framePoint.y === carriedEndpoint.y &&
            framePoint.x !== carriedEndpoint.x
        ) {
            return { x: framePoint.x, y: carriedEndpoint.y }
        }

        return null
    }

    /**
     * Returns true when a record-6 line looks like an unowned dashed callout
     * leader whose endpoint carried an omitted coordinate.
     * @param {{ ownerIndex?: string, recordType?: string, lineStyle?: number, omittedEndpointAxis?: 'x' | 'y', sourceLocationCount?: number }} line
     * @returns {boolean}
     */
    static #isStandaloneCalloutLeader(line) {
        return (
            line.recordType === '6' &&
            !line.ownerIndex &&
            line.lineStyle === 1 &&
            line.sourceLocationCount === 2 &&
            Boolean(line.omittedEndpointAxis)
        )
    }

    /**
     * Returns true when one record-6 line can supply a dashed callout frame
     * corner for the candidate leader.
     * @param {{ ownerIndex?: string, recordType?: string, lineStyle?: number }} frameLine
     * @param {{ lineStyle?: number }} leaderLine
     * @returns {boolean}
     */
    static #isStandaloneCalloutFrameLine(frameLine, leaderLine) {
        return (
            frameLine.recordType === '6' &&
            !frameLine.ownerIndex &&
            frameLine.lineStyle === leaderLine.lineStyle &&
            !SchematicWireNormalizer.#isCollapsedLine(frameLine)
        )
    }

    /**
     * Restores a carried final axis when paired diagonal wire legs prove the
     * endpoint should land on a neighboring pin instead of flattening.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, omittedEndpointAxis?: 'x' | 'y' }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, omittedEndpointAxis?: 'x' | 'y' }[]}
     */
    static #restoreCrossedPolylineEndpoints(lines, pins) {
        const pinEndpoints = pins.map((pin) =>
            SchematicWireNormalizer.#projectPinEndpoint(pin)
        )

        return lines.map((line, index) => {
            const startPoint =
                SchematicWireNormalizer.#resolveCrossedPolylineEndpoint(
                    line,
                    index,
                    lines,
                    pinEndpoints,
                    'start'
                )

            if (startPoint) {
                return { ...line, x1: startPoint.x, y1: startPoint.y }
            }

            const endPoint =
                SchematicWireNormalizer.#resolveCrossedPolylineEndpoint(
                    line,
                    index,
                    lines,
                    pinEndpoints,
                    'end'
                )

            if (endPoint) {
                return { ...line, x2: endPoint.x, y2: endPoint.y }
            }

            return line
        })
    }

    /**
     * Resolves one endpoint of a flattened crossed-wire segment.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, omittedEndpointAxis?: 'x' | 'y' }} line
     * @param {number} index
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string }[]} lines
     * @param {{ x: number, y: number }[]} pinEndpoints
     * @param {'start' | 'end'} terminal
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveCrossedPolylineEndpoint(
        line,
        index,
        lines,
        pinEndpoints,
        terminal
    ) {
        if (
            !SchematicWireNormalizer.#isUnownedWire(line) ||
            !line.omittedEndpointAxis ||
            SchematicWireNormalizer.#isCollapsedLine(line)
        ) {
            return null
        }

        const axis = SchematicWireNormalizer.#resolveLineAxis(line)

        if (!axis) {
            return null
        }

        const carriedPoint =
            terminal === 'start'
                ? { x: line.x1, y: line.y1 }
                : { x: line.x2, y: line.y2 }
        const fixedPoint =
            terminal === 'start'
                ? { x: line.x2, y: line.y2 }
                : { x: line.x1, y: line.y1 }

        for (
            let candidateIndex = 0;
            candidateIndex < lines.length;
            candidateIndex += 1
        ) {
            if (candidateIndex === index) {
                continue
            }

            const diagonalLine = lines[candidateIndex]

            if (
                !SchematicWireNormalizer.#isUnownedWire(diagonalLine) ||
                !SchematicWireNormalizer.#isDiagonalLine(diagonalLine)
            ) {
                continue
            }

            const diagonalPoint = SchematicWireNormalizer.#resolveOtherEndpoint(
                diagonalLine,
                carriedPoint
            )

            if (!diagonalPoint) {
                continue
            }

            const recoveredPoint =
                axis === 'horizontal'
                    ? { x: carriedPoint.x, y: diagonalPoint.y }
                    : { x: diagonalPoint.x, y: carriedPoint.y }

            if (
                SchematicWireNormalizer.#pointsEqual(
                    recoveredPoint,
                    carriedPoint
                ) ||
                !SchematicWireNormalizer.#isDiagonalBetween(
                    fixedPoint,
                    recoveredPoint
                ) ||
                !SchematicWireNormalizer.#hasPoint(pinEndpoints, recoveredPoint)
            ) {
                continue
            }

            return recoveredPoint
        }

        return null
    }

    /**
     * Resolves the endpoint for one collapsed wire segment.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string, omittedEndpointAxis?: 'x' | 'y' }} line
     * @param {number} index
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number }[]} junctions
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveCollapsedEndpoint(line, index, lines, pins, junctions) {
        if (!SchematicWireNormalizer.#isCollapsedWire(line)) {
            return null
        }

        const previousLine = lines[index - 1]
        const sourcePoint = { x: line.x1, y: line.y1 }

        if (
            !previousLine ||
            SchematicWireNormalizer.#isCollapsedLine(previousLine) ||
            !SchematicWireNormalizer.#lineTouchesPoint(
                previousLine,
                sourcePoint
            )
        ) {
            return null
        }

        const fallbackAxis =
            SchematicWireNormalizer.#resolvePerpendicularAxis(previousLine)
        const axes = line.omittedEndpointAxis
            ? [line.omittedEndpointAxis]
            : fallbackAxis
              ? [fallbackAxis]
              : ['x', 'y']

        return SchematicWireNormalizer.#findNearestContinuationPoint(
            sourcePoint,
            axes,
            pins,
            lines,
            index,
            junctions
        )
    }

    /**
     * Returns true when a line is an unowned collapsed wire primitive.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string }} line
     * @returns {boolean}
     */
    static #isCollapsedWire(line) {
        return (
            SchematicWireNormalizer.#isUnownedWire(line) &&
            SchematicWireNormalizer.#isCollapsedLine(line)
        )
    }

    /**
     * Removes parser-only recovery hints before returning renderer lines.
     * @param {{ x1: number, y1: number, x2: number, y2: number, omittedEndpointAxis?: 'x' | 'y', sourceLocationCount?: number, [key: string]: unknown }} line
     * @returns {{ x1: number, y1: number, x2: number, y2: number, [key: string]: unknown }}
     */
    static #stripRecoveryMetadata(line) {
        const { omittedEndpointAxis, sourceLocationCount, ...rendererLine } =
            line
        return rendererLine
    }

    /**
     * Returns true when a line is an unowned schematic wire primitive.
     * @param {{ ownerIndex?: string, recordType?: string }} line
     * @returns {boolean}
     */
    static #isUnownedWire(line) {
        return line.recordType === '27' && !line.ownerIndex
    }

    /**
     * Returns true when a line has no drawable length.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @returns {boolean}
     */
    static #isCollapsedLine(line) {
        return line.x1 === line.x2 && line.y1 === line.y2
    }

    /**
     * Resolves the missing axis from the preceding segment orientation.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @returns {'x' | 'y' | null}
     */
    static #resolvePerpendicularAxis(line) {
        if (line.y1 === line.y2 && line.x1 !== line.x2) {
            return 'y'
        }

        if (line.x1 === line.x2 && line.y1 !== line.y2) {
            return 'x'
        }

        return null
    }

    /**
     * Resolves whether a line is horizontal or vertical.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @returns {'horizontal' | 'vertical' | null}
     */
    static #resolveLineAxis(line) {
        if (line.y1 === line.y2 && line.x1 !== line.x2) {
            return 'horizontal'
        }

        if (line.x1 === line.x2 && line.y1 !== line.y2) {
            return 'vertical'
        }

        return null
    }

    /**
     * Returns true when a line has both axes changing.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @returns {boolean}
     */
    static #isDiagonalLine(line) {
        return line.x1 !== line.x2 && line.y1 !== line.y2
    }

    /**
     * Finds the nearest aligned continuation for a collapsed segment point.
     * @param {{ x: number, y: number }} sourcePoint
     * @param {('x' | 'y')[]} axes
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string }[]} lines
     * @param {number} currentIndex
     * @param {{ x: number, y: number }[]} junctions
     * @returns {{ x: number, y: number } | null}
     */
    static #findNearestContinuationPoint(
        sourcePoint,
        axes,
        pins,
        lines,
        currentIndex,
        junctions
    ) {
        const junctionCandidates =
            SchematicWireNormalizer.#collectAlignedJunctionCandidates(
                sourcePoint,
                axes,
                junctions
            )
        const pinCandidates = pins
            .map((pin) => SchematicWireNormalizer.#projectPinEndpoint(pin))
            .filter((endpoint) =>
                SchematicWireNormalizer.#isAlignedWithAnyAxis(
                    sourcePoint,
                    endpoint,
                    axes
                )
            )
            .map((endpoint) => ({
                ...SchematicWireNormalizer.#buildCandidate(
                    sourcePoint,
                    endpoint
                ),
                priority: 1
            }))
            .filter(({ distance }) =>
                SchematicWireNormalizer.#isRecoverableDistance(distance)
            )

        const lineCandidates =
            SchematicWireNormalizer.#collectAlignedLineCandidates(
                sourcePoint,
                axes,
                lines,
                currentIndex
            )

        const candidates = [
            ...junctionCandidates,
            ...pinCandidates,
            ...lineCandidates
        ].sort(
            (left, right) =>
                left.priority - right.priority || left.distance - right.distance
        )

        return candidates[0]?.endpoint || null
    }

    /**
     * Collects authored junctions aligned with the missing endpoint axis.
     * @param {{ x: number, y: number }} sourcePoint
     * @param {('x' | 'y')[]} axes
     * @param {{ x: number, y: number }[]} junctions
     * @returns {{ endpoint: { x: number, y: number }, distance: number, priority: number }[]}
     */
    static #collectAlignedJunctionCandidates(sourcePoint, axes, junctions) {
        return junctions
            .filter((junction) =>
                SchematicWireNormalizer.#isAlignedWithAnyAxis(
                    sourcePoint,
                    junction,
                    axes
                )
            )
            .map((junction) => ({
                ...SchematicWireNormalizer.#buildCandidate(
                    sourcePoint,
                    junction
                ),
                priority: 0
            }))
            .filter(({ distance }) =>
                SchematicWireNormalizer.#isRecoverableDistance(distance)
            )
    }

    /**
     * Collects nearby same-axis wire continuations for a collapsed point.
     * @param {{ x: number, y: number }} sourcePoint
     * @param {('x' | 'y')[]} axes
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, recordType?: string }[]} lines
     * @param {number} currentIndex
     * @returns {{ endpoint: { x: number, y: number }, distance: number, priority: number }[]}
     */
    static #collectAlignedLineCandidates(
        sourcePoint,
        axes,
        lines,
        currentIndex
    ) {
        const candidates = []

        for (let index = 0; index < lines.length; index += 1) {
            if (index === currentIndex) {
                continue
            }

            const line = lines[index]

            if (
                !SchematicWireNormalizer.#isUnownedWire(line) ||
                SchematicWireNormalizer.#isCollapsedLine(line)
            ) {
                continue
            }

            if (
                axes.includes('y') &&
                line.y1 === line.y2 &&
                SchematicWireNormalizer.#between(
                    sourcePoint.x,
                    line.x1,
                    line.x2
                )
            ) {
                candidates.push({
                    ...SchematicWireNormalizer.#buildCandidate(sourcePoint, {
                        x: sourcePoint.x,
                        y: line.y1
                    }),
                    priority: 1
                })
            }

            if (
                axes.includes('x') &&
                line.x1 === line.x2 &&
                SchematicWireNormalizer.#between(
                    sourcePoint.y,
                    line.y1,
                    line.y2
                )
            ) {
                candidates.push({
                    ...SchematicWireNormalizer.#buildCandidate(sourcePoint, {
                        x: line.x1,
                        y: sourcePoint.y
                    }),
                    priority: 1
                })
            }
        }

        return candidates.filter(({ distance }) =>
            SchematicWireNormalizer.#isRecoverableDistance(distance)
        )
    }

    /**
     * Returns a distance-scored continuation candidate.
     * @param {{ x: number, y: number }} sourcePoint
     * @param {{ x: number, y: number }} endpoint
     * @returns {{ endpoint: { x: number, y: number }, distance: number }}
     */
    static #buildCandidate(sourcePoint, endpoint) {
        return {
            endpoint,
            distance: SchematicWireNormalizer.#axisDistance(
                sourcePoint,
                endpoint
            )
        }
    }

    /**
     * Returns true when a point lies on any requested missing axis.
     * @param {{ x: number, y: number }} sourcePoint
     * @param {{ x: number, y: number }} endpoint
     * @param {('x' | 'y')[]} axes
     * @returns {boolean}
     */
    static #isAlignedWithAnyAxis(sourcePoint, endpoint, axes) {
        return axes.some((axis) =>
            axis === 'y'
                ? endpoint.x === sourcePoint.x
                : endpoint.y === sourcePoint.y
        )
    }

    /**
     * Returns true when a recovery distance is useful and bounded.
     * @param {number} distance
     * @returns {boolean}
     */
    static #isRecoverableDistance(distance) {
        return (
            distance > 0 &&
            distance <= SchematicWireNormalizer.#MAX_COLLAPSED_PIN_SPAN
        )
    }

    /**
     * Returns the Manhattan distance for axis-aligned endpoint recovery.
     * @param {{ x: number, y: number }} sourcePoint
     * @param {{ x: number, y: number }} endpoint
     * @returns {number}
     */
    static #axisDistance(sourcePoint, endpoint) {
        return (
            Math.abs(sourcePoint.x - endpoint.x) +
            Math.abs(sourcePoint.y - endpoint.y)
        )
    }

    /**
     * Returns true when one line touches a point at either endpoint.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #lineTouchesPoint(line, point) {
        return (
            (line.x1 === point.x && line.y1 === point.y) ||
            (line.x2 === point.x && line.y2 === point.y)
        )
    }

    /**
     * Returns the opposite endpoint if a line touches the requested point.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ x: number, y: number }} point
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveOtherEndpoint(line, point) {
        if (line.x1 === point.x && line.y1 === point.y) {
            return { x: line.x2, y: line.y2 }
        }

        if (line.x2 === point.x && line.y2 === point.y) {
            return { x: line.x1, y: line.y1 }
        }

        return null
    }

    /**
     * Returns true when two points share the same coordinates.
     * @param {{ x: number, y: number }} left
     * @param {{ x: number, y: number }} right
     * @returns {boolean}
     */
    static #pointsEqual(left, right) {
        return left.x === right.x && left.y === right.y
    }

    /**
     * Returns true when two coordinates are equivalent within parser rounding
     * tolerance.
     * @param {number} left
     * @param {number} right
     * @returns {boolean}
     */
    static #nearlyEqual(left, right) {
        return Math.abs(left - right) <= 1e-6
    }

    /**
     * Stabilizes recovered floating-point coordinates.
     * @param {number} value
     * @returns {number}
     */
    static #normalizeRecoveredCoordinate(value) {
        const rounded = Math.round(value)

        if (SchematicWireNormalizer.#nearlyEqual(value, rounded)) {
            return rounded
        }

        return Number(value.toFixed(3))
    }

    /**
     * Returns true when a list contains one point.
     * @param {{ x: number, y: number }[]} points
     * @param {{ x: number, y: number }} target
     * @returns {boolean}
     */
    static #hasPoint(points, target) {
        return points.some((point) =>
            SchematicWireNormalizer.#pointsEqual(point, target)
        )
    }

    /**
     * Returns true when two points form a diagonal segment.
     * @param {{ x: number, y: number }} left
     * @param {{ x: number, y: number }} right
     * @returns {boolean}
     */
    static #isDiagonalBetween(left, right) {
        return left.x !== right.x && left.y !== right.y
    }

    /**
     * Returns true when a value lies inside an unordered inclusive range.
     * @param {number} value
     * @param {number} left
     * @param {number} right
     * @returns {boolean}
     */
    static #between(value, left, right) {
        return value >= Math.min(left, right) && value <= Math.max(left, right)
    }

    /**
     * Projects one pin into its wire-connected endpoint.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ x: number, y: number }}
     */
    static #projectPinEndpoint(pin) {
        switch (pin.orientation) {
            case 'right':
                return { x: pin.x + pin.length, y: pin.y }
            case 'top':
                return { x: pin.x, y: pin.y + pin.length }
            case 'bottom':
                return { x: pin.x, y: pin.y - pin.length }
            case 'left':
            default:
                return { x: pin.x - pin.length, y: pin.y }
        }
    }
}
