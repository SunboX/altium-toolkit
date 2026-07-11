// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

const DOCUMENT_SCHEMA = 'ecad-toolkit.document.v1'

/** Resolves explicit Altium source extensions without changing document shape. */
export class AltiumExtensionResolver {
    /**
     * Returns the retained native renderer model when explicitly requested.
     * Historical native renderer models pass through unchanged so callers can
     * use one boundary during migration.
     * @param {unknown} document Canonical document or native renderer model.
     * @returns {Record<string, any> | null} Retained native model.
     */
    static nativeModel(document) {
        if (!AltiumExtensionResolver.#record(document)) return null
        const schema = String(
            AltiumExtensionResolver.#data(document, 'schema') || ''
        )
        if (schema !== DOCUMENT_SCHEMA) {
            return AltiumExtensionResolver.#isLegacyModel(document, schema)
                ? document
                : null
        }

        const source = AltiumExtensionResolver.#data(document, 'source')
        if (
            String(AltiumExtensionResolver.#data(source, 'format') || '') !==
            'altium'
        ) {
            return null
        }
        const extensions = AltiumExtensionResolver.#data(document, 'extensions')
        const altium = AltiumExtensionResolver.#data(extensions, 'altium')
        const native = AltiumExtensionResolver.#data(altium, 'native')
        return AltiumExtensionResolver.#record(native) ? native : null
    }

    /**
     * Returns whether an explicit native renderer model is available.
     * @param {unknown} document Canonical document or native renderer model.
     * @returns {boolean} Whether native Altium data can be resolved.
     */
    static hasNativeModel(document) {
        return AltiumExtensionResolver.nativeModel(document) !== null
    }

    /**
     * Identifies a historical Altium renderer model by its owned schema.
     * @param {Record<string, any>} value Model candidate.
     * @param {string} schema Owned schema value.
     * @returns {boolean} Whether the value is a native Altium model.
     */
    static #isLegacyModel(value, schema) {
        if (
            schema.startsWith('urn:altium-toolkit:') ||
            schema.startsWith('altium-toolkit.')
        ) {
            return true
        }
        const sourceFormat = String(
            AltiumExtensionResolver.#data(value, 'sourceFormat') || ''
        )
        return sourceFormat === 'altium'
    }

    /**
     * Reads one own data property without invoking accessors.
     * @param {unknown} owner Field owner.
     * @param {string} key Field name.
     * @returns {unknown} Own data value or undefined.
     */
    static #data(owner, key) {
        if (!AltiumExtensionResolver.#record(owner)) return undefined
        try {
            const descriptor = Object.getOwnPropertyDescriptor(owner, key)
            return descriptor && Object.hasOwn(descriptor, 'value')
                ? descriptor.value
                : undefined
        } catch {
            return undefined
        }
    }

    /**
     * Returns true for non-array object records.
     * @param {unknown} value Candidate value.
     * @returns {boolean} Whether the value is a record.
     */
    static #record(value) {
        return Boolean(
            value && typeof value === 'object' && !Array.isArray(value)
        )
    }
}

Object.freeze(AltiumExtensionResolver.prototype)
Object.freeze(AltiumExtensionResolver)
