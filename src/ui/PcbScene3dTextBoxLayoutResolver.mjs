// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves Altium TrueType text-box metadata for 3D scene consumers.
 */
export class PcbScene3dTextBoxLayoutResolver {
    static #COMPACT_IMPLICIT_WIDTH_RATIO = 2.25

    /**
     * Resolves one Altium inverted text box into renderable dimensions.
     * @param {{ isInverted?: boolean, useInvertedRectangle?: boolean, textboxRectWidth?: number, textboxRectHeight?: number, textboxRectJustification?: number, marginBorderWidth?: number, height?: number }} text
     * @returns {{ source: string, mode: 'explicit' | 'implicit', compact: boolean, widthMil: number, heightMil: number, marginMil: number, renderWidthMil: number, renderHeightMil: number, justification: { column: number, row: number } | null } | null}
     */
    static resolve(text) {
        const width = Number(text?.textboxRectWidth)
        const height = Number(text?.textboxRectHeight)

        if (
            !Boolean(text?.isInverted) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return null
        }

        const mode = Boolean(text?.useInvertedRectangle)
            ? 'explicit'
            : 'implicit'
        const margin = PcbScene3dTextBoxLayoutResolver.#margin(text)
        const compact =
            mode === 'implicit' &&
            width <=
                PcbScene3dTextBoxLayoutResolver.#height(text) *
                    PcbScene3dTextBoxLayoutResolver
                        .#COMPACT_IMPLICIT_WIDTH_RATIO
        const border = compact ? margin * 2 : 0

        return {
            source: 'altium-textbox',
            mode,
            compact,
            widthMil: width,
            heightMil: height,
            marginMil: margin,
            renderWidthMil: width + border,
            renderHeightMil: height + border,
            justification: PcbScene3dTextBoxLayoutResolver.#justification(text)
        }
    }

    /**
     * Resolves one non-negative margin value.
     * @param {{ marginBorderWidth?: number }} text
     * @returns {number}
     */
    static #margin(text) {
        const margin = Number(text?.marginBorderWidth)

        return Number.isFinite(margin) && margin >= 0 ? margin : 0
    }

    /**
     * Resolves the authored text height used for compact box detection.
     * @param {{ height?: number }} text
     * @returns {number}
     */
    static #height(text) {
        return Math.max(Number(text?.height || 0), 1)
    }

    /**
     * Decodes Altium's three-by-three text-box justification code.
     * @param {{ textboxRectJustification?: number }} text
     * @returns {{ column: number, row: number } | null}
     */
    static #justification(text) {
        const justification = Number(text?.textboxRectJustification)

        if (!Number.isInteger(justification) || justification <= 0) {
            return null
        }

        return {
            column: Math.max(
                0,
                Math.min(2, Math.floor((justification - 1) / 3))
            ),
            row: (justification - 1) % 3
        }
    }
}
