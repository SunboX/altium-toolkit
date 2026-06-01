// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Regex helpers for netlist query tools.
 */
export class RegexPattern {
    /**
     * Parses a user regex pattern into a JavaScript RegExp.
     * @param {string} pattern User-provided pattern.
     * @param {string} [flags] RegExp flags.
     * @returns {{ regex: RegExp } | { error: string }}
     */
    static parse(pattern, flags = 'i') {
        const normalizedPattern = RegexPattern.#normalizeInlineFlags(pattern)
        const normalizedFlags = RegexPattern.#normalizeFlags(
            flags,
            normalizedPattern.forceIgnoreCase
        )

        try {
            return {
                regex: new RegExp(normalizedPattern.pattern, normalizedFlags)
            }
        } catch (error) {
            return {
                error:
                    'Invalid regex pattern ' +
                    JSON.stringify(String(pattern || '')) +
                    ': ' +
                    (error instanceof Error ? error.message : String(error))
            }
        }
    }

    /**
     * Returns true when a pattern matches every candidate value.
     * @param {string} pattern User-provided pattern.
     * @param {string[]} candidates Candidate values.
     * @returns {boolean}
     */
    static rejectsBroadMatch(pattern, candidates) {
        const parsed = RegexPattern.parse(pattern)
        if (parsed.error || !Array.isArray(candidates) || !candidates.length) {
            return false
        }

        return candidates.every((candidate) => {
            parsed.regex.lastIndex = 0
            return parsed.regex.test(String(candidate || ''))
        })
    }

    /**
     * Normalizes a leading `(?i)` flag into JavaScript RegExp flags.
     * @param {string} pattern User-provided pattern.
     * @returns {{ pattern: string, forceIgnoreCase: boolean }}
     */
    static #normalizeInlineFlags(pattern) {
        const source = String(pattern || '')
        if (source.startsWith('(?i)')) {
            return {
                pattern: source.slice(4),
                forceIgnoreCase: true
            }
        }

        return {
            pattern: source,
            forceIgnoreCase: false
        }
    }

    /**
     * Adds the ignore-case flag when requested.
     * @param {string} flags RegExp flags.
     * @param {boolean} forceIgnoreCase Whether to force `i`.
     * @returns {string}
     */
    static #normalizeFlags(flags, forceIgnoreCase) {
        const uniqueFlags = new Set(String(flags || '').split(''))
        if (forceIgnoreCase) {
            uniqueFlags.add('i')
        }

        return [...uniqueFlags].join('')
    }
}
