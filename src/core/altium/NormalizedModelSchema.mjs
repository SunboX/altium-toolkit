// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ParserDiagnosticNormalizer } from './ParserDiagnosticNormalizer.mjs'

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
                ParserDiagnosticNormalizer.normalizeMany(
                    normalizedModel.diagnostics
                )
        }

        return normalizedModel
    }
}
