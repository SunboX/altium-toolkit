// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Base class for structured parser failures.
 */
export class AltiumFileError extends Error {
    /**
     * Creates a structured parser failure.
     * @param {string} message Error message.
     * @param {object} [options] Error metadata.
     */
    constructor(message, options = {}) {
        super(message, { cause: options.cause })
        this.name = new.target.name
        this.errorKind = options.errorKind || 'parse'
        if (options.code) this.code = options.code
        AltiumFileError.#assignOptionalMetadata(this, options)
    }

    /**
     * Copies supported diagnostic metadata onto an error instance.
     * @param {AltiumFileError} error Error instance.
     * @param {object} options Error metadata.
     * @returns {void}
     */
    static #assignOptionalMetadata(error, options) {
        for (const key of [
            'fileName',
            'source',
            'sourceStorage',
            'sourceStream',
            'recordIndex',
            'recordType',
            'fieldName',
            'contextKey'
        ]) {
            if (options[key] !== undefined && options[key] !== null) {
                error[key] = options[key]
            }
        }
    }
}

/**
 * Represents a parser failure that does not indicate known file corruption.
 */
export class AltiumParseError extends AltiumFileError {
    /**
     * Creates a parser failure.
     * @param {string} message Error message.
     * @param {object} [options] Error metadata.
     */
    constructor(message, options = {}) {
        super(message, { ...options, errorKind: 'parse' })
    }
}

/**
 * Represents a file structure that is too corrupt to decode safely.
 */
export class AltiumCorruptFileError extends AltiumFileError {
    /**
     * Creates a corrupt-file parser failure.
     * @param {string} message Error message.
     * @param {object} [options] Error metadata.
     */
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'parser.corrupt-file',
            errorKind: 'corrupt-file'
        })
    }
}

/**
 * Represents a known but intentionally unsupported parser feature.
 */
export class AltiumUnsupportedFeatureError extends AltiumFileError {
    /**
     * Creates an unsupported-feature parser failure.
     * @param {string} message Error message.
     * @param {object} [options] Error metadata.
     */
    constructor(message, options = {}) {
        super(message, { ...options, errorKind: 'unsupported-feature' })
    }
}
