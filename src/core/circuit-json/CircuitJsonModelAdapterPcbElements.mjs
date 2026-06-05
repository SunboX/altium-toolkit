// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { CircuitJsonModelAdapterPrimitives } from './CircuitJsonModelAdapterPrimitives.mjs'

const Primitives = CircuitJsonModelAdapterPrimitives

/**
 * Builds upstream-compatible Circuit JSON PCB element records.
 */
export class CircuitJsonModelAdapterPcbElements {
    /**
     * Builds an upstream-compatible SMT pad element.
     * @param {string} idScope
     * @param {Record<string, unknown>} pad
     * @param {number} padIndex
     * @param {string} pcbComponentId
     * @param {string} pcbPortId
     * @param {{ x: number, y: number }} center
     * @param {string} layer
     * @param {string[]} portHints
     * @returns {object}
     */
    static smtPad(
        idScope,
        pad,
        padIndex,
        pcbComponentId,
        pcbPortId,
        center,
        layer,
        portHints
    ) {
        const shape = Primitives.padShape(pad)
        const width = Primitives.milNumber(
            pad.sizeTopX || pad.sizeX || pad.width,
            0
        )
        const height = Primitives.milNumber(
            pad.sizeTopY || pad.sizeY || pad.height,
            0
        )
        const rotation = Primitives.number(pad.rotation || pad.holeRotation, 0)
        const base = {
            type: 'pcb_smtpad',
            pcb_smtpad_id: Primitives.id(idScope, ['pcb_smtpad', padIndex]),
            pcb_component_id: pcbComponentId,
            pcb_port_id: pcbPortId,
            x: center.x,
            y: center.y,
            layer,
            port_hints: portHints
        }

        if (shape === 'circle') {
            return {
                ...base,
                shape,
                radius: Primitives.round(Math.max(width, height) / 2)
            }
        }

        if (shape === 'pill') {
            return {
                ...base,
                shape: CircuitJsonModelAdapterPcbElements.#hasRotation(rotation)
                    ? 'rotated_pill'
                    : 'pill',
                width,
                height,
                radius: Primitives.round(Math.min(width, height) / 2),
                ...CircuitJsonModelAdapterPcbElements.#ccwRotationField(
                    rotation
                )
            }
        }

        return {
            ...base,
            shape: CircuitJsonModelAdapterPcbElements.#hasRotation(rotation)
                ? 'rotated_rect'
                : 'rect',
            width,
            height,
            ...CircuitJsonModelAdapterPcbElements.#ccwRotationField(rotation)
        }
    }

    /**
     * Builds an upstream-compatible non-plated hole element.
     * @param {string} idScope
     * @param {Record<string, unknown>} pad
     * @param {number} padIndex
     * @param {string} pcbComponentId
     * @param {{ x: number, y: number }} center
     * @returns {object}
     */
    static hole(idScope, pad, padIndex, pcbComponentId, center) {
        const shape = Primitives.padShape(pad)
        const width = Primitives.milNumber(
            pad.sizeTopX || pad.sizeX || pad.width || pad.diameter,
            0
        )
        const height = Primitives.milNumber(
            pad.sizeTopY || pad.sizeY || pad.height || pad.diameter,
            0
        )
        const holeDiameter = Primitives.milNumber(pad.holeDiameter, 0)
        const base = {
            type: 'pcb_hole',
            pcb_hole_id: Primitives.id(idScope, ['pcb_hole', padIndex]),
            pcb_component_id: pcbComponentId,
            x: center.x,
            y: center.y
        }

        if (shape === 'circle') {
            return {
                ...base,
                hole_shape: 'circle',
                hole_diameter: holeDiameter
            }
        }

        return {
            ...base,
            hole_shape: shape === 'pill' ? 'pill' : 'rect',
            hole_width: holeDiameter || width,
            hole_height: holeDiameter || height
        }
    }

    /**
     * Builds an upstream-compatible plated hole element.
     * @param {string} idScope
     * @param {Record<string, unknown>} pad
     * @param {number} padIndex
     * @param {string} pcbComponentId
     * @param {string} pcbPortId
     * @param {{ x: number, y: number }} center
     * @param {string[]} portHints
     * @returns {object}
     */
    static platedHole(
        idScope,
        pad,
        padIndex,
        pcbComponentId,
        pcbPortId,
        center,
        portHints
    ) {
        const shape = Primitives.padShape(pad)
        const width = Primitives.milNumber(
            pad.sizeTopX || pad.sizeX || pad.width || pad.diameter,
            0
        )
        const height = Primitives.milNumber(
            pad.sizeTopY || pad.sizeY || pad.height || pad.diameter,
            0
        )
        const holeDiameter = Primitives.milNumber(pad.holeDiameter, 0)
        const rotation = Primitives.number(pad.rotation || pad.holeRotation, 0)
        const base = {
            type: 'pcb_plated_hole',
            pcb_plated_hole_id: Primitives.id(idScope, [
                'pcb_plated_hole',
                padIndex
            ]),
            pcb_component_id: pcbComponentId,
            pcb_port_id: pcbPortId,
            x: center.x,
            y: center.y,
            layers: ['top', 'bottom'],
            port_hints: portHints
        }

        if (shape === 'circle') {
            return {
                ...base,
                shape,
                outer_diameter: Primitives.round(Math.max(width, height)),
                hole_diameter: holeDiameter
            }
        }

        if (shape === 'pill') {
            return {
                ...base,
                shape,
                outer_width: width,
                outer_height: height,
                hole_width: holeDiameter,
                hole_height: holeDiameter,
                ccw_rotation: rotation
            }
        }

        return {
            ...base,
            shape: 'circular_hole_with_rect_pad',
            hole_shape: 'circle',
            pad_shape: 'rect',
            hole_diameter: holeDiameter,
            rect_pad_width: width,
            rect_pad_height: height,
            ...CircuitJsonModelAdapterPcbElements.#rectCcwRotationField(
                rotation
            )
        }
    }

    /**
     * Returns true when a rotation value should use a rotated pad shape.
     * @param {number | null} rotation
     * @returns {boolean}
     */
    static #hasRotation(rotation) {
        return Math.abs(rotation || 0) > 0.000001
    }

    /**
     * Returns an optional counter-clockwise rotation field.
     * @param {number | null} rotation
     * @returns {{ ccw_rotation?: number }}
     */
    static #ccwRotationField(rotation) {
        return CircuitJsonModelAdapterPcbElements.#hasRotation(rotation)
            ? { ccw_rotation: rotation || 0 }
            : {}
    }

    /**
     * Returns an optional rectangular pad rotation field.
     * @param {number | null} rotation
     * @returns {{ rect_ccw_rotation?: number }}
     */
    static #rectCcwRotationField(rotation) {
        return CircuitJsonModelAdapterPcbElements.#hasRotation(rotation)
            ? { rect_ccw_rotation: rotation || 0 }
            : {}
    }
}
