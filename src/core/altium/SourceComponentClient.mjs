// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SourceComponentBundleNormalizer } from './SourceComponentBundleNormalizer.mjs'

/**
 * Fetches source component records through an injected HTTP fetcher.
 */
export class SourceComponentClient {
    #baseUrl

    #componentPath

    #fetcher

    #headers

    #modelPath

    #retryCount

    #retryDelayMs

    #searchPath

    /**
     * @param {{ fetcher?: Function, baseUrl?: string, searchPath?: string, componentPath?: string, modelPath?: string, retryCount?: number, retryDelayMs?: number, headers?: Record<string, string> }} [options] Client options.
     */
    constructor(options = {}) {
        this.#fetcher = options.fetcher || null
        this.#baseUrl = String(options.baseUrl || '').replace(/\/$/u, '')
        this.#searchPath = String(
            options.searchPath || '/api/components/search'
        )
        this.#componentPath = String(
            options.componentPath || '/api/components/{id}'
        )
        this.#modelPath = String(options.modelPath || '/api/models/{name}')
        this.#retryCount = Math.max(0, Number(options.retryCount || 0))
        this.#retryDelayMs = Math.max(0, Number(options.retryDelayMs || 0))
        this.#headers = { ...(options.headers || {}) }
    }

    /**
     * Searches provider components.
     * @param {string} query Search query.
     * @param {{ limit?: number }} [options] Search options.
     * @returns {Promise<{ id: string, name: string, raw: object }[]>}
     */
    async searchComponents(query, options = {}) {
        this.#assertFetcher()
        const url = new URL(this.#baseUrl + this.#searchPath)
        url.searchParams.set('q', String(query || ''))
        if (options.limit) {
            url.searchParams.set('limit', String(options.limit))
        }
        const json = await this.#requestJson(url)
        const rows = SourceComponentClient.#extractRows(json)

        return rows.map((row) => ({
            id: String(row.id || row.uuid || row.componentId || ''),
            name: String(row.name || row.title || row.id || ''),
            raw: row
        }))
    }

    /**
     * Fetches and normalizes one source component bundle.
     * @param {string} id Component identifier.
     * @returns {Promise<object>}
     */
    async fetchComponentBundle(id) {
        const json = await this.#requestJson(
            this.#resolveTemplateUrl(this.#componentPath, { id })
        )

        return SourceComponentBundleNormalizer.normalize(json)
    }

    /**
     * Fetches a model text asset.
     * @param {string} urlOrName URL or model name.
     * @returns {Promise<string>}
     */
    async fetchTextAsset(urlOrName) {
        const response = await this.#fetchWithRetry(
            this.#resolveAssetUrl(urlOrName)
        )
        if (typeof response.text === 'function') {
            return response.text()
        }

        const bytes = await SourceComponentClient.#responseBytes(response)
        return new TextDecoder().decode(bytes)
    }

    /**
     * Fetches a model binary asset.
     * @param {string} urlOrName URL or model name.
     * @returns {Promise<Uint8Array>}
     */
    async fetchBinaryAsset(urlOrName) {
        return SourceComponentClient.#responseBytes(
            await this.#fetchWithRetry(this.#resolveAssetUrl(urlOrName))
        )
    }

    /**
     * Requests JSON.
     * @param {URL | string} url Request URL.
     * @returns {Promise<any>}
     */
    async #requestJson(url) {
        const response = await this.#fetchWithRetry(url)
        if (typeof response.json === 'function') {
            return response.json()
        }

        return JSON.parse(await response.text())
    }

    /**
     * Fetches with retry.
     * @param {URL | string} url Request URL.
     * @returns {Promise<object>}
     */
    async #fetchWithRetry(url) {
        this.#assertFetcher()

        let lastError = null
        for (let attempt = 0; attempt <= this.#retryCount; attempt += 1) {
            try {
                const response = await this.#fetcher(String(url), {
                    headers: this.#headers
                })
                if (response?.ok !== false) {
                    return response
                }
                lastError = new Error(
                    'Source component request failed with status ' +
                        String(response.status || 0)
                )
            } catch (error) {
                lastError = error
            }

            if (attempt < this.#retryCount && this.#retryDelayMs) {
                await SourceComponentClient.#delay(this.#retryDelayMs)
            }
        }

        throw lastError
    }

    /**
     * Asserts that a fetcher was injected.
     * @returns {void}
     */
    #assertFetcher() {
        if (typeof this.#fetcher !== 'function') {
            throw new Error('SourceComponentClient fetcher is required.')
        }
    }

    /**
     * Resolves a URL template.
     * @param {string} template URL template.
     * @param {Record<string, string>} values Template values.
     * @returns {URL}
     */
    #resolveTemplateUrl(template, values) {
        const path = Object.entries(values).reduce(
            (nextPath, [key, value]) =>
                nextPath.replaceAll(
                    '{' + key + '}',
                    encodeURIComponent(String(value || ''))
                ),
            template
        )

        return new URL(this.#baseUrl + path)
    }

    /**
     * Resolves a model asset URL or name.
     * @param {string} urlOrName URL or model name.
     * @returns {URL}
     */
    #resolveAssetUrl(urlOrName) {
        const value = String(urlOrName || '')
        if (/^https?:\/\//iu.test(value)) {
            return new URL(value)
        }

        return this.#resolveTemplateUrl(this.#modelPath, { name: value })
    }

    /**
     * Extracts search rows from common response shapes.
     * @param {any} json Response JSON.
     * @returns {object[]}
     */
    static #extractRows(json) {
        const rows =
            json?.results ||
            json?.items ||
            json?.data?.results ||
            json?.data?.items ||
            json?.data ||
            json

        return Array.isArray(rows) ? rows : []
    }

    /**
     * Reads response bytes.
     * @param {object} response Response-like object.
     * @returns {Promise<Uint8Array>}
     */
    static async #responseBytes(response) {
        if (typeof response.arrayBuffer === 'function') {
            return new Uint8Array(await response.arrayBuffer())
        }

        return new TextEncoder().encode(await response.text())
    }

    /**
     * Delays retry execution.
     * @param {number} milliseconds Delay in milliseconds.
     * @returns {Promise<void>}
     */
    static #delay(milliseconds) {
        return new Promise((resolve) => {
            setTimeout(resolve, milliseconds)
        })
    }
}
