/**
 * Shared parsing helpers for normalized Altium records.
 */
export class ParserUtils {
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
        if (!fields) return ''

        const utf8Key = 'UTF8:' + key
        const utf8Value = ParserUtils.#pickFieldValue(
            fields[utf8Key],
            skipAsterisk
        )
        if (utf8Value) return utf8Value

        return ParserUtils.#pickFieldValue(fields[key], skipAsterisk)
    }

    /**
     * Returns the last meaningful value from one field payload.
     * @param {string | string[] | undefined} raw
     * @param {boolean} skipAsterisk
     * @returns {string}
     */
    static #pickFieldValue(raw, skipAsterisk) {
        const values = Array.isArray(raw) ? raw : [raw]

        return (
            values
                .map((value) => String(value || '').trim())
                .findLast(
                    (value) => value && (!skipAsterisk || value !== '*')
                ) || ''
        )
    }
}
