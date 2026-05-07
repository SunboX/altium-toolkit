// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Maps Altium pad, drill, and pad-stack mode codes to stable model labels.
 */
export class PcbPadShapeCodec {
    static #PAD_SHAPE_NAMES = new Map([
        [0, 'none'],
        [1, 'round'],
        [2, 'rectangular'],
        [3, 'octagonal'],
        [9, 'rounded-rectangle']
    ])

    static #HOLE_SHAPE_NAMES = new Map([
        [-1, 'none'],
        [0, 'round'],
        [1, 'square'],
        [2, 'slot']
    ])

    static #PAD_MODE_NAMES = new Map([
        [0, 'simple'],
        [1, 'top-middle-bottom'],
        [2, 'full-stack']
    ])

    /**
     * Returns a stable normalized label for one raw pad shape code.
     * @param {number | null | undefined} shape
     * @returns {string | null}
     */
    static padShapeName(shape) {
        return PcbPadShapeCodec.#mappedCodeName(
            shape,
            PcbPadShapeCodec.#PAD_SHAPE_NAMES
        )
    }

    /**
     * Returns a stable normalized label for one raw drill-hole shape code.
     * @param {number | null | undefined} shape
     * @returns {string | null}
     */
    static holeShapeName(shape) {
        return PcbPadShapeCodec.#mappedCodeName(
            shape,
            PcbPadShapeCodec.#HOLE_SHAPE_NAMES
        )
    }

    /**
     * Returns a stable normalized label for one raw pad stack mode code.
     * @param {number | null | undefined} mode
     * @returns {string | null}
     */
    static padModeName(mode) {
        return PcbPadShapeCodec.#mappedCodeName(
            mode,
            PcbPadShapeCodec.#PAD_MODE_NAMES
        )
    }

    /**
     * Builds normalized top/middle/bottom shape labels for one pad.
     * @param {{ shapeTop?: number, shapeMid?: number, shapeBottom?: number }} pad
     * @returns {{ shapeTopName: string | null, shapeMidName: string | null, shapeBottomName: string | null, padShapeNames: { top: string | null, middle: string | null, bottom: string | null } }}
     */
    static describePadShapes(pad) {
        const top = PcbPadShapeCodec.padShapeName(pad.shapeTop)
        const middle = PcbPadShapeCodec.padShapeName(pad.shapeMid)
        const bottom = PcbPadShapeCodec.padShapeName(pad.shapeBottom)

        return {
            shapeTopName: top,
            shapeMidName: middle,
            shapeBottomName: bottom,
            padShapeNames: {
                top,
                middle,
                bottom
            }
        }
    }

    /**
     * Adds normalized names and an effective fallback to one middle-layer shape.
     * @param {number} shape
     * @param {number | null | undefined} fallbackShape
     * @returns {{ shape: number, shapeName: string | null, effectiveShape: number, effectiveShapeName: string | null }}
     */
    static describeMiddleLayerShape(shape, fallbackShape) {
        const effectiveShape =
            Number(shape) === 0 && Number.isFinite(Number(fallbackShape))
                ? Number(fallbackShape)
                : Number(shape)

        return {
            shape: Number(shape),
            shapeName: PcbPadShapeCodec.padShapeName(shape),
            effectiveShape,
            effectiveShapeName: PcbPadShapeCodec.padShapeName(effectiveShape)
        }
    }

    /**
     * Builds normalized slot or drill geometry for one parsed pad hole.
     * @param {{ shape: number | null, diameter: number, slotLength: number | null, rotation: number | null }} hole
     * @returns {{ shape: number, shapeName: string | null, diameter: number, slotLength: number | null, rotation: number | null, length: number, width: number } | null}
     */
    static describeHoleGeometry(hole) {
        if (hole.shape === null || hole.shape === undefined) {
            return null
        }

        const diameter = Number(hole.diameter || 0)
        const slotLength = Number(hole.slotLength || 0) || null
        const length =
            PcbPadShapeCodec.holeShapeName(hole.shape) === 'slot'
                ? Math.max(Number(slotLength || 0), diameter)
                : diameter

        return {
            shape: Number(hole.shape),
            shapeName: PcbPadShapeCodec.holeShapeName(hole.shape),
            diameter,
            slotLength,
            rotation: hole.rotation ?? null,
            length,
            width: diameter
        }
    }

    /**
     * Resolves a code through a mapping table while preserving unknown values.
     * @param {number | null | undefined} code
     * @param {Map<number, string>} mapping
     * @returns {string | null}
     */
    static #mappedCodeName(code, mapping) {
        if (code === null || code === undefined) {
            return null
        }

        const numericCode = Number(code)
        if (!Number.isFinite(numericCode)) {
            return null
        }

        if (mapping.has(numericCode)) {
            return mapping.get(numericCode) ?? null
        }

        return `unknown-${numericCode}`
    }
}
