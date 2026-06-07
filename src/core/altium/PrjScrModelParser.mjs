// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { ParserUtils } from './ParserUtils.mjs'

/**
 * Parses Altium script-project files into a read-only project-script digest.
 */
export class PrjScrModelParser {
    /**
     * Parses one script-project ArrayBuffer.
     * @param {string} fileName Source file name.
     * @param {ArrayBuffer} arrayBuffer Source bytes.
     * @param {{ existingPaths?: string[] }} options Parser options.
     * @returns {object}
     */
    static parse(fileName, arrayBuffer, options = {}) {
        return PrjScrModelParser.parseText(
            fileName,
            PrjScrModelParser.#decodeText(arrayBuffer),
            options
        )
    }

    /**
     * Parses one script-project text payload.
     * @param {string} fileName Source file name.
     * @param {string} text Source text.
     * @param {{ existingPaths?: string[] }} options Parser options.
     * @returns {object}
     */
    static parseText(fileName, text, options = {}) {
        const sections = PrjScrModelParser.#parseIniSections(text)
        const design = PrjScrModelParser.#sectionFields(
            PrjScrModelParser.#findSection(sections, 'Design')
        )
        const existingPaths = new Set(
            (options.existingPaths || []).map((path) =>
                PrjScrModelParser.#normalizePath(path)
            )
        )
        const documents = PrjScrModelParser.#extractDocuments(
            sections,
            existingPaths,
            options
        )
        const scripts = documents
            .filter((document) => document.kind === 'script')
            .map((document) => PrjScrModelParser.#publicScript(document))
        const diagnostics = PrjScrModelParser.#diagnostics(documents)

        return NormalizedModelSchema.attach({
            kind: 'project-script',
            fileType: 'PrjScr',
            fileName,
            summary: {
                title: ParserUtils.stripExtension(fileName),
                documentCount: documents.length,
                scriptCount: scripts.length,
                missingPathCount: scripts.filter(
                    (script) => script.exists === false
                ).length,
                diagnosticCount: diagnostics.length
            },
            diagnostics,
            projectScript: {
                name: ParserUtils.stripExtension(fileName),
                design,
                documents,
                scripts,
                sections: PrjScrModelParser.#serializeSections(sections)
            },
            bom: []
        })
    }

    /**
     * Decodes text with common project-file encodings.
     * @param {ArrayBuffer} arrayBuffer Source bytes.
     * @returns {string}
     */
    static #decodeText(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer || new ArrayBuffer(0))
        for (const encoding of ['utf-8', 'windows-1252']) {
            try {
                return new TextDecoder(encoding, { fatal: true })
                    .decode(bytes)
                    .replace(/^\uFEFF/u, '')
            } catch {
                // Try the next legacy-compatible project encoding.
            }
        }

        return new TextDecoder('windows-1252')
            .decode(bytes)
            .replace(/^\uFEFF/u, '')
    }

    /**
     * Parses INI sections while preserving option order.
     * @param {string} text Source text.
     * @returns {{ name: string, index: number, entries: object[] }[]}
     */
    static #parseIniSections(text) {
        const sections = []
        let current = null
        const lines = String(text || '')
            .replace(/\r\n?/gu, '\n')
            .split('\n')

        for (const [lineIndex, rawLine] of lines.entries()) {
            const trimmed = rawLine.trim()
            if (
                !trimmed ||
                trimmed.startsWith(';') ||
                trimmed.startsWith('#')
            ) {
                continue
            }

            const sectionMatch = /^\[([^\]]+)\]$/u.exec(trimmed)
            if (sectionMatch) {
                current = {
                    name: sectionMatch[1].trim(),
                    index: sections.length,
                    entries: []
                }
                sections.push(current)
                continue
            }

            if (!current) continue
            const separatorIndex = rawLine.indexOf('=')
            if (separatorIndex < 0) continue

            current.entries.push({
                key: rawLine.slice(0, separatorIndex).trim(),
                value: rawLine.slice(separatorIndex + 1).trim(),
                line: lineIndex + 1
            })
        }

        return sections
    }

    /**
     * Extracts numbered document entries.
     * @param {object[]} sections Parsed sections.
     * @param {Set<string>} existingPaths Normalized existing paths.
     * @param {{ existingPaths?: string[] }} options Parser options.
     * @returns {object[]}
     */
    static #extractDocuments(sections, existingPaths, options) {
        return PrjScrModelParser.#numberedSections(sections, 'Document').map(
            ({ section, number }) => {
                const fields = PrjScrModelParser.#sectionFields(section)
                const path = String(fields.DocumentPath || '')
                const normalizedPath = PrjScrModelParser.#normalizePath(path)
                const base = {
                    index: number,
                    section: section.name,
                    path,
                    normalizedPath,
                    fileName: PrjScrModelParser.#basename(path),
                    extension: PrjScrModelParser.#extension(path),
                    kind:
                        PrjScrModelParser.#extension(path).toLowerCase() ===
                        '.pas'
                            ? 'script'
                            : 'unsupported',
                    ...(options.existingPaths
                        ? { exists: existingPaths.has(normalizedPath) }
                        : {}),
                    annotationEnabled: PrjScrModelParser.#optionalBoolean(
                        fields.AnnotationEnabled
                    ),
                    classGeneration: PrjScrModelParser.#classGeneration(fields),
                    updatePolicies: PrjScrModelParser.#updatePolicies(fields),
                    options: fields
                }

                return PrjScrModelParser.#stripEmpty(base)
            }
        )
    }

    /**
     * Builds class-generation option metadata.
     * @param {Record<string, string>} fields Document fields.
     * @returns {object | undefined}
     */
    static #classGeneration(fields) {
        return PrjScrModelParser.#stripEmpty({
            classGenCcAutoEnabled: PrjScrModelParser.#optionalBoolean(
                fields.ClassGenCCAutoEnabled
            ),
            classGenCcAutoRoomEnabled: PrjScrModelParser.#optionalBoolean(
                fields.ClassGenCCAutoRoomEnabled
            ),
            classGenNcAutoScope: fields.ClassGenNCAutoScope
        })
    }

    /**
     * Builds update-policy metadata.
     * @param {Record<string, string>} fields Document fields.
     * @returns {object | undefined}
     */
    static #updatePolicies(fields) {
        return PrjScrModelParser.#stripEmpty({
            doLibraryUpdate: PrjScrModelParser.#optionalBoolean(
                fields.DoLibraryUpdate
            ),
            doDatabaseUpdate: PrjScrModelParser.#optionalBoolean(
                fields.DoDatabaseUpdate
            )
        })
    }

    /**
     * Builds structured parser diagnostics.
     * @param {object[]} documents Parsed documents.
     * @returns {object[]}
     */
    static #diagnostics(documents) {
        return [
            ...documents
                .filter(
                    (document) =>
                        document.kind === 'script' && document.exists === false
                )
                .map((document) => ({
                    code: 'project-script.missing-document-path',
                    severity: 'warning',
                    message: 'Script project document path was not found.',
                    path: document.path,
                    normalizedPath: document.normalizedPath
                })),
            ...documents
                .filter((document) => document.kind === 'unsupported')
                .map((document) => ({
                    code: 'project-script.unsupported-document-kind',
                    severity: 'warning',
                    message:
                        'Script project document is not a supported script file.',
                    path: document.path,
                    normalizedPath: document.normalizedPath
                }))
        ]
    }

    /**
     * Builds the public script convenience row.
     * @param {object} document Parsed document row.
     * @returns {object}
     */
    static #publicScript(document) {
        const { kind: _kind, ...script } = document
        return script
    }

    /**
     * Finds numbered sections with a common prefix.
     * @param {object[]} sections Parsed sections.
     * @param {string} prefix Section prefix.
     * @returns {{ section: object, number: number }[]}
     */
    static #numberedSections(sections, prefix) {
        const pattern = new RegExp('^' + prefix + '(\\d+)$', 'iu')

        return (sections || [])
            .map((section) => ({
                section,
                match: pattern.exec(section.name)
            }))
            .filter(({ match }) => match)
            .map(({ section, match }) => ({
                section,
                number: Number.parseInt(match[1], 10)
            }))
            .sort((left, right) => left.number - right.number)
    }

    /**
     * Finds one section by case-insensitive name.
     * @param {object[]} sections Parsed sections.
     * @param {string} name Section name.
     * @returns {object | undefined}
     */
    static #findSection(sections, name) {
        const normalized = String(name || '').toLowerCase()
        return (sections || []).find(
            (section) => section.name.toLowerCase() === normalized
        )
    }

    /**
     * Converts one section to a key-value map.
     * @param {{ entries?: { key: string, value: string }[] } | undefined} section Parsed section.
     * @returns {Record<string, string>}
     */
    static #sectionFields(section) {
        return Object.fromEntries(
            (section?.entries || []).map((entry) => [entry.key, entry.value])
        )
    }

    /**
     * Serializes preserved sections.
     * @param {object[]} sections Parsed sections.
     * @returns {object[]}
     */
    static #serializeSections(sections) {
        return (sections || []).map((section) => ({
            name: section.name,
            entries: (section.entries || []).map((entry) => ({
                key: entry.key,
                value: entry.value
            }))
        }))
    }

    /**
     * Parses optional boolean option values.
     * @param {string | undefined} value Raw value.
     * @returns {boolean | undefined}
     */
    static #optionalBoolean(value) {
        const normalized = String(value ?? '')
            .trim()
            .toLowerCase()
        if (!normalized) return undefined
        return ['1', 'true', 't', 'yes'].includes(normalized)
    }

    /**
     * Normalizes project-relative paths.
     * @param {string} path Source path.
     * @returns {string}
     */
    static #normalizePath(path) {
        return String(path || '').replace(/\\/gu, '/')
    }

    /**
     * Returns a basename from a project path.
     * @param {string} path Source path.
     * @returns {string}
     */
    static #basename(path) {
        return PrjScrModelParser.#normalizePath(path).split('/').pop() || ''
    }

    /**
     * Returns a lower-level extension token.
     * @param {string} path Source path.
     * @returns {string}
     */
    static #extension(path) {
        const name = PrjScrModelParser.#basename(path)
        const dotIndex = name.lastIndexOf('.')
        return dotIndex >= 0 ? name.slice(dotIndex) : ''
    }

    /**
     * Removes undefined and empty object fields.
     * @param {Record<string, unknown>} value Source object.
     * @returns {object}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (
                    entryValue &&
                    typeof entryValue === 'object' &&
                    !Array.isArray(entryValue)
                ) {
                    return Object.keys(entryValue).length > 0
                }
                return entryValue !== undefined && entryValue !== ''
            })
        )
    }
}
