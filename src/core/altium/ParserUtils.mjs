// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Shared parsing helpers for normalized Altium records.
 */
export class ParserUtils {
    /** @type {WeakMap<object, Map<string, { raw: unknown, rawUtf8: unknown, value: string }>>} */
    static #fieldValueCache = new WeakMap()

    /**
     * Removes duplicate PCB placements by designator.
     * @param {{ designator: string }[]} components
     * @returns {any[]}
     */
    static dedupeByDesignator(components) {
        const map = new Map()

        for (const component of components) {
            if (!component.designator) continue
            map.set(component.designator, component)
        }

        return [...map.values()].sort((left, right) =>
            left.designator.localeCompare(right.designator, undefined, {
                numeric: true
            })
        )
    }

    /**
     * Returns the file name without extension.
     * @param {string} fileName
     * @returns {string}
     */
    static stripExtension(fileName) {
        return String(fileName || '').replace(/\.[^.]+$/, '')
    }

    /**
     * Returns the best display text from repeated text fields.
     * @param {Record<string, string | string[]>} fields
     * @returns {string}
     */
    static getDisplayText(fields) {
        return ParserUtils.#getPreferredFieldValue(fields, 'Text', true)
    }

    /**
     * Returns a stable field string.
     * @param {Record<string, string | string[]> | undefined} fields
     * @param {string} key
     * @returns {string}
     */
    static getField(fields, key) {
        return ParserUtils.#getPreferredFieldValue(fields, key, false)
    }

    /**
     * Parses one numeric field including mil values and scientific notation.
     * @param {Record<string, string | string[]> | undefined} fields
     * @param {string} key
     * @returns {number | null}
     */
    static parseNumericField(fields, key) {
        const raw = ParserUtils.getField(fields, key)
        if (!raw) return null
        const match = raw.match(/-?\d+(?:\.\d+)?(?:E[+-]?\d+)?/i)
        if (!match) return null
        const parsed = Number(match[0])
        return Number.isFinite(parsed) ? parsed : null
    }

    /**
     * Parses one numeric field and its optional Altium fractional companion.
     * @param {Record<string, string | string[]> | undefined} fields
     * @param {string} key
     * @returns {number | null}
     */
    static parseNumericFieldWithFraction(fields, key) {
        const whole = ParserUtils.parseNumericField(fields, key)
        if (whole === null) return null

        const fraction = ParserUtils.parseNumericField(fields, key + '_Frac')
        if (fraction === null) return whole

        const raw = ParserUtils.getField(fields, key).trim()
        const sign = raw.startsWith('-') ? -1 : 1

        return whole + (fraction / 100000) * sign
    }

    /**
     * Parses an Altium-style boolean flag.
     * @param {string | string[] | undefined} raw
     * @returns {boolean}
     */
    static parseBoolean(raw) {
        const value = Array.isArray(raw)
            ? String(raw[raw.length - 1] || '')
            : String(raw || '')
        return /^(T|TRUE)$/i.test(value.trim())
    }

    /**
     * Converts a numeric color to a CSS hex value.
     * @param {string | string[] | undefined} raw
     * @param {string} fallback
     * @returns {string}
     */
    static toColor(raw, fallback) {
        const value = Array.isArray(raw) ? raw[raw.length - 1] : raw
        const parsed = Number.parseInt(String(value || ''), 10)
        if (!Number.isInteger(parsed)) return fallback
        const color = Math.abs(parsed) & 0xffffff
        const red = color & 0xff
        const green = (color >> 8) & 0xff
        const blue = (color >> 16) & 0xff

        return (
            '#' +
            [red, green, blue]
                .map((channel) => channel.toString(16).padStart(2, '0'))
                .join('')
        )
    }

    /**
     * Counts matching keys in a record.
     * @param {Record<string, string | string[]>} fields
     * @param {RegExp} pattern
     * @returns {number}
     */
    static countMatchingKeys(fields, pattern) {
        return Object.keys(fields).filter((key) => pattern.test(key)).length
    }

    /**
     * Picks a field value, preferring recovered UTF-8 runs when present.
     * @param {Record<string, string | string[]> | undefined} fields
     * @param {string} key
     * @param {boolean} skipAsterisk
     * @returns {string}
     */
    static #getPreferredFieldValue(fields, key, skipAsterisk) {
        if (!fields || typeof fields !== 'object') return ''

        const utf8Key = 'UTF8:' + key
        const rawUtf8 = fields[utf8Key]
        const raw = fields[key]

        if (!Array.isArray(rawUtf8) && !Array.isArray(raw)) {
            const utf8Value = ParserUtils.#pickFieldValue(rawUtf8, skipAsterisk)
            return utf8Value || ParserUtils.#pickFieldValue(raw, skipAsterisk)
        }

        const cacheKey = key + ':' + (skipAsterisk ? 'text' : 'field')
        const cached = ParserUtils.#cachedFieldValue(
            fields,
            cacheKey,
            raw,
            rawUtf8
        )
        if (cached !== null) return cached

        const utf8Value = ParserUtils.#pickFieldValue(rawUtf8, skipAsterisk)
        const value =
            utf8Value || ParserUtils.#pickFieldValue(raw, skipAsterisk)

        ParserUtils.#cacheFieldValue(fields, cacheKey, raw, rawUtf8, value)
        return value
    }

    /**
     * Returns a cached normalized value when the raw field references match.
     * @param {object} fields Field object.
     * @param {string} cacheKey Cache key.
     * @param {unknown} raw Raw field payload.
     * @param {unknown} rawUtf8 Raw UTF-8 field payload.
     * @returns {string | null}
     */
    static #cachedFieldValue(fields, cacheKey, raw, rawUtf8) {
        const fieldCache = ParserUtils.#fieldValueCache.get(fields)
        const cached = fieldCache?.get(cacheKey)
        if (!cached || cached.raw !== raw || cached.rawUtf8 !== rawUtf8) {
            return null
        }

        return cached.value
    }

    /**
     * Stores one normalized field value.
     * @param {object} fields Field object.
     * @param {string} cacheKey Cache key.
     * @param {unknown} raw Raw field payload.
     * @param {unknown} rawUtf8 Raw UTF-8 field payload.
     * @param {string} value Normalized value.
     * @returns {void}
     */
    static #cacheFieldValue(fields, cacheKey, raw, rawUtf8, value) {
        let fieldCache = ParserUtils.#fieldValueCache.get(fields)
        if (!fieldCache) {
            fieldCache = new Map()
            ParserUtils.#fieldValueCache.set(fields, fieldCache)
        }

        fieldCache.set(cacheKey, { raw, rawUtf8, value })
    }

    /**
     * Returns the last meaningful value from one field payload.
     * @param {string | string[] | undefined} raw
     * @param {boolean} skipAsterisk
     * @returns {string}
     */
    static #pickFieldValue(raw, skipAsterisk) {
        if (!Array.isArray(raw)) {
            const value = ParserUtils.#normalizeFieldValue(raw)
            return value && (!skipAsterisk || value !== '*') ? value : ''
        }

        for (let index = raw.length - 1; index >= 0; index -= 1) {
            const value = ParserUtils.#normalizeFieldValue(raw[index])
            if (value && (!skipAsterisk || value !== '*')) {
                return value
            }
        }

        return ''
    }

    /**
     * Normalizes one field payload value.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #normalizeFieldValue(value) {
        return String(value || '').trim()
    }
}
