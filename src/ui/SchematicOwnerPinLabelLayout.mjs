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
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom', symbolOuter?: number, electrical?: number }} pin
     * @param {'name' | 'number'} labelKind
     * @param {{ labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', rotateTopNumber?: boolean }} [options]
     * @returns {{ x: number, yOffset: number, anchor: 'start' | 'middle' | 'end', rotation: number } | null}
     */
    static resolveNativePinTextPlacement(pin, labelKind, options = {}) {
        const labelMode = options.labelMode || 'name-and-number'
        const markerStyle =
            SchematicOwnerPinLabelLayout.#resolvePinMarkerStyle(pin)

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
     * Collects pins whose owner already draws a visible text label for the pin
     * designator, avoiding a second synthetic pin-number label at the contact.
     * @param {{ ownerIndex?: string, text?: string, x?: number, y?: number, recordType?: string, hidden?: boolean }[]} texts
     * @param {{ ownerIndex?: string, designator?: string, x: number, y: number, length?: number, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[]} pins
     * @returns {Set<string>}
     */
    static collectExplicitOwnerPinNumberLabelKeys(texts, pins) {
        const ownerTexts = SchematicOwnerPinLabelLayout.#groupByOwnerIndex(
            (texts || []).filter(
                (text) => text.recordType === '4' && !text.hidden
            )
        )
        const keys = new Set()

        for (const pin of pins || []) {
            const ownerIndex = String(pin.ownerIndex || '').trim()
            const designator = String(pin.designator || '').trim()

            if (
                !ownerIndex ||
                !designator ||
                (pin.labelMode || 'name-and-number') === 'hidden' ||
                (pin.labelMode || 'name-and-number') === 'name-only'
            ) {
                continue
            }

            const nativeNumberLabels = ownerTexts.get(ownerIndex) || []
            const hasNativeNumberLabel = nativeNumberLabels.some((text) =>
                SchematicOwnerPinLabelLayout.#isExplicitOwnerPinNumberLabel(
                    text,
                    pin,
                    designator
                )
            )

            if (hasNativeNumberLabel) {
                keys.add(
                    SchematicOwnerPinLabelLayout.buildOwnerPinLabelKey(
                        ownerIndex,
                        designator
                    )
                )
            }
        }

        return keys
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
     * Collects internally numbered pins whose external number would overlap a
     * visible route text label on the same horizontal lane.
     * @param {{ ownerIndex?: string, name?: string, designator?: string, length?: number, x: number, y: number, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', electrical?: number, symbolOuter?: number }[]} pins
     * @param {{ ownerIndex?: string, text?: string, resolvedText?: string, x?: number, y?: number, anchor?: 'start' | 'middle' | 'end', fontSize?: number, hidden?: boolean, rotation?: number }[]} texts
     * @param {Map<string, { left: number, right: number }>} internalNumberLabelBoxes
     * @returns {Set<string>}
     */
    static collectOverlappingExternalNumberLabelKeys(
        pins,
        texts,
        internalNumberLabelBoxes
    ) {
        const textBounds = (texts || [])
            .map((text) =>
                SchematicOwnerPinLabelLayout.#estimateHorizontalTextBounds(text)
            )
            .filter(Boolean)
        const keys = new Set()

        if (textBounds.length === 0) {
            return keys
        }

        for (const pin of pins || []) {
            const ownerIndex = String(pin.ownerIndex || '').trim()
            if (!ownerIndex || !internalNumberLabelBoxes.has(ownerIndex)) {
                continue
            }

            if (!SchematicOwnerPinLabelLayout.#isInternalNumberLabelPin(pin)) {
                continue
            }

            const numberBounds =
                SchematicOwnerPinLabelLayout.#estimateExternalNumberBounds(pin)
            if (!numberBounds) {
                continue
            }

            if (
                textBounds.some((bounds) =>
                    SchematicOwnerPinLabelLayout.#boundsOverlap(
                        numberBounds,
                        bounds,
                        1.5
                    )
                )
            ) {
                keys.add(
                    SchematicOwnerPinLabelLayout.buildOwnerPinLabelKey(
                        ownerIndex,
                        pin.designator
                    )
                )
            }
        }

        return keys
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
     * Returns true when an owner text is a native pin-number label for a pin.
     * @param {{ text?: string, x?: number, y?: number }} text
     * @param {{ x: number, y: number, length?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @param {string} designator
     * @returns {boolean}
     */
    static #isExplicitOwnerPinNumberLabel(text, pin, designator) {
        if (String(text?.text || '').trim() !== designator) {
            return false
        }

        const textX = Number(text?.x)
        const textY = Number(text?.y)
        const pinX = Number(pin?.x)
        const pinY = Number(pin?.y)

        if (
            !Number.isFinite(textX) ||
            !Number.isFinite(textY) ||
            !Number.isFinite(pinX) ||
            !Number.isFinite(pinY)
        ) {
            return false
        }

        const laneTolerance = 6
        const axisTolerance =
            Math.max(Math.abs(Number(pin.length || 0)), 10) + 6

        if (pin.orientation === 'left' || pin.orientation === 'right') {
            return (
                Math.abs(textY - pinY) <= laneTolerance &&
                Math.abs(textX - pinX) <= axisTolerance
            )
        }

        if (pin.orientation === 'top' || pin.orientation === 'bottom') {
            return (
                Math.abs(textX - pinX) <= laneTolerance &&
                Math.abs(textY - pinY) <= axisTolerance
            )
        }

        return false
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
     * Estimates a route text label's source-coordinate visual bounds.
     * @param {{ ownerIndex?: string, text?: string, resolvedText?: string, x?: number, y?: number, anchor?: 'start' | 'middle' | 'end', fontSize?: number, hidden?: boolean, rotation?: number } | null} text
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number } | null}
     */
    static #estimateHorizontalTextBounds(text) {
        if (!text || text.hidden || text.ownerIndex) return null
        if (Number(text.rotation || 0) !== 0) return null

        const label = String(text.resolvedText ?? text.text ?? '').trim()
        const x = Number(text.x)
        const y = Number(text.y)
        if (!label || !Number.isFinite(x) || !Number.isFinite(y)) return null

        const fontSize = SchematicOwnerPinLabelLayout.#resolveViewerFontSize(
            text.fontSize
        )
        const width = SchematicOwnerPinLabelLayout.#estimateTextWidth(
            label,
            fontSize
        )
        const anchor = text.anchor || 'start'
        const minX =
            anchor === 'end'
                ? x - width
                : anchor === 'middle'
                  ? x - width / 2
                  : x
        const maxX =
            anchor === 'end'
                ? x
                : anchor === 'middle'
                  ? x + width / 2
                  : x + width

        return {
            minX,
            maxX,
            minY: y - fontSize * 0.7,
            maxY: y + fontSize * 0.35
        }
    }

    /**
     * Estimates one external pin number's source-coordinate bounds.
     * @param {{ designator?: string, length?: number, x: number, y: number, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number }} pin
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number } | null}
     */
    static #estimateExternalNumberBounds(pin) {
        if (pin.orientation !== 'left' && pin.orientation !== 'right') {
            return null
        }

        const label = String(pin.designator || '').trim()
        const x = Number(pin.x)
        const y = Number(pin.y)
        if (!label || !Number.isFinite(x) || !Number.isFinite(y)) return null

        const markerStyle =
            SchematicOwnerPinLabelLayout.#resolvePinMarkerStyle(pin)
        const clearance =
            SchematicOwnerPinLabelLayout.#resolveHorizontalPinNumberClearance(
                markerStyle,
                pin
            )
        const offset = Math.max(
            clearance,
            SchematicOwnerPinLabelLayout.#resolveCompactExternalHorizontalNumberOffset(
                pin
            )
        )
        const numberX = pin.orientation === 'left' ? x - offset : x + offset
        const anchor =
            SchematicOwnerPinLabelLayout.#resolveHorizontalPinNumberAnchor(
                pin,
                markerStyle
            )
        const fontSize = SchematicOwnerPinLabelLayout.#resolveViewerFontSize()
        const width = SchematicOwnerPinLabelLayout.#estimateTextWidth(
            label,
            fontSize
        )

        return {
            minX: anchor === 'end' ? numberX - width : numberX,
            maxX: anchor === 'end' ? numberX : numberX + width,
            minY: y - fontSize * 0.7,
            maxY: y + fontSize * 0.35
        }
    }

    /**
     * Returns the viewer-adjusted schematic font size used for collision
     * estimates.
     * @param {number | undefined} fontSize Source font size.
     * @returns {number}
     */
    static #resolveViewerFontSize(fontSize = 10) {
        return Math.max(Number(fontSize || 10) - 1, 6)
    }

    /**
     * Estimates one rendered text run width.
     * @param {string} text Text content.
     * @param {number} fontSize Viewer font size.
     * @returns {number}
     */
    static #estimateTextWidth(text, fontSize) {
        return Math.max(String(text || '').length * fontSize * 0.62, fontSize)
    }

    /**
     * Returns true when two source-coordinate boxes overlap.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} first First bounds.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} second Second bounds.
     * @param {number} tolerance Coordinate tolerance.
     * @returns {boolean}
     */
    static #boundsOverlap(first, second, tolerance) {
        return (
            first.minX <= second.maxX + tolerance &&
            first.maxX >= second.minX - tolerance &&
            first.minY <= second.maxY + tolerance &&
            first.maxY >= second.minY - tolerance
        )
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
                    anchor: SchematicOwnerPinLabelLayout.#resolveHorizontalPinNumberAnchor(
                        pin,
                        markerStyle
                    ),
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
                    anchor: SchematicOwnerPinLabelLayout.#resolveHorizontalPinNumberAnchor(
                        pin,
                        markerStyle
                    ),
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
     * @param {{ length?: number, electrical?: number }} pin
     * @returns {number}
     */
    static #resolveHorizontalPinNumberClearance(markerStyle, pin) {
        switch (markerStyle) {
            case 'double':
                return 21
            case 'cross':
                return 9
            case 'single-in':
            case 'single-out':
                return 8
            default:
                if (Number(pin?.electrical || 0) === 1) {
                    return 16
                }

                return SchematicOwnerPinLabelLayout.#resolveLongPinInset(pin, 2)
        }
    }

    /**
     * Resolves the text edge used for horizontal pin numbers.
     * @param {{ orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number }} pin Pin primitive.
     * @param {'single-in' | 'single-out' | 'double' | 'cross' | null} markerStyle Marker style.
     * @returns {'start' | 'end'}
     */
    static #resolveHorizontalPinNumberAnchor(pin, markerStyle) {
        const routeFacing =
            markerStyle === 'double' ||
            (!markerStyle && Number(pin?.electrical || 0) === 1)

        if (routeFacing) {
            return pin.orientation === 'left' ? 'start' : 'end'
        }

        return pin.orientation === 'left' ? 'end' : 'start'
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

        return SchematicOwnerPinLabelLayout.#resolveLongPinInset(pin, 7)
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
     * Resolves the stub-side offset used when a pin already has an internal
     * numeric label in its owner body.
     * @param {{ length?: number }} pin Pin primitive.
     * @returns {number}
     */
    static #resolveCompactExternalHorizontalNumberOffset(pin) {
        const length = Math.abs(Number(pin.length || 0))

        return Math.max(8, Math.min(length - 6, 12))
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

    /**
     * Resolves the marker style that contributes to native text clearance.
     * @param {{ symbolOuter?: number, electrical?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {'single-in' | 'single-out' | 'double' | 'cross' | null}
     */
    static #resolvePinMarkerStyle(pin) {
        return (
            SchematicOwnerPinLabelLayout.#resolveOuterPinMarkerStyle(pin) ||
            SchematicOwnerPinLabelLayout.#resolveElectricalPinMarkerStyle(pin)
        )
    }

    /**
     * Resolves electrical pin marker styles. Bidirectional pins keep the
     * existing route-facing number placement through the explicit check.
     * @param {{ electrical?: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {'single-in' | 'single-out' | null}
     */
    static #resolveElectricalPinMarkerStyle(pin) {
        if (pin.orientation !== 'left' && pin.orientation !== 'right') {
            return null
        }

        switch (Number(pin.electrical)) {
            case 0:
                return 'single-in'
            case 2:
                return 'single-out'
            default:
                return null
        }
    }
}
