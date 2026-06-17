// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
    'image/webp',
    'image/bmp'
])

/**
 * Builds deterministic diagnostics for normalized schematic image rows.
 */
export class SchematicImageDiagnosticsBuilder {
    static SCHEMA = 'altium-toolkit.schematic.image-diagnostics.a1'

    /**
     * Builds a schematic image diagnostics report.
     * @param {object} input Parser root, schematic model, or options object.
     * @returns {object}
     */
    static build(input = {}) {
        const images = SchematicImageDiagnosticsBuilder.#images(input)
        const rows = images.map((image, index) =>
            SchematicImageDiagnosticsBuilder.#imageRow(image, index)
        )
        const findings = rows.flatMap((row) =>
            SchematicImageDiagnosticsBuilder.#findings(row)
        )

        return {
            schema: SchematicImageDiagnosticsBuilder.SCHEMA,
            summary: SchematicImageDiagnosticsBuilder.#summary(rows, findings),
            images: rows,
            findings
        }
    }

    /**
     * Resolves image rows from a parser root or direct schematic payload.
     * @param {object} input Parser root, schematic model, or options object.
     * @returns {object[]}
     */
    static #images(input) {
        if (Array.isArray(input?.images)) {
            return input.images
        }
        if (Array.isArray(input?.schematic?.images)) {
            return input.schematic.images
        }

        return []
    }

    /**
     * Builds one normalized image diagnostic row.
     * @param {object} image Normalized image row.
     * @param {number} index Image index.
     * @returns {object}
     */
    static #imageRow(image, index) {
        const mimeType = String(image?.mimeType || '').trim()
        const sourceMimeType = String(image?.sourceMimeType || '').trim()
        const hasPayload = String(image?.dataBase64 || '').length > 0
        const embedded = image?.embedded === true
        const state =
            image?.diagnosticState ||
            (embedded
                ? hasPayload
                    ? 'embedded'
                    : 'missing-embedded-payload'
                : 'external')

        return SchematicImageDiagnosticsBuilder.#stripEmpty({
            key: 'schematic-image-' + index,
            index,
            fileName: image?.fileName,
            embedded,
            diagnosticState: state,
            mimeType,
            sourceMimeType,
            hasPayload,
            hasAlpha: image?.hasAlpha === true,
            payloadStatus:
                embedded && !hasPayload
                    ? 'missing'
                    : hasPayload
                      ? 'available'
                      : 'external',
            mimeStatus:
                hasPayload &&
                (!mimeType || !SUPPORTED_IMAGE_MIME_TYPES.has(mimeType))
                    ? 'unsupported'
                    : mimeType
                      ? 'supported'
                      : 'unknown',
            converted:
                Boolean(sourceMimeType && mimeType) &&
                sourceMimeType !== mimeType
        })
    }

    /**
     * Builds diagnostic findings for one image row.
     * @param {object} row Normalized image diagnostic row.
     * @returns {object[]}
     */
    static #findings(row) {
        const findings = []

        if (row.converted) {
            findings.push(
                SchematicImageDiagnosticsBuilder.#finding(
                    'schematic.image.converted-payload',
                    'info',
                    row
                )
            )
        }
        if (row.diagnosticState === 'external') {
            findings.push(
                SchematicImageDiagnosticsBuilder.#finding(
                    'schematic.image.external-reference',
                    'info',
                    row
                )
            )
        }
        if (row.payloadStatus === 'missing') {
            findings.push(
                SchematicImageDiagnosticsBuilder.#finding(
                    'schematic.image.missing-embedded-payload',
                    'warning',
                    row
                )
            )
        }
        if (row.mimeStatus === 'unsupported') {
            findings.push(
                SchematicImageDiagnosticsBuilder.#finding(
                    'schematic.image.unsupported-mime-type',
                    'warning',
                    row
                )
            )
        }

        return findings
    }

    /**
     * Builds the report summary.
     * @param {object[]} rows Normalized image rows.
     * @param {object[]} findings Diagnostic findings.
     * @returns {object}
     */
    static #summary(rows, findings) {
        return {
            imageCount: rows.length,
            embeddedImageCount: rows.filter((row) => row.embedded).length,
            embeddedPayloadCount: rows.filter(
                (row) => row.embedded && row.hasPayload
            ).length,
            externalReferenceCount: rows.filter(
                (row) => row.diagnosticState === 'external'
            ).length,
            missingPayloadCount: rows.filter(
                (row) => row.payloadStatus === 'missing'
            ).length,
            unsupportedMimeTypeCount: rows.filter(
                (row) => row.mimeStatus === 'unsupported'
            ).length,
            convertedPayloadCount: rows.filter((row) => row.converted).length,
            alphaPayloadCount: rows.filter((row) => row.hasAlpha).length,
            findingCount: findings.length
        }
    }

    /**
     * Builds one image finding row.
     * @param {string} code Stable finding code.
     * @param {'info' | 'warning'} severity Finding severity.
     * @param {object} row Image diagnostic row.
     * @returns {object}
     */
    static #finding(code, severity, row) {
        return SchematicImageDiagnosticsBuilder.#stripEmpty({
            code,
            severity,
            imageKey: row.key,
            fileName: row.fileName,
            diagnosticState: row.diagnosticState,
            mimeType: row.mimeType,
            sourceMimeType: row.sourceMimeType
        })
    }

    /**
     * Removes empty fields while preserving zeros and false.
     * @param {Record<string, unknown>} row Input row.
     * @returns {Record<string, unknown>}
     */
    static #stripEmpty(row) {
        return Object.fromEntries(
            Object.entries(row || {}).filter(([, value]) => {
                if (Array.isArray(value)) return value.length > 0
                return value !== undefined && value !== null && value !== ''
            })
        )
    }
}
