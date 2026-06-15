// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic inventories of embedded assets across parser roots.
 */
export class EmbeddedAssetReportBuilder {
    static SCHEMA = 'altium-toolkit.embedded-assets.a1'

    /**
     * Builds an embedded-asset report.
     * @param {{ models?: object[] } | object[]} input Parser-root models.
     * @returns {object}
     */
    static build(input = {}) {
        const models = EmbeddedAssetReportBuilder.#models(input)
        const assets = EmbeddedAssetReportBuilder.#dedupeAssets(
            models.flatMap((model) =>
                EmbeddedAssetReportBuilder.#assetsForModel(model)
            )
        ).sort(EmbeddedAssetReportBuilder.#compareAssets)

        return {
            schema: EmbeddedAssetReportBuilder.SCHEMA,
            summary: {
                modelCount: models.length,
                assetCount: assets.length,
                totalByteCount: assets.reduce(
                    (count, asset) => count + asset.byteLength,
                    0
                ),
                byKind: EmbeddedAssetReportBuilder.#byKind(assets)
            },
            assets
        }
    }

    /**
     * Normalizes builder input to a model array.
     * @param {{ models?: object[] } | object[]} input Builder input.
     * @returns {object[]}
     */
    static #models(input) {
        if (Array.isArray(input)) return input
        return Array.isArray(input?.models) ? input.models : []
    }

    /**
     * Collects embedded asset rows from one parser-root model.
     * @param {object} model Parser-root model.
     * @returns {object[]}
     */
    static #assetsForModel(model) {
        const base = {
            modelFileName: String(model?.fileName || ''),
            modelKind: String(model?.kind || '')
        }

        return [
            ...EmbeddedAssetReportBuilder.#schematicAssets(base, model),
            ...EmbeddedAssetReportBuilder.#schematicLibraryAssets(base, model),
            ...EmbeddedAssetReportBuilder.#pcbAssets(base, model),
            ...EmbeddedAssetReportBuilder.#pcbLibraryAssets(base, model),
            ...EmbeddedAssetReportBuilder.#integratedLibraryAssets(base, model)
        ].filter(Boolean)
    }

    /**
     * Collects schematic-document assets.
     * @param {object} base Shared row fields.
     * @param {object} model Parser-root model.
     * @returns {object[]}
     */
    static #schematicAssets(base, model) {
        const schematic = model?.schematic || {}

        return [
            ...EmbeddedAssetReportBuilder.#collectionAssets(
                base,
                'embedded-file',
                schematic.embeddedFiles?.files || []
            ),
            ...EmbeddedAssetReportBuilder.#collectionAssets(
                base,
                'schematic-image',
                schematic.images || [],
                { fallbackName: 'image' }
            ),
            ...EmbeddedAssetReportBuilder.#collectionAssets(
                base,
                'schematic-thumbnail',
                schematic.thumbnails || [],
                { fallbackName: 'thumbnail' }
            )
        ]
    }

    /**
     * Collects schematic-library assets.
     * @param {object} base Shared row fields.
     * @param {object} model Parser-root model.
     * @returns {object[]}
     */
    static #schematicLibraryAssets(base, model) {
        const schematicLibrary = model?.schematicLibrary || {}
        const embeddedFiles = schematicLibrary.embeddedFiles?.files || []
        const symbolAssets = (schematicLibrary.symbols || []).flatMap(
            (symbol) =>
                (symbol.embeddedAssets || []).map((asset) => ({
                    ...asset,
                    symbolName: symbol.name
                }))
        )

        return EmbeddedAssetReportBuilder.#collectionAssets(
            base,
            'embedded-file',
            embeddedFiles.length ? embeddedFiles : symbolAssets
        )
    }

    /**
     * Collects PCB-document assets.
     * @param {object} base Shared row fields.
     * @param {object} model Parser-root model.
     * @returns {object[]}
     */
    static #pcbAssets(base, model) {
        const pcb = model?.pcb || {}

        return [
            ...EmbeddedAssetReportBuilder.#collectionAssets(
                base,
                'pcb-font',
                pcb.embeddedFonts || []
            ),
            ...EmbeddedAssetReportBuilder.#collectionAssets(
                base,
                'pcb-model',
                pcb.embeddedModels || []
            )
        ]
    }

    /**
     * Collects PCB-library assets.
     * @param {object} base Shared row fields.
     * @param {object} model Parser-root model.
     * @returns {object[]}
     */
    static #pcbLibraryAssets(base, model) {
        const pcbLibrary = model?.pcbLibrary || {}
        const footprintModels = (pcbLibrary.footprints || []).flatMap(
            (footprint) =>
                (footprint.embeddedModels || []).map((asset) => ({
                    ...asset,
                    footprintName: footprint.name
                }))
        )

        return [
            ...EmbeddedAssetReportBuilder.#collectionAssets(
                base,
                'pcb-font',
                pcbLibrary.embeddedFonts || []
            ),
            ...EmbeddedAssetReportBuilder.#collectionAssets(
                base,
                'pcb-model',
                pcbLibrary.embeddedModels || []
            ),
            ...EmbeddedAssetReportBuilder.#collectionAssets(
                base,
                'pcb-model',
                footprintModels
            )
        ]
    }

    /**
     * Collects integrated-library source assets.
     * @param {object} base Shared row fields.
     * @param {object} model Parser-root model.
     * @returns {object[]}
     */
    static #integratedLibraryAssets(base, model) {
        return EmbeddedAssetReportBuilder.#collectionAssets(
            base,
            'integrated-library-source',
            model?.integratedLibrary?.sources || []
        )
    }

    /**
     * Normalizes one asset collection.
     * @param {object} base Shared row fields.
     * @param {string} kind Asset kind.
     * @param {object[]} assets Source assets.
     * @param {{ fallbackName?: string }} options Collection options.
     * @returns {object[]}
     */
    static #collectionAssets(base, kind, assets, options = {}) {
        return (Array.isArray(assets) ? assets : []).map((asset, index) =>
            EmbeddedAssetReportBuilder.#assetRow(base, kind, asset, index, {
                fallbackName: options.fallbackName || kind
            })
        )
    }

    /**
     * Normalizes one asset row.
     * @param {object} base Shared row fields.
     * @param {string} kind Asset kind.
     * @param {object} asset Source asset.
     * @param {number} index Collection index.
     * @param {{ fallbackName: string }} options Row options.
     * @returns {object}
     */
    static #assetRow(base, kind, asset, index, options) {
        return EmbeddedAssetReportBuilder.#stripUndefined({
            ...base,
            kind,
            name: EmbeddedAssetReportBuilder.#assetName(
                asset,
                index,
                options.fallbackName
            ),
            format: EmbeddedAssetReportBuilder.#format(asset),
            sourceStream: EmbeddedAssetReportBuilder.#sourceStream(asset),
            byteLength: EmbeddedAssetReportBuilder.#byteLength(asset),
            symbolName: asset?.symbolName,
            footprintName: asset?.footprintName
        })
    }

    /**
     * Resolves a stable asset name.
     * @param {object} asset Source asset.
     * @param {number} index Collection index.
     * @param {string} fallbackName Fallback prefix.
     * @returns {string}
     */
    static #assetName(asset, index, fallbackName) {
        return String(
            asset?.name ||
                asset?.family ||
                asset?.fileName ||
                asset?.key ||
                asset?.id ||
                EmbeddedAssetReportBuilder.#basename(
                    EmbeddedAssetReportBuilder.#sourceStream(asset)
                ) ||
                fallbackName + '-' + index
        )
    }

    /**
     * Resolves a source stream or source path.
     * @param {object} asset Source asset.
     * @returns {string}
     */
    static #sourceStream(asset) {
        return String(asset?.sourceStream || asset?.path || asset?.stream || '')
    }

    /**
     * Resolves asset byte length.
     * @param {object} asset Source asset.
     * @returns {number}
     */
    static #byteLength(asset) {
        const value =
            asset?.byteLength ??
            asset?.byteCount ??
            asset?.payloadByteLength ??
            asset?.size ??
            0
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : 0
    }

    /**
     * Resolves a compact asset format.
     * @param {object} asset Source asset.
     * @returns {string}
     */
    static #format(asset) {
        const explicit =
            asset?.format || asset?.fileType || asset?.type || asset?.mimeType
        const normalized = String(explicit || '').trim()

        if (!normalized) return 'unknown'
        if (normalized.includes('/')) {
            return normalized.split('/').pop()
        }

        return normalized
    }

    /**
     * Builds a sorted count map by asset kind.
     * @param {object[]} assets Asset rows.
     * @returns {Record<string, number>}
     */
    static #byKind(assets) {
        const counts = new Map()

        for (const asset of assets) {
            counts.set(asset.kind, (counts.get(asset.kind) || 0) + 1)
        }

        return Object.fromEntries(
            [...counts.entries()].sort(([left], [right]) =>
                left.localeCompare(right)
            )
        )
    }

    /**
     * Dedupe exact asset references.
     * @param {object[]} assets Asset rows.
     * @returns {object[]}
     */
    static #dedupeAssets(assets) {
        const byKey = new Map()

        for (const asset of assets) {
            const key = [
                asset.modelFileName,
                asset.modelKind,
                asset.kind,
                asset.sourceStream,
                asset.name
            ].join('\0')
            if (!byKey.has(key)) {
                byKey.set(key, asset)
            }
        }

        return [...byKey.values()]
    }

    /**
     * Sorts report rows deterministically.
     * @param {object} left Left row.
     * @param {object} right Right row.
     * @returns {number}
     */
    static #compareAssets(left, right) {
        return (
            left.modelFileName.localeCompare(right.modelFileName) ||
            left.kind.localeCompare(right.kind) ||
            left.name.localeCompare(right.name) ||
            left.sourceStream.localeCompare(right.sourceStream)
        )
    }

    /**
     * Resolves a path basename.
     * @param {string} value Path-like value.
     * @returns {string}
     */
    static #basename(value) {
        return (
            String(value || '')
                .split('/')
                .filter(Boolean)
                .pop() || ''
        )
    }

    /**
     * Removes undefined values from a row.
     * @param {object} row Row to normalize.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined)
        )
    }
}
