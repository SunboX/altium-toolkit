// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Resolves schematic-visible project parameters and special strings.
 */
export class SchematicProjectParameterResolver {
    static #TITLE_BLOCK_FIELDS = [
        'title',
        'revision',
        'documentNumber',
        'sheetNumber',
        'sheetTotal',
        'date',
        'drawnBy'
    ]

    /**
     * Resolves one schematic text expression against project parameters.
     * @param {string} text Raw schematic text.
     * @param {Record<string, string | number | boolean | null | undefined>} parameters Project parameters.
     * @returns {{ rawText: string, resolvedText: string, parameterNames: string[], expressionParts: object[] } | null}
     */
    static resolveText(text, parameters = {}) {
        const rawText = String(text ?? '')
        const lookup =
            SchematicProjectParameterResolver.#buildParameterLookup(parameters)
        const expressionParts =
            SchematicProjectParameterResolver.#parseExpressionParts(
                rawText,
                lookup
            )

        if (
            !expressionParts.some((part) => part.kind === 'parameter') ||
            !expressionParts.length
        ) {
            return null
        }

        const parameterNames = [
            ...new Set(
                expressionParts
                    .filter((part) => part.kind === 'parameter')
                    .map((part) => part.name)
            )
        ]

        return {
            rawText,
            resolvedText: expressionParts
                .map((part) => String(part.value ?? ''))
                .join(''),
            parameterNames,
            expressionParts
        }
    }

    /**
     * Returns a schematic copy with project-parameter annotations.
     * @param {object} schematic Normalized schematic model.
     * @param {Record<string, string | number | boolean | null | undefined>} parameters Project parameters.
     * @param {{ replaceText?: boolean }} options Resolver options.
     * @returns {object}
     */
    static applyToSchematic(schematic, parameters = {}, options = {}) {
        const resolvedTexts = Array.isArray(schematic?.texts)
            ? schematic.texts.map((text) =>
                  SchematicProjectParameterResolver.#annotateText(
                      text,
                      parameters,
                      options
                  )
              )
            : []
        const sheet = schematic?.sheet
            ? {
                  ...schematic.sheet,
                  titleBlock:
                      SchematicProjectParameterResolver.#annotateTitleBlock(
                          schematic.sheet.titleBlock,
                          parameters,
                          options
                      )
              }
            : schematic?.sheet

        return {
            ...(schematic || {}),
            ...(sheet ? { sheet } : {}),
            texts: resolvedTexts
        }
    }

    /**
     * Returns a document-model copy with project-parameter annotations.
     * @param {object} documentModel Normalized document model.
     * @param {Record<string, string | number | boolean | null | undefined>} parameters Project parameters.
     * @param {{ replaceText?: boolean }} options Resolver options.
     * @returns {object}
     */
    static applyToDocumentModel(documentModel, parameters = {}, options = {}) {
        if (!documentModel?.schematic) {
            return documentModel
        }

        return {
            ...documentModel,
            schematic: SchematicProjectParameterResolver.applyToSchematic(
                documentModel.schematic,
                parameters,
                options
            )
        }
    }

    /**
     * Builds a case-insensitive project-parameter lookup.
     * @param {Record<string, string | number | boolean | null | undefined>} parameters Project parameters.
     * @returns {Map<string, { name: string, value: string }>}
     */
    static #buildParameterLookup(parameters) {
        return new Map(
            Object.entries(parameters || {}).map(([name, value]) => [
                name.trim().toLowerCase(),
                {
                    name,
                    value:
                        value === null || value === undefined
                            ? ''
                            : String(value)
                }
            ])
        )
    }

    /**
     * Parses one parameter expression into renderable parts.
     * @param {string} text Raw text.
     * @param {Map<string, { name: string, value: string }>} lookup Parameter lookup.
     * @returns {object[]}
     */
    static #parseExpressionParts(text, lookup) {
        const tokens =
            SchematicProjectParameterResolver.#splitConcatenation(text)

        if (tokens.length > 1) {
            return tokens.flatMap((token) =>
                SchematicProjectParameterResolver.#parseToken(token, lookup)
            )
        }

        return SchematicProjectParameterResolver.#parseInlineText(text, lookup)
    }

    /**
     * Parses one concatenation token.
     * @param {string} token Expression token.
     * @param {Map<string, { name: string, value: string }>} lookup Parameter lookup.
     * @returns {object[]}
     */
    static #parseToken(token, lookup) {
        const trimmed = token.trim()
        const quoted = trimmed.match(/^"((?:[^"\\]|\\.)*)"$/u)

        if (quoted) {
            return [
                {
                    kind: 'literal',
                    value: SchematicProjectParameterResolver.#unescapeQuoted(
                        quoted[1]
                    )
                }
            ]
        }

        const directParameter = trimmed.match(/^[.=]([A-Za-z_][\w.-]*)$/u)
        if (directParameter) {
            return [
                SchematicProjectParameterResolver.#parameterPart(
                    directParameter[1],
                    trimmed[0],
                    lookup
                )
            ]
        }

        return SchematicProjectParameterResolver.#parseInlineText(token, lookup)
    }

    /**
     * Parses inline text and parameter references.
     * @param {string} text Raw text.
     * @param {Map<string, { name: string, value: string }>} lookup Parameter lookup.
     * @returns {object[]}
     */
    static #parseInlineText(text, lookup) {
        const parts = []
        const pattern = /([.=])([A-Za-z_][\w.-]*)/gu
        let lastIndex = 0
        let match = pattern.exec(text)

        while (match) {
            if (match.index > lastIndex) {
                parts.push({
                    kind: 'literal',
                    value: text.slice(lastIndex, match.index)
                })
            }

            parts.push(
                SchematicProjectParameterResolver.#parameterPart(
                    match[2],
                    match[1],
                    lookup
                )
            )
            lastIndex = pattern.lastIndex
            match = pattern.exec(text)
        }

        if (lastIndex < text.length) {
            parts.push({ kind: 'literal', value: text.slice(lastIndex) })
        }

        return parts
    }

    /**
     * Builds one parameter expression part.
     * @param {string} name Parameter name.
     * @param {string} prefix Source prefix.
     * @param {Map<string, { name: string, value: string }>} lookup Parameter lookup.
     * @returns {object}
     */
    static #parameterPart(name, prefix, lookup) {
        const resolved = lookup.get(String(name || '').toLowerCase())

        return {
            kind: 'parameter',
            name: resolved?.name || name,
            value: resolved?.value ?? prefix + name
        }
    }

    /**
     * Annotates one schematic text object.
     * @param {object} text Text primitive.
     * @param {Record<string, string | number | boolean | null | undefined>} parameters Project parameters.
     * @param {{ replaceText?: boolean }} options Resolver options.
     * @returns {object}
     */
    static #annotateText(text, parameters, options) {
        const resolved = SchematicProjectParameterResolver.resolveText(
            text?.text,
            parameters
        )

        if (!resolved) {
            return { ...(text || {}) }
        }

        return {
            ...(text || {}),
            rawText: resolved.rawText,
            resolvedText: resolved.resolvedText,
            specialString: resolved,
            ...(options.replaceText ? { text: resolved.resolvedText } : {})
        }
    }

    /**
     * Annotates title-block fields with project-parameter resolution details.
     * @param {object | undefined} titleBlock Title-block object.
     * @param {Record<string, string | number | boolean | null | undefined>} parameters Project parameters.
     * @param {{ replaceText?: boolean }} options Resolver options.
     * @returns {object | undefined}
     */
    static #annotateTitleBlock(titleBlock, parameters, options) {
        if (!titleBlock) {
            return titleBlock
        }

        const annotated = { ...titleBlock }
        const specialStrings = { ...(titleBlock.specialStrings || {}) }

        for (const fieldName of SchematicProjectParameterResolver
            .#TITLE_BLOCK_FIELDS) {
            const resolved = SchematicProjectParameterResolver.resolveText(
                titleBlock[fieldName],
                parameters
            )
            if (!resolved) {
                continue
            }

            specialStrings[fieldName] = resolved
            if (options.replaceText) {
                annotated[fieldName] = resolved.resolvedText
            }
        }

        return Object.keys(specialStrings).length
            ? { ...annotated, specialStrings }
            : annotated
    }

    /**
     * Splits one string by top-level concatenation operators.
     * @param {string} text Raw expression.
     * @returns {string[]}
     */
    static #splitConcatenation(text) {
        const tokens = []
        let token = ''
        let inQuote = false
        let escaped = false

        for (const char of String(text || '')) {
            if (escaped) {
                token += char
                escaped = false
                continue
            }

            if (char === '\\') {
                token += char
                escaped = true
                continue
            }

            if (char === '"') {
                inQuote = !inQuote
                token += char
                continue
            }

            if (char === '+' && !inQuote) {
                tokens.push(token)
                token = ''
                continue
            }

            token += char
        }

        tokens.push(token)

        return tokens
    }

    /**
     * Unescapes the subset of quoted string escapes used by parameter fields.
     * @param {string} text Quoted string body.
     * @returns {string}
     */
    static #unescapeQuoted(text) {
        return String(text || '').replace(/\\(["\\])/gu, '$1')
    }
}
