// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic QA reports across parsed schematic and PCB libraries.
 */
export class LibraryQaReportBuilder {
    static SCHEMA_ID = 'altium-toolkit.library.qa.a1'

    /**
     * Builds a read-only library QA report.
     * @param {{ schematicLibraries?: object[], pcbLibraries?: object[] }} options Library collections.
     * @returns {object}
     */
    static build(options = {}) {
        const schematicLibraries = options.schematicLibraries || []
        const pcbLibraries = options.pcbLibraries || []
        const duplicateSymbols =
            LibraryQaReportBuilder.#duplicateSymbols(schematicLibraries)
        const duplicateFootprints =
            LibraryQaReportBuilder.#duplicateFootprints(pcbLibraries)
        const staleImplementations =
            LibraryQaReportBuilder.#staleImplementations(
                schematicLibraries,
                pcbLibraries
            )
        const missingModels =
            LibraryQaReportBuilder.#missingModels(pcbLibraries)
        const multipartMismatches =
            LibraryQaReportBuilder.#multipartMismatches(schematicLibraries)
        const mergePlan =
            LibraryQaReportBuilder.#schematicLibraryMergePlan(
                schematicLibraries
            )
        const issues = [
            ...duplicateSymbols.map((issue) =>
                LibraryQaReportBuilder.#issue(
                    'library.duplicate-symbol',
                    issue.name
                )
            ),
            ...duplicateFootprints.map((issue) =>
                LibraryQaReportBuilder.#issue(
                    'library.duplicate-footprint',
                    issue.name
                )
            ),
            ...staleImplementations.map((issue) =>
                LibraryQaReportBuilder.#issue(
                    'library.stale-implementation',
                    issue.symbolName
                )
            ),
            ...missingModels.map((issue) =>
                LibraryQaReportBuilder.#issue(
                    'library.missing-model',
                    issue.footprintName
                )
            ),
            ...multipartMismatches.map((issue) =>
                LibraryQaReportBuilder.#issue(
                    'library.multipart-mismatch',
                    issue.symbolName
                )
            ),
            ...mergePlan.diagnostics.map((diagnostic) =>
                LibraryQaReportBuilder.#issue(
                    diagnostic.code,
                    diagnostic.symbolName
                )
            )
        ]

        return {
            schema: LibraryQaReportBuilder.SCHEMA_ID,
            summary: {
                schematicLibraryCount: schematicLibraries.length,
                pcbLibraryCount: pcbLibraries.length,
                duplicateSymbolCount: duplicateSymbols.length,
                duplicateFootprintCount: duplicateFootprints.length,
                staleImplementationCount: staleImplementations.length,
                missingModelCount: missingModels.length,
                multipartMismatchCount: multipartMismatches.length,
                mergePlanConflictCount: mergePlan.summary.conflictCount,
                issueCount: issues.length
            },
            duplicates: {
                symbols: duplicateSymbols,
                footprints: duplicateFootprints
            },
            staleImplementations,
            missingModels,
            multipartMismatches,
            mergePlan,
            issues
        }
    }

    /**
     * Finds duplicate schematic symbols by name.
     * @param {object[]} libraries Schematic library models.
     * @returns {object[]}
     */
    static #duplicateSymbols(libraries) {
        const byName = new Map()

        for (const library of libraries || []) {
            const fileName = library.fileName || ''
            for (const [index, symbol] of (
                library.schematicLibrary?.symbols || []
            ).entries()) {
                const name = String(symbol.name || '').trim()
                if (!name) continue
                byName.set(name, [
                    ...(byName.get(name) || []),
                    { libraryFileName: fileName, index }
                ])
            }
        }

        return [...byName.entries()]
            .filter(([, occurrences]) => occurrences.length > 1)
            .map(([name, occurrences]) => ({ name, occurrences }))
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    /**
     * Finds duplicate PCB footprints and classifies shape collisions.
     * @param {object[]} libraries PCB library models.
     * @returns {object[]}
     */
    static #duplicateFootprints(libraries) {
        const byName = new Map()

        for (const library of libraries || []) {
            const fileName = library.fileName || ''
            for (const [index, footprint] of (
                library.pcbLibrary?.footprints || []
            ).entries()) {
                const name = String(footprint.name || '').trim()
                if (!name) continue
                byName.set(name, [
                    ...(byName.get(name) || []),
                    {
                        libraryFileName: fileName,
                        index,
                        padCount: (footprint.pads || []).length
                    }
                ])
            }
        }

        return [...byName.entries()]
            .filter(([, occurrences]) => occurrences.length > 1)
            .map(([name, occurrences]) => ({
                name,
                occurrences,
                collisionKind:
                    LibraryQaReportBuilder.#footprintCollisionKind(occurrences)
            }))
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    /**
     * Finds implementation rows that target absent PCB library files.
     * @param {object[]} schematicLibraries Schematic libraries.
     * @param {object[]} pcbLibraries PCB libraries.
     * @returns {object[]}
     */
    static #staleImplementations(schematicLibraries, pcbLibraries) {
        const availablePcbLibraries = new Set(
            (pcbLibraries || []).map((library) => library.fileName || '')
        )
        const issues = []

        for (const library of schematicLibraries || []) {
            for (const symbol of library.schematicLibrary?.symbols || []) {
                for (const implementation of symbol.implementations || []) {
                    const targetLibraries = implementation.targetLibraries || []
                    const hasMissingTarget = targetLibraries.some(
                        (target) => !availablePcbLibraries.has(target)
                    )
                    if (!hasMissingTarget) continue
                    issues.push({
                        libraryFileName: library.fileName || '',
                        symbolName: symbol.name || '',
                        modelName: implementation.modelName || '',
                        targetLibraries,
                        reason: 'target library was not present in the scanned collection'
                    })
                }
            }
        }

        return issues
    }

    /**
     * Finds footprint component bodies that reference missing embedded models.
     * @param {object[]} pcbLibraries PCB libraries.
     * @returns {object[]}
     */
    static #missingModels(pcbLibraries) {
        const issues = []

        for (const library of pcbLibraries || []) {
            for (const footprint of library.pcbLibrary?.footprints || []) {
                const modelIds = new Set(
                    (footprint.embeddedModels || []).map((model) =>
                        String(model.id || model.modelId || '')
                    )
                )
                for (const body of footprint.componentBodies || []) {
                    const modelId = String(body.modelId || body.id || '')
                    if (!modelId || modelIds.has(modelId)) continue
                    issues.push({
                        libraryFileName: library.fileName || '',
                        footprintName: footprint.name || '',
                        modelId,
                        reason: 'component body references an embedded model that is absent'
                    })
                }
            }
        }

        return issues
    }

    /**
     * Finds multipart symbols whose part ids skip expected alphabetical parts.
     * @param {object[]} schematicLibraries Schematic libraries.
     * @returns {object[]}
     */
    static #multipartMismatches(schematicLibraries) {
        const issues = []

        for (const library of schematicLibraries || []) {
            for (const symbol of library.schematicLibrary?.symbols || []) {
                const partIds = (symbol.parts || [])
                    .map((part) => String(part.partId || '').trim())
                    .filter(Boolean)
                if (partIds.length < 2) continue
                const expectedPartIds = LibraryQaReportBuilder.#expectedPartIds(
                    partIds.length
                )
                if (partIds.join('\u0000') === expectedPartIds.join('\u0000')) {
                    continue
                }
                issues.push({
                    libraryFileName: library.fileName || '',
                    symbolName: symbol.name || '',
                    partIds,
                    expectedPartIds
                })
            }
        }

        return issues
    }

    /**
     * Builds a read-only merge plan for schematic libraries.
     * @param {object[]} schematicLibraries Schematic library models.
     * @returns {object}
     */
    static #schematicLibraryMergePlan(schematicLibraries) {
        const duplicateSymbols =
            LibraryQaReportBuilder.#mergePlanDuplicateSymbols(
                schematicLibraries
            )
        const embeddedAssets =
            LibraryQaReportBuilder.#mergePlanEmbeddedAssets(schematicLibraries)
        const fontDependencies =
            LibraryQaReportBuilder.#mergePlanFontDependencies(
                schematicLibraries
            )
        const diagnostics = duplicateSymbols
            .filter(
                (duplicate) => duplicate.conflictKind === 'conflicting-symbol'
            )
            .map((duplicate) => ({
                code: 'library.merge-plan.conflicting-symbol',
                severity: 'warning',
                symbolName: duplicate.name
            }))

        return {
            schema: 'altium-toolkit.library.merge-plan.a1',
            strategy: 'read-only-analysis',
            summary: {
                duplicateNameCount: duplicateSymbols.length,
                conflictCount: diagnostics.length,
                renameSuggestionCount: duplicateSymbols.reduce(
                    (count, duplicate) =>
                        count +
                        Math.max(duplicate.suggestedNames.length - 1, 0),
                    0
                ),
                embeddedAssetCount: embeddedAssets.length,
                fontDependencyCount: fontDependencies.length
            },
            duplicateSymbols,
            embeddedAssets,
            fontDependencies,
            diagnostics
        }
    }

    /**
     * Builds duplicate-symbol merge-plan rows.
     * @param {object[]} schematicLibraries Schematic libraries.
     * @returns {object[]}
     */
    static #mergePlanDuplicateSymbols(schematicLibraries) {
        const byName = new Map()

        for (const library of schematicLibraries || []) {
            const fileName = library.fileName || ''
            for (const [index, symbol] of (
                library.schematicLibrary?.symbols || []
            ).entries()) {
                const name = String(symbol.name || '').trim()
                if (!name) continue
                byName.set(name, [
                    ...(byName.get(name) || []),
                    LibraryQaReportBuilder.#mergePlanSymbolOccurrence(
                        fileName,
                        index,
                        symbol
                    )
                ])
            }
        }

        return [...byName.entries()]
            .filter(([, occurrences]) => occurrences.length > 1)
            .map(([name, occurrences]) => {
                const differences =
                    LibraryQaReportBuilder.#mergePlanDifferences(occurrences)
                return {
                    name,
                    conflictKind: Object.keys(differences).length
                        ? 'conflicting-symbol'
                        : 'duplicate-name',
                    suggestedNames: occurrences.map((occurrence, index) => ({
                        libraryFileName: occurrence.libraryFileName,
                        index: occurrence.index,
                        currentName: name,
                        suggestedName:
                            index === 0 ? name : name + '_' + (index + 1)
                    })),
                    ...(Object.keys(differences).length ? { differences } : {}),
                    occurrences
                }
            })
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    /**
     * Builds one duplicate-symbol occurrence summary.
     * @param {string} libraryFileName Library file name.
     * @param {number} index Symbol index.
     * @param {object} symbol Symbol row.
     * @returns {object}
     */
    static #mergePlanSymbolOccurrence(libraryFileName, index, symbol) {
        return {
            libraryFileName,
            index,
            pinCount: (symbol.pins || []).length,
            partCount: (symbol.parts || []).length,
            displayModeCount: (
                symbol.displayModes ||
                symbol.displayModeCatalog ||
                []
            ).length
        }
    }

    /**
     * Builds differing-count metadata for duplicate symbols.
     * @param {object[]} occurrences Duplicate occurrences.
     * @returns {object}
     */
    static #mergePlanDifferences(occurrences) {
        return LibraryQaReportBuilder.#stripEmpty({
            pinCounts: LibraryQaReportBuilder.#differingCounts(
                occurrences,
                'pinCount'
            ),
            partCounts: LibraryQaReportBuilder.#differingCounts(
                occurrences,
                'partCount'
            ),
            displayModeCounts: LibraryQaReportBuilder.#differingCounts(
                occurrences,
                'displayModeCount'
            )
        })
    }

    /**
     * Returns differing values for one occurrence count key.
     * @param {object[]} occurrences Occurrence rows.
     * @param {string} key Count key.
     * @returns {number[] | undefined}
     */
    static #differingCounts(occurrences, key) {
        const values = (occurrences || []).map((occurrence) => occurrence[key])
        return new Set(values).size > 1 ? values : undefined
    }

    /**
     * Lists embedded assets referenced by schematic symbols.
     * @param {object[]} schematicLibraries Schematic libraries.
     * @returns {object[]}
     */
    static #mergePlanEmbeddedAssets(schematicLibraries) {
        return (schematicLibraries || []).flatMap((library) =>
            (library.schematicLibrary?.symbols || []).flatMap((symbol) =>
                (symbol.embeddedAssets || symbol.images || []).map((asset) =>
                    LibraryQaReportBuilder.#stripEmpty({
                        libraryFileName: library.fileName || '',
                        symbolName: symbol.name || '',
                        ...asset
                    })
                )
            )
        )
    }

    /**
     * Lists schematic-library font dependencies.
     * @param {object[]} schematicLibraries Schematic libraries.
     * @returns {object[]}
     */
    static #mergePlanFontDependencies(schematicLibraries) {
        return (schematicLibraries || []).flatMap((library) =>
            (
                library.schematicLibrary?.fonts ||
                library.schematicLibrary?.embeddedFonts ||
                []
            ).map((font) =>
                LibraryQaReportBuilder.#stripEmpty({
                    libraryFileName: library.fileName || '',
                    ...font
                })
            )
        )
    }

    /**
     * Classifies whether duplicate footprints appear equivalent.
     * @param {{ padCount: number }[]} occurrences Footprint occurrences.
     * @returns {string}
     */
    static #footprintCollisionKind(occurrences) {
        const padCounts = new Set(
            (occurrences || []).map((occurrence) => occurrence.padCount)
        )

        return padCounts.size > 1 ? 'conflicting-footprint' : 'duplicate-name'
    }

    /**
     * Builds expected alphabetical part ids.
     * @param {number} count Part count.
     * @returns {string[]}
     */
    static #expectedPartIds(count) {
        return Array.from({ length: count }, (_value, index) =>
            String.fromCharCode(65 + index)
        )
    }

    /**
     * Builds a compact issue entry for summary consumers.
     * @param {string} code Diagnostic code.
     * @param {string} target Target object name.
     * @returns {object}
     */
    static #issue(code, target) {
        return {
            code,
            severity: 'warning',
            target
        }
    }

    /**
     * Removes undefined and empty-string fields.
     * @param {Record<string, unknown>} value Source object.
     * @returns {object}
     */
    static #stripEmpty(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(
                ([, entryValue]) =>
                    entryValue !== undefined && entryValue !== ''
            )
        )
    }
}
