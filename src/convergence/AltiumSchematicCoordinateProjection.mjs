// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

const POINT_FIELDS = [
    'anchor_position',
    'center',
    'end',
    'mid',
    'position',
    'start'
]
const POINT_LIST_FIELDS = ['junctions', 'outline', 'points']

/**
 * Converts Altium's bottom-origin schematic geometry to canonical SVG space.
 */
export class AltiumSchematicCoordinateProjection {
    /**
     * Reflects only schematic geometry through the authored sheet height.
     * @param {object[]} model CircuitJSON model rows.
     * @param {unknown} sheetHeight Native rendered sheet height.
     * @returns {object[]} Projected model rows.
     */
    static project(model, sheetHeight) {
        const height = Number(sheetHeight)
        if (!Number.isFinite(height) || height <= 0) return [...model]
        return model.map((element) =>
            String(element?.type || '').startsWith('schematic_') &&
            element.type !== 'schematic_sheet'
                ? AltiumSchematicCoordinateProjection.#element(element, height)
                : element
        )
    }

    /**
     * Reflects every common point-bearing field on one schematic row.
     * @param {Record<string, any>} element CircuitJSON element.
     * @param {number} height Sheet height.
     * @returns {Record<string, any>} Reflected element.
     */
    static #element(element, height) {
        const projected = { ...element }
        for (const field of POINT_FIELDS) {
            if (element[field] !== undefined) {
                projected[field] = AltiumSchematicCoordinateProjection.#point(
                    element[field],
                    height
                )
            }
        }
        for (const field of POINT_LIST_FIELDS) {
            if (Array.isArray(element[field])) {
                projected[field] = element[field].map((point) =>
                    AltiumSchematicCoordinateProjection.#point(point, height)
                )
            }
        }
        for (const field of ['y', 'y1', 'y2']) {
            const value = Number(element[field])
            if (Number.isFinite(value)) projected[field] = height - value
        }
        if (Array.isArray(element.edges)) {
            projected.edges = element.edges.map((edge) => ({
                ...edge,
                ...(edge?.from
                    ? {
                          from: AltiumSchematicCoordinateProjection.#point(
                              edge.from,
                              height
                          )
                      }
                    : {}),
                ...(edge?.to
                    ? {
                          to: AltiumSchematicCoordinateProjection.#point(
                              edge.to,
                              height
                          )
                      }
                    : {})
            }))
        }
        if (element.type === 'schematic_arc') {
            for (const field of ['start_angle_degrees', 'end_angle_degrees']) {
                if (
                    Object.hasOwn(element, field) &&
                    Number.isFinite(Number(element[field]))
                ) {
                    projected[field] =
                        AltiumSchematicCoordinateProjection.#angle(
                            element[field]
                        )
                }
            }
            if (element.direction === 'clockwise') {
                projected.direction = 'counterclockwise'
            } else if (element.direction === 'counterclockwise') {
                projected.direction = 'clockwise'
            }
        }
        return projected
    }

    /**
     * Reflects an angle while keeping canonical zero positive.
     * @param {unknown} value Angle candidate.
     * @returns {number} Reflected angle.
     */
    static #angle(value) {
        const angle = Number(value || 0)
        return angle ? -angle : 0
    }

    /**
     * Reflects one point without dropping its relation metadata.
     * @param {unknown} value Point candidate.
     * @param {number} height Sheet height.
     * @returns {unknown} Reflected point or the original value.
     */
    static #point(value, height) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return value
        }
        const y = Number(value.y)
        return Number.isFinite(y) ? { ...value, y: height - y } : value
    }
}

Object.freeze(AltiumSchematicCoordinateProjection.prototype)
Object.freeze(AltiumSchematicCoordinateProjection)
