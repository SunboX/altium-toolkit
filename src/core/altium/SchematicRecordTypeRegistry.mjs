// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Provides stable schematic record type descriptors for parser consumers.
 */
export class SchematicRecordTypeRegistry {
    static #RECORD_TYPES = new Map([
        [0, ['file-header', 'metadata', true]],
        [1, ['component', 'component', true]],
        [2, ['pin', 'component', true]],
        [3, ['ieee-symbol', 'symbol', true]],
        [4, ['label', 'annotation', true]],
        [5, ['bezier', 'graphic', true]],
        [6, ['polyline', 'graphic', true]],
        [7, ['polygon', 'graphic', true]],
        [8, ['ellipse', 'graphic', true]],
        [9, ['pie-chart', 'graphic', true]],
        [10, ['rounded-rectangle', 'graphic', true]],
        [11, ['elliptical-arc', 'graphic', true]],
        [12, ['arc', 'graphic', true]],
        [13, ['line', 'graphic', true]],
        [14, ['rectangle', 'graphic', true]],
        [15, ['sheet-symbol', 'sheet', true]],
        [16, ['sheet-entry', 'sheet', true]],
        [17, ['power-port', 'connectivity', true]],
        [18, ['port', 'connectivity', true]],
        [22, ['no-erc', 'directive', true]],
        [25, ['net-label', 'connectivity', true]],
        [26, ['bus', 'connectivity', true]],
        [27, ['wire', 'connectivity', true]],
        [28, ['text-frame', 'annotation', true]],
        [29, ['junction', 'connectivity', true]],
        [30, ['image', 'graphic', true]],
        [31, ['sheet', 'sheet', true]],
        [32, ['sheet-name', 'sheet', true]],
        [33, ['file-name', 'sheet', true]],
        [34, ['designator', 'component', true]],
        [37, ['bus-entry', 'connectivity', true]],
        [39, ['template', 'metadata', true]],
        [41, ['parameter', 'component', true]],
        [43, ['parameter-set', 'directive', true]],
        [44, ['implementation-list', 'implementation', true]],
        [45, ['implementation', 'implementation', true]],
        [46, ['map-definer-list', 'implementation', true]],
        [47, ['map-definer', 'implementation', true]],
        [48, ['implementation-parameters', 'implementation', true]],
        [209, ['note', 'annotation', true]],
        [210, ['probe-marker', 'code-symbol', true]],
        [211, ['compile-mask', 'directive', true]],
        [215, ['harness-connector', 'harness', true]],
        [216, ['harness-entry', 'harness', true]],
        [217, ['harness-type', 'harness', true]],
        [218, ['signal-harness', 'harness', true]],
        [220, ['code-symbol', 'code-symbol', true]],
        [221, ['code-symbol-entry', 'code-symbol', true]],
        [222, ['code-symbol-title', 'code-symbol', true]],
        [223, ['code-symbol-source', 'code-symbol', true]],
        [225, ['blanket', 'directive', true]],
        [226, ['hyperlink', 'annotation', true]]
    ])

    /**
     * Lists every known schematic record descriptor.
     * @returns {{ recordType: number, name: string, family: string, supported: boolean }[]}
     */
    static list() {
        return [...SchematicRecordTypeRegistry.#RECORD_TYPES.keys()]
            .sort((left, right) => left - right)
            .map((recordType) => SchematicRecordTypeRegistry.get(recordType))
    }

    /**
     * Returns the descriptor for one record type.
     * @param {number | string} recordType
     * @returns {{ recordType: number, name: string, family: string, supported: boolean }}
     */
    static get(recordType) {
        const normalizedRecordType =
            SchematicRecordTypeRegistry.#normalizeRecordType(recordType)
        const descriptor =
            SchematicRecordTypeRegistry.#RECORD_TYPES.get(normalizedRecordType)

        if (!descriptor) {
            return {
                recordType: normalizedRecordType,
                name: 'unknown-' + normalizedRecordType,
                family: 'unknown',
                supported: false
            }
        }

        return {
            recordType: normalizedRecordType,
            name: descriptor[0],
            family: descriptor[1],
            supported: descriptor[2]
        }
    }

    /**
     * Summarizes record counts by known type descriptor.
     * @param {{ fields?: Record<string, string | string[]> }[]} records
     * @returns {{ recordType: number, name: string, family: string, supported: boolean, count: number }[]}
     */
    static summarize(records) {
        const counts = new Map()

        for (const record of records || []) {
            const recordType = SchematicRecordTypeRegistry.#normalizeRecordType(
                record?.fields?.RECORD
            )
            if (recordType < 0) {
                continue
            }

            counts.set(recordType, (counts.get(recordType) || 0) + 1)
        }

        return [...counts.entries()]
            .sort(([left], [right]) => left - right)
            .map(([recordType, count]) => ({
                ...SchematicRecordTypeRegistry.get(recordType),
                count
            }))
    }

    /**
     * Normalizes one record type field value.
     * @param {number | string | undefined | string[]} recordType
     * @returns {number}
     */
    static #normalizeRecordType(recordType) {
        const rawValue = Array.isArray(recordType) ? recordType[0] : recordType
        const normalizedRecordType = Number(rawValue)

        return Number.isInteger(normalizedRecordType)
            ? normalizedRecordType
            : -1
    }
}
