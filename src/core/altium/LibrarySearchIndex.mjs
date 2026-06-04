// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Provides exact and lightweight fuzzy lookups over parsed library read models.
 */
export class LibrarySearchIndex {
    /**
     * Searches PCB footprint records.
     * @param {{ footprints?: object[] } | { pcbLibrary?: { footprints?: object[] } }} library Parsed PCB library.
     * @param {string} query Search query.
     * @param {{ limit?: number }} options Search options.
     * @returns {{ query: string, matches: object[] }}
     */
    static searchPcbFootprints(library, query, options = {}) {
        const pcbLibrary = library?.pcbLibrary || library || {}
        const footprints = Array.isArray(pcbLibrary.footprints)
            ? pcbLibrary.footprints
            : []

        return LibrarySearchIndex.#searchCollection(
            'footprint',
            footprints,
            query,
            options
        )
    }

    /**
     * Searches schematic symbol records.
     * @param {{ symbols?: object[] } | { schematicLibrary?: { symbols?: object[] } }} library Parsed schematic library.
     * @param {string} query Search query.
     * @param {{ limit?: number }} options Search options.
     * @returns {{ query: string, matches: object[] }}
     */
    static searchSchematicSymbols(library, query, options = {}) {
        const schematicLibrary = library?.schematicLibrary || library || {}
        const symbols = Array.isArray(schematicLibrary.symbols)
            ? schematicLibrary.symbols
            : []

        return LibrarySearchIndex.#searchCollection(
            'symbol',
            symbols,
            query,
            options
        )
    }

    /**
     * Searches one library collection.
     * @param {string} kind Public item kind.
     * @param {object[]} items Library items.
     * @param {string} query Search query.
     * @param {{ limit?: number }} options Search options.
     * @returns {{ query: string, matches: object[] }}
     */
    static #searchCollection(kind, items, query, options) {
        const normalizedQuery = LibrarySearchIndex.#normalize(query)
        const limit = Math.max(Number(options.limit || 25), 1)
        const matches = (items || [])
            .map((item, index) =>
                LibrarySearchIndex.#scoreItem(
                    kind,
                    item,
                    index,
                    normalizedQuery
                )
            )
            .filter(Boolean)
            .sort(
                (left, right) =>
                    left.score - right.score ||
                    left.name.localeCompare(right.name)
            )
            .slice(0, limit)

        return {
            query: String(query || ''),
            matches
        }
    }

    /**
     * Scores one candidate library item.
     * @param {string} kind Public item kind.
     * @param {object} item Library item.
     * @param {number} index Source index.
     * @param {string} normalizedQuery Normalized query.
     * @returns {object | null}
     */
    static #scoreItem(kind, item, index, normalizedQuery) {
        if (!normalizedQuery) {
            return null
        }

        const name = String(item?.name || item?.libReference || '')
        const normalizedName = LibrarySearchIndex.#normalize(name)
        const keywords = LibrarySearchIndex.#keywords(item)
        const match = LibrarySearchIndex.#match(
            normalizedQuery,
            normalizedName,
            keywords
        )

        if (!match) {
            return null
        }

        return {
            kind,
            name,
            index,
            score: match.score,
            matchKind: match.matchKind,
            keywords
        }
    }

    /**
     * Matches a normalized query against name and keywords.
     * @param {string} query Normalized query.
     * @param {string} name Normalized name.
     * @param {string[]} keywords Keyword list.
     * @returns {{ score: number, matchKind: string } | null}
     */
    static #match(query, name, keywords) {
        const normalizedKeywords = keywords.map((keyword) =>
            LibrarySearchIndex.#normalize(keyword)
        )
        const compactQuery = LibrarySearchIndex.#compact(query)
        const compactName = LibrarySearchIndex.#compact(name)

        if (name === query) {
            return { score: 0, matchKind: 'exact' }
        }
        if (name.startsWith(query)) {
            return { score: 10, matchKind: 'prefix' }
        }
        if (name.includes(query)) {
            return { score: 20, matchKind: 'substring' }
        }
        if (normalizedKeywords.some((keyword) => keyword.includes(query))) {
            return { score: 30, matchKind: 'keyword' }
        }
        if (
            compactName.includes(compactQuery) ||
            LibrarySearchIndex.#isOrderedSubsequence(compactQuery, compactName)
        ) {
            return { score: 40, matchKind: 'fuzzy' }
        }

        return null
    }

    /**
     * Builds keywords from item metadata.
     * @param {object} item Library item.
     * @returns {string[]}
     */
    static #keywords(item) {
        return [
            item?.name,
            item?.dataName,
            item?.sourceStorage,
            ...Object.values(item?.parameters || {}),
            ...Object.values(item?.componentParams || {}),
            ...Object.values(item?.componentParams?.properties || {})
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    }

    /**
     * Returns true when all query chars appear in order in the candidate.
     * @param {string} query Normalized compact query.
     * @param {string} candidate Normalized compact candidate.
     * @returns {boolean}
     */
    static #isOrderedSubsequence(query, candidate) {
        let cursor = 0

        for (const char of candidate) {
            if (char === query[cursor]) {
                cursor += 1
            }
            if (cursor === query.length) {
                return true
            }
        }

        return false
    }

    /**
     * Normalizes text for case-insensitive lookup.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #normalize(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
    }

    /**
     * Removes separators for fuzzy package-name matching.
     * @param {string} value Normalized value.
     * @returns {string}
     */
    static #compact(value) {
        return String(value || '').replace(/[^a-z0-9]+/gu, '')
    }
}
