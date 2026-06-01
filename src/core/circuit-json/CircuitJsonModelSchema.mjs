// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Defines the Circuit JSON contract emitted by public parser roots.
 */
export class CircuitJsonModelSchema {
    static CURRENT_SCHEMA_ID = 'https://github.com/tscircuit/circuit-json'

    static CURRENT_SCHEMA_VERSION = '0.0.431'

    static FORMAT_NAME = 'circuit-json'

    /**
     * Marks a Circuit JSON array with non-serialized schema metadata.
     * @template {object[]} T
     * @param {T} circuitJson
     * @returns {T}
     */
    static attach(circuitJson) {
        CircuitJsonModelSchema.assertModel(circuitJson)
        Object.defineProperties(circuitJson, {
            circuitJsonSchema: {
                configurable: true,
                enumerable: false,
                value: CircuitJsonModelSchema.CURRENT_SCHEMA_ID,
                writable: true
            },
            circuitJsonVersion: {
                configurable: true,
                enumerable: false,
                value: CircuitJsonModelSchema.CURRENT_SCHEMA_VERSION,
                writable: true
            },
            circuitJsonFormat: {
                configurable: true,
                enumerable: false,
                value: CircuitJsonModelSchema.FORMAT_NAME,
                writable: true
            }
        })

        return circuitJson
    }

    /**
     * Returns true when the value is a Circuit JSON element.
     * @param {unknown} value
     * @returns {boolean}
     */
    static isElement(value) {
        return (
            !!value &&
            typeof value === 'object' &&
            typeof value.type === 'string' &&
            value.type.length > 0
        )
    }

    /**
     * Returns true when the value is a Circuit JSON model array.
     * @param {unknown} value
     * @returns {boolean}
     */
    static isModel(value) {
        return (
            Array.isArray(value) &&
            value.every((element) => CircuitJsonModelSchema.isElement(element))
        )
    }

    /**
     * Throws when a value is not a Circuit JSON model array.
     * @param {unknown} value
     * @returns {void}
     */
    static assertModel(value) {
        if (!CircuitJsonModelSchema.isModel(value)) {
            throw new TypeError('Expected a Circuit JSON element array.')
        }
    }
}
