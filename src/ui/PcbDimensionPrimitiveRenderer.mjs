// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders parsed PCB dimension records into static SVG primitives.
 */
export class PcbDimensionPrimitiveRenderer {
    /**
     * Builds the dimension SVG group.
     * @param {object[]} dimensions Normalized dimension records.
     * @param {{ attributes?: (dimension: object, index: number) => string }} options Render options.
     * @returns {string}
     */
    static buildMarkup(dimensions, options = {}) {
        const markup = (dimensions || [])
            .map((dimension, index) =>
                PcbDimensionPrimitiveRenderer.#renderDimension(
                    dimension,
                    index,
                    options.attributes
                )
            )
            .filter(Boolean)
            .join('')

        return markup ? '<g class="pcb-dimensions">' + markup + '</g>' : ''
    }

    /**
     * Pushes dimension extents into reusable viewBox coordinate arrays.
     * @param {number[]} xs X extents.
     * @param {number[]} ys Y extents.
     * @param {object[]} dimensions Dimension records.
     * @returns {void}
     */
    static pushExtents(xs, ys, dimensions) {
        for (const dimension of dimensions || []) {
            for (const point of [
                ...(dimension?.references || []),
                dimension?.textLocation
            ]) {
                if (!point) {
                    continue
                }
                const x = Number(point.x)
                const y = Number(point.y)
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    xs.push(x)
                    ys.push(y)
                }
            }
        }
    }

    /**
     * Renders one dimension record.
     * @param {object} dimension Dimension record.
     * @param {number} index Fallback index.
     * @param {(dimension: object, index: number) => string | undefined} attributes Attribute callback.
     * @returns {string}
     */
    static #renderDimension(dimension, index, attributes) {
        const kind = PcbDimensionPrimitiveRenderer.#kind(dimension)
        const references = PcbDimensionPrimitiveRenderer.#references(dimension)
        const body = PcbDimensionPrimitiveRenderer.#bodyMarkup(
            kind,
            dimension,
            references
        )

        if (!body) {
            return ''
        }

        return (
            '<g class="pcb-dimension pcb-dimension--' +
            SchematicSvgUtils.escapeHtml(kind) +
            '"' +
            (typeof attributes === 'function'
                ? attributes(dimension, index) || ''
                : '') +
            '>' +
            body +
            '</g>'
        )
    }

    /**
     * Renders the kind-specific dimension body.
     * @param {string} kind Dimension kind.
     * @param {object} dimension Dimension record.
     * @param {{ x: number, y: number }[]} references Reference points.
     * @returns {string}
     */
    static #bodyMarkup(kind, dimension, references) {
        if (kind === 'angular') {
            return PcbDimensionPrimitiveRenderer.#angularMarkup(
                dimension,
                references
            )
        }

        if (['diameter', 'radial'].includes(kind)) {
            return PcbDimensionPrimitiveRenderer.#leaderMarkup(
                kind,
                dimension,
                references
            )
        }

        return PcbDimensionPrimitiveRenderer.#linearMarkup(
            dimension,
            references
        )
    }

    /**
     * Renders one linear dimension.
     * @param {object} dimension Dimension record.
     * @param {{ x: number, y: number }[]} references Reference points.
     * @returns {string}
     */
    static #linearMarkup(dimension, references) {
        if (references.length < 2) {
            return ''
        }

        const [start, end] = references
        const label = PcbDimensionPrimitiveRenderer.#labelPoint(
            dimension,
            start,
            end
        )
        const mid = PcbDimensionPrimitiveRenderer.#midpoint(start, end)

        return (
            PcbDimensionPrimitiveRenderer.#line(
                'pcb-dimension__measure',
                start,
                end
            ) +
            PcbDimensionPrimitiveRenderer.#line(
                'pcb-dimension__leader',
                mid,
                label
            ) +
            PcbDimensionPrimitiveRenderer.#label(dimension, label)
        )
    }

    /**
     * Renders one angular dimension.
     * @param {object} dimension Dimension record.
     * @param {{ x: number, y: number }[]} references Reference points.
     * @returns {string}
     */
    static #angularMarkup(dimension, references) {
        if (references.length < 3) {
            return ''
        }

        const [start, vertex, end] = references
        const startArc = PcbDimensionPrimitiveRenderer.#arcPoint(vertex, start)
        const endArc = PcbDimensionPrimitiveRenderer.#arcPoint(vertex, end)
        const radius = PcbDimensionPrimitiveRenderer.#distance(vertex, startArc)
        const sweep =
            PcbDimensionPrimitiveRenderer.#cross(vertex, start, end) >= 0
                ? 1
                : 0
        const label =
            PcbDimensionPrimitiveRenderer.#point(dimension?.textLocation) ||
            PcbDimensionPrimitiveRenderer.#midpoint(startArc, endArc)

        return (
            PcbDimensionPrimitiveRenderer.#line(
                'pcb-dimension__extension',
                vertex,
                start
            ) +
            PcbDimensionPrimitiveRenderer.#line(
                'pcb-dimension__extension',
                vertex,
                end
            ) +
            '<path class="pcb-dimension__arc" d="M ' +
            SchematicSvgUtils.formatNumber(startArc.x) +
            ' ' +
            SchematicSvgUtils.formatNumber(startArc.y) +
            ' A ' +
            SchematicSvgUtils.formatNumber(radius) +
            ' ' +
            SchematicSvgUtils.formatNumber(radius) +
            ' 0 0 ' +
            sweep +
            ' ' +
            SchematicSvgUtils.formatNumber(endArc.x) +
            ' ' +
            SchematicSvgUtils.formatNumber(endArc.y) +
            '" />' +
            PcbDimensionPrimitiveRenderer.#label(dimension, label)
        )
    }

    /**
     * Renders radial and diameter dimensions as leader dimensions.
     * @param {string} kind Dimension kind.
     * @param {object} dimension Dimension record.
     * @param {{ x: number, y: number }[]} references Reference points.
     * @returns {string}
     */
    static #leaderMarkup(kind, dimension, references) {
        if (references.length < 2) {
            return ''
        }

        const [start, end] = references
        const label = PcbDimensionPrimitiveRenderer.#labelPoint(
            dimension,
            start,
            end
        )
        const centerMark =
            kind === 'diameter'
                ? '<circle class="pcb-dimension__center" cx="' +
                  SchematicSvgUtils.formatNumber(start.x) +
                  '" cy="' +
                  SchematicSvgUtils.formatNumber(start.y) +
                  '" r="3" />'
                : ''

        return (
            centerMark +
            PcbDimensionPrimitiveRenderer.#line(
                'pcb-dimension__measure',
                start,
                end
            ) +
            PcbDimensionPrimitiveRenderer.#line(
                'pcb-dimension__leader',
                end,
                label
            ) +
            PcbDimensionPrimitiveRenderer.#label(dimension, label)
        )
    }

    /**
     * Renders one SVG line.
     * @param {string} className SVG class name.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {string}
     */
    static #line(className, start, end) {
        return (
            '<line class="' +
            className +
            '" x1="' +
            SchematicSvgUtils.formatNumber(start.x) +
            '" y1="' +
            SchematicSvgUtils.formatNumber(start.y) +
            '" x2="' +
            SchematicSvgUtils.formatNumber(end.x) +
            '" y2="' +
            SchematicSvgUtils.formatNumber(end.y) +
            '" />'
        )
    }

    /**
     * Renders one dimension label.
     * @param {object} dimension Dimension record.
     * @param {{ x: number, y: number }} point Label point.
     * @returns {string}
     */
    static #label(dimension, point) {
        const text =
            dimension?.text ||
            PcbDimensionPrimitiveRenderer.#formatMeasuredValue(dimension)
        if (!text) {
            return ''
        }

        return (
            '<text class="pcb-dimension__label" x="' +
            SchematicSvgUtils.formatNumber(point.x) +
            '" y="' +
            SchematicSvgUtils.formatNumber(point.y) +
            '">' +
            SchematicSvgUtils.escapeHtml(text) +
            '</text>'
        )
    }

    /**
     * Resolves a display label from measured numeric fields.
     * @param {object} dimension Dimension record.
     * @returns {string}
     */
    static #formatMeasuredValue(dimension) {
        const value =
            dimension?.kind === 'angular'
                ? dimension?.angleValue
                : dimension?.measuredValue
        if (!Number.isFinite(Number(value))) {
            return ''
        }

        return (
            SchematicSvgUtils.formatNumber(Number(value)) +
            (dimension?.unit ? ' ' + String(dimension.unit).trim() : '')
        )
    }

    /**
     * Resolves a label point with a midpoint fallback.
     * @param {object} dimension Dimension record.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {{ x: number, y: number }}
     */
    static #labelPoint(dimension, start, end) {
        return (
            PcbDimensionPrimitiveRenderer.#point(dimension?.textLocation) ||
            PcbDimensionPrimitiveRenderer.#midpoint(start, end)
        )
    }

    /**
     * Normalizes references into finite points.
     * @param {object} dimension Dimension record.
     * @returns {{ x: number, y: number }[]}
     */
    static #references(dimension) {
        return (dimension?.references || [])
            .map((reference) => PcbDimensionPrimitiveRenderer.#point(reference))
            .filter(Boolean)
    }

    /**
     * Normalizes one point-like object.
     * @param {object | null | undefined} point Point candidate.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(point) {
        const x = Number(point?.x)
        const y = Number(point?.y)
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Resolves the canonical dimension kind.
     * @param {object} dimension Dimension record.
     * @returns {string}
     */
    static #kind(dimension) {
        const kind = String(dimension?.kind || 'linear')
            .trim()
            .toLowerCase()
        return kind || 'linear'
    }

    /**
     * Returns the midpoint between two points.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {{ x: number, y: number }}
     */
    static #midpoint(start, end) {
        return {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2
        }
    }

    /**
     * Returns a stable point on an angular dimension arc.
     * @param {{ x: number, y: number }} vertex Arc center.
     * @param {{ x: number, y: number }} reference Reference point.
     * @returns {{ x: number, y: number }}
     */
    static #arcPoint(vertex, reference) {
        const dx = reference.x - vertex.x
        const dy = reference.y - vertex.y
        const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const radius = Math.min(Math.max(length * 0.55, 16), 80)

        return {
            x: vertex.x + (dx / length) * radius,
            y: vertex.y + (dy / length) * radius
        }
    }

    /**
     * Calculates distance between two points.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {number}
     */
    static #distance(start, end) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        return Math.max(Math.sqrt(dx * dx + dy * dy), 1)
    }

    /**
     * Calculates the sign of the angle from start to end around vertex.
     * @param {{ x: number, y: number }} vertex Vertex point.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {number}
     */
    static #cross(vertex, start, end) {
        return (
            (start.x - vertex.x) * (end.y - vertex.y) -
            (start.y - vertex.y) * (end.x - vertex.x)
        )
    }
}
