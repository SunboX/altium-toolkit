// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Shared layout helpers for explicit owner pin-name labels and their paired
 * synthetic pin-number clearance.
 */
export class SchematicOwnerPinLabelLayout {
    /**
     * Builds one owner/pin label key.
     * @param {string | undefined} ownerIndex
     * @param {string | undefined} name
     * @returns {string}
     */
    static buildOwnerPinLabelKey(ownerIndex, name) {
        const normalizedOwnerIndex = String(ownerIndex || '').trim()
        const normalizedName = String(name || '').trim()

        if (!normalizedOwnerIndex || !normalizedName) {
            return ''
        }

        return normalizedOwnerIndex + '::' + normalizedName
    }

    /**
     * Returns one matched owner pin when a free text primitive is explicitly
     * reusing that pin name.
     * @param {{ text?: string, ownerIndex?: string }} text
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {{ x: number, y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' } | null}
     */
    static findExplicitOwnerPinLabelMatch(text, pins) {
        const ownerIndex = String(text?.ownerIndex || '').trim()
        const label = String(text?.text || '').trim()

        if (!ownerIndex || !label) {
            return null
        }

        return (
            pins.find(
                (pin) =>
                    String(pin.ownerIndex || '').trim() === ownerIndex &&
                    String(pin.name || '').trim() === label
            ) || null
        )
    }

    /**
     * Reuses the matched pin axis for mirrored vertical owner pin-name labels
     * while keeping their authored run distance along that axis.
     * @param {{ x: number, y: number, recordType?: string, rotation?: number, isMirrored?: boolean }} text
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' } | null} matchedOwnerPin
     * @returns {{ x: number, y: number } | null}
     */
    static resolveMirroredOwnerPinLabelPlacement(text, matchedOwnerPin) {
        if (
            !matchedOwnerPin ||
            !text?.isMirrored ||
            !text?.rotation ||
            text.recordType !== '4'
        ) {
            return null
        }

        return {
            x: Number(matchedOwnerPin.x),
            y: Number(text.y)
        }
    }

    /**
     * Collects the horizontal correction applied to explicit owner pin-name
     * labels so synthetic left/right pin numbers can keep their original gap.
     * @param {{ ownerIndex?: string, text?: string, x?: number, y?: number, recordType?: string, rotation?: number, isMirrored?: boolean }[]} texts
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {Map<string, number>}
     */
    static collectExplicitOwnerPinLabelOffsets(texts, pins) {
        const offsets = new Map()

        for (const text of texts) {
            const matchedOwnerPin =
                SchematicOwnerPinLabelLayout.findExplicitOwnerPinLabelMatch(
                    text,
                    pins
                )
            const placement =
                SchematicOwnerPinLabelLayout.resolveMirroredOwnerPinLabelPlacement(
                    text,
                    matchedOwnerPin
                )
            const key = SchematicOwnerPinLabelLayout.buildOwnerPinLabelKey(
                text?.ownerIndex,
                text?.text
            )

            if (!placement || !key) {
                continue
            }

            const delta = Number(placement.x) - Number(text.x)

            if (delta) {
                offsets.set(key, delta)
            }
        }

        return offsets
    }

    /**
     * Resolves the final SVG text anchor for one schematic free-text label.
     * Mirrored rotated owner pin-name labels need the opposite text edge so
     * their baseline starts on the same visual side after the signed rotation
     * flips.
     * @param {{ recordType?: string, rotation?: number, isMirrored?: boolean, y?: number }} text
     * @param {'start' | 'middle' | 'end'} anchor
     * @param {{ y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' } | null} matchedOwnerPin
     * @returns {'start' | 'middle' | 'end'}
     */
    static resolveSchematicTextAnchor(text, anchor, matchedOwnerPin) {
        if (
            anchor !== 'start' ||
            !text?.isMirrored ||
            !text?.rotation ||
            text.recordType !== '4'
        ) {
            return anchor
        }

        if (!matchedOwnerPin) {
            return anchor
        }

        return Number(text.y) >= Number(matchedOwnerPin.y) ? 'end' : 'start'
    }

    /**
     * Moves left/right pin numbers outward by the same horizontal correction
     * already applied to their explicit owner pin-name labels.
     * @param {{ orientation: 'left' | 'right' | 'top' | 'bottom', ownerIndex?: string, name?: string }} pin
     * @param {number} baseX
     * @param {Map<string, number>} explicitOwnerPinLabelOffsets
     * @returns {number}
     */
    static resolveExplicitOwnerPinNumberX(
        pin,
        baseX,
        explicitOwnerPinLabelOffsets
    ) {
        const key = SchematicOwnerPinLabelLayout.buildOwnerPinLabelKey(
            pin.ownerIndex,
            pin.name
        )
        const delta = Number(explicitOwnerPinLabelOffsets.get(key) || 0)

        if (!delta) {
            return baseX
        }

        switch (pin.orientation) {
            case 'left':
                return baseX - delta
            case 'right':
                return baseX + delta
            default:
                return baseX
        }
    }
}
