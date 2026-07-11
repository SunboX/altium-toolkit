// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import {
    ToolkitAsset,
    ToolkitDiagnostic,
    ToolkitError,
    ToolkitProgress
} from 'circuitjson-toolkit/parser'
import {
    ArchiveEntryPath,
    ArchiveLimits,
    ProjectResult
} from 'circuitjson-toolkit/project'

import { AltiumWorkerClient } from './AltiumWorkerClient.mjs'
import { AltiumDocumentBuilder } from './AltiumDocumentBuilder.mjs'
import { AltiumProjectDocumentResolver } from './AltiumProjectDocumentResolver.mjs'
import { Parser } from './Parser.mjs'
import { ParserInput } from './ParserInput.mjs'

const ABORTED_GETTER = Object.getOwnPropertyDescriptor(
    AbortSignal.prototype,
    'aborted'
)?.get
const PARSER_OPTION_KEYS = [
    'preserveRaw',
    'decodeAssets',
    'extensions',
    'reports',
    'retainSource',
    'worker',
    'transferInput',
    'signal',
    'onProgress'
]
const PARSER_EXTENSION_IDS = new Set([
    'altium.native-model',
    'altium.project-context'
])
const PROJECT_EXTENSION_IDS = new Set(['altium.entry-order'])
const PROJECT_SUFFIXES = new Set(['prjpcb', 'prjscr'])

/**
 * Loads bounded Altium entry collections into canonical project envelopes.
 */
export class ProjectLoader {
    /**
     * Loads one project synchronously.
     * @param {Record<string, any>[]} entries Named source entries.
     * @param {Record<string, any>} [options] Common loader options.
     * @returns {Record<string, any>} Canonical project.
     */
    static load(entries, options = {}) {
        try {
            const normalized = ProjectLoader.#normalizeOptions(options)
            if (normalized.worker === true) {
                throw ProjectLoader.#error(
                    'Synchronous Altium project loading cannot use a worker.',
                    'ERR_WORKER_SYNC_UNAVAILABLE',
                    'unsupported'
                )
            }
            const classified = ProjectLoader.#classify(
                entries,
                normalized.archiveLimits,
                normalized.decodeAssets
            )
            ProjectLoader.#assertCandidates(classified)
            const documents = []
            const diagnostics = []
            const parserOptions = ProjectLoader.#parserOptions(normalized)
            for (const entry of classified.candidates) {
                ProjectLoader.#parseEntry(
                    entry,
                    parserOptions,
                    documents,
                    diagnostics
                )
            }
            return ProjectLoader.#result(
                classified,
                AltiumProjectDocumentResolver.resolve(
                    classified,
                    documents,
                    normalized.extensions
                ),
                diagnostics,
                normalized
            )
        } catch (error) {
            throw ProjectLoader.#loadError(error)
        }
    }

    /**
     * Returns a discriminated loader result.
     * @param {Record<string, any>[]} entries Named source entries.
     * @param {Record<string, any>} [options] Common loader options.
     * @returns {{ ok: true, value: Record<string, any> } | { ok: false, error: ToolkitError, diagnostics: object[] }} Loader result.
     */
    static tryLoad(entries, options = {}) {
        try {
            return { ok: true, value: ProjectLoader.load(entries, options) }
        } catch (error) {
            const normalized = ProjectLoader.#loadError(error)
            const provided = Array.isArray(normalized.details?.diagnostics)
                ? normalized.details.diagnostics.map((diagnostic) =>
                      ToolkitDiagnostic.create(diagnostic)
                  )
                : []
            const diagnostics = provided.length
                ? provided
                : [
                      ToolkitDiagnostic.create({
                          code: normalized.code,
                          severity: 'error',
                          message: normalized.message,
                          source: normalized.source,
                          location: normalized.location,
                          details: normalized.details
                      })
                  ]
            return { ok: false, error: normalized, diagnostics }
        }
    }

    /**
     * Loads one project asynchronously through direct or worker execution.
     * @param {Record<string, any>[]} entries Named source entries.
     * @param {Record<string, any>} [options] Common loader options.
     * @returns {Promise<Record<string, any>>} Canonical project.
     */
    static async loadAsync(entries, options = {}) {
        const normalized = ProjectLoader.#normalizeOptions(options)
        ProjectLoader.#assertNotCancelled(normalized.signal)
        const useWorker =
            normalized.worker === true ||
            (normalized.worker === 'auto' &&
                normalized.retainSource !== 'reference' &&
                AltiumWorkerClient.isAvailable())
        if (useWorker) {
            const attempt = await AltiumWorkerClient.loadProjectAttempt(
                entries,
                normalized
            )
            if (attempt.ok) return attempt.value
            if (normalized.worker !== 'auto' || !attempt.unavailable) {
                throw attempt.error
            }
            AltiumWorkerClient.dispose()
        }

        let progress = ProjectLoader.#progress(
            normalized,
            { stage: 'detect', message: 'Classifying project entries.' },
            null
        )
        await ProjectLoader.#yieldToHost(Boolean(normalized.signal))
        ProjectLoader.#assertNotCancelled(normalized.signal)
        const classified = ProjectLoader.#classify(
            entries,
            normalized.archiveLimits,
            normalized.decodeAssets
        )
        ProjectLoader.#assertCandidates(classified)
        progress = ProjectLoader.#progress(
            normalized,
            {
                stage: 'project',
                completed: 0,
                total: classified.candidates.length,
                message: 'Loading Altium project entries.'
            },
            progress
        )

        const documents = []
        const diagnostics = []
        const parserOptions = ProjectLoader.#parserOptions(normalized)
        for (let index = 0; index < classified.candidates.length; index += 1) {
            await ProjectLoader.#yieldToHost(Boolean(normalized.signal))
            ProjectLoader.#assertNotCancelled(normalized.signal)
            const entry = classified.candidates[index]
            ProjectLoader.#parseEntry(
                entry,
                parserOptions,
                documents,
                diagnostics
            )
            progress = ProjectLoader.#progress(
                normalized,
                {
                    stage: 'project',
                    completed: index + 1,
                    total: classified.candidates.length,
                    detail: entry.name,
                    message: 'Loaded Altium project entry.'
                },
                progress
            )
            ProjectLoader.#assertNotCancelled(normalized.signal)
        }

        const result = ProjectLoader.#result(
            classified,
            AltiumProjectDocumentResolver.resolve(
                classified,
                documents,
                normalized.extensions
            ),
            diagnostics,
            normalized
        )
        ProjectLoader.#progress(
            normalized,
            {
                stage: 'complete',
                completed: classified.candidates.length,
                total: classified.candidates.length,
                message: 'Altium project loading complete.'
            },
            progress
        )
        ProjectLoader.#assertNotCancelled(normalized.signal)
        return result
    }

    /**
     * Detects a supported nonempty Altium entry collection.
     * @param {unknown} entries Entry collection candidate.
     * @returns {boolean} Whether at least one entry is supported.
     */
    static supports(entries) {
        try {
            const classified = ProjectLoader.#classify(
                entries,
                ArchiveLimits.defaults,
                'none'
            )
            return classified.candidates.length > 0
        } catch {
            return false
        }
    }

    /**
     * Normalizes common parser and archive options once.
     * @param {unknown} options Options candidate.
     * @returns {Record<string, any>} Normalized options.
     */
    static #normalizeOptions(options) {
        try {
            const fields = ProjectLoader.#plainFields(
                options,
                'Altium project options must be a plain object.'
            )
            const parserOptions = {}
            for (const key of PARSER_OPTION_KEYS) {
                if (Object.hasOwn(fields, key)) {
                    parserOptions[key] = fields[key]
                }
            }
            const normalized = ParserInput.normalize(
                { fileName: 'project.PrjPcb', data: '' },
                parserOptions
            ).options
            if (normalized.signal !== undefined && normalized.signal !== null) {
                ProjectLoader.#signalState(normalized.signal)
            }
            ProjectLoader.#assertExtensions(normalized.extensions)
            return {
                ...normalized,
                archiveLimits: ArchiveLimits.normalize(fields.archiveLimits)
            }
        } catch (error) {
            throw ProjectLoader.#inputError(error)
        }
    }

    /**
     * Validates, measures, and classifies all project entries.
     * @param {unknown} entries Entry candidates.
     * @param {Record<string, number>} limits Archive limits.
     * @param {'none' | 'metadata' | 'full'} assetMode Asset preparation mode.
     * @returns {{ entries: object[], candidates: object[], entryNames: string[], totalBytes: number, projectEntry: object | null }} Classified entries.
     */
    static #classify(entries, limits, assetMode) {
        const entryDescriptors = ProjectLoader.#entryArray(entries)
        const entryCount = entryDescriptors.length.value
        if (!entryCount) {
            throw ProjectLoader.#inputError(
                new TypeError('Altium project entries must be nonempty.')
            )
        }
        ProjectLoader.#assertLimit('maxEntries', limits.maxEntries, entryCount)

        const prepared = []
        let totalBytes = 0
        for (let index = 0; index < entryCount; index += 1) {
            const entry = entryDescriptors[String(index)].value
            const fields = ProjectLoader.#entryFields(entry)
            const name = ArchiveEntryPath.normalize(fields.name)
            const byteLength = ProjectLoader.#byteLength(fields.data)
            let entryBytes = byteLength
            ProjectLoader.#assertLimit(
                'maxEntryBytes',
                limits.maxEntryBytes,
                entryBytes,
                name
            )
            totalBytes += byteLength
            ProjectLoader.#assertLimit(
                'maxTotalBytes',
                limits.maxTotalBytes,
                totalBytes
            )
            const archiveDepth = ProjectLoader.#metadataInteger(
                fields.archiveDepth,
                'archiveDepth',
                0
            )
            ProjectLoader.#assertLimit(
                'maxArchiveDepth',
                limits.maxArchiveDepth,
                archiveDepth,
                name
            )
            ProjectLoader.#assertCompressionRatio(
                byteLength,
                fields.compressedByteLength,
                limits.maxCompressionRatio,
                name
            )
            const input = { fileName: name, data: fields.data }
            if (fields.assets !== undefined) {
                try {
                    input.assets = ToolkitAsset.prepareAll(fields.assets, {
                        mode: assetMode,
                        acceptPayload: (assetBytes) => {
                            entryBytes += assetBytes
                            ProjectLoader.#assertLimit(
                                'maxEntryBytes',
                                limits.maxEntryBytes,
                                entryBytes,
                                name
                            )
                            totalBytes += assetBytes
                            ProjectLoader.#assertLimit(
                                'maxTotalBytes',
                                limits.maxTotalBytes,
                                totalBytes,
                                name
                            )
                        }
                    })
                } catch (error) {
                    if (error instanceof ToolkitError) throw error
                    throw ProjectLoader.#inputError(error)
                }
            }
            const fileType = ParserInput.suffix(name)
            prepared.push({
                name,
                byteLength,
                fileType,
                input,
                supported: ParserInput.supportsFileType(fileType),
                isProject: PROJECT_SUFFIXES.has(fileType)
            })
        }

        const entryNames = ArchiveEntryPath.unique(
            prepared.map((entry) => entry.name)
        )
        const candidates = prepared
            .filter((entry) => entry.supported)
            .sort((left, right) =>
                left.name < right.name ? -1 : left.name > right.name ? 1 : 0
            )
        const projectEntry = candidates.find((entry) => entry.isProject)
        return {
            entries: prepared,
            candidates,
            entryNames,
            totalBytes,
            projectEntry: projectEntry || null
        }
    }

    /**
     * Parses one candidate and records deterministic partial failures.
     * @param {Record<string, any>} entry Prepared entry.
     * @param {Record<string, any>} parserOptions Normalized parser options.
     * @param {object[]} documents Successful documents.
     * @param {object[]} diagnostics Project diagnostics.
     * @returns {void}
     */
    static #parseEntry(entry, parserOptions, documents, diagnostics) {
        try {
            const selectedOptions = ProjectLoader.#entryParserOptions(
                entry,
                parserOptions
            )
            documents.push(
                selectedOptions.reports.length
                    ? Parser.parse(entry.input, selectedOptions)
                    : AltiumDocumentBuilder.build({
                          input: {
                              fileName: entry.name,
                              data: entry.input.data,
                              assets: entry.input.assets || []
                          },
                          sourceReference: entry.input,
                          options: selectedOptions
                      })
            )
        } catch (error) {
            const normalized = ProjectLoader.#loadError(error)
            if (normalized.code === 'ERR_CAPABILITY_UNAVAILABLE') {
                throw normalized
            }
            diagnostics.push(
                ToolkitDiagnostic.create({
                    code: normalized.code,
                    severity: 'error',
                    message: normalized.message,
                    source: entry.name,
                    location: normalized.location,
                    details: {
                        category: normalized.category,
                        format: normalized.format,
                        cause: normalized.cause
                    }
                })
            )
        }
    }

    /**
     * Selects options consumed by the standalone parser.
     * @param {Record<string, any>} options Normalized parser options.
     * @returns {Record<string, any>} Parser options.
     */
    static #parserOptions(options) {
        const selected = {}
        for (const key of PARSER_OPTION_KEYS) {
            if (key === 'signal' || key === 'onProgress') continue
            if (key === 'worker') selected[key] = false
            else if (key === 'extensions' && Array.isArray(options[key])) {
                selected[key] = options[key].filter((id) =>
                    PARSER_EXTENSION_IDS.has(id)
                )
            } else selected[key] = options[key]
        }
        return selected
    }

    /**
     * Retains compact project context internally until cross-document
     * resolution completes, even when callers omit source extensions.
     * @param {Record<string, any>} entry Prepared entry.
     * @param {Record<string, any>} options Normalized options.
     * @returns {Record<string, any>} Parser options for one entry.
     */
    static #entryParserOptions(entry, options) {
        const omitsParserExtensions =
            options.extensions === 'none' ||
            (Array.isArray(options.extensions) && !options.extensions.length)
        if (entry.isProject && omitsParserExtensions) {
            return { ...options, extensions: 'canonical' }
        }
        return options
    }

    /**
     * Rejects unknown explicitly selected project or parser extension ids.
     * @param {string | string[]} extensions Extension selection.
     * @returns {void}
     */
    static #assertExtensions(extensions) {
        if (!Array.isArray(extensions)) return
        const unknown = extensions.find(
            (id) =>
                !PARSER_EXTENSION_IDS.has(id) && !PROJECT_EXTENSION_IDS.has(id)
        )
        if (!unknown) return
        throw ProjectLoader.#error(
            `Altium project extension is unavailable: ${unknown}.`,
            'ERR_CAPABILITY_UNAVAILABLE',
            'unsupported',
            { extensions }
        )
    }

    /**
     * Builds the canonical project envelope.
     * @param {Record<string, any>} classified Classified entries.
     * @param {object[]} documents Successful documents.
     * @param {object[]} diagnostics Project diagnostics.
     * @param {Record<string, any>} options Normalized options.
     * @returns {Record<string, any>} Canonical project.
     */
    static #result(classified, documents, diagnostics, options) {
        if (!documents.length) {
            throw ProjectLoader.#error(
                'No requested Altium project document could be loaded.',
                'ERR_PROJECT_NO_DOCUMENTS',
                'parse',
                { diagnostics }
            )
        }
        return ProjectResult.create({
            source: { format: 'altium', entryNames: classified.entryNames },
            documents,
            project: classified.projectEntry
                ? {
                      name: classified.projectEntry.name,
                      format: 'altium',
                      relationships: []
                  }
                : null,
            extensions: ProjectLoader.#projectExtension(
                options.extensions,
                classified.entryNames
            ),
            assets: ProjectLoader.#companionAssets(
                classified.entries,
                options.decodeAssets
            ),
            diagnostics,
            statistics: {
                entryCount: classified.entries.length,
                candidateCount: classified.candidates.length,
                documentCount: documents.length,
                failureCount: diagnostics.length,
                totalBytes: classified.totalBytes
            }
        })
    }

    /**
     * Applies common extension selection semantics to project-level facts.
     * @param {string | string[]} selection Extension selection.
     * @param {string[]} entryNames Normalized project entry order.
     * @returns {Record<string, any>} Source extension map.
     */
    static #projectExtension(selection, entryNames) {
        const selected = Array.isArray(selection)
            ? selection.includes('altium.entry-order')
            : selection !== 'none'
        if (!selected) return {}
        return {
            altium: {
                $meta: {
                    schema: 'ecad-toolkit.extension.v1',
                    completeness: Array.isArray(selection)
                        ? 'canonical'
                        : selection,
                    included: ['altium.entry-order'],
                    omitted: []
                },
                entryNames
            }
        }
    }

    /**
     * Creates project-level assets for non-Altium entries.
     * @param {object[]} entries Prepared entries.
     * @param {'none' | 'metadata' | 'full'} mode Decode mode.
     * @returns {object[]} Companion assets.
     */
    static #companionAssets(entries, mode) {
        if (mode === 'none') return []
        return entries
            .filter((entry) => !entry.supported)
            .map((entry) => ({
                kind: 'companion',
                name: entry.name,
                mediaType: 'application/octet-stream',
                byteLength: entry.byteLength,
                data: mode === 'full' ? entry.input.data : null,
                source: { entryName: entry.name }
            }))
    }

    /**
     * Validates one project entry through data properties only.
     * @param {unknown} entry Entry candidate.
     * @returns {Record<string, any>} Entry fields.
     */
    static #entryFields(entry) {
        const fields = ProjectLoader.#plainFields(
            entry,
            'Each Altium project entry must be a plain object.'
        )
        if (!Object.hasOwn(fields, 'name') || !Object.hasOwn(fields, 'data')) {
            throw ProjectLoader.#inputError(
                new TypeError('Each project entry requires name and data.')
            )
        }
        if (fields.assets !== undefined && !Array.isArray(fields.assets)) {
            throw ProjectLoader.#inputError(
                new TypeError('Project entry assets must be an array.')
            )
        }
        return fields
    }

    /**
     * Reads an exact dense project-entry array without caller iteration.
     * @param {unknown} entries Project entry collection.
     * @returns {Record<string, PropertyDescriptor>} Own array descriptors.
     */
    static #entryArray(entries) {
        if (!Array.isArray(entries)) {
            throw ProjectLoader.#inputError(
                new TypeError('Altium project entries must be nonempty.')
            )
        }
        let prototype
        let descriptors
        try {
            prototype = Object.getPrototypeOf(entries)
            descriptors = Object.getOwnPropertyDescriptors(entries)
        } catch {
            throw ProjectLoader.#inputError(
                new TypeError(
                    'Altium project entries must be a dense plain array.'
                )
            )
        }
        const length = descriptors.length?.value
        if (
            prototype !== Array.prototype ||
            !Number.isSafeInteger(length) ||
            length < 0 ||
            Reflect.ownKeys(descriptors).length !== length + 1
        ) {
            throw ProjectLoader.#inputError(
                new TypeError(
                    'Altium project entries must be a dense plain array.'
                )
            )
        }
        for (let index = 0; index < length; index += 1) {
            const descriptor = descriptors[String(index)]
            if (
                !descriptor ||
                !Object.hasOwn(descriptor, 'value') ||
                descriptor.enumerable !== true
            ) {
                throw ProjectLoader.#inputError(
                    new TypeError(
                        'Altium project entries must contain enumerable data properties.'
                    )
                )
            }
        }
        return descriptors
    }

    /**
     * Reads an accessor-free plain record.
     * @param {unknown} value Record candidate.
     * @param {string} message Failure message.
     * @returns {Record<string, any>} Own field values.
     */
    static #plainFields(value, message) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new TypeError(message)
        }
        const prototype = Object.getPrototypeOf(value)
        if (prototype !== Object.prototype && prototype !== null) {
            throw new TypeError(message)
        }
        const descriptors = Object.getOwnPropertyDescriptors(value)
        const fields = Object.create(null)
        for (const [name, descriptor] of Object.entries(descriptors)) {
            if (!Object.hasOwn(descriptor, 'value')) {
                throw new TypeError(
                    'Accessor-backed project fields are invalid.'
                )
            }
            fields[name] = descriptor.value
        }
        return fields
    }

    /**
     * Measures a common parser payload without copying binary data.
     * @param {unknown} data Payload candidate.
     * @returns {number} Byte length.
     */
    static #byteLength(data) {
        if (typeof data === 'string') {
            return ProjectLoader.#stringByteLength(data)
        }
        if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            return data.byteLength
        }
        throw ProjectLoader.#inputError(
            new TypeError('Project entry data uses an unsupported type.')
        )
    }

    /**
     * Measures UTF-8 text without allocating an encoded copy.
     * @param {string} value Text value.
     * @returns {number} UTF-8 byte length.
     */
    static #stringByteLength(value) {
        let byteLength = 0
        for (let index = 0; index < value.length; index += 1) {
            const codeUnit = value.charCodeAt(index)
            if (codeUnit <= 0x7f) byteLength += 1
            else if (codeUnit <= 0x7ff) byteLength += 2
            else if (
                codeUnit >= 0xd800 &&
                codeUnit <= 0xdbff &&
                index + 1 < value.length &&
                value.charCodeAt(index + 1) >= 0xdc00 &&
                value.charCodeAt(index + 1) <= 0xdfff
            ) {
                byteLength += 4
                index += 1
            } else byteLength += 3
        }
        return byteLength
    }

    /**
     * Normalizes optional nonnegative integer metadata.
     * @param {unknown} value Metadata value.
     * @param {string} key Field name.
     * @param {number} fallback Missing fallback.
     * @returns {number} Normalized value.
     */
    static #metadataInteger(value, key, fallback) {
        if (value === undefined) return fallback
        if (!Number.isSafeInteger(value) || value < 0) {
            throw ProjectLoader.#inputError(
                new TypeError(`${key} must be a nonnegative safe integer.`)
            )
        }
        return value
    }

    /**
     * Enforces compressed-size metadata.
     * @param {number} byteLength Uncompressed bytes.
     * @param {unknown} compressedValue Compressed bytes.
     * @param {number} maximum Maximum ratio.
     * @param {string} entryName Entry name.
     * @returns {void}
     */
    static #assertCompressionRatio(
        byteLength,
        compressedValue,
        maximum,
        entryName
    ) {
        if (compressedValue === undefined) return
        const compressed = ProjectLoader.#metadataInteger(
            compressedValue,
            'compressedByteLength',
            0
        )
        const ratio =
            compressed === 0
                ? byteLength === 0
                    ? 1
                    : Number.POSITIVE_INFINITY
                : byteLength / compressed
        ProjectLoader.#assertLimit(
            'maxCompressionRatio',
            maximum,
            ratio,
            entryName
        )
    }

    /**
     * Enforces one archive limit.
     * @param {string} limit Limit name.
     * @param {number} maximum Maximum value.
     * @param {number} actual Actual value.
     * @param {string} [entryName] Entry name.
     * @returns {void}
     */
    static #assertLimit(limit, maximum, actual, entryName = '') {
        if (actual <= maximum) return
        throw new ToolkitError(`Archive limit exceeded: ${limit}.`, {
            code: 'ERR_ARCHIVE_LIMIT_EXCEEDED',
            category: 'validation',
            format: 'archive',
            source: entryName,
            details: { limit, maximum, actual, entryName }
        })
    }

    /** @param {Record<string, any>} classified Classification. @returns {void} */
    static #assertCandidates(classified) {
        if (classified.candidates.length) return
        throw ProjectLoader.#error(
            'No supported Altium project entry was found.',
            'ERR_PROJECT_UNSUPPORTED',
            'unsupported'
        )
    }

    /**
     * Emits one ordered project progress row.
     * @param {Record<string, any>} options Normalized options.
     * @param {Record<string, any>} fields Progress fields.
     * @param {Record<string, any> | null} previous Previous row.
     * @returns {Record<string, any> | null} Current row.
     */
    static #progress(options, fields, previous) {
        if (!options.onProgress) return previous
        const row = ToolkitProgress.create(fields, previous)
        options.onProgress(row)
        return row
    }

    /** @param {boolean} cancellationResponsive Timer-yield mode. @returns {Promise<void>} Yield. */
    static async #yieldToHost(cancellationResponsive) {
        if (cancellationResponsive) {
            await new Promise((resolve) => setTimeout(resolve, 0))
            return
        }
        if (typeof globalThis.scheduler?.yield === 'function') {
            await globalThis.scheduler.yield()
            return
        }
        if (typeof setImmediate === 'function') {
            await new Promise((resolve) => setImmediate(resolve))
            return
        }
        if (typeof globalThis.MessageChannel === 'function') {
            await new Promise((resolve) => {
                const channel = new globalThis.MessageChannel()
                channel.port1.onmessage = () => {
                    channel.port1.close()
                    channel.port2.close()
                    resolve()
                }
                channel.port2.postMessage(null)
            })
            return
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
    }

    /** @param {unknown} signal Abort signal. @returns {void} */
    static #assertNotCancelled(signal) {
        if (signal === undefined || signal === null) return
        if (!ProjectLoader.#signalState(signal)) return
        throw ProjectLoader.#error(
            'Altium project loading was cancelled.',
            'ERR_CANCELLED',
            'cancelled'
        )
    }

    /** @param {unknown} signal Abort signal. @returns {boolean} Aborted state. */
    static #signalState(signal) {
        if (!ABORTED_GETTER) {
            throw new TypeError('AbortSignal state is unavailable.')
        }
        try {
            return Boolean(Reflect.apply(ABORTED_GETTER, signal, []))
        } catch {
            throw new TypeError('Project signal must be an AbortSignal.')
        }
    }

    /** @param {unknown} error Failure. @returns {ToolkitError} Input error. */
    static #inputError(error) {
        return ToolkitError.from(error, {
            code: 'ERR_PROJECT_INPUT',
            category: 'validation',
            format: 'altium'
        })
    }

    /** @param {unknown} error Failure. @returns {ToolkitError} Typed error. */
    static #loadError(error) {
        return ToolkitError.from(error, {
            code: 'ERR_PROJECT_LOAD',
            category: 'runtime',
            format: 'altium'
        })
    }

    /**
     * Creates one typed project failure.
     * @param {string} message Message.
     * @param {string} code Stable code.
     * @param {string} category Error category.
     * @param {Record<string, any>} [details] Error details.
     * @returns {ToolkitError} Typed failure.
     */
    static #error(message, code, category, details = {}) {
        return new ToolkitError(message, {
            code,
            category,
            format: 'altium',
            details
        })
    }
}

Object.freeze(ProjectLoader.prototype)
Object.freeze(ProjectLoader)
