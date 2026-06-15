// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds read-only inventories for pipe/backtick parameter record strings.
 */
export class ParameterRecordInventoryBuilder {
    static SCHEMA = 'altium-toolkit.parameter-record-inventory.a1'

    /**
     * Builds a parameter record inventory report.
     * @param {{ records?: (object | string)[] } | (object | string)[]} [input]
     * @returns {object}
     */
    static build(input = {}) {
        const sourceRecords = Array.isArray(input) ? input : input.records || []
        const records = sourceRecords.map((record, index) =>
            ParameterRecordInventoryBuilder.scanRecord(
                ParameterRecordInventoryBuilder.#raw(record),
                {
                    sourceStream:
                        typeof record === 'object' ? record.sourceStream : '',
                    recordIndex:
                        typeof record === 'object'
                            ? (record.recordIndex ?? index)
                            : index
                }
            )
        )

        return {
            schema: ParameterRecordInventoryBuilder.SCHEMA,
            summary: ParameterRecordInventoryBuilder.#summary(records),
            records
        }
    }

    /**
     * Scans one raw record string.
     * @param {string} raw Raw parameter record text.
     * @param {{ sourceStream?: string, recordIndex?: number }} [metadata]
     * @returns {object}
     */
    static scanRecord(raw, metadata = {}) {
        const fields = []
        const keyCounts = new Map()
        let emptyEntryCount = 0

        for (const segment of ParameterRecordInventoryBuilder.#segments(raw)) {
            const text = segment.text.trim()
            if (!text) {
                emptyEntryCount += 1
                continue
            }

            const separatorIndex = text.indexOf('=')
            if (separatorIndex <= 0) {
                continue
            }

            const rawKey = text.slice(0, separatorIndex).trim()
            const isUtf8 = rawKey.startsWith('%UTF8%')
            const key = rawKey.replace(/^%UTF8%/u, '')
            if (!key) continue

            const value = text.slice(separatorIndex + 1).trim()
            const occurrence = (keyCounts.get(key) || 0) + 1
            keyCounts.set(key, occurrence)
            fields.push({
                rawKey,
                key,
                value,
                delimiter: segment.delimiter,
                level: segment.level,
                occurrence,
                isUtf8,
                typedValue: ParameterRecordInventoryBuilder.#typedValue(value)
            })
        }

        const duplicateFields =
            ParameterRecordInventoryBuilder.#duplicateFields(fields)

        return ParameterRecordInventoryBuilder.#stripUndefined({
            sourceStream: metadata.sourceStream || undefined,
            recordIndex: metadata.recordIndex,
            fieldCount: fields.length,
            emptyEntryCount,
            duplicateFields,
            fields
        })
    }

    /**
     * Extracts raw record text from supported inputs.
     * @param {object | string} record Source record.
     * @returns {string}
     */
    static #raw(record) {
        if (typeof record === 'string') return record
        return String(record?.raw || record?.text || '')
    }

    /**
     * Splits a parameter string into delimiter-aware segments.
     * @param {string} raw Raw parameter text.
     * @returns {{ delimiter: string, level: number, text: string }[]}
     */
    static #segments(raw) {
        const value = String(raw || '')
        const segments = []
        let delimiter = ''
        let text = ''

        for (const character of value) {
            if (character === '|' || character === '`') {
                if (delimiter || text) {
                    segments.push({
                        delimiter,
                        level: delimiter === '`' ? 1 : 0,
                        text
                    })
                }
                delimiter = character
                text = ''
                continue
            }

            text += character
        }

        if (delimiter || text) {
            segments.push({
                delimiter,
                level: delimiter === '`' ? 1 : 0,
                text
            })
        }

        return segments
    }

    /**
     * Infers a typed value for common parameter scalar encodings.
     * @param {string} value Field value.
     * @returns {{ kind: 'boolean' | 'integer' | 'number', value: boolean | number } | null}
     */
    static #typedValue(value) {
        const text = String(value || '').trim()
        if (/^(T|TRUE)$/iu.test(text)) {
            return { kind: 'boolean', value: true }
        }
        if (/^(F|FALSE)$/iu.test(text)) {
            return { kind: 'boolean', value: false }
        }
        if (/^[+-]?\d+$/u.test(text)) {
            return { kind: 'integer', value: Number(text) }
        }
        if (/^[+-]?(?:\d+\.\d*|\.\d+|\d+E[+-]?\d+)$/iu.test(text)) {
            const parsed = Number(text)
            return Number.isFinite(parsed)
                ? { kind: 'number', value: parsed }
                : null
        }

        return null
    }

    /**
     * Builds duplicate field rows.
     * @param {object[]} fields Scanned fields.
     * @returns {object[]}
     */
    static #duplicateFields(fields) {
        const byKey = new Map()

        for (const field of fields) {
            byKey.set(field.key, [...(byKey.get(field.key) || []), field])
        }

        return [...byKey.entries()]
            .filter(([, rows]) => rows.length > 1)
            .map(([key, rows]) => ({
                key,
                count: rows.length,
                firstValue: rows[0].value,
                lastValue: rows.at(-1).value
            }))
            .sort((left, right) => left.key.localeCompare(right.key))
    }

    /**
     * Summarizes scanned records.
     * @param {object[]} records Scanned records.
     * @returns {object}
     */
    static #summary(records) {
        const duplicateFieldCount = records.reduce(
            (total, record) => total + record.duplicateFields.length,
            0
        )

        return {
            recordCount: records.length,
            fieldCount: ParameterRecordInventoryBuilder.#sum(
                records,
                'fieldCount'
            ),
            duplicateFieldCount,
            duplicateOccurrenceCount: records.reduce(
                (total, record) =>
                    total +
                    record.duplicateFields.reduce(
                        (count, field) => count + field.count - 1,
                        0
                    ),
                0
            ),
            utf8FieldCount: ParameterRecordInventoryBuilder.#fieldCount(
                records,
                (field) => field.isUtf8
            ),
            nestedFieldCount: ParameterRecordInventoryBuilder.#fieldCount(
                records,
                (field) => field.level > 0
            ),
            emptyEntryCount: ParameterRecordInventoryBuilder.#sum(
                records,
                'emptyEntryCount'
            ),
            typedFieldCount: ParameterRecordInventoryBuilder.#fieldCount(
                records,
                (field) => field.typedValue
            )
        }
    }

    /**
     * Sums one numeric record field.
     * @param {object[]} records Scanned records.
     * @param {string} key Numeric key.
     * @returns {number}
     */
    static #sum(records, key) {
        return records.reduce((total, record) => total + Number(record[key]), 0)
    }

    /**
     * Counts fields matching a predicate.
     * @param {object[]} records Scanned records.
     * @param {(field: object) => boolean} predicate Match predicate.
     * @returns {number}
     */
    static #fieldCount(records, predicate) {
        return records.reduce(
            (total, record) =>
                total +
                record.fields.filter((field) => predicate(field)).length,
            0
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
