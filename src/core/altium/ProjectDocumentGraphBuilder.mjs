// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds a read-only project document graph from parsed PrjPcb metadata.
 */
export class ProjectDocumentGraphBuilder {
    static SCHEMA = 'altium-toolkit.project.document-graph.a1'

    /**
     * Builds a normalized document graph index.
     * @param {object} projectModel Parsed project model or project payload.
     * @param {{ availablePaths?: string[] | Set<string> }} options Graph options.
     * @returns {object}
     */
    static build(projectModel = {}, options = {}) {
        const project = projectModel?.project || projectModel || {}
        const documents = ProjectDocumentGraphBuilder.#documentRows(
            project.documents || [],
            project.outputGroups || [],
            options
        )
        const groups = ProjectDocumentGraphBuilder.#groups(
            documents,
            project.outputGroups || []
        )
        const indexes = ProjectDocumentGraphBuilder.#indexes(
            documents,
            project.outputGroups || []
        )

        return {
            schema: ProjectDocumentGraphBuilder.SCHEMA,
            summary: {
                documentCount: documents.length,
                sourceSheetCount: groups.sourceSheets.length,
                pcbDocumentCount: groups.pcbs.length,
                linkedLibraryCount: groups.linkedLibraries.length,
                harnessFileCount: groups.harnessFiles.length,
                outJobReferenceCount: groups.outJobs.length,
                generatedOutputCount: groups.generatedOutputs.length,
                missingPathCount: groups.missingPaths.length
            },
            documents,
            groups,
            indexes
        }
    }

    /**
     * Builds detailed document graph rows.
     * @param {object[]} documents Project document rows.
     * @param {object[]} outputGroups Project output groups.
     * @param {{ availablePaths?: string[] | Set<string> }} options Graph options.
     * @returns {object[]}
     */
    static #documentRows(documents, outputGroups, options) {
        const availablePaths =
            options.availablePaths == null
                ? null
                : new Set(
                      [...options.availablePaths].map((path) =>
                          ProjectDocumentGraphBuilder.#normalizePath(path)
                      )
                  )
        const outputsByDocumentPath =
            ProjectDocumentGraphBuilder.#outputsByDocumentPath(outputGroups)

        return (documents || []).map((document, index) =>
            ProjectDocumentGraphBuilder.#stripUndefined({
                graphIndex: index,
                documentIndex: document.index,
                section: document.section,
                path: document.path || '',
                normalizedPath:
                    document.normalizedPath ||
                    ProjectDocumentGraphBuilder.#normalizePath(document.path),
                fileName:
                    document.fileName ||
                    ProjectDocumentGraphBuilder.#basename(document.path),
                extension: document.extension || '',
                kind: document.kind || 'other',
                uniqueId: document.uniqueId || '',
                isStub: document.isStub === true ? true : undefined,
                exists:
                    availablePaths === null
                        ? undefined
                        : availablePaths.has(
                              document.normalizedPath ||
                                  ProjectDocumentGraphBuilder.#normalizePath(
                                      document.path
                                  )
                          ),
                linkedOutputs:
                    outputsByDocumentPath[
                        document.normalizedPath ||
                            ProjectDocumentGraphBuilder.#normalizePath(
                                document.path
                            )
                    ] || []
            })
        )
    }

    /**
     * Groups document and generated-output paths by public role.
     * @param {object[]} documents Document graph rows.
     * @param {object[]} outputGroups Output groups.
     * @returns {object}
     */
    static #groups(documents, outputGroups) {
        const pathsForKind = (kind) =>
            documents
                .filter((document) => document.kind === kind)
                .map((document) => document.normalizedPath)
        const libraryKinds = new Set([
            'schematic-library',
            'pcb-library',
            'integrated-library'
        ])

        return {
            sourceSheets: pathsForKind('schematic'),
            pcbs: pathsForKind('pcb'),
            linkedLibraries: documents
                .filter((document) => libraryKinds.has(document.kind))
                .map((document) => document.normalizedPath),
            schematicLibraries: pathsForKind('schematic-library'),
            pcbLibraries: pathsForKind('pcb-library'),
            integratedLibraries: pathsForKind('integrated-library'),
            harnessFiles: pathsForKind('harness'),
            outJobs: pathsForKind('output-job'),
            generatedOutputs:
                ProjectDocumentGraphBuilder.#generatedOutputPaths(outputGroups),
            missingPaths: documents
                .filter((document) => document.exists === false)
                .map((document) => document.normalizedPath)
        }
    }

    /**
     * Builds graph lookup indexes.
     * @param {object[]} documents Document graph rows.
     * @param {object[]} outputGroups Output groups.
     * @returns {object}
     */
    static #indexes(documents, outputGroups) {
        const byPath = {}
        const byKind = {}
        for (const document of documents) {
            byPath[document.normalizedPath] = document.graphIndex
            byKind[document.kind] ||= []
            byKind[document.kind].push(document.normalizedPath)
        }

        return {
            byPath,
            byKind,
            outputsByDocumentPath:
                ProjectDocumentGraphBuilder.#outputsByDocumentPath(
                    outputGroups
                ),
            generatedOutputsByPath:
                ProjectDocumentGraphBuilder.#generatedOutputsByPath(
                    outputGroups
                )
        }
    }

    /**
     * Builds generated-output descriptors keyed by source document path.
     * @param {object[]} outputGroups Project output groups.
     * @returns {Record<string, object[]>}
     */
    static #outputsByDocumentPath(outputGroups) {
        const outputsByPath = {}
        for (const outputGroup of outputGroups || []) {
            for (const output of outputGroup.outputs || []) {
                const documentPath = ProjectDocumentGraphBuilder.#normalizePath(
                    output.normalizedDocumentPath || output.documentPath
                )
                if (!documentPath) {
                    continue
                }

                outputsByPath[documentPath] ||= []
                outputsByPath[documentPath].push(
                    ProjectDocumentGraphBuilder.#stripUndefined({
                        outputGroupName: outputGroup.name || '',
                        outputGroupIndex: outputGroup.index,
                        outputIndex: output.index,
                        type: output.type || '',
                        name: output.name || '',
                        variantName: output.variantName || '',
                        targetPath:
                            ProjectDocumentGraphBuilder.#normalizePath(
                                output.targetPath ||
                                    output.normalizedTargetPath ||
                                    ''
                            ) || undefined,
                        isDefault: output.isDefault === true ? true : undefined
                    })
                )
            }
        }

        return outputsByPath
    }

    /**
     * Lists generated output target paths.
     * @param {object[]} outputGroups Project output groups.
     * @returns {string[]}
     */
    static #generatedOutputPaths(outputGroups) {
        const paths = []
        for (const outputs of Object.values(
            ProjectDocumentGraphBuilder.#outputsByDocumentPath(outputGroups)
        )) {
            for (const output of outputs) {
                if (output.targetPath && !paths.includes(output.targetPath)) {
                    paths.push(output.targetPath)
                }
            }
        }
        return paths
    }

    /**
     * Builds generated-output descriptors keyed by target path.
     * @param {object[]} outputGroups Project output groups.
     * @returns {Record<string, object>}
     */
    static #generatedOutputsByPath(outputGroups) {
        const byPath = {}
        for (const [sourcePath, outputs] of Object.entries(
            ProjectDocumentGraphBuilder.#outputsByDocumentPath(outputGroups)
        )) {
            for (const output of outputs) {
                if (!output.targetPath) continue
                byPath[output.targetPath] = {
                    sourceDocumentPath: sourcePath,
                    ...output
                }
            }
        }
        return byPath
    }

    /**
     * Normalizes project-relative path separators.
     * @param {string} path Project path.
     * @returns {string}
     */
    static #normalizePath(path) {
        return String(path || '').replace(/\\/g, '/')
    }

    /**
     * Extracts a basename without resolving the path.
     * @param {string} path Project path.
     * @returns {string}
     */
    static #basename(path) {
        const parts = String(path || '').split(/[\\/]/u)
        return parts[parts.length - 1] || ''
    }

    /**
     * Removes undefined object properties for stable JSON output.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value).filter(([, entry]) => entry !== undefined)
        )
    }
}
