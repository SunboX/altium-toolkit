import { ParserUtils } from './ParserUtils.mjs'

const {
    getField,
    parseBoolean,
    parseNumericField,
    parseNumericFieldWithFraction,
    toColor
} = ParserUtils

/**
 * Normalizes schematic drawing primitives that are not plain line segments.
 */
export class SchematicPrimitiveParser {
    /**
     * Returns true when one record belongs to the rectangle primitive family.
     * Some record-225 frames store only `Location`/`Corner` in printable runs.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static isRectangleRecord(fields) {
        const recordType = getField(fields, 'RECORD')

        return (
            recordType === '14' ||
            recordType === '225' ||
            SchematicPrimitiveParser.isListedRectangleRecord(fields)
        )
    }

    /**
     * Returns true when one point-listed primitive describes an axis-aligned
     * rectangle instead of an arbitrary polyline.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static isListedRectangleRecord(fields) {
        const locationX = parseNumericField(fields, 'Location.X')
        const locationY = parseNumericField(fields, 'Location.Y')
        const cornerX = parseNumericField(fields, 'Corner.X')
        const cornerY = parseNumericField(fields, 'Corner.Y')
        const points = SchematicPrimitiveParser.#collectPolygonPoints(fields)

        if (
            locationX === null ||
            locationY === null ||
            cornerX === null ||
            cornerY === null ||
            points.length !== 4
        ) {
            return false
        }

        const xs = [...new Set(points.map((point) => point.x))]
        const ys = [...new Set(points.map((point) => point.y))]

        if (xs.length !== 2 || ys.length !== 2) {
            return false
        }

        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const corners = new Set([
            minX + ':' + minY,
            minX + ':' + maxY,
            maxX + ':' + minY,
            maxX + ':' + maxY
        ])

        return (
            corners.has(locationX + ':' + locationY) &&
            corners.has(cornerX + ':' + cornerY) &&
            points.every((point) => corners.has(point.x + ':' + point.y))
        )
    }

    /**
     * Normalizes record-7 polygon primitives into fill-capable polygons.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ points: { x: number, y: number }[], color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string }[]}
     */
    static parseSchematicPolygons(records) {
        return records
            .map((record, index) => {
                const points = SchematicPrimitiveParser.#collectPolygonPoints(
                    record.fields
                )

                if (points.length < 2) {
                    return null
                }

                return {
                    points,
                    color: toColor(record.fields.Color, '#a44a1b'),
                    fill: toColor(record.fields.AreaColor, '#ffe16f'),
                    isSolid: parseBoolean(record.fields.IsSolid),
                    transparent: parseBoolean(record.fields.Transparent),
                    lineWidth:
                        parseNumericField(record.fields, 'LineWidth') || 1,
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    ),
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Normalizes record-14 body primitives into drawable rectangles.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, lineStyle: number, ownerIndex?: string }[]}
     */
    static parseSchematicRectangles(records) {
        return records
            .map((record, index) => {
                const x1 = parseNumericField(record.fields, 'Location.X')
                const y1 = parseNumericField(record.fields, 'Location.Y')
                const x2 = parseNumericField(record.fields, 'Corner.X')
                const y2 = parseNumericField(record.fields, 'Corner.Y')
                const isRectangleRecord =
                    SchematicPrimitiveParser.isRectangleRecord(record.fields)
                const isListedRectangle =
                    SchematicPrimitiveParser.isListedRectangleRecord(
                        record.fields
                    )
                const usesFrameFallback =
                    SchematicPrimitiveParser.#shouldUseFrameFallback(
                        record.fields,
                        isListedRectangle
                    )
                const recordType = getField(record.fields, 'RECORD')

                if (x1 === null || y1 === null || x2 === null || y2 === null) {
                    return null
                }

                return {
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x2 - x1),
                    height: Math.abs(y2 - y1),
                    color: usesFrameFallback
                        ? '#ff0000'
                        : toColor(
                              record.fields.Color,
                              recordType === '225' ? '#ff0000' : '#a44a1b'
                          ),
                    fill: usesFrameFallback
                        ? '#ffffff'
                        : toColor(
                              record.fields.AreaColor,
                              recordType === '225' ? '#ffffff' : '#ffe16f'
                          ),
                    isSolid:
                        parseBoolean(record.fields.IsSolid) ||
                        usesFrameFallback ||
                        SchematicPrimitiveParser.#hasImplicitAreaFill(
                            record.fields,
                            isRectangleRecord
                        ),
                    transparent: usesFrameFallback
                        ? false
                        : parseBoolean(record.fields.Transparent),
                    lineWidth:
                        parseNumericField(record.fields, 'LineWidth') || 1,
                    lineStyle: usesFrameFallback
                        ? 1
                        : parseNumericField(record.fields, 'LineStyle') || 0,
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    ),
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Infers paint order for solid owner body rectangles whose printable
     * record lost IndexInSheet. Those bodies should stay behind their owner's
     * indexed contact/detail primitives rather than inheriting unrelated
     * global rectangle-list offsets from elsewhere on the sheet.
     * @param {{ fields: Record<string, string | string[]> }[]} rectangleRecords
     * @param {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, lineStyle: number, renderOrder: number, ownerIndex?: string }[]} rectangles
     * @param {{ x1: number, y1: number, x2: number, y2: number, renderOrder?: number, ownerIndex?: string }[]} lines
     * @param {{ points: { x: number, y: number }[], renderOrder?: number, ownerIndex?: string }[]} polygons
     * @param {{ x: number, y: number, radiusX: number, radiusY: number, renderOrder?: number, ownerIndex?: string }[]} ellipses
     * @param {{ x: number, y: number, radius: number, radiusY?: number, renderOrder?: number, ownerIndex?: string }[]} arcs
     * @returns {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, lineStyle: number, renderOrder: number, ownerIndex?: string }[]}
     */
    static inferMissingOwnerRectangleRenderOrders(
        rectangleRecords,
        rectangles,
        lines,
        polygons,
        ellipses,
        arcs
    ) {
        const rectangleMetaQueues =
            SchematicPrimitiveParser.#buildRectangleRecordMetaQueues(
                rectangleRecords
            )
        const normalizedRectangles = rectangles.map((rectangle) => ({
            rectangle,
            hasExplicitOrder:
                SchematicPrimitiveParser.#shiftRectangleMeta(
                    rectangleMetaQueues,
                    rectangle
                )?.hasExplicitOrder || false
        }))
        const ownerGeometryItems =
            SchematicPrimitiveParser.#buildOwnerGeometryItems(
                normalizedRectangles,
                lines,
                polygons,
                ellipses,
                arcs
            )

        return normalizedRectangles.map(({ rectangle, hasExplicitOrder }) => {
            if (
                hasExplicitOrder ||
                !rectangle.ownerIndex ||
                rectangle.isSolid !== true
            ) {
                return rectangle
            }

            const inferredRenderOrder =
                SchematicPrimitiveParser.#inferMissingOwnerRectangleRenderOrder(
                    rectangle,
                    ownerGeometryItems.get(String(rectangle.ownerIndex)) || []
                )

            if (inferredRenderOrder === null) {
                return rectangle
            }

            return {
                ...rectangle,
                renderOrder: inferredRenderOrder
            }
        })
    }

    /**
     * Normalizes authored sheet overlay regions into rectangular overlays.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, width: number, height: number, color: string, fill: string, renderOrder: number }[]}
     */
    static parseSchematicRegions(records) {
        return records
            .map((record, index) => {
                const x1 = parseNumericField(record.fields, 'Location.X')
                const y1 = parseNumericField(record.fields, 'Location.Y')
                const x2 = parseNumericField(record.fields, 'Corner.X')
                const y2 = parseNumericField(record.fields, 'Corner.Y')

                if (x1 === null || y1 === null || x2 === null || y2 === null) {
                    return null
                }

                return {
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x2 - x1),
                    height: Math.abs(y2 - y1),
                    color: toColor(record.fields.Color, '#ff0000'),
                    fill: toColor(record.fields.AreaColor, '#ffffcf'),
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    )
                }
            })
            .filter(Boolean)
    }

    /**
     * Normalizes record-11/12 curve primitives into drawable arcs.
     * Record 11 carries an optional secondary radius for ellipse segments.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, radius: number, radiusY?: number, startAngle: number, endAngle: number, color: string, width: number, ownerIndex?: string }[]}
     */
    static parseSchematicArcs(records) {
        return records
            .map((record, index) => {
                const x = parseNumericFieldWithFraction(
                    record.fields,
                    'Location.X'
                )
                const y = parseNumericFieldWithFraction(
                    record.fields,
                    'Location.Y'
                )
                const radius = parseNumericFieldWithFraction(
                    record.fields,
                    'Radius'
                )
                const radiusY = parseNumericFieldWithFraction(
                    record.fields,
                    'SecondaryRadius'
                )
                const startAngle = parseNumericField(
                    record.fields,
                    'StartAngle'
                )
                const endAngle = parseNumericField(record.fields, 'EndAngle')
                const normalizedRadiusY = radiusY === null ? radius : radiusY

                if (
                    x === null ||
                    y === null ||
                    radius === null ||
                    radius <= 0 ||
                    normalizedRadiusY === null ||
                    normalizedRadiusY <= 0
                ) {
                    return null
                }

                return {
                    x,
                    y,
                    radius,
                    ...(getField(record.fields, 'RECORD') === '11'
                        ? { radiusY: normalizedRadiusY }
                        : {}),
                    startAngle: startAngle === null ? 0 : startAngle,
                    endAngle: endAngle === null ? 360 : endAngle,
                    color: toColor(record.fields.Color, '#a44a1b'),
                    width: parseNumericField(record.fields, 'LineWidth') || 1,
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    ),
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Normalizes record-8 ellipse primitives into drawable outlines.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, radiusX: number, radiusY: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string }[]}
     */
    static parseSchematicEllipses(records) {
        return records
            .map((record, index) => {
                const x = parseNumericFieldWithFraction(
                    record.fields,
                    'Location.X'
                )
                const y = parseNumericFieldWithFraction(
                    record.fields,
                    'Location.Y'
                )
                const radiusX = parseNumericFieldWithFraction(
                    record.fields,
                    'Radius'
                )
                const radiusY = parseNumericFieldWithFraction(
                    record.fields,
                    'SecondaryRadius'
                )

                if (
                    x === null ||
                    y === null ||
                    radiusX === null ||
                    radiusX <= 0 ||
                    radiusY === null ||
                    radiusY <= 0
                ) {
                    return null
                }

                return {
                    x,
                    y,
                    radiusX,
                    radiusY,
                    color: toColor(record.fields.Color, '#a44a1b'),
                    fill: toColor(record.fields.AreaColor, '#ffffff'),
                    isSolid: parseBoolean(record.fields.IsSolid),
                    transparent: parseBoolean(record.fields.Transparent),
                    lineWidth:
                        parseNumericField(record.fields, 'LineWidth') || 1,
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    ),
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Resolves one stable render-order key from Altium sheet order metadata.
     * @param {Record<string, string | string[]>} fields
     * @param {number} fallbackOrder
     * @returns {number}
     */
    static #resolveRenderOrder(fields, fallbackOrder) {
        const indexInSheet = parseNumericField(fields, 'IndexInSheet')

        if (indexInSheet !== null) {
            return indexInSheet
        }

        return fallbackOrder
    }

    /**
     * Builds one stable geometry-key queue for rectangle source metadata.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Map<string, { hasExplicitOrder: boolean }[]>}
     */
    static #buildRectangleRecordMetaQueues(records) {
        const queues = new Map()

        for (const record of records) {
            const x1 = parseNumericField(record.fields, 'Location.X')
            const y1 = parseNumericField(record.fields, 'Location.Y')
            const x2 = parseNumericField(record.fields, 'Corner.X')
            const y2 = parseNumericField(record.fields, 'Corner.Y')

            if (x1 === null || y1 === null || x2 === null || y2 === null) {
                continue
            }

            const key = SchematicPrimitiveParser.#buildRectangleGeometryKey({
                ownerIndex: getField(record.fields, 'OwnerIndex') || undefined,
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1)
            })

            if (!queues.has(key)) {
                queues.set(key, [])
            }

            queues.get(key).push({
                hasExplicitOrder:
                    parseNumericField(record.fields, 'IndexInSheet') !== null
            })
        }

        return queues
    }

    /**
     * Consumes one rectangle source-metadata queue entry for a normalized body.
     * @param {Map<string, { hasExplicitOrder: boolean }[]>} queues
     * @param {{ ownerIndex?: string, x: number, y: number, width: number, height: number }} rectangle
     * @returns {{ hasExplicitOrder: boolean } | null}
     */
    static #shiftRectangleMeta(queues, rectangle) {
        const key =
            SchematicPrimitiveParser.#buildRectangleGeometryKey(rectangle)
        const queue = queues.get(key)

        if (!queue?.length) {
            return null
        }

        return queue.shift() || null
    }

    /**
     * Builds one geometry key that stays stable across raw and normalized
     * rectangle representations.
     * @param {{ ownerIndex?: string, x: number, y: number, width: number, height: number }} rectangle
     * @returns {string}
     */
    static #buildRectangleGeometryKey(rectangle) {
        return [
            String(rectangle.ownerIndex || ''),
            Number(rectangle.x),
            Number(rectangle.y),
            Number(rectangle.width),
            Number(rectangle.height)
        ].join(':')
    }

    /**
     * Collects owner-geometry bounds that can help infer one missing owner
     * body render order.
     * @param {{ rectangle: { ownerIndex?: string, x: number, y: number, width: number, height: number, renderOrder: number }, hasExplicitOrder: boolean }[]} rectangles
     * @param {{ x1: number, y1: number, x2: number, y2: number, renderOrder?: number, ownerIndex?: string }[]} lines
     * @param {{ points: { x: number, y: number }[], renderOrder?: number, ownerIndex?: string }[]} polygons
     * @param {{ x: number, y: number, radiusX: number, radiusY: number, renderOrder?: number, ownerIndex?: string }[]} ellipses
     * @param {{ x: number, y: number, radius: number, radiusY?: number, renderOrder?: number, ownerIndex?: string }[]} arcs
     * @returns {Map<string, { renderOrder: number, minX: number, maxX: number, minY: number, maxY: number }[]>}
     */
    static #buildOwnerGeometryItems(
        rectangles,
        lines,
        polygons,
        ellipses,
        arcs
    ) {
        const ownerItems = new Map()

        for (const { rectangle, hasExplicitOrder } of rectangles) {
            if (!rectangle.ownerIndex || !hasExplicitOrder) {
                continue
            }

            SchematicPrimitiveParser.#pushOwnerGeometryItem(ownerItems, {
                ownerIndex: String(rectangle.ownerIndex),
                renderOrder: Number(rectangle.renderOrder),
                minX: rectangle.x,
                maxX: rectangle.x + rectangle.width,
                minY: rectangle.y,
                maxY: rectangle.y + rectangle.height
            })
        }

        for (const line of lines) {
            if (!line.ownerIndex) {
                continue
            }

            SchematicPrimitiveParser.#pushOwnerGeometryItem(ownerItems, {
                ownerIndex: String(line.ownerIndex),
                renderOrder: Number(line.renderOrder),
                minX: Math.min(Number(line.x1), Number(line.x2)),
                maxX: Math.max(Number(line.x1), Number(line.x2)),
                minY: Math.min(Number(line.y1), Number(line.y2)),
                maxY: Math.max(Number(line.y1), Number(line.y2))
            })
        }

        for (const polygon of polygons) {
            if (!polygon.ownerIndex || !polygon.points?.length) {
                continue
            }

            const xs = polygon.points.map((point) => Number(point.x))
            const ys = polygon.points.map((point) => Number(point.y))

            SchematicPrimitiveParser.#pushOwnerGeometryItem(ownerItems, {
                ownerIndex: String(polygon.ownerIndex),
                renderOrder: Number(polygon.renderOrder),
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys)
            })
        }

        for (const ellipse of ellipses) {
            if (!ellipse.ownerIndex) {
                continue
            }

            SchematicPrimitiveParser.#pushOwnerGeometryItem(ownerItems, {
                ownerIndex: String(ellipse.ownerIndex),
                renderOrder: Number(ellipse.renderOrder),
                minX: Number(ellipse.x) - Number(ellipse.radiusX),
                maxX: Number(ellipse.x) + Number(ellipse.radiusX),
                minY: Number(ellipse.y) - Number(ellipse.radiusY),
                maxY: Number(ellipse.y) + Number(ellipse.radiusY)
            })
        }

        for (const arc of arcs) {
            if (!arc.ownerIndex) {
                continue
            }

            const radiusY = Number(arc.radiusY || arc.radius)

            SchematicPrimitiveParser.#pushOwnerGeometryItem(ownerItems, {
                ownerIndex: String(arc.ownerIndex),
                renderOrder: Number(arc.renderOrder),
                minX: Number(arc.x) - Number(arc.radius),
                maxX: Number(arc.x) + Number(arc.radius),
                minY: Number(arc.y) - radiusY,
                maxY: Number(arc.y) + radiusY
            })
        }

        return ownerItems
    }

    /**
     * Stores one owner-geometry candidate for missing-body order inference.
     * @param {Map<string, { renderOrder: number, minX: number, maxX: number, minY: number, maxY: number }[]>} ownerItems
     * @param {{ ownerIndex: string, renderOrder: number, minX: number, maxX: number, minY: number, maxY: number }} item
     * @returns {void}
     */
    static #pushOwnerGeometryItem(ownerItems, item) {
        if (!Number.isFinite(item.renderOrder)) {
            return
        }

        if (!ownerItems.has(item.ownerIndex)) {
            ownerItems.set(item.ownerIndex, [])
        }

        ownerItems.get(item.ownerIndex).push({
            ...item
        })
    }

    /**
     * Infers one missing owner-body render order from contained indexed
     * geometry. Missing-order bodies should sit just behind the earliest
     * indexed sibling primitive contained inside the same owner body.
     * @param {{ x: number, y: number, width: number, height: number, renderOrder: number }} rectangle
     * @param {{ renderOrder: number, minX: number, maxX: number, minY: number, maxY: number }[]} ownerItems
     * @returns {number | null}
     */
    static #inferMissingOwnerRectangleRenderOrder(rectangle, ownerItems) {
        const containedItems = ownerItems.filter(
            (item) =>
                item.minX >= rectangle.x &&
                item.maxX <= rectangle.x + rectangle.width &&
                item.minY >= rectangle.y &&
                item.maxY <= rectangle.y + rectangle.height
        )

        if (!containedItems.length) {
            return null
        }

        const earliestContainedRenderOrder = Math.min(
            ...containedItems.map((item) => Number(item.renderOrder))
        )

        return Number.isFinite(earliestContainedRenderOrder)
            ? earliestContainedRenderOrder - 0.5
            : null
    }

    /**
     * Returns true when one closed rectangle-like record carries a visible
     * area color even without an explicit `IsSolid=T` flag.
     * @param {Record<string, string | string[]>} fields
     * @param {boolean} isRectangleRecord
     * @returns {boolean}
     */
    static #hasImplicitAreaFill(fields, isRectangleRecord) {
        return (
            isRectangleRecord &&
            !parseBoolean(fields.Transparent) &&
            getField(fields, 'AreaColor') !== ''
        )
    }

    /**
     * Returns true when one record-225 frame lost its printable style fields
     * and therefore needs the authored dashed white-box defaults restored.
     * @param {Record<string, string | string[]>} fields
     * @param {boolean} isListedRectangle
     * @returns {boolean}
     */
    static #shouldUseFrameFallback(fields, isListedRectangle) {
        if (getField(fields, 'RECORD') !== '225' || isListedRectangle) {
            return false
        }

        return (
            getField(fields, 'AreaColor') === '' ||
            getField(fields, 'LineStyle') === '' ||
            !/^-?\d+$/.test(getField(fields, 'Color'))
        )
    }

    /**
     * Collects one record-7 polygon point list in source order.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number }[]}
     */
    static #collectPolygonPoints(fields) {
        const locationCount = parseNumericField(fields, 'LocationCount')

        if (locationCount === null || locationCount < 2) {
            return []
        }

        const points = []

        for (let index = 1; index <= locationCount; index += 1) {
            const x = parseNumericField(fields, 'X' + index)
            const y = parseNumericField(fields, 'Y' + index)

            if (x === null || y === null) {
                break
            }

            points.push({ x, y })
        }

        return points
    }
}
