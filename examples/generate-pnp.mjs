#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import {
    modelIdentity,
    printCsv,
    printJson,
    runReadOnlyScript,
    wantsJson
} from './cli-utils.mjs'

/**
 * Returns normalized pick-and-place entries from a parsed model.
 * @param {object} model Parsed model.
 * @returns {object[]}
 */
function pnpRows(model) {
    const entries = model.pnp?.entries || model.pcb?.pickPlace?.entries || []
    return entries.map((entry) => ({
        designator: entry.designator || '',
        pattern: entry.pattern || '',
        layer: entry.layer || '',
        x: entry.x ?? '',
        y: entry.y ?? '',
        rotation: entry.rotation ?? '',
        positionSource: entry.positionSource || ''
    }))
}

await runReadOnlyScript({
    scriptName: 'generate-pnp',
    summary: 'Generate a read-only pick-and-place CSV from a parsed PCB model.',
    helpLines: ['Default output is CSV. Use --json for structured rows.'],
    run(model, args) {
        const rows = pnpRows(model)
        if (wantsJson(args)) {
            printJson({
                ...modelIdentity(model),
                units: model.pnp?.units || model.pcb?.pickPlace?.units || {},
                rows
            })
            return
        }
        printCsv(
            [
                'designator',
                'pattern',
                'layer',
                'x',
                'y',
                'rotation',
                'positionSource'
            ],
            rows
        )
    }
})
