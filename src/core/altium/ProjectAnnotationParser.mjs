// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'

/**
 * Parses annotation mapping files used to relate logical and compiled
 * designators.
 */
export class ProjectAnnotationParser {
    /**
     * Parses one annotation ArrayBuffer.
     * @param {string} fileName Annotation file name.
     * @param {ArrayBuffer} arrayBuffer Annotation bytes.
     * @returns {object}
     */
    static parse(fileName, arrayBuffer) {
        return ProjectAnnotationParser.parseText(
            fileName,
            new TextDecoder('windows-1252')
                .decode(arrayBuffer || new ArrayBuffer(0))
                .replace(/^\uFEFF/u, '')
        )
    }

    /**
     * Parses one annotation text payload.
     * @param {string} fileName Annotation file name.
     * @param {string} text Annotation text.
     * @returns {object}
     */
    static parseText(fileName, text) {
        const sections = ProjectAnnotationParser.#parseIniSections(text)
        const mappings = ProjectAnnotationParser.#extractMappings(
            fileName,
            sections
        )

        return NormalizedModelSchema.attach({
            kind: 'project-annotation',
            fileType: 'Annotation',
            fileName,
            summary: {
                title: fileName,
                mappingCount: mappings.length
            },
            diagnostics: [
                {
                    severity: 'info',
                    message:
                        'Recovered ' +
                        mappings.length +
                        ' annotation designator mappings.'
                }
            ],
            annotations: {
                mappings,
                bySourceDesignator: ProjectAnnotationParser.#indexBy(
                    mappings,
                    'sourceDesignator'
                ),
                byCompiledDesignator: ProjectAnnotationParser.#indexBy(
                    mappings,
                    'compiledDesignator'
                )
            },
            bom: []
        })
    }

    /**
     * Parses INI-like sections.
     * @param {string} text Text payload.
     * @returns {{ name: string, entries: { key: string, value: string }[] }[]}
     */
    static #parseIniSections(text) {
        const sections = []
        let current = null

        for (const rawLine of String(text || '')
            .replace(/\r\n?/gu, '\n')
            .split('\n')) {
            const trimmed = rawLine.trim()
            if (
                !trimmed ||
                trimmed.startsWith(';') ||
                trimmed.startsWith('#')
            ) {
                continue
            }

            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/u)
            if (sectionMatch) {
                current = {
                    name: sectionMatch[1].trim(),
                    entries: []
                }
                sections.push(current)
                continue
            }

            if (!current) continue
            const separatorIndex = rawLine.indexOf('=')
            if (separatorIndex === -1) continue
            current.entries.push({
                key: rawLine.slice(0, separatorIndex).trim(),
                value: rawLine.slice(separatorIndex + 1).trim()
            })
        }

        return sections
    }

    /**
     * Extracts designator mapping rows.
     * @param {string} fileName Annotation file name.
     * @param {{ name: string, entries: { key: string, value: string }[] }[]} sections Parsed sections.
     * @returns {object[]}
     */
    static #extractMappings(fileName, sections) {
        return (sections || [])
            .map((section, sectionIndex) => {
                const match = String(section.name || '').match(
                    /^Annotation(\d*)$/iu
                )
                if (!match) return null
                const fields = ProjectAnnotationParser.#sectionFields(section)
                const sourceDesignator =
                    ProjectAnnotationParser.#field(fields, [
                        'SourceDesignator',
                        'LogicalDesignator',
                        'OriginalDesignator'
                    ]) || ''
                const compiledDesignator =
                    ProjectAnnotationParser.#field(fields, [
                        'CompiledDesignator',
                        'PhysicalDesignator',
                        'NewDesignator'
                    ]) || ''
                if (!sourceDesignator || !compiledDesignator) return null

                return {
                    index: Number.parseInt(match[1] || '', 10) || sectionIndex,
                    sourceDesignator,
                    compiledDesignator,
                    uniqueId:
                        ProjectAnnotationParser.#field(fields, [
                            'UniqueId',
                            'UniqueID'
                        ]) || '',
                    sourceFileName: fileName,
                    options: fields
                }
            })
            .filter(Boolean)
            .sort((left, right) => left.index - right.index)
    }

    /**
     * Builds a field map from one section.
     * @param {{ entries: { key: string, value: string }[] }} section Section row.
     * @returns {Record<string, string>}
     */
    static #sectionFields(section) {
        const fields = {}
        for (const entry of section?.entries || []) {
            fields[entry.key] = entry.value
        }
        return fields
    }

    /**
     * Reads the first matching field.
     * @param {Record<string, string>} fields Field map.
     * @param {string[]} names Candidate names.
     * @returns {string}
     */
    static #field(fields, names) {
        for (const name of names) {
            const lower = name.toLowerCase()
            for (const [key, value] of Object.entries(fields || {})) {
                if (key.toLowerCase() === lower) {
                    return String(value || '').trim()
                }
            }
        }
        return ''
    }

    /**
     * Builds a compact index by field.
     * @param {object[]} rows Rows.
     * @param {string} key Key.
     * @returns {Record<string, object>}
     */
    static #indexBy(rows, key) {
        const index = {}
        for (const row of rows || []) {
            const value = String(row?.[key] || '').trim()
            if (value) index[value] = row
        }
        return index
    }
}
