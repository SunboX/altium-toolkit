// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds Draftsman board-view/cache metadata sidecars from text containers.
 */
export class DraftsmanBoardViewMetadataBuilder {
    static SCHEMA_ID = 'altium-toolkit.draftsman.board-view-cache.a1'

    /**
     * Normalizes board-view/cache metadata used by drawing review surfaces.
     * @param {string} text Decoded container text.
     * @param {object[]} pages Parsed pages.
     * @returns {object | undefined}
     */
    static build(text, pages) {
        const layerColors = DraftsmanBoardViewMetadataBuilder.#globalTagFields(
            text,
            ['LayerColor', 'LayerColorV2']
        ).map((fields) =>
            DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                id: fields.Id || fields.ID,
                layerId: DraftsmanBoardViewMetadataBuilder.#integer(
                    fields.LayerId
                ),
                layerName:
                    fields.LayerName || fields.DisplayName || fields.Name,
                role: fields.Role || fields.LayerRole,
                color: fields.Color,
                fields
            })
        )
        const pcbParameters = Object.fromEntries(
            DraftsmanBoardViewMetadataBuilder.#globalTagFields(text, [
                'PCBParameter',
                'DrawingDocumentParameterData'
            ])
                .map((fields) => [
                    fields.Name || fields.ParameterName || '',
                    fields.Value || ''
                ])
                .filter(([name]) => name)
        )
        const boardAssemblyViews =
            DraftsmanBoardViewMetadataBuilder.#globalTagFields(text, [
                'BoardAssemblyView',
                'BoardAssemblyInformation'
            ]).map((fields) =>
                DraftsmanBoardViewMetadataBuilder.#boardAssemblyView(fields)
            )
        const boardFabricationViews =
            DraftsmanBoardViewMetadataBuilder.#globalTagFields(text, [
                'BoardFabricationView',
                'BoardFabricationInformation'
            ]).map((fields) =>
                DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                    id: fields.Id || fields.ID,
                    pageId: fields.PageId,
                    sourceDocumentName:
                        fields.SourceDocumentName || fields.SourceDocument,
                    drillTableId: fields.DrillTableId,
                    fields
                })
            )
        const boardProjections =
            DraftsmanBoardViewMetadataBuilder.#globalTagFields(text, [
                'BoardProjection',
                'BoardProjectionInformation'
            ]).map((fields) =>
                DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                    id: fields.Id || fields.ID,
                    source: fields.Source,
                    width: DraftsmanBoardViewMetadataBuilder.#number(
                        fields.Width
                    ),
                    height: DraftsmanBoardViewMetadataBuilder.#number(
                        fields.Height
                    ),
                    scale: DraftsmanBoardViewMetadataBuilder.#number(
                        fields.Scale
                    ),
                    fields
                })
            )
        const generatedGeometry =
            DraftsmanBoardViewMetadataBuilder.#generatedGeometry(text, pages)
        const cacheLayers = DraftsmanBoardViewMetadataBuilder.#cacheLayers(text)
        const displayLayers =
            DraftsmanBoardViewMetadataBuilder.#displayLayers(text)
        const cachePrimitives =
            DraftsmanBoardViewMetadataBuilder.#cachePrimitives(text, pages)
        const highlightGroups =
            DraftsmanBoardViewMetadataBuilder.#highlightGroups(text)
        const layerTiles = DraftsmanBoardViewMetadataBuilder.#layerTiles(
            text,
            pages
        )
        const diagnostics = DraftsmanBoardViewMetadataBuilder.#diagnostics({
            cacheLayers,
            displayLayers,
            cachePrimitives,
            highlightGroups,
            layerTiles
        })
        const summary = {
            layerColorCount: layerColors.length,
            pcbParameterCount: Object.keys(pcbParameters).length,
            boardAssemblyViewCount: boardAssemblyViews.length,
            boardFabricationViewCount: boardFabricationViews.length,
            boardProjectionCount: boardProjections.length,
            generatedGeometryCount: generatedGeometry.length,
            cacheLayerCount: cacheLayers.length,
            displayLayerCount: displayLayers.length,
            cachePrimitiveCount: cachePrimitives.length,
            highlightGroupCount: highlightGroups.length,
            layerTileCount: layerTiles.length,
            selectedRoutePrimitiveCount: cachePrimitives.filter(
                (primitive) => primitive.highlightState === 'selected'
            ).length,
            drillPrimitiveCount: cachePrimitives.filter((primitive) =>
                DraftsmanBoardViewMetadataBuilder.#isDrillPrimitive(primitive)
            ).length,
            diagnosticCount: diagnostics.length
        }

        if (!Object.values(summary).some((value) => value > 0)) {
            return undefined
        }

        return {
            schema: DraftsmanBoardViewMetadataBuilder.SCHEMA_ID,
            summary,
            layerColors,
            pcbParameters,
            boardAssemblyViews,
            boardFabricationViews,
            boardProjections,
            generatedGeometry,
            cacheLayers,
            displayLayers,
            cachePrimitives,
            highlightGroups,
            layerTiles,
            diagnostics
        }
    }

    /**
     * Normalizes one board assembly view row.
     * @param {Record<string, string>} fields Native fields.
     * @returns {object}
     */
    static #boardAssemblyView(fields) {
        return DraftsmanBoardViewMetadataBuilder.#stripEmpty({
            id: fields.Id || fields.ID,
            pageId: fields.PageId,
            sourceDocumentName:
                fields.SourceDocumentName || fields.SourceDocument,
            variantName: fields.VariantName || fields.AssemblyVariant,
            layerSet: DraftsmanBoardViewMetadataBuilder.#list(fields.LayerSet),
            fields
        })
    }

    /**
     * Extracts generated board-view geometry descriptors from pages.
     * @param {string} text Decoded text.
     * @param {object[]} pages Parsed pages.
     * @returns {object[]}
     */
    static #generatedGeometry(text, pages) {
        return DraftsmanBoardViewMetadataBuilder.#pageBlocks(text).flatMap(
            (pageBlock) =>
                DraftsmanBoardViewMetadataBuilder.#tagFields(pageBlock.body, [
                    'BoardView',
                    'BoardAssemblyView',
                    'BoardFabricationView'
                ]).map((fields) =>
                    DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                        pageIndex:
                            pages.find((page) => page.id === pageBlock.id)
                                ?.index ?? pageBlock.index,
                        pageId: pageBlock.id,
                        id: fields.Id || fields.ID,
                        name: fields.Name || fields.Title,
                        geometrySource: fields.GeometrySource,
                        primitiveCount:
                            DraftsmanBoardViewMetadataBuilder.#integer(
                                fields.PrimitiveCount
                            ),
                        fields
                    })
                )
        )
    }

    /**
     * Extracts cached PCB layer descriptors.
     * @param {string} text Decoded text.
     * @returns {object[]}
     */
    static #cacheLayers(text) {
        return DraftsmanBoardViewMetadataBuilder.#globalTagFields(text, [
            'BoardCacheLayer',
            'PcbCacheLayer',
            'PcbCachedLayer'
        ]).map((fields) => {
            const layerId = DraftsmanBoardViewMetadataBuilder.#integer(
                fields.LayerId || fields.LayerID
            )

            return DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                id: fields.Id || fields.ID,
                layerId,
                layerKey: DraftsmanBoardViewMetadataBuilder.#layerKey(layerId),
                layerName:
                    fields.LayerName || fields.DisplayName || fields.Name,
                role: fields.Role || fields.LayerRole,
                color: fields.Color,
                primitiveCount: DraftsmanBoardViewMetadataBuilder.#integer(
                    fields.PrimitiveCount
                ),
                fields
            })
        })
    }

    /**
     * Extracts drawing display-layer descriptors.
     * @param {string} text Decoded text.
     * @returns {object[]}
     */
    static #displayLayers(text) {
        return DraftsmanBoardViewMetadataBuilder.#globalTagFields(text, [
            'BoardDisplayLayer',
            'PcbDisplayLayer',
            'PcbViewLayer'
        ]).map((fields) =>
            DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                id: fields.Id || fields.ID,
                cacheLayerId: fields.CacheLayerId || fields.CacheLayerID,
                role: fields.Role || fields.LayerRole,
                color: fields.Color,
                visible: DraftsmanBoardViewMetadataBuilder.#boolean(
                    fields.Visible
                ),
                fields
            })
        )
    }

    /**
     * Extracts cached PCB primitive descriptors from page-local board views.
     * @param {string} text Decoded text.
     * @param {object[]} pages Parsed pages.
     * @returns {object[]}
     */
    static #cachePrimitives(text, pages) {
        return DraftsmanBoardViewMetadataBuilder.#pageBlocks(text).flatMap(
            (pageBlock) =>
                DraftsmanBoardViewMetadataBuilder.#tagFields(pageBlock.body, [
                    'BoardCachePrimitive',
                    'PcbCachePrimitive',
                    'CachedPrimitive'
                ]).map((fields) => {
                    const layerId = DraftsmanBoardViewMetadataBuilder.#integer(
                        fields.LayerId || fields.LayerID
                    )

                    return DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                        pageIndex:
                            pages.find((page) => page.id === pageBlock.id)
                                ?.index ?? pageBlock.index,
                        pageId: pageBlock.id,
                        id: fields.Id || fields.ID,
                        cacheLayerId:
                            fields.CacheLayerId || fields.CacheLayerID,
                        primitiveKind: fields.PrimitiveKind || fields.Kind,
                        layerId,
                        layerKey:
                            DraftsmanBoardViewMetadataBuilder.#layerKey(
                                layerId
                            ),
                        net: fields.Net || fields.NetName,
                        netClass: fields.NetClass,
                        component: fields.Component || fields.Designator,
                        padNumber: fields.PadNumber || fields.PinNumber,
                        routeGroup: fields.RouteGroup || fields.RouteId,
                        highlightState:
                            fields.HighlightState || fields.SelectionState,
                        holeKind: fields.HoleKind,
                        holePlating: fields.HolePlating,
                        holeRender: fields.HoleRender,
                        fields
                    })
                })
        )
    }

    /**
     * Extracts route/net-class highlight groups used by cached board views.
     * @param {string} text Decoded text.
     * @returns {object[]}
     */
    static #highlightGroups(text) {
        return DraftsmanBoardViewMetadataBuilder.#globalTagFields(text, [
            'BoardHighlightGroup',
            'PcbHighlightGroup',
            'BoardRouteHighlight'
        ]).map((fields) =>
            DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                id: fields.Id || fields.ID,
                name: fields.Name || fields.Title,
                selectorKind: fields.SelectorKind || fields.Kind,
                netClasses: DraftsmanBoardViewMetadataBuilder.#list(
                    fields.NetClasses || fields.NetClass
                ),
                differentialPairClasses:
                    DraftsmanBoardViewMetadataBuilder.#list(
                        fields.DifferentialPairClasses ||
                            fields.DifferentialPairClass
                    ),
                differentialPairs: DraftsmanBoardViewMetadataBuilder.#list(
                    fields.DifferentialPairs || fields.DifferentialPair
                ),
                nets: DraftsmanBoardViewMetadataBuilder.#list(
                    fields.Nets || fields.NetNames || fields.Net
                ),
                highlightColor: fields.HighlightColor || fields.Color,
                contextColor: fields.ContextColor,
                minimumRoutedLength:
                    fields.MinimumRoutedLength || fields.RoutedLengthMinimum,
                connectedRouteOnly: DraftsmanBoardViewMetadataBuilder.#boolean(
                    fields.ConnectedRouteOnly
                ),
                targetFillRatio: DraftsmanBoardViewMetadataBuilder.#number(
                    fields.TargetFillRatio
                ),
                tileSpacing: DraftsmanBoardViewMetadataBuilder.#number(
                    fields.TileSpacing
                ),
                layerSet: DraftsmanBoardViewMetadataBuilder.#list(
                    fields.LayerSet || fields.LayerIds
                ),
                fields
            })
        )
    }

    /**
     * Extracts page-local board layer tile descriptors.
     * @param {string} text Decoded text.
     * @param {object[]} pages Parsed pages.
     * @returns {object[]}
     */
    static #layerTiles(text, pages) {
        return DraftsmanBoardViewMetadataBuilder.#pageBlocks(text).flatMap(
            (pageBlock) =>
                DraftsmanBoardViewMetadataBuilder.#tagFields(pageBlock.body, [
                    'BoardLayerTile',
                    'PcbLayerTile',
                    'BoardRouteTile'
                ]).map((fields) => {
                    const layerId = DraftsmanBoardViewMetadataBuilder.#integer(
                        fields.LayerId || fields.LayerID
                    )

                    return DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                        pageIndex:
                            pages.find((page) => page.id === pageBlock.id)
                                ?.index ?? pageBlock.index,
                        pageId: pageBlock.id,
                        id: fields.Id || fields.ID,
                        highlightGroupId:
                            fields.HighlightGroupId || fields.HighlightGroupID,
                        layerId,
                        layerKey:
                            DraftsmanBoardViewMetadataBuilder.#layerKey(
                                layerId
                            ),
                        layerName:
                            fields.LayerName ||
                            fields.DisplayName ||
                            fields.Name,
                        row: DraftsmanBoardViewMetadataBuilder.#integer(
                            fields.Row
                        ),
                        column: DraftsmanBoardViewMetadataBuilder.#integer(
                            fields.Column
                        ),
                        x: DraftsmanBoardViewMetadataBuilder.#number(fields.X),
                        y: DraftsmanBoardViewMetadataBuilder.#number(fields.Y),
                        width: DraftsmanBoardViewMetadataBuilder.#number(
                            fields.Width
                        ),
                        height: DraftsmanBoardViewMetadataBuilder.#number(
                            fields.Height
                        ),
                        scale: DraftsmanBoardViewMetadataBuilder.#number(
                            fields.Scale
                        ),
                        fields
                    })
                })
        )
    }

    /**
     * Builds preservation diagnostics for unresolved cache references.
     * @param {{ cacheLayers: object[], displayLayers: object[], cachePrimitives: object[], highlightGroups: object[], layerTiles: object[] }} input Parsed cache sections.
     * @returns {object[]}
     */
    static #diagnostics(input) {
        const diagnostics = []
        const cacheLayerIds = new Set(
            input.cacheLayers.map((layer) => layer.id).filter(Boolean)
        )
        const highlightGroupIds = new Set(
            input.highlightGroups.map((group) => group.id).filter(Boolean)
        )

        for (const displayLayer of input.displayLayers) {
            if (
                !displayLayer.cacheLayerId ||
                cacheLayerIds.has(displayLayer.cacheLayerId)
            ) {
                continue
            }

            diagnostics.push({
                code: 'draftsman.board-view-cache.unresolved-display-layer-cache',
                severity: 'warning',
                message:
                    'Display-layer metadata references an unknown cached PCB layer.',
                displayLayerId: displayLayer.id,
                cacheLayerId: displayLayer.cacheLayerId
            })
        }

        for (const primitive of input.cachePrimitives) {
            if (
                !primitive.cacheLayerId ||
                cacheLayerIds.has(primitive.cacheLayerId)
            ) {
                continue
            }

            diagnostics.push({
                code: 'draftsman.board-view-cache.unresolved-primitive-cache',
                severity: 'warning',
                message:
                    'Cached primitive metadata references an unknown cached PCB layer.',
                primitiveId: primitive.id,
                cacheLayerId: primitive.cacheLayerId
            })
        }

        for (const tile of input.layerTiles) {
            if (
                !tile.highlightGroupId ||
                highlightGroupIds.has(tile.highlightGroupId)
            ) {
                continue
            }

            diagnostics.push({
                code: 'draftsman.board-view-cache.unresolved-layer-tile-highlight-group',
                severity: 'warning',
                message:
                    'Layer tile metadata references an unknown highlight group.',
                layerTileId: tile.id,
                highlightGroupId: tile.highlightGroupId
            })
        }

        return diagnostics
    }

    /**
     * Extracts page ids and raw bodies for sidecar scans.
     * @param {string} text Decoded text.
     * @returns {{ index: number, id: string, body: string }[]}
     */
    static #pageBlocks(text) {
        const blocks = []
        const pagePattern =
            /<Page\b([^>]*)>([\s\S]*?)<\/Page>|<Page\b([^>]*)\/>/giu
        let match = pagePattern.exec(text || '')
        while (match) {
            const fields = DraftsmanBoardViewMetadataBuilder.#attributes(
                match[1] || match[3] || ''
            )
            blocks.push({
                index: blocks.length,
                id: fields.Id || fields.ID || '',
                body: match[2] || ''
            })
            match = pagePattern.exec(text || '')
        }
        return blocks
    }

    /**
     * Extracts tag fields from a full container while ignoring page-contained
     * copies of the same tags.
     * @param {string} text Container text.
     * @param {string[]} tagNames Tag names.
     * @returns {Record<string, string>[]}
     */
    static #globalTagFields(text, tagNames) {
        const stripped = String(text || '').replace(
            /<Page\b[^>]*>[\s\S]*?<\/Page>|<Page\b[^>]*\/>/giu,
            ''
        )
        return DraftsmanBoardViewMetadataBuilder.#tagFields(stripped, tagNames)
    }

    /**
     * Extracts attributes from matching XML-like tags.
     * @param {string} body Text body.
     * @param {string[]} tagNames Tag names.
     * @returns {Record<string, string>[]}
     */
    static #tagFields(body, tagNames) {
        const tags = tagNames
            .map((tagName) => tagName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
            .join('|')
        const pattern = new RegExp(
            '<\\s*(' +
                tags +
                ')\\b([^>]*)>([\\s\\S]*?)<\\/\\s*\\1\\s*>|<\\s*(' +
                tags +
                ')\\b([^>]*)\\/>',
            'giu'
        )
        const rows = []
        let match = pattern.exec(body || '')
        while (match) {
            const attributes = DraftsmanBoardViewMetadataBuilder.#attributes(
                match[2] || match[5] || ''
            )
            const text = String(match[3] || '').trim()
            rows.push(
                DraftsmanBoardViewMetadataBuilder.#stripEmpty({
                    ...attributes,
                    value: attributes.Value || text || undefined
                })
            )
            match = pattern.exec(body || '')
        }
        return rows
    }

    /**
     * Parses XML-like attributes.
     * @param {string} text Raw attribute text.
     * @returns {Record<string, string>}
     */
    static #attributes(text) {
        const fields = {}
        const pattern = /([A-Za-z0-9_.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/gu
        let match = pattern.exec(text || '')
        while (match) {
            fields[match[1]] = match[3] ?? match[4] ?? ''
            match = pattern.exec(text || '')
        }
        return fields
    }

    /**
     * Parses a numeric value.
     * @param {string | undefined} value Raw value.
     * @returns {number | undefined}
     */
    static #number(value) {
        const parsed = Number.parseFloat(String(value || '').trim())
        return Number.isFinite(parsed) ? parsed : undefined
    }

    /**
     * Parses an integer value.
     * @param {string | undefined} value Raw value.
     * @returns {number | undefined}
     */
    static #integer(value) {
        const parsed = Number.parseInt(String(value || '').trim(), 10)
        return Number.isFinite(parsed) ? parsed : undefined
    }

    /**
     * Parses an optional boolean value.
     * @param {string | undefined} value Raw value.
     * @returns {boolean | undefined}
     */
    static #boolean(value) {
        const normalized = String(value ?? '')
            .trim()
            .toLowerCase()
        if (!normalized) return undefined
        return ['true', 't', '1', 'yes'].includes(normalized)
    }

    /**
     * Splits a comma/semicolon list.
     * @param {string | undefined} value Raw list value.
     * @returns {string[] | undefined}
     */
    static #list(value) {
        const items = String(value || '')
            .split(/[;,]/u)
            .map((item) => item.trim())
            .filter(Boolean)
        return items.length ? items : undefined
    }

    /**
     * Builds a stable layer key.
     * @param {number | undefined} layerId Numeric layer id.
     * @returns {string | undefined}
     */
    static #layerKey(layerId) {
        return Number.isFinite(layerId) ? 'L' + layerId : undefined
    }

    /**
     * Returns true when a cached primitive should be counted as drill-related.
     * @param {object} primitive Cached primitive.
     * @returns {boolean}
     */
    static #isDrillPrimitive(primitive) {
        return (
            Boolean(primitive.holeKind) ||
            /(?:drill|hole|via)/iu.test(String(primitive.primitiveKind || ''))
        )
    }

    /**
     * Removes empty values from an object.
     * @param {Record<string, unknown>} object Raw object.
     * @returns {object}
     */
    static #stripEmpty(object) {
        return Object.fromEntries(
            Object.entries(object).filter(
                ([, value]) =>
                    value !== undefined &&
                    value !== '' &&
                    (!Array.isArray(value) || value.length > 0)
            )
        )
    }
}
