// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicColorResolver } from './SchematicColorResolver.mjs'

/**
 * Resolves schematic line stroke colors from normalized line metadata.
 */
export class SchematicLineColorResolver {
    /**
     * Resolves one schematic line stroke color.
     * @param {{ color?: string, ownerIndex?: string, isBus?: boolean, recordType?: string, x1?: number, x2?: number }} line Line primitive.
     * @returns {string}
     */
    static resolveColor(line) {
        if (SchematicLineColorResolver.isElectricalLine(line)) {
            return SchematicColorResolver.resolveNonTextColor(
                line?.color,
                '--schematic-default-ink-color'
            )
        }

        if (SchematicLineColorResolver.#isOwnerVerticalLine(line)) {
            const resolvedColor = SchematicColorResolver.resolveNonTextColor(
                line?.color,
                '--schematic-default-ink-color',
                true
            )
            return resolvedColor.startsWith('var(')
                ? resolvedColor
                : SchematicColorResolver.resolveMutedSourceColor(
                      line?.color,
                      '--schematic-default-ink-color'
                  )
        }

        return SchematicColorResolver.resolveNonTextColor(
            line?.color,
            '--schematic-default-ink-color'
        )
    }

    /**
     * Returns true when one normalized line can carry schematic net color.
     * @param {{ ownerIndex?: string, isBus?: boolean, recordType?: string } | null | undefined} line Line primitive.
     * @returns {boolean}
     */
    static isElectricalLine(line) {
        if (line?.ownerIndex || line?.isBus === true) {
            return false
        }

        if (!Object.prototype.hasOwnProperty.call(line || {}, 'recordType')) {
            return true
        }

        return !['6', '7', '26'].includes(String(line.recordType || ''))
    }

    /**
     * Returns true when owner geometry encodes a vertical side rail as a line.
     * @param {{ ownerIndex?: string, x1?: number, x2?: number } | null | undefined} line Line primitive.
     * @returns {boolean}
     */
    static #isOwnerVerticalLine(line) {
        return (
            Boolean(String(line?.ownerIndex || '').trim()) &&
            SchematicLineColorResolver.#isVerticalLine(line)
        )
    }

    /**
     * Returns true when one line is vertical within parser coordinate tolerance.
     * @param {{ x1?: number, x2?: number } | null | undefined} line Line primitive.
     * @returns {boolean}
     */
    static #isVerticalLine(line) {
        const x1 = Number(line?.x1)
        const x2 = Number(line?.x2)

        return (
            Number.isFinite(x1) &&
            Number.isFinite(x2) &&
            Math.abs(x1 - x2) <= 0.001
        )
    }
}
