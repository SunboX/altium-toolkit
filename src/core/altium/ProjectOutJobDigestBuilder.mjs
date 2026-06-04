// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds a read-only digest of project output-job documents and output rows.
 */
export class ProjectOutJobDigestBuilder {
    static SCHEMA_ID = 'altium-toolkit.project.outjob-digest.a1'

    /**
     * Builds an output-job digest from normalized project fragments.
     * @param {{ documents?: object[], outputGroups?: object[] }} project Project fragments.
     * @returns {object}
     */
    static build(project) {
        const documents = (project?.documents || [])
            .filter((document) => document.kind === 'output-job')
            .map((document) => ({
                documentIndex: document.index,
                path: document.path,
                normalizedPath: document.normalizedPath,
                fileName: document.fileName
            }))
        const outputGroups = (project?.outputGroups || []).map((group) =>
            ProjectOutJobDigestBuilder.#outputGroup(group)
        )
        const outputCount = outputGroups.reduce(
            (sum, group) => sum + group.outputCount,
            0
        )

        return {
            schema: ProjectOutJobDigestBuilder.SCHEMA_ID,
            summary: {
                outJobDocumentCount: documents.length,
                outputGroupCount: outputGroups.length,
                outputCount
            },
            documents,
            outputGroups,
            outputsByDocumentPath:
                ProjectOutJobDigestBuilder.#outputsByDocumentPath(outputGroups)
        }
    }

    /**
     * Normalizes one output group.
     * @param {object} group Project output group.
     * @returns {object}
     */
    static #outputGroup(group) {
        const outputs = (group.outputs || []).map((output) => ({
            index: output.index,
            type: output.type,
            name: output.name,
            documentPath: output.documentPath,
            normalizedDocumentPath: ProjectOutJobDigestBuilder.#normalizePath(
                output.documentPath
            ),
            variantName: output.variantName,
            isDefault: output.isDefault
        }))

        return {
            index: group.index,
            name: group.name,
            outputCount: outputs.length,
            outputs
        }
    }

    /**
     * Builds a lookup keyed by normalized output document path.
     * @param {object[]} outputGroups Normalized output groups.
     * @returns {Record<string, object[]>}
     */
    static #outputsByDocumentPath(outputGroups) {
        const byPath = {}

        for (const group of outputGroups) {
            for (const output of group.outputs) {
                const path = output.normalizedDocumentPath
                if (!path) continue
                byPath[path] ||= []
                byPath[path].push({
                    outputGroupName: group.name,
                    outputGroupIndex: group.index,
                    outputIndex: output.index,
                    type: output.type,
                    name: output.name,
                    variantName: output.variantName,
                    isDefault: output.isDefault
                })
            }
        }

        return byPath
    }

    /**
     * Normalizes project path separators.
     * @param {string} path Raw path.
     * @returns {string}
     */
    static #normalizePath(path) {
        return String(path || '').replace(/\\/g, '/')
    }
}
