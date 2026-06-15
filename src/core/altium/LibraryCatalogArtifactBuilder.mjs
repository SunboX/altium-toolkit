// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { LibraryQaReportBuilder } from './LibraryQaReportBuilder.mjs'
import { LibraryRenderManifestBuilder } from './LibraryRenderManifestBuilder.mjs'

/**
 * Builds deterministic static catalog artifacts for parsed libraries.
 */
export class LibraryCatalogArtifactBuilder {
    static SCHEMA_ID = 'altium-toolkit.library.catalog.a1'

    /**
     * Builds catalog entries, search metadata, and static HTML.
     * @param {{ schematicLibraries?: object[], pcbLibraries?: object[], qaReport?: object }} [options] Catalog options.
     * @returns {object}
     */
    static build(options = {}) {
        const schematicLibraries = options.schematicLibraries || []
        const pcbLibraries = options.pcbLibraries || []
        const qaReport =
            options.qaReport ||
            LibraryQaReportBuilder.build({ schematicLibraries, pcbLibraries })
        const issuesByTarget =
            LibraryCatalogArtifactBuilder.#issuesByTarget(qaReport)
        const entries = [
            ...LibraryCatalogArtifactBuilder.#symbolEntries(
                schematicLibraries,
                issuesByTarget
            ),
            ...LibraryCatalogArtifactBuilder.#footprintEntries(
                pcbLibraries,
                issuesByTarget
            )
        ].sort(
            (left, right) =>
                left.kind.localeCompare(right.kind) ||
                left.name.localeCompare(right.name) ||
                left.libraryFileName.localeCompare(right.libraryFileName)
        )
        const searchIndex = {
            schema: 'altium-toolkit.library.catalog-search.a1',
            entries: entries.map((entry) => ({
                key: entry.key,
                kind: entry.kind,
                name: entry.name,
                libraryFileName: entry.libraryFileName,
                text: entry.searchText
            }))
        }

        return {
            schema: LibraryCatalogArtifactBuilder.SCHEMA_ID,
            summary: {
                schematicLibraryCount: schematicLibraries.length,
                pcbLibraryCount: pcbLibraries.length,
                entryCount: entries.length,
                symbolCount: entries.filter((entry) => entry.kind === 'symbol')
                    .length,
                footprintCount: entries.filter(
                    (entry) => entry.kind === 'footprint'
                ).length,
                issueCount: entries.reduce(
                    (count, entry) => count + entry.issueCodes.length,
                    0
                )
            },
            entries,
            searchIndex,
            html: LibraryCatalogArtifactBuilder.#html(entries)
        }
    }

    /**
     * Builds catalog entries for schematic symbols.
     * @param {object[]} schematicLibraries Schematic libraries.
     * @param {Map<string, object[]>} issuesByTarget Issues by target.
     * @returns {object[]}
     */
    static #symbolEntries(schematicLibraries, issuesByTarget) {
        return (schematicLibraries || []).flatMap((library) => {
            const schematicLibrary = library.schematicLibrary || library || {}
            const manifest =
                LibraryRenderManifestBuilder.buildSchematicLibraryManifest(
                    schematicLibrary
                )

            return (schematicLibrary.symbols || []).map(
                (symbol, symbolIndex) => {
                    const name = String(symbol.name || '').trim()
                    const output = manifest.outputs.find(
                        (entry) => entry.name === name
                    )
                    const issues =
                        issuesByTarget.get('symbol:' + name) ||
                        issuesByTarget.get(name) ||
                        []

                    return LibraryCatalogArtifactBuilder.#stripUndefined({
                        key: 'symbol:' + (library.fileName || '') + ':' + name,
                        kind: 'symbol',
                        name,
                        libraryFileName: library.fileName || '',
                        index: symbolIndex,
                        pinCount: (symbol.pins || []).length,
                        partCount: (symbol.parts || []).length,
                        outputSvgKey: output?.outputSvgKey,
                        issueCodes: issues.map((issue) => issue.code),
                        issues,
                        searchText: [
                            name,
                            library.fileName || '',
                            'symbol',
                            symbol.parameters?.Description || '',
                            'pins:' + (symbol.pins || []).length
                        ]
                            .filter(Boolean)
                            .join(' ')
                    })
                }
            )
        })
    }

    /**
     * Builds catalog entries for PCB footprints.
     * @param {object[]} pcbLibraries PCB footprint libraries.
     * @param {Map<string, object[]>} issuesByTarget Issues by target.
     * @returns {object[]}
     */
    static #footprintEntries(pcbLibraries, issuesByTarget) {
        return (pcbLibraries || []).flatMap((library) => {
            const pcbLibrary = library.pcbLibrary || library || {}
            const manifest =
                LibraryRenderManifestBuilder.buildPcbLibraryManifest(pcbLibrary)

            return (pcbLibrary.footprints || []).map(
                (footprint, footprintIndex) => {
                    const name = String(footprint.name || '').trim()
                    const output = manifest.outputs.find(
                        (entry) => entry.name === name
                    )
                    const issues =
                        issuesByTarget.get('footprint:' + name) ||
                        issuesByTarget.get(name) ||
                        []

                    return LibraryCatalogArtifactBuilder.#stripUndefined({
                        key:
                            'footprint:' +
                            (library.fileName || '') +
                            ':' +
                            name,
                        kind: 'footprint',
                        name,
                        libraryFileName: library.fileName || '',
                        index: footprintIndex,
                        primitiveCount:
                            (footprint.pads || []).length +
                            (footprint.tracks || []).length +
                            (footprint.arcs || []).length +
                            (footprint.vias || []).length +
                            (footprint.fills || []).length +
                            (footprint.regions || []).length,
                        rawRecordCount: (footprint.rawRecords || []).length,
                        outputSvgKey: output?.outputSvgKey,
                        issueCodes: issues.map((issue) => issue.code),
                        issues,
                        searchText: [
                            name,
                            library.fileName || '',
                            'footprint',
                            'pads:' + (footprint.pads || []).length
                        ]
                            .filter(Boolean)
                            .join(' ')
                    })
                }
            )
        })
    }

    /**
     * Builds a target-key lookup for QA issues.
     * @param {object} qaReport QA report.
     * @returns {Map<string, object[]>}
     */
    static #issuesByTarget(qaReport) {
        const byTarget = new Map()
        const issues = [
            ...(qaReport?.libraryLint?.issues || []),
            ...(qaReport?.issues || [])
        ]

        for (const issue of issues) {
            const keys = new Set([
                issue.target,
                issue.symbolName ? 'symbol:' + issue.symbolName : '',
                issue.footprintName ? 'footprint:' + issue.footprintName : ''
            ])

            for (const key of keys) {
                if (!key) continue
                byTarget.set(key, [...(byTarget.get(key) || []), issue])
            }
        }

        return byTarget
    }

    /**
     * Builds a self-contained static HTML catalog.
     * @param {object[]} entries Catalog entries.
     * @returns {string}
     */
    static #html(entries) {
        const items = entries
            .map((entry) => {
                const badges = entry.issueCodes
                    .map(
                        (code) =>
                            '<span class="badge">' +
                            LibraryCatalogArtifactBuilder.#escapeHtml(code) +
                            '</span>'
                    )
                    .join('')

                return (
                    '<article data-catalog-entry="' +
                    LibraryCatalogArtifactBuilder.#escapeHtml(entry.kind) +
                    '">' +
                    '<h2>' +
                    LibraryCatalogArtifactBuilder.#escapeHtml(entry.name) +
                    '</h2>' +
                    '<p>' +
                    LibraryCatalogArtifactBuilder.#escapeHtml(
                        entry.libraryFileName
                    ) +
                    '</p>' +
                    '<p data-preview-key="' +
                    LibraryCatalogArtifactBuilder.#escapeHtml(
                        entry.outputSvgKey || ''
                    ) +
                    '">' +
                    LibraryCatalogArtifactBuilder.#escapeHtml(
                        entry.outputSvgKey || ''
                    ) +
                    '</p>' +
                    '<div class="badges">' +
                    badges +
                    '</div>' +
                    '</article>'
                )
            })
            .join('')

        return (
            '<!doctype html><html><head><meta charset="utf-8">' +
            '<title>Library Catalog</title>' +
            '<style>body{font-family:sans-serif;margin:24px}' +
            'main{display:grid;gap:12px}' +
            'article{border:1px solid #d0d7de;border-radius:6px;padding:12px}' +
            '.badge{display:inline-block;margin:4px 4px 0 0;padding:2px 6px;' +
            'border:1px solid #d0d7de;border-radius:999px;font-size:12px}' +
            '</style></head><body><main data-library-catalog>' +
            items +
            '</main></body></html>'
        )
    }

    /**
     * Escapes text for HTML output.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/gu, '&amp;')
            .replace(/</gu, '&lt;')
            .replace(/>/gu, '&gt;')
            .replace(/"/gu, '&quot;')
            .replace(/'/gu, '&#39;')
    }

    /**
     * Removes undefined fields.
     * @param {object} row Source row.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
