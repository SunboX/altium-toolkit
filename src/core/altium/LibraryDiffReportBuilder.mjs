// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic read-only diffs between parsed library models.
 */
export class LibraryDiffReportBuilder {
    static SCHEMA = 'altium-toolkit.library.diff.a1'

    /**
     * Builds a library diff report.
     * @param {{ left?: object[] | object, right?: object[] | object }} input Diff input.
     * @returns {object}
     */
    static build(input = {}) {
        const leftLibraries = LibraryDiffReportBuilder.#libraries(input.left)
        const rightLibraries = LibraryDiffReportBuilder.#libraries(input.right)
        const symbols = LibraryDiffReportBuilder.#diffCollection(
            LibraryDiffReportBuilder.#symbolRows(leftLibraries),
            LibraryDiffReportBuilder.#symbolRows(rightLibraries),
            'symbol'
        )
        const footprints = LibraryDiffReportBuilder.#diffCollection(
            LibraryDiffReportBuilder.#footprintRows(leftLibraries),
            LibraryDiffReportBuilder.#footprintRows(rightLibraries),
            'footprint'
        )

        return {
            schema: LibraryDiffReportBuilder.SCHEMA,
            summary: {
                leftLibraryCount: leftLibraries.length,
                rightLibraryCount: rightLibraries.length,
                addedSymbolCount: symbols.added.length,
                removedSymbolCount: symbols.removed.length,
                changedSymbolCount: symbols.changed.length,
                addedFootprintCount: footprints.added.length,
                removedFootprintCount: footprints.removed.length,
                changedFootprintCount: footprints.changed.length,
                differenceCount:
                    symbols.added.length +
                    symbols.removed.length +
                    symbols.changed.length +
                    footprints.added.length +
                    footprints.removed.length +
                    footprints.changed.length
            },
            symbols,
            footprints
        }
    }

    /**
     * Normalizes library input to an array.
     * @param {object[] | object | undefined} value Input value.
     * @returns {object[]}
     */
    static #libraries(value) {
        if (!value) return []
        return Array.isArray(value) ? value : [value]
    }

    /**
     * Collects schematic symbol comparison rows.
     * @param {object[]} libraries Library models.
     * @returns {object[]}
     */
    static #symbolRows(libraries) {
        return (libraries || []).flatMap((library) =>
            (library.schematicLibrary?.symbols || []).map((symbol, index) => ({
                name: String(symbol.name || ''),
                libraryFileName: library.fileName || '',
                index,
                pinCount: (symbol.pins || []).length,
                partCount: (symbol.parts || []).length,
                parameters: symbol.parameters || {}
            }))
        )
    }

    /**
     * Collects PCB footprint comparison rows.
     * @param {object[]} libraries Library models.
     * @returns {object[]}
     */
    static #footprintRows(libraries) {
        return (libraries || []).flatMap((library) =>
            (library.pcbLibrary?.footprints || []).map((footprint, index) => ({
                name: String(footprint.name || ''),
                libraryFileName: library.fileName || '',
                index,
                padCount: (footprint.pads || []).length,
                textCount: (footprint.texts || []).length,
                parameters: footprint.parameters || {}
            }))
        )
    }

    /**
     * Diffs one named library item collection.
     * @param {object[]} leftRows Left rows.
     * @param {object[]} rightRows Right rows.
     * @param {'symbol' | 'footprint'} kind Collection kind.
     * @returns {{ added: object[], removed: object[], changed: object[] }}
     */
    static #diffCollection(leftRows, rightRows, kind) {
        const leftByName = LibraryDiffReportBuilder.#byName(leftRows)
        const rightByName = LibraryDiffReportBuilder.#byName(rightRows)
        const names = [
            ...new Set([...leftByName.keys(), ...rightByName.keys()])
        ]
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right))
        const added = []
        const removed = []
        const changed = []

        for (const name of names) {
            const left = leftByName.get(name)
            const right = rightByName.get(name)

            if (!left && right) {
                added.push(
                    LibraryDiffReportBuilder.#publicRow(right, kind, {
                        includeName: true
                    })
                )
                continue
            }

            if (left && !right) {
                removed.push(
                    LibraryDiffReportBuilder.#publicRow(left, kind, {
                        includeName: true
                    })
                )
                continue
            }

            const differences = LibraryDiffReportBuilder.#differences(
                left,
                right,
                kind
            )
            if (Object.keys(differences).length) {
                changed.push({
                    name,
                    left: LibraryDiffReportBuilder.#publicRow(left, kind),
                    right: LibraryDiffReportBuilder.#publicRow(right, kind),
                    differences
                })
            }
        }

        return { added, removed, changed }
    }

    /**
     * Indexes rows by name.
     * @param {object[]} rows Rows.
     * @returns {Map<string, object>}
     */
    static #byName(rows) {
        return new Map(
            (rows || []).filter((row) => row.name).map((row) => [row.name, row])
        )
    }

    /**
     * Builds public row shape without private comparison-only data.
     * @param {object} row Source row.
     * @param {'symbol' | 'footprint'} kind Collection kind.
     * @param {{ includeName?: boolean }} options Row options.
     * @returns {object}
     */
    static #publicRow(row, kind, options = {}) {
        const base = {
            libraryFileName: row.libraryFileName,
            index: row.index
        }
        if (options.includeName) {
            base.name = row.name
        }

        if (kind === 'symbol') {
            return {
                ...base,
                pinCount: row.pinCount,
                partCount: row.partCount
            }
        }

        return {
            ...base,
            padCount: row.padCount,
            textCount: row.textCount
        }
    }

    /**
     * Builds differences between two matching rows.
     * @param {object} left Left row.
     * @param {object} right Right row.
     * @param {'symbol' | 'footprint'} kind Collection kind.
     * @returns {object}
     */
    static #differences(left, right, kind) {
        const differences = {}

        for (const key of kind === 'symbol'
            ? ['pinCount', 'partCount']
            : ['padCount', 'textCount']) {
            if (left[key] !== right[key]) {
                differences[key] = { left: left[key], right: right[key] }
            }
        }

        const parameterDifferences =
            LibraryDiffReportBuilder.#parameterDifferences(
                left.parameters,
                right.parameters
            )
        if (Object.keys(parameterDifferences).length) {
            differences.parameters = parameterDifferences
        }

        return differences
    }

    /**
     * Builds per-parameter value differences.
     * @param {Record<string, string>} left Left parameters.
     * @param {Record<string, string>} right Right parameters.
     * @returns {object}
     */
    static #parameterDifferences(left, right) {
        const differences = {}
        const keys = [
            ...new Set([
                ...Object.keys(left || {}),
                ...Object.keys(right || {})
            ])
        ].sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))

        for (const key of keys) {
            const leftValue = String(left?.[key] ?? '')
            const rightValue = String(right?.[key] ?? '')

            if (leftValue !== rightValue) {
                differences[key] = {
                    left: leftValue,
                    right: rightValue
                }
            }
        }

        return differences
    }
}
