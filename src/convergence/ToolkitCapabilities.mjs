// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { ToolkitCapabilities as SharedCapabilities } from 'circuitjson-toolkit'

const NATIVE = new Map([
    [
        'export.selected-part',
        'Export selected Altium parts through the retained native adapters.'
    ],
    ['parse.document', 'Parse native Altium documents into CircuitJSON.'],
    ['project.load', 'Load native Altium project entries.'],
    [
        'worker.load-project',
        'Load Altium projects through the shared protocol.'
    ],
    ['worker.parse', 'Parse Altium documents through the shared protocol.']
])

/**
 * Reports common and Altium-native capability availability.
 */
export class ToolkitCapabilities {
    /**
     * Returns fresh clone-safe capability rows in stable id order.
     * @returns {Record<string, any>[]} Capability inventory.
     */
    static inventory() {
        return SharedCapabilities.inventory().map((row) => {
            const summary = NATIVE.get(row.id)
            if (!summary) return { ...row }
            return {
                ...row,
                status: 'native',
                entrypoint:
                    row.id === 'export.selected-part'
                        ? 'altium-toolkit/extensions'
                        : row.id.startsWith('worker.')
                          ? 'altium-toolkit/workers/parser.worker.mjs'
                          : row.entrypoint,
                summary,
                reason: summary
            }
        })
    }
}

Object.freeze(ToolkitCapabilities.prototype)
Object.freeze(ToolkitCapabilities)
