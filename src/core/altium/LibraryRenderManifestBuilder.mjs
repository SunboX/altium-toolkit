// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds deterministic render/export manifests for read-only library models.
 */
export class LibraryRenderManifestBuilder {
    static #SCHEMA = 'altium-toolkit.library.render-manifest.a1'

    /**
     * Builds a schematic-symbol library render manifest.
     * @param {{ symbols?: object[] } | { schematicLibrary?: { symbols?: object[] } }} library Parsed schematic library.
     * @returns {{ schema: string, libraryKind: string, outputs: object[], embeddedAssets: object[] }}
     */
    static buildSchematicLibraryManifest(library) {
        const schematicLibrary = library?.schematicLibrary || library || {}
        const symbols = Array.isArray(schematicLibrary.symbols)
            ? schematicLibrary.symbols
            : []
        const outputs = symbols.flatMap((symbol, symbolIndex) =>
            LibraryRenderManifestBuilder.#schematicSymbolOutputs(
                symbol,
                symbolIndex
            )
        )

        return {
            schema: LibraryRenderManifestBuilder.#SCHEMA,
            libraryKind: 'schematic-symbols',
            outputs,
            embeddedAssets: LibraryRenderManifestBuilder.#dedupeEmbeddedAssets(
                outputs.flatMap((output) => output.embeddedAssets || [])
            )
        }
    }

    /**
     * Builds a PCB footprint-library render manifest.
     * @param {{ footprints?: object[], embeddedAssets?: object[] } | { pcbLibrary?: { footprints?: object[], embeddedAssets?: object[] } }} library Parsed PCB library.
     * @returns {{ schema: string, libraryKind: string, outputs: object[], embeddedAssets: object[] }}
     */
    static buildPcbLibraryManifest(library) {
        const pcbLibrary = library?.pcbLibrary || library || {}
        const footprints = Array.isArray(pcbLibrary.footprints)
            ? pcbLibrary.footprints
            : []
        const outputs = footprints.map((footprint, footprintIndex) =>
            LibraryRenderManifestBuilder.#pcbFootprintOutput(
                footprint,
                footprintIndex
            )
        )

        return {
            schema: LibraryRenderManifestBuilder.#SCHEMA,
            libraryKind: 'pcb-footprints',
            outputs,
            embeddedAssets: LibraryRenderManifestBuilder.#dedupeEmbeddedAssets([
                ...(pcbLibrary.embeddedAssets || []),
                ...outputs.flatMap((output) => output.embeddedAssets || [])
            ])
        }
    }

    /**
     * Builds a read-only manifest for symbols extractable from placed
     * schematic components.
     * @param {{ fileName?: string, schematic?: object } | { schematic?: object }} documentModel Parsed schematic document model.
     * @returns {{ schema: string, sourceDocument: string, outputs: object[], embeddedAssets: object[] }}
     */
    static buildSchematicExtractionManifest(documentModel) {
        const schematic = documentModel?.schematic || documentModel || {}
        const components = Array.isArray(schematic.components)
            ? schematic.components
            : []
        const outputs = components.map((component, componentIndex) =>
            LibraryRenderManifestBuilder.#schematicExtractionOutput(
                documentModel?.fileName || '',
                schematic,
                component,
                componentIndex
            )
        )

        return {
            schema: 'altium-toolkit.schematic.extraction-manifest.a1',
            sourceDocument: String(documentModel?.fileName || ''),
            summary: {
                outputCount: outputs.length,
                embeddedAssetCount:
                    LibraryRenderManifestBuilder.#dedupeEmbeddedAssets(
                        outputs.flatMap((output) => output.embeddedAssets || [])
                    ).length,
                readyOutputCount: outputs.filter(
                    (output) =>
                        output.databaseLibrary?.readiness === 'ready' ||
                        !output.databaseLibrary
                ).length,
                strippedParameterCount: outputs.reduce(
                    (count, output) =>
                        count +
                        (output.databaseLibrary?.strippedParameterNames
                            ?.length || 0),
                    0
                ),
                strippedImplementationCount: outputs.reduce(
                    (count, output) =>
                        count +
                        (output.databaseLibrary?.strippedImplementationKeys
                            ?.length || 0),
                    0
                )
            },
            outputs,
            embeddedAssets: LibraryRenderManifestBuilder.#dedupeEmbeddedAssets(
                outputs.flatMap((output) => output.embeddedAssets || [])
            )
        }
    }

    /**
     * Builds a read-only manifest for extracting a schematic template.
     * @param {{ fileName?: string, schematic?: { template?: object } } | { template?: object }} documentModel Parsed schematic document model.
     * @returns {object}
     */
    static buildSchematicTemplateExtractionManifest(documentModel) {
        const template =
            documentModel?.schematic?.template ||
            documentModel?.template ||
            null
        const identity = template?.identity || {}
        const outputKey =
            'schematic-template/' +
            LibraryRenderManifestBuilder.#slug(
                LibraryRenderManifestBuilder.#withoutExtension(
                    identity.fileName || identity.name || 'template'
                )
            ) +
            '.schdot'
        const diagnostics = (template?.missingParameters || []).map(
            (parameterName) => ({
                code: 'schematic.template-extraction.missing-parameter',
                severity: 'warning',
                parameterName
            })
        )

        return {
            schema: 'altium-toolkit.schematic.template-extraction.a1',
            sourceDocument: String(documentModel?.fileName || ''),
            template: template
                ? {
                      identity,
                      outputTemplateKey: outputKey,
                      renderManifestKey: outputKey.replace(
                          /\.schdot$/u,
                          '.render.json'
                      ),
                      ownedRecordKeys: template.ownedRecordKeys || [],
                      ownedGraphics: template.ownedGraphics || {},
                      fonts: template.fonts || {},
                      missingParameters: template.missingParameters || [],
                      titleBlock: template.titleBlock || {}
                  }
                : null,
            summary: {
                templatePresent: Boolean(template),
                ownedRecordCount: (template?.ownedRecordKeys || []).length,
                missingParameterCount: (template?.missingParameters || [])
                    .length,
                fontCount: Object.keys(template?.fonts || {}).length
            },
            diagnostics
        }
    }

    /**
     * Builds render outputs for one schematic symbol.
     * @param {object} symbol Symbol record.
     * @param {number} symbolIndex Symbol index.
     * @returns {object[]}
     */
    static #schematicSymbolOutputs(symbol, symbolIndex) {
        const symbolKey =
            'symbol-' +
            symbolIndex +
            '-' +
            LibraryRenderManifestBuilder.#slug(symbol?.name || symbolIndex)
        const parts =
            Array.isArray(symbol?.parts) && symbol.parts.length
                ? symbol.parts
                : [{ partId: 'default' }]
        const embeddedAssets =
            LibraryRenderManifestBuilder.#embeddedAssets(symbol)

        return parts.map((part, partIndex) => {
            const partId = String(part?.partId || part?.id || partIndex)
            const partKey =
                symbolKey +
                '/part-' +
                LibraryRenderManifestBuilder.#slug(partId)

            return {
                kind: 'symbol',
                symbolKey,
                name: String(symbol?.name || ''),
                partKey,
                partId,
                outputSvgKey: 'schematic-library/' + partKey + '.svg',
                embeddedAssets
            }
        })
    }

    /**
     * Builds one PCB footprint output descriptor.
     * @param {object} footprint Footprint record.
     * @param {number} footprintIndex Footprint index.
     * @returns {object}
     */
    static #pcbFootprintOutput(footprint, footprintIndex) {
        const footprintKey =
            'footprint-' +
            footprintIndex +
            '-' +
            LibraryRenderManifestBuilder.#slug(
                footprint?.name || footprintIndex
            )
        const layerSvgs = LibraryRenderManifestBuilder.#footprintLayers(
            footprint
        ).map((layer) => ({
            layerKey: layer.layerKey,
            layerId: layer.layerId,
            displayName: layer.displayName,
            outputSvgKey:
                'pcb-library/' + footprintKey + '/' + layer.layerKey + '.svg'
        }))

        return {
            kind: 'footprint',
            footprintKey,
            name: String(footprint?.name || ''),
            sourceStorage: String(footprint?.sourceStorage || ''),
            outputSvgKey: 'pcb-library/' + footprintKey + '.svg',
            layerSvgs,
            embeddedAssets:
                LibraryRenderManifestBuilder.#embeddedAssets(footprint)
        }
    }

    /**
     * Builds one placed-component extraction output.
     * @param {string} sourceDocument Source document name.
     * @param {object} schematic Schematic model.
     * @param {object} component Component row.
     * @param {number} componentIndex Component index.
     * @returns {object}
     */
    static #schematicExtractionOutput(
        sourceDocument,
        schematic,
        component,
        componentIndex
    ) {
        const symbolName =
            component?.libReference || component?.designator || ''
        const symbolKey =
            'symbol-extract-' +
            componentIndex +
            '-' +
            LibraryRenderManifestBuilder.#slug(symbolName || componentIndex)
        const ownerIndex = String(component?.ownerIndex || '').trim()
        const children = LibraryRenderManifestBuilder.#schematicOwnerChildren(
            schematic,
            ownerIndex
        )
        const embeddedAssets =
            LibraryRenderManifestBuilder.#dedupeEmbeddedAssets(
                children.images.map((image, index) =>
                    LibraryRenderManifestBuilder.#imageAssetDescriptor(
                        image,
                        'symbol-image-' + index
                    )
                )
            )
        const databaseLibrary =
            LibraryRenderManifestBuilder.#databaseLibraryExtractionPlan(
                symbolKey,
                component,
                schematic
            )

        return LibraryRenderManifestBuilder.#stripUndefined({
            kind: 'symbol-extraction',
            symbolKey,
            sourceComponent: LibraryRenderManifestBuilder.#stripUndefined({
                designator: component?.designator,
                libReference: component?.libReference,
                uniqueId: component?.uniqueId,
                ownerIndex
            }),
            outputLibraryKey: 'schematic-extract/' + symbolKey + '.SchLib',
            renderManifestKey:
                'schematic-extract/' + symbolKey + '.render.json',
            partKeys: [symbolKey + '/part-default'],
            childCounts: {
                pins: children.pins.length,
                graphics: children.graphics.length,
                texts: children.texts.length,
                images: children.images.length
            },
            embeddedAssets,
            databaseLibrary
        })
    }

    /**
     * Builds a database-library audit plan for one extracted symbol.
     * @param {string} symbolKey Symbol extraction key.
     * @param {object} component Source component row.
     * @param {object} schematic Schematic model.
     * @returns {object | undefined}
     */
    static #databaseLibraryExtractionPlan(symbolKey, component, schematic) {
        const parameters = component?.parameters || {}
        const parameterNames = Object.keys(parameters)
        const strippedParameterNames = parameterNames.filter((name) =>
            LibraryRenderManifestBuilder.#isPlacementParameterName(name)
        )
        const preservedParameterNames = parameterNames.filter(
            (name) =>
                !LibraryRenderManifestBuilder.#isPlacementParameterName(name)
        )
        const strippedImplementationKeys =
            LibraryRenderManifestBuilder.#componentImplementationKeys(
                schematic,
                component
            )

        if (
            strippedParameterNames.length === 0 &&
            preservedParameterNames.length === 0 &&
            strippedImplementationKeys.length === 0
        ) {
            return undefined
        }

        return {
            readiness: 'ready',
            preservedParameterNames,
            strippedParameterNames,
            stripImplementationLinks: strippedImplementationKeys.length > 0,
            strippedImplementationKeys,
            auditKey: 'schematic-extract/' + symbolKey + '.dblib.json'
        }
    }

    /**
     * Returns true for component-placement parameter names not suitable for
     * extracted library symbols.
     * @param {string} name Parameter name.
     * @returns {boolean}
     */
    static #isPlacementParameterName(name) {
        return ['designator', 'comment'].includes(
            String(name || '').toLowerCase()
        )
    }

    /**
     * Finds implementation keys associated with one placed component.
     * @param {object} schematic Schematic model.
     * @param {object} component Component row.
     * @returns {string[]}
     */
    static #componentImplementationKeys(schematic, component) {
        const ownerIndex = String(component?.ownerIndex || '').trim()
        const componentKey = ownerIndex
            ? 'schematic-component-' + ownerIndex
            : ''

        return (
            schematic?.implementations?.components?.find(
                (entry) => entry.componentKey === componentKey
            )?.implementationKeys || []
        )
    }

    /**
     * Collects schematic primitives owned by one component owner index.
     * @param {object} schematic Schematic model.
     * @param {string} ownerIndex Owner index.
     * @returns {{ pins: object[], graphics: object[], texts: object[], images: object[] }}
     */
    static #schematicOwnerChildren(schematic, ownerIndex) {
        const ownerMatches = (item) =>
            ownerIndex && String(item?.ownerIndex || '').trim() === ownerIndex
        const graphics = [
            ...(schematic?.lines || []),
            ...(schematic?.polygons || []),
            ...(schematic?.rectangles || []),
            ...(schematic?.ellipses || []),
            ...(schematic?.arcs || []),
            ...(schematic?.beziers || []),
            ...(schematic?.pies || []),
            ...(schematic?.regions || [])
        ].filter(ownerMatches)

        return {
            pins: (schematic?.pins || []).filter(ownerMatches),
            graphics,
            texts: (schematic?.texts || []).filter(ownerMatches),
            images: (schematic?.images || []).filter(ownerMatches)
        }
    }

    /**
     * Collects layer descriptors touched by one footprint.
     * @param {object} footprint Footprint record.
     * @returns {{ layerKey: string, layerId?: number, displayName: string }[]}
     */
    static #footprintLayers(footprint) {
        const layerMap = new Map()
        const primitiveFamilies = [
            'pads',
            'tracks',
            'arcs',
            'vias',
            'fills',
            'texts',
            'regions',
            'shapeBasedRegions'
        ]

        for (const family of primitiveFamilies) {
            for (const primitive of footprint?.[family] || []) {
                const layer =
                    LibraryRenderManifestBuilder.#layerDescriptor(primitive)
                if (layer) {
                    layerMap.set(layer.layerKey, layer)
                }
            }
        }

        return [...layerMap.values()].sort((left, right) =>
            left.layerKey.localeCompare(right.layerKey)
        )
    }

    /**
     * Builds a normalized layer descriptor for one primitive.
     * @param {object} primitive Primitive record.
     * @returns {{ layerKey: string, layerId?: number, displayName: string } | null}
     */
    static #layerDescriptor(primitive) {
        const layerId = Number.isInteger(primitive?.layerId)
            ? primitive.layerId
            : null
        const layerName = String(
            primitive?.layerName || primitive?.layer || ''
        ).trim()

        if (layerId === null && !layerName) {
            return null
        }

        const layerKey =
            layerId === null
                ? 'layer-' + LibraryRenderManifestBuilder.#slug(layerName)
                : 'L' + layerId

        return {
            layerKey,
            ...(layerId === null ? {} : { layerId }),
            displayName: layerName || layerKey
        }
    }

    /**
     * Collects embedded assets from a library item.
     * @param {object} item Library item.
     * @returns {object[]}
     */
    static #embeddedAssets(item) {
        return [
            ...(Array.isArray(item?.embeddedAssets) ? item.embeddedAssets : []),
            ...(Array.isArray(item?.embeddedModels)
                ? item.embeddedModels.map((model, index) => ({
                      key: model.key || model.id || 'model-' + index,
                      format: model.format,
                      sourceStream: model.sourceStream,
                      name: model.name
                  }))
                : []),
            ...(Array.isArray(item?.embeddedFonts)
                ? item.embeddedFonts.map((font, index) => ({
                      key: font.key || font.name || 'font-' + index,
                      format: 'font',
                      sourceStream: font.sourceStream,
                      name: font.name
                  }))
                : [])
        ].map((asset) =>
            LibraryRenderManifestBuilder.#stripUndefined(asset || {})
        )
    }

    /**
     * Builds an asset descriptor for a schematic image payload.
     * @param {object} image Schematic image record.
     * @param {string} fallbackKey Fallback asset key.
     * @returns {object}
     */
    static #imageAssetDescriptor(image, fallbackKey) {
        return LibraryRenderManifestBuilder.#stripUndefined({
            key: image?.key || image?.id || fallbackKey,
            format: image?.format,
            nativeFormat: image?.nativeFormat,
            wrapperType: image?.wrapperType,
            byteSize: image?.byteSize,
            checksum: image?.checksum,
            sourceStream: image?.sourceStream,
            name: image?.name,
            diagnostics: image?.diagnostics
        })
    }

    /**
     * Deduplicates embedded asset descriptors.
     * @param {object[]} assets Asset descriptors.
     * @returns {object[]}
     */
    static #dedupeEmbeddedAssets(assets) {
        const seen = new Set()
        const deduped = []

        for (const asset of assets || []) {
            const key = JSON.stringify(asset)
            if (seen.has(key)) {
                continue
            }

            seen.add(key)
            deduped.push(asset)
        }

        return deduped
    }

    /**
     * Removes undefined values from one object.
     * @param {object} value Source object.
     * @returns {object}
     */
    static #stripUndefined(value) {
        return Object.fromEntries(
            Object.entries(value).filter(
                ([, entryValue]) => entryValue !== undefined
            )
        )
    }

    /**
     * Converts a display value to a deterministic lowercase key segment.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #slug(value) {
        return (
            String(value || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, '-')
                .replace(/^-+|-+$/gu, '') || 'item'
        )
    }

    /**
     * Removes a final filename extension from a display name.
     * @param {unknown} value Source value.
     * @returns {string}
     */
    static #withoutExtension(value) {
        return String(value || '').replace(/\.[A-Za-z0-9]+$/u, '')
    }
}
