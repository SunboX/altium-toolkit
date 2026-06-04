// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves PCB text special strings against project parameters.
 */
export class PcbSpecialStringResolver {
    /**
     * Resolves one authored PCB text expression.
     * @param {string} text
     * @param {Record<string, string | number | boolean>} [parameters]
     * @returns {{ rawText: string, resolvedText: string, parameterNames: string[], expressionParts: object[] } | null}
     */
    static resolveText(text, parameters = {}) {
        const rawText = String(text ?? '')
        const expressionParts =
            PcbSpecialStringResolver.#parseExpressionParts(rawText)

        if (!expressionParts.length) {
            return null
        }

        const normalizedParameters =
            PcbSpecialStringResolver.#normalizeParameters(parameters)
        const resolvedParts = []
        const parameterNames = []

        for (const part of expressionParts) {
            if (part.type !== 'parameter') {
                resolvedParts.push(part)
                continue
            }

            const parameter = normalizedParameters.get(part.name.toLowerCase())

            if (!parameter) {
                resolvedParts.push({
                    ...part,
                    value: '.' + part.name,
                    unresolved: true
                })
                continue
            }

            parameterNames.push(parameter.name)
            resolvedParts.push({
                type: 'parameter',
                name: parameter.name,
                value: String(parameter.value)
            })
        }

        if (
            !parameterNames.length &&
            !resolvedParts.some((part) => part.type === 'parameter')
        ) {
            return null
        }

        return {
            rawText,
            resolvedText: resolvedParts.map((part) => part.value).join(''),
            parameterNames,
            expressionParts: resolvedParts
        }
    }

    /**
     * Adds special-string metadata to text primitives.
     * @param {object[]} texts
     * @param {Record<string, string | number | boolean>} [parameters]
     * @param {{ replaceText?: boolean }} [options]
     * @returns {object[]}
     */
    static annotateTexts(texts, parameters = {}, options = {}) {
        return (texts || []).map((text) => {
            const resolved = PcbSpecialStringResolver.resolveText(
                text?.text,
                parameters
            )

            if (!resolved) {
                return text
            }

            return {
                ...text,
                ...(options.replaceText === true
                    ? { text: resolved.resolvedText }
                    : {}),
                rawText: resolved.rawText,
                resolvedText: resolved.resolvedText,
                specialString: {
                    parameterNames: resolved.parameterNames,
                    expressionParts: resolved.expressionParts
                }
            }
        })
    }

    /**
     * Splits a supported special-string expression into literal and parameter
     * parts.
     * @param {string} text
     * @returns {{ type: string, name?: string, value?: string }[]}
     */
    static #parseExpressionParts(text) {
        const segments = PcbSpecialStringResolver.#splitConcatenation(text)
        const parts = []

        for (const segment of segments) {
            const trimmed = segment.trim()
            if (!trimmed) {
                continue
            }

            if (PcbSpecialStringResolver.#isQuoted(trimmed)) {
                parts.push({
                    type: 'literal',
                    value: PcbSpecialStringResolver.#unquote(trimmed)
                })
                continue
            }

            const parameterMatch = trimmed.match(/^\.([A-Za-z_][\w.-]*)$/u)
            if (parameterMatch) {
                parts.push({
                    type: 'parameter',
                    name: parameterMatch[1]
                })
                continue
            }

            if (trimmed.startsWith('.')) {
                parts.push({
                    type: 'literal',
                    value: trimmed
                })
            }
        }

        return parts
    }

    /**
     * Splits an expression on plus operators outside quoted strings.
     * @param {string} text
     * @returns {string[]}
     */
    static #splitConcatenation(text) {
        const segments = []
        let quote = ''
        let current = ''

        for (const character of String(text || '')) {
            if ((character === '"' || character === "'") && !quote) {
                quote = character
                current += character
                continue
            }

            if (character === quote) {
                quote = ''
                current += character
                continue
            }

            if (character === '+' && !quote) {
                segments.push(current)
                current = ''
                continue
            }

            current += character
        }

        segments.push(current)
        return segments
    }

    /**
     * Returns true when one segment is a quoted literal.
     * @param {string} value
     * @returns {boolean}
     */
    static #isQuoted(value) {
        return (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        )
    }

    /**
     * Removes simple surrounding quotes from one literal.
     * @param {string} value
     * @returns {string}
     */
    static #unquote(value) {
        return value.slice(1, -1).replace(/\\(["'\\])/gu, '$1')
    }

    /**
     * Builds a case-insensitive project parameter map.
     * @param {Record<string, string | number | boolean>} parameters
     * @returns {Map<string, { name: string, value: string | number | boolean }>}
     */
    static #normalizeParameters(parameters) {
        const normalized = new Map()

        for (const [name, value] of Object.entries(parameters || {})) {
            normalized.set(String(name).toLowerCase(), {
                name,
                value
            })
        }

        return normalized
    }
}
