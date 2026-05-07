// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils

const COMMON_RULE_FIELDS = new Set([
    'SELECTION',
    'LAYER',
    'LOCKED',
    'POLYGONOUTLINE',
    'USERROUTED',
    'KEEPOUT',
    'UNIONINDEX',
    'RULEKIND',
    'NETSCOPE',
    'LAYERKIND',
    'SCOPE1EXPRESSION',
    'SCOPE2EXPRESSION',
    'NAME',
    'ENABLED',
    'PRIORITY',
    'COMMENT',
    'UNIQUEID',
    'DEFINEDBYLOGICALDOCUMENT'
])

const RULE_TYPES = new Map([
    ['WIDTH', { kind: 'width', category: 'routing', displayName: 'Width' }],
    [
        'CLEARANCE',
        {
            kind: 'clearance',
            category: 'electrical',
            displayName: 'Clearance'
        }
    ],
    [
        'ROUTINGVIAS',
        {
            kind: 'routing-vias',
            category: 'routing',
            displayName: 'Routing Vias'
        }
    ],
    [
        'ROUTINGLAYERS',
        {
            kind: 'routing-layers',
            category: 'routing',
            displayName: 'Routing Layers'
        }
    ],
    [
        'DIFFERENTIALPAIRROUTING',
        {
            kind: 'differential-pair-routing',
            category: 'routing',
            displayName: 'Differential Pair Routing'
        }
    ],
    [
        'SHORTCIRCUIT',
        {
            kind: 'short-circuit',
            category: 'electrical',
            displayName: 'Short Circuit'
        }
    ],
    [
        'UNROUTEDNET',
        {
            kind: 'unrouted-net',
            category: 'electrical',
            displayName: 'Unrouted Net'
        }
    ],
    [
        'SILKSCREENOVERCOMPONENTPADS',
        {
            kind: 'silkscreen-over-component-pads',
            category: 'manufacturing',
            displayName: 'Silkscreen Over Component Pads'
        }
    ]
])

/**
 * Normalizes native Altium PCB design-rule records from Rules6/Data.
 */
export class PcbRuleParser {
    /**
     * Parses normalized PCB design rules in native stream order.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @returns {Array<Record<string, unknown> & { ruleIndex: number, name: string, ruleKind: string, constraints: Record<string, string>, constraintValues: Record<string, Record<string, unknown>>, typedConstraints: Record<string, Record<string, unknown>> }>}
     */
    static parse(records) {
        return records
            .filter((record) => record.sourceStream === 'Rules6/Data')
            .map((record, index) =>
                PcbRuleParser.#normalizeRuleRecord(record.fields, index)
            )
            .filter((rule) => rule.name || rule.ruleKind || rule.uniqueId)
    }

    /**
     * Normalizes one native design-rule record.
     * @param {Record<string, string | string[]>} fields
     * @param {number} ruleIndex
     * @returns {{ ruleIndex: number, name: string, ruleKind: string, enabled: boolean | null, priority: number | null, uniqueId: string, comment: string, selection: boolean | null, layer: string, locked: boolean | null, polygonOutline: boolean | null, userRouted: boolean | null, keepout: boolean | null, unionIndex: number | null, netScope: string, layerKind: string, scope1Expression: string, scope2Expression: string, scope1: { rawExpression: string, predicate: string, arguments: string[], isAll: boolean }, scope2: { rawExpression: string, predicate: string, arguments: string[], isAll: boolean }, ruleType: { rawKind: string, kind: string, category: string, displayName: string }, constraints: Record<string, string>, constraintValues: Record<string, Record<string, unknown>>, typedConstraints: Record<string, Record<string, unknown>> }}
     */
    static #normalizeRuleRecord(fields, ruleIndex) {
        const scope1Expression = getField(fields, 'SCOPE1EXPRESSION')
        const scope2Expression = getField(fields, 'SCOPE2EXPRESSION')
        const ruleKind = getField(fields, 'RULEKIND')
        const constraints = PcbRuleParser.#parseConstraints(fields)
        const constraintValues =
            PcbRuleParser.#parseConstraintValues(constraints)
        const ruleType = PcbRuleParser.#parseRuleType(ruleKind)

        return {
            ruleIndex,
            name: getField(fields, 'NAME'),
            ruleKind,
            enabled: PcbRuleParser.#parseOptionalBoolean(fields, 'ENABLED'),
            priority: parseNumericField(fields, 'PRIORITY'),
            uniqueId: getField(fields, 'UNIQUEID') || getField(fields, 'UID'),
            comment: getField(fields, 'COMMENT'),
            selection: PcbRuleParser.#parseOptionalBoolean(fields, 'SELECTION'),
            layer: getField(fields, 'LAYER'),
            locked: PcbRuleParser.#parseOptionalBoolean(fields, 'LOCKED'),
            polygonOutline: PcbRuleParser.#parseOptionalBoolean(
                fields,
                'POLYGONOUTLINE'
            ),
            userRouted: PcbRuleParser.#parseOptionalBoolean(
                fields,
                'USERROUTED'
            ),
            keepout: PcbRuleParser.#parseOptionalBoolean(fields, 'KEEPOUT'),
            unionIndex: parseNumericField(fields, 'UNIONINDEX'),
            netScope: getField(fields, 'NETSCOPE'),
            layerKind: getField(fields, 'LAYERKIND'),
            scope1Expression,
            scope2Expression,
            scope1: PcbRuleParser.parseScopeExpression(scope1Expression),
            scope2: PcbRuleParser.parseScopeExpression(scope2Expression),
            ruleType,
            constraints,
            constraintValues,
            typedConstraints: PcbRuleParser.#parseTypedConstraints(
                ruleType,
                constraintValues
            )
        }
    }

    /**
     * Parses one Altium rule scope predicate expression.
     * @param {string} expression
     * @returns {{ rawExpression: string, predicate: string, arguments: string[], isAll: boolean }}
     */
    static parseScopeExpression(expression) {
        const rawExpression = String(expression || '').trim()

        if (!rawExpression) {
            return {
                rawExpression: '',
                predicate: '',
                arguments: [],
                isAll: false
            }
        }

        if (rawExpression.toUpperCase() === 'ALL') {
            return {
                rawExpression,
                predicate: 'All',
                arguments: [],
                isAll: true
            }
        }

        const match = rawExpression.match(/^\s*([A-Za-z0-9_]+)\((.*)\)\s*$/u)
        if (!match) {
            return {
                rawExpression,
                predicate: rawExpression,
                arguments: [],
                isAll: false
            }
        }

        return {
            rawExpression,
            predicate: match[1],
            arguments: PcbRuleParser.#parseScopeArguments(match[2]),
            isAll: false
        }
    }

    /**
     * Parses one comma-separated Altium scope argument list.
     * @param {string} text
     * @returns {string[]}
     */
    static #parseScopeArguments(text) {
        const args = []
        let token = ''
        let inQuote = false

        for (let index = 0; index < text.length; index += 1) {
            const character = text[index]

            if (character === "'") {
                if (inQuote && text[index + 1] === "'") {
                    token += "'"
                    index += 1
                    continue
                }
                inQuote = !inQuote
                continue
            }

            if (character === ',' && !inQuote) {
                PcbRuleParser.#pushScopeArgument(args, token)
                token = ''
                continue
            }

            token += character
        }

        PcbRuleParser.#pushScopeArgument(args, token)
        return args
    }

    /**
     * Adds one trimmed scope argument when it is not empty.
     * @param {string[]} args
     * @param {string} token
     */
    static #pushScopeArgument(args, token) {
        const value = token.trim()

        if (value) {
            args.push(value)
        }
    }

    /**
     * Keeps rule-specific fields as raw string constraints.
     * @param {Record<string, string | string[]>} fields
     * @returns {Record<string, string>}
     */
    static #parseConstraints(fields) {
        const constraints = {}

        for (const key of Object.keys(fields || {})) {
            const normalizedKey = key.toUpperCase()
            const value = getField(fields, key)

            if (!COMMON_RULE_FIELDS.has(normalizedKey) && value) {
                constraints[normalizedKey] = value
            }
        }

        return constraints
    }

    /**
     * Parses all raw constraints into typed values while preserving their keys.
     * @param {Record<string, string>} constraints
     * @returns {Record<string, Record<string, unknown>>}
     */
    static #parseConstraintValues(constraints) {
        return Object.fromEntries(
            Object.entries(constraints).map(([key, raw]) => [
                key,
                PcbRuleParser.#parseConstraintValue(raw)
            ])
        )
    }

    /**
     * Parses one rule-specific constraint value.
     * @param {string} raw
     * @returns {Record<string, unknown>}
     */
    static #parseConstraintValue(raw) {
        const text = String(raw || '').trim()
        const numeric = PcbRuleParser.#parseNumericUnit(text)

        if (numeric) {
            return numeric
        }
        if (/^(TRUE|FALSE|T|F)$/iu.test(text)) {
            return {
                raw: text,
                type: 'boolean',
                value: parseBoolean(text)
            }
        }

        return {
            raw: text,
            type: 'string',
            value: text
        }
    }

    /**
     * Parses a numeric value with a common Altium unit suffix.
     * @param {string} text
     * @returns {Record<string, unknown> | null}
     */
    static #parseNumericUnit(text) {
        const match = text.match(
            /^\s*(-?\d+(?:\.\d+)?(?:E[+-]?\d+)?)\s*([A-Za-z%]*)\s*$/iu
        )

        if (!match) {
            return null
        }

        const value = Number(match[1])
        if (!Number.isFinite(value)) {
            return null
        }

        const unit = PcbRuleParser.#normalizeUnit(match[2])
        if (PcbRuleParser.#isLengthUnit(unit)) {
            return {
                raw: text,
                type: 'length',
                value,
                unit,
                valueMil: PcbRuleParser.#roundUnit(
                    PcbRuleParser.#toMil(value, unit)
                ),
                valueMm: PcbRuleParser.#roundUnit(
                    PcbRuleParser.#toMm(value, unit)
                )
            }
        }
        if (unit === 'deg') {
            return {
                raw: text,
                type: 'angle',
                value,
                unit,
                valueDeg: value
            }
        }
        if (unit === '%') {
            return {
                raw: text,
                type: 'percent',
                value,
                unit,
                ratio: PcbRuleParser.#roundUnit(value / 100)
            }
        }

        return {
            raw: text,
            type: 'number',
            value,
            unit: unit || null
        }
    }

    /**
     * Normalizes a parsed unit suffix.
     * @param {string} rawUnit
     * @returns {string}
     */
    static #normalizeUnit(rawUnit) {
        const unit = String(rawUnit || '')
            .trim()
            .toLowerCase()

        if (unit === 'mils') {
            return 'mil'
        }
        if (unit === 'millimeter' || unit === 'millimeters') {
            return 'mm'
        }
        if (unit === 'inch' || unit === 'inches') {
            return 'in'
        }
        if (unit === 'degree' || unit === 'degrees') {
            return 'deg'
        }

        return unit
    }

    /**
     * Returns whether a normalized unit represents a length.
     * @param {string} unit
     * @returns {boolean}
     */
    static #isLengthUnit(unit) {
        return unit === 'mil' || unit === 'mm' || unit === 'in' || unit === 'um'
    }

    /**
     * Converts one normalized length to mils.
     * @param {number} value
     * @param {string} unit
     * @returns {number}
     */
    static #toMil(value, unit) {
        if (unit === 'mm') {
            return value / 0.0254
        }
        if (unit === 'in') {
            return value * 1000
        }
        if (unit === 'um') {
            return value / 25.4
        }

        return value
    }

    /**
     * Converts one normalized length to millimeters.
     * @param {number} value
     * @param {string} unit
     * @returns {number}
     */
    static #toMm(value, unit) {
        if (unit === 'mil') {
            return value * 0.0254
        }
        if (unit === 'in') {
            return value * 25.4
        }
        if (unit === 'um') {
            return value / 1000
        }

        return value
    }

    /**
     * Rounds converted values to avoid floating-point noise in model output.
     * @param {number} value
     * @returns {number}
     */
    static #roundUnit(value) {
        return Number(value.toFixed(6))
    }

    /**
     * Parses one native rule kind into a stable typed descriptor.
     * @param {string} ruleKind
     * @returns {{ rawKind: string, kind: string, category: string, displayName: string }}
     */
    static #parseRuleType(ruleKind) {
        const rawKind = String(ruleKind || '').trim()
        const key = rawKind.replace(/[^A-Za-z0-9]/gu, '').toUpperCase()
        const mapped = RULE_TYPES.get(key)

        if (mapped) {
            return {
                rawKind,
                ...mapped
            }
        }

        return {
            rawKind,
            kind: PcbRuleParser.#toKebabCase(rawKind),
            category: 'custom',
            displayName: PcbRuleParser.#displayRuleKind(rawKind)
        }
    }

    /**
     * Builds semantic typed constraint aliases for known rule kinds.
     * @param {{ kind: string }} ruleType
     * @param {Record<string, Record<string, unknown>>} constraintValues
     * @returns {Record<string, Record<string, unknown>>}
     */
    static #parseTypedConstraints(ruleType, constraintValues) {
        if (ruleType.kind === 'width') {
            return PcbRuleParser.#parseWidthConstraints(constraintValues)
        }
        if (ruleType.kind === 'clearance') {
            return PcbRuleParser.#parseClearanceConstraints(constraintValues)
        }

        return {}
    }

    /**
     * Builds semantic aliases for width-rule constraints.
     * @param {Record<string, Record<string, unknown>>} constraintValues
     * @returns {Record<string, Record<string, unknown>>}
     */
    static #parseWidthConstraints(constraintValues) {
        return PcbRuleParser.#pickTypedConstraints(constraintValues, {
            minWidth: ['MINLIMIT', 'MINWIDTH'],
            preferredWidth: ['PREFEREDWIDTH', 'PREFERREDWIDTH'],
            maxWidth: ['MAXLIMIT', 'MAXWIDTH']
        })
    }

    /**
     * Builds semantic aliases for clearance-rule constraints.
     * @param {Record<string, Record<string, unknown>>} constraintValues
     * @returns {Record<string, Record<string, unknown>>}
     */
    static #parseClearanceConstraints(constraintValues) {
        return PcbRuleParser.#pickTypedConstraints(constraintValues, {
            minClearance: ['GAP', 'MINDISTANCE', 'CLEARANCE'],
            genericClearance: ['GENERICCLEARANCE']
        })
    }

    /**
     * Picks the first available typed constraint value for each semantic alias.
     * @param {Record<string, Record<string, unknown>>} constraintValues
     * @param {Record<string, string[]>} aliases
     * @returns {Record<string, Record<string, unknown>>}
     */
    static #pickTypedConstraints(constraintValues, aliases) {
        const typed = {}

        for (const [alias, keys] of Object.entries(aliases)) {
            const key = keys.find((candidate) => constraintValues[candidate])

            if (key) {
                typed[alias] = {
                    key,
                    ...constraintValues[key]
                }
            }
        }

        return typed
    }

    /**
     * Converts a raw rule kind to a lower-kebab fallback id.
     * @param {string} rawKind
     * @returns {string}
     */
    static #toKebabCase(rawKind) {
        return String(rawKind || 'unknown')
            .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
            .replace(/[^A-Za-z0-9]+/gu, '-')
            .replace(/^-|-$/gu, '')
            .toLowerCase()
    }

    /**
     * Builds a readable fallback display name from a raw rule kind.
     * @param {string} rawKind
     * @returns {string}
     */
    static #displayRuleKind(rawKind) {
        const spaced = String(rawKind || 'Unknown')
            .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
            .replace(/[_-]+/gu, ' ')
            .trim()

        return spaced || 'Unknown'
    }

    /**
     * Parses an optional Altium boolean field.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {boolean | null}
     */
    static #parseOptionalBoolean(fields, key) {
        const raw = getField(fields, key)

        return raw ? parseBoolean(raw) : null
    }
}
