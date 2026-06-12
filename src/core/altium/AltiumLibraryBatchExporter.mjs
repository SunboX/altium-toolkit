// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumPcbLibExporter } from './AltiumPcbLibExporter.mjs'
import { AltiumSchLibExporter } from './AltiumSchLibExporter.mjs'
import { SourceBundleExporter } from './SourceBundleExporter.mjs'

/**
 * Orchestrates source lookup and local library export.
 */
export class AltiumLibraryBatchExporter {
    #client

    /**
     * @param {{ client?: { fetchComponentBundle?: Function, searchComponents?: Function } }} [options] Batch options.
     */
    constructor(options = {}) {
        this.#client = options.client || null
    }

    /**
     * Searches components and exports the matching ids.
     * @param {string} query Search query.
     * @param {object} [options] Export options.
     * @returns {Promise<object>}
     */
    async searchAndExport(query, options = {}) {
        const rows = await this.#requireClient().searchComponents(
            query,
            options
        )
        return this.exportIds(
            rows.map((row) => row.id).filter(Boolean),
            options
        )
    }

    /**
     * Exports one list of provider ids.
     * @param {string[]} ids Component ids.
     * @param {{ appendManifest?: { completedIds?: string[] }, includeSourceBundle?: boolean, includeSchLib?: boolean, includePcbLib?: boolean, merged?: boolean, continueOnError?: boolean, onProgress?: Function }} [options] Export options.
     * @returns {Promise<{ entries: object[], bundles: object[], diagnostics: object[], checkpoint: { completedIds: string[] } }>}
     */
    async exportIds(ids, options = {}) {
        const completedIds = [
            ...new Set(options.appendManifest?.completedIds || [])
        ]
        const completedSet = new Set(completedIds)
        const entries = []
        const bundles = []
        const diagnostics = []

        for (const id of ids
            .map((value) => String(value || ''))
            .filter(Boolean)) {
            if (completedSet.has(id)) {
                AltiumLibraryBatchExporter.#emitProgress(options, {
                    id,
                    status: 'skipped'
                })
                continue
            }

            try {
                const bundle =
                    await this.#requireClient().fetchComponentBundle(id)
                bundles.push(bundle)
                entries.push(
                    ...AltiumLibraryBatchExporter.#buildPerComponentEntries(
                        id,
                        bundle,
                        options
                    )
                )
                completedSet.add(id)
                completedIds.push(id)
                AltiumLibraryBatchExporter.#emitProgress(options, {
                    id,
                    status: 'exported'
                })
            } catch (error) {
                diagnostics.push({
                    id,
                    severity: 'error',
                    message: String(error?.message || error)
                })
                AltiumLibraryBatchExporter.#emitProgress(options, {
                    id,
                    status: 'failed'
                })
                if (!options.continueOnError) {
                    throw error
                }
            }
        }

        if (options.merged && bundles.length) {
            entries.push(
                ...AltiumLibraryBatchExporter.#buildMergedEntries(bundles)
            )
        }

        return {
            entries,
            bundles,
            diagnostics,
            checkpoint: { completedIds }
        }
    }

    /**
     * Builds per-component export entries.
     * @param {string} id Component id.
     * @param {object} bundle Normalized bundle.
     * @param {object} options Export options.
     * @returns {object[]}
     */
    static #buildPerComponentEntries(id, bundle, options) {
        const prefix = AltiumLibraryBatchExporter.#safePathSegment(id) + '/'
        const entries = []

        if (options.includeSourceBundle) {
            entries.push(
                ...SourceBundleExporter.export(bundle).entries.map((entry) => ({
                    ...entry,
                    path: prefix + entry.path
                }))
            )
        }

        if (options.includeSchLib) {
            entries.push({
                path: prefix + 'library.SchLib',
                bytes: AltiumSchLibExporter.export([bundle]),
                contentType: 'application/octet-stream'
            })
        }

        if (options.includePcbLib) {
            entries.push({
                path: prefix + 'library.PcbLib',
                bytes: AltiumPcbLibExporter.export([bundle]),
                contentType: 'application/octet-stream'
            })
        }

        return entries
    }

    /**
     * Builds merged library output entries.
     * @param {object[]} bundles Normalized bundles.
     * @returns {object[]}
     */
    static #buildMergedEntries(bundles) {
        return [
            {
                path: 'merged/library.SchLib',
                bytes: AltiumSchLibExporter.export(bundles),
                contentType: 'application/octet-stream'
            },
            {
                path: 'merged/library.PcbLib',
                bytes: AltiumPcbLibExporter.export(bundles),
                contentType: 'application/octet-stream'
            }
        ]
    }

    /**
     * Emits progress.
     * @param {object} options Export options.
     * @param {object} event Progress event.
     * @returns {void}
     */
    static #emitProgress(options, event) {
        if (typeof options.onProgress === 'function') {
            options.onProgress(event)
        }
    }

    /**
     * Sanitizes one path segment.
     * @param {string} value Raw value.
     * @returns {string}
     */
    static #safePathSegment(value) {
        return String(value || 'component').replace(
            /[\\/:\u0000-\u001f]/gu,
            '_'
        )
    }

    /**
     * Returns the configured client or throws.
     * @returns {{ fetchComponentBundle?: Function, searchComponents?: Function }}
     */
    #requireClient() {
        if (!this.#client) {
            throw new Error('AltiumLibraryBatchExporter client is required.')
        }

        return this.#client
    }
}
