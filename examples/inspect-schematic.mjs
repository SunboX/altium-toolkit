#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import {
    modelIdentity,
    printJson,
    runReadOnlyScript,
    wantsJson
} from './cli-utils.mjs'

const VIEWS = new Set(['summary', 'flat', 'hierarchy', 'parts', 'nets', 'all'])

/**
 * Resolves the requested inspection view.
 * @param {string[]} args CLI arguments.
 * @returns {string}
 */
function viewFromArgs(args) {
    const inline = args.find((arg) => arg.startsWith('--view='))
    if (inline) {
        return inline.slice('--view='.length)
    }

    const index = args.indexOf('--view')
    if (index >= 0) {
        return args[index + 1] || ''
    }

    return 'summary'
}

/**
 * Returns true when a requested view is supported.
 * @param {string} view Requested view.
 * @returns {boolean}
 */
function isSupportedView(view) {
    return VIEWS.has(view)
}

/**
 * Builds one schematic inspection report.
 * @param {object} model Parsed model.
 * @param {string} view Requested view.
 * @returns {object}
 */
function buildReport(model, view) {
    const base = {
        ...modelIdentity(model),
        view,
        summary: buildSummary(model)
    }

    if (view === 'flat') {
        return {
            ...base,
            records: flatRecords(model)
        }
    }

    if (view === 'hierarchy') {
        return {
            ...base,
            hierarchy: schematic(model).ownership?.hierarchy || []
        }
    }

    if (view === 'parts') {
        return {
            ...base,
            parts: partRows(model)
        }
    }

    if (view === 'nets') {
        return {
            ...base,
            nets: schematic(model).nets || []
        }
    }

    if (view === 'all') {
        return {
            ...base,
            flat: flatRecords(model),
            hierarchy: schematic(model).ownership?.hierarchy || [],
            parts: partRows(model),
            nets: schematic(model).nets || []
        }
    }

    return {
        ...base,
        recordTypes: schematic(model).recordTypes || [],
        fieldCoverage: schematic(model).qa?.fieldCoverage || {
            recordTypes: []
        }
    }
}

/**
 * Builds a compact schematic summary.
 * @param {object} model Parsed model.
 * @returns {object}
 */
function buildSummary(model) {
    const root = schematic(model)
    const fieldCoverage = root.qa?.fieldCoverage?.summary || {}

    return {
        recordCount: (root.ownership?.records || []).length,
        topLevelRecordCount: (root.ownership?.hierarchy || []).length,
        componentCount: (root.components || []).length,
        netCount: (root.nets || []).length,
        diagnosticCount: (model.diagnostics || []).length,
        fieldGapRecordTypeCount: fieldCoverage.recordTypeCount || 0,
        unrecognizedFieldCount: fieldCoverage.unrecognizedFieldCount || 0
    }
}

/**
 * Returns the schematic root or an empty object.
 * @param {object} model Parsed model.
 * @returns {object}
 */
function schematic(model) {
    return model.schematic || {}
}

/**
 * Returns flat ownership records from the schematic sidecar.
 * @param {object} model Parsed model.
 * @returns {object[]}
 */
function flatRecords(model) {
    return schematic(model).ownership?.records || []
}

/**
 * Builds compact part rows with recovered pin counts.
 * @param {object} model Parsed model.
 * @returns {object[]}
 */
function partRows(model) {
    const root = schematic(model)
    const ownerIndexByDesignator = buildOwnerIndexByDesignator(root)

    return (root.components || []).map((component) => ({
        designator: component.designator || '',
        libReference: component.libReference || '',
        value: component.value || '',
        uniqueId: component.uniqueId || '',
        x: component.x,
        y: component.y,
        pinCount: pinCountForComponent(
            root,
            component.designator || '',
            ownerIndexByDesignator
        )
    }))
}

/**
 * Builds component owner-index lookups by visible designator.
 * @param {object} root Schematic root.
 * @returns {Map<string, string>}
 */
function buildOwnerIndexByDesignator(root) {
    const records = root.ownership?.records || []
    const ownerIndexByDesignator = new Map()

    for (const record of records) {
        if (record.recordType !== '1' || record.indexInSheet === undefined) {
            continue
        }

        const designator = findDesignatorForOwner(records, record.indexInSheet)
        if (designator) {
            ownerIndexByDesignator.set(designator, String(record.indexInSheet))
        }
    }

    return ownerIndexByDesignator
}

/**
 * Finds a visible designator text record for one component owner index.
 * @param {object[]} records Ownership sidecar records.
 * @param {number | string} ownerIndex Component owner index.
 * @returns {string}
 */
function findDesignatorForOwner(records, ownerIndex) {
    const owner = String(ownerIndex)
    const record = records.find(
        (item) =>
            String(item.ownerIndex || '') === owner &&
            String(item.name || '').toLowerCase() === 'designator' &&
            String(item.text || '').trim()
    )

    return String(record?.text || '').trim()
}

/**
 * Counts pins belonging to one recovered component.
 * @param {object} root Schematic root.
 * @param {string} designator Component designator.
 * @param {Map<string, string>} ownerIndexByDesignator Owner index lookup.
 * @returns {number}
 */
function pinCountForComponent(root, designator, ownerIndexByDesignator) {
    const ownerIndex = ownerIndexByDesignator.get(designator) || ''

    return (root.pins || []).filter((pin) => {
        if (pin.componentDesignator === designator) {
            return true
        }

        return ownerIndex && String(pin.ownerIndex || '') === ownerIndex
    }).length
}

/**
 * Prints a text report for the requested view.
 * @param {object} report Inspection report.
 * @returns {void}
 */
function printTextReport(report) {
    if (report.view === 'flat') {
        printFlatText(report)
        return
    }

    if (report.view === 'hierarchy') {
        printHierarchyText(report)
        return
    }

    if (report.view === 'parts') {
        printPartsText(report)
        return
    }

    if (report.view === 'nets') {
        printNetsText(report)
        return
    }

    if (report.view === 'all') {
        printAllText(report)
        return
    }

    printSummaryText(report)
}

/**
 * Prints the summary view.
 * @param {object} report Inspection report.
 * @returns {void}
 */
function printSummaryText(report) {
    console.log(report.title)
    console.log('Type: ' + report.fileType)
    console.log('Kind: ' + report.kind)
    console.log('Records: ' + report.summary.recordCount)
    console.log('Components: ' + report.summary.componentCount)
    console.log('Nets: ' + report.summary.netCount)
    console.log('Diagnostics: ' + report.summary.diagnosticCount)
    console.log('Unrecognized fields: ' + report.summary.unrecognizedFieldCount)
}

/**
 * Prints all compact schematic views.
 * @param {object} report Inspection report.
 * @returns {void}
 */
function printAllText(report) {
    printSummaryText(report)
    console.log('')
    printFlatText({ ...report, records: report.flat || [] })
    console.log('')
    printHierarchyText(report)
    console.log('')
    printPartsText(report)
    console.log('')
    printNetsText(report)
}

/**
 * Prints the flat record view.
 * @param {object} report Inspection report.
 * @returns {void}
 */
function printFlatText(report) {
    console.log(report.title + ' flat records')
    for (const record of report.records || []) {
        console.log(recordLine(record))
    }
}

/**
 * Prints the hierarchy view.
 * @param {object} report Inspection report.
 * @returns {void}
 */
function printHierarchyText(report) {
    console.log(report.title + ' hierarchy')
    for (const node of report.hierarchy || []) {
        printHierarchyNode(node, 0)
    }
}

/**
 * Prints one hierarchy node and its descendants.
 * @param {object} node Hierarchy node.
 * @param {number} depth Nesting depth.
 * @returns {void}
 */
function printHierarchyNode(node, depth) {
    console.log('  '.repeat(depth) + recordLine(node))
    for (const child of node.children || []) {
        printHierarchyNode(child, depth + 1)
    }
}

/**
 * Prints compact part rows.
 * @param {object} report Inspection report.
 * @returns {void}
 */
function printPartsText(report) {
    console.log(report.title + ' parts')
    for (const part of report.parts || []) {
        console.log(
            [
                part.designator || '(unnamed)',
                part.libReference || '(no-library)',
                'pins=' + part.pinCount
            ].join(' ')
        )
    }
}

/**
 * Prints compact net rows.
 * @param {object} report Inspection report.
 * @returns {void}
 */
function printNetsText(report) {
    console.log(report.title + ' nets')
    for (const net of report.nets || []) {
        console.log(
            [
                net.name || '(unnamed)',
                'segments=' + (net.segments || []).length,
                'pins=' + (net.pins || []).length,
                'labels=' + (net.labels || []).length
            ].join(' ')
        )
    }
}

/**
 * Builds one readable record line.
 * @param {object} record Ownership sidecar record.
 * @returns {string}
 */
function recordLine(record) {
    const label = [record.name, record.text].filter(Boolean).join('=')

    return ['#' + record.recordIndex, 'RECORD=' + record.recordType, label]
        .filter(Boolean)
        .join(' ')
}

await runReadOnlyScript({
    scriptName: 'inspect-schematic',
    summary: 'Inspect a parsed schematic and print a read-only view.',
    helpLines: [
        'Use --view summary, flat, hierarchy, parts, nets, or all.',
        'Use --json for the full structured view.'
    ],
    run(model, args) {
        const view = viewFromArgs(args)
        if (!isSupportedView(view)) {
            console.error(
                'Unsupported view "' +
                    view +
                    '". Use summary, flat, hierarchy, parts, nets, or all.'
            )
            process.exitCode = 1
            return
        }

        const report = buildReport(model, view)
        if (wantsJson(args)) {
            printJson(report)
            return
        }

        printTextReport(report)
    }
})
