// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

const ASSET_MODES = new Set(['none', 'metadata', 'full'])
const EXTENSION_MODES = new Set(['none', 'metadata', 'canonical', 'full'])
const RETAIN_SOURCE_MODES = new Set(['none', 'reference'])
const WORKER_MODES = new Set(['auto', true, false])
const SUPPORTED_SUFFIXES = new Set([
    'intlib',
    'pcbdoc',
    'pcbdwf',
    'pcblib',
    'prjpcb',
    'prjscr',
    'schdoc',
    'schlib'
])

/**
 * Normalizes source-neutral parser requests for the Altium adapter.
 */
export class ParserInput {
    /**
     * Normalizes one parser input and common option record.
     * @param {unknown} input Parser input candidate.
     * @param {unknown} [options] Common options candidate.
     * @returns {{ input: { fileName: string, data: string | ArrayBuffer | Uint8Array, assets: object[] }, sourceReference: object, options: Record<string, any> }} Normalized request.
     */
    static normalize(input, options = {}) {
        const inputFields = ParserInput.#plainFields(
            input,
            'Altium parser input must be a plain object.'
        )
        const optionFields = ParserInput.#plainFields(
            options,
            'Altium parser options must be a plain object.'
        )
        if (!ParserInput.#isData(inputFields.data)) {
            throw new TypeError(
                'Altium parser data must be a string, ArrayBuffer, or Uint8Array.'
            )
        }
        if (
            inputFields.assets !== undefined &&
            !Array.isArray(inputFields.assets)
        ) {
            throw new TypeError('Altium parser assets must be an array.')
        }
        const decodeAssets = ParserInput.#enum(
            optionFields.decodeAssets,
            'metadata',
            ASSET_MODES,
            'asset decode mode'
        )
        const extensions = ParserInput.#extensions(optionFields.extensions)
        const retainSource = ParserInput.#enum(
            optionFields.retainSource,
            'none',
            RETAIN_SOURCE_MODES,
            'source retention mode'
        )
        const worker =
            optionFields.worker === undefined ? 'auto' : optionFields.worker
        if (!WORKER_MODES.has(worker)) {
            throw new TypeError('Altium worker must be auto, true, or false.')
        }
        if (
            optionFields.onProgress !== undefined &&
            typeof optionFields.onProgress !== 'function'
        ) {
            throw new TypeError('Altium onProgress must be a function.')
        }
        return {
            input: {
                fileName: ParserInput.fileName(inputFields.fileName),
                data: inputFields.data,
                assets: inputFields.assets || []
            },
            sourceReference: input,
            options: {
                preserveRaw: optionFields.preserveRaw === true,
                decodeAssets,
                extensions,
                reports: ParserInput.#stringList(optionFields.reports),
                retainSource,
                worker,
                transferInput: optionFields.transferInput === true,
                signal: optionFields.signal,
                onProgress: optionFields.onProgress
            }
        }
    }

    /**
     * Performs bounded format detection without parsing native contents.
     * @param {unknown} input Parser input candidate.
     * @returns {boolean} Whether the file name and payload are supported.
     */
    static supports(input) {
        try {
            const fields = ParserInput.#plainFields(
                input,
                'Altium parser input must be a plain object.'
            )
            return (
                ParserInput.#isData(fields.data) &&
                ParserInput.supportsFileType(
                    ParserInput.suffix(fields.fileName)
                )
            )
        } catch {
            return false
        }
    }

    /**
     * Checks one already normalized lowercase file type.
     * @param {unknown} fileType File suffix without a period.
     * @returns {boolean} Whether the Altium parser supports the file type.
     */
    static supportsFileType(fileType) {
        return SUPPORTED_SUFFIXES.has(String(fileType))
    }

    /**
     * Returns a normalized source file name.
     * @param {unknown} input Parser input or name.
     * @returns {string} Normalized name.
     */
    static fileName(input) {
        let value = input
        if (input && typeof input === 'object') {
            try {
                value = ParserInput.#plainFields(
                    input,
                    'Altium parser input must be a plain object.'
                ).fileName
            } catch {
                value = ''
            }
        }
        return String(value || '')
            .replaceAll('\\', '/')
            .replace(/^\.\//u, '')
    }

    /**
     * Returns the lowercase file suffix.
     * @param {unknown} fileName File name candidate.
     * @returns {string} Lowercase suffix without a period.
     */
    static suffix(fileName) {
        const name = ParserInput.fileName(fileName)
        const suffix = name.split('.').pop()
        return suffix && suffix !== name ? suffix.toLowerCase() : ''
    }

    /**
     * Copies the exact input byte range for the native parser.
     * @param {string | ArrayBuffer | Uint8Array} data Parser payload.
     * @returns {ArrayBuffer} Owned native parser buffer.
     */
    static arrayBuffer(data) {
        if (typeof data === 'string')
            return new TextEncoder().encode(data).buffer
        if (data instanceof ArrayBuffer) return data
        if (data instanceof Uint8Array) {
            if (
                data.byteOffset === 0 &&
                data.byteLength === data.buffer.byteLength
            ) {
                return data.buffer
            }
            return data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength
            )
        }
        throw new TypeError(
            'Altium parser data must be a string, ArrayBuffer, or Uint8Array.'
        )
    }

    /**
     * Normalizes one optional enum.
     * @param {unknown} value Candidate value.
     * @param {string} fallback Default value.
     * @param {Set<string>} allowed Allowed values.
     * @param {string} label Error label.
     * @returns {string} Normalized value.
     */
    static #enum(value, fallback, allowed, label) {
        const normalized = String(value === undefined ? fallback : value)
        if (!allowed.has(normalized)) {
            throw new TypeError(`Unsupported Altium ${label}: ${normalized}.`)
        }
        return normalized
    }

    /**
     * Normalizes the extension selection contract.
     * @param {unknown} value Candidate value.
     * @returns {string | string[]} Normalized extension selection.
     */
    static #extensions(value) {
        if (Array.isArray(value)) return ParserInput.#stringList(value)
        return ParserInput.#enum(
            value,
            'canonical',
            EXTENSION_MODES,
            'extension mode'
        )
    }

    /**
     * Normalizes one unique nonempty string list.
     * @param {unknown} value List candidate.
     * @returns {string[]} Normalized values.
     */
    static #stringList(value) {
        if (value === undefined) return []
        if (!Array.isArray(value)) {
            throw new TypeError('Altium option list must be an array.')
        }
        const values = []
        const seen = new Set()
        for (let index = 0; index < value.length; index += 1) {
            const normalized = String(value[index]).trim()
            if (!normalized) {
                throw new TypeError('Altium option ids must not be empty.')
            }
            if (!seen.has(normalized)) {
                seen.add(normalized)
                values.push(normalized)
            }
        }
        return values
    }

    /**
     * Returns whether a payload uses one common binary/text input type.
     * @param {unknown} value Payload candidate.
     * @returns {boolean} True for supported payload values.
     */
    static #isData(value) {
        return (
            typeof value === 'string' ||
            value instanceof ArrayBuffer ||
            value instanceof Uint8Array
        )
    }

    /**
     * Reads one accessor-free plain record.
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
                    'Accessor-backed parser fields are invalid.'
                )
            }
            fields[name] = descriptor.value
        }
        return fields
    }
}

Object.freeze(ParserInput.prototype)
Object.freeze(ParserInput)
