// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic QA summaries for recovered PCB dimension records.
 */
export class PcbDimensionReportBuilder {
    static SCHEMA = 'altium-toolkit.pcb.dimensions.a1'

    /**
     * Builds a dimension QA report from a parser root or PCB model.
     * @param {object} input Parser root, PCB model, or options object.
     * @returns {object}
     */
    static build(input = {}) {
        const pcb = PcbDimensionReportBuilder.#pcb(input)
        const dimensions = PcbDimensionReportBuilder.#dimensions(pcb)
        const rows = dimensions.map((dimension) =>
            PcbDimensionReportBuilder.#dimensionRow(dimension)
        )
        const findings = rows.flatMap((row) =>
            PcbDimensionReportBuilder.#findingsForRow(row)
        )

        return {
            schema: PcbDimensionReportBuilder.SCHEMA,
            summary: PcbDimensionReportBuilder.#summary(rows),
            dimensions: rows,
            findings
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
     * Resolves normalized dimension rows from a PCB payload.
     * @param {object} pcb PCB model.
     * @returns {object[]}
     */
    static #dimensions(pcb) {
        return Array.isArray(pcb?.dimensions) ? pcb.dimensions : []
    }

    /**
     * Builds one public dimension report row.
     * @param {object} dimension Normalized dimension record.
     * @returns {object}
     */
    static #dimensionRow(dimension) {
        const kind = PcbDimensionReportBuilder.#kind(dimension)
        const references = Array.isArray(dimension?.references)
            ? dimension.references
            : []
        const requiredReferenceCount =
            PcbDimensionReportBuilder.#requiredReferenceCount(kind)
        const status =
            references.length >= requiredReferenceCount
                ? 'renderable'
                : 'unresolved'

        return PcbDimensionReportBuilder.#stripEmpty({
            dimensionIndex: PcbDimensionReportBuilder.#integerOrFallback(
                dimension?.dimensionIndex,
                0
            ),
            kind,
            name: dimension?.name || '',
            layer: dimension?.layer || '',
            text: dimension?.text || '',
            status,
            referenceCount: references.length,
            requiredReferenceCount,
            hasTextLocation: Boolean(dimension?.textLocation),
            measuredValue: dimension?.measuredValue ?? undefined,
            angleValue: dimension?.angleValue ?? undefined,
            unit: dimension?.unit || ''
        })
    }

    /**
     * Builds report findings for one dimension row.
     * @param {object} row Dimension report row.
     * @returns {object[]}
     */
    static #findingsForRow(row) {
        if (row.status !== 'unresolved') {
            return []
        }

        return [
            PcbDimensionReportBuilder.#stripEmpty({
                code: 'pcb.dimension.missing-reference',
                severity: 'warning',
                dimensionIndex: row.dimensionIndex,
                kind: row.kind,
                name: row.name,
                referenceCount: row.referenceCount,
                requiredReferenceCount: row.requiredReferenceCount
            })
        ]
    }

    /**
     * Builds top-level dimension counters.
     * @param {object[]} rows Dimension report rows.
     * @returns {object}
     */
    static #summary(rows) {
        const byKind = new Map()

        for (const row of rows) {
            byKind.set(row.kind, Number(byKind.get(row.kind) || 0) + 1)
        }

        return {
            dimensionCount: rows.length,
            renderableCount: rows.filter((row) => row.status === 'renderable')
                .length,
            unresolvedCount: rows.filter((row) => row.status === 'unresolved')
                .length,
            missingTextLocationCount: rows.filter(
                (row) => row.hasTextLocation !== true
            ).length,
            byKind: [...byKind.entries()]
                .map(([kind, count]) => ({ kind, count }))
                .sort((left, right) =>
                    left.kind.localeCompare(right.kind, undefined, {
                        numeric: true
                    })
                )
        }
    }

    /**
     * Resolves the canonical dimension kind.
     * @param {object} dimension Dimension record.
     * @returns {string}
     */
    static #kind(dimension) {
        const kind = String(dimension?.kind || '')
            .trim()
            .toLowerCase()
        return kind || 'linear'
    }

    /**
     * Returns the minimum reference count needed for deterministic rendering.
     * @param {string} kind Dimension kind.
     * @returns {number}
     */
    static #requiredReferenceCount(kind) {
        if (kind === 'angular') {
            return 3
        }

        return 2
    }

    /**
     * Parses an integer with a fallback.
     * @param {unknown} value Numeric candidate.
     * @param {number} fallback Fallback value.
     * @returns {number}
     */
    static #integerOrFallback(value, fallback) {
        const number = Number(value)
        return Number.isInteger(number) ? number : fallback
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
