// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds a deterministic schematic render-operation sidecar for SVG CI diffs.
 */
export class SchematicRenderOpsSidecarBuilder {
    static SCHEMA_ID = 'altium-toolkit.schematic.render-ops.a1'

    /**
     * Builds a render-operation sidecar.
     * @param {object} schematic Normalized schematic model.
     * @param {{ contentHeight: number, profile?: string, semanticMetadata?: object }} options Build options.
     * @returns {object}
     */
    static build(schematic, options = {}) {
        const contentHeight = Number(options.contentHeight || 0)
        const elementByRecordId =
            SchematicRenderOpsSidecarBuilder.#elementByRecordId(
                options.semanticMetadata
            )
        const records = [
            ...SchematicRenderOpsSidecarBuilder.#lineRecords(
                schematic?.lines || [],
                contentHeight,
                elementByRecordId
            ),
            ...SchematicRenderOpsSidecarBuilder.#rectangleRecords(
                schematic?.rectangles || [],
                contentHeight,
                elementByRecordId
            ),
            ...SchematicRenderOpsSidecarBuilder.#roundedRectangleRecords(
                schematic?.roundedRectangles || [],
                contentHeight,
                elementByRecordId
            ),
            ...SchematicRenderOpsSidecarBuilder.#ellipseRecords(
                schematic?.ellipses || [],
                contentHeight,
                elementByRecordId
            ),
            ...SchematicRenderOpsSidecarBuilder.#arcRecords(
                schematic?.arcs || [],
                contentHeight,
                elementByRecordId
            ),
            ...SchematicRenderOpsSidecarBuilder.#bezierRecords(
                schematic?.beziers || [],
                contentHeight,
                elementByRecordId
            ),
            ...SchematicRenderOpsSidecarBuilder.#pieRecords(
                schematic?.pies || [],
                contentHeight,
                elementByRecordId
            ),
            ...SchematicRenderOpsSidecarBuilder.#imageRecords(
                schematic?.images || [],
                contentHeight,
                elementByRecordId
            ),
            ...SchematicRenderOpsSidecarBuilder.#textRecords(
                schematic?.texts || [],
                contentHeight,
                elementByRecordId
            )
        ]

        return {
            schema: SchematicRenderOpsSidecarBuilder.SCHEMA_ID,
            profile: String(options.profile || 'default'),
            coordinateSpace: {
                x: 'svg',
                y: 'svg',
                units: 'schematic-display-units'
            },
            summary: {
                recordCount: records.length,
                operationCount: records.reduce(
                    (count, record) => count + record.operations.length,
                    0
                ),
                failedRecordCount: records.filter((record) => record.failed)
                    .length
            },
            records
        }
    }

    /**
     * Builds line operation records.
     * @param {object[]} lines Line rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #lineRecords(lines, contentHeight, elementByRecordId) {
        return (lines || []).map((line, index) => {
            const recordId = SchematicRenderOpsSidecarBuilder.#recordId(
                line,
                'line',
                index
            )
            return {
                elementKey:
                    elementByRecordId.get(recordId)?.elementKey ||
                    'schematic-line-' + index,
                recordId,
                primitive: 'line',
                operations: [
                    {
                        type: 'line',
                        x1: SchematicRenderOpsSidecarBuilder.#number(line.x1),
                        y1: SchematicRenderOpsSidecarBuilder.#y(
                            contentHeight,
                            line.y1
                        ),
                        x2: SchematicRenderOpsSidecarBuilder.#number(line.x2),
                        y2: SchematicRenderOpsSidecarBuilder.#y(
                            contentHeight,
                            line.y2
                        ),
                        stroke: line.color,
                        width: line.width
                    }
                ]
            }
        })
    }

    /**
     * Builds rectangle operation records.
     * @param {object[]} rectangles Rectangle rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #rectangleRecords(rectangles, contentHeight, elementByRecordId) {
        return (rectangles || []).map((rectangle, index) => {
            const recordId = SchematicRenderOpsSidecarBuilder.#recordId(
                rectangle,
                'rectangle',
                index
            )
            return {
                elementKey:
                    elementByRecordId.get(recordId)?.elementKey ||
                    'schematic-rectangle-' + index,
                recordId,
                primitive: 'rectangle',
                operations: [
                    SchematicRenderOpsSidecarBuilder.#stripEmpty({
                        type: 'rectangle',
                        x: SchematicRenderOpsSidecarBuilder.#number(
                            rectangle.x
                        ),
                        y: SchematicRenderOpsSidecarBuilder.#number(
                            contentHeight -
                                Number(rectangle.y || 0) -
                                Number(rectangle.height || 0)
                        ),
                        width: rectangle.width,
                        height: rectangle.height,
                        stroke: rectangle.color,
                        fill: rectangle.fill,
                        widthStroke: rectangle.lineWidth
                    })
                ]
            }
        })
    }

    /**
     * Builds rounded-rectangle operation records.
     * @param {object[]} rectangles Rounded rectangle rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #roundedRectangleRecords(
        rectangles,
        contentHeight,
        elementByRecordId
    ) {
        return (rectangles || []).map((rectangle, index) =>
            SchematicRenderOpsSidecarBuilder.#singleOperationRecord(
                rectangle,
                'rounded-rectangle',
                index,
                elementByRecordId,
                {
                    type: 'rounded-rectangle',
                    x: SchematicRenderOpsSidecarBuilder.#number(rectangle.x),
                    y: SchematicRenderOpsSidecarBuilder.#boxY(
                        contentHeight,
                        rectangle.y,
                        rectangle.height
                    ),
                    width: rectangle.width,
                    height: rectangle.height,
                    radius: rectangle.radius,
                    stroke: rectangle.color,
                    fill: rectangle.fill,
                    widthStroke: rectangle.lineWidth
                }
            )
        )
    }

    /**
     * Builds ellipse operation records.
     * @param {object[]} ellipses Ellipse rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #ellipseRecords(ellipses, contentHeight, elementByRecordId) {
        return (ellipses || []).map((ellipse, index) =>
            SchematicRenderOpsSidecarBuilder.#singleOperationRecord(
                ellipse,
                'ellipse',
                index,
                elementByRecordId,
                {
                    type: 'ellipse',
                    cx: SchematicRenderOpsSidecarBuilder.#number(ellipse.x),
                    cy: SchematicRenderOpsSidecarBuilder.#y(
                        contentHeight,
                        ellipse.y
                    ),
                    rx: ellipse.radiusX,
                    ry: ellipse.radiusY,
                    stroke: ellipse.color,
                    fill: ellipse.fill,
                    widthStroke: ellipse.lineWidth
                }
            )
        )
    }

    /**
     * Builds arc operation records.
     * @param {object[]} arcs Arc rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #arcRecords(arcs, contentHeight, elementByRecordId) {
        return (arcs || []).map((arc, index) =>
            SchematicRenderOpsSidecarBuilder.#singleOperationRecord(
                arc,
                'arc',
                index,
                elementByRecordId,
                {
                    type: 'arc',
                    cx: SchematicRenderOpsSidecarBuilder.#number(arc.x),
                    cy: SchematicRenderOpsSidecarBuilder.#y(
                        contentHeight,
                        arc.y
                    ),
                    radius: arc.radius,
                    startAngle: arc.startAngle,
                    endAngle: arc.endAngle,
                    stroke: arc.color,
                    width: arc.width
                }
            )
        )
    }

    /**
     * Builds Bezier operation records.
     * @param {object[]} beziers Bezier rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #bezierRecords(beziers, contentHeight, elementByRecordId) {
        return (beziers || []).map((bezier, index) =>
            SchematicRenderOpsSidecarBuilder.#singleOperationRecord(
                bezier,
                'bezier',
                index,
                elementByRecordId,
                {
                    type: 'bezier',
                    segments: (bezier.segments || []).map((segment) =>
                        SchematicRenderOpsSidecarBuilder.#bezierSegment(
                            segment,
                            contentHeight
                        )
                    ),
                    stroke: bezier.color,
                    width: bezier.width
                }
            )
        )
    }

    /**
     * Builds pie operation records.
     * @param {object[]} pies Pie rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #pieRecords(pies, contentHeight, elementByRecordId) {
        return (pies || []).map((pie, index) =>
            SchematicRenderOpsSidecarBuilder.#singleOperationRecord(
                pie,
                'pie',
                index,
                elementByRecordId,
                {
                    type: 'pie',
                    cx: SchematicRenderOpsSidecarBuilder.#number(pie.x),
                    cy: SchematicRenderOpsSidecarBuilder.#y(
                        contentHeight,
                        pie.y
                    ),
                    radiusX: pie.radius,
                    radiusY: pie.radiusY,
                    startAngle: pie.startAngle,
                    endAngle: pie.endAngle,
                    stroke: pie.color,
                    fill: pie.fill,
                    widthStroke: pie.lineWidth
                }
            )
        )
    }

    /**
     * Builds image operation records.
     * @param {object[]} images Image rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #imageRecords(images, contentHeight, elementByRecordId) {
        return (images || []).map((image, index) =>
            SchematicRenderOpsSidecarBuilder.#singleOperationRecord(
                image,
                'image',
                index,
                elementByRecordId,
                {
                    type: 'image',
                    x: SchematicRenderOpsSidecarBuilder.#number(image.x),
                    y: SchematicRenderOpsSidecarBuilder.#boxY(
                        contentHeight,
                        image.y,
                        image.height
                    ),
                    width: image.width,
                    height: image.height,
                    nativeFormat: image.nativeFormat || image.format
                }
            )
        )
    }

    /**
     * Builds text operation records.
     * @param {object[]} texts Text rows.
     * @param {number} contentHeight Render content height.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @returns {object[]}
     */
    static #textRecords(texts, contentHeight, elementByRecordId) {
        return (texts || []).map((text, index) => {
            const recordId = SchematicRenderOpsSidecarBuilder.#recordId(
                text,
                'text',
                index
            )
            return {
                elementKey:
                    elementByRecordId.get(recordId)?.elementKey ||
                    'schematic-text-' + index,
                recordId,
                primitive: text.recordType === '28' ? 'text-frame' : 'text',
                operations: [
                    SchematicRenderOpsSidecarBuilder.#stripEmpty({
                        type: 'string',
                        x: SchematicRenderOpsSidecarBuilder.#number(text.x),
                        y: SchematicRenderOpsSidecarBuilder.#y(
                            contentHeight,
                            text.y
                        ),
                        text: text.text,
                        fill: text.color,
                        fontFamily: text.fontFamily,
                        fontSize: text.fontSize
                    })
                ]
            }
        })
    }

    /**
     * Builds a semantic element lookup by record id.
     * @param {object | undefined} semanticMetadata Semantic sidecar.
     * @returns {Map<string, object>}
     */
    static #elementByRecordId(semanticMetadata) {
        return new Map(
            (semanticMetadata?.elements || [])
                .filter((element) => element.recordId)
                .map((element) => [String(element.recordId), element])
        )
    }

    /**
     * Builds a single-operation record for primitive sidecar rows.
     * @param {object} primitive Source primitive.
     * @param {string} primitiveKind Primitive kind.
     * @param {number} index Primitive index.
     * @param {Map<string, object>} elementByRecordId Semantic element lookup.
     * @param {object} operation Render operation.
     * @returns {object}
     */
    static #singleOperationRecord(
        primitive,
        primitiveKind,
        index,
        elementByRecordId,
        operation
    ) {
        const recordId = SchematicRenderOpsSidecarBuilder.#recordId(
            primitive,
            primitiveKind,
            index
        )

        return {
            elementKey:
                elementByRecordId.get(recordId)?.elementKey ||
                'schematic-' + primitiveKind + '-' + index,
            recordId,
            primitive: primitiveKind,
            operations: [
                SchematicRenderOpsSidecarBuilder.#stripEmpty(operation)
            ]
        }
    }

    /**
     * Projects one Bezier segment into SVG coordinates.
     * @param {object} segment Source segment.
     * @param {number} contentHeight Render content height.
     * @returns {object}
     */
    static #bezierSegment(segment, contentHeight) {
        return {
            start: SchematicRenderOpsSidecarBuilder.#point(
                segment.start,
                contentHeight
            ),
            control1: SchematicRenderOpsSidecarBuilder.#point(
                segment.control1,
                contentHeight
            ),
            control2: SchematicRenderOpsSidecarBuilder.#point(
                segment.control2,
                contentHeight
            ),
            end: SchematicRenderOpsSidecarBuilder.#point(
                segment.end,
                contentHeight
            )
        }
    }

    /**
     * Projects one point into SVG coordinates.
     * @param {object} point Source point.
     * @param {number} contentHeight Render content height.
     * @returns {{ x: number, y: number }}
     */
    static #point(point, contentHeight) {
        return {
            x: SchematicRenderOpsSidecarBuilder.#number(point?.x),
            y: SchematicRenderOpsSidecarBuilder.#y(contentHeight, point?.y)
        }
    }

    /**
     * Returns a source record id or a deterministic fallback.
     * @param {object} record Source record.
     * @param {string} primitive Primitive kind.
     * @param {number} index Primitive index.
     * @returns {string}
     */
    static #recordId(record, primitive, index) {
        const candidate =
            record?.recordId ?? record?.sourceRecordId ?? record?.sourceIndex
        return candidate === undefined || candidate === null || candidate === ''
            ? 'schematic-' + primitive + '-' + index
            : String(candidate)
    }

    /**
     * Projects one schematic Y coordinate into SVG coordinates.
     * @param {number} contentHeight Render content height.
     * @param {unknown} y Source Y.
     * @returns {number}
     */
    static #y(contentHeight, y) {
        return SchematicRenderOpsSidecarBuilder.#number(
            contentHeight - Number(y || 0)
        )
    }

    /**
     * Projects a source rectangle/image top-left corner into SVG coordinates.
     * @param {number} contentHeight Render content height.
     * @param {unknown} y Source Y.
     * @param {unknown} height Source height.
     * @returns {number}
     */
    static #boxY(contentHeight, y, height) {
        return SchematicRenderOpsSidecarBuilder.#number(
            contentHeight - Number(y || 0) - Number(height || 0)
        )
    }

    /**
     * Formats a stable numeric value.
     * @param {unknown} value Source value.
     * @returns {number}
     */
    static #number(value) {
        const parsed = Number(value || 0)
        return Number.isInteger(parsed) ? parsed : Number(parsed.toFixed(6))
    }

    /**
     * Removes undefined and empty string fields.
     * @param {Record<string, unknown>} value Source value.
     * @returns {object}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) =>
                    entryValue !== undefined && entryValue !== ''
            )
        )
    }
}
