// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Classifies layer-stack source evidence and regeneration limits.
 */
export class PcbLayerStackFidelityReportBuilder {
    static SCHEMA_ID = 'altium-toolkit.pcb.layer-stack-fidelity.a1'

    /**
     * Builds a source-fidelity report for a layer-stack read model.
     * @param {object} readModel Layer-stack read model.
     * @returns {object}
     */
    static build(readModel) {
        const semanticSections =
            PcbLayerStackFidelityReportBuilder.#semanticSections(readModel)
        const nativeCacheSections =
            PcbLayerStackFidelityReportBuilder.#nativeCacheSections(readModel)
        const interchangeOnlySections =
            PcbLayerStackFidelityReportBuilder.#interchangeOnlySections(
                readModel
            )
        const diagnostics = readModel?.diagnostics || []
        const unsupportedRegeneration =
            PcbLayerStackFidelityReportBuilder.#unsupportedRegeneration(
                nativeCacheSections,
                diagnostics
            )

        return {
            schema: PcbLayerStackFidelityReportBuilder.SCHEMA_ID,
            sourceDocument: String(readModel?.source?.fileName || ''),
            summary: {
                semanticLayerCount: (readModel?.layers || []).length,
                nativeCacheFeatureCount: nativeCacheSections.length,
                interchangeOnlyFeatureCount: interchangeOnlySections.length,
                unsupportedRegenerationCount: unsupportedRegeneration.length,
                diagnosticCount: diagnostics.length
            },
            capabilities: {
                semanticRead: semanticSections.length > 0,
                nativeCacheRead: nativeCacheSections.length > 0,
                interchangeRead: interchangeOnlySections.length > 0,
                deterministicReport: true,
                nativeRegeneration: false
            },
            semanticSections,
            nativeCacheSections,
            interchangeOnlySections,
            unsupportedRegeneration,
            diagnostics
        }
    }

    /**
     * Lists semantic layer-stack sections in the model.
     * @param {object} readModel Layer-stack read model.
     * @returns {string[]}
     */
    static #semanticSections(readModel) {
        return [
            ['layers', readModel?.layers],
            ['substacks', readModel?.substacks],
            ['branches', readModel?.branches],
            ['impedanceProfiles', readModel?.impedanceProfiles]
        ]
            .filter(([, values]) => (values || []).length > 0)
            .map(([section]) => section)
    }

    /**
     * Lists native-cache-only sections represented in the model.
     * @param {object} readModel Layer-stack read model.
     * @returns {string[]}
     */
    static #nativeCacheSections(readModel) {
        const sections = []
        const sourceMap = readModel?.sourceMap || {}

        if (sourceMap.registryEntryCount > 0) sections.push('source.registry')
        if (sourceMap.sourceKeyCount > 0) sections.push('source.keys')
        if ((readModel?.topLevelBendLines || []).length > 0) {
            sections.push('bendLines')
        }
        if (sourceMap.cavityRegionCount > 0) sections.push('cavities')
        if (sourceMap.surfaceFinishCount > 0) sections.push('surfaceFinish')

        return sections
    }

    /**
     * Lists fields that are preserved as interchange-specific metadata.
     * @param {object} readModel Layer-stack read model.
     * @returns {string[]}
     */
    static #interchangeOnlySections(readModel) {
        const layers = readModel?.layers || []
        const sections = []

        if (layers.some((layer) => layer.stackupxShared !== undefined)) {
            sections.push('layers.stackupxShared')
        }
        if (
            layers.some(
                (layer) =>
                    Object.keys(layer.stackupxProperties || {}).length > 0
            )
        ) {
            sections.push('layers.stackupxProperties')
        }

        return sections
    }

    /**
     * Describes why native stack regeneration is intentionally unsupported.
     * @param {string[]} nativeCacheSections Native cache sections.
     * @param {object[]} diagnostics Read-model diagnostics.
     * @returns {object[]}
     */
    static #unsupportedRegeneration(nativeCacheSections, diagnostics) {
        const issues = []

        if (nativeCacheSections.length > 0) {
            issues.push({
                section: 'native-cache',
                reason: 'Native cache metadata is preserved for review but not regenerated.'
            })
        }
        if ((diagnostics || []).length > 0) {
            issues.push({
                section: 'diagnostics',
                reason: 'Unresolved references prevent equivalent native regeneration.'
            })
        }

        return issues
    }
}
