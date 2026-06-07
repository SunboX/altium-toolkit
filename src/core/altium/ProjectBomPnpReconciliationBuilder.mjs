// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic BOM/PnP reconciliation metadata for a project bundle.
 */
export class ProjectBomPnpReconciliationBuilder {
    static SCHEMA_ID = 'altium-toolkit.project.bom-pnp-reconciliation.a1'

    /**
     * Builds a reconciliation report from bundle and source document models.
     * @param {{ bundle?: object, documentModels?: object[], effectiveVariant?: object }} options Report options.
     * @returns {object}
     */
    static build(options = {}) {
        const bundle = options.bundle || {}
        const documentModels = Array.isArray(options.documentModels)
            ? options.documentModels
            : []
        const schematicBomDesignators =
            ProjectBomPnpReconciliationBuilder.#bomDesignators(
                documentModels.filter((model) => model?.kind === 'schematic')
            )
        const pcbBomDesignators =
            ProjectBomPnpReconciliationBuilder.#bomDesignators(
                documentModels.filter((model) => model?.kind === 'pcb')
            )
        const pnpDesignators =
            ProjectBomPnpReconciliationBuilder.#pnpDesignators(documentModels)
        const effectiveBomDesignators =
            ProjectBomPnpReconciliationBuilder.#effectiveBomDesignators(
                bundle,
                options.effectiveVariant
            )
        const noBomDesignators =
            ProjectBomPnpReconciliationBuilder.#noBomDesignators(documentModels)
        const issues = [
            ...ProjectBomPnpReconciliationBuilder.#missingIssues(
                schematicBomDesignators,
                pcbBomDesignators,
                'reconciliation.schematic-bom-without-pcb-bom',
                'Schematic BOM designator was not present in the PCB-backed BOM.'
            ),
            ...ProjectBomPnpReconciliationBuilder.#missingIssues(
                pcbBomDesignators,
                schematicBomDesignators,
                'reconciliation.pcb-bom-without-schematic-bom',
                'PCB-backed BOM designator was not present in the schematic BOM.'
            ),
            ...ProjectBomPnpReconciliationBuilder.#missingIssues(
                pcbBomDesignators,
                pnpDesignators,
                'reconciliation.bom-without-pnp',
                'PCB-backed BOM designator did not have a PnP placement.'
            ),
            ...ProjectBomPnpReconciliationBuilder.#missingIssues(
                pnpDesignators,
                pcbBomDesignators,
                'reconciliation.pnp-without-bom',
                'PnP placement designator was not present in the PCB-backed BOM.'
            ),
            ...ProjectBomPnpReconciliationBuilder.#intersectionIssues(
                noBomDesignators,
                pcbBomDesignators,
                'reconciliation.no-bom-component-in-pcb-bom',
                'Component marked as no-BOM appeared in the PCB-backed BOM.'
            )
        ]

        return {
            schema: ProjectBomPnpReconciliationBuilder.SCHEMA_ID,
            summary: {
                schematicBomDesignatorCount: schematicBomDesignators.length,
                pcbBomDesignatorCount: pcbBomDesignators.length,
                pnpDesignatorCount: pnpDesignators.length,
                effectiveBomDesignatorCount: effectiveBomDesignators.length,
                noBomComponentCount: noBomDesignators.length,
                issueCount: issues.length
            },
            schematicBomDesignators,
            pcbBomDesignators,
            pnpDesignators,
            effectiveBomDesignators,
            noBomDesignators,
            issues
        }
    }

    /**
     * Extracts designators from BOM rows.
     * @param {object[]} models Parsed document models.
     * @returns {string[]}
     */
    static #bomDesignators(models) {
        const designators = new Set()

        for (const model of models) {
            for (const row of model?.bom || []) {
                for (const designator of row.designators || []) {
                    ProjectBomPnpReconciliationBuilder.#addDesignator(
                        designators,
                        designator
                    )
                }
                ProjectBomPnpReconciliationBuilder.#addDesignator(
                    designators,
                    row.designator
                )
            }
        }

        return ProjectBomPnpReconciliationBuilder.#sorted([...designators])
    }

    /**
     * Extracts designators from pick-place entries.
     * @param {object[]} models Parsed document models.
     * @returns {string[]}
     */
    static #pnpDesignators(models) {
        const designators = new Set()

        for (const model of models.filter((item) => item?.kind === 'pcb')) {
            const pnp = model.pnp || model.pcb?.pickPlace || {}
            for (const entry of pnp.entries || []) {
                ProjectBomPnpReconciliationBuilder.#addDesignator(
                    designators,
                    entry.designator
                )
            }
        }

        return ProjectBomPnpReconciliationBuilder.#sorted([...designators])
    }

    /**
     * Extracts designators from the active effective variant or bundle BOM.
     * @param {object} bundle Project design bundle.
     * @param {object | undefined} effectiveVariant Effective variant view.
     * @returns {string[]}
     */
    static #effectiveBomDesignators(bundle, effectiveVariant) {
        if (effectiveVariant?.bom) {
            return ProjectBomPnpReconciliationBuilder.#bomDesignators([
                { bom: effectiveVariant.bom }
            ])
        }

        return ProjectBomPnpReconciliationBuilder.#bomDesignators([
            { bom: bundle.bom || [] }
        ])
    }

    /**
     * Extracts component designators explicitly excluded from BOMs.
     * @param {object[]} models Parsed document models.
     * @returns {string[]}
     */
    static #noBomDesignators(models) {
        const designators = new Set()

        for (const model of models.filter((item) => item?.kind === 'pcb')) {
            for (const component of model.pcb?.components || []) {
                if (component.componentKind?.includeInBom !== false) continue
                ProjectBomPnpReconciliationBuilder.#addDesignator(
                    designators,
                    component.designator
                )
            }
        }

        return ProjectBomPnpReconciliationBuilder.#sorted([...designators])
    }

    /**
     * Adds a normalized designator to a set.
     * @param {Set<string>} designators Target set.
     * @param {unknown} value Raw designator value.
     * @returns {void}
     */
    static #addDesignator(designators, value) {
        const designator = String(value || '').trim()
        if (designator) designators.add(designator)
    }

    /**
     * Builds missing-designator issue rows.
     * @param {string[]} source Source designators.
     * @param {string[]} target Target designators.
     * @param {string} code Diagnostic code.
     * @param {string} message Diagnostic message.
     * @returns {object[]}
     */
    static #missingIssues(source, target, code, message) {
        const targetSet = new Set(target)
        return source
            .filter((designator) => !targetSet.has(designator))
            .map((designator) => ({
                severity: 'warning',
                code,
                designator,
                message
            }))
    }

    /**
     * Builds issue rows for designators present in both sets.
     * @param {string[]} left Left designators.
     * @param {string[]} right Right designators.
     * @param {string} code Diagnostic code.
     * @param {string} message Diagnostic message.
     * @returns {object[]}
     */
    static #intersectionIssues(left, right, code, message) {
        const rightSet = new Set(right)
        return left
            .filter((designator) => rightSet.has(designator))
            .map((designator) => ({
                severity: 'warning',
                code,
                designator,
                message
            }))
    }

    /**
     * Sorts designators in a stable human-friendly order.
     * @param {string[]} values Designator values.
     * @returns {string[]}
     */
    static #sorted(values) {
        return [...values].sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
    }
}
