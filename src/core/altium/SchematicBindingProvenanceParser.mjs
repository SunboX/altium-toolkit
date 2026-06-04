// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseNumericField } = ParserUtils

/**
 * Builds a read-only schematic component library/model binding layer.
 */
export class SchematicBindingProvenanceParser {
    static SCHEMA_ID = 'altium-toolkit.schematic.bindings.a1'

    /**
     * Parses component binding status from component and implementation rows.
     * @param {object[]} records Schematic records.
     * @param {object | null} implementations Implementation read model.
     * @returns {object | null}
     */
    static parse(records, implementations) {
        const componentRows =
            SchematicBindingProvenanceParser.#componentRows(records)

        if (!componentRows.length) {
            return null
        }

        const implementationsByComponent =
            SchematicBindingProvenanceParser.#implementationsByComponent(
                implementations
            )
        const components = componentRows.map((component) =>
            SchematicBindingProvenanceParser.#componentBinding(
                component,
                implementationsByComponent.get(component.componentKey) || []
            )
        )

        return {
            schema: SchematicBindingProvenanceParser.SCHEMA_ID,
            summary: SchematicBindingProvenanceParser.#summary(components),
            components
        }
    }

    /**
     * Builds normalized component identity rows.
     * @param {object[]} records Schematic records.
     * @returns {object[]}
     */
    static #componentRows(records) {
        return (records || [])
            .filter((record) => getField(record.fields, 'RECORD') === '1')
            .map((record) => {
                const indexInSheet = parseNumericField(
                    record.fields,
                    'IndexInSheet'
                )
                return {
                    componentKey:
                        'schematic-component-' +
                        String(indexInSheet ?? record.recordIndex ?? 0),
                    recordKey:
                        'schematic-record-' + String(record.recordIndex ?? 0),
                    uniqueId: getField(record.fields, 'UniqueID'),
                    libReference:
                        getField(record.fields, 'LibReference') ||
                        getField(record.fields, 'DesignItemId')
                }
            })
    }

    /**
     * Groups implementation rows by owner component key.
     * @param {object | null} implementations Implementation read model.
     * @returns {Map<string, object[]>}
     */
    static #implementationsByComponent(implementations) {
        const grouped = new Map()

        for (const implementation of implementations?.implementations || []) {
            const key = implementation.ownerComponentKey || ''
            if (!key) continue
            if (!grouped.has(key)) grouped.set(key, [])
            grouped.get(key).push(implementation)
        }

        return grouped
    }

    /**
     * Builds one component binding row.
     * @param {object} component Component row.
     * @param {object[]} linkedImplementations Linked implementation rows.
     * @returns {object}
     */
    static #componentBinding(component, linkedImplementations) {
        const status = SchematicBindingProvenanceParser.#status(
            component,
            linkedImplementations
        )
        const reasons = SchematicBindingProvenanceParser.#reasons(
            status,
            component,
            linkedImplementations
        )

        return {
            componentKey: component.componentKey,
            recordKey: component.recordKey,
            uniqueId: component.uniqueId,
            libReference: component.libReference,
            status,
            implementationKeys: linkedImplementations.map(
                (implementation) => implementation.key
            ),
            targetLibraries: SchematicBindingProvenanceParser.#targetLibraries(
                linkedImplementations
            ),
            reasons
        }
    }

    /**
     * Classifies component binding status.
     * @param {object} component Component row.
     * @param {object[]} linkedImplementations Linked implementation rows.
     * @returns {'resolved' | 'unresolved' | 'stale' | 'external'}
     */
    static #status(component, linkedImplementations) {
        if (linkedImplementations.length) {
            const current =
                linkedImplementations.find(
                    (implementation) => implementation.isCurrent
                ) || linkedImplementations[0]
            return current.modelName &&
                (current.targetLibraries || []).length > 0
                ? 'resolved'
                : 'stale'
        }

        return component.libReference ? 'external' : 'unresolved'
    }

    /**
     * Explains non-resolved status values.
     * @param {string} status Binding status.
     * @param {object} component Component row.
     * @param {object[]} linkedImplementations Linked implementation rows.
     * @returns {string[]}
     */
    static #reasons(status, component, linkedImplementations) {
        if (status === 'resolved') return []
        if (status === 'external') {
            return ['component has a library reference but no local model link']
        }
        if (status === 'unresolved') {
            return ['component has no local library reference or model link']
        }

        const reasons = []
        const current =
            linkedImplementations.find(
                (implementation) => implementation.isCurrent
            ) || linkedImplementations[0]
        if (!current?.modelName) reasons.push('current model name is missing')
        if (!(current?.targetLibraries || []).length) {
            reasons.push('current model target library is missing')
        }
        if (!component.libReference) {
            reasons.push('component library reference is missing')
        }
        return reasons
    }

    /**
     * Flattens target-library rows without implementation-local indexes.
     * @param {object[]} linkedImplementations Linked implementation rows.
     * @returns {object[]}
     */
    static #targetLibraries(linkedImplementations) {
        const libraries = []
        const seen = new Set()

        for (const implementation of linkedImplementations) {
            for (const library of implementation.targetLibraries || []) {
                const publicLibrary = {
                    entity: library.entity || '',
                    kind: library.kind || '',
                    fileName: library.fileName || ''
                }
                const key = JSON.stringify(publicLibrary)
                if (seen.has(key)) continue
                seen.add(key)
                libraries.push(publicLibrary)
            }
        }

        return libraries
    }

    /**
     * Builds status counters.
     * @param {object[]} components Binding rows.
     * @returns {object}
     */
    static #summary(components) {
        const summary = {
            componentCount: components.length,
            resolvedCount: 0,
            unresolvedCount: 0,
            staleCount: 0,
            externalCount: 0
        }

        for (const component of components) {
            summary[component.status + 'Count'] += 1
        }

        return summary
    }
}
