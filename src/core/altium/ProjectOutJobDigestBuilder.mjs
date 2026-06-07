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
        const projectDocuments = project?.documents || []
        const documents = projectDocuments
            .filter((document) => document.kind === 'output-job')
            .map((document) => ({
                documentIndex: document.index,
                path: document.path,
                normalizedPath: document.normalizedPath,
                fileName: document.fileName
            }))
        const context = {
            defaultPcbDocumentPath:
                projectDocuments.find((document) => document.kind === 'pcb')
                    ?.path || ''
        }
        const outputGroups = (project?.outputGroups || []).map((group) =>
            ProjectOutJobDigestBuilder.#outputGroup(group, context)
        )
        const outputCount = outputGroups.reduce(
            (sum, group) => sum + group.outputCount,
            0
        )
        const outputs = outputGroups.flatMap((group) => group.outputs)
        const expectedArtifacts =
            ProjectOutJobDigestBuilder.#expectedArtifacts(outputGroups)

        return {
            schema: ProjectOutJobDigestBuilder.SCHEMA_ID,
            summary: {
                outJobDocumentCount: documents.length,
                outputGroupCount: outputGroups.length,
                outputCount,
                typedOutputCount: outputs.filter(
                    (output) => output.normalizedType !== 'unsupported'
                ).length,
                unsupportedOutputCount: outputs.filter(
                    (output) => output.normalizedType === 'unsupported'
                ).length,
                expectedArtifactCount: expectedArtifacts.manifest.outputs.length
            },
            documents,
            outputGroups,
            expectedArtifacts,
            outputsByDocumentPath:
                ProjectOutJobDigestBuilder.#outputsByDocumentPath(outputGroups)
        }
    }

    /**
     * Normalizes one output group.
     * @param {object} group Project output group.
     * @param {{ defaultPcbDocumentPath: string }} context Project context.
     * @returns {object}
     */
    static #outputGroup(group, context) {
        const outputs = (group.outputs || []).map((output) => ({
            ...ProjectOutJobDigestBuilder.#typedOutput(output, group, context)
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
                    normalizedType: output.normalizedType,
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

    /**
     * Builds one typed output row.
     * @param {object} output Raw output row.
     * @param {object} group Owning output group.
     * @param {{ defaultPcbDocumentPath: string }} context Project context.
     * @returns {object}
     */
    static #typedOutput(output, group, context) {
        const config = ProjectOutJobDigestBuilder.#mergedConfig(output)
        const normalizedType = ProjectOutJobDigestBuilder.#normalizedType(
            output.type
        )
        const category = ProjectOutJobDigestBuilder.#category(normalizedType)
        const documentPath = ProjectOutJobDigestBuilder.#documentPath(
            normalizedType,
            output,
            config,
            context
        )
        const normalizedDocumentPath =
            ProjectOutJobDigestBuilder.#normalizePath(documentPath)
        const settings = ProjectOutJobDigestBuilder.#settings(
            normalizedType,
            output,
            config,
            documentPath
        )
        const base = {
            index: output.index,
            type: output.type,
            normalizedType,
            name: output.name,
            documentPath: output.documentPath || '',
            normalizedDocumentPath,
            variantName: output.variantName || config.VariantName || '',
            isDefault: output.isDefault,
            category,
            settings
        }

        return {
            ...base,
            expectedArtifact: ProjectOutJobDigestBuilder.#expectedArtifact(
                base,
                group
            )
        }
    }

    /**
     * Resolves the source document path for one output row.
     * @param {string} normalizedType Stable output type.
     * @param {object} output Raw output row.
     * @param {Record<string, string>} config Merged config fields.
     * @param {{ defaultPcbDocumentPath: string }} context Project context.
     * @returns {string}
     */
    static #documentPath(normalizedType, output, config, context) {
        const explicit = output.documentPath || config.DocumentPath || ''
        if (explicit) return explicit

        if (
            normalizedType === 'bom' &&
            ProjectOutJobDigestBuilder.#boolean(config.IncludePcbData) === true
        ) {
            return context.defaultPcbDocumentPath || ''
        }

        return ''
    }

    /**
     * Merges parsed configuration rows into one field lookup.
     * @param {object} output Output row.
     * @returns {Record<string, string>}
     */
    static #mergedConfig(output) {
        const config = {}

        for (const row of output.configRows || []) {
            if (row.record && !config.Record) {
                config.Record = row.record
            }
            Object.assign(config, row.fields || {})
        }

        return config
    }

    /**
     * Resolves a stable output type token.
     * @param {string} type Native output type.
     * @returns {string}
     */
    static #normalizedType(type) {
        const normalized = String(type || '')
            .trim()
            .toLowerCase()
            .replace(/[\s_]+/gu, '-')

        if (normalized.includes('gerber')) return 'gerber'
        if (normalized.includes('ncdrill') || normalized.includes('nc-drill')) {
            return 'nc-drill'
        }
        if (normalized.includes('odb')) return 'odb'
        if (
            normalized.includes('pickplace') ||
            normalized.includes('pick-place')
        ) {
            return 'pick-place'
        }
        if (normalized.includes('wirelist')) return 'wirelist'
        if (normalized.includes('bom')) return 'bom'
        if (normalized.includes('step')) return 'step'
        if (normalized.includes('schematicprint')) return 'schematic-print'
        if (
            normalized.includes('pcbdrawing') ||
            normalized.includes('draftsman')
        ) {
            return 'pcb-drawing'
        }

        return 'unsupported'
    }

    /**
     * Resolves an output category.
     * @param {string} normalizedType Stable output type.
     * @returns {string}
     */
    static #category(normalizedType) {
        return (
            {
                gerber: 'fabrication',
                'nc-drill': 'fabrication',
                odb: 'fabrication',
                'pick-place': 'assembly',
                wirelist: 'netlist',
                bom: 'report',
                step: 'export',
                'schematic-print': 'documentation',
                'pcb-drawing': 'documentation'
            }[normalizedType] || 'unsupported'
        )
    }

    /**
     * Builds typed settings for one output row.
     * @param {string} normalizedType Stable output type.
     * @param {object} output Output row.
     * @param {Record<string, string>} config Merged config fields.
     * @param {string} documentPath Resolved output document path.
     * @returns {object}
     */
    static #settings(normalizedType, output, config, documentPath) {
        const common = ProjectOutJobDigestBuilder.#stripEmpty({
            record: config.Record || '',
            documentPath
        })

        switch (normalizedType) {
            case 'gerber':
                return ProjectOutJobDigestBuilder.#stripEmpty({
                    ...common,
                    units: config.GerberUnit || config.Units || '',
                    decimals: ProjectOutJobDigestBuilder.#number(
                        config.NumberOfDecimals
                    ),
                    plotLayers: ProjectOutJobDigestBuilder.#plotLayers(
                        config['Plot.Set']
                    )
                })
            case 'nc-drill':
                return ProjectOutJobDigestBuilder.#stripEmpty({
                    ...common,
                    units: config.Units || '',
                    separatePlated:
                        ProjectOutJobDigestBuilder.#boolean(
                            config.SeparatePlated
                        ) ??
                        ProjectOutJobDigestBuilder.#boolean(
                            config.GenerateSeparatePlatedNonPlatedFiles
                        )
                })
            case 'pick-place':
                return ProjectOutJobDigestBuilder.#stripEmpty({
                    ...common,
                    units: config.Units || '',
                    generateCsv: ProjectOutJobDigestBuilder.#boolean(
                        config.GenerateCSVFormat
                    ),
                    includeStandardNoBom: ProjectOutJobDigestBuilder.#boolean(
                        config.IncludeStandardNoBOM
                    )
                })
            case 'wirelist':
                return ProjectOutJobDigestBuilder.#stripEmpty({
                    ...common,
                    units: config.Units || '',
                    generateText: ProjectOutJobDigestBuilder.#boolean(
                        config.GenerateTextFormat
                    ),
                    includeVariations: ProjectOutJobDigestBuilder.#boolean(
                        config.IncludeVariations
                    )
                })
            case 'bom':
                return ProjectOutJobDigestBuilder.#stripEmpty({
                    ...common,
                    includePcbData: ProjectOutJobDigestBuilder.#boolean(
                        config.IncludePcbData
                    ),
                    includeAlternatives: ProjectOutJobDigestBuilder.#boolean(
                        config.IncludeAlternatives
                    ),
                    batchMode: ProjectOutJobDigestBuilder.#number(
                        config.BatchMode
                    ),
                    viewType: ProjectOutJobDigestBuilder.#number(
                        config.ViewType
                    )
                })
            case 'step':
                return ProjectOutJobDigestBuilder.#stripEmpty({
                    ...common,
                    exportModelsOption: ProjectOutJobDigestBuilder.#number(
                        config.ExportModelsOption
                    ),
                    exportHolesOption: ProjectOutJobDigestBuilder.#number(
                        config.ExportHolesOption
                    )
                })
            case 'schematic-print':
                return ProjectOutJobDigestBuilder.#stripEmpty({
                    ...common,
                    paperKind: config.PaperKind || '',
                    printScale: ProjectOutJobDigestBuilder.#number(
                        config.PrintScale
                    )
                })
            case 'pcb-drawing':
                return ProjectOutJobDigestBuilder.#stripEmpty({
                    ...common,
                    variantName: config.VariantName || ''
                })
            default:
                return common
        }
    }

    /**
     * Builds expected artifact metadata for all output rows.
     * @param {object[]} outputGroups Output groups.
     * @returns {object}
     */
    static #expectedArtifacts(outputGroups) {
        const outputs = outputGroups.flatMap((group) =>
            group.outputs.map((output) => output.expectedArtifact)
        )

        return {
            schema: 'altium-toolkit.project.expected-artifacts.a1',
            summary: {
                outputCount: outputs.length,
                unsupportedOutputCount: outputs.filter(
                    (output) => output.unsupported
                ).length
            },
            manifest: {
                outputs
            }
        }
    }

    /**
     * Builds one expected artifact row.
     * @param {object} output Typed output row.
     * @param {object} group Owning group.
     * @returns {object}
     */
    static #expectedArtifact(output, group) {
        const artifact = ProjectOutJobDigestBuilder.#stripEmpty({
            key:
                ProjectOutJobDigestBuilder.#slug(group.name || 'outputs') +
                '/' +
                String(output.index).padStart(2, '0') +
                '-' +
                ProjectOutJobDigestBuilder.#slug(
                    output.name || output.normalizedType
                ),
            outputGroupName: group.name || '',
            outputName: output.name || '',
            outputType: output.normalizedType,
            category: output.category,
            documentPath:
                output.settings.documentPath || output.documentPath || '',
            normalizedDocumentPath: output.normalizedDocumentPath,
            variantName: output.variantName,
            format: ProjectOutJobDigestBuilder.#format(output),
            units: output.settings.units,
            unsupported:
                output.normalizedType === 'unsupported' ? true : undefined
        })
        artifact.variantName = output.variantName || ''
        return artifact
    }

    /**
     * Resolves the expected artifact format token.
     * @param {object} output Typed output row.
     * @returns {string}
     */
    static #format(output) {
        if (output.normalizedType === 'pick-place') {
            return output.settings.generateCsv === false
                ? 'pick-place-text'
                : 'pick-place-csv'
        }

        return (
            {
                gerber: 'gerber',
                'nc-drill': 'nc-drill',
                odb: 'odb',
                wirelist: 'wirelist',
                bom: 'bom',
                step: 'step',
                'schematic-print': 'pdf',
                'pcb-drawing': 'pcbdwf'
            }[output.normalizedType] || 'unknown'
        )
    }

    /**
     * Parses plot-layer tokens from Altium plot-layer state strings.
     * @param {string | undefined} value Plot-layer state.
     * @returns {string[] | undefined}
     */
    static #plotLayers(value) {
        const layers = String(value || '')
            .split(',')
            .map((segment) => segment.trim().split('~')[0])
            .filter(Boolean)

        return layers.length ? layers : undefined
    }

    /**
     * Parses one numeric field.
     * @param {unknown} value Raw value.
     * @returns {number | undefined}
     */
    static #number(value) {
        const parsed = Number.parseFloat(String(value ?? '').trim())
        return Number.isFinite(parsed) ? parsed : undefined
    }

    /**
     * Parses one optional boolean field.
     * @param {unknown} value Raw value.
     * @returns {boolean | undefined}
     */
    static #boolean(value) {
        const raw = String(value ?? '')
            .trim()
            .toLowerCase()
        if (!raw) return undefined
        return ['1', 't', 'true', 'yes'].includes(raw)
    }

    /**
     * Removes empty values while preserving booleans and zeroes.
     * @param {object} value Source object.
     * @returns {object}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) return entryValue.length > 0
                if (typeof entryValue === 'string') return entryValue.length > 0
                return entryValue !== null && entryValue !== undefined
            })
        )
    }

    /**
     * Builds a stable slug for output manifest keys.
     * @param {string} value Raw value.
     * @returns {string}
     */
    static #slug(value) {
        return (
            String(value || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, '-')
                .replace(/^-|-$/gu, '') || 'output'
        )
    }
}
