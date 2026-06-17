// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbClassReportBuilder } from './PcbClassReportBuilder.mjs'
import { PcbDimensionReportBuilder } from './PcbDimensionReportBuilder.mjs'
import { PcbFabricationReadinessReportBuilder } from './PcbFabricationReadinessReportBuilder.mjs'
import { PcbNetMembershipReportBuilder } from './PcbNetMembershipReportBuilder.mjs'
import { PcbReviewMetadataBuilder } from './PcbReviewMetadataBuilder.mjs'
import { PcbRouteAnalysisBuilder } from './PcbRouteAnalysisBuilder.mjs'
import { PcbRuleImpactReportBuilder } from './PcbRuleImpactReportBuilder.mjs'
import { PcbStatisticsBuilder } from './PcbStatisticsBuilder.mjs'

/**
 * Builds one deterministic inspection artifact for normalized PCB models.
 */
export class PcbInspectionReportBuilder {
    static SCHEMA = 'altium-toolkit.pcb.inspection.a1'

    /**
     * Builds a PCB inspection report from a parser root or normalized PCB model.
     * @param {object} input Parser root, PCB model, or options object.
     * @returns {object}
     */
    static build(input = {}) {
        const pcb = PcbInspectionReportBuilder.#pcb(input)
        const diagnostics = PcbInspectionReportBuilder.#diagnostics(input, pcb)
        const statistics =
            input.statistics ||
            pcb.statistics ||
            PcbStatisticsBuilder.build(pcb)
        const routeAnalysis =
            input.routeAnalysis ||
            pcb.routeAnalysis ||
            PcbRouteAnalysisBuilder.build(pcb)
        const netMembership =
            input.netMembership ||
            pcb.netMembership ||
            PcbNetMembershipReportBuilder.build(pcb)
        const classes =
            input.classReport ||
            pcb.classReport ||
            PcbClassReportBuilder.build(pcb)
        const dimensions =
            input.dimensionReport ||
            pcb.dimensionReport ||
            PcbDimensionReportBuilder.build(pcb)
        const ruleImpact =
            input.ruleImpact ||
            pcb.ruleImpact ||
            PcbRuleImpactReportBuilder.build(pcb)
        const reviewMetadata =
            input.reviewMetadata ||
            pcb.reviewMetadata ||
            PcbReviewMetadataBuilder.build({
                ...pcb,
                routeAnalysis
            })
        const fabricationReadiness =
            input.fabricationReadiness ||
            pcb.fabricationReadiness ||
            PcbFabricationReadinessReportBuilder.build(pcb)
        const rules = PcbInspectionReportBuilder.#rules(pcb?.rules || [])
        const primitives = PcbInspectionReportBuilder.#primitives(pcb)
        const diagnosticSummary =
            PcbInspectionReportBuilder.#diagnosticSummary(diagnostics)
        const summary = PcbInspectionReportBuilder.#summary({
            input,
            statistics,
            pcb,
            primitives,
            rules,
            diagnosticSummary,
            netMembership,
            classes,
            dimensions,
            ruleImpact,
            reviewMetadata,
            fabricationReadiness
        })

        return {
            schema: PcbInspectionReportBuilder.SCHEMA,
            units: statistics.units || {
                coordinate: 'mil',
                length: 'mil',
                board: 'mil'
            },
            summary,
            board: statistics.board || {},
            statistics,
            primitives,
            rules,
            diagnostics: {
                summary: diagnosticSummary,
                items: diagnostics.map((diagnostic) =>
                    PcbInspectionReportBuilder.#diagnosticRow(diagnostic)
                )
            },
            netMembership,
            classes,
            dimensions: {
                schema: dimensions.schema,
                summary: dimensions.summary || {}
            },
            ruleImpact: {
                schema: ruleImpact.schema,
                summary: ruleImpact.summary || {}
            },
            reviewMetadata: {
                schema: reviewMetadata.schema,
                summary: reviewMetadata.summary || {}
            },
            fabricationReadiness: {
                schema: fabricationReadiness.schema,
                summary: fabricationReadiness.summary || {}
            },
            routeAnalysis: {
                schema: routeAnalysis.schema,
                summary: routeAnalysis.summary || {}
            }
        }
    }

    /**
     * Resolves the PCB payload from a parser root or direct PCB model.
     * @param {object} input Parser root or PCB model.
     * @returns {object}
     */
    static #pcb(input) {
        return input?.pcb || input || {}
    }

    /**
     * Resolves diagnostics from the root or PCB object.
     * @param {object} input Parser root or options object.
     * @param {object} pcb Normalized PCB model.
     * @returns {object[]}
     */
    static #diagnostics(input, pcb) {
        if (Array.isArray(input?.diagnostics)) {
            return input.diagnostics
        }
        if (Array.isArray(pcb?.diagnostics)) {
            return pcb.diagnostics
        }

        return []
    }

    /**
     * Builds primitive-family counters.
     * @param {object} pcb Normalized PCB model.
     * @returns {object}
     */
    static #primitives(pcb) {
        const families = [
            'pads',
            'tracks',
            'arcs',
            'vias',
            'fills',
            'regions',
            'shapeBasedRegions',
            'polygons',
            'texts',
            'boardRegions'
        ]
        const counts = Object.fromEntries(
            families.map((family) => [
                family + 'Count',
                Array.isArray(pcb?.[family]) ? pcb[family].length : 0
            ])
        )
        const primitiveCount = [
            'padsCount',
            'tracksCount',
            'arcsCount',
            'viasCount',
            'fillsCount',
            'regionsCount',
            'shapeBasedRegionsCount',
            'polygonsCount'
        ].reduce((total, key) => total + Number(counts[key] || 0), 0)

        return {
            ...counts,
            componentCount: Array.isArray(pcb?.components)
                ? pcb.components.length
                : 0,
            primitiveCount
        }
    }

    /**
     * Builds design-rule counters by kind.
     * @param {object[]} rules Design-rule rows.
     * @returns {object}
     */
    static #rules(rules) {
        const counts = new Map()

        for (const rule of Array.isArray(rules) ? rules : []) {
            const kind = PcbInspectionReportBuilder.#ruleKind(rule)
            counts.set(kind, Number(counts.get(kind) || 0) + 1)
        }

        return {
            count: Array.isArray(rules) ? rules.length : 0,
            byKind: [...counts.entries()]
                .map(([kind, count]) => ({ kind, count }))
                .sort((left, right) =>
                    PcbInspectionReportBuilder.#naturalCompare(
                        left.kind,
                        right.kind
                    )
                )
        }
    }

    /**
     * Resolves one design-rule kind label.
     * @param {object} rule Design-rule row.
     * @returns {string}
     */
    static #ruleKind(rule) {
        const kind = String(
            rule?.kind ||
                rule?.ruleKind ||
                rule?.kindName ||
                rule?.type ||
                'unknown'
        ).trim()

        return kind || 'unknown'
    }

    /**
     * Builds diagnostic severity counters.
     * @param {object[]} diagnostics Diagnostic rows.
     * @returns {object}
     */
    static #diagnosticSummary(diagnostics) {
        const rows = Array.isArray(diagnostics) ? diagnostics : []

        return {
            diagnosticCount: rows.length,
            errorCount: rows.filter(
                (diagnostic) =>
                    PcbInspectionReportBuilder.#severity(diagnostic) === 'error'
            ).length,
            warningCount: rows.filter(
                (diagnostic) =>
                    PcbInspectionReportBuilder.#severity(diagnostic) ===
                    'warning'
            ).length,
            infoCount: rows.filter(
                (diagnostic) =>
                    PcbInspectionReportBuilder.#severity(diagnostic) === 'info'
            ).length
        }
    }

    /**
     * Builds one normalized diagnostic row.
     * @param {object} diagnostic Diagnostic row.
     * @returns {object}
     */
    static #diagnosticRow(diagnostic) {
        return PcbInspectionReportBuilder.#stripEmpty({
            severity: PcbInspectionReportBuilder.#severity(diagnostic),
            code: diagnostic?.code,
            message: diagnostic?.message,
            source: diagnostic?.source,
            errorKind: diagnostic?.errorKind
        })
    }

    /**
     * Resolves diagnostic severity.
     * @param {object} diagnostic Diagnostic row.
     * @returns {string}
     */
    static #severity(diagnostic) {
        const severity = String(diagnostic?.severity || '')
            .trim()
            .toLowerCase()
        if (['error', 'warning', 'info'].includes(severity)) {
            return severity
        }

        return 'info'
    }

    /**
     * Builds the top-level inspection summary.
     * @param {object} parts Report parts.
     * @returns {object}
     */
    static #summary(parts) {
        const board = parts.statistics.board || {}
        const reviewItemCount =
            parts.diagnosticSummary.errorCount +
            parts.diagnosticSummary.warningCount +
            Number(parts.netMembership.summary.undeclaredNetCount || 0) +
            Number(parts.netMembership.summary.unownedPrimitiveCount || 0) +
            Number(parts.classes.summary.unresolvedMemberCount || 0) +
            Number(parts.dimensions.summary.unresolvedCount || 0) +
            Number(parts.fabricationReadiness.summary.reviewItemCount || 0)

        return {
            fileName: parts.input.fileName || '',
            status: reviewItemCount > 0 ? 'needs-review' : 'clean',
            boardWidthMil: board.widthMil || 0,
            boardHeightMil: board.heightMil || 0,
            layerCount: Array.isArray(parts.pcb?.layers)
                ? parts.pcb.layers.length
                : Number(parts.statistics.layers?.count || 0),
            netCount: Array.isArray(parts.pcb?.nets)
                ? parts.pcb.nets.length
                : Number(parts.netMembership.summary.declaredNetCount || 0),
            componentCount: parts.primitives.componentCount,
            primitiveCount: parts.primitives.primitiveCount,
            ruleCount: parts.rules.count,
            diagnosticCount: parts.diagnosticSummary.diagnosticCount,
            errorCount: parts.diagnosticSummary.errorCount,
            warningCount: parts.diagnosticSummary.warningCount,
            possibleUnroutedNetCount:
                parts.netMembership.summary.possibleUnroutedNetCount || 0,
            classIssueCount: parts.classes.summary.issueCount || 0,
            dimensionCount: parts.dimensions.summary.dimensionCount || 0,
            dimensionIssueCount: parts.dimensions.summary.unresolvedCount || 0,
            manufacturingRuleCount:
                parts.ruleImpact.summary.manufacturingRuleCount || 0,
            polygonRealizationCount:
                parts.reviewMetadata.summary.polygonRealizationCount || 0,
            fabricationReviewItemCount:
                parts.fabricationReadiness.summary.reviewItemCount || 0
        }
    }

    /**
     * Sorts strings with numeric chunks in human order.
     * @param {string} left Left value.
     * @param {string} right Right value.
     * @returns {number}
     */
    static #naturalCompare(left, right) {
        return String(left).localeCompare(String(right), undefined, {
            numeric: true
        })
    }

    /**
     * Removes undefined and blank-string values from a shallow object.
     * @param {Record<string, unknown>} row Input row.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(row) {
        return Object.fromEntries(
            Object.entries(row).filter(
                ([, value]) => value !== undefined && value !== ''
            )
        )
    }
}
