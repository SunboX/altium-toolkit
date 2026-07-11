// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { AltiumParser } from '../src/extensions.mjs'

/**
 * Returns true when help was requested.
 * @param {string[]} args CLI arguments.
 * @returns {boolean}
 */
export function hasHelpFlag(args) {
    return args.includes('--help') || args.includes('-h')
}

/**
 * Prints a read-only script help message.
 * @param {string} scriptName Script name.
 * @param {string} summary Script summary.
 * @param {string[]} lines Additional help lines.
 * @returns {void}
 */
export function printHelp(scriptName, summary, lines = []) {
    console.log(
        [
            'Usage: ' + scriptName + ' <file> [--json]',
            '',
            summary,
            '',
            'This is a read-only example. It reads the input file and writes report output to stdout.',
            ...lines
        ].join('\n')
    )
}

/**
 * Resolves the first non-option argument as an input path.
 * @param {string[]} args CLI arguments.
 * @returns {string}
 */
export function inputPathFromArgs(args) {
    return args.find((arg) => !arg.startsWith('-')) || ''
}

/**
 * Returns true when JSON output was requested.
 * @param {string[]} args CLI arguments.
 * @returns {boolean}
 */
export function wantsJson(args) {
    return args.includes('--json')
}

/**
 * Parses an Altium file from disk using the library parser.
 * @param {string} filePath Input path.
 * @returns {Promise<object>}
 */
export async function parseModelFromPath(filePath) {
    const bytes = await readFile(filePath)
    const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    )
    return AltiumParser.parseArrayBuffer(basename(filePath), arrayBuffer)
}

/**
 * Prints a JSON value with deterministic indentation.
 * @param {unknown} value JSON-compatible value.
 * @returns {void}
 */
export function printJson(value) {
    console.log(JSON.stringify(value, null, 4))
}

/**
 * Prints an error and marks the process as failed.
 * @param {string} scriptName Script name.
 * @returns {void}
 */
export function printMissingPath(scriptName) {
    console.error('Usage: ' + scriptName + ' <file> [--json]')
    console.error('Run `' + scriptName + ' --help` for details.')
    process.exitCode = 1
}

/**
 * Escapes one CSV field.
 * @param {unknown} value Field value.
 * @returns {string}
 */
export function csvField(value) {
    const text = String(value ?? '')
    return /[",\n\r]/u.test(text) ? '"' + text.replace(/"/gu, '""') + '"' : text
}

/**
 * Prints CSV rows.
 * @param {string[]} headers CSV headers.
 * @param {object[]} rows Data rows.
 * @returns {void}
 */
export function printCsv(headers, rows) {
    console.log(headers.map(csvField).join(','))
    for (const row of rows) {
        console.log(headers.map((header) => csvField(row[header])).join(','))
    }
}

/**
 * Returns a compact parser identity for report output.
 * @param {object} model Parsed model.
 * @returns {object}
 */
export function modelIdentity(model) {
    return {
        fileName: model.fileName,
        fileType: model.fileType,
        kind: model.kind,
        title: model.summary?.title || model.fileName
    }
}

/**
 * Runs a read-only CLI script.
 * @param {{ scriptName: string, summary: string, helpLines?: string[], run: (model: object, args: string[]) => void | Promise<void> }} options Script options.
 * @returns {Promise<void>}
 */
export async function runReadOnlyScript(options) {
    const args = process.argv.slice(2)
    if (hasHelpFlag(args)) {
        printHelp(options.scriptName, options.summary, options.helpLines || [])
        return
    }

    const filePath = inputPathFromArgs(args)
    if (!filePath) {
        printMissingPath(options.scriptName)
        return
    }

    const model = await parseModelFromPath(filePath)
    await options.run(model, args)
}
