// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { DocumentResult } from 'circuitjson-toolkit/parser'

import { SchematicProjectParameterResolver } from '../core/altium/SchematicProjectParameterResolver.mjs'

const SCHEMATIC_TITLE_BLOCK_FIELDS = [
    'title',
    'revision',
    'documentNumber',
    'sheetNumber',
    'sheetTotal',
    'date',
    'drawnBy'
]

/**
 * Resolves project-owned schematic strings inside canonical documents.
 */
export class AltiumProjectDocumentResolver {
    /**
     * Returns canonical documents with referenced schematic strings resolved.
     * @param {{ projectEntry?: { name: string, input: { data: string | ArrayBuffer | Uint8Array } } | null }} classified Classified project entries.
     * @param {object[]} documents Parsed canonical documents.
     * @param {string | string[]} extensionSelection Public extension selection.
     * @returns {object[]} Original or resolved canonical documents.
     */
    static resolve(classified, documents, extensionSelection) {
        const context = AltiumProjectDocumentResolver.#context(
            classified,
            documents
        )
        const exposesProjectContext =
            AltiumProjectDocumentResolver.#exposesProjectContext(
                extensionSelection
            )

        let changed = false
        const resolved = documents.map((document) => {
            const next = context
                ? AltiumProjectDocumentResolver.#document(
                      document,
                      context,
                      exposesProjectContext
                  )
                : AltiumProjectDocumentResolver.#withProjectContextExposure(
                      document,
                      exposesProjectContext
                  )
            changed ||= next !== document
            return next
        })
        return changed ? resolved : documents
    }

    /**
     * Reads compact project facts from its canonical extension.
     * @param {{ projectEntry?: { name: string, input: { data: string | ArrayBuffer | Uint8Array } } | null }} classified Classified project entries.
     * @param {object[]} documents Parsed canonical documents.
     * @returns {{ fileName: string, parameters: Record<string, any>, documents: string[] } | null} Project context.
     */
    static #context(classified, documents) {
        const entry = classified?.projectEntry
        if (!entry) return null
        const projectDocument = documents.find(
            (document) =>
                document?.source?.fileType === 'prjpcb' &&
                document.source.fileName === entry.name
        )
        const projectContext =
            projectDocument?.extensions?.altium?.projectContext
        if (!projectContext) return null
        return {
            fileName: entry.name,
            parameters: projectContext.parameters || {},
            documents: Array.isArray(projectContext.documents)
                ? projectContext.documents
                : []
        }
    }

    /**
     * Resolves one schematic document without mutating its proven model.
     * @param {object} document Canonical document.
     * @param {{ fileName: string, parameters: Record<string, any>, documents: string[] }} context Project context.
     * @param {boolean} exposesProjectContext Whether compact context remains public.
     * @returns {object} Original or rebuilt canonical document.
     */
    static #document(document, context, exposesProjectContext) {
        if (String(document?.source?.fileType || '') !== 'schdoc') {
            return AltiumProjectDocumentResolver.#withProjectContextExposure(
                document,
                exposesProjectContext
            )
        }
        if (
            context.documents.length &&
            !AltiumProjectDocumentResolver.#mentions(
                context.documents,
                document.source.fileName
            )
        ) {
            return AltiumProjectDocumentResolver.#withProjectContextExposure(
                document,
                exposesProjectContext
            )
        }
        const parameters = {
            ...context.parameters,
            ...AltiumProjectDocumentResolver.#currentValues(),
            ProjectName: AltiumProjectDocumentResolver.#baseName(
                context.fileName
            ),
            DataSourceFileName: AltiumProjectDocumentResolver.#baseName(
                context.fileName
            ),
            DocumentName: AltiumProjectDocumentResolver.#baseName(
                document.source.fileName
            ),
            DocumentFullPathAndName: document.source.fileName
        }
        let resolutionCount = 0
        const model = document.model.map((element) => {
            if (element?.type !== 'schematic_text') return element
            const resolved = SchematicProjectParameterResolver.resolveText(
                element.text,
                parameters
            )
            if (!resolved || resolved.resolvedText === element.text) {
                return element
            }
            resolutionCount += 1
            return { ...element, text: resolved.resolvedText }
        })
        const hidesProjectContext =
            !exposesProjectContext &&
            Boolean(document?.extensions?.altium?.projectContext)
        const native = hidesProjectContext
            ? undefined
            : document?.extensions?.altium?.native
        const resolvedNative =
            AltiumProjectDocumentResolver.#resolvedNativeDocument(
                native,
                parameters
            )
        const extensions = hidesProjectContext
            ? {}
            : resolvedNative === native
              ? document.extensions
              : {
                    altium: {
                        ...document.extensions.altium,
                        native: resolvedNative
                    }
                }
        if (
            !resolutionCount &&
            resolvedNative === native &&
            extensions === document.extensions
        ) {
            return document
        }
        return AltiumProjectDocumentResolver.#rebuild(document, {
            model,
            extensions,
            statistics:
                resolutionCount || resolvedNative !== native
                    ? {
                          ...document.statistics,
                          resolvedProjectParameterCount: resolutionCount
                      }
                    : document.statistics
        })
    }

    /**
     * Resolves retained native schematic text and title-block fields through the
     * same project parameter set used by the canonical CircuitJSON model.
     * @param {object | null | undefined} native Retained native renderer model.
     * @param {Record<string, any>} parameters Resolved project parameters.
     * @returns {object | null | undefined} Original or resolved native model.
     */
    static #resolvedNativeDocument(native, parameters) {
        if (!native?.schematic) return native
        const resolved = SchematicProjectParameterResolver.applyToDocumentModel(
            native,
            parameters,
            { replaceText: true }
        )
        const sourceTexts = Array.isArray(native.schematic.texts)
            ? native.schematic.texts
            : []
        const resolvedTexts = Array.isArray(resolved.schematic.texts)
            ? resolved.schematic.texts
            : []
        const textChanged = sourceTexts.some(
            (text, index) => text?.text !== resolvedTexts[index]?.text
        )
        const sourceTitleBlock = native.schematic.sheet?.titleBlock || {}
        const resolvedTitleBlock = resolved.schematic.sheet?.titleBlock || {}
        const titleBlockChanged = SCHEMATIC_TITLE_BLOCK_FIELDS.some(
            (field) => sourceTitleBlock[field] !== resolvedTitleBlock[field]
        )
        if (!textChanged && !titleBlockChanged) return native
        return { ...resolved, projectParameters: parameters }
    }

    /**
     * Applies compact project-context exposure without rebuilding documents that
     * already match the public selection.
     * @param {object} document Canonical document.
     * @param {boolean} exposesProjectContext Whether compact context remains public.
     * @returns {object} Original or rebuilt project document.
     */
    static #withProjectContextExposure(document, exposesProjectContext) {
        if (
            exposesProjectContext ||
            !document?.extensions?.altium?.projectContext
        ) {
            return document
        }
        return AltiumProjectDocumentResolver.#rebuild(document, {
            extensions: {}
        })
    }

    /**
     * Returns true when public selection includes compact project context.
     * @param {string | string[]} selection Extension selection.
     * @returns {boolean} Whether project facts remain public.
     */
    static #exposesProjectContext(selection) {
        if (!Array.isArray(selection)) return selection !== 'none'
        return (
            selection.includes('altium.project-context') ||
            selection.includes('altium.native-model')
        )
    }

    /**
     * Rebuilds one canonical document through the toolkit-owned shared boundary.
     * @param {object} document Existing canonical document.
     * @param {{ model?: object[], extensions?: object, statistics?: object }} fields Replacements.
     * @returns {object} Proven immutable document.
     */
    static #rebuild(document, fields) {
        return DocumentResult.createValidatedOwned(
            {
                id: document.id,
                model: fields.model || document.model,
                source: document.source,
                extensions:
                    fields.extensions === undefined
                        ? document.extensions
                        : fields.extensions,
                assets: document.assets,
                diagnostics: document.diagnostics,
                statistics: fields.statistics || document.statistics
            },
            AltiumProjectDocumentResolver.#runtime(document)
        )
    }

    /**
     * Preserves an explicit source reference when the parser retained one.
     * @param {object} document Canonical document.
     * @returns {{ sourceReference?: object }} Runtime-only fields.
     */
    static #runtime(document) {
        const descriptor = Object.getOwnPropertyDescriptor(
            document,
            'sourceReference'
        )
        return descriptor && Object.hasOwn(descriptor, 'value')
            ? { sourceReference: descriptor.value }
            : {}
    }

    /**
     * Builds current-value special strings used by Altium templates.
     * @returns {{ CurrentDate: string, CurrentTime: string }} Current values.
     */
    static #currentValues() {
        const now = new Date()
        return {
            CurrentDate: now.toLocaleDateString('en-US'),
            CurrentTime: now.toLocaleTimeString('en-US')
        }
    }

    /**
     * Returns the final normalized path segment.
     * @param {unknown} value Path value.
     * @returns {string} Basename.
     */
    static #baseName(value) {
        const path = String(value || '').replaceAll('\\', '/')
        return path.split('/').pop() || path
    }

    /**
     * Returns true when project paths own one schematic source path.
     * @param {string[]} projectPaths Normalized project document paths.
     * @param {string} fileName Canonical source path.
     * @returns {boolean} Whether the project references the schematic.
     */
    static #mentions(projectPaths, fileName) {
        const source = String(fileName || '').replaceAll('\\', '/')
        const sourceBaseName = AltiumProjectDocumentResolver.#baseName(source)
        return projectPaths.some((value) => {
            const path = String(value || '').replaceAll('\\', '/')
            return (
                path === source ||
                source.endsWith('/' + path) ||
                path.endsWith('/' + source) ||
                AltiumProjectDocumentResolver.#baseName(path) === sourceBaseName
            )
        })
    }
}

Object.freeze(AltiumProjectDocumentResolver.prototype)
Object.freeze(AltiumProjectDocumentResolver)
