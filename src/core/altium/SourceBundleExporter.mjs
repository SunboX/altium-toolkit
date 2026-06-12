// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SourceComponentBundleNormalizer } from './SourceComponentBundleNormalizer.mjs'

/**
 * Exports normalized source component bundles as deterministic file entries.
 */
export class SourceBundleExporter {
    /**
     * Exports one source bundle.
     * @param {object} componentBundle Component bundle or raw response.
     * @param {{ includeModels?: boolean }} [options] Export options.
     * @returns {{ manifest: object, entries: { path: string, bytes: Uint8Array, contentType: string }[] }}
     */
    static export(componentBundle, options = {}) {
        const bundle =
            SourceComponentBundleNormalizer.normalize(componentBundle)
        const includeModels = options.includeModels !== false
        const manifest = SourceBundleExporter.#buildManifest(
            bundle,
            includeModels
        )
        const entries = [
            SourceBundleExporter.#jsonEntry('manifest.json', manifest),
            SourceBundleExporter.#jsonEntry(
                'source/source.json',
                bundle.sourceJson
            )
        ]

        if (includeModels) {
            entries.push(
                ...bundle.models.map((model) => ({
                    path:
                        'models/' +
                        SourceBundleExporter.#safeFileName(model.name),
                    bytes: model.bytes,
                    contentType: SourceBundleExporter.#modelContentType(model)
                }))
            )
        }

        return {
            manifest,
            entries: entries.sort((left, right) =>
                left.path.localeCompare(right.path)
            )
        }
    }

    /**
     * Builds a deterministic manifest.
     * @param {object} bundle Normalized bundle.
     * @param {boolean} includeModels Whether model assets are included.
     * @returns {object}
     */
    static #buildManifest(bundle, includeModels) {
        return {
            schema: 'ecad-source-bundle-v1',
            component: {
                id: bundle.id,
                name: bundle.name,
                symbolName: bundle.symbol.name,
                footprintName: bundle.footprint.name
            },
            assets: includeModels
                ? bundle.models.map((model) => ({
                      name: model.name,
                      format: model.format,
                      path:
                          'models/' +
                          SourceBundleExporter.#safeFileName(model.name),
                      byteLength: model.bytes.byteLength
                  }))
                : []
        }
    }

    /**
     * Creates one JSON entry.
     * @param {string} path Entry path.
     * @param {object} value JSON value.
     * @returns {{ path: string, bytes: Uint8Array, contentType: string }}
     */
    static #jsonEntry(path, value) {
        return {
            path,
            bytes: new TextEncoder().encode(
                SourceBundleExporter.#stableStringify(value) + '\n'
            ),
            contentType: 'application/json'
        }
    }

    /**
     * Returns a stable JSON string with sorted object keys.
     * @param {any} value JSON-compatible value.
     * @returns {string}
     */
    static #stableStringify(value) {
        return JSON.stringify(SourceBundleExporter.#sortJson(value), null, 2)
    }

    /**
     * Recursively sorts JSON object keys.
     * @param {any} value JSON-compatible value.
     * @returns {any}
     */
    static #sortJson(value) {
        if (Array.isArray(value)) {
            return value.map((entry) => SourceBundleExporter.#sortJson(entry))
        }

        if (
            value &&
            typeof value === 'object' &&
            !(value instanceof Uint8Array)
        ) {
            return Object.fromEntries(
                Object.keys(value)
                    .sort()
                    .map((key) => [
                        key,
                        SourceBundleExporter.#sortJson(value[key])
                    ])
            )
        }

        return value
    }

    /**
     * Returns a safe bundle file name.
     * @param {string} name Raw file name.
     * @returns {string}
     */
    static #safeFileName(name) {
        return String(name || 'model.step').replace(
            /[\\/:\u0000-\u001f]/gu,
            '_'
        )
    }

    /**
     * Resolves a model content type.
     * @param {object} model Model descriptor.
     * @returns {string}
     */
    static #modelContentType(model) {
        if (model.format === 'obj') return 'model/obj'
        if (model.format === 'mtl') return 'text/plain'
        return 'model/step'
    }
}
