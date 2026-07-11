// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import {
    ToolkitDiagnostic,
    ToolkitError,
    ToolkitProgress
} from 'circuitjson-toolkit/parser'

import { AltiumDocumentBuilder } from './AltiumDocumentBuilder.mjs'
import { AltiumWorkerClient } from './AltiumWorkerClient.mjs'
import { ParserInput } from './ParserInput.mjs'

const ABORTED_GETTER = Object.getOwnPropertyDescriptor(
    AbortSignal.prototype,
    'aborted'
)?.get
const PROGRESS_MESSAGES = {
    detect: 'Detecting Altium input.',
    decode: 'Decoding native Altium data.',
    validate: 'Validating canonical CircuitJSON.',
    complete: 'Altium parsing complete.'
}
const SUPPORTED_EXTENSION_IDS = new Set([
    'altium.native-model',
    'altium.project-context'
])

/**
 * Parses native Altium inputs into canonical CircuitJSON document envelopes.
 */
export class Parser {
    /**
     * Parses one input synchronously.
     * @param {Record<string, any>} input Common parser input.
     * @param {Record<string, any>} [options] Common parser options.
     * @returns {Record<string, any>} Canonical document.
     */
    static parse(input, options = {}) {
        try {
            const normalized = ParserInput.normalize(input, options)
            if (normalized.options.worker === true) {
                throw Parser.#error(
                    'Synchronous Altium parsing cannot use a worker.',
                    'ERR_WORKER_SYNC_UNAVAILABLE',
                    'unsupported',
                    normalized.input.fileName
                )
            }
            Parser.#assertSupported(normalized.input)
            Parser.#assertExtensions(normalized)
            Parser.#assertReports(normalized)
            return AltiumDocumentBuilder.build(normalized)
        } catch (error) {
            throw Parser.#parseError(error, input)
        }
    }

    /**
     * Returns a discriminated parse result without throwing public failures.
     * @param {Record<string, any>} input Common parser input.
     * @param {Record<string, any>} [options] Common parser options.
     * @returns {{ ok: true, value: Record<string, any> } | { ok: false, error: ToolkitError, diagnostics: object[] }} Parse result.
     */
    static tryParse(input, options = {}) {
        try {
            return { ok: true, value: Parser.parse(input, options) }
        } catch (error) {
            const normalized = Parser.#parseError(error, input)
            return {
                ok: false,
                error: normalized,
                diagnostics: [
                    ToolkitDiagnostic.create({
                        code: normalized.code,
                        severity: 'error',
                        message: normalized.message,
                        source: normalized.source
                    })
                ]
            }
        }
    }

    /**
     * Parses one input asynchronously with progress, cancellation, and workers.
     * @param {Record<string, any>} input Common parser input.
     * @param {Record<string, any>} [options] Common parser options.
     * @returns {Promise<Record<string, any>>} Canonical document.
     */
    static async parseAsync(input, options = {}) {
        let normalized
        try {
            normalized = ParserInput.normalize(input, options)
            Parser.#assertSupported(normalized.input)
            Parser.#assertExtensions(normalized)
            Parser.#assertReports(normalized)
            Parser.#assertNotCancelled(normalized)
        } catch (error) {
            throw Parser.#parseError(error, input)
        }
        const useWorker =
            normalized.options.worker === true ||
            (normalized.options.worker === 'auto' &&
                normalized.options.retainSource !== 'reference' &&
                AltiumWorkerClient.isAvailable())
        if (useWorker) {
            const attempt = await AltiumWorkerClient.parseAttempt(
                normalized.input,
                normalized.options
            )
            if (attempt.ok) return attempt.value
            if (normalized.options.worker !== 'auto' || !attempt.unavailable) {
                throw Parser.#parseError(attempt.error, input)
            }
            AltiumWorkerClient.dispose()
        }
        let progress = Parser.#progress(normalized, 'detect')
        Parser.#assertNotCancelled(normalized)
        progress = Parser.#progress(normalized, 'decode', progress)
        await Promise.resolve()
        Parser.#assertNotCancelled(normalized)
        let decoded
        try {
            decoded = AltiumDocumentBuilder.decode(normalized)
        } catch (error) {
            throw Parser.#parseError(error, input)
        }
        Parser.#assertNotCancelled(normalized)
        progress = Parser.#progress(normalized, 'validate', progress)
        Parser.#assertNotCancelled(normalized)
        let document
        try {
            document = AltiumDocumentBuilder.build(normalized, decoded)
        } catch (error) {
            throw Parser.#parseError(error, input)
        }
        Parser.#assertNotCancelled(normalized)
        Parser.#progress(normalized, 'complete', progress)
        Parser.#assertNotCancelled(normalized)
        return document
    }

    /**
     * Performs bounded Altium format detection.
     * @param {unknown} input Parser input candidate.
     * @returns {boolean} Whether the input is supported.
     */
    static supports(input) {
        return ParserInput.supports(input)
    }

    /**
     * Rejects unsupported report requests explicitly.
     * @param {{ input: { fileName: string }, options: { reports: string[] } }} normalized Normalized request.
     * @returns {void}
     */
    static #assertReports(normalized) {
        if (!normalized.options.reports.length) return
        throw Parser.#error(
            `Altium parser report is unavailable: ${normalized.options.reports[0]}.`,
            'ERR_CAPABILITY_UNAVAILABLE',
            'unsupported',
            normalized.input.fileName,
            { reports: normalized.options.reports }
        )
    }

    /**
     * Rejects unknown explicitly selected extension feature ids.
     * @param {{ input: { fileName: string }, options: { extensions: string | string[] } }} normalized Normalized request.
     * @returns {void}
     */
    static #assertExtensions(normalized) {
        if (!Array.isArray(normalized.options.extensions)) return
        const unknown = normalized.options.extensions.find(
            (id) => !SUPPORTED_EXTENSION_IDS.has(id)
        )
        if (!unknown) return
        throw Parser.#error(
            `Altium parser extension is unavailable: ${unknown}.`,
            'ERR_CAPABILITY_UNAVAILABLE',
            'unsupported',
            normalized.input.fileName,
            { extensions: normalized.options.extensions }
        )
    }

    /**
     * Rejects unsupported source names.
     * @param {Record<string, any>} input Normalized input.
     * @returns {void}
     */
    static #assertSupported(input) {
        if (ParserInput.supports(input)) return
        throw Parser.#error(
            `Unsupported Altium input: ${input.fileName || '(unnamed)'}.`,
            'ERR_FORMAT_UNSUPPORTED',
            'unsupported',
            input.fileName
        )
    }

    /**
     * Emits one ordered direct-parser progress row.
     * @param {{ options: { onProgress?: Function } }} normalized Request.
     * @param {'detect' | 'decode' | 'validate' | 'complete'} stage Stage.
     * @param {Record<string, any> | null} [previous] Previous row.
     * @returns {Record<string, any> | null} Emitted or previous row.
     */
    static #progress(normalized, stage, previous = null) {
        if (!normalized.options.onProgress) return previous
        const row = ToolkitProgress.create(
            { stage, message: PROGRESS_MESSAGES[stage] },
            previous
        )
        normalized.options.onProgress(row)
        return row
    }

    /**
     * Rejects an aborted direct request.
     * @param {{ input: { fileName: string }, options: { signal?: unknown } }} normalized Request.
     * @returns {void}
     */
    static #assertNotCancelled(normalized) {
        const { signal } = normalized.options
        if (signal === undefined || signal === null) return
        if (!ABORTED_GETTER) {
            throw new TypeError('AbortSignal state is unavailable.')
        }
        let aborted = false
        try {
            aborted = Boolean(Reflect.apply(ABORTED_GETTER, signal, []))
        } catch {
            throw new TypeError('Altium signal must be an AbortSignal.')
        }
        if (aborted) {
            throw Parser.#error(
                'Altium parsing was cancelled.',
                'ERR_CANCELLED',
                'cancelled',
                normalized.input.fileName
            )
        }
    }

    /**
     * Normalizes one parser failure.
     * @param {unknown} error Failure candidate.
     * @param {unknown} input Original input.
     * @returns {ToolkitError} Typed failure.
     */
    static #parseError(error, input) {
        if (ToolkitError.trustedRecord(error)) return error
        return ToolkitError.from(error, {
            code: 'ERR_ALTIUM_PARSE',
            category: 'parse',
            format: 'altium',
            source: ParserInput.fileName(input)
        })
    }

    /**
     * Creates one typed Altium failure.
     * @param {string} message Message.
     * @param {string} code Stable code.
     * @param {string} category Error category.
     * @param {string} source Source name.
     * @param {Record<string, any>} [details] Clone-safe details.
     * @returns {ToolkitError} Typed failure.
     */
    static #error(message, code, category, source, details = {}) {
        return new ToolkitError(message, {
            code,
            category,
            format: 'altium',
            source,
            details
        })
    }
}

Object.freeze(Parser.prototype)
Object.freeze(Parser)
