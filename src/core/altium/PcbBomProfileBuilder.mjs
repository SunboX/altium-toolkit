// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds PCB-only BOM grouping and parameter-normalization profiles.
 */
export class PcbBomProfileBuilder {
    static SCHEMA_ID = 'altium-toolkit.pcb.bom-profile.a1'

    /**
     * Builds a deterministic BOM profile from PCB component rows.
     * @param {object[]} components Normalized PCB component rows.
     * @param {{ source?: string }} options Build options.
     * @returns {object}
     */
    static build(components, options = {}) {
        const normalizedComponents = (components || []).map((component) =>
            PcbBomProfileBuilder.#component(component)
        )
        const included = normalizedComponents.filter(
            (component) => component.includeInBom
        )
        const groups = PcbBomProfileBuilder.#groups(included)
        const exclusions = normalizedComponents
            .filter((component) => !component.includeInBom)
            .map((component) => ({
                designator: component.designator,
                reason: 'component-kind:no-bom'
            }))

        return {
            schema: PcbBomProfileBuilder.SCHEMA_ID,
            source: String(options.source || 'pcb-document'),
            summary: {
                componentCount: normalizedComponents.length,
                includedComponentCount: included.length,
                excludedComponentCount: exclusions.length,
                groupCount: groups.length,
                normalizedParameterCount:
                    PcbBomProfileBuilder.#normalizedParameterCount(included)
            },
            groups,
            components: normalizedComponents,
            exclusions
        }
    }

    /**
     * Normalizes one component into a BOM profile row.
     * @param {object} component Source component.
     * @returns {object}
     */
    static #component(component) {
        const normalizedParameters = PcbBomProfileBuilder.#normalizedParameters(
            component?.parameters || {}
        )
        const sourceParameterNames = Object.keys(component?.parameters || {})
        const includeInBom =
            component?.componentKind?.includeInBom === false ? false : true
        const value =
            normalizedParameters.comment ||
            component?.description ||
            component?.value ||
            component?.pattern ||
            ''

        return {
            designator: String(component?.designator || ''),
            includeInBom,
            componentKind: component?.componentKind?.name || 'standard',
            pattern: String(component?.pattern || ''),
            source: String(component?.source || ''),
            value,
            normalizedParameters,
            sourceParameterNames
        }
    }

    /**
     * Builds grouped BOM rows from included components.
     * @param {object[]} components Included normalized components.
     * @returns {object[]}
     */
    static #groups(components) {
        const byKey = new Map()

        for (const component of components || []) {
            const key = PcbBomProfileBuilder.#groupKey(component)
            if (!byKey.has(key)) {
                byKey.set(key, {
                    key,
                    quantity: 0,
                    designators: [],
                    pattern: component.pattern,
                    source: component.source,
                    value: component.value,
                    normalizedParameters: {}
                })
            }
            const group = byKey.get(key)
            group.quantity += 1
            group.designators.push(component.designator)
            group.normalizedParameters = PcbBomProfileBuilder.#mergeParameters(
                group.normalizedParameters,
                component.normalizedParameters
            )
        }

        return [...byKey.values()].map((group) => ({
            ...group,
            designators: PcbBomProfileBuilder.#sortDesignators(
                group.designators
            ),
            normalizedParameters:
                PcbBomProfileBuilder.#stripGroupingOnlyParameters(
                    group.normalizedParameters
                )
        }))
    }

    /**
     * Builds the stable grouping key for one included component.
     * @param {object} component Normalized component row.
     * @returns {string}
     */
    static #groupKey(component) {
        const parameters = component.normalizedParameters || {}
        return [
            parameters.manufacturer || '',
            parameters.manufacturerPartNumber || '',
            parameters.supplierPartNumber || '',
            component.pattern || '',
            component.value || ''
        ].join('|')
    }

    /**
     * Converts source parameters into normalized BOM aliases.
     * @param {Record<string, string>} parameters Source parameters.
     * @returns {Record<string, string>}
     */
    static #normalizedParameters(parameters) {
        const normalized = {}

        for (const [name, value] of Object.entries(parameters || {})) {
            const text = String(value || '').trim()
            if (!text) continue

            const alias = PcbBomProfileBuilder.#aliasForName(name)
            if (alias && !normalized[alias]) {
                normalized[alias] = text
            }
            if (
                alias === 'supplierPartNumber' &&
                /jlcpcb/iu.test(String(name || '')) &&
                !normalized.supplier
            ) {
                normalized.supplier = 'JLCPCB'
            }
        }

        return normalized
    }

    /**
     * Resolves a normalized alias for a source parameter name.
     * @param {string} name Source parameter name.
     * @returns {string}
     */
    static #aliasForName(name) {
        const key = String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '')

        if (['manufacturer', 'mfr', 'mfg'].includes(key)) {
            return 'manufacturer'
        }
        if (
            [
                'manufacturerpartnumber',
                'manufacturerpn',
                'mfrpartnumber',
                'mfgpartnumber',
                'mpn'
            ].includes(key)
        ) {
            return 'manufacturerPartNumber'
        }
        if (
            [
                'supplierpartnumber',
                'supplierpn',
                'supplierpart',
                'jlcpcbpart',
                'jlcpcbpartnumber',
                'jlcpcbpartno'
            ].includes(key)
        ) {
            return 'supplierPartNumber'
        }
        if (key === 'category') return 'category'
        if (key === 'comment' || key === 'value') return 'comment'

        return ''
    }

    /**
     * Merges normalized parameters while preserving the first non-empty value.
     * @param {object} existing Existing values.
     * @param {object} incoming Candidate values.
     * @returns {object}
     */
    static #mergeParameters(existing, incoming) {
        const merged = { ...(existing || {}) }

        for (const [key, value] of Object.entries(incoming || {})) {
            if (merged[key] || value === undefined || value === '') continue
            merged[key] = value
        }

        return merged
    }

    /**
     * Removes fields that are component-specific rather than group identity.
     * @param {object} parameters Normalized parameters.
     * @returns {object}
     */
    static #stripGroupingOnlyParameters(parameters) {
        const { comment: _comment, ...rest } = parameters || {}
        return rest
    }

    /**
     * Counts normalized source aliases used for group identity.
     * @param {object[]} components Included component rows.
     * @returns {number}
     */
    static #normalizedParameterCount(components) {
        return (components || []).reduce(
            (count, component) =>
                count +
                Object.keys(component.normalizedParameters || {}).filter(
                    (key) => !['comment', 'supplier'].includes(key)
                ).length,
            0
        )
    }

    /**
     * Sorts designators in a stable natural-ish order.
     * @param {string[]} designators Designator list.
     * @returns {string[]}
     */
    static #sortDesignators(designators) {
        return (designators || []).slice().sort((left, right) =>
            String(left).localeCompare(String(right), undefined, {
                numeric: true
            })
        )
    }
}
