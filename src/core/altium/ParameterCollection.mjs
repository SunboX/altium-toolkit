// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Represents one parsed parameter value with typed read helpers.
 */
export class ParameterValue {
    #entry

    /**
     * Creates a typed parameter value wrapper.
     * @param {{ key?: string, rawKey?: string, value?: string, isUtf8?: boolean } | null} entry Parsed entry.
     */
    constructor(entry = null) {
        this.#entry = entry ? { ...entry } : null
    }

    /**
     * Returns true when this value is backed by a parsed entry.
     * @returns {boolean}
     */
    get exists() {
        return this.#entry !== null
    }

    /**
     * Returns the normalized parameter key.
     * @returns {string}
     */
    get key() {
        return this.#entry?.key || ''
    }

    /**
     * Returns the original source key.
     * @returns {string}
     */
    get rawKey() {
        return this.#entry?.rawKey || ''
    }

    /**
     * Returns the raw source value.
     * @returns {string}
     */
    get value() {
        return this.#entry?.value || ''
    }

    /**
     * Returns true when the source key carried a UTF-8 marker.
     * @returns {boolean}
     */
    get isUtf8() {
        return Boolean(this.#entry?.isUtf8)
    }

    /**
     * Reads the value as a string.
     * @param {string} [defaultValue] Value returned when missing.
     * @returns {string}
     */
    asString(defaultValue = '') {
        return this.exists ? this.value : defaultValue
    }

    /**
     * Reads the value as an integer.
     * @param {number} [defaultValue] Value returned when missing or malformed.
     * @returns {number}
     */
    asInt(defaultValue = 0) {
        const parsed = ParameterValue.#numericMatch(this.value)
        if (!this.exists || parsed === null) return defaultValue

        const integer = Number.parseInt(parsed, 10)
        return Number.isFinite(integer) ? integer : defaultValue
    }

    /**
     * Reads the value as a finite number.
     * @param {number} [defaultValue] Value returned when missing or malformed.
     * @returns {number}
     */
    asNumber(defaultValue = 0) {
        const parsed = ParameterValue.#numericMatch(this.value)
        if (!this.exists || parsed === null) return defaultValue

        const number = Number(parsed)
        return Number.isFinite(number) ? number : defaultValue
    }

    /**
     * Reads the value as an Altium-style boolean.
     * @param {boolean} [defaultValue] Value returned when missing or malformed.
     * @returns {boolean}
     */
    asBool(defaultValue = false) {
        if (!this.exists) return defaultValue

        const normalized = this.value.trim().toLowerCase()
        if (['t', 'true', '1', 'y', 'yes'].includes(normalized)) return true
        if (['f', 'false', '0', 'n', 'no'].includes(normalized)) return false
        return defaultValue
    }

    /**
     * Reads the value as an integer code.
     * @param {number | null} [defaultValue] Value returned when missing or malformed.
     * @returns {number | null}
     */
    asCode(defaultValue = null) {
        return this.asInt(defaultValue)
    }

    /**
     * Reads the value as a numeric coordinate with an optional unit suffix.
     * @param {object | null} [defaultValue] Value returned when missing or malformed.
     * @returns {{ value: number, unit?: string } | object | null}
     */
    asCoordinate(defaultValue = null) {
        if (!this.exists) return ParameterValue.#cloneDefault(defaultValue)

        const match = this.value
            .trim()
            .match(/^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(.*)$/iu)
        if (!match) return ParameterValue.#cloneDefault(defaultValue)

        const value = Number(match[1])
        if (!Number.isFinite(value)) {
            return ParameterValue.#cloneDefault(defaultValue)
        }

        const unit = match[2].trim()
        return unit ? { value, unit } : { value }
    }

    /**
     * Converts the value to a JSON-friendly entry.
     * @returns {object | null}
     */
    toJSON() {
        return this.#entry ? { ...this.#entry } : null
    }

    /**
     * Returns the first numeric token in a source value.
     * @param {string} value Source value.
     * @returns {string | null}
     */
    static #numericMatch(value) {
        const match = String(value || '').match(
            /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/iu
        )
        return match ? match[0] : null
    }

    /**
     * Clones object defaults to avoid exposing shared mutable state.
     * @param {unknown} value Default value.
     * @returns {unknown}
     */
    static #cloneDefault(value) {
        if (!value || typeof value !== 'object') return value
        return Array.isArray(value) ? [...value] : { ...value }
    }
}

/**
 * Provides duplicate-preserving, case-insensitive access to parameter records.
 */
export class ParameterCollection {
    #entries
    #entriesByKey

    /**
     * Creates a collection from parsed entries.
     * @param {{ key?: string, rawKey?: string, value?: string, isUtf8?: boolean }[]} [entries] Parsed entries.
     */
    constructor(entries = []) {
        this.#entries = entries
            .map((entry, index) =>
                ParameterCollection.#normalizeEntry(entry, index)
            )
            .filter(Boolean)
        this.#entriesByKey = ParameterCollection.#buildIndex(this.#entries)
    }

    /**
     * Parses a raw pipe-delimited string or parsed field object.
     * @param {string | Record<string, string | string[]> | { fields?: Record<string, string | string[]> }} input Source value.
     * @returns {ParameterCollection}
     */
    static parse(input) {
        if (typeof input === 'string') {
            return new ParameterCollection(
                ParameterCollection.#entriesFromRaw(input)
            )
        }

        if (input && typeof input === 'object' && 'fields' in input) {
            return ParameterCollection.fromFields(input.fields)
        }

        return ParameterCollection.fromFields(input)
    }

    /**
     * Builds a collection from an already parsed field object.
     * @param {Record<string, string | string[]> | undefined} fields Field object.
     * @returns {ParameterCollection}
     */
    static fromFields(fields) {
        return new ParameterCollection(
            ParameterCollection.#entriesFromFields(fields)
        )
    }

    /**
     * Returns the number of parsed entries including duplicates.
     * @returns {number}
     */
    get count() {
        return this.#entries.length
    }

    /**
     * Returns parsed entries in source order.
     * @returns {object[]}
     */
    get entries() {
        return this.#entries.map((entry) => ({ ...entry }))
    }

    /**
     * Returns true when a key is present.
     * @param {string} key Parameter key.
     * @returns {boolean}
     */
    has(key) {
        return this.#entriesByKey.has(ParameterCollection.#lookupKey(key))
    }

    /**
     * Returns the first value for a key.
     * @param {string} key Parameter key.
     * @returns {ParameterValue}
     */
    get(key) {
        return new ParameterValue(
            this.#entriesByKey.get(ParameterCollection.#lookupKey(key))?.[0] ||
                null
        )
    }

    /**
     * Returns the last value for a key.
     * @param {string} key Parameter key.
     * @returns {ParameterValue}
     */
    last(key) {
        const entries = this.#entriesByKey.get(
            ParameterCollection.#lookupKey(key)
        )
        return new ParameterValue(entries?.[entries.length - 1] || null)
    }

    /**
     * Returns every value for a key in source order.
     * @param {string} key Parameter key.
     * @returns {ParameterValue[]}
     */
    getAll(key) {
        return (
            this.#entriesByKey.get(ParameterCollection.#lookupKey(key)) || []
        ).map((entry) => new ParameterValue(entry))
    }

    /**
     * Converts the collection into a JSON-friendly object.
     * @param {{ duplicates?: 'first' | 'last' | 'array' }} [options] Conversion options.
     * @returns {Record<string, string | string[]>}
     */
    toObject(options = {}) {
        const duplicates = options.duplicates || 'last'
        const output = {}

        for (const entry of this.#entries) {
            if (duplicates === 'array') {
                output[entry.key] = [
                    ...(Array.isArray(output[entry.key])
                        ? output[entry.key]
                        : output[entry.key] === undefined
                          ? []
                          : [output[entry.key]]),
                    entry.value
                ]
                continue
            }

            if (duplicates === 'first' && output[entry.key] !== undefined) {
                continue
            }

            output[entry.key] = entry.value
        }

        return output
    }

    /**
     * Iterates parsed entries in source order.
     * @returns {IterableIterator<object>}
     */
    *[Symbol.iterator]() {
        for (const entry of this.entries) {
            yield entry
        }
    }

    /**
     * Parses entries from a raw pipe-delimited record string.
     * @param {string} raw Raw record string.
     * @returns {object[]}
     */
    static #entriesFromRaw(raw) {
        return String(raw || '')
            .replace(/[\r\n]/gu, '')
            .split('|')
            .map((segment) => segment.trim())
            .filter(Boolean)
            .map((segment) => ParameterCollection.#entryFromSegment(segment))
            .filter(Boolean)
    }

    /**
     * Parses one raw segment into an entry.
     * @param {string} segment Segment text.
     * @returns {object | null}
     */
    static #entryFromSegment(segment) {
        const separatorIndex = segment.indexOf('=')
        if (separatorIndex <= 0) return null

        const rawKey = segment.slice(0, separatorIndex).trim()
        const isUtf8 = rawKey.startsWith('%UTF8%')
        const key = rawKey.replace(/^%UTF8%/u, '')
        if (!key) return null

        return {
            key,
            rawKey,
            value: segment.slice(separatorIndex + 1).trim(),
            isUtf8
        }
    }

    /**
     * Converts parsed fields into ordered collection entries.
     * @param {Record<string, string | string[]> | undefined} fields Parsed fields.
     * @returns {object[]}
     */
    static #entriesFromFields(fields) {
        if (!fields || typeof fields !== 'object') return []

        const entries = []
        for (const key of Object.keys(fields)) {
            if (key.startsWith('UTF8:')) continue

            const utf8Key = 'UTF8:' + key
            const rawValues = fields[utf8Key] || fields[key]
            const values = Array.isArray(rawValues) ? rawValues : [rawValues]
            for (const value of values) {
                entries.push({
                    key,
                    rawKey: fields[utf8Key] ? '%UTF8%' + key : key,
                    value: String(value ?? ''),
                    isUtf8: Boolean(fields[utf8Key])
                })
            }
        }

        return entries
    }

    /**
     * Normalizes one entry for internal storage.
     * @param {object} entry Entry candidate.
     * @param {number} index Source index.
     * @returns {object | null}
     */
    static #normalizeEntry(entry, index) {
        const key = String(entry?.key || '').trim()
        if (!key) return null

        return {
            key,
            rawKey: String(entry.rawKey || key),
            value: String(entry.value ?? ''),
            isUtf8: Boolean(entry.isUtf8),
            index
        }
    }

    /**
     * Builds a case-insensitive entry lookup.
     * @param {object[]} entries Parsed entries.
     * @returns {Map<string, object[]>}
     */
    static #buildIndex(entries) {
        const index = new Map()

        for (const entry of entries) {
            const lookupKey = ParameterCollection.#lookupKey(entry.key)
            if (!index.has(lookupKey)) index.set(lookupKey, [])
            index.get(lookupKey).push(entry)
        }

        return index
    }

    /**
     * Normalizes a lookup key.
     * @param {string} key Parameter key.
     * @returns {string}
     */
    static #lookupKey(key) {
        return String(key || '').toLowerCase()
    }
}
