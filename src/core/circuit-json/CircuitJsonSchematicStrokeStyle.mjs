// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { CircuitJsonModelAdapterPrimitives } from './CircuitJsonModelAdapterPrimitives.mjs'

/**
 * Projects native Altium schematic strokes onto common CircuitJSON style.
 */
export class CircuitJsonSchematicStrokeStyle {
    /**
     * Preserves one authored line style without source-specific renderer logic.
     * @param {Record<string, unknown>} primitive Native schematic primitive.
     * @param {unknown} width Authored stroke width.
     * @returns {{ is_dashed: boolean, stroke_dasharray?: number[], stroke_linecap?: 'round' }}
     */
    static fields(primitive, width) {
        const lineStyle = Number(primitive?.lineStyle || 0)
        const isDashed = primitive?.dashed === true || lineStyle !== 0
        if (![1, 2, 3].includes(lineStyle)) {
            return { is_dashed: isDashed }
        }

        const authoredWidth = Number(width || 1)
        const resolvedWidth = Number.isFinite(authoredWidth) ? authoredWidth : 1
        const dashLength = Math.max(resolvedWidth * 8, 8)
        const gapLength = Math.max(resolvedWidth * 5, 5)
        const dotLength = Math.max(resolvedWidth * 1.5, 1.5)
        const dasharray =
            lineStyle === 1
                ? [dashLength, gapLength]
                : lineStyle === 2
                  ? [dotLength, gapLength]
                  : [dashLength, gapLength, dotLength, gapLength]

        return {
            is_dashed: true,
            stroke_dasharray: dasharray.map((value) =>
                CircuitJsonModelAdapterPrimitives.round(value)
            ),
            stroke_linecap: 'round'
        }
    }
}

Object.freeze(CircuitJsonSchematicStrokeStyle.prototype)
Object.freeze(CircuitJsonSchematicStrokeStyle)
