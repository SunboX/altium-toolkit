// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const ROUND_FACTOR = 10000

/**
 * Builds deterministic geometry bounds reports for parsed document models.
 */
export class GeometryBoundsReportBuilder {
    static SCHEMA = 'altium-toolkit.geometry-bounds.a1'

    /**
     * Builds a geometry bounds report.
     * @param {{ documentModels?: object[], documentModel?: object } | object[] | object} [input]
     * @returns {object}
     */
    static build(input = {}) {
        const documentModels =
            GeometryBoundsReportBuilder.#documentModels(input)
        const entries = []
        let missingBoundsCount = 0

        documentModels.forEach((model, documentIndex) => {
            missingBoundsCount +=
                GeometryBoundsReportBuilder.#appendDocumentEntries(
                    entries,
                    model,
                    documentIndex
                )
        })

        return {
            schema: GeometryBoundsReportBuilder.SCHEMA,
            summary: GeometryBoundsReportBuilder.#summary(
                documentModels,
                entries,
                missingBoundsCount
            ),
            entries
        }
    }

    /**
     * Extracts document models from supported input shapes.
     * @param {{ documentModels?: object[], documentModel?: object } | object[] | object} input
     * @returns {object[]}
     */
    static #documentModels(input) {
        if (Array.isArray(input)) return input
        if (Array.isArray(input.documentModels)) return input.documentModels
        if (input.documentModel) return [input.documentModel]
        if (input.kind || input.schematic || input.pcb) return [input]
        return []
    }

    /**
     * Appends bounds entries for one document.
     * @param {object[]} entries Destination entries.
     * @param {object} model Parsed document model.
     * @param {number} documentIndex Document index.
     * @returns {number}
     */
    static #appendDocumentEntries(entries, model, documentIndex) {
        let missingBoundsCount = 0
        if (model?.pcb) {
            missingBoundsCount += GeometryBoundsReportBuilder.#appendPcbEntries(
                entries,
                model,
                documentIndex
            )
        }
        if (model?.schematic) {
            missingBoundsCount +=
                GeometryBoundsReportBuilder.#appendSchematicEntries(
                    entries,
                    model,
                    documentIndex
                )
        }

        return missingBoundsCount
    }

    /**
     * Appends PCB primitive bounds entries.
     * @param {object[]} entries Destination entries.
     * @param {object} model Parsed document model.
     * @param {number} documentIndex Document index.
     * @returns {number}
     */
    static #appendPcbEntries(entries, model, documentIndex) {
        const pcb = model.pcb || {}
        return GeometryBoundsReportBuilder.#appendFamilies(
            entries,
            model,
            documentIndex,
            'pcb',
            [
                ['pads', pcb.pads, GeometryBoundsReportBuilder.#padBounds],
                ['vias', pcb.vias, GeometryBoundsReportBuilder.#viaBounds],
                ['tracks', pcb.tracks, GeometryBoundsReportBuilder.#lineBounds],
                ['arcs', pcb.arcs, GeometryBoundsReportBuilder.#arcBounds],
                ['fills', pcb.fills, GeometryBoundsReportBuilder.#boxBounds],
                [
                    'regions',
                    pcb.regions,
                    GeometryBoundsReportBuilder.#regionBounds
                ],
                ['texts', pcb.texts, GeometryBoundsReportBuilder.#textBounds]
            ]
        )
    }

    /**
     * Appends schematic primitive bounds entries.
     * @param {object[]} entries Destination entries.
     * @param {object} model Parsed document model.
     * @param {number} documentIndex Document index.
     * @returns {number}
     */
    static #appendSchematicEntries(entries, model, documentIndex) {
        const schematic = model.schematic || {}
        return GeometryBoundsReportBuilder.#appendFamilies(
            entries,
            model,
            documentIndex,
            'schematic',
            [
                [
                    'lines',
                    schematic.lines,
                    GeometryBoundsReportBuilder.#lineBounds
                ],
                [
                    'rectangles',
                    schematic.rectangles,
                    GeometryBoundsReportBuilder.#boxBounds
                ],
                [
                    'roundedRectangles',
                    schematic.roundedRectangles,
                    GeometryBoundsReportBuilder.#boxBounds
                ],
                [
                    'polygons',
                    schematic.polygons,
                    GeometryBoundsReportBuilder.#regionBounds
                ],
                [
                    'regions',
                    schematic.regions,
                    GeometryBoundsReportBuilder.#regionBounds
                ],
                [
                    'ellipses',
                    schematic.ellipses,
                    GeometryBoundsReportBuilder.#ellipseBounds
                ],
                [
                    'arcs',
                    schematic.arcs,
                    GeometryBoundsReportBuilder.#arcBounds
                ],
                [
                    'beziers',
                    schematic.beziers,
                    GeometryBoundsReportBuilder.#regionBounds
                ],
                [
                    'pies',
                    schematic.pies,
                    GeometryBoundsReportBuilder.#arcBounds
                ],
                [
                    'texts',
                    schematic.texts,
                    GeometryBoundsReportBuilder.#textBounds
                ],
                [
                    'pins',
                    schematic.pins,
                    GeometryBoundsReportBuilder.#lineBounds
                ],
                [
                    'ports',
                    schematic.ports,
                    GeometryBoundsReportBuilder.#boxBounds
                ]
            ]
        )
    }

    /**
     * Appends multiple primitive families.
     * @param {object[]} entries Destination entries.
     * @param {object} model Parsed document model.
     * @param {number} documentIndex Document index.
     * @param {string} domain Document domain.
     * @param {[string, object[] | undefined, (primitive: object) => object | null][]} families Primitive family descriptors.
     * @returns {number}
     */
    static #appendFamilies(entries, model, documentIndex, domain, families) {
        return families.reduce(
            (total, [family, rows, resolver]) =>
                total +
                GeometryBoundsReportBuilder.#appendFamily(
                    entries,
                    model,
                    documentIndex,
                    domain,
                    family,
                    rows,
                    resolver
                ),
            0
        )
    }

    /**
     * Appends entries for one primitive family.
     * @param {object[]} entries Destination entries.
     * @param {object} model Parsed document model.
     * @param {number} documentIndex Document index.
     * @param {string} domain Document domain.
     * @param {string} family Primitive family.
     * @param {object[] | undefined} rows Primitive rows.
     * @param {(primitive: object) => object | null} resolver Bounds resolver.
     * @returns {number}
     */
    static #appendFamily(
        entries,
        model,
        documentIndex,
        domain,
        family,
        rows,
        resolver
    ) {
        if (!Array.isArray(rows)) return 0

        let missingBoundsCount = 0
        rows.forEach((primitive, index) => {
            const bounds = GeometryBoundsReportBuilder.#normalizeBounds(
                resolver(primitive)
            )
            if (!bounds) missingBoundsCount += 1

            entries.push({
                documentIndex,
                fileName: String(model.fileName || ''),
                domain,
                family,
                index,
                status: bounds ? 'bounded' : 'missing',
                bounds
            })
        })

        return missingBoundsCount
    }

    /**
     * Builds one report summary.
     * @param {object[]} documentModels Parsed document models.
     * @param {object[]} entries Bounds entries.
     * @param {number} missingBoundsCount Missing bounds count.
     * @returns {object}
     */
    static #summary(documentModels, entries, missingBoundsCount) {
        const union = GeometryBoundsReportBuilder.#unionBounds(
            entries.map((entry) => entry.bounds).filter(Boolean)
        )

        return {
            documentCount: documentModels.length,
            entryCount: entries.length,
            missingBoundsCount,
            ...GeometryBoundsReportBuilder.#summaryBounds(union)
        }
    }

    /**
     * Converts union bounds into summary fields.
     * @param {object | null} bounds Union bounds.
     * @returns {object}
     */
    static #summaryBounds(bounds) {
        if (!bounds) {
            return {
                minX: null,
                minY: null,
                maxX: null,
                maxY: null,
                width: 0,
                height: 0
            }
        }

        return bounds
    }

    /**
     * Resolves pad bounds.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #padBounds(primitive) {
        const x = GeometryBoundsReportBuilder.#number(primitive, ['x'])
        const y = GeometryBoundsReportBuilder.#number(primitive, ['y'])
        const width = GeometryBoundsReportBuilder.#number(primitive, [
            'sizeTopX',
            'sizeMidX',
            'sizeBottomX',
            'sizeX',
            'width',
            'diameter'
        ])
        const height = GeometryBoundsReportBuilder.#number(primitive, [
            'sizeTopY',
            'sizeMidY',
            'sizeBottomY',
            'sizeY',
            'height',
            'diameter'
        ])

        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        if (!Number.isFinite(width) || !Number.isFinite(height)) return null

        return GeometryBoundsReportBuilder.#rotatedBoxBounds(
            x,
            y,
            width,
            height,
            GeometryBoundsReportBuilder.#number(primitive, ['rotation']) || 0
        )
    }

    /**
     * Resolves via bounds.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #viaBounds(primitive) {
        const x = GeometryBoundsReportBuilder.#number(primitive, ['x'])
        const y = GeometryBoundsReportBuilder.#number(primitive, ['y'])
        const diameter = GeometryBoundsReportBuilder.#number(primitive, [
            'diameter',
            'size',
            'holeDiameter'
        ])

        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        if (!Number.isFinite(diameter)) return null

        const radius = Math.abs(diameter) / 2
        return {
            minX: x - radius,
            minY: y - radius,
            maxX: x + radius,
            maxY: y + radius
        }
    }

    /**
     * Resolves line bounds.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #lineBounds(primitive) {
        const x1 = GeometryBoundsReportBuilder.#number(primitive, [
            'x1',
            'startX',
            'fromX'
        ])
        const y1 = GeometryBoundsReportBuilder.#number(primitive, [
            'y1',
            'startY',
            'fromY'
        ])
        const x2 = GeometryBoundsReportBuilder.#number(primitive, [
            'x2',
            'endX',
            'toX'
        ])
        const y2 = GeometryBoundsReportBuilder.#number(primitive, [
            'y2',
            'endY',
            'toY'
        ])

        if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2)
        ) {
            return null
        }

        const halfWidth =
            Math.abs(
                GeometryBoundsReportBuilder.#number(primitive, [
                    'width',
                    'lineWidth',
                    'strokeWidth'
                ]) || 0
            ) / 2
        const dx = x2 - x1
        const dy = y2 - y1
        const length = Math.hypot(dx, dy)
        if (!length || !halfWidth) {
            return GeometryBoundsReportBuilder.#boundsFromPoints([
                { x: x1 - halfWidth, y: y1 - halfWidth },
                { x: x1 + halfWidth, y: y1 + halfWidth },
                { x: x2 - halfWidth, y: y2 - halfWidth },
                { x: x2 + halfWidth, y: y2 + halfWidth }
            ])
        }

        const normalX = (-dy / length) * halfWidth
        const normalY = (dx / length) * halfWidth
        return GeometryBoundsReportBuilder.#boundsFromPoints([
            { x: x1 + normalX, y: y1 + normalY },
            { x: x1 - normalX, y: y1 - normalY },
            { x: x2 + normalX, y: y2 + normalY },
            { x: x2 - normalX, y: y2 - normalY }
        ])
    }

    /**
     * Resolves rectangular bounds.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #boxBounds(primitive) {
        if (primitive?.bounds) {
            return GeometryBoundsReportBuilder.#boundsObject(primitive.bounds)
        }

        const x1 = GeometryBoundsReportBuilder.#number(primitive, [
            'x1',
            'left',
            'startX'
        ])
        const y1 = GeometryBoundsReportBuilder.#number(primitive, [
            'y1',
            'top',
            'startY'
        ])
        const x2 = GeometryBoundsReportBuilder.#number(primitive, [
            'x2',
            'right',
            'endX'
        ])
        const y2 = GeometryBoundsReportBuilder.#number(primitive, [
            'y2',
            'bottom',
            'endY'
        ])

        if (
            Number.isFinite(x1) &&
            Number.isFinite(y1) &&
            Number.isFinite(x2) &&
            Number.isFinite(y2)
        ) {
            return {
                minX: Math.min(x1, x2),
                minY: Math.min(y1, y2),
                maxX: Math.max(x1, x2),
                maxY: Math.max(y1, y2)
            }
        }

        const x = GeometryBoundsReportBuilder.#number(primitive, ['x'])
        const y = GeometryBoundsReportBuilder.#number(primitive, ['y'])
        const width = GeometryBoundsReportBuilder.#number(primitive, ['width'])
        const height = GeometryBoundsReportBuilder.#number(primitive, [
            'height'
        ])
        if (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(width) &&
            Number.isFinite(height)
        ) {
            return GeometryBoundsReportBuilder.#rotatedBoxBounds(
                x,
                y,
                width,
                height,
                GeometryBoundsReportBuilder.#number(primitive, ['rotation']) ||
                    0
            )
        }

        return null
    }

    /**
     * Resolves region-like bounds.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #regionBounds(primitive) {
        const pointBounds = GeometryBoundsReportBuilder.#boundsFromPoints(
            GeometryBoundsReportBuilder.#points(primitive)
        )
        return pointBounds || GeometryBoundsReportBuilder.#boxBounds(primitive)
    }

    /**
     * Resolves ellipse bounds.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #ellipseBounds(primitive) {
        const box = GeometryBoundsReportBuilder.#boxBounds(primitive)
        if (box) return box

        const x = GeometryBoundsReportBuilder.#number(primitive, ['x'])
        const y = GeometryBoundsReportBuilder.#number(primitive, ['y'])
        const radiusX = GeometryBoundsReportBuilder.#number(primitive, [
            'radiusX',
            'rx',
            'radius'
        ])
        const radiusY = GeometryBoundsReportBuilder.#number(primitive, [
            'radiusY',
            'ry',
            'radius'
        ])

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(radiusX) ||
            !Number.isFinite(radiusY)
        ) {
            return null
        }

        return {
            minX: x - Math.abs(radiusX),
            minY: y - Math.abs(radiusY),
            maxX: x + Math.abs(radiusX),
            maxY: y + Math.abs(radiusY)
        }
    }

    /**
     * Resolves circular arc bounds.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #arcBounds(primitive) {
        const x = GeometryBoundsReportBuilder.#number(primitive, ['x', 'cx'])
        const y = GeometryBoundsReportBuilder.#number(primitive, ['y', 'cy'])
        const radius = GeometryBoundsReportBuilder.#number(primitive, [
            'radius',
            'r'
        ])
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(radius)
        ) {
            return GeometryBoundsReportBuilder.#regionBounds(primitive)
        }

        const rawStartAngle = GeometryBoundsReportBuilder.#number(primitive, [
            'startAngle'
        ])
        const rawEndAngle = GeometryBoundsReportBuilder.#number(primitive, [
            'endAngle'
        ])
        const startAngle = Number.isFinite(rawStartAngle) ? rawStartAngle : 0
        const endAngle = Number.isFinite(rawEndAngle)
            ? rawEndAngle
            : startAngle + 360
        const halfWidth =
            Math.abs(
                GeometryBoundsReportBuilder.#number(primitive, [
                    'width',
                    'lineWidth',
                    'strokeWidth'
                ]) || 0
            ) / 2
        const points = GeometryBoundsReportBuilder.#arcPoints(
            x,
            y,
            Math.abs(radius),
            startAngle,
            endAngle
        )
        const bounds = GeometryBoundsReportBuilder.#boundsFromPoints(points)
        if (!bounds) return null

        return {
            minX: bounds.minX - halfWidth,
            minY: bounds.minY - halfWidth,
            maxX: bounds.maxX + halfWidth,
            maxY: bounds.maxY + halfWidth
        }
    }

    /**
     * Resolves text bounds using model-provided size or deterministic fallback width.
     * @param {object} primitive Primitive row.
     * @returns {object | null}
     */
    static #textBounds(primitive) {
        const box = GeometryBoundsReportBuilder.#boxBounds(primitive)
        if (box) return box

        const x = GeometryBoundsReportBuilder.#number(primitive, ['x'])
        const y = GeometryBoundsReportBuilder.#number(primitive, ['y'])
        const height = GeometryBoundsReportBuilder.#number(primitive, [
            'height',
            'textHeight',
            'fontSize',
            'size'
        ])
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        if (!Number.isFinite(height)) return null

        const explicitWidth = GeometryBoundsReportBuilder.#number(primitive, [
            'width',
            'textWidth'
        ])
        const text = String(
            primitive.text ||
                primitive.displayText ||
                primitive.value ||
                primitive.name ||
                ''
        )
        const width = Number.isFinite(explicitWidth)
            ? explicitWidth
            : Math.max(1, text.length) * height * 0.6

        return GeometryBoundsReportBuilder.#rotatedBoxBounds(
            x,
            y,
            width,
            height,
            GeometryBoundsReportBuilder.#number(primitive, ['rotation']) || 0
        )
    }

    /**
     * Builds rotated rectangle bounds.
     * @param {number} x Center x.
     * @param {number} y Center y.
     * @param {number} width Width.
     * @param {number} height Height.
     * @param {number} rotation Rotation in degrees.
     * @returns {object}
     */
    static #rotatedBoxBounds(x, y, width, height, rotation) {
        const radians = (rotation * Math.PI) / 180
        const cos = Math.abs(Math.cos(radians))
        const sin = Math.abs(Math.sin(radians))
        const rotatedWidth = Math.abs(width) * cos + Math.abs(height) * sin
        const rotatedHeight = Math.abs(width) * sin + Math.abs(height) * cos

        return {
            minX: x - rotatedWidth / 2,
            minY: y - rotatedHeight / 2,
            maxX: x + rotatedWidth / 2,
            maxY: y + rotatedHeight / 2
        }
    }

    /**
     * Builds sampled points for one arc.
     * @param {number} x Center x.
     * @param {number} y Center y.
     * @param {number} radius Radius.
     * @param {number} startAngle Start angle.
     * @param {number} endAngle End angle.
     * @returns {{ x: number, y: number }[]}
     */
    static #arcPoints(x, y, radius, startAngle, endAngle) {
        const points = [
            GeometryBoundsReportBuilder.#pointOnCircle(
                x,
                y,
                radius,
                startAngle
            ),
            GeometryBoundsReportBuilder.#pointOnCircle(x, y, radius, endAngle)
        ]
        const sweep = endAngle - startAngle
        const fullCircle = Math.abs(sweep) >= 360 || sweep === 0

        for (const angle of [0, 90, 180, 270]) {
            if (
                fullCircle ||
                GeometryBoundsReportBuilder.#angleInSweep(
                    angle,
                    startAngle,
                    endAngle
                )
            ) {
                points.push(
                    GeometryBoundsReportBuilder.#pointOnCircle(
                        x,
                        y,
                        radius,
                        angle
                    )
                )
            }
        }

        return points
    }

    /**
     * Returns one point on a circle.
     * @param {number} x Center x.
     * @param {number} y Center y.
     * @param {number} radius Radius.
     * @param {number} angle Angle in degrees.
     * @returns {{ x: number, y: number }}
     */
    static #pointOnCircle(x, y, radius, angle) {
        const radians = (angle * Math.PI) / 180
        return {
            x: x + Math.cos(radians) * radius,
            y: y + Math.sin(radians) * radius
        }
    }

    /**
     * Returns true when one angle lies inside a positive sweep.
     * @param {number} angle Candidate angle.
     * @param {number} startAngle Start angle.
     * @param {number} endAngle End angle.
     * @returns {boolean}
     */
    static #angleInSweep(angle, startAngle, endAngle) {
        let candidate = GeometryBoundsReportBuilder.#normalizeAngle(angle)
        const start = Number(startAngle)
        let end = Number(endAngle)

        while (end < start) end += 360
        while (candidate < start) candidate += 360

        return candidate <= end
    }

    /**
     * Normalizes one angle to 0..359.999.
     * @param {number} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        return ((Number(angle) % 360) + 360) % 360
    }

    /**
     * Extracts point rows from a primitive.
     * @param {object} primitive Primitive row.
     * @returns {{ x: number, y: number }[]}
     */
    static #points(primitive) {
        const rawPoints =
            primitive?.points ||
            primitive?.vertices ||
            primitive?.controlPoints ||
            primitive?.path ||
            []
        if (!Array.isArray(rawPoints)) return []

        return rawPoints
            .map((point) => GeometryBoundsReportBuilder.#point(point))
            .filter(Boolean)
    }

    /**
     * Extracts one point from supported shapes.
     * @param {object | number[]} point Source point.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(point) {
        if (Array.isArray(point)) {
            const x = Number(point[0])
            const y = Number(point[1])
            return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
        }

        const x = GeometryBoundsReportBuilder.#number(point, ['x'])
        const y = GeometryBoundsReportBuilder.#number(point, ['y'])
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Builds bounds from point rows.
     * @param {{ x: number, y: number }[]} points Point rows.
     * @returns {object | null}
     */
    static #boundsFromPoints(points) {
        const valid = (points || []).filter(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
        )
        if (!valid.length) return null

        return {
            minX: Math.min(...valid.map((point) => point.x)),
            minY: Math.min(...valid.map((point) => point.y)),
            maxX: Math.max(...valid.map((point) => point.x)),
            maxY: Math.max(...valid.map((point) => point.y))
        }
    }

    /**
     * Converts a bounds-like object to report bounds.
     * @param {object} bounds Source bounds.
     * @returns {object | null}
     */
    static #boundsObject(bounds) {
        const minX = GeometryBoundsReportBuilder.#number(bounds, [
            'minX',
            'x1',
            'left'
        ])
        const minY = GeometryBoundsReportBuilder.#number(bounds, [
            'minY',
            'y1',
            'top'
        ])
        const maxX = GeometryBoundsReportBuilder.#number(bounds, [
            'maxX',
            'x2',
            'right'
        ])
        const maxY = GeometryBoundsReportBuilder.#number(bounds, [
            'maxY',
            'y2',
            'bottom'
        ])

        if (
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(maxX) ||
            !Number.isFinite(maxY)
        ) {
            return null
        }

        return { minX, minY, maxX, maxY }
    }

    /**
     * Normalizes bounds to rounded report fields.
     * @param {object | null} bounds Bounds input.
     * @returns {object | null}
     */
    static #normalizeBounds(bounds) {
        if (!bounds) return null

        const minX = Number(bounds.minX)
        const minY = Number(bounds.minY)
        const maxX = Number(bounds.maxX)
        const maxY = Number(bounds.maxY)
        if (
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(maxX) ||
            !Number.isFinite(maxY)
        ) {
            return null
        }

        const left = Math.min(minX, maxX)
        const top = Math.min(minY, maxY)
        const right = Math.max(minX, maxX)
        const bottom = Math.max(minY, maxY)

        return {
            minX: GeometryBoundsReportBuilder.#round(left),
            minY: GeometryBoundsReportBuilder.#round(top),
            maxX: GeometryBoundsReportBuilder.#round(right),
            maxY: GeometryBoundsReportBuilder.#round(bottom),
            width: GeometryBoundsReportBuilder.#round(right - left),
            height: GeometryBoundsReportBuilder.#round(bottom - top)
        }
    }

    /**
     * Builds union bounds from normalized bounds rows.
     * @param {object[]} rows Bounds rows.
     * @returns {object | null}
     */
    static #unionBounds(rows) {
        if (!rows.length) return null

        return GeometryBoundsReportBuilder.#normalizeBounds({
            minX: Math.min(...rows.map((row) => row.minX)),
            minY: Math.min(...rows.map((row) => row.minY)),
            maxX: Math.max(...rows.map((row) => row.maxX)),
            maxY: Math.max(...rows.map((row) => row.maxY))
        })
    }

    /**
     * Reads the first finite numeric field.
     * @param {object} source Source object.
     * @param {string[]} keys Candidate keys.
     * @returns {number}
     */
    static #number(source, keys) {
        for (const key of keys) {
            const value = Number(source?.[key])
            if (Number.isFinite(value)) return value
        }

        return NaN
    }

    /**
     * Rounds one number for deterministic JSON reports.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        const rounded = Math.round(value * ROUND_FACTOR) / ROUND_FACTOR
        return Object.is(rounded, -0) ? 0 : rounded
    }
}
