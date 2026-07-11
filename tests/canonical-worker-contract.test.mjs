// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { ToolkitContractFixtures } from 'circuitjson-toolkit/testing'

import { AltiumWorkerClient } from '../src/convergence/AltiumWorkerClient.mjs'
import { Parser } from '../src/convergence/Parser.mjs'
import { ProjectLoader } from '../src/convergence/ProjectLoader.mjs'

const FIXTURES = ToolkitContractFixtures.altium()

/**
 * Runs one callback with a temporary Worker constructor.
 * @param {Function} WorkerConstructor Worker replacement.
 * @param {Function} callback Test callback.
 * @returns {Promise<void>} Completion promise.
 */
async function withWorker(WorkerConstructor, callback) {
    const original = globalThis.Worker
    AltiumWorkerClient.dispose()
    globalThis.Worker = WorkerConstructor
    try {
        await callback()
    } finally {
        AltiumWorkerClient.dispose()
        if (original === undefined) delete globalThis.Worker
        else globalThis.Worker = original
    }
}

/**
 * Creates a Worker constructor that returns one valid protocol error.
 * @param {{ parse: number, loadProject: number }} observations Request counts.
 * @returns {Function} Worker constructor.
 */
function failingWorker(observations) {
    return class FailingWorker {
        #listeners = new Map()

        /** @param {string} type Event type. @param {Function} listener Listener. */
        addEventListener(type, listener) {
            if (!this.#listeners.has(type)) {
                this.#listeners.set(type, new Set())
            }
            this.#listeners.get(type).add(listener)
        }

        /** @param {string} type Event type. @param {Function} listener Listener. */
        removeEventListener(type, listener) {
            this.#listeners.get(type)?.delete(listener)
        }

        /**
         * Answers a request with a clone-safe sentinel parser failure.
         * @param {Record<string, any>} message Worker request.
         * @returns {void}
         */
        postMessage(message) {
            observations[message.type] += 1
            const response = structuredClone({
                protocol: 'ecad-toolkit.worker.v1',
                type: 'error',
                requestId: message.requestId,
                error: {
                    name: 'ToolkitError',
                    message: 'Sentinel worker parse failure.',
                    code: 'ERR_SENTINEL_WORKER',
                    category: 'parse',
                    format: 'altium',
                    source: '',
                    location: null,
                    details: {},
                    cause: null
                },
                diagnostics: []
            })
            queueMicrotask(() => {
                for (const listener of this.#listeners.get('message') || []) {
                    listener({ data: response })
                }
            })
        }

        /** Releases worker listeners. */
        terminate() {
            this.#listeners.clear()
        }
    }
}

test('parser auto mode preserves worker parser failures without direct fallback', async () => {
    const observations = { parse: 0, loadProject: 0 }
    const WorkerConstructor = failingWorker(observations)

    await withWorker(WorkerConstructor, async () => {
        await assert.rejects(
            Parser.parseAsync(FIXTURES.parserInput, { worker: 'auto' }),
            (error) => error?.code === 'ERR_SENTINEL_WORKER'
        )
        assert.equal(observations.parse, 1)
    })
})

test('project auto mode preserves worker parser failures without direct fallback', async () => {
    const observations = { parse: 0, loadProject: 0 }
    const WorkerConstructor = failingWorker(observations)

    await withWorker(WorkerConstructor, async () => {
        await assert.rejects(
            ProjectLoader.loadAsync(FIXTURES.projectEntries, {
                worker: 'auto'
            }),
            (error) => error?.code === 'ERR_SENTINEL_WORKER'
        )
        assert.equal(observations.loadProject, 1)
    })
})

test('auto mode falls back only when worker construction is unavailable', async () => {
    class UnavailableWorker {
        /** Throws to model a host with an unusable Worker constructor. */
        constructor() {
            throw new Error('Worker construction is unavailable.')
        }
    }

    await withWorker(UnavailableWorker, async () => {
        const document = await Parser.parseAsync(FIXTURES.parserInput, {
            worker: 'auto'
        })
        assert.equal(document.source.format, 'altium')

        const project = await ProjectLoader.loadAsync(FIXTURES.projectEntries, {
            worker: 'auto'
        })
        assert.equal(project.source.format, 'altium')
    })
})
