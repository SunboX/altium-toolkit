#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { LibraryQaReportBuilder } from '../src/index.mjs'

import {
    modelIdentity,
    printJson,
    runReadOnlyScript,
    wantsJson
} from './cli-utils.mjs'

/**
 * Builds a read-only library QA report for one parsed model.
 * @param {object} model Parsed model.
 * @returns {object}
 */
function validationReport(model) {
    const report = LibraryQaReportBuilder.build({
        pcbLibraries: model.pcbLibrary ? [model] : [],
        schematicLibraries: model.schematicLibrary ? [model] : []
    })

    return {
        ...modelIdentity(model),
        report
    }
}

/**
 * Prints a concise validation summary.
 * @param {object} report Validation report.
 * @returns {void}
 */
function printTextReport(report) {
    console.log(report.title)
    console.log('Type: ' + report.fileType)
    console.log('Issues: ' + report.report.summary.issueCount)
    console.log(
        'Duplicate footprints: ' + report.report.summary.duplicateFootprintCount
    )
    console.log('Missing models: ' + report.report.summary.missingModelCount)
}

await runReadOnlyScript({
    scriptName: 'validate-library',
    summary: 'Run read-only library QA checks against a parsed library file.',
    helpLines: ['Use --json for the full structured QA report.'],
    run(model, args) {
        const report = validationReport(model)
        if (wantsJson(args)) {
            printJson(report)
            return
        }
        printTextReport(report)
    }
})
