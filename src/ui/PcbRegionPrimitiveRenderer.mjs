// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders filled PCB region contours into SVG path markup.
 */
export class PcbRegionPrimitiveRenderer {
    /**
     * Builds SVG path markup for filled PCB regions.
     * @param {{ points?: object[], holes?: object[][] }[]} regions
     * @param {string} className
     * @returns {string}
     */
    static buildMarkup(regions, className) {
        return (regions || [])
            .map((region) =>
                PcbRegionPrimitiveRenderer.#renderRegion(region, className)
            )
            .join('')
    }

    /**
     * Returns true when one region intersects a bounds object.
     * @param {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }} region
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static intersectsBounds(region, bounds) {
        const regionBounds = PcbRegionPrimitiveRenderer.bounds(region)
        if (!regionBounds) {
            return false
        }

        return !(
            regionBounds.maxX < bounds.minX ||
            regionBounds.minX > bounds.maxX ||
            regionBounds.maxY < bounds.minY ||
            regionBounds.minY > bounds.maxY
        )
    }

    /**
     * Computes a bounding box for one filled region.
     * @param {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }} region
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static bounds(region) {
        const points = [
            ...(region?.points || []),
            ...(region?.holes || []).flat()
        ].filter(
            (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
        )

        if (!points.length) {
            return null
        }

        return {
            minX: Math.min(...points.map((point) => Number(point.x))),
            minY: Math.min(...points.map((point) => Number(point.y))),
            maxX: Math.max(...points.map((point) => Number(point.x))),
            maxY: Math.max(...points.map((point) => Number(point.y)))
        }
    }

    /**
     * Pushes one region's extent into viewBox coordinate arrays.
     * @param {number[]} xs
     * @param {number[]} ys
     * @param {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }} region
     */
    static pushExtents(xs, ys, region) {
        const bounds = PcbRegionPrimitiveRenderer.bounds(region)
        if (!bounds) {
            return
        }

        xs.push(bounds.minX, bounds.maxX)
        ys.push(bounds.minY, bounds.maxY)
    }

    /**
     * Renders one filled region path.
     * @param {{ points?: object[], holes?: object[][] }} region
     * @param {string} className
     * @returns {string}
     */
    static #renderRegion(region, className) {
        const path = PcbRegionPrimitiveRenderer.#buildRegionPath(region)
        if (!path) {
            return ''
        }

        return (
            '<path class="' +
            SchematicSvgUtils.escapeHtml(className) +
            '" d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '" fill-rule="evenodd" />'
        )
    }

    /**
     * Builds one SVG path containing the outline and holes.
     * @param {{ points?: object[], holes?: object[][] }} region
     * @returns {string}
     */
    static #buildRegionPath(region) {
        const paths = [
            PcbRegionPrimitiveRenderer.#buildPointPath(region?.points || [])
        ]

        for (const hole of region?.holes || []) {
            paths.push(PcbRegionPrimitiveRenderer.#buildPointPath(hole))
        }

        return paths.filter(Boolean).join(' ')
    }

    /**
     * Builds one closed contour path from region points.
     * @param {object[]} points
     * @returns {string}
     */
    static #buildPointPath(points) {
        const contour =
            PcbRegionPrimitiveRenderer.#withoutClosingDuplicate(points)
        if (contour.length < 3) {
            return ''
        }

        const [first] = contour
        const commands = [
            'M ' +
                SchematicSvgUtils.formatNumber(first.x) +
                ' ' +
                SchematicSvgUtils.formatNumber(first.y)
        ]

        for (let index = 0; index < contour.length - 1; index += 1) {
            const current = contour[index]
            const next = contour[index + 1]
            commands.push(
                PcbRegionPrimitiveRenderer.#segmentCommand(current, next)
            )
        }

        const last = contour[contour.length - 1]
        if (PcbRegionPrimitiveRenderer.#isArcPoint(last)) {
            commands.push(
                PcbRegionPrimitiveRenderer.#segmentCommand(last, first)
            )
        }

        commands.push('Z')
        return commands.join(' ')
    }

    /**
     * Builds one line or arc segment command.
     * @param {object} current
     * @param {object} next
     * @returns {string}
     */
    static #segmentCommand(current, next) {
        if (PcbRegionPrimitiveRenderer.#isArcPoint(current)) {
            const delta =
                PcbRegionPrimitiveRenderer.#normalizeAngle(
                    Number(current.endAngle || 0) -
                        Number(current.startAngle || 0)
                ) || 360
            return (
                'A ' +
                SchematicSvgUtils.formatNumber(current.radius) +
                ' ' +
                SchematicSvgUtils.formatNumber(current.radius) +
                ' 0 ' +
                (delta > 180 ? '1' : '0') +
                ' ' +
                (Number(current.endAngle || 0) >=
                Number(current.startAngle || 0)
                    ? '1'
                    : '0') +
                ' ' +
                SchematicSvgUtils.formatNumber(next.x) +
                ' ' +
                SchematicSvgUtils.formatNumber(next.y)
            )
        }

        return (
            'L ' +
            SchematicSvgUtils.formatNumber(next.x) +
            ' ' +
            SchematicSvgUtils.formatNumber(next.y)
        )
    }

    /**
     * Removes an explicit duplicate closing vertex when present.
     * @param {object[]} points
     * @returns {object[]}
     */
    static #withoutClosingDuplicate(points) {
        if ((points || []).length < 2) {
            return points || []
        }

        const first = points[0]
        const last = points[points.length - 1]
        if (
            Math.abs(Number(first.x) - Number(last.x)) < 1e-6 &&
            Math.abs(Number(first.y) - Number(last.y)) < 1e-6
        ) {
            return points.slice(0, -1)
        }

        return points
    }

    /**
     * Checks whether one region point represents an arc segment.
     * @param {object | undefined} point
     * @returns {boolean}
     */
    static #isArcPoint(point) {
        return Boolean(point?.isArc && Number(point.radius || 0) > 0)
    }

    /**
     * Normalizes one angle delta into [0, 360).
     * @param {number} angle
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360
        return normalized < 0 ? normalized + 360 : normalized
    }
}
