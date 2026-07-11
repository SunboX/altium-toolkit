#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import {
    ParserFieldCoverageReportBuilder,
    RawDataPreservationReportBuilder
} from '../src/extensions.mjs'

import {
    modelIdentity,
    printJson,
    runReadOnlyScript,
    wantsJson
} from './cli-utils.mjs'

/**
 * Builds a compact board inspection report.
 * @param {object} model Parsed model.
 * @returns {object}
 */
function buildReport(model) {
    return {
        ...modelIdentity(model),
        summary: model.summary || {},
        diagnostics: model.diagnostics || [],
        parserFieldCoverage: ParserFieldCoverageReportBuilder.build({
            models: [model]
        }),
        rawDataPreservation: RawDataPreservationReportBuilder.build({
            models: [model]
        })
    }
}

/**
 * Prints a text board inspection report.
 * @param {object} report Board report.
 * @returns {void}
 */
function printTextReport(report) {
    console.log(report.title)
    console.log('Type: ' + report.fileType)
    console.log('Kind: ' + report.kind)
    console.log('Components: ' + (report.summary.componentCount || 0))
    console.log('Nets: ' + (report.summary.netCount || 0))
    console.log('Layers: ' + (report.summary.layerCount || 0))
    console.log(
        'Raw records: ' +
            report.rawDataPreservation.summary.rawRecordCount +
            ' preserved'
    )
    console.log('Diagnostics: ' + report.diagnostics.length)
}

await runReadOnlyScript({
    scriptName: 'inspect-board',
    summary:
        'Inspect a parsed design or library and print a read-only summary.',
    helpLines: ['Use --json for the full structured inspection report.'],
    run(model, args) {
        const report = buildReport(model)
        if (wantsJson(args)) {
            printJson(report)
            return
        }
        printTextReport(report)
    }
})
