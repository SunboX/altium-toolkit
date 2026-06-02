// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Infers omitted numeric schematic pin designators from compact owner geometry.
 */
export class SchematicPinDesignatorInferer {
    /**
     * Infers omitted source-order pin numbers for compact four-pin symbols
     * whose printable records keep enough numeric hints to prove the sequence.
     * @param {{ x: number, y: number, length: number, name?: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {{ x: number, y: number, length: number, name?: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[] | null}
     */
    static inferSequentialCompactFourPinDesignators(pins) {
        if (
            pins.length !== 4 ||
            !SchematicPinDesignatorInferer.#isCompactFourPinOwner(pins)
        ) {
            return null
        }

        let explicitCount = 0

        for (let index = 0; index < pins.length; index += 1) {
            const designator = String(pins[index].designator || '').trim()

            if (!designator) {
                continue
            }

            explicitCount += 1

            if (!/^\d+$/.test(designator)) {
                return null
            }

            if (Number(designator) !== index + 1) {
                return null
            }
        }

        if (explicitCount < 2) {
            return null
        }

        if (
            explicitCount === pins.length &&
            !SchematicPinDesignatorInferer.#hasRepeatedCompactTerminalNames(
                pins
            )
        ) {
            return null
        }

        return pins.map((pin, index) => ({
            ...pin,
            designator: String(index + 1)
        }))
    }

    /**
     * Returns true when a compact four-pin owner repeats internal terminal
     * names, so visible pin numbers are the useful external labels.
     * @param {{ name?: string }[]} pins
     * @returns {boolean}
     */
    static #hasRepeatedCompactTerminalNames(pins) {
        const names = pins.map((pin) => String(pin.name || '').trim())

        if (names.some((name) => !name)) {
            return false
        }

        const counts = new Map()
        for (const name of names) {
            counts.set(name, (counts.get(name) || 0) + 1)
        }

        return (
            counts.size < pins.length &&
            [...counts.values()].every((count) => count > 1)
        )
    }

    /**
     * Infers omitted numeric labels for compact two-column owners whose
     * physical side geometry implies the same sequence Altium displays.
     * @param {{ x: number, y: number, length: number, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {{ x: number, y: number, length: number, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[] | null}
     */
    static inferCompactTwoColumnDesignators(pins) {
        if (pins.length < 5) {
            return null
        }

        const leftPins = pins.filter((pin) => pin.orientation === 'left')
        const rightPins = pins.filter((pin) => pin.orientation === 'right')

        if (
            leftPins.length < 2 ||
            rightPins.length < 2 ||
            leftPins.length + rightPins.length !== pins.length ||
            !SchematicPinDesignatorInferer.#isCompactTwoColumnOwner(
                pins,
                leftPins,
                rightPins
            )
        ) {
            return null
        }

        if (pins.some((pin) => String(pin.designator || '').trim())) {
            return SchematicPinDesignatorInferer.#inferExplicitTwoColumnDesignators(
                pins,
                leftPins,
                rightPins
            )
        }

        const designators = new Map()

        SchematicPinDesignatorInferer.#sortPinsTopToBottom(leftPins).forEach(
            (pin, index) => {
                designators.set(pin, String(index + 1))
            }
        )
        SchematicPinDesignatorInferer.#sortPinsTopToBottom(rightPins).forEach(
            (pin, index) => {
                designators.set(pin, String(pins.length - index))
            }
        )

        return pins.map((pin) => ({
            ...pin,
            designator: designators.get(pin) || ''
        }))
    }

    /**
     * Infers omitted labels from explicit per-side arithmetic pin sequences.
     * @param {{ x: number, y: number, length: number, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number, length: number, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} leftPins
     * @param {{ x: number, y: number, length: number, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} rightPins
     * @returns {{ x: number, y: number, length: number, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[] | null}
     */
    static #inferExplicitTwoColumnDesignators(pins, leftPins, rightPins) {
        if (
            pins.some((pin) => {
                const designator = String(pin.designator || '').trim()

                return designator && !/^\d+$/.test(designator)
            })
        ) {
            return null
        }

        const leftDesignators =
            SchematicPinDesignatorInferer.#inferSideSequenceDesignators(
                leftPins
            )
        const rightDesignators =
            SchematicPinDesignatorInferer.#inferSideSequenceDesignators(
                rightPins
            )

        if (!leftDesignators || !rightDesignators) {
            return null
        }

        const designators = new Map([...leftDesignators, ...rightDesignators])

        if (designators.size !== pins.length) {
            return null
        }

        return pins.map((pin) => ({
            ...pin,
            designator: designators.get(pin) || ''
        }))
    }

    /**
     * Infers omitted numeric labels for compact one-sided connector columns
     * when the visible labels prove a continuous top-to-bottom sequence.
     * @param {{ x: number, y: number, length: number, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {{ x: number, y: number, length: number, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[] | null}
     */
    static inferSingleColumnDesignators(pins) {
        if (
            pins.length < 5 ||
            pins.every((pin) => String(pin.designator || '').trim())
        ) {
            return null
        }

        const orientations = new Set(pins.map((pin) => pin.orientation))
        const orientation = [...orientations][0]

        if (
            orientations.size !== 1 ||
            (orientation !== 'left' && orientation !== 'right')
        ) {
            return null
        }

        const maxLength = Math.max(
            ...pins.map((pin) => Number(pin.length) || 0),
            1
        )

        if (
            !SchematicPinDesignatorInferer.#isCompactVerticalPinColumn(
                pins,
                maxLength
            )
        ) {
            return null
        }

        const designators =
            SchematicPinDesignatorInferer.#inferSideSequenceDesignators(pins)

        if (!designators || designators.size !== pins.length) {
            return null
        }

        return pins.map((pin) => ({
            ...pin,
            designator: designators.get(pin) || ''
        }))
    }

    /**
     * Infers one compact side's complete numbering when existing labels fit a
     * top-to-bottom ascending or descending sequence.
     * @param {{ x: number, y: number, designator: string }[]} pins
     * @returns {Map<{ x: number, y: number, designator: string }, string> | null}
     */
    static #inferSideSequenceDesignators(pins) {
        const sortedPins =
            SchematicPinDesignatorInferer.#sortPinsTopToBottom(pins)
        const explicitPins = sortedPins
            .map((pin, index) => ({
                pin,
                index,
                designator: String(pin.designator || '').trim()
            }))
            .filter((pin) => pin.designator)

        if (explicitPins.length < 2) {
            return null
        }

        for (const step of [1, -1]) {
            const offset =
                Number(explicitPins[0].designator) -
                explicitPins[0].index * step
            const fits = explicitPins.every(
                (pin) => Number(pin.designator) === offset + pin.index * step
            )

            if (!fits) {
                continue
            }

            const inferred = new Map()
            const values = new Set()

            for (let index = 0; index < sortedPins.length; index += 1) {
                const value = offset + index * step

                if (value <= 0 || !Number.isInteger(value)) {
                    return null
                }

                values.add(value)
                inferred.set(sortedPins[index], String(value))
            }

            if (values.size === sortedPins.length) {
                return inferred
            }
        }

        return null
    }

    /**
     * Returns true when pins form one compact rectangular two-column owner.
     * @param {{ x: number, y: number, length: number }[]} pins
     * @param {{ x: number, y: number, length: number }[]} leftPins
     * @param {{ x: number, y: number, length: number }[]} rightPins
     * @returns {boolean}
     */
    static #isCompactTwoColumnOwner(pins, leftPins, rightPins) {
        const xs = pins.map((pin) => Number(pin.x))
        const ys = pins.map((pin) => Number(pin.y))
        const lengths = pins.map((pin) => Number(pin.length) || 0)
        const maxLength = Math.max(...lengths, 1)
        const horizontalSpan = Math.max(...xs) - Math.min(...xs)
        const verticalSpan = Math.max(...ys) - Math.min(...ys)

        return (
            horizontalSpan >= maxLength * 2 &&
            horizontalSpan <= maxLength * 5 &&
            verticalSpan <= maxLength * 4 &&
            SchematicPinDesignatorInferer.#isCompactVerticalPinColumn(
                leftPins,
                maxLength
            ) &&
            SchematicPinDesignatorInferer.#isCompactVerticalPinColumn(
                rightPins,
                maxLength
            ) &&
            SchematicPinDesignatorInferer.#verticalPinColumnRangesOverlap(
                leftPins,
                rightPins,
                maxLength
            )
        )
    }

    /**
     * Returns true when a side's pins share one vertical edge with compact
     * spacing between adjacent contacts.
     * @param {{ x: number, y: number }[]} pins
     * @param {number} maxLength
     * @returns {boolean}
     */
    static #isCompactVerticalPinColumn(pins, maxLength) {
        const xs = pins.map((pin) => Number(pin.x))
        const xSpan = Math.max(...xs) - Math.min(...xs)
        const sortedPins =
            SchematicPinDesignatorInferer.#sortPinsBottomToTop(pins)
        const tolerance = 0.01

        if (xSpan > Math.max(tolerance, maxLength * 0.05)) {
            return false
        }

        for (let index = 1; index < sortedPins.length; index += 1) {
            const gap =
                Number(sortedPins[index].y) - Number(sortedPins[index - 1].y)

            if (gap <= tolerance || gap > maxLength) {
                return false
            }
        }

        return true
    }

    /**
     * Returns true when the two side columns occupy the same compact body span.
     * @param {{ y: number }[]} leftPins
     * @param {{ y: number }[]} rightPins
     * @param {number} maxLength
     * @returns {boolean}
     */
    static #verticalPinColumnRangesOverlap(leftPins, rightPins, maxLength) {
        const leftRange = SchematicPinDesignatorInferer.#pinYRange(leftPins)
        const rightRange = SchematicPinDesignatorInferer.#pinYRange(rightPins)
        const overlap =
            Math.min(leftRange.max, rightRange.max) -
            Math.max(leftRange.min, rightRange.min)
        const requiredOverlap = Math.min(
            maxLength,
            leftRange.max - leftRange.min,
            rightRange.max - rightRange.min
        )

        return overlap >= requiredOverlap
    }

    /**
     * Sorts pins from schematic top to bottom.
     * @param {{ x: number, y: number }[]} pins
     * @returns {{ x: number, y: number }[]}
     */
    static #sortPinsTopToBottom(pins) {
        return [...pins].sort((left, right) => Number(right.y) - Number(left.y))
    }

    /**
     * Sorts pins from schematic bottom to top.
     * @param {{ x: number, y: number }[]} pins
     * @returns {{ x: number, y: number }[]}
     */
    static #sortPinsBottomToTop(pins) {
        return [...pins].sort((left, right) => Number(left.y) - Number(right.y))
    }

    /**
     * Returns the vertical bounds of a pin column.
     * @param {{ y: number }[]} pins
     * @returns {{ min: number, max: number }}
     */
    static #pinYRange(pins) {
        const ys = pins.map((pin) => Number(pin.y))

        return {
            min: Math.min(...ys),
            max: Math.max(...ys)
        }
    }

    /**
     * Returns true when four pins form one compact two-sided symbol body.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {boolean}
     */
    static #isCompactFourPinOwner(pins) {
        const orientations = new Set(pins.map((pin) => pin.orientation))

        if (
            orientations.size !== 2 ||
            !orientations.has('left') ||
            !orientations.has('right')
        ) {
            return false
        }

        const xs = pins.map((pin) => Number(pin.x))
        const ys = pins.map((pin) => Number(pin.y))
        const lengths = pins.map((pin) => Number(pin.length) || 0)
        const maxLength = Math.max(...lengths, 1)

        return (
            Math.max(...xs) - Math.min(...xs) <= maxLength * 3 &&
            Math.max(...ys) - Math.min(...ys) <= maxLength * 3
        )
    }
}
