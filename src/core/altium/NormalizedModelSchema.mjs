// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Defines the current normalized model contract emitted by parser roots.
 */
export class NormalizedModelSchema {
    static CURRENT_SCHEMA_ID = 'urn:altium-toolkit:normalized-model:a1'

    static CURRENT_SCHEMA_VERSION = 'a1'

    /**
     * Adds the current normalized model schema id to a parser root object.
     * @template {Record<string, unknown>} T
     * @param {T} model
     * @returns {T & { schema: string }}
     */
    static attach(model) {
        const normalizedModel = {
            schema: NormalizedModelSchema.CURRENT_SCHEMA_ID,
            ...model
        }
        normalizedModel.schema = NormalizedModelSchema.CURRENT_SCHEMA_ID
        if (Array.isArray(normalizedModel.diagnostics)) {
            normalizedModel.diagnostics =
                NormalizedModelSchema.#normalizeDiagnostics(
                    normalizedModel.diagnostics
                )
        }

        return normalizedModel
    }

    /**
     * Adds machine-readable codes to parser diagnostics.
     * @param {object[]} diagnostics Parser diagnostics.
     * @returns {object[]}
     */
    static #normalizeDiagnostics(diagnostics) {
        return diagnostics.map((diagnostic) => ({
            code:
                typeof diagnostic?.code === 'string' && diagnostic.code
                    ? diagnostic.code
                    : NormalizedModelSchema.#deriveDiagnosticCode(diagnostic),
            ...diagnostic
        }))
    }

    /**
     * Derives a stable fallback code from one diagnostic message.
     * @param {object} diagnostic Parser diagnostic.
     * @returns {string}
     */
    static #deriveDiagnosticCode(diagnostic) {
        const slug = String(diagnostic?.message || 'diagnostic')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '.')
            .replace(/^\.+|\.+$/gu, '')
            .slice(0, 80)

        return 'parser.' + (slug || 'diagnostic')
    }
}
