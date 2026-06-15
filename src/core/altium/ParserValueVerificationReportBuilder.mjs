// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds fixture-oriented parser value verification reports from path maps.
 */
export class ParserValueVerificationReportBuilder {
    static SCHEMA = 'altium-toolkit.parser-value-verification.a1'

    /**
     * Builds a value verification report.
     * @param {{ cases?: object[] }} [input] Report input.
     * @returns {object}
     */
    static build(input = {}) {
        const cases = (input.cases || []).map((entry, index) =>
            ParserValueVerificationReportBuilder.#caseReport(entry, index)
        )
        const failures = cases.flatMap((entry) =>
            entry.failures.map((failure) => ({
                caseKey: entry.key,
                ...(entry.source ? { source: entry.source } : {}),
                ...failure
            }))
        )
        const passedCount = cases.reduce(
            (total, entry) => total + entry.passedCount,
            0
        )
        const failedCount = cases.reduce(
            (total, entry) => total + entry.failedCount,
            0
        )

        return {
            schema: ParserValueVerificationReportBuilder.SCHEMA,
            summary: {
                caseCount: cases.length,
                assertionCount: cases.reduce(
                    (total, entry) => total + entry.assertionCount,
                    0
                ),
                passedCount,
                failedCount,
                mismatchCount: failures.filter(
                    (failure) => failure.status === 'mismatch'
                ).length,
                missingCount: failures.filter(
                    (failure) => failure.status === 'missing'
                ).length,
                status: failedCount ? 'failed' : 'passed'
            },
            cases,
            failures
        }
    }

    /**
     * Builds one case report.
     * @param {object} entry Case input.
     * @param {number} index Case index.
     * @returns {object}
     */
    static #caseReport(entry, index) {
        const key = String(entry.key || 'case-' + index)
        const actual = entry.actual || entry.model || entry.documentModel || {}
        const assertionInput =
            entry.expectedValues || entry.expected || entry.assertions || []
        const assertions =
            ParserValueVerificationReportBuilder.#assertions(assertionInput)
        const failures = []
        const passedAssertions = []

        for (const assertion of assertions) {
            const actualValue = ParserValueVerificationReportBuilder.#pathValue(
                actual,
                assertion.path
            )

            if (!actualValue.present) {
                failures.push(
                    ParserValueVerificationReportBuilder.#failure(
                        assertion,
                        actualValue,
                        'missing'
                    )
                )
                continue
            }

            if (
                !ParserValueVerificationReportBuilder.#equal(
                    actualValue.value,
                    assertion.expected
                )
            ) {
                failures.push(
                    ParserValueVerificationReportBuilder.#failure(
                        assertion,
                        actualValue,
                        'mismatch'
                    )
                )
                continue
            }

            passedAssertions.push({
                path: assertion.path,
                expected: assertion.expected,
                ...(assertion.label ? { label: assertion.label } : {})
            })
        }

        return ParserValueVerificationReportBuilder.#stripUndefined({
            key,
            source: entry.source,
            status: failures.length ? 'failed' : 'passed',
            assertionCount: assertions.length,
            passedCount: assertions.length - failures.length,
            failedCount: failures.length,
            failures,
            assertions:
                ParserValueVerificationReportBuilder.#shouldIncludeAssertions(
                    assertionInput
                )
                    ? passedAssertions
                    : undefined
        })
    }

    /**
     * Converts path-map or assertion-list input into assertion rows.
     * @param {Record<string, unknown> | object[]} input Assertion input.
     * @returns {{ path: string, expected: unknown, label?: string }[]}
     */
    static #assertions(input) {
        if (Array.isArray(input)) {
            return input
                .filter((entry) => entry?.path)
                .map((entry) => ({
                    path: String(entry.path),
                    expected: entry.expected,
                    label: entry.label
                }))
        }

        return Object.entries(input || {}).map(([path, expected]) => ({
            path,
            expected
        }))
    }

    /**
     * Returns true when passing assertion detail should be emitted.
     * @param {Record<string, unknown> | object[]} input Assertion input.
     * @returns {boolean}
     */
    static #shouldIncludeAssertions(input) {
        return Array.isArray(input)
    }

    /**
     * Builds one failure row.
     * @param {{ path: string, expected: unknown }} assertion Expected assertion.
     * @param {{ present: boolean, value: unknown }} actualValue Actual path lookup.
     * @param {'missing' | 'mismatch'} status Failure status.
     * @returns {object}
     */
    static #failure(assertion, actualValue, status) {
        const actual = actualValue.present
            ? ParserValueVerificationReportBuilder.#jsonValue(actualValue.value)
            : null
        const expected = ParserValueVerificationReportBuilder.#jsonValue(
            assertion.expected
        )

        return {
            path: assertion.path,
            status,
            expected,
            actual,
            message:
                status === 'missing'
                    ? 'Expected ' +
                      assertion.path +
                      ' to equal ' +
                      ParserValueVerificationReportBuilder.#formatValue(
                          expected
                      ) +
                      ' but the path was missing.'
                    : 'Expected ' +
                      assertion.path +
                      ' to equal ' +
                      ParserValueVerificationReportBuilder.#formatValue(
                          expected
                      ) +
                      ' but received ' +
                      ParserValueVerificationReportBuilder.#formatValue(
                          actual
                      ) +
                      '.'
        }
    }

    /**
     * Resolves one dot/bracket path from an object.
     * @param {object} source Source object.
     * @param {string} path Path expression.
     * @returns {{ present: boolean, value: unknown }}
     */
    static #pathValue(source, path) {
        const parts = String(path || '')
            .replace(/\[(\d+)\]/gu, '.$1')
            .split('.')
            .filter(Boolean)
        let current = source

        for (const part of parts) {
            if (Array.isArray(current)) {
                const index = Number(part)
                if (
                    !Number.isInteger(index) ||
                    index < 0 ||
                    index >= current.length
                ) {
                    return { present: false, value: undefined }
                }
                current = current[index]
                continue
            }

            if (!current || typeof current !== 'object' || !(part in current)) {
                return { present: false, value: undefined }
            }

            current = current[part]
        }

        return { present: true, value: current }
    }

    /**
     * Compares two values by stable JSON representation.
     * @param {unknown} left First value.
     * @param {unknown} right Second value.
     * @returns {boolean}
     */
    static #equal(left, right) {
        return (
            ParserValueVerificationReportBuilder.#stableJson(left) ===
            ParserValueVerificationReportBuilder.#stableJson(right)
        )
    }

    /**
     * Converts values into JSON-safe report payloads.
     * @param {unknown} value Source value.
     * @returns {unknown}
     */
    static #jsonValue(value) {
        return value === undefined ? null : value
    }

    /**
     * Formats a value for a concise diagnostic message.
     * @param {unknown} value Report value.
     * @returns {string}
     */
    static #formatValue(value) {
        return JSON.stringify(value)
    }

    /**
     * Produces a stable JSON representation for comparison.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #stableJson(value) {
        if (!value || typeof value !== 'object') {
            return JSON.stringify(value)
        }

        if (Array.isArray(value)) {
            return (
                '[' +
                value
                    .map((entry) =>
                        ParserValueVerificationReportBuilder.#stableJson(entry)
                    )
                    .join(',') +
                ']'
            )
        }

        return (
            '{' +
            Object.keys(value)
                .sort()
                .map(
                    (key) =>
                        JSON.stringify(key) +
                        ':' +
                        ParserValueVerificationReportBuilder.#stableJson(
                            value[key]
                        )
                )
                .join(',') +
            '}'
        )
    }

    /**
     * Removes undefined properties from one row.
     * @param {object} row Source row.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
