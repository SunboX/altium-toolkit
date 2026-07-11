// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserWorkerClient } from 'circuitjson-toolkit/parser'

let client = null

/**
 * Owns the source-format worker client while reusing the shared protocol.
 */
export class AltiumWorkerClient {
    /** @returns {boolean} Whether a browser-compatible Worker is available. */
    static isAvailable() {
        try {
            return typeof globalThis.Worker === 'function'
        } catch {
            return false
        }
    }

    /**
     * Parses one request through the shared worker protocol.
     * @param {Record<string, any>} input Parser input.
     * @param {Record<string, any>} options Common parser options.
     * @returns {Promise<Record<string, any>>} Canonical document.
     */
    static async parse(input, options) {
        return await AltiumWorkerClient.#client().parse(input, options)
    }

    /**
     * Parses through the worker while distinguishing local construction
     * unavailability from parser, protocol, and runtime failures.
     * @param {Record<string, any>} input Parser input.
     * @param {Record<string, any>} options Common parser options.
     * @returns {Promise<{ ok: true, value: object } | { ok: false, error: unknown, unavailable: boolean }>} Attempt result.
     */
    static async parseAttempt(input, options) {
        return await AltiumWorkerClient.#client().parseAttempt(input, options)
    }

    /**
     * Loads one project through the shared worker protocol.
     * @param {Record<string, any>[]} entries Project entries.
     * @param {Record<string, any>} options Common loader options.
     * @returns {Promise<Record<string, any>>} Canonical project.
     */
    static async loadProject(entries, options) {
        return await AltiumWorkerClient.#client().loadProject(entries, options)
    }

    /**
     * Loads through the worker while preserving operation failures.
     * @param {Record<string, any>[]} entries Project entries.
     * @param {Record<string, any>} options Common loader options.
     * @returns {Promise<{ ok: true, value: object } | { ok: false, error: unknown, unavailable: boolean }>} Attempt result.
     */
    static async loadProjectAttempt(entries, options) {
        return await AltiumWorkerClient.#client().loadProjectAttempt(
            entries,
            options
        )
    }

    /** Disposes the current source worker client. */
    static dispose() {
        client?.dispose()
        client = null
    }

    /**
     * Returns the lazy source worker client.
     * @returns {ParserWorkerClient} Shared-protocol client.
     */
    static #client() {
        if (!client) {
            client = new ParserWorkerClient({
                createWorker: () => {
                    const WorkerConstructor = globalThis.Worker
                    return Reflect.construct(WorkerConstructor, [
                        new URL(
                            '../workers/parser.worker.mjs',
                            import.meta.url
                        ),
                        { type: 'module' }
                    ])
                }
            })
        }
        return client
    }
}

Object.freeze(AltiumWorkerClient.prototype)
Object.freeze(AltiumWorkerClient)
