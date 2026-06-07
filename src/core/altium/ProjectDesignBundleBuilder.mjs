// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { ProjectBomPnpReconciliationBuilder } from './ProjectBomPnpReconciliationBuilder.mjs'
import { ProjectVariantViewBuilder } from './ProjectVariantViewBuilder.mjs'

/**
 * Composes parsed project, schematic, and PCB models into one read-only design
 * bundle for multi-document consumers.
 */
export class ProjectDesignBundleBuilder {
    static #UNITS = {
        coordinate: 'mil',
        length: 'mil',
        board: 'mil',
        pnp: 'mil',
        angle: 'deg'
    }

    static #PNP_UNITS = {
        coordinate: 'mil',
        angle: 'deg'
    }

    /**
     * Builds a normalized project/design bundle from already parsed models.
     * @param {{ projectModel?: object, documentModels?: object[], annotationModels?: object[], variantName?: string }} options Bundle options.
     * @returns {object}
     */
    static build(options = {}) {
        const projectModel = options.projectModel || {}
        const documentModels = Array.isArray(options.documentModels)
            ? options.documentModels
            : []
        const project = projectModel.project || {}
        const documents = project.documents || []
        const schematicModels = documentModels.filter(
            (model) => model?.kind === 'schematic'
        )
        const pcbModels = documentModels.filter(
            (model) => model?.kind === 'pcb'
        )
        const sheets = ProjectDesignBundleBuilder.#buildSheets(
            schematicModels,
            documents
        )
        const components = ProjectDesignBundleBuilder.#buildComponents(
            schematicModels,
            pcbModels
        )
        const pnp = ProjectDesignBundleBuilder.#buildPnp(pcbModels)
        const nets = ProjectDesignBundleBuilder.#buildNets(
            schematicModels,
            pcbModels
        )
        const bom = ProjectDesignBundleBuilder.#buildBom(documentModels)
        const annotations = ProjectDesignBundleBuilder.#buildAnnotations(
            options.annotationModels || []
        )
        const indexes = ProjectDesignBundleBuilder.#buildIndexes(
            documents,
            sheets,
            components,
            nets,
            pnp
        )
        const bundle = NormalizedModelSchema.attach({
            kind: 'design-bundle',
            fileType: 'ProjectDesignBundle',
            fileName: projectModel.fileName || 'design-bundle.json',
            summary: {
                title:
                    projectModel.summary?.title ||
                    project.name ||
                    'Project design bundle',
                sheetCount: sheets.length,
                componentCount: components.length,
                netCount: nets.length,
                pnpCount: pnp.entries.length,
                variantCount: (project.variants || []).length,
                annotationMappingCount: annotations.mappings.length
            },
            diagnostics: [
                {
                    severity: 'info',
                    message:
                        'Composed ' +
                        documentModels.length +
                        ' parsed document models into a project design bundle.'
                }
            ],
            project,
            units: ProjectDesignBundleBuilder.#UNITS,
            variants: project.variants || [],
            sheets,
            components,
            schematic_hierarchy:
                ProjectDesignBundleBuilder.#buildSchematicHierarchy(
                    project,
                    schematicModels,
                    documents
                ),
            pnp,
            nets,
            annotations,
            indexes,
            bom
        })

        if (options.variantName) {
            bundle.effectiveVariant = ProjectVariantViewBuilder.build(bundle, {
                variantName: options.variantName
            })
        }

        bundle.reconciliation = ProjectBomPnpReconciliationBuilder.build({
            bundle,
            documentModels,
            effectiveVariant: bundle.effectiveVariant
        })

        return bundle
    }

    /**
     * Builds sheet entries from schematic models and project document rows.
     * @param {object[]} schematicModels Parsed schematic models.
     * @param {object[]} documents Project document rows.
     * @returns {object[]}
     */
    static #buildSheets(schematicModels, documents) {
        return schematicModels.map((model, index) => {
            const document = ProjectDesignBundleBuilder.#documentForModel(
                model,
                documents
            )

            return {
                bundleIndex: index,
                fileName: model.fileName,
                title: model.summary?.title || model.fileName,
                documentPath: document?.path || model.fileName,
                uniqueId: document?.uniqueId || '',
                sheet: model.schematic?.sheet || {},
                componentCount: model.schematic?.components?.length || 0,
                netCount: model.schematic?.nets?.length || 0
            }
        })
    }

    /**
     * Builds component entries joined by designator across schematic and PCB
     * documents.
     * @param {object[]} schematicModels Parsed schematic models.
     * @param {object[]} pcbModels Parsed PCB models.
     * @returns {object[]}
     */
    static #buildComponents(schematicModels, pcbModels) {
        const componentsByDesignator = new Map()

        for (const model of schematicModels) {
            for (const component of model.schematic?.components || []) {
                const entry = ProjectDesignBundleBuilder.#componentEntry(
                    componentsByDesignator,
                    component.designator
                )
                entry.schematic = {
                    fileName: model.fileName,
                    uniqueId: component.uniqueId || '',
                    libReference: component.libReference || '',
                    value: component.value || ''
                }
            }
        }

        for (const model of pcbModels) {
            for (const component of model.pcb?.components || []) {
                const entry = ProjectDesignBundleBuilder.#componentEntry(
                    componentsByDesignator,
                    component.designator
                )
                entry.pcb = {
                    fileName: model.fileName,
                    componentIndex: component.componentIndex,
                    uniqueId: component.uniqueId || '',
                    pattern: component.pattern || ''
                }
            }
        }

        return [...componentsByDesignator.values()].map((component, index) => ({
            bundleIndex: index,
            ...component
        }))
    }

    /**
     * Gets or creates one component bundle entry.
     * @param {Map<string, object>} componentsByDesignator Component map.
     * @param {string} designator Component designator.
     * @returns {object}
     */
    static #componentEntry(componentsByDesignator, designator) {
        const key = String(designator || '').trim()
        if (!componentsByDesignator.has(key)) {
            componentsByDesignator.set(key, {
                designator: key,
                schematic: null,
                pcb: null
            })
        }
        return componentsByDesignator.get(key)
    }

    /**
     * Builds a combined pick-place model.
     * @param {object[]} pcbModels Parsed PCB models.
     * @returns {object}
     */
    static #buildPnp(pcbModels) {
        const entries = []
        let positionMode = ''

        for (const model of pcbModels) {
            const pnp = model.pnp || model.pcb?.pickPlace || {}
            positionMode ||= pnp.positionMode || ''
            for (const entry of pnp.entries || []) {
                entries.push({
                    bundleIndex: entries.length,
                    sourceFileName: model.fileName,
                    ...entry
                })
            }
        }

        return {
            units: ProjectDesignBundleBuilder.#PNP_UNITS,
            positionMode,
            entries,
            modes: {}
        }
    }

    /**
     * Builds combined schematic and PCB net entries.
     * @param {object[]} schematicModels Parsed schematic models.
     * @param {object[]} pcbModels Parsed PCB models.
     * @returns {object[]}
     */
    static #buildNets(schematicModels, pcbModels) {
        const netsByName = new Map()

        for (const model of schematicModels) {
            for (const net of model.schematic?.nets || []) {
                const entry = ProjectDesignBundleBuilder.#netEntry(
                    netsByName,
                    net.name
                )
                entry.schematic.push({
                    fileName: model.fileName,
                    pins: net.pins || [],
                    labels: net.labels || [],
                    segments: net.segments || [],
                    ...(model.schematic?.harnesses
                        ? { harnesses: model.schematic.harnesses.connectors }
                        : {})
                })
                entry.pins.push(...(net.pins || []))
            }
        }

        for (const model of pcbModels) {
            for (const net of model.pcb?.nets || []) {
                const entry = ProjectDesignBundleBuilder.#netEntry(
                    netsByName,
                    net.name
                )
                entry.pcb.push({
                    fileName: model.fileName,
                    netIndex: net.netIndex,
                    uniqueId: net.uniqueId || ''
                })
            }
        }

        return [...netsByName.values()].map((net, index) => ({
            bundleIndex: index,
            ...net
        }))
    }

    /**
     * Gets or creates one net bundle entry.
     * @param {Map<string, object>} netsByName Net map.
     * @param {string} name Net name.
     * @returns {object}
     */
    static #netEntry(netsByName, name) {
        const key = String(name || '').trim()
        if (!netsByName.has(key)) {
            netsByName.set(key, {
                name: key,
                schematic: [],
                pcb: [],
                pins: []
            })
        }
        return netsByName.get(key)
    }

    /**
     * Selects a combined BOM, preferring PCB BOM rows when available.
     * @param {object[]} documentModels Parsed document models.
     * @returns {object[]}
     */
    static #buildBom(documentModels) {
        const noBomDesignators =
            ProjectDesignBundleBuilder.#noBomDesignators(documentModels)
        const pcbBom = documentModels
            .filter((model) => model?.kind === 'pcb')
            .flatMap((model) => model.bom || [])

        if (pcbBom.length) {
            return ProjectDesignBundleBuilder.#filterBomRows(
                pcbBom,
                noBomDesignators
            )
        }

        return ProjectDesignBundleBuilder.#filterBomRows(
            documentModels.flatMap((model) => model.bom || []),
            noBomDesignators
        )
    }

    /**
     * Removes component-kind no-BOM designators from normalized BOM rows.
     * @param {object[]} rows BOM rows.
     * @param {Set<string>} noBomDesignators Designators excluded from BOMs.
     * @returns {object[]}
     */
    static #filterBomRows(rows, noBomDesignators) {
        if (!noBomDesignators.size) return rows

        return (rows || [])
            .map((row) => {
                const designators = (row.designators || []).filter(
                    (designator) => !noBomDesignators.has(designator)
                )
                return {
                    ...row,
                    designators,
                    quantity: designators.length || row.quantity
                }
            })
            .filter((row) => row.designators.length > 0)
    }

    /**
     * Collects PCB components whose native kind excludes BOM output.
     * @param {object[]} documentModels Parsed document models.
     * @returns {Set<string>}
     */
    static #noBomDesignators(documentModels) {
        const designators = new Set()

        for (const model of documentModels.filter(
            (item) => item?.kind === 'pcb'
        )) {
            for (const component of model.pcb?.components || []) {
                if (component.componentKind?.includeInBom !== false) continue
                const designator = String(component.designator || '').trim()
                if (designator) designators.add(designator)
            }
        }

        return designators
    }

    /**
     * Builds compiled-designator annotation mappings.
     * @param {object[]} annotationModels Parsed annotation models.
     * @returns {{ mappings: object[], bySourceDesignator: Record<string, object>, byCompiledDesignator: Record<string, object> }}
     */
    static #buildAnnotations(annotationModels) {
        const mappings = []

        for (const model of annotationModels || []) {
            mappings.push(...(model?.annotations?.mappings || []))
        }

        return {
            mappings,
            bySourceDesignator: ProjectDesignBundleBuilder.#indexFullBy(
                mappings,
                'sourceDesignator'
            ),
            byCompiledDesignator: ProjectDesignBundleBuilder.#indexFullBy(
                mappings,
                'compiledDesignator'
            )
        }
    }

    /**
     * Builds schematic hierarchy metadata.
     * @param {object} project Project model.
     * @param {object[]} schematicModels Parsed schematic models.
     * @param {object[]} documents Project document rows.
     * @returns {object}
     */
    static #buildSchematicHierarchy(project, schematicModels, documents) {
        const hierarchy = {
            mode: project?.design?.HierarchyMode || '',
            modeName: ProjectDesignBundleBuilder.#hierarchyModeName(
                project?.design?.HierarchyMode
            ),
            sheets: schematicModels.map((model) => {
                const document = ProjectDesignBundleBuilder.#documentForModel(
                    model,
                    documents
                )
                return {
                    fileName: model.fileName,
                    documentPath: document?.path || model.fileName,
                    uniqueId: document?.uniqueId || '',
                    title: model.summary?.title || model.fileName
                }
            }),
            sheetSymbols: schematicModels.flatMap((model) =>
                (model.schematic?.sheetSymbols || []).map((sheetSymbol) => ({
                    sheetFileName: model.fileName,
                    uniqueId: sheetSymbol.uniqueId || '',
                    entries: (model.schematic?.sheetEntries || []).map(
                        (entry) => entry.name
                    )
                }))
            )
        }
        const harnessBundleLinks = schematicModels.flatMap((model) =>
            (model.schematic?.harnesses?.bundleLinks || []).map((link) => ({
                sheetFileName: model.fileName,
                ...link
            }))
        )

        if (harnessBundleLinks.length) {
            hierarchy.harness_bundle_links = harnessBundleLinks
        }

        return hierarchy
    }

    /**
     * Builds bundle lookup indexes.
     * @param {object[]} documents Project document rows.
     * @param {object[]} sheets Bundle sheets.
     * @param {object[]} components Bundle components.
     * @param {object[]} nets Bundle nets.
     * @param {object} pnp Bundle PnP model.
     * @returns {object}
     */
    static #buildIndexes(documents, sheets, components, nets, pnp) {
        return {
            documentsByPath: ProjectDesignBundleBuilder.#indexBy(
                documents,
                'normalizedPath'
            ),
            sheetsByFileName: ProjectDesignBundleBuilder.#indexBy(
                sheets,
                'fileName'
            ),
            componentsByDesignator: ProjectDesignBundleBuilder.#indexBy(
                components,
                'designator'
            ),
            netsByName: ProjectDesignBundleBuilder.#indexBy(nets, 'name'),
            pnpByDesignator: ProjectDesignBundleBuilder.#indexBy(
                pnp.entries,
                'designator'
            )
        }
    }

    /**
     * Builds a compact object index by a field.
     * @param {object[]} records Records to index.
     * @param {string} key Field name.
     * @returns {Record<string, object>}
     */
    static #indexBy(records, key) {
        const index = {}
        for (const record of records || []) {
            const value = String(record?.[key] || '').trim()
            if (!value) continue
            index[value] = {
                bundleIndex: record.bundleIndex ?? record.index ?? 0
            }
        }
        return index
    }

    /**
     * Builds a full object index by a field.
     * @param {object[]} records Records to index.
     * @param {string} key Field name.
     * @returns {Record<string, object>}
     */
    static #indexFullBy(records, key) {
        const index = {}
        for (const record of records || []) {
            const value = String(record?.[key] || '').trim()
            if (value) index[value] = record
        }
        return index
    }

    /**
     * Finds the project document row corresponding to a parsed model.
     * @param {object} model Parsed document model.
     * @param {object[]} documents Project document rows.
     * @returns {object | null}
     */
    static #documentForModel(model, documents) {
        return (
            (documents || []).find(
                (document) => document.fileName === model.fileName
            ) || null
        )
    }

    /**
     * Resolves a display name for a project hierarchy mode.
     * @param {string | number | undefined} mode Raw hierarchy mode.
     * @returns {string}
     */
    static #hierarchyModeName(mode) {
        switch (String(mode || '')) {
            case '2':
                return 'hierarchical'
            case '1':
                return 'flat'
            case '3':
                return 'global'
            default:
                return 'unspecified'
        }
    }
}
