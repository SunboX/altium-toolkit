// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { ToolkitWorkerProtocol } from 'circuitjson-toolkit/parser'

import { Parser } from '../convergence/Parser.mjs'
import { ProjectLoader } from '../convergence/ProjectLoader.mjs'

ToolkitWorkerProtocol.install(self, {
    /**
     * Parses one worker payload through the direct Altium path.
     * @param {Record<string, any>} payload Protocol payload.
     * @param {Record<string, any>} runtime Request runtime.
     * @returns {Promise<Record<string, any>>} Canonical document.
     */
    parse: async (payload, runtime) =>
        await Parser.parseAsync(payload.input, {
            ...(payload.options || {}),
            worker: false,
            signal: runtime.signal,
            onProgress: runtime.onProgress
        }),

    /**
     * Loads one worker project through the direct Altium path.
     * @param {Record<string, any>} payload Protocol payload.
     * @param {Record<string, any>} runtime Request runtime.
     * @returns {Promise<Record<string, any>>} Canonical project.
     */
    loadProject: async (payload, runtime) =>
        await ProjectLoader.loadAsync(payload.entries, {
            ...(payload.options || {}),
            worker: false,
            signal: runtime.signal,
            onProgress: runtime.onProgress
        })
})
