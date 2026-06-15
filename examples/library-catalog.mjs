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
import { LibraryCatalogArtifactBuilder } from '../src/index.mjs'

/**
 * Builds library catalog rows from parsed library models.
 * @param {object} model Parsed model.
 * @returns {object[]}
 */
function catalogRows(model) {
    const artifact = catalogArtifact(model)
    if (artifact) {
        return artifact.entries.map((entry) => ({
            kind: entry.kind,
            name: entry.name,
            primitiveCount: entry.primitiveCount || '',
            rawRecordCount: entry.rawRecordCount || '',
            issueCount: entry.issueCodes.length,
            outputSvgKey: entry.outputSvgKey || ''
        }))
    }

    const footprintRows = (model.pcbLibrary?.footprints || []).map(
        (footprint) => ({
            kind: 'pcb-footprint',
            name: footprint.name || footprint.sourceStorage || '',
            primitiveCount:
                (footprint.pads || []).length +
                (footprint.tracks || []).length +
                (footprint.arcs || []).length +
                (footprint.vias || []).length +
                (footprint.fills || []).length +
                (footprint.regions || []).length,
            rawRecordCount: (footprint.rawRecords || []).length
        })
    )
    const sourceRows = (model.integratedLibrary?.sources || []).map(
        (source) => ({
            kind: source.fileType || 'source',
            name: source.name || source.fileName || '',
            primitiveCount: '',
            rawRecordCount: '',
            issueCount: '',
            outputSvgKey: ''
        })
    )

    return [...footprintRows, ...sourceRows]
}

/**
 * Builds a static catalog artifact for parsed library roots.
 * @param {object} model Parsed model.
 * @returns {object | null}
 */
function catalogArtifact(model) {
    if (model.schematicLibrary) {
        return LibraryCatalogArtifactBuilder.build({
            schematicLibraries: [model]
        })
    }
    if (model.pcbLibrary) {
        return LibraryCatalogArtifactBuilder.build({
            pcbLibraries: [model]
        })
    }

    return null
}

await runReadOnlyScript({
    scriptName: 'library-catalog',
    summary: 'Catalog parsed library contents without modifying source files.',
    helpLines: [
        'Default output is CSV. Use --json for structured rows.',
        'Use --html with SchLib/PcbLib inputs for a static catalog artifact.'
    ],
    run(model, args) {
        const artifact = catalogArtifact(model)
        if (args.includes('--html') && artifact) {
            console.log(artifact.html)
            return
        }
        const rows = catalogRows(model)
        if (wantsJson(args)) {
            printJson({
                ...modelIdentity(model),
                ...(artifact ? { catalog: artifact } : {}),
                rows
            })
            return
        }
        printCsv(
            [
                'kind',
                'name',
                'primitiveCount',
                'rawRecordCount',
                'issueCount',
                'outputSvgKey'
            ],
            rows
        )
    }
})
