// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicMultipartDesignatorNormalizer } from './SchematicMultipartDesignatorNormalizer.mjs'

/**
 * Applies placement-oriented cleanup passes to normalized schematic text.
 */
export class SchematicTextPostProcessor {
    /**
     * Removes free text labels already covered by visible off-sheet ports.
     * @param {{ x: number, y: number, text: string, recordType?: string }[]} texts
     * @param {{ x: number, y: number, width: number, name: string }[]} ports
     * @returns {{ x: number, y: number, text: string, recordType?: string }[]}
     */
    static dropDuplicatePortLabels(texts, ports) {
        return texts.filter(
            (text) =>
                !ports.some((port) =>
                    SchematicTextPostProcessor.#isDuplicatePortLabel(text, port)
                )
        )
    }

    /**
     * Returns true when one free wire label duplicates a visible off-sheet port
     * label immediately beside the port body.
     * @param {{ x: number, y: number, text: string, recordType?: string }} text
     * @param {{ x: number, y: number, width: number, name: string }} port
     * @returns {boolean}
     */
    static #isDuplicatePortLabel(text, port) {
        if (
            text.recordType !== '25' ||
            port.name !== text.text ||
            Math.abs(port.y - text.y) > 2
        ) {
            return false
        }

        if ((port.direction || 'right') !== 'left') {
            return false
        }

        const maxGap = Math.max(port.width + 20, 80)

        return text.x <= port.x && port.x - text.x <= maxGap
    }

    /**
     * Normalizes multipart section suffixes like A/B/J on visible designator
     * texts when the active Altium part id is stored separately from the
     * designator string.
     * @param {{ text: string, name?: string, ownerIndex?: string, recordType?: string }[]} texts
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {{ text: string, name?: string, ownerIndex?: string, recordType?: string }[]}
     */
    static decorateMultipartDesignators(texts, activeMultipartOwnerParts) {
        return SchematicMultipartDesignatorNormalizer.normalize(
            texts,
            activeMultipartOwnerParts
        )
    }

    /**
     * Re-anchors horizontal component texts from their owner primitive bounds
     * so left-side standalone designators can right-align without disturbing
     * stacked owner-side value text.
     * @param {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }[]} texts
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, ownerIndex: string, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down' }[]} ports
     * @param {{ x: number, y: number, width: number, height: number, ownerIndex?: string }[] | { rectangles?: { x: number, y: number, width: number, height: number, ownerIndex?: string }[], roundedRectangles?: { x: number, y: number, width: number, height: number, ownerIndex?: string }[], ellipses?: { x: number, y: number, radiusX: number, radiusY: number, ownerIndex?: string }[], arcs?: { x: number, y: number, radius: number, radiusY?: number, ownerIndex?: string }[], pies?: { x: number, y: number, radius: number, radiusY?: number, ownerIndex?: string }[] }} bodyPrimitives
     * @returns {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }[]}
     */
    static anchorComponentTextsFromOwnerBounds(
        texts,
        lines,
        pins,
        ports = [],
        bodyPrimitives = []
    ) {
        const normalizedBodyPrimitives =
            SchematicTextPostProcessor.#normalizeOwnerBodyPrimitives(
                bodyPrimitives
            )
        const ownerBounds = SchematicTextPostProcessor.#buildOwnerBounds(
            lines,
            pins
        )
        const ownerBodyBounds =
            SchematicTextPostProcessor.#buildOwnerBodyBounds(
                lines,
                pins,
                normalizedBodyPrimitives
            )
        const ownerPinCounts =
            SchematicTextPostProcessor.#buildOwnerPinCounts(pins)
        const ownerPinOrientations =
            SchematicTextPostProcessor.#buildOwnerPinOrientations(pins)

        return texts.map((text) => {
            if (
                !text ||
                !SchematicTextPostProcessor.#isDesignatorText(text) ||
                text.rotation ||
                !text.ownerIndex
            ) {
                return text
            }

            const bounds = ownerBounds.get(text.ownerIndex)

            if (!bounds) {
                return text
            }

            const paddedText =
                SchematicTextPostProcessor.#padDesignatorAboveOwner(
                    text,
                    ownerBodyBounds.get(text.ownerIndex) || bounds
                )
            const ownerPinCount = ownerPinCounts.get(text.ownerIndex) || 0

            if (text.y > bounds.maxY) {
                return paddedText
            }

            if (text.y < bounds.minY - 1) {
                return paddedText
            }

            if (paddedText.x <= bounds.minX + 2) {
                if (
                    SchematicTextPostProcessor.#hasVisibleOwnerSideTextStack(
                        paddedText,
                        texts,
                        bounds
                    ) ||
                    SchematicTextPostProcessor.#hasVisibleOppositeSideValuePair(
                        paddedText,
                        texts,
                        bounds,
                        ownerPinOrientations.get(text.ownerIndex) || new Set()
                    ) ||
                    SchematicTextPostProcessor.#hasNearbyLeftWireLabel(
                        paddedText,
                        texts,
                        lines,
                        pins,
                        ports
                    ) ||
                    SchematicTextPostProcessor.#isCompactTwoPinOwner(
                        bounds,
                        ownerPinCount
                    )
                ) {
                    return paddedText
                }

                return {
                    ...paddedText,
                    anchor: 'end'
                }
            }

            if (paddedText.x >= bounds.maxX - 2) {
                return {
                    ...paddedText,
                    anchor: 'start'
                }
            }

            return paddedText
        })
    }

    /**
     * Normalizes owner body primitive arguments while preserving the older
     * rectangle-array call shape.
     * @param {{ x: number, y: number, width: number, height: number, ownerIndex?: string }[] | { rectangles?: { x: number, y: number, width: number, height: number, ownerIndex?: string }[], roundedRectangles?: { x: number, y: number, width: number, height: number, ownerIndex?: string }[], ellipses?: { x: number, y: number, radiusX: number, radiusY: number, ownerIndex?: string }[], arcs?: { x: number, y: number, radius: number, radiusY?: number, ownerIndex?: string }[], pies?: { x: number, y: number, radius: number, radiusY?: number, ownerIndex?: string }[] }} bodyPrimitives
     * @returns {{ rectangles: { x: number, y: number, width: number, height: number, ownerIndex?: string }[], roundedRectangles: { x: number, y: number, width: number, height: number, ownerIndex?: string }[], ellipses: { x: number, y: number, radiusX: number, radiusY: number, ownerIndex?: string }[], arcs: { x: number, y: number, radius: number, radiusY?: number, ownerIndex?: string }[], pies: { x: number, y: number, radius: number, radiusY?: number, ownerIndex?: string }[] }}
     */
    static #normalizeOwnerBodyPrimitives(bodyPrimitives) {
        if (Array.isArray(bodyPrimitives)) {
            return {
                rectangles: bodyPrimitives,
                roundedRectangles: [],
                ellipses: [],
                arcs: [],
                pies: []
            }
        }

        return {
            rectangles: bodyPrimitives?.rectangles || [],
            roundedRectangles: bodyPrimitives?.roundedRectangles || [],
            ellipses: bodyPrimitives?.ellipses || [],
            arcs: bodyPrimitives?.arcs || [],
            pies: bodyPrimitives?.pies || []
        }
    }

    /**
     * Builds per-owner body bounds from straight and curved owner primitives.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, ownerIndex: string }[]} pins
     * @param {{ rectangles: { x: number, y: number, width: number, height: number, ownerIndex?: string }[], roundedRectangles: { x: number, y: number, width: number, height: number, ownerIndex?: string }[], ellipses: { x: number, y: number, radiusX: number, radiusY: number, ownerIndex?: string }[], arcs: { x: number, y: number, radius: number, radiusY?: number, ownerIndex?: string }[], pies: { x: number, y: number, radius: number, radiusY?: number, ownerIndex?: string }[] }} bodyPrimitives
     * @returns {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>}
     */
    static #buildOwnerBodyBounds(lines, pins, bodyPrimitives) {
        const ownerBounds = SchematicTextPostProcessor.#buildOwnerBounds(
            lines,
            pins,
            [...bodyPrimitives.rectangles, ...bodyPrimitives.roundedRectangles]
        )

        SchematicTextPostProcessor.#extendCenteredOwnerBounds(
            ownerBounds,
            bodyPrimitives.ellipses
        )
        SchematicTextPostProcessor.#extendCenteredOwnerBounds(
            ownerBounds,
            bodyPrimitives.arcs
        )
        SchematicTextPostProcessor.#extendCenteredOwnerBounds(
            ownerBounds,
            bodyPrimitives.pies
        )

        return ownerBounds
    }

    /**
     * Extends owner bounds by primitives expressed as a center and radii.
     * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} ownerBounds
     * @param {{ x: number, y: number, radius?: number, radiusX?: number, radiusY?: number, ownerIndex?: string }[]} primitives
     * @returns {void}
     */
    static #extendCenteredOwnerBounds(ownerBounds, primitives) {
        for (const primitive of primitives) {
            if (!primitive.ownerIndex) {
                continue
            }

            const radiusX =
                SchematicTextPostProcessor.#resolveHorizontalRadius(primitive)
            const radiusY =
                SchematicTextPostProcessor.#resolveVerticalRadius(primitive)

            if (radiusX <= 0 || radiusY <= 0) {
                continue
            }

            SchematicTextPostProcessor.#extendBounds(
                ownerBounds,
                primitive.ownerIndex,
                [
                    { x: primitive.x - radiusX, y: primitive.y - radiusY },
                    { x: primitive.x + radiusX, y: primitive.y + radiusY }
                ]
            )
        }
    }

    /**
     * Resolves the horizontal radius of a center-defined primitive.
     * @param {{ radius?: number, radiusX?: number }} primitive
     * @returns {number}
     */
    static #resolveHorizontalRadius(primitive) {
        return SchematicTextPostProcessor.#coercePositiveNumber(
            primitive.radiusX ?? primitive.radius
        )
    }

    /**
     * Resolves the vertical radius of a center-defined primitive.
     * @param {{ radius?: number, radiusY?: number }} primitive
     * @returns {number}
     */
    static #resolveVerticalRadius(primitive) {
        return SchematicTextPostProcessor.#coercePositiveNumber(
            primitive.radiusY ?? primitive.radius
        )
    }

    /**
     * Converts finite positive numeric values, preserving zero for invalids.
     * @param {number | string | undefined | null} value
     * @returns {number}
     */
    static #coercePositiveNumber(value) {
        const numericValue = Number(value)

        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return 0
        }

        return numericValue
    }

    /**
     * Right-aligns wire labels that precede a same-row component designator so
     * they stay clear of the symbol body.
     * Labels that sit on a wire segment whose left endpoint is an actual pin
     * or off-sheet port keep their original left-to-right flow.
     * @param {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }[]} texts
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom', designator?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', symbolOuter?: number }[]} pins
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down' }[]} ports
     * @returns {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }[]}
     */
    static anchorWireLabelsNearDesignators(texts, lines, pins, ports = []) {
        return texts.map((text) => {
            if (
                !text ||
                text.recordType !== '25' ||
                text.rotation ||
                text.anchor !== 'start'
            ) {
                return text
            }

            const pinOffsetText =
                SchematicTextPostProcessor.#offsetWireLabelPastRightPinNumber(
                    text,
                    pins
                )
            const hasNearbyRightDesignator = texts.some(
                (candidate) =>
                    candidate &&
                    candidate.name === 'Designator' &&
                    !candidate.rotation &&
                    candidate.x > pinOffsetText.x &&
                    candidate.x - pinOffsetText.x <= 80 &&
                    Math.abs(candidate.y - pinOffsetText.y) <= 2
            )

            if (!hasNearbyRightDesignator) {
                return pinOffsetText
            }

            if (
                SchematicTextPostProcessor.#hasPinConnectedAtWireStart(
                    pinOffsetText,
                    lines,
                    pins
                ) ||
                SchematicTextPostProcessor.#hasLineConnectedAtWireStart(
                    pinOffsetText,
                    lines
                ) ||
                SchematicTextPostProcessor.#hasPortConnectedAtWireStart(
                    pinOffsetText,
                    lines,
                    ports
                )
            ) {
                return pinOffsetText
            }

            return {
                ...pinOffsetText,
                anchor: 'end'
            }
        })
    }

    /**
     * Moves a start-anchored horizontal wire label rightward when it starts at
     * the outer endpoint of a visible right-facing pin number.
     * @param {{ x: number, y: number, text: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }} text
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom', designator?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', symbolOuter?: number }[]} pins
     * @returns {{ x: number, y: number, text: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }}
     */
    static #offsetWireLabelPastRightPinNumber(text, pins) {
        const requiredX = pins.reduce((maxX, pin) => {
            if (
                !SchematicTextPostProcessor.#isVisibleRightPinNumber(pin) ||
                !SchematicTextPostProcessor.#textStartsAtPinOuterEndpoint(
                    text,
                    pin
                )
            ) {
                return maxX
            }

            return Math.max(
                maxX,
                SchematicTextPostProcessor.#resolveRightPinNumberTextEndX(pin) +
                    4
            )
        }, text.x)

        if (requiredX <= text.x) {
            return text
        }

        return {
            ...text,
            x: requiredX
        }
    }

    /**
     * Returns true when one pin renders a right-side number label.
     * @param {{ orientation: 'left' | 'right' | 'top' | 'bottom', designator?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }} pin
     * @returns {boolean}
     */
    static #isVisibleRightPinNumber(pin) {
        const labelMode = pin?.labelMode || 'name-and-number'

        return (
            pin?.orientation === 'right' &&
            labelMode !== 'hidden' &&
            labelMode !== 'name-only' &&
            String(pin.designator || '').trim() !== ''
        )
    }

    /**
     * Returns true when a text record starts on one pin's outer wire endpoint.
     * @param {{ x: number, y: number }} text
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {boolean}
     */
    static #textStartsAtPinOuterEndpoint(text, pin) {
        const endpoint =
            SchematicTextPostProcessor.#projectPinOuterEndpoint(pin)

        return (
            endpoint !== null &&
            Math.abs(endpoint.x - text.x) <= 2 &&
            Math.abs(endpoint.y - text.y) <= 2
        )
    }

    /**
     * Estimates the x coordinate immediately after one rendered right pin
     * number.
     * @param {{ x: number, designator?: string, symbolOuter?: number }} pin
     * @returns {number}
     */
    static #resolveRightPinNumberTextEndX(pin) {
        return (
            Number(pin.x) +
            SchematicTextPostProcessor.#resolveHorizontalPinNumberClearance(
                pin.symbolOuter
            ) +
            SchematicTextPostProcessor.#estimatePinNumberWidth(pin.designator)
        )
    }

    /**
     * Returns the horizontal clearance used by authored outer pin markers.
     * @param {number | undefined} symbolOuter
     * @returns {number}
     */
    static #resolveHorizontalPinNumberClearance(symbolOuter) {
        switch (Number(symbolOuter || 0)) {
            case 34:
                return 17
            case 1:
            case 2:
            case 33:
                return 8
            case 6:
                return 12
            default:
                return 2
        }
    }

    /**
     * Estimates one schematic pin-number label width in viewer SVG units.
     * @param {string | undefined} designator
     * @returns {number}
     */
    static #estimatePinNumberWidth(designator) {
        return Math.max(String(designator || '').trim().length * 5, 5)
    }

    /**
     * Builds per-owner primitive bounds from drawable lines, pins, and bodies.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, ownerIndex: string }[]} pins
     * @param {{ x: number, y: number, width: number, height: number, ownerIndex?: string }[]} rectangles
     * @returns {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>}
     */
    static #buildOwnerBounds(lines, pins, rectangles = []) {
        const ownerBounds = new Map()

        for (const line of lines) {
            if (!line.ownerIndex) {
                continue
            }

            SchematicTextPostProcessor.#extendBounds(
                ownerBounds,
                line.ownerIndex,
                [
                    { x: line.x1, y: line.y1 },
                    { x: line.x2, y: line.y2 }
                ]
            )
        }

        for (const pin of pins) {
            if (!pin.ownerIndex) {
                continue
            }

            SchematicTextPostProcessor.#extendBounds(
                ownerBounds,
                pin.ownerIndex,
                [{ x: pin.x, y: pin.y }]
            )
        }

        for (const rectangle of rectangles) {
            if (!rectangle.ownerIndex) {
                continue
            }

            SchematicTextPostProcessor.#extendBounds(
                ownerBounds,
                rectangle.ownerIndex,
                [
                    { x: rectangle.x, y: rectangle.y },
                    {
                        x: rectangle.x + rectangle.width,
                        y: rectangle.y + rectangle.height
                    }
                ]
            )
        }

        return ownerBounds
    }

    /**
     * Counts visible pins per owner so compact passive parts can keep their
     * left-to-right designator flow.
     * @param {{ ownerIndex: string }[]} pins
     * @returns {Map<string, number>}
     */
    static #buildOwnerPinCounts(pins) {
        const ownerPinCounts = new Map()

        for (const pin of pins) {
            if (!pin.ownerIndex) {
                continue
            }

            ownerPinCounts.set(
                pin.ownerIndex,
                (ownerPinCounts.get(pin.ownerIndex) || 0) + 1
            )
        }

        return ownerPinCounts
    }

    /**
     * Collects the visible pin orientations per owner.
     * @param {{ ownerIndex: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {Map<string, Set<'left' | 'right' | 'top' | 'bottom'>>}
     */
    static #buildOwnerPinOrientations(pins) {
        const ownerPinOrientations = new Map()

        for (const pin of pins) {
            if (!pin.ownerIndex || !pin.orientation) {
                continue
            }

            if (!ownerPinOrientations.has(pin.ownerIndex)) {
                ownerPinOrientations.set(pin.ownerIndex, new Set())
            }

            ownerPinOrientations.get(pin.ownerIndex).add(pin.orientation)
        }

        return ownerPinOrientations
    }

    /**
     * Returns true when a text is a visible component designator.
     * @param {{ name?: string }} text
     * @returns {boolean}
     */
    static #isDesignatorText(text) {
        return (
            String(text.name || '')
                .trim()
                .toLowerCase() === 'designator'
        )
    }

    /**
     * Returns true when a left-side designator shares its owner-side stack with
     * a visible value or comment text at the same owner-side x position.
     * @param {{ x: number, y: number, ownerIndex?: string }} text
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, rotation?: number }[]} texts
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #hasVisibleOwnerSideTextStack(text, texts, bounds) {
        const side = SchematicTextPostProcessor.#resolveOwnerSide(text, bounds)

        if (!side) {
            return false
        }

        return texts.some((candidate) => {
            const normalizedName = String(candidate?.name || '')
                .trim()
                .toLowerCase()

            return (
                candidate &&
                candidate !== text &&
                candidate.ownerIndex === text.ownerIndex &&
                !candidate.rotation &&
                (normalizedName === 'value' || normalizedName === 'comment') &&
                Math.abs(candidate.x - text.x) <= 2 &&
                SchematicTextPostProcessor.#isTextOnOwnerSide(
                    candidate,
                    bounds,
                    side
                )
            )
        })
    }

    /**
     * Resolves which horizontal owner side a text sits on.
     * @param {{ x: number }} text
     * @param {{ minX: number, maxX: number }} bounds
     * @returns {'left' | 'right' | null}
     */
    static #resolveOwnerSide(text, bounds) {
        if (text.x <= bounds.minX + 2) {
            return 'left'
        }

        if (text.x >= bounds.maxX - 2) {
            return 'right'
        }

        return null
    }

    /**
     * Returns true when a text sits on the requested horizontal owner side.
     * @param {{ x: number }} text
     * @param {{ minX: number, maxX: number }} bounds
     * @param {'left' | 'right'} side
     * @returns {boolean}
     */
    static #isTextOnOwnerSide(text, bounds, side) {
        if (side === 'left') {
            return text.x <= bounds.minX + 2
        }

        return text.x >= bounds.maxX - 2
    }

    /**
     * Returns true when a horizontal owner already exposes a visible
     * value/comment on the far side of the body, so the left designator should
     * keep its original left-to-right source anchor.
     * @param {{ x: number, y: number, ownerIndex?: string }} text
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, rotation?: number }[]} texts
     * @param {{ minX: number, maxX: number }} bounds
     * @param {Set<'left' | 'right' | 'top' | 'bottom'>} ownerOrientations
     * @returns {boolean}
     */
    static #hasVisibleOppositeSideValuePair(
        text,
        texts,
        bounds,
        ownerOrientations
    ) {
        if (
            !ownerOrientations.has('left') ||
            !ownerOrientations.has('right') ||
            ownerOrientations.has('top') ||
            ownerOrientations.has('bottom')
        ) {
            return false
        }

        return texts.some((candidate) => {
            const normalizedName = String(candidate?.name || '')
                .trim()
                .toLowerCase()

            return (
                candidate &&
                candidate !== text &&
                candidate.ownerIndex === text.ownerIndex &&
                !candidate.rotation &&
                (normalizedName === 'value' || normalizedName === 'comment') &&
                candidate.x >= bounds.maxX - 2 &&
                candidate.x > text.x &&
                Math.abs(candidate.y - text.y) <= 2
            )
        })
    }

    /**
     * Adds a small gap between a top-side designator and the owner outline.
     * @param {{ x: number, y: number }} text
     * @param {{ maxY: number }} bounds
     * @returns {{ x: number, y: number }}
     */
    static #padDesignatorAboveOwner(text, bounds) {
        if (text.y < bounds.maxY - 1 || text.y >= bounds.maxY + 4) {
            return text
        }

        return {
            ...text,
            y: bounds.maxY + 4
        }
    }

    /**
     * Returns true for compact two-pin symbols whose left-side designators
     * should keep reading left-to-right instead of flipping toward the body.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} ownerPinCount
     * @returns {boolean}
     */
    static #isCompactTwoPinOwner(bounds, ownerPinCount) {
        return (
            ownerPinCount === 2 &&
            bounds.maxX - bounds.minX <= 12 &&
            bounds.maxY - bounds.minY <= 20
        )
    }

    /**
     * Returns true when a component text sits immediately to the right of a
     * visible same-row wire label and should preserve the left-to-right flow.
     * @param {{ x: number, y: number, recordType?: string, rotation?: number }} text
     * @param {{ x: number, y: number, recordType?: string, rotation?: number }}[] texts
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down' }[]} ports
     * @returns {boolean}
     */
    static #hasNearbyLeftWireLabel(text, texts, lines, pins, ports) {
        return texts.some(
            (candidate) =>
                candidate &&
                candidate !== text &&
                candidate.recordType === '25' &&
                !candidate.rotation &&
                candidate.x < text.x &&
                text.x - candidate.x <= 80 &&
                Math.abs(candidate.y - text.y) <= 2 &&
                (SchematicTextPostProcessor.#hasPinConnectedAtWireStart(
                    candidate,
                    lines,
                    pins
                ) ||
                    SchematicTextPostProcessor.#hasLineConnectedAtWireStart(
                        candidate,
                        lines
                    ) ||
                    SchematicTextPostProcessor.#hasPortConnectedAtWireStart(
                        candidate,
                        lines,
                        ports
                    ))
        )
    }

    /**
     * Returns true when the left endpoint of the label's wire segment is
     * already connected into another wire segment, such as a bus breakout.
     * Those labels should keep reading left-to-right from the junction.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @returns {boolean}
     */
    static #hasLineConnectedAtWireStart(text, lines) {
        const containingSegment =
            SchematicTextPostProcessor.#findContainingHorizontalWireSegment(
                text,
                lines
            )

        if (!containingSegment) {
            return false
        }

        const leftPoint = {
            x: Math.min(containingSegment.x1, containingSegment.x2),
            y: text.y
        }

        return lines.some(
            (line) =>
                line !== containingSegment &&
                SchematicTextPostProcessor.#pointTouchesLine(leftPoint, line)
        )
    }

    /**
     * Returns true when the horizontal wire segment under the label starts at a
     * pin endpoint, which means the label should continue reading rightward.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {boolean}
     */
    static #hasPinConnectedAtWireStart(text, lines, pins) {
        const containingSegment =
            SchematicTextPostProcessor.#findContainingHorizontalWireSegment(
                text,
                lines
            )

        if (!containingSegment) {
            return false
        }

        const leftX = Math.min(containingSegment.x1, containingSegment.x2)

        return pins.some((pin) => {
            const endpoint =
                SchematicTextPostProcessor.#projectPinOuterEndpoint(pin)

            return (
                endpoint &&
                Math.abs(endpoint.x - leftX) <= 2 &&
                Math.abs(endpoint.y - text.y) <= 2
            )
        })
    }

    /**
     * Returns true when the horizontal wire segment under the label starts at an
     * off-sheet port connection, which means the label should keep reading
     * rightward from that port.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down' }[]} ports
     * @returns {boolean}
     */
    static #hasPortConnectedAtWireStart(text, lines, ports) {
        const containingSegment =
            SchematicTextPostProcessor.#findContainingHorizontalWireSegment(
                text,
                lines
            )

        if (!containingSegment) {
            return false
        }

        const leftX = Math.min(containingSegment.x1, containingSegment.x2)

        return ports.some(
            (port) =>
                Math.abs(port.y - text.y) <= 2 &&
                (Math.abs(port.x - leftX) <= 2 ||
                    Math.abs(port.x + port.width - leftX) <= 2)
        )
    }

    /**
     * Finds the horizontal wire segment that carries a text label.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @returns {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string } | null}
     */
    static #findContainingHorizontalWireSegment(text, lines) {
        const candidates = lines.filter(
            (line) =>
                Math.abs(line.y1 - text.y) <= 2 &&
                Math.abs(line.y2 - text.y) <= 2 &&
                Math.min(line.x1, line.x2) - 2 <= text.x &&
                text.x <= Math.max(line.x1, line.x2) + 2
        )

        if (!candidates.length) {
            return null
        }

        return candidates.sort(
            (left, right) =>
                Math.abs(Math.min(left.x1, left.x2) - text.x) -
                Math.abs(Math.min(right.x1, right.x2) - text.x)
        )[0]
    }

    /**
     * Returns true when a point lands on a line segment endpoint or on an
     * axis-aligned segment interior.
     * @param {{ x: number, y: number }} point
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @returns {boolean}
     */
    static #pointTouchesLine(point, line) {
        const touchesStart =
            Math.abs(line.x1 - point.x) <= 2 && Math.abs(line.y1 - point.y) <= 2
        const touchesEnd =
            Math.abs(line.x2 - point.x) <= 2 && Math.abs(line.y2 - point.y) <= 2

        if (touchesStart || touchesEnd) {
            return true
        }

        const minX = Math.min(line.x1, line.x2) - 2
        const maxX = Math.max(line.x1, line.x2) + 2
        const minY = Math.min(line.y1, line.y2) - 2
        const maxY = Math.max(line.y1, line.y2) + 2

        if (
            Math.abs(line.x1 - line.x2) <= 2 &&
            Math.abs(point.x - line.x1) <= 2 &&
            point.y >= minY &&
            point.y <= maxY
        ) {
            return true
        }

        if (
            Math.abs(line.y1 - line.y2) <= 2 &&
            Math.abs(point.y - line.y1) <= 2 &&
            point.x >= minX &&
            point.x <= maxX
        ) {
            return true
        }

        return false
    }

    /**
     * Expands one owner-bound entry with a set of points.
     * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} ownerBounds
     * @param {string} ownerIndex
     * @param {{ x: number, y: number }[]} points
     * @returns {void}
     */
    static #extendBounds(ownerBounds, ownerIndex, points) {
        const current = ownerBounds.get(ownerIndex) || {
            minX: Number.POSITIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY
        }

        for (const point of points) {
            current.minX = Math.min(current.minX, point.x)
            current.minY = Math.min(current.minY, point.y)
            current.maxX = Math.max(current.maxX, point.x)
            current.maxY = Math.max(current.maxY, point.y)
        }

        ownerBounds.set(ownerIndex, current)
    }

    /**
     * Projects one pin into its wire-connected outer endpoint.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ x: number, y: number } | null}
     */
    static #projectPinOuterEndpoint(pin) {
        switch (pin.orientation) {
            case 'left':
                return { x: pin.x - pin.length, y: pin.y }
            case 'right':
                return { x: pin.x + pin.length, y: pin.y }
            case 'top':
                return { x: pin.x, y: pin.y + pin.length }
            case 'bottom':
                return { x: pin.x, y: pin.y - pin.length }
            default:
                return null
        }
    }
}
