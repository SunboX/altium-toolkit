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
 * Normalizes BOM rows for report and CSV output.
 * @param {object} model Parsed model.
 * @returns {object[]}
 */
function bomRows(model) {
    return (model.bom || []).map((row) => ({
        quantity: row.quantity || (row.designators || []).length || 0,
        designators: (row.designators || []).join(' '),
        pattern: row.pattern || '',
        value: row.value || '',
        source: row.source || ''
    }))
}

await runReadOnlyScript({
    scriptName: 'extract-bom',
    summary: 'Extract grouped BOM rows from a parsed design.',
    helpLines: ['Default output is CSV. Use --json for structured rows.'],
    run(model, args) {
        const rows = bomRows(model)
        if (wantsJson(args)) {
            printJson({
                ...modelIdentity(model),
                rows
            })
            return
        }
        printCsv(
            ['quantity', 'designators', 'pattern', 'value', 'source'],
            rows
        )
    }
})
