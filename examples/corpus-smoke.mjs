#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join, relative, sep } from 'node:path'

import { AltiumParser } from '../src/extensions.mjs'
import {
    hasHelpFlag,
    inputPathFromArgs,
    printJson,
    wantsJson
} from './cli-utils.mjs'

const INPUT_EXTENSIONS = new Set([
    '.schdoc',
    '.pcbdoc',
    '.schlib',
    '.pcblib',
    '.prjpcb',
    '.prjscr',
    '.intlib',
    '.pcbdwf'
])
const TOP_FIELD_GAP_LIMIT = 20
const TEXT_FIELD_GAP_LIMIT = 5

/**
 * Prints script help.
 * @returns {void}
 */
function printCorpusHelp() {
    console.log(
        [
            'Usage: corpus-smoke <directory> [--json] [--coverage]',
            '',
            'Parse every supported local design file under a directory and summarize results.',
            '',
            'This is a read-only example. It reads input files and writes report output to stdout.',
            'Supported extensions: ' + [...INPUT_EXTENSIONS].sort().join(', ')
        ].join('\n')
    )
}

/**
 * Prints an input usage error.
 * @returns {void}
 */
function printMissingDirectory() {
    console.error('Usage: corpus-smoke <directory> [--json] [--coverage]')
    console.error('Run `corpus-smoke --help` for details.')
    process.exitCode = 1
}

/**
 * Returns true when parser coverage output was requested.
 * @param {string[]} args Command-line arguments.
 * @returns {boolean}
 */
function wantsCoverage(args) {
    return args.includes('--coverage')
}

/**
 * Recursively lists supported input files under one directory.
 * @param {string} directory Root directory.
 * @returns {Promise<string[]>}
 */
async function listInputFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = []

    for (const entry of entries.sort((left, right) =>
        left.name.localeCompare(right.name)
    )) {
        const filePath = join(directory, entry.name)

        if (entry.isDirectory()) {
            files.push(...(await listInputFiles(filePath)))
            continue
        }

        if (
            entry.isFile() &&
            INPUT_EXTENSIONS.has(extname(entry.name).toLowerCase())
        ) {
            files.push(filePath)
        }
    }

    return files
}

/**
 * Parses one corpus file into a report row.
 * @param {string} rootDirectory Corpus root directory.
 * @param {string} filePath File to parse.
 * @returns {Promise<object>}
 */
async function parseCorpusFile(rootDirectory, filePath) {
    const bytes = await readFile(filePath)
    const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    )
    const result = AltiumParser.tryParseArrayBufferToRendererModel(
        basename(filePath),
        arrayBuffer
    )
    const relativePath = relative(rootDirectory, filePath).split(sep).join('/')

    if (!result.ok) {
        return {
            relativePath,
            status: 'failed',
            message: result.diagnostics[0]?.message || 'Parse failed.'
        }
    }

    return {
        relativePath,
        status: 'parsed',
        fileType: result.model.fileType,
        kind: result.model.kind,
        title: result.model.summary?.title || result.model.fileName,
        diagnosticCount: result.diagnostics.length,
        coverage: {
            recordTypes: extractRecordTypes(result.model),
            fieldCoverage: extractFieldCoverage(result.model)
        }
    }
}

/**
 * Builds a deterministic corpus parse report.
 * @param {string} rootDirectory Corpus root directory.
 * @param {boolean} includeCoverage Whether to include coverage counters.
 * @returns {Promise<{ summary: object, files: object[] }>}
 */
async function buildCorpusReport(rootDirectory, includeCoverage = false) {
    const filePaths = await listInputFiles(rootDirectory)
    const files = []

    for (const filePath of filePaths) {
        files.push(await parseCorpusFile(rootDirectory, filePath))
    }

    const report = {
        summary: {
            fileCount: files.length,
            parsedCount: files.filter((file) => file.status === 'parsed')
                .length,
            failedCount: files.filter((file) => file.status === 'failed').length
        },
        files: files.map((file) => publicFileRow(file))
    }

    if (includeCoverage) {
        report.coverage = buildCoverageReport(files)
    }

    return report
}

/**
 * Removes private coverage helpers from one public file row.
 * @param {object} file Corpus file row.
 * @returns {object}
 */
function publicFileRow(file) {
    const { coverage, ...publicRow } = file
    return publicRow
}

/**
 * Extracts model record-type coverage rows.
 * @param {object} model Parsed renderer model.
 * @returns {object[]}
 */
function extractRecordTypes(model) {
    return [
        ...(model?.schematic?.recordTypes || []),
        ...(model?.schematicLibrary?.recordTypes || [])
    ]
}

/**
 * Extracts schematic field-coverage rows from one parsed model.
 * @param {object} model Parsed renderer model.
 * @returns {object}
 */
function extractFieldCoverage(model) {
    return model?.schematic?.qa?.fieldCoverage || { recordTypes: [] }
}

/**
 * Builds aggregate parser coverage counters from parsed corpus rows.
 * @param {object[]} files Internal corpus file rows.
 * @returns {object}
 */
function buildCoverageReport(files) {
    const parsedFiles = files.filter((file) => file.status === 'parsed')
    const recordTypes = aggregateRecordTypes(parsedFiles)
    const unsupportedRecordTypes = recordTypes.filter(
        (recordType) => !recordType.supported
    )
    const fieldGaps = aggregateFieldGaps(parsedFiles)
    const topUnrecognizedFields = buildTopUnrecognizedFields(fieldGaps)

    return {
        summary: {
            parsedFileCount: parsedFiles.length,
            fileTypeCount: countByProperty(parsedFiles, 'fileType').length,
            kindCount: countByProperty(parsedFiles, 'kind').length,
            recordTypeCount: recordTypes.length,
            unsupportedRecordTypeCount: unsupportedRecordTypes.length,
            diagnosticCount: parsedFiles.reduce(
                (total, file) => total + file.diagnosticCount,
                0
            ),
            fieldGapRecordTypeCount: fieldGaps.length,
            unrecognizedFieldCount: fieldGaps.reduce(
                (total, row) => total + row.unrecognizedFieldCount,
                0
            ),
            unrecognizedFieldOccurrenceCount: fieldGaps.reduce(
                (total, row) => total + row.unrecognizedOccurrenceCount,
                0
            )
        },
        fileTypes: countByProperty(parsedFiles, 'fileType'),
        kinds: countByProperty(parsedFiles, 'kind'),
        recordTypes,
        unsupportedRecordTypes,
        fieldGaps,
        topUnrecognizedFields
    }
}

/**
 * Prints a compact text report.
 * @param {{ summary: object, files: object[] }} report Corpus report.
 * @returns {void}
 */
function printTextReport(report) {
    console.log('Corpus smoke report')
    console.log('Files: ' + report.summary.fileCount)
    console.log('Parsed: ' + report.summary.parsedCount)
    console.log('Failed: ' + report.summary.failedCount)
    if (report.coverage) {
        console.log('Record types: ' + report.coverage.summary.recordTypeCount)
        console.log(
            'Unsupported record types: ' +
                report.coverage.summary.unsupportedRecordTypeCount
        )
        console.log('Diagnostics: ' + report.coverage.summary.diagnosticCount)
        console.log(
            'Field gap record types: ' +
                report.coverage.summary.fieldGapRecordTypeCount
        )
        console.log(
            'Unrecognized fields: ' +
                report.coverage.summary.unrecognizedFieldCount
        )
        console.log(
            'Unrecognized field occurrences: ' +
                report.coverage.summary.unrecognizedFieldOccurrenceCount
        )
        printTopFieldGaps(report.coverage.topUnrecognizedFields)
    }

    for (const file of report.files) {
        console.log(file.status.toUpperCase() + ' ' + file.relativePath)
    }
}

/**
 * Prints the most frequent unrecognized source fields.
 * @param {object[]} fields Top field-gap rows.
 * @returns {void}
 */
function printTopFieldGaps(fields) {
    const rows = (fields || []).slice(0, TEXT_FIELD_GAP_LIMIT)
    if (!rows.length) {
        return
    }

    console.log('Top unrecognized fields:')
    for (const row of rows) {
        console.log(
            '  RECORD ' +
                row.recordType +
                ' ' +
                row.recordName +
                ' ' +
                row.fieldName +
                ': ' +
                row.count +
                ' in ' +
                row.fileCount +
                ' file(s)'
        )
    }
}

/**
 * Counts parsed files by one public property.
 * @param {object[]} files Parsed file rows.
 * @param {string} property Property to count.
 * @returns {object[]}
 */
function countByProperty(files, property) {
    const counts = new Map()

    for (const file of files) {
        const value = String(file[property] || '')
        if (!value) {
            continue
        }

        counts.set(value, (counts.get(value) || 0) + 1)
    }

    return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([value, count]) => ({ [property]: value, count }))
}

/**
 * Aggregates schematic record-type counts across parsed files.
 * @param {object[]} files Parsed file rows.
 * @returns {object[]}
 */
function aggregateRecordTypes(files) {
    const rowsByRecordType = new Map()

    for (const file of files) {
        const seenInFile = new Set()

        for (const recordType of file.coverage?.recordTypes || []) {
            const key = String(recordType.recordType)
            if (!rowsByRecordType.has(key)) {
                rowsByRecordType.set(key, {
                    recordType: recordType.recordType,
                    name: recordType.name,
                    family: recordType.family,
                    supported: recordType.supported,
                    count: 0,
                    fileCount: 0
                })
            }

            const row = rowsByRecordType.get(key)
            row.count += recordType.count || 0
            if (!seenInFile.has(key)) {
                row.fileCount += 1
                seenInFile.add(key)
            }
        }
    }

    return [...rowsByRecordType.values()].sort(
        (left, right) => left.recordType - right.recordType
    )
}

/**
 * Aggregates field-level coverage gaps across parsed schematic corpus files.
 * @param {object[]} files Parsed file rows.
 * @returns {object[]}
 */
function aggregateFieldGaps(files) {
    const rowsByRecordType = new Map()

    for (const file of files) {
        for (const recordType of file.coverage?.fieldCoverage?.recordTypes ||
            []) {
            const row = ensureFieldGapRow(rowsByRecordType, recordType)
            row.recordCount += recordType.recordCount || 0
            row.files.add(file.relativePath)

            for (const field of recordType.unrecognizedFields || []) {
                const fieldRow = ensureFieldGapField(row, field.name)
                fieldRow.count += field.count || 0
                fieldRow.files.add(file.relativePath)
            }
        }
    }

    return [...rowsByRecordType.values()]
        .map((row) => publicFieldGapRow(row))
        .sort((left, right) => left.recordType - right.recordType)
}

/**
 * Returns one mutable aggregate row for a record type.
 * @param {Map<string, object>} rowsByRecordType Aggregate rows.
 * @param {object} recordType Source coverage record-type row.
 * @returns {object}
 */
function ensureFieldGapRow(rowsByRecordType, recordType) {
    const key = String(recordType.recordType)
    if (!rowsByRecordType.has(key)) {
        rowsByRecordType.set(key, {
            recordType: recordType.recordType,
            name: recordType.name,
            family: recordType.family,
            supported: recordType.supported,
            recordCount: 0,
            files: new Set(),
            unrecognizedFields: new Map()
        })
    }

    return rowsByRecordType.get(key)
}

/**
 * Returns one mutable aggregate field row.
 * @param {{ unrecognizedFields: Map<string, object> }} row Aggregate row.
 * @param {string} name Field name.
 * @returns {object}
 */
function ensureFieldGapField(row, name) {
    if (!row.unrecognizedFields.has(name)) {
        row.unrecognizedFields.set(name, {
            name,
            count: 0,
            files: new Set()
        })
    }

    return row.unrecognizedFields.get(name)
}

/**
 * Converts one mutable field-gap row to public JSON.
 * @param {object} row Mutable aggregate row.
 * @returns {object}
 */
function publicFieldGapRow(row) {
    const unrecognizedFields = [...row.unrecognizedFields.values()]
        .map((field) => ({
            name: field.name,
            count: field.count,
            fileCount: field.files.size
        }))
        .sort(
            (left, right) =>
                right.count - left.count ||
                right.fileCount - left.fileCount ||
                left.name.localeCompare(right.name)
        )
    const unrecognizedOccurrenceCount = unrecognizedFields.reduce(
        (total, field) => total + field.count,
        0
    )

    return {
        recordType: row.recordType,
        name: row.name,
        family: row.family,
        supported: row.supported,
        recordCount: row.recordCount,
        fileCount: row.files.size,
        unrecognizedFieldCount: unrecognizedFields.length,
        unrecognizedOccurrenceCount,
        unrecognizedFields
    }
}

/**
 * Builds the highest-frequency unrecognized field rows.
 * @param {object[]} fieldGaps Aggregate field-gap rows.
 * @returns {object[]}
 */
function buildTopUnrecognizedFields(fieldGaps) {
    return (fieldGaps || [])
        .flatMap((recordType) =>
            recordType.unrecognizedFields.map((field) => ({
                recordType: recordType.recordType,
                recordName: recordType.name,
                family: recordType.family,
                supported: recordType.supported,
                fieldName: field.name,
                count: field.count,
                fileCount: field.fileCount
            }))
        )
        .sort(
            (left, right) =>
                right.count - left.count ||
                right.fileCount - left.fileCount ||
                left.recordType - right.recordType ||
                left.fieldName.localeCompare(right.fieldName)
        )
        .slice(0, TOP_FIELD_GAP_LIMIT)
}

const args = process.argv.slice(2)

if (hasHelpFlag(args)) {
    printCorpusHelp()
} else {
    const rootDirectory = inputPathFromArgs(args)

    if (!rootDirectory) {
        printMissingDirectory()
    } else {
        const report = await buildCorpusReport(
            rootDirectory,
            wantsCoverage(args)
        )

        if (wantsJson(args)) {
            printJson(report)
        } else {
            printTextReport(report)
        }
    }
}
