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
 * Builds schematic and PCB net report rows.
 * @param {object} model Parsed model.
 * @returns {object[]}
 */
function netRows(model) {
    const schematicRows = (model.schematic?.nets || []).map((net) => ({
        source: 'schematic',
        name: net.name || '',
        segmentCount: (net.segments || []).length,
        pinCount: (net.pins || []).length,
        primitiveCount: ''
    }))
    const pcbRows = (model.pcb?.nets || []).map((net) => ({
        source: 'pcb',
        name: net.name || '',
        segmentCount: '',
        pinCount: '',
        primitiveCount:
            model.pcb?.routeAnalysis?.nets?.[net.name]?.primitiveCount || ''
    }))

    return [...schematicRows, ...pcbRows].sort((left, right) =>
        (left.source + ':' + left.name).localeCompare(
            right.source + ':' + right.name
        )
    )
}

await runReadOnlyScript({
    scriptName: 'net-report',
    summary: 'Report recovered schematic and PCB net names.',
    helpLines: ['Default output is CSV. Use --json for structured rows.'],
    run(model, args) {
        const rows = netRows(model)
        if (wantsJson(args)) {
            printJson({
                ...modelIdentity(model),
                rows
            })
            return
        }
        printCsv(
            ['source', 'name', 'segmentCount', 'pinCount', 'primitiveCount'],
            rows
        )
    }
})
