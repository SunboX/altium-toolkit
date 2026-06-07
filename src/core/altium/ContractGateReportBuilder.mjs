// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SvgModelCrossLinkValidator } from './SvgModelCrossLinkValidator.mjs'

/**
 * Builds deterministic contract-gate reports for CI artifact bundles.
 */
export class ContractGateReportBuilder {
    static SCHEMA = 'altium-toolkit.contract-gate.a1'

    /**
     * Builds a contract-gate report over normalized and rendered artifacts.
     * @param {{ documentModels?: object[], netlist?: { json?: object, wirelist?: string }, schematicSvgs?: object[], pcbLayerSvgs?: object[], diagnostics?: object[] }} options Gate input artifacts.
     * @returns {object}
     */
    static build(options = {}) {
        const documentModels = options.documentModels || []
        const svgLinkReports = ContractGateReportBuilder.#svgLinkReports(
            documentModels,
            options.schematicSvgs || [],
            options.pcbLayerSvgs || []
        )
        const gates = [
            ContractGateReportBuilder.#normalizedModelGate(documentModels),
            ContractGateReportBuilder.#netlistJsonGate(options.netlist?.json),
            ContractGateReportBuilder.#wirelistGate(options.netlist?.wirelist),
            ContractGateReportBuilder.#svgLinkageGate(svgLinkReports),
            ContractGateReportBuilder.#diagnosticsGate(
                options.diagnostics || []
            )
        ]
        const failingGateCount = gates.filter(
            (gate) => gate.status === 'fail'
        ).length

        return {
            schema: ContractGateReportBuilder.SCHEMA,
            status: failingGateCount > 0 ? 'fail' : 'pass',
            summary: {
                gateCount: gates.length,
                failingGateCount,
                documentCount: documentModels.length,
                svgLinkReportCount: svgLinkReports.length,
                diagnosticCount: (options.diagnostics || []).length
            },
            gates,
            svgLinkReports
        }
    }

    /**
     * Builds SVG link-validation reports for all rendered document outputs.
     * @param {object[]} documentModels Normalized document models.
     * @param {object[]} schematicSvgs Schematic SVG entries.
     * @param {object[]} pcbLayerSvgs PCB layer SVG entries.
     * @returns {object[]}
     */
    static #svgLinkReports(documentModels, schematicSvgs, pcbLayerSvgs) {
        return [
            ...ContractGateReportBuilder.#schematicSvgReports(
                documentModels,
                schematicSvgs
            ),
            ...ContractGateReportBuilder.#pcbLayerSvgReports(
                documentModels,
                pcbLayerSvgs
            )
        ]
    }

    /**
     * Builds schematic SVG link reports.
     * @param {object[]} documentModels Normalized document models.
     * @param {object[]} schematicSvgs Schematic SVG entries.
     * @returns {object[]}
     */
    static #schematicSvgReports(documentModels, schematicSvgs) {
        return (schematicSvgs || []).map((entry) => {
            const model = ContractGateReportBuilder.#modelForFileName(
                documentModels,
                entry.fileName
            )
            return ContractGateReportBuilder.#linkReport(
                entry.fileName,
                model,
                [entry.svg || '']
            )
        })
    }

    /**
     * Builds PCB layer SVG link reports as aggregate layer-view sets.
     * @param {object[]} documentModels Normalized document models.
     * @param {object[]} pcbLayerSvgs PCB layer SVG entries.
     * @returns {object[]}
     */
    static #pcbLayerSvgReports(documentModels, pcbLayerSvgs) {
        return (pcbLayerSvgs || []).map((entry) => {
            const model = ContractGateReportBuilder.#modelForFileName(
                documentModels,
                entry.fileName
            )
            return ContractGateReportBuilder.#linkReport(
                entry.fileName,
                model,
                (entry.layers || []).map((layer) => layer.svg || '')
            )
        })
    }

    /**
     * Builds one SVG link report.
     * @param {string} fileName Source file name.
     * @param {object | undefined} model Normalized model.
     * @param {string[]} svgMarkups SVG markup strings.
     * @returns {object}
     */
    static #linkReport(fileName, model, svgMarkups) {
        if (!model) {
            return {
                fileName,
                documentKind: 'unknown',
                status: 'fail',
                summary: {
                    missingElementCount: 0,
                    orphanElementCount: 0,
                    unresolvedReferenceCount: 1
                },
                missingElements: [],
                orphanElements: [],
                unresolvedReferences: [
                    {
                        referenceKind: 'document',
                        value: fileName
                    }
                ]
            }
        }

        const report = ContractGateReportBuilder.#normalizeLayerSetReport(
            SvgModelCrossLinkValidator.validateSet(model, svgMarkups),
            model,
            svgMarkups
        )
        const status =
            report.summary.missingElementCount > 0 ||
            report.summary.orphanElementCount > 0 ||
            report.summary.unresolvedReferenceCount > 0
                ? 'fail'
                : 'pass'

        return {
            fileName,
            documentKind: report.documentKind,
            status,
            summary: report.summary,
            missingElements: report.missingElements,
            orphanElements: report.orphanElements,
            unresolvedReferences: report.unresolvedReferences
        }
    }

    /**
     * Removes composite-only component omissions from PCB layer-set reports.
     * @param {object} report Raw SVG link report.
     * @param {object} model Normalized model.
     * @param {string[]} svgMarkups SVG markup strings.
     * @returns {object}
     */
    static #normalizeLayerSetReport(report, model, svgMarkups) {
        if (
            model?.kind !== 'pcb' ||
            !ContractGateReportBuilder.#isLayerSvgSet(svgMarkups)
        ) {
            return report
        }

        const missingElements = (report.missingElements || []).filter(
            (element) => element.collectionKey !== 'components'
        )

        return {
            ...report,
            summary: {
                ...report.summary,
                linkedElementCount:
                    Number(report.summary.expectedElementCount || 0) -
                    missingElements.length,
                missingElementCount: missingElements.length
            },
            missingElements
        }
    }

    /**
     * Returns true when all supplied SVGs are layer-view exports.
     * @param {string[]} svgMarkups SVG markup strings.
     * @returns {boolean}
     */
    static #isLayerSvgSet(svgMarkups) {
        return (
            (svgMarkups || []).length > 0 &&
            (svgMarkups || []).every((svgMarkup) =>
                String(svgMarkup || '').includes('data-view-kind="layer"')
            )
        )
    }

    /**
     * Builds the normalized-model gate.
     * @param {object[]} documentModels Normalized document models.
     * @returns {object}
     */
    static #normalizedModelGate(documentModels) {
        const failures = (documentModels || []).filter(
            (model) => !model?.schema || !model?.kind
        )

        return ContractGateReportBuilder.#gate({
            key: 'normalized-models',
            status: failures.length ? 'fail' : 'pass',
            checkedCount: documentModels.length,
            failureCount: failures.length
        })
    }

    /**
     * Builds the netlist JSON gate.
     * @param {object | undefined} netlistJson Netlist JSON payload.
     * @returns {object}
     */
    static #netlistJsonGate(netlistJson) {
        const pass =
            Boolean(netlistJson?.schema) && Array.isArray(netlistJson?.nets)

        return ContractGateReportBuilder.#gate({
            key: 'netlist-json',
            status: pass ? 'pass' : 'fail',
            checkedCount: pass ? 1 : 0,
            failureCount: pass ? 0 : 1
        })
    }

    /**
     * Builds the wirelist gate.
     * @param {string | undefined} wirelist Wirelist text.
     * @returns {object}
     */
    static #wirelistGate(wirelist) {
        const pass = typeof wirelist === 'string'

        return ContractGateReportBuilder.#gate({
            key: 'wirelist',
            status: pass ? 'pass' : 'fail',
            checkedCount: pass ? 1 : 0,
            failureCount: pass ? 0 : 1
        })
    }

    /**
     * Builds the SVG linkage gate.
     * @param {object[]} svgLinkReports SVG link reports.
     * @returns {object}
     */
    static #svgLinkageGate(svgLinkReports) {
        const failingReports = (svgLinkReports || []).filter(
            (report) => report.status === 'fail'
        )

        return ContractGateReportBuilder.#gate({
            key: 'svg-linkage',
            status: failingReports.length ? 'fail' : 'pass',
            checkedCount: svgLinkReports.length,
            failureCount: failingReports.length,
            missingElementCount: ContractGateReportBuilder.#sumSummary(
                svgLinkReports,
                'missingElementCount'
            ),
            orphanElementCount: ContractGateReportBuilder.#sumSummary(
                svgLinkReports,
                'orphanElementCount'
            ),
            unresolvedReferenceCount: ContractGateReportBuilder.#sumSummary(
                svgLinkReports,
                'unresolvedReferenceCount'
            )
        })
    }

    /**
     * Builds the diagnostics gate.
     * @param {object[]} diagnostics Diagnostic rows.
     * @returns {object}
     */
    static #diagnosticsGate(diagnostics) {
        const errorCount = (diagnostics || []).filter(
            (diagnostic) => diagnostic.severity === 'error'
        ).length

        return ContractGateReportBuilder.#gate({
            key: 'diagnostics',
            status: errorCount ? 'fail' : 'pass',
            checkedCount: diagnostics.length,
            failureCount: errorCount,
            warningCount: diagnostics.filter(
                (diagnostic) => diagnostic.severity === 'warning'
            ).length,
            errorCount
        })
    }

    /**
     * Finds a normalized model by file name.
     * @param {object[]} documentModels Normalized document models.
     * @param {string} fileName Source file name.
     * @returns {object | undefined}
     */
    static #modelForFileName(documentModels, fileName) {
        return (documentModels || []).find(
            (model) => model?.fileName === fileName
        )
    }

    /**
     * Sums one SVG link report summary field.
     * @param {object[]} reports SVG link reports.
     * @param {string} field Summary field.
     * @returns {number}
     */
    static #sumSummary(reports, field) {
        return (reports || []).reduce(
            (total, report) => total + Number(report.summary?.[field] || 0),
            0
        )
    }

    /**
     * Removes undefined gate fields.
     * @param {object} gate Gate row.
     * @returns {object}
     */
    static #gate(gate) {
        return Object.fromEntries(
            Object.entries(gate || {}).filter(
                ([, value]) => value !== undefined
            )
        )
    }
}
