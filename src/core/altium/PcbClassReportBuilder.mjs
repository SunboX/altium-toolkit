// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic summaries for normalized PCB class records.
 */
export class PcbClassReportBuilder {
    static SCHEMA = 'altium-toolkit.pcb.class-report.a1'

    /**
     * Builds a PCB class report.
     * @param {object} pcb Normalized PCB model.
     * @returns {object}
     */
    static build(pcb = {}) {
        const indexes = PcbClassReportBuilder.#memberIndexes(pcb)
        const classes = (Array.isArray(pcb?.classes) ? pcb.classes : []).map(
            (classRecord, index) =>
                PcbClassReportBuilder.#classRow(classRecord, index, indexes)
        )
        const issues = PcbClassReportBuilder.#issues(classes)

        return {
            schema: PcbClassReportBuilder.SCHEMA,
            summary: PcbClassReportBuilder.#summary(classes, issues),
            byKind: PcbClassReportBuilder.#byKind(classes),
            classes,
            issues
        }
    }

    /**
     * Builds lookup sets used to resolve class members.
     * @param {object} pcb Normalized PCB model.
     * @returns {Record<string, Set<string>>}
     */
    static #memberIndexes(pcb) {
        return {
            net: PcbClassReportBuilder.#namedSet(pcb?.nets, ['name']),
            component: PcbClassReportBuilder.#namedSet(pcb?.components, [
                'designator',
                'name'
            ]),
            pad: PcbClassReportBuilder.#namedSet(pcb?.pads, [
                'designator',
                'padNumber',
                'pinName',
                'name'
            ]),
            layer: PcbClassReportBuilder.#namedSet(
                [
                    ...PcbClassReportBuilder.#array(pcb?.layers),
                    ...PcbClassReportBuilder.#array(pcb?.primitiveLayers)
                ],
                ['name', 'displayName', 'id', 'layerId']
            ),
            polygon: PcbClassReportBuilder.#namedSet(pcb?.polygons, [
                'name',
                'netName'
            ]),
            'diff-pair': PcbClassReportBuilder.#namedSet(
                pcb?.differentialPairs,
                ['name']
            )
        }
    }

    /**
     * Returns an array value or an empty array for non-array input.
     * @param {unknown} value Candidate array value.
     * @returns {unknown[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }

    /**
     * Builds a set of names from candidate row fields.
     * @param {object[] | undefined} rows Candidate rows.
     * @param {string[]} keys Candidate field names.
     * @returns {Set<string>}
     */
    static #namedSet(rows, keys) {
        const values = new Set()

        for (const row of Array.isArray(rows) ? rows : []) {
            for (const key of keys) {
                const value = String(row?.[key] ?? '').trim()
                if (value) {
                    values.add(value)
                }
            }
        }

        return values
    }

    /**
     * Builds one class summary row.
     * @param {object} classRecord Normalized class record.
     * @param {number} index Class index.
     * @param {Record<string, Set<string>>} indexes Member lookup sets.
     * @returns {object}
     */
    static #classRow(classRecord, index, indexes) {
        const kindName = PcbClassReportBuilder.#kindName(classRecord)
        const members = (
            Array.isArray(classRecord?.members) ? classRecord.members : []
        )
            .map((member) => String(member || '').trim())
            .filter(Boolean)
        const resolvedMembers = []
        const unresolvedMembers = []

        for (const member of members) {
            const resolved = PcbClassReportBuilder.#resolveMember(
                member,
                kindName,
                indexes
            )
            if (resolved) {
                resolvedMembers.push(resolved)
            } else {
                unresolvedMembers.push(member)
            }
        }

        return PcbClassReportBuilder.#stripEmpty({
            classIndex: Number.isInteger(classRecord?.classIndex)
                ? classRecord.classIndex
                : index,
            name: String(classRecord?.name || '').trim(),
            kind: Number.isFinite(Number(classRecord?.kind))
                ? Number(classRecord.kind)
                : undefined,
            kindName,
            enabled: classRecord?.enabled !== false,
            memberCount: members.length,
            resolvedMemberCount: resolvedMembers.length,
            unresolvedMemberCount: unresolvedMembers.length,
            members,
            resolvedMembers,
            unresolvedMembers,
            references: PcbClassReportBuilder.#references(resolvedMembers),
            uniqueId: String(classRecord?.uniqueId || '').trim()
        })
    }

    /**
     * Resolves the normalized class kind name.
     * @param {object} classRecord Normalized class record.
     * @returns {string}
     */
    static #kindName(classRecord) {
        const kindName = String(classRecord?.kindName || '').trim()
        if (kindName) {
            return kindName
        }

        return (
            {
                0: 'net',
                1: 'component',
                2: 'from-to',
                3: 'pad',
                4: 'layer',
                6: 'diff-pair',
                7: 'polygon'
            }[Number(classRecord?.kind)] || 'unknown'
        )
    }

    /**
     * Resolves one class member against the expected or known object indexes.
     * @param {string} member Member name.
     * @param {string} kindName Class kind name.
     * @param {Record<string, Set<string>>} indexes Member lookup sets.
     * @returns {{ name: string, kind: string } | null}
     */
    static #resolveMember(member, kindName, indexes) {
        const expectedKind = kindName === 'diff-pair' ? 'diff-pair' : kindName
        const expectedIndex = indexes[expectedKind]
        if (expectedIndex?.has(member)) {
            return { name: member, kind: expectedKind }
        }

        if (kindName !== 'unknown') {
            return null
        }

        for (const [kind, values] of Object.entries(indexes)) {
            if (values.has(member)) {
                return { name: member, kind }
            }
        }

        return null
    }

    /**
     * Builds grouped reference lists from resolved members.
     * @param {{ name: string, kind: string }[]} resolvedMembers Resolved member rows.
     * @returns {object}
     */
    static #references(resolvedMembers) {
        const references = {
            netNames: [],
            componentDesignators: [],
            padDesignators: [],
            layerNames: [],
            polygonNames: [],
            differentialPairNames: []
        }

        for (const member of resolvedMembers) {
            if (member.kind === 'net') references.netNames.push(member.name)
            if (member.kind === 'component') {
                references.componentDesignators.push(member.name)
            }
            if (member.kind === 'pad')
                references.padDesignators.push(member.name)
            if (member.kind === 'layer') references.layerNames.push(member.name)
            if (member.kind === 'polygon') {
                references.polygonNames.push(member.name)
            }
            if (member.kind === 'diff-pair') {
                references.differentialPairNames.push(member.name)
            }
        }

        return Object.fromEntries(
            Object.entries(references)
                .map(([key, values]) => [
                    key,
                    [...values].sort(PcbClassReportBuilder.#naturalCompare)
                ])
                .filter(([, values]) => values.length > 0)
        )
    }

    /**
     * Builds deterministic class issues.
     * @param {object[]} classes Class rows.
     * @returns {object[]}
     */
    static #issues(classes) {
        const issues = []

        for (const classRow of classes) {
            for (const member of classRow.unresolvedMembers || []) {
                issues.push({
                    code: 'pcb.class.unresolved-member',
                    severity: 'warning',
                    className: classRow.name,
                    kindName: classRow.kindName,
                    memberName: member
                })
            }

            if (classRow.memberCount === 0) {
                issues.push({
                    code: 'pcb.class.empty',
                    severity: 'info',
                    className: classRow.name,
                    kindName: classRow.kindName
                })
            }
        }

        return issues
    }

    /**
     * Builds top-level class summary counters.
     * @param {object[]} classes Class rows.
     * @param {object[]} issues Issue rows.
     * @returns {object}
     */
    static #summary(classes, issues) {
        return {
            classCount: classes.length,
            enabledClassCount: classes.filter((row) => row.enabled !== false)
                .length,
            disabledClassCount: classes.filter((row) => row.enabled === false)
                .length,
            netClassCount: PcbClassReportBuilder.#kindCount(classes, 'net'),
            componentClassCount: PcbClassReportBuilder.#kindCount(
                classes,
                'component'
            ),
            padClassCount: PcbClassReportBuilder.#kindCount(classes, 'pad'),
            differentialPairClassCount: PcbClassReportBuilder.#kindCount(
                classes,
                'diff-pair'
            ),
            emptyClassCount: classes.filter((row) => row.memberCount === 0)
                .length,
            unresolvedMemberCount: classes.reduce(
                (total, row) => total + Number(row.unresolvedMemberCount || 0),
                0
            ),
            issueCount: issues.length
        }
    }

    /**
     * Counts classes by kind.
     * @param {object[]} classes Class rows.
     * @param {string} kindName Class kind name.
     * @returns {number}
     */
    static #kindCount(classes, kindName) {
        return classes.filter((row) => row.kindName === kindName).length
    }

    /**
     * Builds sorted class counts by kind.
     * @param {object[]} classes Class rows.
     * @returns {{ kindName: string, count: number }[]}
     */
    static #byKind(classes) {
        const counts = new Map()

        for (const classRow of classes) {
            counts.set(
                classRow.kindName,
                Number(counts.get(classRow.kindName) || 0) + 1
            )
        }

        return [...counts.entries()]
            .map(([kindName, count]) => ({ kindName, count }))
            .sort((left, right) =>
                PcbClassReportBuilder.#naturalCompare(
                    left.kindName,
                    right.kindName
                )
            )
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
