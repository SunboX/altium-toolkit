// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Compares generated ECAD keys in natural ASCII order without locale collation.
 */
export class NaturalStringComparator {
    /**
     * Compares two strings with numeric runs ordered by numeric value.
     * @param {string} left Left value.
     * @param {string} right Right value.
     * @returns {number}
     */
    static compare(left, right) {
        const leftValue = String(left ?? '')
        const rightValue = String(right ?? '')
        let leftIndex = 0
        let rightIndex = 0

        while (leftIndex < leftValue.length && rightIndex < rightValue.length) {
            const leftCode = leftValue.charCodeAt(leftIndex)
            const rightCode = rightValue.charCodeAt(rightIndex)

            if (leftCode > 0x7f || rightCode > 0x7f) {
                return leftValue.localeCompare(rightValue, undefined, {
                    numeric: true
                })
            }

            if (
                NaturalStringComparator.#isDigit(leftCode) &&
                NaturalStringComparator.#isDigit(rightCode)
            ) {
                const digitComparison =
                    NaturalStringComparator.#compareDigitRuns(
                        leftValue,
                        rightValue,
                        leftIndex,
                        rightIndex
                    )
                if (digitComparison.comparison !== 0) {
                    return digitComparison.comparison
                }
                leftIndex = digitComparison.leftEnd
                rightIndex = digitComparison.rightEnd
                continue
            }

            const normalizedLeft =
                NaturalStringComparator.#toLowerAsciiCode(leftCode)
            const normalizedRight =
                NaturalStringComparator.#toLowerAsciiCode(rightCode)
            if (normalizedLeft !== normalizedRight) {
                return normalizedLeft - normalizedRight
            }
            if (leftCode !== rightCode) {
                return leftCode - rightCode
            }

            leftIndex += 1
            rightIndex += 1
        }

        return leftValue.length - rightValue.length
    }

    /**
     * Compares numeric runs starting at the provided offsets.
     * @param {string} leftValue Left value.
     * @param {string} rightValue Right value.
     * @param {number} leftStart Left digit offset.
     * @param {number} rightStart Right digit offset.
     * @returns {{ comparison: number, leftEnd: number, rightEnd: number }}
     */
    static #compareDigitRuns(leftValue, rightValue, leftStart, rightStart) {
        const leftEnd = NaturalStringComparator.#digitRunEnd(
            leftValue,
            leftStart
        )
        const rightEnd = NaturalStringComparator.#digitRunEnd(
            rightValue,
            rightStart
        )
        const leftSignificant = NaturalStringComparator.#skipLeadingZeros(
            leftValue,
            leftStart,
            leftEnd
        )
        const rightSignificant = NaturalStringComparator.#skipLeadingZeros(
            rightValue,
            rightStart,
            rightEnd
        )
        const leftLength = leftEnd - leftSignificant
        const rightLength = rightEnd - rightSignificant

        if (leftLength !== rightLength) {
            return {
                comparison: leftLength - rightLength,
                leftEnd,
                rightEnd
            }
        }

        for (
            let offset = 0;
            offset < leftLength && offset < rightLength;
            offset += 1
        ) {
            const comparison =
                leftValue.charCodeAt(leftSignificant + offset) -
                rightValue.charCodeAt(rightSignificant + offset)
            if (comparison !== 0) {
                return { comparison, leftEnd, rightEnd }
            }
        }

        return {
            comparison: leftEnd - leftStart - (rightEnd - rightStart),
            leftEnd,
            rightEnd
        }
    }

    /**
     * Returns the offset after one ASCII digit run.
     * @param {string} value Source value.
     * @param {number} start Start offset.
     * @returns {number}
     */
    static #digitRunEnd(value, start) {
        let end = start
        while (
            end < value.length &&
            NaturalStringComparator.#isDigit(value.charCodeAt(end))
        ) {
            end += 1
        }
        return end
    }

    /**
     * Skips leading zeroes while leaving one digit for all-zero runs.
     * @param {string} value Source value.
     * @param {number} start Start offset.
     * @param {number} end End offset.
     * @returns {number}
     */
    static #skipLeadingZeros(value, start, end) {
        let index = start
        while (index < end - 1 && value.charCodeAt(index) === 48) {
            index += 1
        }
        return index
    }

    /**
     * Returns true for ASCII digit code points.
     * @param {number} code Character code.
     * @returns {boolean}
     */
    static #isDigit(code) {
        return code >= 48 && code <= 57
    }

    /**
     * Converts uppercase ASCII code points to lowercase.
     * @param {number} code Character code.
     * @returns {number}
     */
    static #toLowerAsciiCode(code) {
        return code >= 65 && code <= 90 ? code + 32 : code
    }
}
