// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Stores PCB interaction item extractors by rendered object group.
 */
export class PcbInteractionItemRegistry {
    /** @type {{ objectKey: string, extractor: (input: object, context: object) => object[] }[]} */
    #entries

    /**
     * Creates an empty registry.
     */
    constructor() {
        this.#entries = []
    }

    /**
     * Creates an empty registry.
     * @returns {PcbInteractionItemRegistry}
     */
    static create() {
        return new PcbInteractionItemRegistry()
    }

    /**
     * Adds an extractor for one object group.
     * @param {string} objectKey Object visibility key.
     * @param {(input: object, context: object) => object[]} extractor Extractor.
     * @returns {PcbInteractionItemRegistry}
     */
    register(objectKey, extractor) {
        if (typeof extractor !== 'function') return this
        this.#entries.push({
            objectKey: String(objectKey || ''),
            extractor
        })
        return this
    }

    /**
     * Extracts interaction items from all registered groups.
     * @param {object} input Toolkit document model.
     * @param {object} [context] Shared extraction context.
     * @returns {object[]}
     */
    extract(input, context = {}) {
        const items = []

        for (const entry of this.#entries) {
            const extracted = entry.extractor(input, {
                ...context,
                objectKey: entry.objectKey
            })
            for (const item of Array.isArray(extracted) ? extracted : []) {
                items.push({
                    objectKey: entry.objectKey,
                    ...item
                })
            }
        }

        return items
    }
}
