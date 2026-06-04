// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds consumer-facing effective views for project variants.
 */
export class ProjectVariantViewBuilder {
    /**
     * Applies one project variant to bundle-level BOM, PnP, component, and net
     * collections.
     * @param {object} bundle Project design bundle.
     * @param {{ variantName?: string }} options Variant selection options.
     * @returns {object}
     */
    static build(bundle, options = {}) {
        const variant = ProjectVariantViewBuilder.#findVariant(
            bundle,
            options.variantName
        )
        const dnp = new Set(variant?.dnp || [])
        const parameterOverrides = variant?.parameterOverrides || {}
        const alternateFitted = variant?.alternateFitted || {}
        const annotations = bundle?.annotations?.bySourceDesignator || {}
        const includeVariantDetails =
            ProjectVariantViewBuilder.#hasKeys(alternateFitted) ||
            ProjectVariantViewBuilder.#hasKeys(annotations)

        return {
            name: variant?.description || options.variantName || '',
            uniqueId: variant?.uniqueId || '',
            dnp: [...dnp],
            parameterOverrides,
            ...(includeVariantDetails ? { alternateFitted } : {}),
            bom: ProjectVariantViewBuilder.#applyBomVariant(
                bundle?.bom || [],
                dnp,
                parameterOverrides,
                alternateFitted,
                annotations,
                includeVariantDetails
            ),
            pnp: {
                ...(bundle?.pnp || {}),
                entries: (bundle?.pnp?.entries || [])
                    .filter((entry) => !dnp.has(entry.designator))
                    .map((entry) =>
                        ProjectVariantViewBuilder.#applyDesignatorAnnotation(
                            entry,
                            annotations
                        )
                    )
            },
            nets: ProjectVariantViewBuilder.#applyNetVariant(
                bundle?.nets || [],
                dnp,
                annotations
            ),
            components: (bundle?.components || []).map((component) =>
                ProjectVariantViewBuilder.#applyComponentVariant(
                    component,
                    dnp,
                    parameterOverrides,
                    alternateFitted,
                    annotations,
                    includeVariantDetails
                )
            )
        }
    }

    /**
     * Finds the requested variant or the current project variant.
     * @param {object} bundle Project design bundle.
     * @param {string | undefined} variantName Requested variant name.
     * @returns {object | null}
     */
    static #findVariant(bundle, variantName) {
        const variants = bundle?.variants || bundle?.project?.variants || []
        const requested =
            variantName || bundle?.project?.design?.CurrentVariant || ''
        if (!requested) {
            return variants.find((variant) => variant.isCurrent) || null
        }

        const lookup = requested.toLowerCase()
        return (
            variants.find(
                (variant) =>
                    String(variant.description || '').toLowerCase() ===
                        lookup ||
                    String(variant.uniqueId || '').toLowerCase() === lookup
            ) ||
            variants.find((variant) => variant.isCurrent) ||
            null
        )
    }

    /**
     * Applies DNP and parameter overrides to BOM rows.
     * @param {object[]} bom BOM rows.
     * @param {Set<string>} dnp DNP designators.
     * @param {Record<string, Record<string, string>>} parameterOverrides Overrides by designator.
     * @param {Record<string, object>} alternateFitted Alternate fitted rows by designator.
     * @param {Record<string, object>} annotations Annotation rows by source designator.
     * @param {boolean} includeVariantDetails Whether to expose alternate metadata.
     * @returns {object[]}
     */
    static #applyBomVariant(
        bom,
        dnp,
        parameterOverrides,
        alternateFitted,
        annotations,
        includeVariantDetails
    ) {
        return (bom || [])
            .flatMap((row) =>
                (row.designators || []).map((designator) =>
                    ProjectVariantViewBuilder.#applyBomDesignatorVariant(
                        row,
                        designator,
                        parameterOverrides,
                        alternateFitted,
                        annotations,
                        includeVariantDetails
                    )
                )
            )
            .filter(
                (row) => !dnp.has(row.sourceDesignator || row.designators[0])
            )
    }

    /**
     * Applies one designator's parameter overrides to a BOM row.
     * @param {object} row Source BOM row.
     * @param {string} designator Designator.
     * @param {Record<string, Record<string, string>>} parameterOverrides Overrides by designator.
     * @param {Record<string, object>} alternateFitted Alternate fitted rows by designator.
     * @param {Record<string, object>} annotations Annotation rows by source designator.
     * @param {boolean} includeVariantDetails Whether to expose alternate metadata.
     * @returns {object}
     */
    static #applyBomDesignatorVariant(
        row,
        designator,
        parameterOverrides,
        alternateFitted,
        annotations,
        includeVariantDetails
    ) {
        const parameters = parameterOverrides[designator] || {}
        const alternate = alternateFitted[designator] || null
        const value =
            parameters.Comment ||
            parameters.Value ||
            alternate?.comment ||
            alternate?.description ||
            row.value

        return {
            ...row,
            designators: [
                ProjectVariantViewBuilder.#compiledDesignator(
                    designator,
                    annotations
                )
            ],
            ...(includeVariantDetails ? { sourceDesignator: designator } : {}),
            quantity: 1,
            value,
            source: alternate?.libReference || row.source,
            pattern: alternate?.footprint || row.pattern,
            parameters,
            ...(includeVariantDetails
                ? { alternateFitted: alternate || null }
                : {})
        }
    }

    /**
     * Applies DNP filtering metadata to normalized nets.
     * @param {object[]} nets Bundle nets.
     * @param {Set<string>} dnp DNP designators.
     * @param {Record<string, object>} annotations Annotation rows by source designator.
     * @returns {object[]}
     */
    static #applyNetVariant(nets, dnp, annotations) {
        return (nets || []).map((net) => {
            const excludedDesignators = []
            const pins = (net.pins || [])
                .filter((pin) => {
                    const designator =
                        pin.componentDesignator || pin.ownerIndex || ''
                    if (dnp.has(designator)) {
                        excludedDesignators.push(designator)
                        return false
                    }
                    return true
                })
                .map((pin) =>
                    ProjectVariantViewBuilder.#applyPinAnnotation(
                        pin,
                        annotations
                    )
                )

            return {
                ...net,
                pins,
                excludedDesignators:
                    ProjectVariantViewBuilder.#dedupe(excludedDesignators)
            }
        })
    }

    /**
     * Applies DNP and parameter metadata to one component entry.
     * @param {object} component Bundle component.
     * @param {Set<string>} dnp DNP designators.
     * @param {Record<string, Record<string, string>>} parameterOverrides Overrides by designator.
     * @param {Record<string, object>} alternateFitted Alternate fitted rows by designator.
     * @param {Record<string, object>} annotations Annotation rows by source designator.
     * @param {boolean} includeVariantDetails Whether to expose alternate metadata.
     * @returns {object}
     */
    static #applyComponentVariant(
        component,
        dnp,
        parameterOverrides,
        alternateFitted,
        annotations,
        includeVariantDetails
    ) {
        const alternate = alternateFitted[component.designator] || null
        return {
            designator: ProjectVariantViewBuilder.#compiledDesignator(
                component.designator,
                annotations
            ),
            ...(includeVariantDetails
                ? { sourceDesignator: component.designator }
                : {}),
            schematic: component.schematic,
            pcb: component.pcb,
            dnp: dnp.has(component.designator),
            parameters: parameterOverrides[component.designator] || {},
            ...(includeVariantDetails
                ? { alternateFitted: alternate || null }
                : {})
        }
    }

    /**
     * Applies an annotation row to one designator-bearing object.
     * @param {object} entry Source entry.
     * @param {Record<string, object>} annotations Annotation rows by source designator.
     * @returns {object}
     */
    static #applyDesignatorAnnotation(entry, annotations) {
        const compiledDesignator =
            ProjectVariantViewBuilder.#compiledDesignator(
                entry.designator,
                annotations
            )
        return compiledDesignator === entry.designator
            ? entry
            : {
                  ...entry,
                  sourceDesignator: entry.designator,
                  designator: compiledDesignator
              }
    }

    /**
     * Applies annotation mapping to one net pin.
     * @param {object} pin Net pin.
     * @param {Record<string, object>} annotations Annotation rows by source designator.
     * @returns {object}
     */
    static #applyPinAnnotation(pin, annotations) {
        const ownerIndex = String(pin?.ownerIndex || '')
        const componentDesignator = String(pin?.componentDesignator || '')
        const sourceDesignator = componentDesignator || ownerIndex
        const compiledDesignator =
            ProjectVariantViewBuilder.#compiledDesignator(
                sourceDesignator,
                annotations
            )

        if (compiledDesignator === sourceDesignator) {
            return pin
        }

        return {
            ...pin,
            sourceDesignator,
            ...(ownerIndex ? { ownerIndex: compiledDesignator } : {}),
            ...(componentDesignator
                ? { componentDesignator: compiledDesignator }
                : {})
        }
    }

    /**
     * Resolves a compiled designator for a source designator.
     * @param {string} designator Source designator.
     * @param {Record<string, object>} annotations Annotation rows by source designator.
     * @returns {string}
     */
    static #compiledDesignator(designator, annotations) {
        const key = String(designator || '').trim()
        return String(annotations?.[key]?.compiledDesignator || key)
    }

    /**
     * Checks whether an object has enumerable keys.
     * @param {object | undefined} value Candidate object.
     * @returns {boolean}
     */
    static #hasKeys(value) {
        return Object.keys(value || {}).length > 0
    }

    /**
     * Deduplicates values while preserving order.
     * @param {unknown[]} values Candidate values.
     * @returns {unknown[]}
     */
    static #dedupe(values) {
        return [...new Set((values || []).filter(Boolean))]
    }
}
