// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic host capability and fallback diagnostics.
 */
export class HostCapabilityDiagnosticsBuilder {
    static SCHEMA = 'altium-toolkit.host-capabilities.a1'

    /**
     * Builds a host capability diagnostics report.
     * @param {{ host?: object, capabilities?: Record<string, boolean>, fallbacks?: object[] }} options Diagnostics options.
     * @returns {object}
     */
    static build(options = {}) {
        const capabilities = HostCapabilityDiagnosticsBuilder.#capabilityRows(
            options.capabilities || {}
        )
        const diagnostics = [
            ...HostCapabilityDiagnosticsBuilder.#capabilityDiagnostics(
                capabilities
            ),
            ...HostCapabilityDiagnosticsBuilder.#fallbackDiagnostics(
                options.fallbacks || []
            )
        ]
        const readiness = HostCapabilityDiagnosticsBuilder.#readiness(
            options.readinessCategories || [],
            capabilities,
            diagnostics
        )

        return HostCapabilityDiagnosticsBuilder.#stripUndefined({
            schema: HostCapabilityDiagnosticsBuilder.SCHEMA,
            host: options.host || {},
            summary: HostCapabilityDiagnosticsBuilder.#stripUndefined({
                capabilityCount: capabilities.length,
                unsupportedCapabilityCount: capabilities.filter(
                    (capability) => !capability.supported
                ).length,
                fallbackCount: (options.fallbacks || []).length,
                readinessStatus: readiness?.status,
                readinessCategoryCount: readiness?.categories.length,
                warningCount: diagnostics.filter(
                    (diagnostic) => diagnostic.severity === 'warning'
                ).length
            }),
            capabilities,
            readiness,
            diagnostics
        })
    }

    /**
     * Builds sorted capability rows.
     * @param {Record<string, boolean>} capabilities Capability map.
     * @returns {object[]}
     */
    static #capabilityRows(capabilities) {
        return Object.keys(capabilities || {})
            .sort((left, right) =>
                left.localeCompare(right, undefined, { numeric: true })
            )
            .map((key) => {
                const supported = capabilities[key] === true
                return HostCapabilityDiagnosticsBuilder.#stripUndefined({
                    key,
                    supported,
                    diagnosticCode: supported
                        ? undefined
                        : HostCapabilityDiagnosticsBuilder.#capabilityCode(key)
                })
            })
    }

    /**
     * Builds diagnostics for unsupported capabilities.
     * @param {object[]} capabilities Capability rows.
     * @returns {object[]}
     */
    static #capabilityDiagnostics(capabilities) {
        return capabilities
            .filter((capability) => !capability.supported)
            .map((capability) => ({
                code: capability.diagnosticCode,
                severity: 'warning',
                capability: capability.key,
                message:
                    'Host capability ' + capability.key + ' is unavailable.'
            }))
    }

    /**
     * Builds diagnostics for caller-supplied fallback decisions.
     * @param {object[]} fallbacks Fallback rows.
     * @returns {object[]}
     */
    static #fallbackDiagnostics(fallbacks) {
        return (fallbacks || []).map((fallback) =>
            HostCapabilityDiagnosticsBuilder.#stripUndefined({
                ...fallback,
                code: fallback.code || 'host.fallback.used',
                severity: fallback.severity || 'info',
                message:
                    fallback.message ||
                    'Host fallback ' +
                        (fallback.code || 'host.fallback.used') +
                        ' was used.'
            })
        )
    }

    /**
     * Builds host support readiness groups.
     * @param {object[]} categories Readiness category descriptors.
     * @param {object[]} capabilities Capability rows.
     * @param {object[]} diagnostics Diagnostic rows.
     * @returns {object | undefined}
     */
    static #readiness(categories, capabilities, diagnostics) {
        if (!categories.length) {
            return undefined
        }

        const capabilityByKey = new Map(
            capabilities.map((capability) => [capability.key, capability])
        )
        const categoryRows = categories.map((category) =>
            HostCapabilityDiagnosticsBuilder.#readinessCategory(
                category,
                capabilityByKey,
                diagnostics
            )
        )

        return {
            status: HostCapabilityDiagnosticsBuilder.#readinessStatus(
                categoryRows
            ),
            categories: categoryRows
        }
    }

    /**
     * Builds one readiness category.
     * @param {object} category Category descriptor.
     * @param {Map<string, object>} capabilityByKey Capability lookup.
     * @param {object[]} diagnostics Diagnostic rows.
     * @returns {object}
     */
    static #readinessCategory(category, capabilityByKey, diagnostics) {
        const capabilityKeys = [...(category.capabilityKeys || [])]
        const capabilityRows = capabilityKeys
            .map((key) => capabilityByKey.get(key))
            .filter(Boolean)
        const unsupportedCapabilities = capabilityRows.filter(
            (capability) => !capability.supported
        )
        const categoryDiagnostics =
            HostCapabilityDiagnosticsBuilder.#categoryDiagnostics(
                category.key,
                unsupportedCapabilities,
                diagnostics
            )
        const fallbackCount = categoryDiagnostics.filter(
            (diagnostic) => diagnostic.category === category.key
        ).length

        return {
            key: category.key,
            displayName: category.displayName || category.key,
            status: HostCapabilityDiagnosticsBuilder.#categoryStatus(
                capabilityRows,
                fallbackCount
            ),
            capabilityKeys,
            supportedCapabilityCount: capabilityRows.filter(
                (capability) => capability.supported
            ).length,
            unsupportedCapabilityCount: unsupportedCapabilities.length,
            fallbackCount,
            diagnosticCodes: categoryDiagnostics.map(
                (diagnostic) => diagnostic.code
            )
        }
    }

    /**
     * Returns diagnostics related to one readiness category.
     * @param {string} categoryKey Category key.
     * @param {object[]} unsupportedCapabilities Unsupported capabilities.
     * @param {object[]} diagnostics Diagnostic rows.
     * @returns {object[]}
     */
    static #categoryDiagnostics(
        categoryKey,
        unsupportedCapabilities,
        diagnostics
    ) {
        const unsupportedCodes = new Set(
            unsupportedCapabilities.map(
                (capability) => capability.diagnosticCode
            )
        )

        return diagnostics.filter(
            (diagnostic) =>
                unsupportedCodes.has(diagnostic.code) ||
                diagnostic.category === categoryKey
        )
    }

    /**
     * Resolves one readiness category status.
     * @param {object[]} capabilityRows Capability rows.
     * @param {number} fallbackCount Fallback count.
     * @returns {'supported' | 'limited' | 'unsupported'}
     */
    static #categoryStatus(capabilityRows, fallbackCount) {
        const supportedCount = capabilityRows.filter(
            (capability) => capability.supported
        ).length
        const unsupportedCount = capabilityRows.length - supportedCount

        if (capabilityRows.length > 0 && supportedCount === 0) {
            return 'unsupported'
        }
        if (unsupportedCount > 0 || fallbackCount > 0) {
            return 'limited'
        }
        return 'supported'
    }

    /**
     * Resolves the aggregate readiness status.
     * @param {object[]} categories Readiness category rows.
     * @returns {'supported' | 'limited' | 'unsupported'}
     */
    static #readinessStatus(categories) {
        if (categories.every((category) => category.status === 'supported')) {
            return 'supported'
        }
        if (categories.every((category) => category.status === 'unsupported')) {
            return 'unsupported'
        }
        return 'limited'
    }

    /**
     * Builds the diagnostic code for an unsupported capability.
     * @param {string} key Capability key.
     * @returns {string}
     */
    static #capabilityCode(key) {
        return 'host.capability.' + key + '.unsupported'
    }

    /**
     * Removes undefined fields.
     * @param {Record<string, unknown>} value Candidate object.
     * @returns {Record<string, unknown>}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) => entryValue !== undefined
            )
        )
    }
}
