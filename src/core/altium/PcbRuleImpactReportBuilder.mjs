// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic design-rule impact summaries for PCB review workflows.
 */
export class PcbRuleImpactReportBuilder {
    static SCHEMA = 'altium-toolkit.pcb.rule-impact.a1'

    /**
     * Builds a rule impact report from a parser root or PCB model.
     * @param {object} input Parser root, PCB model, or options object.
     * @returns {object}
     */
    static build(input = {}) {
        const pcb = PcbRuleImpactReportBuilder.#pcb(input)
        const rules = Array.isArray(pcb?.rules) ? pcb.rules : []
        const rows = rules.map((rule) =>
            PcbRuleImpactReportBuilder.#ruleRow(rule)
        )

        return {
            schema: PcbRuleImpactReportBuilder.SCHEMA,
            summary: PcbRuleImpactReportBuilder.#summary(rows),
            primitiveCounts: PcbRuleImpactReportBuilder.#primitiveCounts(pcb),
            rules: rows
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
     * Builds one public rule impact row.
     * @param {object} rule Parsed design-rule row.
     * @returns {object}
     */
    static #ruleRow(rule) {
        const kind = PcbRuleImpactReportBuilder.#kind(rule)
        const category = PcbRuleImpactReportBuilder.#category(rule, kind)

        return PcbRuleImpactReportBuilder.#stripEmpty({
            ruleIndex: PcbRuleImpactReportBuilder.#integerOrFallback(
                rule?.ruleIndex,
                0
            ),
            name: rule?.name || '',
            uniqueId: rule?.uniqueId || '',
            kind,
            category,
            displayName:
                rule?.ruleType?.displayName || rule?.displayName || kind,
            enabled: rule?.enabled !== false,
            priority: rule?.priority ?? undefined,
            affectedFamilies: PcbRuleImpactReportBuilder.#affectedFamilies(
                kind,
                category
            ),
            scopes: PcbRuleImpactReportBuilder.#scopes(rule),
            lengthConstraints:
                PcbRuleImpactReportBuilder.#lengthConstraints(rule)
        })
    }

    /**
     * Builds top-level rule impact counters.
     * @param {object[]} rows Rule impact rows.
     * @returns {object}
     */
    static #summary(rows) {
        const enabledRows = rows.filter((row) => row.enabled !== false)
        const impactedFamilies = new Set(
            enabledRows.flatMap((row) => row.affectedFamilies || [])
        )

        return {
            ruleCount: rows.length,
            enabledRuleCount: enabledRows.length,
            disabledRuleCount: rows.length - enabledRows.length,
            manufacturingRuleCount: enabledRows.filter(
                (row) => row.category === 'manufacturing'
            ).length,
            scopedRuleCount: rows.filter((row) => row.scopes?.length).length,
            impactedFamilyCount: impactedFamilies.size,
            lengthConstraintCount: rows.reduce(
                (total, row) =>
                    total + Number(row.lengthConstraints?.length || 0),
                0
            )
        }
    }

    /**
     * Builds primitive-family counts available to report consumers.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #primitiveCounts(pcb) {
        return Object.fromEntries(
            [
                'pads',
                'vias',
                'tracks',
                'arcs',
                'fills',
                'regions',
                'polygons',
                'components'
            ].map((family) => [
                family,
                Array.isArray(pcb?.[family]) ? pcb[family].length : 0
            ])
        )
    }

    /**
     * Resolves a normalized rule kind.
     * @param {object} rule Rule row.
     * @returns {string}
     */
    static #kind(rule) {
        return (
            String(
                rule?.ruleType?.kind ||
                    rule?.kind ||
                    rule?.ruleKind ||
                    'unknown'
            )
                .trim()
                .toLowerCase() || 'unknown'
        )
    }

    /**
     * Resolves a normalized rule category.
     * @param {object} rule Rule row.
     * @param {string} kind Normalized rule kind.
     * @returns {string}
     */
    static #category(rule, kind) {
        const explicit = String(
            rule?.ruleType?.category || rule?.category || ''
        )
            .trim()
            .toLowerCase()
        if (explicit) {
            return explicit
        }

        if (/paste|mask|silk|annular|testpoint/u.test(kind)) {
            return 'manufacturing'
        }
        if (/width|length|routing|fanout|via/u.test(kind)) {
            return 'routing'
        }
        if (/clearance|short|unrouted/u.test(kind)) {
            return 'electrical'
        }

        return 'other'
    }

    /**
     * Infers broad primitive families affected by one rule kind.
     * @param {string} kind Rule kind.
     * @param {string} category Rule category.
     * @returns {string[]}
     */
    static #affectedFamilies(kind, category) {
        if (/component/u.test(kind)) {
            return ['components']
        }
        if (/paste/u.test(kind)) {
            return ['pads']
        }
        if (/solder.*mask|mask.*expansion/u.test(kind)) {
            return ['pads', 'vias']
        }
        if (/polygon|plane|thermal/u.test(kind)) {
            return ['pads', 'polygons', 'vias']
        }
        if (/annular|fanout|via/u.test(kind)) {
            return ['pads', 'vias']
        }
        if (/width/u.test(kind)) {
            return ['arcs', 'tracks']
        }
        if (/length|routing|corner|topology/u.test(kind)) {
            return ['arcs', 'tracks', 'vias']
        }
        if (/clearance|short/u.test(kind)) {
            return ['arcs', 'fills', 'pads', 'regions', 'tracks', 'vias']
        }
        if (category === 'manufacturing') {
            return ['pads', 'vias']
        }

        return []
    }

    /**
     * Builds normalized scope rows for non-trivial rule scopes.
     * @param {object} rule Rule row.
     * @returns {object[]}
     */
    static #scopes(rule) {
        return [
            PcbRuleImpactReportBuilder.#scopeRow('scope1', rule?.scope1),
            PcbRuleImpactReportBuilder.#scopeRow('scope2', rule?.scope2)
        ].filter(Boolean)
    }

    /**
     * Builds one normalized scope row.
     * @param {string} side Scope side label.
     * @param {object} scope Parsed scope expression.
     * @returns {object | null}
     */
    static #scopeRow(side, scope) {
        const expression = String(scope?.rawExpression || '').trim()
        const predicate = String(scope?.predicate || '').trim()
        const isAll = scope?.isAll === true || /^all$/iu.test(predicate)

        if (!expression && !predicate) {
            return null
        }
        if (isAll && !expression) {
            return null
        }

        return PcbRuleImpactReportBuilder.#stripEmpty({
            side,
            expression,
            predicate,
            arguments: Array.isArray(scope?.arguments) ? scope.arguments : []
        })
    }

    /**
     * Extracts length-valued typed constraints.
     * @param {object} rule Rule row.
     * @returns {object[]}
     */
    static #lengthConstraints(rule) {
        const source = Object.keys(rule?.typedConstraints || {}).length
            ? rule.typedConstraints
            : rule?.constraintValues || {}
        const rows = []

        for (const [name, value] of Object.entries(source || {})) {
            if (!PcbRuleImpactReportBuilder.#isLengthConstraint(value)) {
                continue
            }
            rows.push(
                PcbRuleImpactReportBuilder.#stripEmpty({
                    name,
                    key: value.key,
                    raw: value.raw,
                    valueMil: value.valueMil,
                    valueMm: value.valueMm
                })
            )
        }

        return rows.sort((left, right) =>
            left.name.localeCompare(right.name, undefined, { numeric: true })
        )
    }

    /**
     * Returns true when one parsed constraint carries length units.
     * @param {object} value Parsed constraint value.
     * @returns {boolean}
     */
    static #isLengthConstraint(value) {
        return (
            value?.type === 'length' ||
            Number.isFinite(Number(value?.valueMil)) ||
            Number.isFinite(Number(value?.valueMm))
        )
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
