// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const DIAGNOSTIC_METADATA_KEYS = Object.freeze([
    'source',
    'sourceStorage',
    'sourceStream',
    'fileName',
    'recordIndex',
    'recordType',
    'fieldName',
    'contextKey',
    'errorKind'
])

/**
 * Normalizes parser diagnostics into one reusable, machine-readable envelope.
 */
export class ParserDiagnosticNormalizer {
    static SCHEMA = 'altium-toolkit.parser-diagnostics.a1'

    /**
     * Normalizes one diagnostic entry.
     * @param {object | string | Error} diagnostic Diagnostic entry.
     * @param {object} [defaults] Default metadata applied when absent.
     * @returns {object}
     */
    static normalize(diagnostic, defaults = {}) {
        const source = ParserDiagnosticNormalizer.#diagnosticObject(diagnostic)
        const message = ParserDiagnosticNormalizer.#message(source, defaults)
        const normalized = {
            code: ParserDiagnosticNormalizer.#code(source, defaults, message),
            severity: ParserDiagnosticNormalizer.#severity(source, defaults),
            message
        }

        for (const key of DIAGNOSTIC_METADATA_KEYS) {
            const value =
                source[key] === undefined ? defaults[key] : source[key]
            if (value === undefined || value === null || value === '') {
                continue
            }

            normalized[key] =
                key === 'recordIndex'
                    ? ParserDiagnosticNormalizer.#recordIndex(value)
                    : value
        }

        for (const [key, value] of Object.entries(source)) {
            if (
                key === 'code' ||
                key === 'severity' ||
                key === 'message' ||
                DIAGNOSTIC_METADATA_KEYS.includes(key) ||
                value === undefined
            ) {
                continue
            }

            normalized[key] = value
        }

        return normalized
    }

    /**
     * Normalizes a diagnostic list.
     * @param {(object | string | Error)[]} diagnostics Diagnostic entries.
     * @param {object} [defaults] Default metadata applied when absent.
     * @returns {object[]}
     */
    static normalizeMany(diagnostics, defaults = {}) {
        return (diagnostics || []).map((diagnostic) =>
            ParserDiagnosticNormalizer.normalize(diagnostic, defaults)
        )
    }

    /**
     * Builds a structured diagnostic report.
     * @param {{ diagnostics?: (object | string | Error)[], defaults?: object } | (object | string | Error)[]} [input]
     * @returns {object}
     */
    static buildReport(input = {}) {
        const diagnostics = Array.isArray(input)
            ? input
            : input.diagnostics || []
        const defaults = Array.isArray(input) ? {} : input.defaults || {}
        const normalized = ParserDiagnosticNormalizer.normalizeMany(
            diagnostics,
            defaults
        )

        return {
            schema: ParserDiagnosticNormalizer.SCHEMA,
            summary: ParserDiagnosticNormalizer.summarize(normalized),
            diagnostics: normalized
        }
    }

    /**
     * Summarizes normalized diagnostics by severity.
     * @param {object[]} diagnostics Normalized diagnostics.
     * @returns {{ diagnosticCount: number, infoCount: number, warningCount: number, errorCount: number }}
     */
    static summarize(diagnostics) {
        const rows = diagnostics || []

        return {
            diagnosticCount: rows.length,
            infoCount: rows.filter(
                (diagnostic) => diagnostic.severity === 'info'
            ).length,
            warningCount: rows.filter(
                (diagnostic) => diagnostic.severity === 'warning'
            ).length,
            errorCount: rows.filter(
                (diagnostic) => diagnostic.severity === 'error'
            ).length
        }
    }

    /**
     * Converts supported diagnostic inputs into plain objects.
     * @param {object | string | Error} diagnostic Diagnostic entry.
     * @returns {object}
     */
    static #diagnosticObject(diagnostic) {
        if (diagnostic instanceof Error) {
            const source = {
                severity: 'error',
                message: diagnostic.message
            }

            for (const [key, value] of Object.entries(diagnostic)) {
                if (key === 'name' || key === 'stack' || key === 'cause') {
                    continue
                }

                source[key] = value
            }

            return source
        }

        if (typeof diagnostic === 'string') {
            return { message: diagnostic }
        }

        return diagnostic && typeof diagnostic === 'object' ? diagnostic : {}
    }

    /**
     * Resolves one diagnostic message.
     * @param {object} diagnostic Diagnostic object.
     * @param {object} defaults Default metadata.
     * @returns {string}
     */
    static #message(diagnostic, defaults) {
        return String(
            diagnostic.message || defaults.message || 'Parser diagnostic'
        )
    }

    /**
     * Resolves one stable diagnostic code.
     * @param {object} diagnostic Diagnostic object.
     * @param {object} defaults Default metadata.
     * @param {string} message Normalized message.
     * @returns {string}
     */
    static #code(diagnostic, defaults, message) {
        const explicitCode = String(
            diagnostic.code || defaults.code || ''
        ).trim()
        if (explicitCode) return explicitCode

        const slug = message
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '.')
            .replace(/^\.+|\.+$/gu, '')
            .slice(0, 80)

        return 'parser.' + (slug || 'diagnostic')
    }

    /**
     * Resolves one normalized severity.
     * @param {object} diagnostic Diagnostic object.
     * @param {object} defaults Default metadata.
     * @returns {'info' | 'warning' | 'error'}
     */
    static #severity(diagnostic, defaults) {
        const value = String(diagnostic.severity || defaults.severity || 'info')
            .trim()
            .toLowerCase()

        if (value === 'warn' || value === 'warning') return 'warning'
        if (value === 'error' || value === 'fatal') return 'error'
        return 'info'
    }

    /**
     * Normalizes a record index while preserving nonnumeric identifiers.
     * @param {unknown} value Record index value.
     * @returns {number | unknown}
     */
    static #recordIndex(value) {
        const numeric = Number(value)
        return Number.isInteger(numeric) ? numeric : value
    }
}
