// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Builds PCB arc markup and geometry helpers for renderer layout decisions.
 */
export class PcbArcUtils {
    static #FULL_CIRCLE_EPSILON = 0.001

    static #CROSS_PRODUCT_EPSILON = 1e-9

    /**
     * Builds one PCB arc or authored circle as SVG markup.
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number }} arc
     * @param {string} className
     * @returns {string}
     */
    static buildMarkup(arc, className) {
        const radius = Math.max(Number(arc.radius || 0), 0.8)
        const strokeWidth = Math.max(Number(arc.width || 0), 1)

        if (PcbArcUtils.#isFullCircle(arc)) {
            return (
                '<circle class="' +
                SchematicSvgUtils.escapeHtml(className) +
                '" cx="' +
                SchematicSvgUtils.formatNumber(Number(arc.x || 0)) +
                '" cy="' +
                SchematicSvgUtils.formatNumber(Number(arc.y || 0)) +
                '" r="' +
                SchematicSvgUtils.formatNumber(radius) +
                '" stroke-width="' +
                SchematicSvgUtils.formatNumber(strokeWidth) +
                '" fill="none" />'
            )
        }

        return (
            '<path class="' +
            SchematicSvgUtils.escapeHtml(className) +
            '" d="' +
            SchematicSvgUtils.escapeHtml(PcbArcUtils.#buildPath(arc, radius)) +
            '" stroke-width="' +
            SchematicSvgUtils.formatNumber(strokeWidth) +
            '" fill="none" />'
        )
    }

    /**
     * Pushes one conservative arc bounding box into running axis lists.
     * @param {number[]} xs
     * @param {number[]} ys
     * @param {{ x: number, y: number, radius: number, width?: number }} arc
     * @returns {void}
     */
    static pushExtents(xs, ys, arc) {
        const radius =
            Math.max(Number(arc.radius || 0), 0) +
            Math.max(Number(arc.width || 0), 1) / 2
        const centerX = Number(arc.x || 0)
        const centerY = Number(arc.y || 0)

        xs.push(centerX - radius, centerX + radius)
        ys.push(centerY - radius, centerY + radius)
    }

    /**
     * Returns true when one arc overlaps a local component search box.
     * @param {{ x: number, y: number, radius: number, width?: number }} arc
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static intersectsBounds(arc, bounds) {
        const radius =
            Math.max(Number(arc.radius || 0), 0) +
            Math.max(Number(arc.width || 0), 1) / 2
        const centerX = Number(arc.x || 0)
        const centerY = Number(arc.y || 0)

        return !(
            centerX + radius < bounds.minX ||
            centerX - radius > bounds.maxX ||
            centerY + radius < bounds.minY ||
            centerY - radius > bounds.maxY
        )
    }

    /**
     * Builds one SVG arc path command from normalized PCB arc geometry.
     * @param {{ x: number, y: number, startAngle: number, endAngle: number }} arc
     * @param {number} radius
     * @returns {string}
     */
    static #buildPath(arc, radius) {
        const start = PcbArcUtils.#projectPoint(arc, arc.startAngle, radius)
        const end = PcbArcUtils.#projectPoint(arc, arc.endAngle, radius)
        const delta = PcbArcUtils.resolveSweepDelta(
            arc.startAngle,
            arc.endAngle
        )

        return (
            'M ' +
            SchematicSvgUtils.formatNumber(start.x) +
            ' ' +
            SchematicSvgUtils.formatNumber(start.y) +
            ' A ' +
            SchematicSvgUtils.formatNumber(radius) +
            ' ' +
            SchematicSvgUtils.formatNumber(radius) +
            ' 0 ' +
            (Math.abs(delta) > 180 ? 1 : 0) +
            ' ' +
            (delta >= 0 ? 1 : 0) +
            ' ' +
            SchematicSvgUtils.formatNumber(end.x) +
            ' ' +
            SchematicSvgUtils.formatNumber(end.y)
        )
    }

    /**
     * Projects one normalized PCB arc point into SVG coordinates.
     * @param {{ x: number, y: number }} arc
     * @param {number} angle
     * @param {number} radius
     * @returns {{ x: number, y: number }}
     */
    static #projectPoint(arc, angle, radius) {
        const radians = (Number(angle || 0) * Math.PI) / 180

        return {
            x: Number(arc.x || 0) + radius * Math.cos(radians),
            y: Number(arc.y || 0) + radius * Math.sin(radians)
        }
    }

    /**
     * Returns true when one arc spans a full circle.
     * @param {{ startAngle: number, endAngle: number }} arc
     * @returns {boolean}
     */
    static #isFullCircle(arc) {
        const rawDelta = Number(arc.endAngle || 0) - Number(arc.startAngle || 0)

        return (
            Math.abs(rawDelta) <= PcbArcUtils.#FULL_CIRCLE_EPSILON ||
            Math.abs(rawDelta) >= 360 - PcbArcUtils.#FULL_CIRCLE_EPSILON
        )
    }

    /**
     * Normalizes one PCB arc delta to the intended short wrapped sweep.
     * @param {number} startAngle
     * @param {number} endAngle
     * @returns {number}
     */
    static resolveSweepDelta(startAngle, endAngle) {
        const rawDelta = Number(endAngle || 0) - Number(startAngle || 0)
        let normalizedDelta = ((rawDelta + 540) % 360) - 180

        if (
            Math.abs(normalizedDelta + 180) <=
                PcbArcUtils.#FULL_CIRCLE_EPSILON &&
            rawDelta > 0
        ) {
            normalizedDelta = 180
        }

        return normalizedDelta
    }

    /**
     * Resolves the short SVG sweep direction for one arc from its authored
     * center and endpoint geometry.
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number, cx?: number, cy?: number, startAngle?: number, endAngle?: number }} segment
     * @returns {0 | 1}
     */
    static resolveShortSweepFromCenter(segment) {
        const startDeltaX = Number(segment.x1 || 0) - Number(segment.cx || 0)
        const startDeltaY = Number(segment.y1 || 0) - Number(segment.cy || 0)
        const endDeltaX = Number(segment.x2 || 0) - Number(segment.cx || 0)
        const endDeltaY = Number(segment.y2 || 0) - Number(segment.cy || 0)
        const crossProduct = startDeltaX * endDeltaY - startDeltaY * endDeltaX

        if (Math.abs(crossProduct) > PcbArcUtils.#CROSS_PRODUCT_EPSILON) {
            return crossProduct > 0 ? 1 : 0
        }

        const startAngle = Number(segment.startAngle)
        const endAngle = Number(segment.endAngle)
        if (Number.isFinite(startAngle) && Number.isFinite(endAngle)) {
            // Board-outline segment angles come from board-space arc records;
            // after the endpoints are in SVG space, exact half-circles need
            // the opposite SVG sweep to select the authored side.
            return PcbArcUtils.resolveSweepDelta(startAngle, endAngle) >= 0
                ? 0
                : 1
        }

        return 1
    }
}
