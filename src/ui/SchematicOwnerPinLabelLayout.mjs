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
     * Collects compact FET-like owner groups whose numeric contact labels need
     * to stay outside the owner-drawn device body.
     * @param {{ ownerIndex?: string, name?: string, designator?: string, length?: number, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[]} pins
     * @returns {Map<string, 'left' | 'right'>}
     */
    static collectCompactExternalNumberLabelSides(pins) {
        const ownerPins = new Map()

        for (const pin of pins) {
            const ownerIndex = String(pin.ownerIndex || '').trim()
            if (!ownerIndex) continue
            if (!ownerPins.has(ownerIndex)) ownerPins.set(ownerIndex, [])
            ownerPins.get(ownerIndex).push(pin)
        }

        const sides = new Map()

        for (const [ownerIndex, groupedPins] of ownerPins.entries()) {
            const side =
                SchematicOwnerPinLabelLayout.#resolveCompactExternalNumberLabelSide(
                    groupedPins
                )
            if (side) sides.set(ownerIndex, side)
        }

        return sides
    }

    /**
     * Collects rectangular owner bodies whose numeric-only horizontal pin
     * labels are drawn inside the body, close to the body edge.
     * @param {{ ownerIndex?: string, name?: string, designator?: string, length?: number, x: number, y: number, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[]} pins
     * @param {{ ownerIndex?: string, x: number, y: number, width: number, height: number }[]} rectangles
     * @returns {Map<string, { left: number, right: number }>}
     */
    static collectInternalNumberLabelBoxes(pins, rectangles) {
        const ownerPins = SchematicOwnerPinLabelLayout.#groupByOwnerIndex(pins)
        const ownerRectangles =
            SchematicOwnerPinLabelLayout.#groupByOwnerIndex(rectangles)
        const boxes = new Map()

        for (const [ownerIndex, groupedPins] of ownerPins.entries()) {
            const box =
                SchematicOwnerPinLabelLayout.#resolveInternalNumberLabelBox(
                    groupedPins,
                    ownerRectangles.get(ownerIndex) || []
                )

            if (box) {
                boxes.set(ownerIndex, box)
            }
        }

        return boxes
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
     * Resolves the side that should carry compact owner-drawn pin numbers.
     * @param {{ name?: string, designator?: string, length?: number, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[]} pins
     * @returns {'left' | 'right' | null}
     */
    static #resolveCompactExternalNumberLabelSide(pins) {
        if (
            pins.length !== 4 ||
            !pins.every(
                (pin) =>
                    (pin.labelMode || 'name-and-number') === 'number-only' &&
                    /^\d+$/.test(String(pin.designator || '').trim()) &&
                    Math.abs(Number(pin.length || 0)) <= 20 &&
                    SchematicOwnerPinLabelLayout.#isFetTerminalName(pin.name)
            )
        ) {
            return null
        }

        const hasTopPin = pins.some((pin) => pin.orientation === 'top')
        const hasBottomPin = pins.some((pin) => pin.orientation === 'bottom')
        const horizontalPins = pins.filter(
            (pin) => pin.orientation === 'left' || pin.orientation === 'right'
        )
        const horizontalSides = new Set(
            horizontalPins.map((pin) => pin.orientation)
        )

        if (
            !hasTopPin ||
            !hasBottomPin ||
            horizontalPins.length === 0 ||
            horizontalSides.size !== 1
        ) {
            return null
        }

        return horizontalPins[0].orientation
    }

    /**
     * Resolves one rectangular body suitable for internal numeric pin labels.
     * @param {{ name?: string, designator?: string, length?: number, x: number, y: number, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[]} pins
     * @param {{ x: number, y: number, width: number, height: number }[]} rectangles
     * @returns {{ left: number, right: number } | null}
     */
    static #resolveInternalNumberLabelBox(pins, rectangles) {
        if (
            pins.length < 4 ||
            !pins.every((pin) =>
                SchematicOwnerPinLabelLayout.#isInternalNumberLabelPin(pin)
            )
        ) {
            return null
        }

        const sides = new Set(pins.map((pin) => pin.orientation))

        if (!sides.has('left') || !sides.has('right') || sides.size !== 2) {
            return null
        }

        const rectangle =
            SchematicOwnerPinLabelLayout.#findInternalNumberLabelRectangle(
                pins,
                rectangles
            )

        if (!rectangle) {
            return null
        }

        return {
            left: rectangle.left,
            right: rectangle.right
        }
    }

    /**
     * Returns the owner rectangle whose vertical edges carry every pin.
     * @param {{ x: number, y: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number, width: number, height: number }[]} rectangles
     * @returns {{ left: number, right: number, top: number, bottom: number } | null}
     */
    static #findInternalNumberLabelRectangle(pins, rectangles) {
        for (const rectangle of rectangles) {
            const normalized =
                SchematicOwnerPinLabelLayout.#normalizeRectangle(rectangle)

            if (
                normalized &&
                SchematicOwnerPinLabelLayout.#pinsAlignWithRectangleEdges(
                    pins,
                    normalized
                )
            ) {
                return normalized
            }
        }

        return null
    }

    /**
     * Returns true when every pin body endpoint lies on a vertical body edge.
     * @param {{ x: number, y: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ left: number, right: number, top: number, bottom: number }} rectangle
     * @returns {boolean}
     */
    static #pinsAlignWithRectangleEdges(pins, rectangle) {
        const tolerance = 1.5

        for (const pin of pins) {
            const x = Number(pin.x)
            const y = Number(pin.y)

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return false
            }

            if (
                y < rectangle.top - tolerance ||
                y > rectangle.bottom + tolerance
            ) {
                return false
            }

            if (
                pin.orientation === 'left' &&
                Math.abs(x - rectangle.left) > tolerance
            ) {
                return false
            }

            if (
                pin.orientation === 'right' &&
                Math.abs(x - rectangle.right) > tolerance
            ) {
                return false
            }
        }

        return true
    }

    /**
     * Normalizes a rectangle to absolute edge coordinates.
     * @param {{ x: number, y: number, width: number, height: number }} rectangle
     * @returns {{ left: number, right: number, top: number, bottom: number } | null}
     */
    static #normalizeRectangle(rectangle) {
        const x1 = Number(rectangle?.x)
        const y1 = Number(rectangle?.y)
        const x2 = x1 + Number(rectangle?.width)
        const y2 = y1 + Number(rectangle?.height)

        if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2) ||
            x1 === x2 ||
            y1 === y2
        ) {
            return null
        }

        return {
            left: Math.min(x1, x2),
            right: Math.max(x1, x2),
            top: Math.min(y1, y2),
            bottom: Math.max(y1, y2)
        }
    }

    /**
     * Returns true for numeric-only horizontal pins on short owner stubs.
     * @param {{ name?: string, designator?: string, length?: number, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }} pin
     * @returns {boolean}
     */
    static #isInternalNumberLabelPin(pin) {
        const name = String(pin.name || '').trim()
        const designator = String(pin.designator || '').trim()

        return (
            (pin.orientation === 'left' || pin.orientation === 'right') &&
            (pin.labelMode || 'name-and-number') === 'number-only' &&
            /^\d+$/.test(designator) &&
            (!name || /^\d+$/.test(name)) &&
            Math.abs(Number(pin.length || 0)) <= 30
        )
    }

    /**
     * Groups schematic owner-local primitives by owner index.
     * @template T
     * @param {(T & { ownerIndex?: string })[]} items
     * @returns {Map<string, T[]>}
     */
    static #groupByOwnerIndex(items) {
        const groups = new Map()

        for (const item of items) {
            const ownerIndex = String(item.ownerIndex || '').trim()

            if (!ownerIndex) {
                continue
            }

            if (!groups.has(ownerIndex)) {
                groups.set(ownerIndex, [])
            }

            groups.get(ownerIndex).push(item)
        }

        return groups
    }

    /**
     * Returns true for FET terminal names, including numbered gate/source pins.
     * @param {string | undefined} name
     * @returns {boolean}
     */
    static #isFetTerminalName(name) {
        return /^(?:[DS]|[GS]\d*)$/i.test(String(name || '').trim())
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
     * @param {'single-in' | 'single-out' | 'double' | 'cross' | null} markerStyle
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
     * @param {'single-in' | 'single-out' | 'double' | 'cross' | null} markerStyle
     * @param {{ length?: number }} pin
     * @returns {number}
     */
    static #resolveHorizontalPinNumberClearance(markerStyle, pin) {
        switch (markerStyle) {
            case 'double':
                return 17
            case 'cross':
                return 12
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
     * @returns {'single-in' | 'single-out' | 'double' | 'cross' | null}
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
            case 6:
                return 'cross'
            case 34:
                return 'double'
            default:
                return null
        }
    }
}
