// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { ProjectOutJobDigestBuilder } from './ProjectOutJobDigestBuilder.mjs'
import { ProjectDocumentGraphBuilder } from './ProjectDocumentGraphBuilder.mjs'

/**
 * Parses Altium PrjPcb INI-style project files into a normalized project
 * context model.
 */
export class PrjPcbModelParser {
    /**
     * Parses one PrjPcb ArrayBuffer into the public project model.
     * @param {string} fileName
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ schema: string, kind: 'project', fileType: 'PrjPcb', fileName: string, summary: Record<string, number | string>, diagnostics: { severity: 'info' | 'warning', message: string }[], project: Record<string, unknown>, bom: [] }}
     */
    static parse(fileName, arrayBuffer) {
        return PrjPcbModelParser.parseText(
            fileName,
            PrjPcbModelParser.#decodeText(arrayBuffer)
        )
    }

    /**
     * Parses one PrjPcb text payload into the public project model.
     * @param {string} fileName
     * @param {string} text
     * @returns {ReturnType<typeof PrjPcbModelParser.parse>}
     */
    static parseText(fileName, text) {
        const sections = PrjPcbModelParser.#parseIniSections(text)
        const design = PrjPcbModelParser.#sectionFields(
            PrjPcbModelParser.#findSection(sections, 'Design')
        )
        const currentVariant =
            PrjPcbModelParser.#stringField(design, 'CurrentVariant') || ''
        let documents = PrjPcbModelParser.#extractDocuments(sections)
        const classGeneration = PrjPcbModelParser.#extractClassGeneration(
            sections,
            documents
        )
        documents = PrjPcbModelParser.#attachDocumentClassGeneration(
            documents,
            classGeneration
        )
        const documentGroups = PrjPcbModelParser.#buildDocumentGroups(documents)
        const parameters = PrjPcbModelParser.#extractParameters(sections)
        const variants = PrjPcbModelParser.#extractVariants(
            sections,
            currentVariant
        )
        const configurations =
            PrjPcbModelParser.#extractConfigurations(sections)
        const outputGroups = PrjPcbModelParser.#extractOutputGroups(sections)
        const outJobDigest = ProjectOutJobDigestBuilder.build({
            documents,
            outputGroups
        })
        const documentGraph = ProjectDocumentGraphBuilder.build({
            documents,
            documentGroups,
            outputGroups
        })
        const summary = PrjPcbModelParser.#buildSummary(
            fileName,
            documents,
            documentGroups,
            parameters,
            variants,
            currentVariant
        )

        return NormalizedModelSchema.attach({
            kind: 'project',
            fileType: 'PrjPcb',
            fileName,
            summary,
            diagnostics: PrjPcbModelParser.#buildDiagnostics(
                sections,
                documents,
                variants
            ),
            project: {
                name: PrjPcbModelParser.#stripExtension(fileName),
                design,
                documents,
                documentGroups,
                parameters,
                variants,
                configurations,
                outputGroups,
                outJobDigest,
                documentGraph,
                classGeneration,
                sections: PrjPcbModelParser.#serializeSections(sections)
            },
            bom: []
        })
    }

    /**
     * Decodes PrjPcb bytes with the common Altium text encodings.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {string}
     */
    static #decodeText(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer || new ArrayBuffer(0))
        for (const encoding of ['utf-8', 'windows-1252']) {
            try {
                return new TextDecoder(encoding, { fatal: true })
                    .decode(bytes)
                    .replace(/^\uFEFF/, '')
            } catch {
                // Try the next legacy-compatible project encoding.
            }
        }

        return new TextDecoder('windows-1252')
            .decode(bytes)
            .replace(/^\uFEFF/, '')
    }

    /**
     * Parses INI sections while preserving section and option order.
     * @param {string} text
     * @returns {{ name: string, index: number, entries: { key: string, value: string, line: number }[] }[]}
     */
    static #parseIniSections(text) {
        const sections = []
        let current = null
        const lines = String(text || '')
            .replace(/\r\n?/g, '\n')
            .split('\n')

        for (let index = 0; index < lines.length; index += 1) {
            const rawLine = lines[index]
            const trimmed = rawLine.trim()
            if (
                !trimmed ||
                trimmed.startsWith(';') ||
                trimmed.startsWith('#')
            ) {
                continue
            }

            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/)
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
            if (separatorIndex === -1) continue

            current.entries.push({
                key: rawLine.slice(0, separatorIndex).trim(),
                value: rawLine.slice(separatorIndex + 1).trim(),
                line: index + 1
            })
        }

        return sections
    }

    /**
     * Extracts numbered document entries.
     * @param {{ name: string, entries: { key: string, value: string }[] }[]} sections
     * @returns {object[]}
     */
    static #extractDocuments(sections) {
        return PrjPcbModelParser.#numberedSections(sections, 'Document').map(
            ({ section, number }) => {
                const fields = PrjPcbModelParser.#sectionFields(section)
                const path =
                    PrjPcbModelParser.#stringField(fields, 'DocumentPath') || ''
                const optionKeys = section.entries.map((entry) => entry.key)
                const isStub =
                    PrjPcbModelParser.#isDocumentStub(optionKeys) &&
                    PrjPcbModelParser.#documentKind(path) === 'schematic'

                return {
                    index: number,
                    section: section.name,
                    path,
                    normalizedPath:
                        PrjPcbModelParser.#normalizeDocumentPath(path),
                    fileName: PrjPcbModelParser.#basename(path),
                    extension: PrjPcbModelParser.#extension(path),
                    kind: PrjPcbModelParser.#documentKind(path),
                    uniqueId:
                        PrjPcbModelParser.#stringField(
                            fields,
                            'DocumentUniqueId'
                        ) || '',
                    isStub,
                    options: fields
                }
            }
        )
    }

    /**
     * Groups documents by role for project consumers.
     * @param {object[]} documents
     * @returns {Record<string, object[]>}
     */
    static #buildDocumentGroups(documents) {
        const schematics = documents.filter(
            (document) => document.kind === 'schematic'
        )
        const reachableSchematics = schematics.filter(
            (document) => !document.isStub
        )

        return {
            schematics,
            reachableSchematics: reachableSchematics.length
                ? reachableSchematics
                : schematics,
            pcbs: documents.filter((document) => document.kind === 'pcb'),
            schematicLibraries: documents.filter(
                (document) => document.kind === 'schematic-library'
            ),
            pcbLibraries: documents.filter(
                (document) => document.kind === 'pcb-library'
            ),
            integratedLibraries: documents.filter(
                (document) => document.kind === 'integrated-library'
            ),
            harnessFiles: documents.filter(
                (document) => document.kind === 'harness'
            ),
            outJobs: documents.filter(
                (document) => document.kind === 'output-job'
            ),
            others: documents.filter((document) => document.kind === 'other')
        }
    }

    /**
     * Extracts project parameter sections.
     * @param {{ name: string, entries: { key: string, value: string }[] }[]} sections
     * @returns {{ list: object[], map: Record<string, string> }}
     */
    static #extractParameters(sections) {
        const list = []
        const map = {}

        for (const { section, number } of PrjPcbModelParser.#numberedSections(
            sections,
            'Parameter'
        )) {
            const fields = PrjPcbModelParser.#sectionFields(section)
            const name = PrjPcbModelParser.#stringField(fields, 'Name')
            if (!name) continue
            const value = PrjPcbModelParser.#stringField(fields, 'Value') || ''
            list.push({
                index: number,
                section: section.name,
                name,
                value,
                options: fields
            })
            map[name] = value
        }

        return { list, map }
    }

    /**
     * Extracts project and per-document class-generation policy sections.
     * @param {{ name: string, entries: { key: string, value: string }[] }[]} sections
     * @param {object[]} documents
     * @returns {{ section: string, policies: object, options: Record<string, string | string[]>, documents: object[], byDocumentPath: Record<string, object>, byDocumentIndex: Record<string, object> }}
     */
    static #extractClassGeneration(sections, documents) {
        const projectSection =
            PrjPcbModelParser.#findSection(sections, 'PrjClassGen') || null
        const projectFields = PrjPcbModelParser.#sectionFields(projectSection)
        const documentPolicies = PrjPcbModelParser.#numberedSections(
            sections,
            'DocumentClassGen'
        ).map(({ section, number }) => {
            const fields = PrjPcbModelParser.#sectionFields(section)
            const documentPath =
                PrjPcbModelParser.#stringField(fields, 'DocumentPath') || ''
            const normalizedPath =
                PrjPcbModelParser.#normalizeDocumentPath(documentPath)
            const documentIndex =
                PrjPcbModelParser.#integerField(fields, 'DocumentIndex') ||
                PrjPcbModelParser.#documentIndexForPath(
                    documents,
                    normalizedPath
                ) ||
                number

            return {
                index: number,
                section: section.name,
                documentIndex,
                documentPath,
                normalizedPath,
                policies: PrjPcbModelParser.#classGenerationPolicies(fields),
                options: fields
            }
        })
        const byDocumentPath = {}
        const byDocumentIndex = {}

        for (const policy of documentPolicies) {
            if (policy.normalizedPath) {
                byDocumentPath[policy.normalizedPath] = policy
            }
            byDocumentIndex[String(policy.documentIndex)] = policy
        }

        return {
            section: projectSection?.name || '',
            policies: PrjPcbModelParser.#classGenerationPolicies(projectFields),
            options: projectFields,
            documents: documentPolicies,
            byDocumentPath,
            byDocumentIndex
        }
    }

    /**
     * Attaches per-document class-generation options to document rows.
     * @param {object[]} documents Project documents.
     * @param {object} classGeneration Class-generation model.
     * @returns {object[]}
     */
    static #attachDocumentClassGeneration(documents, classGeneration) {
        return (documents || []).map((document) => {
            const inlinePolicies =
                PrjPcbModelParser.#classGenerationPoliciesFromDocument(
                    document.options || {}
                )
            const sectionPolicy =
                classGeneration.byDocumentPath?.[document.normalizedPath] ||
                classGeneration.byDocumentIndex?.[String(document.index)] ||
                null
            const policies = {
                ...inlinePolicies,
                ...(sectionPolicy?.policies || {})
            }

            return Object.keys(policies).length
                ? {
                      ...document,
                      classGeneration: {
                          documentIndex: document.index,
                          policies,
                          section: sectionPolicy?.section || '',
                          options:
                              sectionPolicy?.options ||
                              PrjPcbModelParser.#classGenerationDocumentOptions(
                                  document.options || {}
                              )
                      }
                  }
                : document
        })
    }

    /**
     * Extracts class-generation policies from inline document options.
     * @param {Record<string, string | string[]>} fields Document option fields.
     * @returns {Record<string, boolean>}
     */
    static #classGenerationPoliciesFromDocument(fields) {
        const options =
            PrjPcbModelParser.#classGenerationDocumentOptions(fields)
        return PrjPcbModelParser.#classGenerationPolicies(options)
    }

    /**
     * Selects only inline class-generation options from one document section.
     * @param {Record<string, string | string[]>} fields Document option fields.
     * @returns {Record<string, string | string[]>}
     */
    static #classGenerationDocumentOptions(fields) {
        const options = {}
        for (const [key, value] of Object.entries(fields || {})) {
            if (/^ClassGen/i.test(key)) {
                options[key] = value
            }
        }
        return options
    }

    /**
     * Converts class-generation option fields into stable camelCase policy
     * names.
     * @param {Record<string, string | string[]>} fields Class-generation fields.
     * @returns {Record<string, boolean>}
     */
    static #classGenerationPolicies(fields) {
        const policies = {}
        for (const [key, value] of Object.entries(fields || {})) {
            const policyName = PrjPcbModelParser.#classGenerationPolicyName(key)
            if (!policyName) continue
            policies[policyName] = PrjPcbModelParser.#booleanValue(value)
        }
        return policies
    }

    /**
     * Resolves a public class-generation policy name.
     * @param {string} key Raw option key.
     * @returns {string}
     */
    static #classGenerationPolicyName(key) {
        const normalized = String(key || '')
            .replace(/^ClassGen/i, '')
            .replace(/[^a-z0-9]/gi, '')
            .toLowerCase()

        return (
            {
                generateclasses: 'generateClasses',
                generatenetclasses: 'generateNetClasses',
                generatecomponentclasses: 'generateComponentClasses',
                generatedifferentialpairclasses:
                    'generateDifferentialPairClasses',
                generaterooms: 'generateRooms',
                generatesheetclasses: 'generateSheetClasses',
                generatepolygonclasses: 'generatePolygonClasses',
                transfernetclasses: 'transferNetClasses',
                transfercomponentclasses: 'transferComponentClasses',
                transferdifferentialpairclasses:
                    'transferDifferentialPairClasses',
                transferroomdirectives: 'transferRoomDirectives'
            }[normalized] || ''
        )
    }

    /**
     * Finds a document index for a normalized path.
     * @param {object[]} documents Project document rows.
     * @param {string} normalizedPath Normalized document path.
     * @returns {number}
     */
    static #documentIndexForPath(documents, normalizedPath) {
        if (!normalizedPath) return 0
        const match = (documents || []).find(
            (document) => document.normalizedPath === normalizedPath
        )
        return Number(match?.index) || 0
    }

    /**
     * Extracts project variants and their variation rows.
     * @param {{ name: string, entries: { key: string, value: string }[] }[]} sections
     * @param {string} currentVariant
     * @returns {object[]}
     */
    static #extractVariants(sections, currentVariant) {
        return PrjPcbModelParser.#numberedSections(
            sections,
            'ProjectVariant'
        ).map(({ section, number }) => {
            const fields = PrjPcbModelParser.#sectionFields(section)
            const variationCount = PrjPcbModelParser.#integerField(
                fields,
                'VariationCount'
            )
            const parameterCount = PrjPcbModelParser.#integerField(
                fields,
                'ParameterCount'
            )
            const paramVariationCount = PrjPcbModelParser.#integerField(
                fields,
                'ParamVariationCount'
            )
            const variations = PrjPcbModelParser.#extractPipeRows(
                fields,
                'Variation',
                variationCount
            )
            const parameters = PrjPcbModelParser.#extractPipeRows(
                fields,
                'Parameter',
                parameterCount
            )
            const paramVariations =
                PrjPcbModelParser.#extractParamVariationRows(
                    fields,
                    paramVariationCount
                )
            const description =
                PrjPcbModelParser.#stringField(fields, 'Description') || ''

            return {
                index: number,
                section: section.name,
                uniqueId:
                    PrjPcbModelParser.#stringField(fields, 'UniqueId') || '',
                description,
                allowFabrication: PrjPcbModelParser.#booleanField(
                    fields,
                    'AllowFabrication'
                ),
                isCurrent:
                    !!currentVariant &&
                    description.toLowerCase() === currentVariant.toLowerCase(),
                variationCount,
                variations,
                parameterCount,
                parameters,
                paramVariationCount,
                paramVariations,
                parameterOverrides:
                    PrjPcbModelParser.#buildParameterOverrideMap(
                        paramVariations
                    ),
                alternateFitted:
                    PrjPcbModelParser.#buildAlternateFittedMap(variations),
                dnp: variations
                    .filter((variation) => variation.Kind === '1')
                    .map((variation) => variation.Designator || '')
                    .filter(Boolean),
                options: fields
            }
        })
    }

    /**
     * Extracts project configuration sections.
     * @param {{ name: string, entries: { key: string, value: string }[] }[]} sections
     * @returns {object[]}
     */
    static #extractConfigurations(sections) {
        return PrjPcbModelParser.#numberedSections(
            sections,
            'Configuration'
        ).map(({ section, number }) => {
            const fields = PrjPcbModelParser.#sectionFields(section)
            return {
                index: number,
                section: section.name,
                name: PrjPcbModelParser.#stringField(fields, 'Name') || '',
                variant:
                    PrjPcbModelParser.#stringField(fields, 'Variant') || '',
                options: fields
            }
        })
    }

    /**
     * Extracts output group sections and their numbered output rows.
     * @param {{ name: string, entries: { key: string, value: string }[] }[]} sections
     * @returns {object[]}
     */
    static #extractOutputGroups(sections) {
        return PrjPcbModelParser.#numberedSections(sections, 'OutputGroup').map(
            ({ section, number }) => {
                const fields = PrjPcbModelParser.#sectionFields(section)
                return {
                    index: number,
                    section: section.name,
                    name: PrjPcbModelParser.#stringField(fields, 'Name') || '',
                    description:
                        PrjPcbModelParser.#stringField(fields, 'Description') ||
                        '',
                    outputs: PrjPcbModelParser.#extractOutputRows(fields),
                    options: fields
                }
            }
        )
    }

    /**
     * Extracts pipe-delimited variation rows from numbered fields.
     * @param {Record<string, string | string[]>} fields
     * @param {string} prefix
     * @param {number} declaredCount
     * @returns {Record<string, string>[]}
     */
    static #extractPipeRows(fields, prefix, declaredCount) {
        const rows = []
        const count = Math.max(
            declaredCount,
            PrjPcbModelParser.#highestNumberedField(fields, prefix)
        )

        for (let index = 1; index <= count; index += 1) {
            const value = PrjPcbModelParser.#stringField(fields, prefix + index)
            if (!value) continue
            rows.push(PrjPcbModelParser.#parsePipeFields(value))
        }

        return rows
    }

    /**
     * Extracts parameter override rows and joins companion designator fields.
     * @param {Record<string, string | string[]>} fields
     * @param {number} declaredCount
     * @returns {Record<string, string>[]}
     */
    static #extractParamVariationRows(fields, declaredCount) {
        const rows = []
        const count = Math.max(
            declaredCount,
            PrjPcbModelParser.#highestNumberedField(fields, 'ParamVariation')
        )

        for (let index = 1; index <= count; index += 1) {
            const value = PrjPcbModelParser.#stringField(
                fields,
                'ParamVariation' + index
            )
            if (!value) continue
            const row = PrjPcbModelParser.#parsePipeFields(value)
            const designator = PrjPcbModelParser.#stringField(
                fields,
                'ParamDesignator' + index
            )
            if (designator) {
                row.ParamDesignator = designator
                row.Designator ||= designator
            }
            rows.push(row)
        }

        return rows
    }

    /**
     * Groups parameter override rows by designator and parameter name.
     * @param {Record<string, string>[]} rows
     * @returns {Record<string, Record<string, string>>}
     */
    static #buildParameterOverrideMap(rows) {
        const overrides = {}
        for (const row of rows) {
            const designator = String(
                row.ParamDesignator || row.Designator || ''
            ).trim()
            const parameterName = String(row.ParameterName || '').trim()
            if (!designator || !parameterName) continue
            overrides[designator] ||= {}
            overrides[designator][parameterName] = String(
                row.VariantValue || ''
            )
        }
        return overrides
    }

    /**
     * Groups alternate fitted component rows by designator.
     * @param {Record<string, string>[]} rows Variant variation rows.
     * @returns {Record<string, object>}
     */
    static #buildAlternateFittedMap(rows) {
        const alternates = {}
        for (const row of rows || []) {
            const designator = String(row.Designator || '').trim()
            if (!designator) continue
            const alternatePart = String(row.AlternatePart || '').trim()
            const isAlternate =
                String(row.Kind || '').trim() === '2' || Boolean(alternatePart)
            if (!isAlternate) continue

            alternates[designator] = {
                designator,
                alternatePart,
                libReference:
                    row.AlternateLibReference ||
                    row.AlternateLibraryRef ||
                    row.LibraryRef ||
                    '',
                footprint:
                    row.AlternateFootprint ||
                    row.Footprint ||
                    row.Pattern ||
                    '',
                comment: row.AlternateComment || row.Comment || '',
                description: row.AlternateDescription || row.Description || ''
            }
        }
        return alternates
    }

    /**
     * Extracts numbered output rows from one OutputGroup section.
     * @param {Record<string, string | string[]>} fields
     * @returns {object[]}
     */
    static #extractOutputRows(fields) {
        const count = PrjPcbModelParser.#highestNumberedField(
            fields,
            'OutputType'
        )
        const rows = []

        for (let index = 1; index <= count; index += 1) {
            const type =
                PrjPcbModelParser.#stringField(fields, 'OutputType' + index) ||
                ''
            if (!type) continue
            const targetPath =
                PrjPcbModelParser.#stringField(
                    fields,
                    'OutputTargetPath' + index
                ) ||
                PrjPcbModelParser.#stringField(fields, 'OutputPath' + index) ||
                ''
            const row = {
                index,
                type,
                name:
                    PrjPcbModelParser.#stringField(
                        fields,
                        'OutputName' + index
                    ) || '',
                documentPath:
                    PrjPcbModelParser.#stringField(
                        fields,
                        'OutputDocumentPath' + index
                    ) || '',
                variantName:
                    PrjPcbModelParser.#stringField(
                        fields,
                        'OutputVariantName' + index
                    ) || '',
                isDefault: PrjPcbModelParser.#booleanField(
                    fields,
                    'OutputDefault' + index
                )
            }
            if (targetPath) row.targetPath = targetPath
            rows.push(row)
        }

        return rows
    }

    /**
     * Builds model summary counts.
     * @param {string} fileName
     * @param {object[]} documents
     * @param {Record<string, object[]>} documentGroups
     * @param {{ list: object[], map: Record<string, string> }} parameters
     * @param {object[]} variants
     * @param {string} currentVariant
     * @returns {Record<string, number | string>}
     */
    static #buildSummary(
        fileName,
        documents,
        documentGroups,
        parameters,
        variants,
        currentVariant
    ) {
        return {
            title:
                parameters.map.PROJECT_TITLE ||
                PrjPcbModelParser.#stripExtension(fileName),
            documentCount: documents.length,
            schematicCount: documentGroups.schematics.length,
            reachableSchematicCount: documentGroups.reachableSchematics.length,
            pcbCount: documentGroups.pcbs.length,
            schematicLibraryCount: documentGroups.schematicLibraries.length,
            pcbLibraryCount: documentGroups.pcbLibraries.length,
            integratedLibraryCount: documentGroups.integratedLibraries.length,
            outJobCount: documentGroups.outJobs.length,
            variantCount: variants.length,
            parameterCount: parameters.list.length,
            currentVariant
        }
    }

    /**
     * Builds parser diagnostics for suspicious project content.
     * @param {object[]} sections
     * @param {object[]} documents
     * @param {object[]} variants
     * @returns {{ severity: 'info' | 'warning', message: string }[]}
     */
    static #buildDiagnostics(sections, documents, variants) {
        const diagnostics = []
        if (!PrjPcbModelParser.#findSection(sections, 'Design')) {
            diagnostics.push({
                severity: 'warning',
                message: 'PrjPcb file does not contain a [Design] section.'
            })
        }
        if (!documents.length) {
            diagnostics.push({
                severity: 'warning',
                message: 'PrjPcb file does not declare any project documents.'
            })
        }
        if (!variants.length) {
            diagnostics.push({
                severity: 'info',
                message: 'PrjPcb file does not declare project variants.'
            })
        }
        return diagnostics
    }

    /**
     * Returns numbered sections with a given prefix, sorted by numeric suffix.
     * @param {{ name: string }[]} sections
     * @param {string} prefix
     * @returns {{ section: object, number: number }[]}
     */
    static #numberedSections(sections, prefix) {
        const pattern = new RegExp('^' + prefix + '(\\d+)$', 'i')
        return sections
            .map((section) => {
                const match = String(section.name || '').match(pattern)
                return match
                    ? { section, number: Number.parseInt(match[1], 10) }
                    : null
            })
            .filter(Boolean)
            .sort((left, right) => left.number - right.number)
    }

    /**
     * Finds one section by name case-insensitively.
     * @param {{ name: string }[]} sections
     * @param {string} name
     * @returns {object | null}
     */
    static #findSection(sections, name) {
        const lowerName = name.toLowerCase()
        return (
            sections.find(
                (section) =>
                    String(section.name || '').toLowerCase() === lowerName
            ) || null
        )
    }

    /**
     * Builds a field map for one section.
     * @param {{ entries?: { key: string, value: string }[] } | null} section
     * @returns {Record<string, string | string[]>}
     */
    static #sectionFields(section) {
        const fields = {}
        for (const entry of section?.entries || []) {
            PrjPcbModelParser.#appendField(fields, entry.key, entry.value)
        }
        return fields
    }

    /**
     * Appends one value while preserving duplicate options.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @param {string} value
     */
    static #appendField(fields, key, value) {
        if (!(key in fields)) {
            fields[key] = value
            return
        }
        const previous = fields[key]
        if (Array.isArray(previous)) {
            previous.push(value)
            return
        }
        fields[key] = [previous, value]
    }

    /**
     * Reads the first string value for a field case-insensitively.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {string | null}
     */
    static #stringField(fields, key) {
        const keyLower = key.toLowerCase()
        for (const [candidateKey, value] of Object.entries(fields || {})) {
            if (candidateKey.toLowerCase() !== keyLower) continue
            return Array.isArray(value) ? value[0] || '' : value
        }
        return null
    }

    /**
     * Reads an integer field with zero fallback.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {number}
     */
    static #integerField(fields, key) {
        const value = Number.parseInt(
            PrjPcbModelParser.#stringField(fields, key) || '0',
            10
        )
        return Number.isFinite(value) ? value : 0
    }

    /**
     * Reads a boolean-ish Altium field.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @returns {boolean}
     */
    static #booleanField(fields, key) {
        return PrjPcbModelParser.#booleanValue(
            PrjPcbModelParser.#stringField(fields, key)
        )
    }

    /**
     * Parses one boolean-ish value.
     * @param {unknown} value Raw field value.
     * @returns {boolean}
     */
    static #booleanValue(value) {
        const raw = Array.isArray(value)
            ? String(value[0] || '')
            : String(value || '')
        const normalized = raw.toLowerCase()

        return (
            normalized === '1' ||
            normalized === 't' ||
            normalized === 'true' ||
            normalized === 'yes'
        )
    }

    /**
     * Parses a pipe-delimited Altium value string into key/value fields.
     * @param {string} value
     * @returns {Record<string, string>}
     */
    static #parsePipeFields(value) {
        const fields = {}
        for (const segment of String(value || '').split('|')) {
            const separatorIndex = segment.indexOf('=')
            if (separatorIndex === -1) continue
            const key = segment.slice(0, separatorIndex).trim()
            if (!key) continue
            fields[key] = segment.slice(separatorIndex + 1)
        }
        return fields
    }

    /**
     * Returns the highest numeric suffix for fields matching a prefix.
     * @param {Record<string, unknown>} fields
     * @param {string} prefix
     * @returns {number}
     */
    static #highestNumberedField(fields, prefix) {
        const pattern = new RegExp('^' + prefix + '(\\d+)$', 'i')
        let highest = 0
        for (const key of Object.keys(fields || {})) {
            const match = key.match(pattern)
            if (!match) continue
            highest = Math.max(highest, Number.parseInt(match[1], 10))
        }
        return highest
    }

    /**
     * Determines if a document has only durable identity fields.
     * @param {string[]} optionKeys
     * @returns {boolean}
     */
    static #isDocumentStub(optionKeys) {
        const extraKeys = optionKeys.filter(
            (key) =>
                !['documentpath', 'documentuniqueid'].includes(
                    String(key).toLowerCase()
                )
        )
        return extraKeys.length === 0
    }

    /**
     * Resolves document kind from its suffix.
     * @param {string} path
     * @returns {string}
     */
    static #documentKind(path) {
        switch (PrjPcbModelParser.#extension(path)) {
            case '.schdoc':
                return 'schematic'
            case '.pcbdoc':
                return 'pcb'
            case '.schlib':
                return 'schematic-library'
            case '.pcblib':
                return 'pcb-library'
            case '.intlib':
                return 'integrated-library'
            case '.harness':
            case '.harnessdoc':
                return 'harness'
            case '.outjob':
                return 'output-job'
            default:
                return 'other'
        }
    }

    /**
     * Normalizes Altium path separators without resolving on the host machine.
     * @param {string} path
     * @returns {string}
     */
    static #normalizeDocumentPath(path) {
        return String(path || '').replace(/\\/g, '/')
    }

    /**
     * Extracts a basename from either Windows or POSIX separators.
     * @param {string} path
     * @returns {string}
     */
    static #basename(path) {
        const parts = String(path || '').split(/[\\/]/)
        return parts[parts.length - 1] || ''
    }

    /**
     * Extracts a lowercase file extension from a path.
     * @param {string} path
     * @returns {string}
     */
    static #extension(path) {
        const basename = PrjPcbModelParser.#basename(path)
        const dotIndex = basename.lastIndexOf('.')
        return dotIndex === -1 ? '' : basename.slice(dotIndex).toLowerCase()
    }

    /**
     * Removes one file extension from a filename.
     * @param {string} fileName
     * @returns {string}
     */
    static #stripExtension(fileName) {
        const basename = PrjPcbModelParser.#basename(fileName)
        return basename.replace(/\.[^.]+$/, '')
    }

    /**
     * Serializes raw sections into plain JSON-friendly objects.
     * @param {{ name: string, index: number, entries: { key: string, value: string, line: number }[] }[]} sections
     * @returns {object[]}
     */
    static #serializeSections(sections) {
        return sections.map((section) => ({
            name: section.name,
            index: section.index,
            fields: PrjPcbModelParser.#sectionFields(section),
            entries: section.entries.map((entry) => ({ ...entry }))
        }))
    }
}
