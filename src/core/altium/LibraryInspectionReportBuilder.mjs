// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { LibraryQaReportBuilder } from './LibraryQaReportBuilder.mjs'

/**
 * Builds deterministic inspection reports for schematic and PCB libraries.
 */
export class LibraryInspectionReportBuilder {
    static SCHEMA = 'altium-toolkit.library.inspection.a1'

    /**
     * Builds a library inspection report from parsed library models.
     * @param {{ schematicLibraries?: object[], pcbLibraries?: object[], qa?: object }} options Library collections.
     * @returns {object}
     */
    static build(options = {}) {
        const schematicLibraries = Array.isArray(options.schematicLibraries)
            ? options.schematicLibraries
            : []
        const pcbLibraries = Array.isArray(options.pcbLibraries)
            ? options.pcbLibraries
            : []
        const qa =
            options.qa ||
            LibraryQaReportBuilder.build({ schematicLibraries, pcbLibraries })
        const libraries = [
            ...schematicLibraries.map((library) =>
                LibraryInspectionReportBuilder.#schematicLibraryRow(library)
            ),
            ...pcbLibraries.map((library) =>
                LibraryInspectionReportBuilder.#pcbLibraryRow(library)
            )
        ]

        return {
            schema: LibraryInspectionReportBuilder.SCHEMA,
            summary: LibraryInspectionReportBuilder.#summary(
                schematicLibraries,
                pcbLibraries,
                libraries,
                qa
            ),
            libraries,
            qa: {
                schema: qa.schema,
                summary: qa.summary || {}
            },
            duplicates: qa.duplicates || {
                symbols: qa.duplicateSymbols || [],
                footprints: qa.duplicateFootprints || []
            },
            staleImplementations: qa.staleImplementations || [],
            missingModels: qa.missingModels || [],
            multipartMismatches: qa.multipartMismatches || [],
            libraryLint: qa.libraryLint || {
                summary: { issueCount: 0 },
                issues: []
            },
            mergePlan: qa.mergePlan || {},
            issues: qa.issues || []
        }
    }

    /**
     * Builds one schematic-library inventory row.
     * @param {object} library Schematic library model.
     * @returns {object}
     */
    static #schematicLibraryRow(library) {
        const symbols = Array.isArray(library?.schematicLibrary?.symbols)
            ? library.schematicLibrary.symbols
            : []

        return {
            fileName: library?.fileName || '',
            kind: 'schematic-library',
            symbolCount: symbols.length,
            pinCount: symbols.reduce(
                (total, symbol) =>
                    total +
                    (Array.isArray(symbol?.pins) ? symbol.pins.length : 0),
                0
            )
        }
    }

    /**
     * Builds one PCB-library inventory row.
     * @param {object} library PCB library model.
     * @returns {object}
     */
    static #pcbLibraryRow(library) {
        const footprints = Array.isArray(library?.pcbLibrary?.footprints)
            ? library.pcbLibrary.footprints
            : []

        return {
            fileName: library?.fileName || '',
            kind: 'pcb-library',
            footprintCount: footprints.length,
            padCount: footprints.reduce(
                (total, footprint) =>
                    total +
                    (Array.isArray(footprint?.pads)
                        ? footprint.pads.length
                        : 0),
                0
            )
        }
    }

    /**
     * Builds top-level inspection summary counters.
     * @param {object[]} schematicLibraries Schematic libraries.
     * @param {object[]} pcbLibraries PCB libraries.
     * @param {object[]} libraries Inventory rows.
     * @param {object} qa Library QA report.
     * @returns {object}
     */
    static #summary(schematicLibraries, pcbLibraries, libraries, qa) {
        const qaSummary = qa.summary || {}

        return {
            schematicLibraryCount: schematicLibraries.length,
            pcbLibraryCount: pcbLibraries.length,
            libraryCount: libraries.length,
            symbolCount: libraries.reduce(
                (total, library) => total + Number(library.symbolCount || 0),
                0
            ),
            footprintCount: libraries.reduce(
                (total, library) => total + Number(library.footprintCount || 0),
                0
            ),
            duplicateSymbolCount: Number(qaSummary.duplicateSymbolCount || 0),
            duplicateFootprintCount: Number(
                qaSummary.duplicateFootprintCount || 0
            ),
            staleImplementationCount: Number(
                qaSummary.staleImplementationCount || 0
            ),
            missingModelCount: Number(qaSummary.missingModelCount || 0),
            multipartMismatchCount: Number(
                qaSummary.multipartMismatchCount || 0
            ),
            mergePlanConflictCount: Number(
                qaSummary.mergePlanConflictCount || 0
            ),
            libraryLintIssueCount: Number(qaSummary.libraryLintIssueCount || 0),
            issueCount: Number(qaSummary.issueCount || 0),
            issuesBySeverity: qaSummary.issuesBySeverity || {}
        }
    }
}
