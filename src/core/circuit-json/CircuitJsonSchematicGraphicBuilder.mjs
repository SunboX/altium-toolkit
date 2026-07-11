// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicComponentOwnerTextResolver } from '../altium/SchematicComponentOwnerTextResolver.mjs'
import { CircuitJsonModelAdapterPrimitives } from './CircuitJsonModelAdapterPrimitives.mjs'
import { CircuitJsonSchematicDocumentGraphicBuilder } from './CircuitJsonSchematicDocumentGraphicBuilder.mjs'
import { CircuitJsonSchematicStrokeStyle } from './CircuitJsonSchematicStrokeStyle.mjs'

const Primitives = CircuitJsonModelAdapterPrimitives
const ELLIPSE_SEGMENTS = 48
const BEZIER_SEGMENTS = 24
const FAMILY_ORDER = new Map(
    [
        'line',
        'rectangle',
        'rounded_rectangle',
        'ellipse',
        'arc',
        'pie',
        'bezier',
        'polygon',
        'text_box',
        'table',
        'sheet',
        'text'
    ].map((name, index) => [name, index])
)

/**
 * Projects normalized Altium schematic graphics onto shared CircuitJSON rows.
 */
export class CircuitJsonSchematicGraphicBuilder {
    /**
     * Appends all common schematic graphics in native render order.
     * @param {object[]} circuitJson Destination CircuitJSON model.
     * @param {Record<string, unknown>} schematic Native schematic read model.
     * @param {string} idScope Deterministic document id scope.
     * @param {Map<object, string>} schematicComponentIds Component id lookup.
     * @param {Map<string, string>} netIds Source net id lookup.
     * @returns {void}
     */
    static append(
        circuitJson,
        schematic,
        idScope,
        schematicComponentIds,
        netIds
    ) {
        const groups = []
        const ownerIds = CircuitJsonSchematicGraphicBuilder.#componentOwnerIds(
            schematic,
            schematicComponentIds
        )

        CircuitJsonSchematicGraphicBuilder.#appendLines(
            groups,
            schematic,
            idScope,
            ownerIds,
            netIds
        )
        CircuitJsonSchematicGraphicBuilder.#appendRectangles(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicGraphicBuilder.#appendRoundedRectangles(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicGraphicBuilder.#appendEllipses(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicGraphicBuilder.#appendArcs(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicGraphicBuilder.#appendPies(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicGraphicBuilder.#appendBeziers(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicGraphicBuilder.#appendPolygons(
            groups,
            schematic,
            idScope,
            ownerIds
        )
        CircuitJsonSchematicDocumentGraphicBuilder.append(
            groups,
            schematic,
            idScope,
            ownerIds
        )

        groups
            .sort(
                (left, right) =>
                    left.order - right.order ||
                    left.familyOrder - right.familyOrder ||
                    left.index - right.index
            )
            .forEach((group) => circuitJson.push(...group.rows))
    }

    /**
     * Appends authored line and wire rows.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @param {Map<string, string>} netIds Source net lookup.
     * @returns {void}
     */
    static #appendLines(groups, schematic, idScope, ownerIds, netIds) {
        for (const [index, line] of Primitives.array(
            schematic.lines
        ).entries()) {
            if (String(line?.recordType || '') === '7') continue
            const rows = []
            const lineId = Primitives.id(idScope, [
                'schematic_line',
                CircuitJsonSchematicGraphicBuilder.#identity(line, index)
            ])
            rows.push({
                type: 'schematic_line',
                schematic_line_id: lineId,
                x1: Primitives.number(line?.x1, 0),
                y1: Primitives.number(line?.y1, 0),
                x2: Primitives.number(line?.x2, 0),
                y2: Primitives.number(line?.y2, 0),
                stroke_width: Primitives.number(line?.width, 1),
                ...CircuitJsonSchematicStrokeStyle.fields(line, line?.width),
                color: Primitives.string(line?.color, '#000000'),
                ...CircuitJsonSchematicGraphicBuilder.#ownerField(
                    line,
                    ownerIds
                )
            })

            if (String(line?.sourceType || '').toLowerCase() === 'wire') {
                const netKey = String(line.netName || '')
                const sourceNetId =
                    netIds.get(netKey) ||
                    Primitives.sourceNetId(
                        idScope,
                        line.netName || line.netIndex || index
                    )
                const sourceTraceId = Primitives.id(idScope, [
                    'source_trace',
                    line.netName || line.netIndex || index,
                    index
                ])
                rows.push(
                    {
                        type: 'source_trace',
                        source_trace_id: sourceTraceId,
                        connected_source_port_ids: [],
                        connected_source_net_ids: sourceNetId
                            ? [sourceNetId]
                            : []
                    },
                    {
                        type: 'schematic_trace',
                        schematic_trace_id: Primitives.id(idScope, [
                            'schematic_trace',
                            index
                        ]),
                        source_trace_id: sourceTraceId,
                        junctions: [],
                        edges: [
                            {
                                from: {
                                    x: Primitives.number(line?.x1, 0),
                                    y: Primitives.number(line?.y1, 0)
                                },
                                to: {
                                    x: Primitives.number(line?.x2, 0),
                                    y: Primitives.number(line?.y2, 0)
                                }
                            }
                        ]
                    }
                )
            }
            CircuitJsonSchematicGraphicBuilder.#group(
                groups,
                line,
                'line',
                index,
                rows
            )
        }
    }

    /**
     * Appends rectangular schematic primitives.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendRectangles(groups, schematic, idScope, ownerIds) {
        const families = [
            ...Primitives.array(schematic.rectangles),
            ...Primitives.array(schematic.regions)
        ]
        for (const [index, rectangle] of families.entries()) {
            const width = Math.abs(Primitives.number(rectangle?.width, 0) || 0)
            const height = Math.abs(
                Primitives.number(rectangle?.height, 0) || 0
            )
            const x = Primitives.number(rectangle?.x, 0) || 0
            const y = Primitives.number(rectangle?.y, 0) || 0
            const row = {
                type: 'schematic_rect',
                schematic_rect_id: Primitives.id(idScope, [
                    'schematic_rect',
                    CircuitJsonSchematicGraphicBuilder.#identity(
                        rectangle,
                        index
                    )
                ]),
                center: Primitives.point(x + width / 2, y + height / 2),
                width,
                height,
                ...CircuitJsonSchematicGraphicBuilder.#closedStyle(
                    rectangle,
                    false
                ),
                ...CircuitJsonSchematicGraphicBuilder.#ownerField(
                    rectangle,
                    ownerIds
                )
            }
            CircuitJsonSchematicGraphicBuilder.#group(
                groups,
                rectangle,
                'rectangle',
                index,
                [row]
            )
        }
    }

    /**
     * Appends rounded rectangles as exact sampled paths.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendRoundedRectangles(groups, schematic, idScope, ownerIds) {
        for (const [index, rectangle] of Primitives.array(
            schematic.roundedRectangles
        ).entries()) {
            const row = {
                type: 'schematic_path',
                schematic_path_id: Primitives.id(idScope, [
                    'schematic_path',
                    'rounded_rectangle',
                    CircuitJsonSchematicGraphicBuilder.#identity(
                        rectangle,
                        index
                    )
                ]),
                points: CircuitJsonSchematicGraphicBuilder.#roundedRectanglePoints(
                    rectangle
                ),
                ...CircuitJsonSchematicGraphicBuilder.#pathStyle(rectangle),
                ...CircuitJsonSchematicGraphicBuilder.#ownerField(
                    rectangle,
                    ownerIds
                )
            }
            CircuitJsonSchematicGraphicBuilder.#group(
                groups,
                rectangle,
                'rounded_rectangle',
                index,
                [row]
            )
        }
    }

    /**
     * Appends circles and sampled unequal ellipses.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendEllipses(groups, schematic, idScope, ownerIds) {
        for (const [index, ellipse] of Primitives.array(
            schematic.ellipses
        ).entries()) {
            const radiusX = Math.abs(
                Primitives.number(ellipse?.radiusX, 0) || 0
            )
            const radiusY = Math.abs(
                Primitives.number(ellipse?.radiusY, 0) || 0
            )
            const identity = CircuitJsonSchematicGraphicBuilder.#identity(
                ellipse,
                index
            )
            const owner = CircuitJsonSchematicGraphicBuilder.#ownerField(
                ellipse,
                ownerIds
            )
            const row =
                Math.abs(radiusX - radiusY) <= 0.000001
                    ? {
                          type: 'schematic_circle',
                          schematic_circle_id: Primitives.id(idScope, [
                              'schematic_circle',
                              identity
                          ]),
                          center: Primitives.point(ellipse?.x, ellipse?.y),
                          radius: radiusX,
                          ...CircuitJsonSchematicGraphicBuilder.#closedStyle(
                              ellipse,
                              false
                          ),
                          ...owner
                      }
                    : {
                          type: 'schematic_path',
                          schematic_path_id: Primitives.id(idScope, [
                              'schematic_path',
                              'ellipse',
                              identity
                          ]),
                          points: CircuitJsonSchematicGraphicBuilder.#ellipsePoints(
                              ellipse,
                              ELLIPSE_SEGMENTS
                          ),
                          ...CircuitJsonSchematicGraphicBuilder.#pathStyle(
                              ellipse
                          ),
                          ...owner
                      }
            CircuitJsonSchematicGraphicBuilder.#group(
                groups,
                ellipse,
                'ellipse',
                index,
                [row]
            )
        }
    }

    /**
     * Appends circular arcs and sampled elliptical arcs.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendArcs(groups, schematic, idScope, ownerIds) {
        for (const [index, arc] of Primitives.array(schematic.arcs).entries()) {
            const radius = Math.abs(Primitives.number(arc?.radius, 0) || 0)
            const radiusY = Math.abs(
                Primitives.number(arc?.radiusY, radius) || radius
            )
            const start = Primitives.number(arc?.startAngle, 0) || 0
            const end = Primitives.number(arc?.endAngle, 360) || 0
            const identity = CircuitJsonSchematicGraphicBuilder.#identity(
                arc,
                index
            )
            const owner = CircuitJsonSchematicGraphicBuilder.#ownerField(
                arc,
                ownerIds
            )
            const row =
                Math.abs(radius - radiusY) <= 0.000001
                    ? {
                          type: 'schematic_arc',
                          schematic_arc_id: Primitives.id(idScope, [
                              'schematic_arc',
                              identity
                          ]),
                          center: Primitives.point(arc?.x, arc?.y),
                          radius,
                          start_angle_degrees: start,
                          end_angle_degrees: end,
                          direction:
                              CircuitJsonSchematicGraphicBuilder.#arcDelta(
                                  start,
                                  end
                              ) >= 0
                                  ? 'clockwise'
                                  : 'counterclockwise',
                          stroke_width: Primitives.number(arc?.width, 1),
                          color: Primitives.string(arc?.color, '#000000'),
                          ...CircuitJsonSchematicStrokeStyle.fields(
                              arc,
                              arc?.width
                          ),
                          ...owner
                      }
                    : {
                          type: 'schematic_path',
                          schematic_path_id: Primitives.id(idScope, [
                              'schematic_path',
                              'elliptical_arc',
                              identity
                          ]),
                          points: CircuitJsonSchematicGraphicBuilder.#ellipticalArcPoints(
                              arc,
                              radius,
                              radiusY,
                              start,
                              end
                          ),
                          stroke_color: Primitives.string(
                              arc?.color,
                              '#000000'
                          ),
                          stroke_width: Primitives.number(arc?.width, 1),
                          ...CircuitJsonSchematicStrokeStyle.fields(
                              arc,
                              arc?.width
                          ),
                          is_filled: false,
                          ...owner
                      }
            CircuitJsonSchematicGraphicBuilder.#group(
                groups,
                arc,
                'arc',
                index,
                [row]
            )
        }
    }

    /**
     * Appends filled pie and wedge primitives as closed common paths.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendPies(groups, schematic, idScope, ownerIds) {
        for (const [index, pie] of Primitives.array(schematic.pies).entries()) {
            const radius = Math.abs(
                Primitives.number(pie?.radius ?? pie?.radiusX, 0) || 0
            )
            const radiusY = Math.abs(
                Primitives.number(pie?.radiusY, radius) || 0
            )
            if (!(radius > 0 && radiusY > 0)) continue
            const start = Primitives.number(pie?.startAngle, 0) || 0
            const end = Primitives.number(pie?.endAngle, 360) || 0
            const row = {
                type: 'schematic_path',
                schematic_path_id: Primitives.id(idScope, [
                    'schematic_path',
                    'pie',
                    CircuitJsonSchematicGraphicBuilder.#identity(pie, index)
                ]),
                points: [
                    Primitives.point(pie?.x, pie?.y),
                    ...CircuitJsonSchematicGraphicBuilder.#ellipticalArcPoints(
                        pie,
                        radius,
                        radiusY,
                        start,
                        end
                    )
                ],
                ...CircuitJsonSchematicGraphicBuilder.#pathStyle(pie),
                ...CircuitJsonSchematicGraphicBuilder.#ownerField(pie, ownerIds)
            }
            CircuitJsonSchematicGraphicBuilder.#group(
                groups,
                pie,
                'pie',
                index,
                [row]
            )
        }
    }

    /**
     * Appends deterministic cubic-Bezier samples.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendBeziers(groups, schematic, idScope, ownerIds) {
        for (const [index, bezier] of Primitives.array(
            schematic.beziers
        ).entries()) {
            const points =
                CircuitJsonSchematicGraphicBuilder.#bezierPoints(bezier)
            if (points.length < 2) continue
            const row = {
                type: 'schematic_path',
                schematic_path_id: Primitives.id(idScope, [
                    'schematic_path',
                    'bezier',
                    CircuitJsonSchematicGraphicBuilder.#identity(bezier, index)
                ]),
                points,
                stroke_color: Primitives.string(bezier?.color, '#000000'),
                stroke_width: Primitives.number(bezier?.width, 1),
                ...CircuitJsonSchematicStrokeStyle.fields(
                    bezier,
                    bezier?.width
                ),
                is_filled: false,
                ...CircuitJsonSchematicGraphicBuilder.#ownerField(
                    bezier,
                    ownerIds
                )
            }
            CircuitJsonSchematicGraphicBuilder.#group(
                groups,
                bezier,
                'bezier',
                index,
                [row]
            )
        }
    }

    /**
     * Appends exact polygon point lists.
     * @param {object[]} groups Render groups.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {string} idScope Document id scope.
     * @param {Map<string, string>} ownerIds Owner-to-component lookup.
     * @returns {void}
     */
    static #appendPolygons(groups, schematic, idScope, ownerIds) {
        for (const [index, polygon] of Primitives.array(
            schematic.polygons
        ).entries()) {
            const points = Primitives.array(polygon?.points).map((point) =>
                Primitives.point(point?.x, point?.y)
            )
            if (points.length < 2) continue
            const row = {
                type: 'schematic_path',
                schematic_path_id: Primitives.id(idScope, [
                    'schematic_path',
                    'polygon',
                    CircuitJsonSchematicGraphicBuilder.#identity(polygon, index)
                ]),
                points,
                ...CircuitJsonSchematicGraphicBuilder.#pathStyle(polygon),
                ...CircuitJsonSchematicGraphicBuilder.#ownerField(
                    polygon,
                    ownerIds
                )
            }
            CircuitJsonSchematicGraphicBuilder.#group(
                groups,
                polygon,
                'polygon',
                index,
                [row]
            )
        }
    }

    /**
     * Resolves native owner ids to canonical schematic component ids.
     * @param {Record<string, unknown>} schematic Native schematic.
     * @param {Map<object, string>} componentIds Component id lookup.
     * @returns {Map<string, string>}
     */
    static #componentOwnerIds(schematic, componentIds) {
        const ownerIds = new Map()
        const components = Primitives.array(schematic.components)
        const records = Primitives.array(schematic.ownership?.records)
        const componentRecords = records.filter((record) =>
            ['1', '45'].includes(String(record?.recordType || ''))
        )

        for (const [index, component] of components.entries()) {
            const componentId = componentIds.get(component)
            if (!componentId) continue
            for (const ownerIndex of [
                component?.ownerIndex,
                ...Primitives.array(component?.ownerIndexes)
            ]) {
                CircuitJsonSchematicGraphicBuilder.#setOwner(
                    ownerIds,
                    ownerIndex,
                    componentId
                )
            }
            const uniqueId = String(component?.uniqueId || '').trim()
            const componentRecord =
                componentRecords.find(
                    (record) =>
                        uniqueId &&
                        String(record?.uniqueId || '').trim() === uniqueId
                ) || componentRecords[index]
            if (componentRecord) {
                for (const ownerIndex of SchematicComponentOwnerTextResolver.resolveOwnerIndexes(
                    componentRecord,
                    records
                )) {
                    CircuitJsonSchematicGraphicBuilder.#setOwner(
                        ownerIds,
                        ownerIndex,
                        componentId
                    )
                }
            }

            const designator = String(component?.designator || '').trim()
            for (const record of records) {
                if (
                    designator &&
                    String(record?.name || '').toLowerCase() === 'designator' &&
                    String(record?.text || '').trim() === designator
                ) {
                    CircuitJsonSchematicGraphicBuilder.#setOwner(
                        ownerIds,
                        record?.ownerIndex,
                        componentId
                    )
                }
            }
        }
        return ownerIds
    }

    /**
     * Builds rounded rectangle perimeter samples.
     * @param {Record<string, unknown>} rectangle Native rounded rectangle.
     * @returns {{ x: number, y: number }[]}
     */
    static #roundedRectanglePoints(rectangle) {
        const x = Primitives.number(rectangle?.x, 0) || 0
        const y = Primitives.number(rectangle?.y, 0) || 0
        const width = Math.abs(Primitives.number(rectangle?.width, 0) || 0)
        const height = Math.abs(Primitives.number(rectangle?.height, 0) || 0)
        const radius = Math.max(
            Math.min(
                Math.abs(Primitives.number(rectangle?.radius, 0) || 0),
                width / 2,
                height / 2
            ),
            0
        )
        if (radius === 0) {
            return [
                Primitives.point(x, y),
                Primitives.point(x + width, y),
                Primitives.point(x + width, y + height),
                Primitives.point(x, y + height)
            ]
        }
        const points = []
        const corners = [
            { x: x + width - radius, y: y + radius, start: -90 },
            { x: x + width - radius, y: y + height - radius, start: 0 },
            { x: x + radius, y: y + height - radius, start: 90 },
            { x: x + radius, y: y + radius, start: 180 }
        ]
        for (const [cornerIndex, corner] of corners.entries()) {
            for (let step = 0; step <= 8; step += 1) {
                if (cornerIndex > 0 && step === 0) continue
                const angle = ((corner.start + (step / 8) * 90) * Math.PI) / 180
                points.push(
                    Primitives.point(
                        corner.x + radius * Math.cos(angle),
                        corner.y + radius * Math.sin(angle)
                    )
                )
            }
        }
        return points
    }

    /**
     * Builds closed ellipse samples.
     * @param {Record<string, unknown>} ellipse Native ellipse.
     * @param {number} segments Segment count.
     * @returns {{ x: number, y: number }[]}
     */
    static #ellipsePoints(ellipse, segments) {
        const centerX = Primitives.number(ellipse?.x, 0) || 0
        const centerY = Primitives.number(ellipse?.y, 0) || 0
        const radiusX = Math.abs(Primitives.number(ellipse?.radiusX, 0) || 0)
        const radiusY = Math.abs(Primitives.number(ellipse?.radiusY, 0) || 0)
        return Array.from({ length: segments }, (_, index) => {
            const angle = (index / segments) * Math.PI * 2
            return Primitives.point(
                centerX + radiusX * Math.cos(angle),
                centerY + radiusY * Math.sin(angle)
            )
        })
    }

    /**
     * Builds samples for one elliptical arc.
     * @param {Record<string, unknown>} arc Native arc.
     * @param {number} radiusX Horizontal radius.
     * @param {number} radiusY Vertical radius.
     * @param {number} start Start angle.
     * @param {number} end End angle.
     * @returns {{ x: number, y: number }[]}
     */
    static #ellipticalArcPoints(arc, radiusX, radiusY, start, end) {
        const delta = CircuitJsonSchematicGraphicBuilder.#arcDelta(start, end)
        const segmentCount = Math.max(2, Math.ceil(Math.abs(delta) / 7.5))
        const centerX = Primitives.number(arc?.x, 0) || 0
        const centerY = Primitives.number(arc?.y, 0) || 0
        return Array.from({ length: segmentCount + 1 }, (_, index) => {
            const angle =
                ((start + (delta * index) / segmentCount) * Math.PI) / 180
            return Primitives.point(
                centerX + radiusX * Math.cos(angle),
                centerY + radiusY * Math.sin(angle)
            )
        })
    }

    /**
     * Builds deterministic samples for every cubic Bezier span.
     * @param {Record<string, unknown>} bezier Native Bezier.
     * @returns {{ x: number, y: number }[]}
     */
    static #bezierPoints(bezier) {
        const points = []
        for (const [segmentIndex, segment] of Primitives.array(
            bezier?.segments
        ).entries()) {
            for (let step = 0; step <= BEZIER_SEGMENTS; step += 1) {
                if (segmentIndex > 0 && step === 0) continue
                const t = step / BEZIER_SEGMENTS
                const inverse = 1 - t
                const x =
                    inverse ** 3 *
                        (Primitives.number(segment?.start?.x, 0) || 0) +
                    3 *
                        inverse ** 2 *
                        t *
                        (Primitives.number(segment?.control1?.x, 0) || 0) +
                    3 *
                        inverse *
                        t ** 2 *
                        (Primitives.number(segment?.control2?.x, 0) || 0) +
                    t ** 3 * (Primitives.number(segment?.end?.x, 0) || 0)
                const y =
                    inverse ** 3 *
                        (Primitives.number(segment?.start?.y, 0) || 0) +
                    3 *
                        inverse ** 2 *
                        t *
                        (Primitives.number(segment?.control1?.y, 0) || 0) +
                    3 *
                        inverse *
                        t ** 2 *
                        (Primitives.number(segment?.control2?.y, 0) || 0) +
                    t ** 3 * (Primitives.number(segment?.end?.y, 0) || 0)
                points.push(Primitives.point(x, y))
            }
        }
        return points
    }

    /**
     * Builds style fields for one closed primitive.
     * @param {Record<string, unknown>} primitive Native primitive.
     * @param {boolean} path Whether path color naming is required.
     * @returns {Record<string, unknown>}
     */
    static #closedStyle(primitive, path) {
        return {
            stroke_width: Primitives.number(
                primitive?.lineWidth ?? primitive?.width,
                1
            ),
            ...(path
                ? {
                      stroke_color: Primitives.string(
                          primitive?.color,
                          '#000000'
                      )
                  }
                : {
                      color: Primitives.string(primitive?.color, '#000000')
                  }),
            fill_color: Primitives.string(primitive?.fill, '#ffffff'),
            ...CircuitJsonSchematicStrokeStyle.fields(
                primitive,
                primitive?.lineWidth ?? primitive?.width
            ),
            is_filled:
                primitive?.isSolid === true && primitive?.transparent !== true
        }
    }

    /**
     * Builds style fields for one path primitive.
     * @param {Record<string, unknown>} primitive Native primitive.
     * @returns {Record<string, unknown>}
     */
    static #pathStyle(primitive) {
        return CircuitJsonSchematicGraphicBuilder.#closedStyle(primitive, true)
    }

    /**
     * Returns optional ownership for one primitive.
     * @param {Record<string, unknown>} primitive Native primitive.
     * @param {Map<string, string>} ownerIds Owner lookup.
     * @returns {{ schematic_component_id?: string }}
     */
    static #ownerField(primitive, ownerIds) {
        const ownerId = ownerIds.get(String(primitive?.ownerIndex || ''))
        return ownerId ? { schematic_component_id: ownerId } : {}
    }

    /**
     * Adds one stable native owner mapping.
     * @param {Map<string, string>} ownerIds Owner map.
     * @param {unknown} ownerIndex Native owner id.
     * @param {string} componentId Canonical component id.
     * @returns {void}
     */
    static #setOwner(ownerIds, ownerIndex, componentId) {
        const key = String(ownerIndex || '').trim()
        if (key && !ownerIds.has(key)) ownerIds.set(key, componentId)
    }

    /**
     * Appends one sortable group descriptor.
     * @param {object[]} groups Group list.
     * @param {Record<string, unknown>} source Native source row.
     * @param {string} family Graphic family.
     * @param {number} index Family-local index.
     * @param {object[]} rows Canonical rows.
     * @returns {void}
     */
    static #group(groups, source, family, index, rows) {
        const renderOrder = Primitives.number(source?.renderOrder, index)
        groups.push({
            order: Number.isFinite(renderOrder) ? renderOrder : index,
            familyOrder: FAMILY_ORDER.get(family) ?? FAMILY_ORDER.size,
            index,
            rows
        })
    }

    /**
     * Returns a deterministic primitive identity.
     * @param {Record<string, unknown>} source Native source row.
     * @param {number} index Family-local index.
     * @returns {unknown}
     */
    static #identity(source, index) {
        return (
            source?.recordId ||
            source?.uniqueId ||
            source?.uuid ||
            source?.id ||
            source?.renderOrder ||
            index
        )
    }

    /**
     * Normalizes a native arc delta without discarding full turns.
     * @param {number} start Start angle.
     * @param {number} end End angle.
     * @returns {number}
     */
    static #arcDelta(start, end) {
        let delta = Number(end) - Number(start)
        while (delta < -360) delta += 360
        while (delta > 360) delta -= 360
        return delta
    }
}

Object.freeze(CircuitJsonSchematicGraphicBuilder.prototype)
Object.freeze(CircuitJsonSchematicGraphicBuilder)
