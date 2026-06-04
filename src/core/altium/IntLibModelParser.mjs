// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'

/**
 * Normalizes integrated-library extraction into the public parser model.
 */
export class IntLibModelParser {
    /**
     * Builds one integrated-library model.
     * @param {string} fileName
     * @param {{ version?: string, crossReferences?: object[], parameters?: Record<string, string>, parameterRecords?: object[], sources?: object[], streamNames?: string[], diagnostics?: Record<string, number> } | null} extraction
     * @returns {{ schema: string, kind: 'integrated-library', fileType: 'IntLib', fileName: string, summary: Record<string, number | string>, diagnostics: { severity: 'info' | 'warning', message: string }[], integratedLibrary: object, bom: [] }}
     */
    static parse(fileName, extraction = null) {
        const normalizedExtraction = extraction || {}
        const sources = Array.isArray(normalizedExtraction.sources)
            ? normalizedExtraction.sources
            : []
        const crossReferences = Array.isArray(
            normalizedExtraction.crossReferences
        )
            ? normalizedExtraction.crossReferences
            : []
        const parameters = normalizedExtraction.parameters || {}
        const streamNames = Array.isArray(normalizedExtraction.streamNames)
            ? normalizedExtraction.streamNames
            : []

        return NormalizedModelSchema.attach({
            kind: 'integrated-library',
            fileType: 'IntLib',
            fileName,
            summary: {
                title: IntLibModelParser.#stripExtension(fileName),
                version: normalizedExtraction.version || '',
                sourceCount: sources.length,
                crossReferenceCount: crossReferences.length,
                parameterCount: Object.keys(parameters).length
            },
            diagnostics: IntLibModelParser.#buildDiagnostics(
                streamNames,
                sources,
                crossReferences,
                parameters,
                normalizedExtraction.diagnostics?.issues || []
            ),
            integratedLibrary: {
                version: normalizedExtraction.version || '',
                streamNames,
                crossReferences,
                parameters,
                parameterRecords: normalizedExtraction.parameterRecords || [],
                diagnostics: {
                    ...(normalizedExtraction.diagnostics || {}),
                    issues: normalizedExtraction.diagnostics?.issues || []
                },
                indexes: IntLibModelParser.#buildIndexes(
                    sources,
                    crossReferences
                ),
                sources
            },
            bom: []
        })
    }

    /**
     * Builds source and model lookup indexes for bundled library consumers.
     * @param {object[]} sources Bundled source entries.
     * @param {object[]} crossReferences Cross-reference rows.
     * @returns {object}
     */
    static #buildIndexes(sources, crossReferences) {
        return {
            sourcesByFileName:
                IntLibModelParser.#buildSourcesByFileName(sources),
            sourcesByKind: IntLibModelParser.#buildSourcesByKind(sources),
            modelsByComponent:
                IntLibModelParser.#buildModelsByComponent(crossReferences),
            symbolsByComponent: IntLibModelParser.#buildModelNamesByKind(
                crossReferences,
                'SCH'
            ),
            footprintsByComponent: IntLibModelParser.#buildModelNamesByKind(
                crossReferences,
                'PCB'
            )
        }
    }

    /**
     * Indexes source entries by file name.
     * @param {object[]} sources Source entries.
     * @returns {Record<string, object>}
     */
    static #buildSourcesByFileName(sources) {
        const index = {}
        for (const [sourceIndex, source] of [...sources]
            .map((source, index) => ({ ...source, sourceIndex: index }))
            .sort((left, right) =>
                String(left.fileName || '').localeCompare(
                    String(right.fileName || '')
                )
            )
            .entries()) {
            index[source.fileName] = {
                index: source.sourceIndex ?? sourceIndex,
                path: source.path,
                fileType: source.fileType,
                libraryKind: source.libraryKind
            }
        }
        return index
    }

    /**
     * Indexes source file names by source kind.
     * @param {object[]} sources Source entries.
     * @returns {Record<string, string[]>}
     */
    static #buildSourcesByKind(sources) {
        const index = {}
        for (const source of [...sources].sort((left, right) =>
            String(left.libraryKind || '').localeCompare(
                String(right.libraryKind || '')
            )
        )) {
            const kind = source.libraryKind || 'other'
            index[kind] ||= []
            index[kind].push(source.fileName)
        }
        return index
    }

    /**
     * Indexes cross-reference model rows by component name.
     * @param {object[]} crossReferences Cross-reference rows.
     * @returns {Record<string, object[]>}
     */
    static #buildModelsByComponent(crossReferences) {
        const index = {}
        for (const row of crossReferences || []) {
            if (!row.component || !row.model) continue
            index[row.component] ||= []
            index[row.component].push({
                model: row.model,
                kind: row.kind || ''
            })
        }
        return index
    }

    /**
     * Indexes cross-reference model names of one kind by component.
     * @param {object[]} crossReferences Cross-reference rows.
     * @param {string} kind Model kind.
     * @returns {Record<string, string[]>}
     */
    static #buildModelNamesByKind(crossReferences, kind) {
        const index = {}
        const lookup = kind.toUpperCase()
        for (const row of crossReferences || []) {
            if (
                !row.component ||
                !row.model ||
                String(row.kind || '').toUpperCase() !== lookup
            ) {
                continue
            }
            index[row.component] ||= []
            index[row.component].push(row.model)
        }
        return index
    }

    /**
     * Builds parser diagnostics for one integrated-library model.
     * @param {string[]} streamNames
     * @param {object[]} sources
     * @param {object[]} crossReferences
     * @param {Record<string, string>} parameters
     * @param {object[]} issues Structured parser issues.
     * @returns {{ severity: 'info' | 'warning', message: string }[]}
     */
    static #buildDiagnostics(
        streamNames,
        sources,
        crossReferences,
        parameters,
        issues
    ) {
        return [
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    streamNames.length +
                    ' integrated-library data streams.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    sources.length +
                    ' bundled library source entries.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    crossReferences.length +
                    ' integrated-library cross references.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    Object.keys(parameters).length +
                    ' integrated-library parameters.'
            },
            ...(issues || []).map((issue) => ({
                severity: issue.severity || 'warning',
                code: issue.code,
                message: issue.message
            }))
        ]
    }

    /**
     * Returns a file name without its last extension.
     * @param {string} fileName
     * @returns {string}
     */
    static #stripExtension(fileName) {
        return String(fileName || '').replace(/\.[^.]+$/u, '')
    }
}
