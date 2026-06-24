// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Normalizes component-provider responses into one exporter-ready bundle.
 */
export class SourceComponentBundleNormalizer {
    /**
     * Normalizes a raw provider response.
     * @param {object} rawComponent Raw component response.
     * @returns {{ id: string, name: string, metadata: object, symbol: object, footprint: object, models: object[], sourceJson: object, diagnostics: object[] }}
     */
    static normalize(rawComponent = {}) {
        const source = SourceComponentBundleNormalizer.#unwrap(rawComponent)
        const metadata = SourceComponentBundleNormalizer.#normalizeMetadata(
            rawComponent,
            source
        )
        const symbol = SourceComponentBundleNormalizer.#normalizeSymbol(source)
        const footprint =
            SourceComponentBundleNormalizer.#normalizeFootprint(source)
        const models = SourceComponentBundleNormalizer.#normalizeModels(source)
        const bundle = {
            id: SourceComponentBundleNormalizer.#firstString(
                source.id,
                source.uuid,
                source.componentId,
                rawComponent.id,
                rawComponent.uuid,
                metadata.partNumber,
                metadata.name,
                'component'
            ),
            name: SourceComponentBundleNormalizer.#firstString(
                source.name,
                source.title,
                rawComponent.name,
                rawComponent.title,
                metadata.name,
                metadata.partNumber,
                'Component'
            ),
            metadata,
            symbol,
            footprint,
            models,
            sourceJson: rawComponent,
            diagnostics: []
        }

        bundle.diagnostics =
            SourceComponentBundleNormalizer.#buildDiagnostics(bundle)

        return bundle
    }

    /**
     * Unwraps common response envelopes.
     * @param {object} rawComponent Raw component response.
     * @returns {object}
     */
    static #unwrap(rawComponent) {
        return (
            rawComponent?.data?.component ||
            rawComponent?.data?.result ||
            rawComponent?.data ||
            rawComponent?.result ||
            rawComponent?.component ||
            rawComponent ||
            {}
        )
    }

    /**
     * Normalizes component metadata.
     * @param {object} rawComponent Raw component response.
     * @param {object} source Unwrapped response.
     * @returns {object}
     */
    static #normalizeMetadata(rawComponent, source) {
        return {
            ...(rawComponent?.metadata || {}),
            ...(source?.metadata || {}),
            ...(source?.attributes || {})
        }
    }

    /**
     * Normalizes the schematic symbol portion of a bundle.
     * @param {object} source Unwrapped response.
     * @returns {{ name: string, pins: object[], primitives: object[], raw: object }}
     */
    static #normalizeSymbol(source) {
        const symbol = source?.symbol || source?.schematic || {}

        return {
            name: SourceComponentBundleNormalizer.#firstString(
                symbol.name,
                symbol.title,
                source.symbolName,
                source.name,
                'Component'
            ),
            pins: SourceComponentBundleNormalizer.#array(
                symbol.pins || symbol.pinList
            ),
            primitives: SourceComponentBundleNormalizer.#array(
                symbol.primitives || symbol.shapes || symbol.graphics
            ),
            raw: symbol
        }
    }

    /**
     * Normalizes the PCB footprint portion of a bundle.
     * @param {object} source Unwrapped response.
     * @returns {{ name: string, pads: object[], tracks: object[], arcs: object[], fills: object[], texts: object[], primitives: object[], raw: object }}
     */
    static #normalizeFootprint(source) {
        const footprint = source?.footprint || source?.package || {}

        return {
            name: SourceComponentBundleNormalizer.#firstString(
                footprint.name,
                footprint.title,
                source.footprintName,
                source.packageName,
                source.name,
                'Component'
            ),
            pads: SourceComponentBundleNormalizer.#array(footprint.pads),
            tracks: SourceComponentBundleNormalizer.#array(footprint.tracks),
            arcs: SourceComponentBundleNormalizer.#array(footprint.arcs),
            fills: SourceComponentBundleNormalizer.#array(footprint.fills),
            texts: SourceComponentBundleNormalizer.#array(footprint.texts),
            primitives: SourceComponentBundleNormalizer.#array(
                footprint.primitives || footprint.shapes
            ),
            component:
                SourceComponentBundleNormalizer.#normalizeFootprintComponent(
                    footprint.component || source.component
                ),
            raw: footprint
        }
    }

    /**
     * Preserves source footprint component placement metadata for exporters.
     * @param {object | undefined} component Source component placement.
     * @returns {object}
     */
    static #normalizeFootprintComponent(component) {
        return component && typeof component === 'object'
            ? { ...component }
            : {}
    }

    /**
     * Normalizes model asset descriptors.
     * @param {object} source Unwrapped response.
     * @returns {object[]}
     */
    static #normalizeModels(source) {
        const models = SourceComponentBundleNormalizer.#array(
            source?.models || source?.modelAssets || source?.assets
        )

        return models
            .map((model, index) =>
                SourceComponentBundleNormalizer.#normalizeModel(model, index)
            )
            .filter(Boolean)
    }

    /**
     * Normalizes one model asset descriptor.
     * @param {object} model Raw model asset.
     * @param {number} index Model index.
     * @returns {object | null}
     */
    static #normalizeModel(model, index) {
        if (!model || typeof model !== 'object') {
            return null
        }

        const name = SourceComponentBundleNormalizer.#firstString(
            model.name,
            model.fileName,
            model.path,
            'model-' + index + '.step'
        )
        const bytes =
            SourceComponentBundleNormalizer.#normalizeModelBytes(model)
        const transform =
            SourceComponentBundleNormalizer.#normalizeModelTransform(model)

        return {
            id: SourceComponentBundleNormalizer.#firstString(
                model.id,
                model.uuid,
                'model-' + index
            ),
            name,
            format: SourceComponentBundleNormalizer.#normalizeFormat(
                model.format,
                name
            ),
            bytes,
            text:
                typeof model.text === 'string'
                    ? model.text
                    : new TextDecoder().decode(bytes),
            sourceUrl: SourceComponentBundleNormalizer.#firstString(
                model.url,
                model.downloadUrl,
                model.sourceUrl
            ),
            ...(transform ? { transform } : {}),
            ...(model.generated === true ? { generated: true } : {}),
            raw: model
        }
    }

    /**
     * Preserves optional model placement transforms.
     * @param {object} model Raw model asset.
     * @returns {object | null}
     */
    static #normalizeModelTransform(model) {
        const transform = model.transform || model.modelTransform || null
        return transform && typeof transform === 'object'
            ? { ...transform }
            : null
    }

    /**
     * Normalizes one model payload into bytes.
     * @param {object} model Raw model asset.
     * @returns {Uint8Array}
     */
    static #normalizeModelBytes(model) {
        if (model.bytes instanceof Uint8Array) {
            return new Uint8Array(model.bytes)
        }

        if (model.arrayBuffer instanceof ArrayBuffer) {
            return new Uint8Array(model.arrayBuffer)
        }

        if (typeof model.text === 'string') {
            return new TextEncoder().encode(model.text)
        }

        if (typeof model.content === 'string') {
            return new TextEncoder().encode(model.content)
        }

        return new Uint8Array(0)
    }

    /**
     * Normalizes one model format id.
     * @param {any} format Explicit format.
     * @param {string} name File name.
     * @returns {string}
     */
    static #normalizeFormat(format, name) {
        const explicit = String(format || '').toLowerCase()
        if (explicit) {
            return explicit.replace(/^\./u, '')
        }

        const extension = String(name || '')
            .split('.')
            .at(-1)
        return extension ? extension.toLowerCase() : 'step'
    }

    /**
     * Builds bundle diagnostics.
     * @param {object} bundle Normalized bundle.
     * @returns {object[]}
     */
    static #buildDiagnostics(bundle) {
        const diagnostics = []

        if (!bundle.symbol.raw || !Object.keys(bundle.symbol.raw).length) {
            diagnostics.push({
                severity: 'warning',
                message: 'No schematic symbol data was present.'
            })
        }

        if (
            !bundle.footprint.raw ||
            !Object.keys(bundle.footprint.raw).length
        ) {
            diagnostics.push({
                severity: 'warning',
                message: 'No PCB footprint data was present.'
            })
        }

        return diagnostics
    }

    /**
     * Returns an array for a possible array value.
     * @param {any} value Possible array.
     * @returns {object[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }

    /**
     * Returns the first non-empty string.
     * @param {...any} values Candidate values.
     * @returns {string}
     */
    static #firstString(...values) {
        const value = values.find((candidate) => String(candidate || '').trim())
        return String(value || '')
    }
}
