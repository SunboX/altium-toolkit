// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Shared layout helpers for explicit owner pin-name labels and their paired
 * synthetic pin-number clearance.
 */
export class SchematicOwnerPinLabelLayout {
    /**
     * Resolves one native-facing pin text placement in renderer coordinates
     * before sheet Y projection. The returned `yOffset` is applied after
     * projection, matching SVG text baseline behavior.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom', symbolOuter?: number }} pin
     * @param {'name' | 'number'} labelKind
     * @param {{ labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', rotateTopNumber?: boolean }} [options]
     * @returns {{ x: number, yOffset: number, anchor: 'start' | 'middle' | 'end', rotation: number } | null}
     */
    static resolveNativePinTextPlacement(pin, labelKind, options = {}) {
        const labelMode = options.labelMode || 'name-and-number'
        const markerStyle =
            SchematicOwnerPinLabelLayout.#resolveOuterPinMarkerStyle(pin)

        if (labelKind === 'number') {
            return SchematicOwnerPinLabelLayout.#resolveNumberPlacement(
                pin,
                markerStyle,
                options
            )
        }

        if (labelKind === 'name') {
            return SchematicOwnerPinLabelLayout.#resolveNamePlacement(
                pin,
                labelMode
            )
        }

        return null
    }

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

    /**
     * Resolves schematic pin-number placement.
     * @param {{ x: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @param {'single-in' | 'single-out' | 'double' | null} markerStyle
     * @param {{ rotateTopNumber?: boolean }} options
     * @returns {{ x: number, yOffset: number, anchor: 'start' | 'middle' | 'end', rotation: number } | null}
     */
    static #resolveNumberPlacement(pin, markerStyle, options) {
        switch (pin.orientation) {
            case 'left':
                return {
                    x:
                        Number(pin.x) -
                        SchematicOwnerPinLabelLayout.#resolveHorizontalPinNumberClearance(
                            markerStyle,
                            pin
                        ),
                    yOffset: -1,
                    anchor: 'end',
                    rotation: 0
                }
            case 'right':
                return {
                    x:
                        Number(pin.x) +
                        SchematicOwnerPinLabelLayout.#resolveHorizontalPinNumberClearance(
                            markerStyle,
                            pin
                        ),
                    yOffset: -1,
                    anchor: 'start',
                    rotation: 0
                }
            case 'top':
                return {
                    x: Number(pin.x) - 2,
                    yOffset: -6,
                    anchor: 'middle',
                    rotation: options.rotateTopNumber === false ? 0 : -90
                }
            case 'bottom':
                return {
                    x: Number(pin.x) - 2,
                    yOffset: 7,
                    anchor: 'middle',
                    rotation: -90
                }
            default:
                return null
        }
    }

    /**
     * Resolves schematic pin-name placement.
     * @param {{ x: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @param {'hidden' | 'number-only' | 'name-only' | 'name-and-number'} labelMode
     * @returns {{ x: number, yOffset: number, anchor: 'start' | 'middle' | 'end', rotation: number } | null}
     */
    static #resolveNamePlacement(pin, labelMode) {
        switch (pin.orientation) {
            case 'left':
                return {
                    x:
                        Number(pin.x) +
                        SchematicOwnerPinLabelLayout.#resolveHorizontalPinNameInset(
                            pin,
                            labelMode
                        ),
                    yOffset: 3,
                    anchor: 'start',
                    rotation: 0
                }
            case 'right':
                return {
                    x:
                        Number(pin.x) -
                        SchematicOwnerPinLabelLayout.#resolveHorizontalPinNameInset(
                            pin,
                            labelMode
                        ),
                    yOffset: 3,
                    anchor: 'end',
                    rotation: 0
                }
            case 'top':
                return {
                    x: Number(pin.x),
                    yOffset: 4,
                    anchor: 'end',
                    rotation: -90
                }
            case 'bottom':
                return {
                    x: Number(pin.x) + 4,
                    yOffset: -4,
                    anchor: 'start',
                    rotation: -90
                }
            default:
                return null
        }
    }

    /**
     * Returns the horizontal pin-number clearance needed by the pin geometry.
     * @param {'single-in' | 'single-out' | 'double' | null} markerStyle
     * @param {{ length?: number }} pin
     * @returns {number}
     */
    static #resolveHorizontalPinNumberClearance(markerStyle, pin) {
        switch (markerStyle) {
            case 'double':
                return 17
            case 'single-in':
            case 'single-out':
                return 8
            default:
                return SchematicOwnerPinLabelLayout.#resolveLongPinInset(pin, 2)
        }
    }

    /**
     * Returns the horizontal pin-name inset used inside the symbol body.
     * @param {{ length?: number }} pin
     * @param {'hidden' | 'number-only' | 'name-only' | 'name-and-number'} labelMode
     * @returns {number}
     */
    static #resolveHorizontalPinNameInset(pin, labelMode) {
        if (labelMode === 'name-only') {
            return 10
        }

        return SchematicOwnerPinLabelLayout.#resolveLongPinInset(pin, 4)
    }

    /**
     * Adds extra text clearance for long connector-style pin stubs.
     * @param {{ length?: number }} pin
     * @param {number} fallback
     * @returns {number}
     */
    static #resolveLongPinInset(pin, fallback) {
        const length = Math.abs(Number(pin?.length || 0))

        if (length < 30) {
            return fallback
        }

        return fallback === 2 ? 10 : 8
    }

    /**
     * Resolves one authored outer pin marker style from the stored symbol flag.
     * @param {{ symbolOuter?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {'single-in' | 'single-out' | 'double' | null}
     */
    static #resolveOuterPinMarkerStyle(pin) {
        if (pin.orientation !== 'left' && pin.orientation !== 'right') {
            return null
        }

        switch (Number(pin.symbolOuter || 0)) {
            case 1:
            case 33:
                return 'single-out'
            case 2:
                return 'single-in'
            case 34:
                return 'double'
            default:
                return null
        }
    }
}
