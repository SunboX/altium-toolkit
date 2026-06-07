// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField } = ParserUtils

const KIND_BY_VALUE = {
    0: {
        name: 'standard',
        displayName: 'Standard',
        includeInBom: true,
        includeInNetlist: true,
        includeInPnp: true
    },
    1: {
        name: 'mechanical',
        displayName: 'Mechanical',
        includeInBom: true,
        includeInNetlist: true,
        includeInPnp: true
    },
    2: {
        name: 'graphical',
        displayName: 'Graphical',
        includeInBom: false,
        includeInNetlist: false,
        includeInPnp: false
    },
    3: {
        name: 'net-tie-bom',
        displayName: 'Net Tie BOM',
        includeInBom: true,
        includeInNetlist: true,
        includeInPnp: true
    },
    4: {
        name: 'net-tie-no-bom',
        displayName: 'Net Tie No BOM',
        includeInBom: false,
        includeInNetlist: true,
        includeInPnp: true
    },
    5: {
        name: 'standard-no-bom',
        displayName: 'Standard No BOM',
        includeInBom: false,
        includeInNetlist: true,
        includeInPnp: true
    },
    6: {
        name: 'jumper',
        displayName: 'Jumper',
        includeInBom: true,
        includeInNetlist: true,
        includeInPnp: true
    }
}

/**
 * Normalizes native PCB component kind fields and participation policy.
 */
export class PcbComponentKindPolicy {
    /**
     * Parses native versioned component-kind fields.
     * @param {Record<string, string | string[]>} fields Native component row.
     * @returns {{ value: number, name: string, displayName: string, includeInBom: boolean, includeInNetlist: boolean, includeInPnp: boolean } | undefined}
     */
    static parse(fields) {
        if (!PcbComponentKindPolicy.#hasKindField(fields)) return undefined

        const value = PcbComponentKindPolicy.#kindValue(fields)
        const policy = KIND_BY_VALUE[value] || {
            name: 'unknown',
            displayName: 'Unknown',
            includeInBom: true,
            includeInNetlist: true,
            includeInPnp: true
        }

        return {
            value,
            ...policy
        }
    }

    /**
     * Returns true when a component row carries any native kind field.
     * @param {Record<string, string | string[]>} fields Native component row.
     * @returns {boolean}
     */
    static #hasKindField(fields) {
        return [
            'COMPONENTKIND',
            'ComponentKind',
            'COMPONENTKINDVERSION2',
            'ComponentKindVersion2',
            'COMPONENTKINDVERSION3',
            'ComponentKindVersion3'
        ].some((key) => Object.hasOwn(fields || {}, key))
    }

    /**
     * Resolves the effective native component kind from versioned fields.
     * @param {Record<string, string | string[]>} fields Native component row.
     * @returns {number}
     */
    static #kindValue(fields) {
        const v1 = PcbComponentKindPolicy.#numericField(fields, [
            'COMPONENTKIND',
            'ComponentKind'
        ])
        const v2 = PcbComponentKindPolicy.#numericField(fields, [
            'COMPONENTKINDVERSION2',
            'ComponentKindVersion2'
        ])
        const v3 = PcbComponentKindPolicy.#numericField(fields, [
            'COMPONENTKINDVERSION3',
            'ComponentKindVersion3'
        ])

        if (v3 === 6) return v3
        if (v2 !== null && v2 >= 5) return v2
        return v1 ?? 0
    }

    /**
     * Returns the first finite numeric value from possible field names.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {string[]} keys Candidate keys.
     * @returns {number | null}
     */
    static #numericField(fields, keys) {
        for (const key of keys) {
            const value = parseNumericField(fields, key)
            if (Number.isFinite(value)) return value

            const raw = getField(fields, key)
            const parsed = Number.parseInt(String(raw ?? '').trim(), 10)
            if (Number.isFinite(parsed)) return parsed
        }

        return null
    }
}
