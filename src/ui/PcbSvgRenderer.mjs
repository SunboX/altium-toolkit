// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbArcUtils } from './PcbArcUtils.mjs'
import { PcbDimensionPrimitiveRenderer } from './PcbDimensionPrimitiveRenderer.mjs'
import { PcbEdgeFacingGlyphNormalizer } from './PcbEdgeFacingGlyphNormalizer.mjs'
import { PcbEmbeddedFontFaceRenderer } from './PcbEmbeddedFontFaceRenderer.mjs'
import { PcbFootprintPrimitiveSelector } from './PcbFootprintPrimitiveSelector.mjs'
import { PcbCopperPrimitiveSplitter } from './PcbCopperPrimitiveSplitter.mjs'
import { PcbLayerIdCodec } from '../core/altium/PcbLayerIdCodec.mjs'
import { PcbLayerGroups } from '../core/altium/PcbLayerGroups.mjs'
import { PcbNativeTextKnockoutDetector } from './PcbNativeTextKnockoutDetector.mjs'
import { PcbPadMaskApertureRenderer } from './PcbPadMaskApertureRenderer.mjs'
import { PcbRegionPrimitiveRenderer } from './PcbRegionPrimitiveRenderer.mjs'
import { PcbScene3dBoardOutlineRefiner } from './PcbScene3dBoardOutlineRefiner.mjs'
import { PcbTextPrimitiveRenderer } from './PcbTextPrimitiveRenderer.mjs'
import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { TextGeometrySidecarBuilder } from './TextGeometrySidecarBuilder.mjs'
/**
 * Renders normalized PCB models into HTML and SVG markup.
 */
export class PcbSvgRenderer {
    static #PAD_SHAPE_RECTANGULAR = 2
    static #PAD_HOLE_SHAPE_SLOT = 2
    static #GENERIC_DETAIL_SEARCH_HALF_EXTENT = 240
    static #SEMANTIC_SCHEMA = 'altium-toolkit.pcb.svg.semantics.a1'
    /**
     * Renders a normalized PCB model into HTML and SVG markup.
     * @param {{ summary: { title?: string }, pcb?: { boardOutline: { segments: Array<Record<string, number | string>>, minX: number, minY: number, widthMil: number, heightMil: number }, layers: { name: string }[], primitiveLayers?: { layerId: number, name: string }[], polygons?: { layer?: string, segments: Array<Record<string, number | string>> }[], fills?: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks?: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs?: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[], vias?: { x: number, y: number, diameter: number, holeDiameter: number }[], pads?: { x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number, shapeTop?: number, shapeMid?: number, shapeBottom?: number, rotation?: number, isPlated?: boolean }[], texts?: { text: string, x: number, y: number, height?: number, rotation?: number, layerId?: number, visible?: boolean }[], components: { designator: string, x: number, y: number, rotation: number, layer: string, pattern: string }[] } }} documentModel
     * @param {{ viewKind?: string, layerView?: object } | undefined} options Render options.
     * @returns {string}
     */
    static render(documentModel, options = {}) {
        const sourcePcb = documentModel?.pcb
        if (!sourcePcb) {
            return '<section class="altium-renderer-empty">No PCB entities were recovered from this file.</section>'
        }
        const viewOptions = PcbSvgRenderer.#normalizeViewOptions(options)
        const pcb = viewOptions.layerView
            ? PcbSvgRenderer.#filterPcbForLayer(
                  sourcePcb,
                  viewOptions.layerView
              )
            : sourcePcb
        const outline = PcbScene3dBoardOutlineRefiner.refine(
            { board: pcb.boardOutline },
            documentModel
        ).board
        const polygons = pcb.polygons || []
        const fills = pcb.fills || []
        const tracks = pcb.tracks || []
        const arcs = pcb.arcs || []
        const regions = pcb.regions || []
        const shapeBasedRegions = pcb.shapeBasedRegions || []
        const renderedRegions = shapeBasedRegions.length
            ? shapeBasedRegions
            : regions
        const vias = pcb.vias || []
        const pads = pcb.pads || []
        const dimensions = pcb.dimensions || []
        const components = pcb.components.slice(0, 260)
        const stackLayers = Array.isArray(pcb.layers) ? pcb.layers : []
        const primitiveLayers = pcb.primitiveLayers || []
        const displayLayers = viewOptions.layerView
            ? [viewOptions.layerView]
            : stackLayers.length
              ? stackLayers
              : primitiveLayers
        const semanticContext = PcbSvgRenderer.#buildSemanticContext(
            pcb,
            displayLayers,
            viewOptions
        )
        const semanticMetadata = PcbSvgRenderer.#buildSemanticMetadata(
            pcb,
            semanticContext
        )
        const copperGroups = PcbCopperPrimitiveSplitter.split(
            polygons,
            fills,
            tracks,
            arcs,
            renderedRegions
        )
        const selectedFootprintPrimitives =
            PcbFootprintPrimitiveSelector.select(
                primitiveLayers,
                fills,
                tracks,
                arcs,
                renderedRegions,
                'top'
            )
        const footprintPrimitives = PcbEdgeFacingGlyphNormalizer.normalize(
            selectedFootprintPrimitives,
            outline
        )
        const detailPrimitives = PcbSvgRenderer.#detailPrimitiveCollections(
            {
                fills,
                tracks,
                arcs,
                regions: renderedRegions
            },
            PcbSvgRenderer.#primitiveIdentitySet(selectedFootprintPrimitives),
            semanticContext
        )
        const texts = PcbTextPrimitiveRenderer.select(
            primitiveLayers,
            pcb.texts || [],
            'top',
            {
                nativeTextKnockouts:
                    PcbNativeTextKnockoutDetector.hasNativeTextKnockouts(
                        footprintPrimitives,
                        outline
                    )
            }
        )
        const path = PcbSvgRenderer.#buildBoardPath(outline.segments)
        const clipPathId = 'pcb-board-clip'
        const viewBox = PcbSvgRenderer.#buildViewBox(
            outline,
            components,
            [
                ...copperGroups.surface.polygons,
                ...copperGroups.subsurface.polygons
            ],
            [
                ...copperGroups.surface.fills,
                ...copperGroups.subsurface.fills,
                ...footprintPrimitives.fills,
                ...detailPrimitives.fills
            ],
            [
                ...copperGroups.surface.tracks,
                ...copperGroups.subsurface.tracks,
                ...footprintPrimitives.tracks,
                ...detailPrimitives.tracks
            ],
            [
                ...copperGroups.surface.arcs,
                ...copperGroups.subsurface.arcs,
                ...footprintPrimitives.arcs,
                ...detailPrimitives.arcs
            ],
            [
                ...copperGroups.surface.regions,
                ...copperGroups.subsurface.regions,
                ...footprintPrimitives.regions,
                ...detailPrimitives.regions
            ],
            vias,
            pads,
            dimensions
        )
        const layerMarkup = displayLayers
            .slice(0, 10)
            .map(
                (layer) =>
                    '<li>' + SchematicSvgUtils.escapeHtml(layer.name) + '</li>'
            )
            .join('')
        const polygonMarkup = (polygonList, visibilityClass) =>
            polygonList
                .map(
                    (polygon, index) =>
                        '<path class="pcb-polygon pcb-polygon--' +
                        visibilityClass +
                        '" d="' +
                        SchematicSvgUtils.escapeHtml(
                            PcbSvgRenderer.#buildBoardPath(polygon.segments)
                        ) +
                        '"' +
                        PcbSvgRenderer.#semanticAttributes(
                            'polygon',
                            polygon,
                            PcbSvgRenderer.#primitiveIndex(
                                semanticContext,
                                'polygons',
                                polygon,
                                index
                            ),
                            semanticContext
                        ) +
                        ' />'
                )
                .join('')
        const fillMarkup = (fillList, visibilityClass) =>
            fillList
                .map((fill, index) => {
                    const x = Math.min(fill.x1, fill.x2)
                    const y = Math.min(fill.y1, fill.y2)
                    const width = Math.abs(fill.x2 - fill.x1)
                    const height = Math.abs(fill.y2 - fill.y1)

                    return (
                        '<rect class="pcb-fill pcb-fill--' +
                        visibilityClass +
                        '" x="' +
                        SchematicSvgUtils.formatNumber(x) +
                        '" y="' +
                        SchematicSvgUtils.formatNumber(y) +
                        '" width="' +
                        SchematicSvgUtils.formatNumber(width) +
                        '" height="' +
                        SchematicSvgUtils.formatNumber(height) +
                        '" rx="' +
                        SchematicSvgUtils.formatNumber(
                            Math.min(width, height) / 6
                        ) +
                        '"' +
                        PcbSvgRenderer.#semanticAttributes(
                            'fill',
                            fill,
                            PcbSvgRenderer.#primitiveIndex(
                                semanticContext,
                                'fills',
                                fill,
                                index
                            ),
                            semanticContext
                        ) +
                        ' />'
                    )
                })
                .join('')
        const trackMarkup = (trackList, visibilityClass) =>
            trackList
                .map(
                    (track, index) =>
                        '<line class="pcb-track pcb-track--' +
                        visibilityClass +
                        '" x1="' +
                        SchematicSvgUtils.formatNumber(track.x1) +
                        '" y1="' +
                        SchematicSvgUtils.formatNumber(track.y1) +
                        '" x2="' +
                        SchematicSvgUtils.formatNumber(track.x2) +
                        '" y2="' +
                        SchematicSvgUtils.formatNumber(track.y2) +
                        '" stroke-width="' +
                        SchematicSvgUtils.formatNumber(
                            Math.max(track.width || 0, 1)
                        ) +
                        '"' +
                        PcbSvgRenderer.#semanticAttributes(
                            'track',
                            track,
                            PcbSvgRenderer.#primitiveIndex(
                                semanticContext,
                                'tracks',
                                track,
                                index
                            ),
                            semanticContext
                        ) +
                        ' />'
                )
                .join('')
        const arcMarkup = (arcList, visibilityClass) =>
            arcList
                .map((arc, index) =>
                    PcbSvgRenderer.#appendSvgAttributes(
                        PcbArcUtils.buildMarkup(
                            arc,
                            'pcb-arc pcb-arc--' + visibilityClass
                        ),
                        PcbSvgRenderer.#semanticAttributes(
                            'arc',
                            arc,
                            PcbSvgRenderer.#primitiveIndex(
                                semanticContext,
                                'arcs',
                                arc,
                                index
                            ),
                            semanticContext
                        )
                    )
                )
                .join('')
        const regionMarkup = (regionList, visibilityClass) =>
            regionList
                .map((region, index) =>
                    PcbSvgRenderer.#appendSvgAttributes(
                        PcbRegionPrimitiveRenderer.buildMarkup(
                            [region],
                            'pcb-region pcb-region--' + visibilityClass
                        ),
                        PcbSvgRenderer.#semanticAttributes(
                            'region',
                            region,
                            PcbSvgRenderer.#primitiveIndex(
                                semanticContext,
                                'regions',
                                region,
                                index
                            ),
                            semanticContext
                        )
                    )
                )
                .join('')
        const viaMarkup = vias
            .map((via, index) => {
                const ringRadius = Math.max((via.diameter || 0) / 2, 1)
                const holeRadius = Math.max((via.holeDiameter || 0) / 2, 0.6)
                const viaIndex = PcbSvgRenderer.#primitiveIndex(
                    semanticContext,
                    'vias',
                    via,
                    index
                )
                return (
                    '<g class="pcb-via"' +
                    PcbSvgRenderer.#semanticAttributes(
                        'via',
                        via,
                        viaIndex,
                        semanticContext
                    ) +
                    '>' +
                    '<circle class="pcb-via__pad" cx="' +
                    SchematicSvgUtils.formatNumber(via.x) +
                    '" cy="' +
                    SchematicSvgUtils.formatNumber(via.y) +
                    '" r="' +
                    SchematicSvgUtils.formatNumber(ringRadius) +
                    '" />' +
                    '<circle class="pcb-via__hole" cx="' +
                    SchematicSvgUtils.formatNumber(via.x) +
                    '" cy="' +
                    SchematicSvgUtils.formatNumber(via.y) +
                    '" r="' +
                    SchematicSvgUtils.formatNumber(holeRadius) +
                    '"' +
                    PcbSvgRenderer.#renderDataAttributes({
                        'data-primitive': 'via-hole',
                        'data-element-key': 'pcb-via-hole-' + viaIndex,
                        'data-hole-owner': 'via',
                        'data-hole-kind': 'via',
                        'data-plating': PcbSvgRenderer.#drillPlating(via),
                        'data-drill-render-state':
                            PcbSvgRenderer.#drillRenderState(via)
                    }) +
                    ' />' +
                    '</g>'
                )
            })
            .join('')
        const padMarkup = pads
            .map((pad, index) =>
                PcbSvgRenderer.#renderPad(
                    pad,
                    PcbSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'pads',
                        pad,
                        index
                    ),
                    semanticContext
                )
            )
            .join('')
        const padMaskApertureMarkup = PcbPadMaskApertureRenderer.render(pads, {
            padIndex: (pad, index) =>
                PcbSvgRenderer.#primitiveIndex(
                    semanticContext,
                    'pads',
                    pad,
                    index
                ),
            attributes: (aperture) =>
                PcbSvgRenderer.#padMaskApertureAttributes(
                    aperture,
                    semanticContext
                )
        })
        const detailMarkup = PcbSvgRenderer.#renderDetailPrimitives(
            detailPrimitives,
            semanticContext
        )
        const footprintFillMarkup = footprintPrimitives.fills
            .map((fill, index) => {
                const x = Math.min(fill.x1, fill.x2)
                const y = Math.min(fill.y1, fill.y2)
                const width = Math.abs(fill.x2 - fill.x1)
                const height = Math.abs(fill.y2 - fill.y1)
                return (
                    '<rect class="pcb-footprint-fill" x="' +
                    SchematicSvgUtils.formatNumber(x) +
                    '" y="' +
                    SchematicSvgUtils.formatNumber(y) +
                    '" width="' +
                    SchematicSvgUtils.formatNumber(width) +
                    '" height="' +
                    SchematicSvgUtils.formatNumber(height) +
                    '" rx="' +
                    SchematicSvgUtils.formatNumber(
                        Math.min(width, height) / 6
                    ) +
                    '"' +
                    PcbSvgRenderer.#semanticAttributes(
                        'fill',
                        fill,
                        PcbSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'fills',
                            fill,
                            index
                        ),
                        semanticContext
                    ) +
                    ' />'
                )
            })
            .join('')
        const footprintTrackMarkup = footprintPrimitives.tracks
            .map(
                (track, index) =>
                    '<line class="pcb-footprint-track" x1="' +
                    SchematicSvgUtils.formatNumber(track.x1) +
                    '" y1="' +
                    SchematicSvgUtils.formatNumber(track.y1) +
                    '" x2="' +
                    SchematicSvgUtils.formatNumber(track.x2) +
                    '" y2="' +
                    SchematicSvgUtils.formatNumber(track.y2) +
                    '" stroke-width="' +
                    SchematicSvgUtils.formatNumber(
                        Math.max(track.width || 0, 1)
                    ) +
                    '"' +
                    PcbSvgRenderer.#semanticAttributes(
                        'track',
                        track,
                        PcbSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'tracks',
                            track,
                            index
                        ),
                        semanticContext
                    ) +
                    ' />'
            )
            .join('')
        const footprintArcMarkup = footprintPrimitives.arcs
            .map((arc, index) =>
                PcbSvgRenderer.#appendSvgAttributes(
                    PcbArcUtils.buildMarkup(arc, 'pcb-footprint-arc'),
                    PcbSvgRenderer.#semanticAttributes(
                        'arc',
                        arc,
                        PcbSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'arcs',
                            arc,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const footprintRegionMarkup = footprintPrimitives.regions
            .map((region, index) =>
                PcbSvgRenderer.#appendSvgAttributes(
                    PcbRegionPrimitiveRenderer.buildMarkup(
                        [region],
                        'pcb-footprint-region'
                    ),
                    PcbSvgRenderer.#semanticAttributes(
                        'region',
                        region,
                        PcbSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'regions',
                            region,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const textMarkup = PcbTextPrimitiveRenderer.render(texts, {
            semanticContext
        })
        const dimensionMarkup = PcbDimensionPrimitiveRenderer.buildMarkup(
            dimensions,
            {
                attributes: (dimension, index) =>
                    PcbSvgRenderer.#dimensionAttributes(
                        dimension,
                        PcbSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'dimensions',
                            dimension,
                            index
                        ),
                        semanticContext
                    )
            }
        )
        const textGeometryMarkup = viewOptions.includeTextGeometrySidecar
            ? PcbSvgRenderer.#buildTextGeometryMetadataMarkup(
                  texts,
                  semanticContext
              )
            : ''
        const textGroupTransform = PcbSvgRenderer.#renderTextGroupTransform(
            pcb.textGroupTransform
        )
        const fontFaceMarkup = PcbEmbeddedFontFaceRenderer.buildMarkup(
            pcb.embeddedFonts || []
        )

        const componentMarkup = components
            .map((component, index) => {
                const bodyGeometry = PcbSvgRenderer.#footprintSize(
                    component.pattern
                )
                const bodyMarkup = PcbSvgRenderer.#hasAuthoredFootprintDetail(
                    component,
                    footprintPrimitives,
                    pads
                )
                    ? ''
                    : '<rect class="pcb-component__body" x="' +
                      SchematicSvgUtils.formatNumber(-bodyGeometry.width / 2) +
                      '" y="' +
                      SchematicSvgUtils.formatNumber(-bodyGeometry.height / 2) +
                      '" width="' +
                      SchematicSvgUtils.formatNumber(bodyGeometry.width) +
                      '" height="' +
                      SchematicSvgUtils.formatNumber(bodyGeometry.height) +
                      '" rx="' +
                      SchematicSvgUtils.formatNumber(
                          Math.max(bodyGeometry.height / 5, 4)
                      ) +
                      '" />'
                return (
                    '<g class="pcb-component pcb-component--' +
                    SchematicSvgUtils.escapeHtml(
                        component.layer.toLowerCase()
                    ) +
                    '" transform="translate(' +
                    SchematicSvgUtils.formatNumber(component.x) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(component.y) +
                    ') rotate(' +
                    SchematicSvgUtils.formatNumber(component.rotation) +
                    ')"' +
                    PcbSvgRenderer.#semanticAttributes(
                        'component',
                        component,
                        PcbSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'components',
                            component,
                            index
                        ),
                        semanticContext
                    ) +
                    '>' +
                    bodyMarkup +
                    '</g>'
                )
            })
            .join('')
        return (
            '<section class="svg-panel">' +
            '<header class="svg-panel__header"><h3>' +
            SchematicSvgUtils.escapeHtml(
                documentModel?.summary?.title || 'PCB'
            ) +
            '</h3><p>' +
            components.length +
            ' placements, ' +
            displayLayers.length +
            ' layers</p></header>' +
            '<div class="pcb-layout">' +
            '<aside class="pcb-legend"><h4>Board stack</h4><p>Top-facing composite view</p><ul>' +
            layerMarkup +
            '</ul></aside>' +
            '<svg class="pcb-svg"' +
            PcbSvgRenderer.#renderRootViewBoxAttributes(viewOptions, viewBox) +
            ' preserveAspectRatio="xMidYMid meet" aria-label="PCB view" data-semantic-schema="' +
            PcbSvgRenderer.#SEMANTIC_SCHEMA +
            '"' +
            PcbSvgRenderer.#renderDataAttributes({
                'data-doc-id': viewOptions.documentId,
                'data-doc-ver': viewOptions.documentVersion,
                'data-view-kind': semanticContext.viewKind,
                'data-layer-view-key': semanticContext.layerView?.layerKey,
                'data-layer-view-display-name':
                    semanticContext.layerView?.displayName,
                'data-included-layer-ids':
                    PcbSvgRenderer.#includedLayerIds(semanticContext),
                'data-board-outline-only':
                    PcbSvgRenderer.#isBoardOutlineOnly(pcb)
            }) +
            '">' +
            '<defs>' +
            fontFaceMarkup +
            '<clipPath id="' +
            clipPathId +
            '"><path d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '" /></clipPath></defs>' +
            '<metadata id="pcb-semantic-metadata" data-schema="' +
            PcbSvgRenderer.#SEMANTIC_SCHEMA +
            '">' +
            SchematicSvgUtils.escapeHtml(JSON.stringify(semanticMetadata)) +
            '</metadata>' +
            textGeometryMarkup +
            '<path class="board-outline pcb-layer pcb-layer--edge-cuts" data-layer-name="Edge.Cuts"' +
            PcbSvgRenderer.#renderDataAttributes({
                'data-primitive': 'board-outline',
                'data-element-key': 'pcb-board-outline',
                'data-feature': 'board-outline',
                'data-layer-key': 'EDGE',
                'data-layer-display-name': 'Edge.Cuts'
            }) +
            ' d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '"' +
            ' />' +
            padMaskApertureMarkup +
            '<g class="pcb-copper-layers" clip-path="url(#' +
            clipPathId +
            ')">' +
            '<g class="pcb-copper pcb-copper--subsurface">' +
            polygonMarkup(copperGroups.subsurface.polygons, 'subsurface') +
            fillMarkup(copperGroups.subsurface.fills, 'subsurface') +
            regionMarkup(copperGroups.subsurface.regions, 'subsurface') +
            trackMarkup(copperGroups.subsurface.tracks, 'subsurface') +
            arcMarkup(copperGroups.subsurface.arcs, 'subsurface') +
            '</g>' +
            '<g class="pcb-copper pcb-copper--surface">' +
            polygonMarkup(copperGroups.surface.polygons, 'surface') +
            fillMarkup(copperGroups.surface.fills, 'surface') +
            regionMarkup(copperGroups.surface.regions, 'surface') +
            trackMarkup(copperGroups.surface.tracks, 'surface') +
            arcMarkup(copperGroups.surface.arcs, 'surface') +
            padMarkup +
            viaMarkup +
            '</g>' +
            '</g>' +
            '<g class="pcb-footprints">' +
            footprintFillMarkup +
            footprintTrackMarkup +
            footprintArcMarkup +
            footprintRegionMarkup +
            '</g>' +
            detailMarkup +
            '<g class="pcb-components">' +
            componentMarkup +
            '</g>' +
            '<g class="pcb-texts" clip-path="url(#' +
            clipPathId +
            ')"' +
            textGroupTransform +
            '>' +
            textMarkup +
            '</g>' +
            dimensionMarkup +
            '<path class="board-outline board-outline--stroke pcb-layer pcb-layer--edge-cuts" data-layer-name="Edge.Cuts"' +
            PcbSvgRenderer.#renderDataAttributes({
                'data-primitive': 'board-outline',
                'data-element-key': 'pcb-board-outline-stroke',
                'data-feature': 'board-outline',
                'data-layer-key': 'EDGE',
                'data-layer-display-name': 'Edge.Cuts'
            }) +
            ' d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '"' +
            ' />' +
            '</svg></div></section>'
        )
    }

    /**
     * Renders one deterministic SVG entry per physical or primitive layer.
     * @param {object} documentModel Normalized PCB document model.
     * @returns {{ layerId?: number, layerKey: string, displayName: string, role: string, svg: string }[]}
     */
    static renderLayerSvgs(documentModel) {
        const pcb = documentModel?.pcb
        if (!pcb) {
            return []
        }

        return PcbSvgRenderer.#displayLayerDescriptors(pcb).map(
            (layerView) => ({
                ...layerView,
                svg: PcbSvgRenderer.render(documentModel, {
                    viewKind: 'layer',
                    layerView
                })
            })
        )
    }

    /**
     * Selects non-copper layer primitives that need explicit SVG artwork.
     * @param {{ fills?: object[], tracks?: object[], arcs?: object[], regions?: object[] }} primitives Primitive collections.
     * @param {Set<object>} excludedPrimitives Primitives already rendered elsewhere.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {{ fills: object[], tracks: object[], arcs: object[], regions: object[] }}
     */
    static #detailPrimitiveCollections(
        primitives,
        excludedPrimitives,
        semanticContext
    ) {
        const includePrimitive = (primitive) =>
            !excludedPrimitives.has(primitive) &&
            PcbSvgRenderer.#isDetailPrimitive(primitive, semanticContext)

        return {
            fills: (primitives.fills || []).filter(includePrimitive),
            tracks: (primitives.tracks || []).filter(includePrimitive),
            arcs: (primitives.arcs || []).filter(includePrimitive),
            regions: (primitives.regions || []).filter(includePrimitive)
        }
    }

    /**
     * Builds an identity set for primitives rendered by a specialized path.
     * @param {{ fills?: object[], tracks?: object[], arcs?: object[], regions?: object[] }} primitiveCollections Primitive collections.
     * @returns {Set<object>}
     */
    static #primitiveIdentitySet(primitiveCollections) {
        return new Set([
            ...(primitiveCollections?.fills || []),
            ...(primitiveCollections?.tracks || []),
            ...(primitiveCollections?.arcs || []),
            ...(primitiveCollections?.regions || [])
        ])
    }

    /**
     * Returns true when a primitive should render as generic layer detail.
     * @param {object} primitive Primitive record.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {boolean}
     */
    static #isDetailPrimitive(primitive, semanticContext) {
        const layer = PcbSvgRenderer.#knownLayerForPrimitive(
            primitive,
            semanticContext
        )
        const role = PcbSvgRenderer.#layerRoleForDetail(layer)

        return Boolean(layer) && !['copper', 'multi-layer'].includes(role)
    }

    /**
     * Renders non-copper fabrication and documentation primitives.
     * @param {{ fills: object[], tracks: object[], arcs: object[], regions: object[] }} primitives Primitive collections.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #renderDetailPrimitives(primitives, semanticContext) {
        const fillMarkup = primitives.fills
            .map((fill, index) =>
                PcbSvgRenderer.#renderDetailFill(
                    fill,
                    PcbSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'fills',
                        fill,
                        index
                    ),
                    semanticContext
                )
            )
            .join('')
        const trackMarkup = primitives.tracks
            .map((track, index) =>
                PcbSvgRenderer.#renderDetailTrack(
                    track,
                    PcbSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'tracks',
                        track,
                        index
                    ),
                    semanticContext
                )
            )
            .join('')
        const arcMarkup = primitives.arcs
            .map((arc, index) =>
                PcbSvgRenderer.#renderDetailArc(
                    arc,
                    PcbSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'arcs',
                        arc,
                        index
                    ),
                    semanticContext
                )
            )
            .join('')
        const regionMarkup = primitives.regions
            .map((region, index) =>
                PcbSvgRenderer.#renderDetailRegion(
                    region,
                    PcbSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'regions',
                        region,
                        index
                    ),
                    semanticContext
                )
            )
            .join('')

        return fillMarkup || trackMarkup || arcMarkup || regionMarkup
            ? '<g class="pcb-detail-layers">' +
                  fillMarkup +
                  trackMarkup +
                  arcMarkup +
                  regionMarkup +
                  '</g>'
            : ''
    }

    /**
     * Renders one non-copper fill primitive.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} fill Fill primitive.
     * @param {number} index Stable primitive index.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #renderDetailFill(fill, index, semanticContext) {
        const x = Math.min(fill.x1, fill.x2)
        const y = Math.min(fill.y1, fill.y2)
        const width = Math.abs(fill.x2 - fill.x1)
        const height = Math.abs(fill.y2 - fill.y1)
        const className = PcbSvgRenderer.#detailPrimitiveClass(
            'fill',
            fill,
            semanticContext
        )

        return (
            '<rect class="' +
            className +
            '" x="' +
            SchematicSvgUtils.formatNumber(x) +
            '" y="' +
            SchematicSvgUtils.formatNumber(y) +
            '" width="' +
            SchematicSvgUtils.formatNumber(width) +
            '" height="' +
            SchematicSvgUtils.formatNumber(height) +
            '" rx="' +
            SchematicSvgUtils.formatNumber(Math.min(width, height) / 6) +
            '"' +
            PcbSvgRenderer.#semanticAttributes(
                'fill',
                fill,
                index,
                semanticContext
            ) +
            ' />'
        )
    }

    /**
     * Renders one non-copper track primitive.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number }} track Track primitive.
     * @param {number} index Stable primitive index.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #renderDetailTrack(track, index, semanticContext) {
        const className = PcbSvgRenderer.#detailPrimitiveClass(
            'track',
            track,
            semanticContext
        )

        return (
            '<line class="' +
            className +
            '" x1="' +
            SchematicSvgUtils.formatNumber(track.x1) +
            '" y1="' +
            SchematicSvgUtils.formatNumber(track.y1) +
            '" x2="' +
            SchematicSvgUtils.formatNumber(track.x2) +
            '" y2="' +
            SchematicSvgUtils.formatNumber(track.y2) +
            '" stroke-width="' +
            SchematicSvgUtils.formatNumber(Math.max(track.width || 0, 1)) +
            '"' +
            PcbSvgRenderer.#semanticAttributes(
                'track',
                track,
                index,
                semanticContext
            ) +
            ' />'
        )
    }

    /**
     * Renders one non-copper arc primitive.
     * @param {object} arc Arc primitive.
     * @param {number} index Stable primitive index.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #renderDetailArc(arc, index, semanticContext) {
        return PcbSvgRenderer.#appendSvgAttributes(
            PcbArcUtils.buildMarkup(
                arc,
                PcbSvgRenderer.#detailPrimitiveClass(
                    'arc',
                    arc,
                    semanticContext
                )
            ),
            PcbSvgRenderer.#semanticAttributes(
                'arc',
                arc,
                index,
                semanticContext
            )
        )
    }

    /**
     * Renders one non-copper region primitive.
     * @param {object} region Region primitive.
     * @param {number} index Stable primitive index.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #renderDetailRegion(region, index, semanticContext) {
        return PcbSvgRenderer.#appendSvgAttributes(
            PcbRegionPrimitiveRenderer.buildMarkup(
                [region],
                PcbSvgRenderer.#detailPrimitiveClass(
                    'region',
                    region,
                    semanticContext
                )
            ),
            PcbSvgRenderer.#semanticAttributes(
                'region',
                region,
                index,
                semanticContext
            )
        )
    }

    /**
     * Builds one detail primitive CSS class string.
     * @param {string} primitiveKind Primitive kind.
     * @param {object} primitive Primitive record.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #detailPrimitiveClass(primitiveKind, primitive, semanticContext) {
        const layer = PcbSvgRenderer.#layerForPrimitive(
            primitive,
            semanticContext
        )
        const role = PcbSvgRenderer.#cssToken(
            PcbSvgRenderer.#layerRoleForDetail(layer)
        )

        return (
            'pcb-detail-' +
            primitiveKind +
            ' pcb-detail-' +
            primitiveKind +
            '--' +
            role
        )
    }

    /**
     * Resolves a layer role suitable for generic detail styling.
     * @param {object | null} layer Layer descriptor.
     * @returns {string}
     */
    static #layerRoleForDetail(layer) {
        return String(layer?.role || 'other')
    }

    /**
     * Converts arbitrary text to a safe CSS class token.
     * @param {unknown} value Raw token value.
     * @returns {string}
     */
    static #cssToken(value) {
        return (
            String(value || 'other')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, '-')
                .replace(/^-+|-+$/gu, '') || 'other'
        )
    }

    /**
     * Normalizes renderer view options.
     * @param {{ viewKind?: string, layerView?: object } | undefined} options Render options.
     * @returns {{ viewKind: string, layerView: object | null, includeViewBox: boolean, documentId: string, documentVersion: string, includeTextGeometrySidecar: boolean }}
     */
    static #normalizeViewOptions(options) {
        const includeViewBox =
            options?.includeViewBox ?? options?.include_view_box

        return {
            viewKind: String(options?.viewKind || 'top-composite'),
            layerView: options?.layerView
                ? PcbSvgRenderer.#layerDescriptor(options.layerView)
                : null,
            includeViewBox: includeViewBox === false ? false : true,
            documentId: String(options?.documentId || options?.docId || ''),
            documentVersion: String(
                options?.documentVersion || options?.documentVer || ''
            ),
            includeTextGeometrySidecar:
                options?.includeTextGeometrySidecar === true ||
                options?.textGeometry === 'sidecar'
        }
    }

    /**
     * Renders root SVG viewBox attributes according to export options.
     * @param {{ includeViewBox: boolean }} options Normalized options.
     * @param {string} viewBox ViewBox value.
     * @returns {string}
     */
    static #renderRootViewBoxAttributes(options, viewBox) {
        return options.includeViewBox
            ? ' viewBox="' + SchematicSvgUtils.escapeHtml(viewBox) + '"'
            : ''
    }

    /**
     * Builds optional PCB text geometry metadata markup.
     * @param {object[]} texts Text rows.
     * @param {object} semanticContext Semantic context.
     * @returns {string}
     */
    static #buildTextGeometryMetadataMarkup(texts, semanticContext) {
        const metadata = TextGeometrySidecarBuilder.buildPcb(
            texts,
            semanticContext.primitiveIndexes?.texts
        )

        return (
            '<metadata id="pcb-text-geometry" data-schema="' +
            TextGeometrySidecarBuilder.SCHEMA_ID +
            '">' +
            SchematicSvgUtils.escapeHtml(JSON.stringify(metadata)) +
            '</metadata>'
        )
    }

    /**
     * Returns stable display layer descriptors for per-layer exports.
     * @param {object} pcb Normalized PCB model.
     * @returns {object[]}
     */
    static #displayLayerDescriptors(pcb) {
        const layers = Array.isArray(pcb?.layers) ? pcb.layers : []
        const primitiveLayers = Array.isArray(pcb?.primitiveLayers)
            ? pcb.primitiveLayers
            : []
        const sourceLayers = layers.length ? layers : primitiveLayers
        const byKey = new Map()

        for (const layer of sourceLayers) {
            const descriptor = PcbSvgRenderer.#layerDescriptor(layer)
            if (descriptor && !byKey.has(descriptor.layerKey)) {
                byKey.set(descriptor.layerKey, descriptor)
            }
        }

        return [...byKey.values()].sort(
            (left, right) =>
                Number(left.layerId ?? Number.MAX_SAFE_INTEGER) -
                    Number(right.layerId ?? Number.MAX_SAFE_INTEGER) ||
                left.displayName.localeCompare(right.displayName, undefined, {
                    numeric: true
                })
        )
    }

    /**
     * Clones and filters the PCB model down to one layer view.
     * @param {object} pcb Normalized PCB model.
     * @param {object} layerView Layer descriptor.
     * @returns {object}
     */
    static #filterPcbForLayer(pcb, layerView) {
        const filter = (primitive) =>
            PcbSvgRenderer.#primitiveBelongsToLayer(primitive, layerView)

        return {
            ...pcb,
            layers: [layerView],
            primitiveLayers: [layerView],
            polygons: (pcb?.polygons || []).filter(filter),
            fills: (pcb?.fills || []).filter(filter),
            tracks: (pcb?.tracks || []).filter(filter),
            arcs: (pcb?.arcs || []).filter(filter),
            vias: (pcb?.vias || []).filter(filter),
            pads: (pcb?.pads || []).filter(filter),
            regions: (pcb?.regions || []).filter(filter),
            shapeBasedRegions: (pcb?.shapeBasedRegions || []).filter(filter),
            texts: (pcb?.texts || []).filter(filter),
            dimensions: (pcb?.dimensions || []).filter(filter),
            components: (pcb?.components || []).filter(filter)
        }
    }

    /**
     * Returns true when one primitive belongs to the requested layer.
     * @param {object} primitive Primitive row.
     * @param {object} layerView Layer descriptor.
     * @returns {boolean}
     */
    static #primitiveBelongsToLayer(primitive, layerView) {
        const layerId = PcbSvgRenderer.#firstFiniteNumber([
            primitive?.layerId,
            primitive?.layerCode
        ])
        const layerIds = PcbSvgRenderer.#layerDescriptorIds(layerView)
        if (Number.isInteger(layerId) && layerIds.length) {
            return layerIds.includes(layerId)
        }

        const primitiveName =
            primitive?.layerName || primitive?.layer || primitive?.side || ''
        if (primitiveName && layerView?.displayName) {
            if (
                PcbSvgRenderer.#normalizeSemanticLookup(primitiveName) ===
                PcbSvgRenderer.#normalizeSemanticLookup(layerView.displayName)
            ) {
                return true
            }

            const primitiveLayerId =
                PcbSvgRenderer.#legacyLayerIdForPrimitiveLayerName(
                    primitiveName
                )
            if (
                Number.isInteger(primitiveLayerId) &&
                layerIds.includes(primitiveLayerId)
            ) {
                return true
            }
        }

        return (
            !Number.isInteger(layerId) &&
            !primitiveName &&
            ['pad', 'via', 'copper'].includes(layerView?.role)
        )
    }

    /**
     * Builds reusable semantic lookup data for one PCB render.
     * @param {object} pcb Normalized PCB model.
     * @param {{ layerId?: number, layerCode?: number, index?: number, name?: string, displayName?: string }[]} displayLayers Visible layer records.
     * @param {{ viewKind?: string, layerView?: object }} viewOptions View options.
     * @returns {{ viewKind: string, layerView?: object, layersById: Map<number, object>, layersByName: Map<string, object>, layerDescriptors: object[], netByIndex: Map<number, object>, netClassNamesByNetName: Map<string, string[]>, componentsByIndex: Map<number, object>, primitiveIndexes: Record<string, Map<object, number>> }}
     */
    static #buildSemanticContext(pcb, displayLayers, viewOptions = {}) {
        const layerRecords = [
            ...(displayLayers || []),
            ...(pcb?.primitiveLayers || [])
        ]
        const layersById = new Map()
        const layersByName = new Map()
        const layerDescriptors = []

        for (const layer of layerRecords) {
            const descriptor = PcbSvgRenderer.#layerDescriptor(layer)
            if (!descriptor) {
                continue
            }
            if (
                Number.isInteger(descriptor.layerId) &&
                !layersById.has(descriptor.layerId)
            ) {
                layersById.set(descriptor.layerId, descriptor)
            }
            if (
                Number.isInteger(descriptor.legacyLayerId) &&
                !layersById.has(descriptor.legacyLayerId)
            ) {
                layersById.set(descriptor.legacyLayerId, descriptor)
            }
            const normalizedName = PcbSvgRenderer.#normalizeSemanticLookup(
                descriptor.displayName
            )
            if (normalizedName && !layersByName.has(normalizedName)) {
                layersByName.set(normalizedName, descriptor)
            }
            if (
                !layerDescriptors.some(
                    (existing) => existing.layerKey === descriptor.layerKey
                )
            ) {
                layerDescriptors.push(descriptor)
            }
        }

        const netByIndex = new Map()
        const netNameByLookup = new Map()
        for (const net of pcb?.nets || []) {
            const netIndex = Number(net?.netIndex)
            if (Number.isInteger(netIndex)) {
                netByIndex.set(netIndex, net)
            }
            if (net?.name) {
                netNameByLookup.set(
                    PcbSvgRenderer.#normalizeSemanticLookup(net.name),
                    net.name
                )
            }
        }

        const netClassNamesByNetName = new Map()
        for (const classRecord of pcb?.classes || []) {
            if (!PcbSvgRenderer.#isNetClass(classRecord)) {
                continue
            }
            for (const member of classRecord.members || []) {
                const netName =
                    netNameByLookup.get(
                        PcbSvgRenderer.#normalizeSemanticLookup(member)
                    ) || member
                const classNames = netClassNamesByNetName.get(netName) || []
                classNames.push(classRecord.name)
                netClassNamesByNetName.set(netName, classNames)
            }
        }

        return {
            viewKind: viewOptions.viewKind || 'top-composite',
            layerView: viewOptions.layerView || null,
            layersById,
            layersByName,
            layerDescriptors,
            netByIndex,
            netClassNamesByNetName,
            componentsByIndex: PcbSvgRenderer.#componentIndexMap(
                pcb?.components || []
            ),
            primitiveIndexes: {
                polygons: PcbSvgRenderer.#objectIndexMap(pcb?.polygons || []),
                fills: PcbSvgRenderer.#objectIndexMap(pcb?.fills || []),
                tracks: PcbSvgRenderer.#objectIndexMap(pcb?.tracks || []),
                arcs: PcbSvgRenderer.#objectIndexMap(pcb?.arcs || []),
                regions: PcbSvgRenderer.#objectIndexMap(pcb?.regions || []),
                vias: PcbSvgRenderer.#objectIndexMap(pcb?.vias || []),
                pads: PcbSvgRenderer.#objectIndexMap(pcb?.pads || []),
                texts: PcbSvgRenderer.#objectIndexMap(pcb?.texts || []),
                dimensions: PcbSvgRenderer.#objectIndexMap(
                    pcb?.dimensions || []
                ),
                components: PcbSvgRenderer.#objectIndexMap(
                    pcb?.components || []
                )
            }
        }
    }

    /**
     * Builds a compact JSON sidecar describing semantic SVG element keys.
     * @param {object} pcb Normalized PCB model.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {{ schema: string, boardOutline: object, layers: object[], elements: object[] }}
     */
    static #buildSemanticMetadata(pcb, semanticContext) {
        return {
            schema: PcbSvgRenderer.#SEMANTIC_SCHEMA,
            view: PcbSvgRenderer.#buildViewMetadata(pcb, semanticContext),
            lookups: PcbSvgRenderer.#buildSemanticLookups(pcb, semanticContext),
            boardOutline: {
                feature: 'board-outline',
                elementKeys: ['pcb-board-outline', 'pcb-board-outline-stroke']
            },
            layers: semanticContext.layerDescriptors,
            elements: [
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'polygon',
                    'polygons',
                    pcb?.polygons || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'fill',
                    'fills',
                    pcb?.fills || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'track',
                    'tracks',
                    pcb?.tracks || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'arc',
                    'arcs',
                    pcb?.arcs || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'region',
                    'regions',
                    pcb?.regions || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'via',
                    'vias',
                    pcb?.vias || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'pad',
                    'pads',
                    pcb?.pads || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'text',
                    'texts',
                    pcb?.texts || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'dimension',
                    'dimensions',
                    pcb?.dimensions || [],
                    semanticContext
                ),
                ...PcbSvgRenderer.#semanticMetadataEntries(
                    'component',
                    'components',
                    pcb?.components || [],
                    semanticContext
                )
            ]
        }
    }

    /**
     * Builds stable lookup maps for semantic SVG consumers.
     * @param {object} pcb Normalized PCB model.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object}
     */
    static #buildSemanticLookups(pcb, semanticContext) {
        const netsByIndex = {}
        const netIndexByName = {}
        const netClassesByName = {}
        const componentsByIndex = {}
        const componentIndexByDesignator = {}
        const layersByKey = {}
        const layerKeyByDisplayName = {}

        for (const net of pcb?.nets || []) {
            const netIndex = Number(net?.netIndex)
            if (Number.isInteger(netIndex) && net?.name) {
                netsByIndex[netIndex] = net.name
                netIndexByName[net.name] = netIndex
            }
        }

        for (const [
            netName,
            classNames
        ] of semanticContext.netClassNamesByNetName) {
            netClassesByName[netName] = [...classNames].sort((left, right) =>
                left.localeCompare(right, undefined, { numeric: true })
            )
        }

        for (const [
            componentIndex,
            component
        ] of semanticContext.componentsByIndex) {
            componentsByIndex[componentIndex] =
                PcbSvgRenderer.#stripEmptySemanticObject({
                    designator: component.designator,
                    uniqueId: component.uniqueId,
                    pattern: component.pattern
                })
            if (component.designator) {
                componentIndexByDesignator[component.designator] =
                    componentIndex
            }
        }

        for (const layer of semanticContext.layerDescriptors) {
            layersByKey[layer.layerKey] = layer
            layerKeyByDisplayName[layer.displayName] = layer.layerKey
        }

        return {
            netsByIndex,
            netIndexByName,
            netClassesByName,
            componentsByIndex,
            componentIndexByDesignator,
            layersByKey,
            layerKeyByDisplayName
        }
    }

    /**
     * Builds metadata for the rendered PCB view.
     * @param {object} pcb Normalized PCB model.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object}
     */
    static #buildViewMetadata(pcb, semanticContext) {
        return {
            kind: semanticContext.viewKind || 'top-composite',
            board: PcbSvgRenderer.#buildBoardViewMetadata(pcb),
            layerSet: {
                includedLayerIds:
                    PcbSvgRenderer.#includedLayerIds(semanticContext),
                layerView: semanticContext.layerView || undefined,
                roles: semanticContext.layerDescriptors.map((layer) =>
                    PcbSvgRenderer.#stripEmptySemanticObject({
                        layerId: layer.layerId,
                        layerKey: layer.layerKey,
                        displayName: layer.displayName,
                        role: layer.role
                    })
                )
            },
            cutouts: PcbSvgRenderer.#boardCutoutMetadata(pcb),
            drills: [
                ...(pcb?.vias || [])
                    .filter((via) => Number(via?.holeDiameter || 0) > 0)
                    .map((via, index) =>
                        PcbSvgRenderer.#drillDescriptor(
                            'via',
                            via,
                            'pcb-via-hole-' +
                                PcbSvgRenderer.#primitiveIndex(
                                    semanticContext,
                                    'vias',
                                    via,
                                    index
                                )
                        )
                    ),
                ...(pcb?.pads || [])
                    .filter((pad) => Number(pad?.holeDiameter || 0) > 0)
                    .map((pad, index) =>
                        PcbSvgRenderer.#drillDescriptor(
                            'pad',
                            pad,
                            'pcb-pad-hole-' +
                                PcbSvgRenderer.#primitiveIndex(
                                    semanticContext,
                                    'pads',
                                    pad,
                                    index
                                )
                        )
                    )
            ]
        }
    }

    /**
     * Builds board-level view metadata.
     * @param {object} pcb Normalized PCB model.
     * @returns {object}
     */
    static #buildBoardViewMetadata(pcb) {
        const outline = pcb?.boardOutline || {}
        const minX = Number(outline.minX || 0)
        const minY = Number(outline.minY || 0)
        const width = Number(outline.widthMil || 0)
        const height = Number(outline.heightMil || 0)

        return {
            elementKey: 'pcb-board-outline',
            outlineOnly: PcbSvgRenderer.#isBoardOutlineOnly(pcb),
            centroid: {
                x: minX + width / 2,
                y: minY + height / 2
            },
            bounds: {
                minX,
                minY,
                maxX: minX + width,
                maxY: minY + height
            }
        }
    }

    /**
     * Builds board cutout sidecar entries.
     * @param {object} pcb Normalized PCB model.
     * @returns {object[]}
     */
    static #boardCutoutMetadata(pcb) {
        const outlineCutouts = Array.isArray(pcb?.boardOutline?.cutouts)
            ? pcb.boardOutline.cutouts
            : []
        const regionCutouts = (pcb?.boardRegions || []).filter(
            (region) => region?.isBoardCutout === true
        )

        return [...outlineCutouts, ...regionCutouts].map((cutout, index) =>
            PcbSvgRenderer.#stripEmptySemanticObject({
                id: cutout.id || cutout.uniqueId || 'cutout-' + index,
                kind: cutout.kind || 'board-cutout',
                elementKey: 'pcb-board-cutout-' + index
            })
        )
    }

    /**
     * Builds one drill sidecar entry.
     * @param {'pad' | 'via'} owner Drill owner kind.
     * @param {object} primitive Drill owner primitive.
     * @param {string} elementKey SVG element key.
     * @returns {object}
     */
    static #drillDescriptor(owner, primitive, elementKey) {
        return PcbSvgRenderer.#stripEmptySemanticObject({
            elementKey,
            owner,
            holeKind: owner,
            plating: PcbSvgRenderer.#drillPlating(primitive),
            renderState: PcbSvgRenderer.#drillRenderState(primitive),
            ipc4761Type:
                primitive?.ipc4761Type ?? primitive?.viaProtection?.ipc4761Type
        })
    }

    /**
     * Builds sidecar entries for one primitive collection.
     * @param {string} primitiveKind Public primitive kind.
     * @param {string} collectionKey Primitive collection key.
     * @param {object[]} primitives Primitive records.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object[]}
     */
    static #semanticMetadataEntries(
        primitiveKind,
        collectionKey,
        primitives,
        semanticContext
    ) {
        return (primitives || []).map((primitive, fallbackIndex) => {
            const index = PcbSvgRenderer.#primitiveIndex(
                semanticContext,
                collectionKey,
                primitive,
                fallbackIndex
            )
            const layer = PcbSvgRenderer.#layerForPrimitive(
                primitive,
                semanticContext
            )
            const netName = PcbSvgRenderer.#netNameForPrimitive(
                primitive,
                semanticContext
            )
            const component = PcbSvgRenderer.#componentForPrimitive(
                primitive,
                semanticContext
            )

            return PcbSvgRenderer.#stripEmptySemanticObject({
                elementKey: 'pcb-' + primitiveKind + '-' + index,
                primitive: primitiveKind,
                layerKey: layer?.layerKey,
                layerDisplayName: layer?.displayName,
                net: netName,
                netClasses: PcbSvgRenderer.#netClassNames(
                    netName,
                    semanticContext
                ),
                component: component?.designator,
                componentIndex: Number.isInteger(
                    Number(primitive?.componentIndex)
                )
                    ? Number(primitive.componentIndex)
                    : undefined,
                padNumber:
                    primitiveKind === 'pad'
                        ? PcbSvgRenderer.#padNumber(primitive)
                        : undefined,
                textRole:
                    primitiveKind === 'text'
                        ? primitive?.role || primitive?.textRole
                        : undefined,
                dimensionKind:
                    primitiveKind === 'dimension'
                        ? primitive?.kind || 'linear'
                        : undefined,
                measuredValue:
                    primitiveKind === 'dimension'
                        ? (primitive?.measuredValue ?? undefined)
                        : undefined,
                angleValue:
                    primitiveKind === 'dimension'
                        ? (primitive?.angleValue ?? undefined)
                        : undefined,
                text:
                    primitiveKind === 'dimension'
                        ? primitive?.text || undefined
                        : undefined
            })
        })
    }

    /**
     * Renders semantic data attributes for one SVG element.
     * @param {string} primitiveKind Public primitive kind.
     * @param {object} primitive Primitive record.
     * @param {number} index Stable primitive index.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #semanticAttributes(
        primitiveKind,
        primitive,
        index,
        semanticContext
    ) {
        const layer = PcbSvgRenderer.#layerForPrimitive(
            primitive,
            semanticContext
        )
        const netName = PcbSvgRenderer.#netNameForPrimitive(
            primitive,
            semanticContext
        )
        const component = PcbSvgRenderer.#componentForPrimitive(
            primitive,
            semanticContext
        )
        const netClasses = PcbSvgRenderer.#netClassNames(
            netName,
            semanticContext
        )

        return PcbSvgRenderer.#renderDataAttributes({
            'data-primitive': primitiveKind,
            'data-element-key': 'pcb-' + primitiveKind + '-' + index,
            'data-layer-key': layer?.layerKey,
            'data-layer-display-name': layer?.displayName,
            'data-layer-id': layer?.layerId,
            'data-net': netName,
            'data-net-index': primitive?.netIndex,
            'data-net-class': netClasses[0],
            'data-net-classes': netClasses.length > 1 ? netClasses : undefined,
            'data-component': component?.designator,
            'data-component-index': component?.componentIndex,
            'data-component-unique-id': component?.uniqueId,
            'data-pad-number':
                primitiveKind === 'pad'
                    ? PcbSvgRenderer.#padNumber(primitive)
                    : undefined
        })
    }

    /**
     * Renders semantic data attributes for one dimension SVG group.
     * @param {object} dimension Dimension record.
     * @param {number} index Stable dimension index.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #dimensionAttributes(dimension, index, semanticContext) {
        return (
            PcbSvgRenderer.#semanticAttributes(
                'dimension',
                dimension,
                index,
                semanticContext
            ) +
            PcbSvgRenderer.#renderDataAttributes({
                'data-dimension-kind': dimension?.kind || 'linear',
                'data-dimension-name': dimension?.name,
                'data-dimension-text': dimension?.text,
                'data-measured-value': dimension?.measuredValue,
                'data-angle-value': dimension?.angleValue,
                'data-unit': dimension?.unit
            })
        )
    }

    /**
     * Inserts generated attributes into a simple SVG element string.
     * @param {string} markup SVG element markup.
     * @param {string} attributes Rendered attributes.
     * @returns {string}
     */
    static #appendSvgAttributes(markup, attributes) {
        if (!attributes) {
            return markup
        }

        return String(markup).replace(/(\s*\/?>)/u, attributes + '$1')
    }

    /**
     * Returns a stable primitive index from the original source collection.
     * @param {object} semanticContext Semantic lookup context.
     * @param {string} collectionKey Primitive collection key.
     * @param {object} primitive Primitive record.
     * @param {number} fallbackIndex Index in the rendered collection.
     * @returns {number}
     */
    static #primitiveIndex(
        semanticContext,
        collectionKey,
        primitive,
        fallbackIndex
    ) {
        const resolved =
            semanticContext.primitiveIndexes?.[collectionKey]?.get(primitive)

        return Number.isInteger(resolved) ? resolved : fallbackIndex
    }

    /**
     * Renders a dictionary as SVG data attributes.
     * @param {Record<string, unknown>} attributes Attribute dictionary.
     * @returns {string}
     */
    static #renderDataAttributes(attributes) {
        return Object.entries(attributes || {})
            .filter(([, value]) => {
                if (Array.isArray(value)) {
                    return value.length > 0
                }
                return value !== null && value !== undefined && value !== ''
            })
            .map(([name, value]) => {
                const renderedValue = Array.isArray(value)
                    ? value.join(',')
                    : String(value)
                return (
                    ' ' +
                    name +
                    '="' +
                    SchematicSvgUtils.escapeHtml(renderedValue) +
                    '"'
                )
            })
            .join('')
    }

    /**
     * Builds an object identity map for stable primitive indexes.
     * @param {object[]} records Primitive records.
     * @returns {Map<object, number>}
     */
    static #objectIndexMap(records) {
        return new Map((records || []).map((record, index) => [record, index]))
    }

    /**
     * Builds a component lookup keyed by native component index.
     * @param {object[]} components Component records.
     * @returns {Map<number, object>}
     */
    static #componentIndexMap(components) {
        const componentsByIndex = new Map()

        for (const component of components || []) {
            const componentIndex = Number(component?.componentIndex)
            if (Number.isInteger(componentIndex)) {
                componentsByIndex.set(componentIndex, component)
            }
        }

        return componentsByIndex
    }

    /**
     * Resolves a normalized layer descriptor from a layer record.
     * @param {object} layer Layer record.
     * @returns {{ layerId?: number, layerKey: string, displayName: string } | null}
     */
    static #layerDescriptor(layer) {
        if (!layer || typeof layer !== 'object') {
            return null
        }

        const layerId = PcbSvgRenderer.#firstFiniteNumber([
            layer.layerId,
            layer.layerCode,
            layer.id,
            layer.index
        ])
        const legacyLayerId = PcbSvgRenderer.#legacyLayerId(layer, layerId)
        const displayName =
            layer.displayName || layer.name || layer.layerName || ''
        const layerKey = Number.isInteger(layerId)
            ? 'L' + layerId
            : PcbSvgRenderer.#normalizeSemanticLookup(displayName)

        if (!layerKey && !displayName) {
            return null
        }

        return PcbSvgRenderer.#stripEmptySemanticObject({
            layerId,
            legacyLayerId,
            layerKey,
            displayName: displayName || layerKey,
            role:
                layer.role ||
                layer.layerRole ||
                PcbSvgRenderer.#inferLayerRole(
                    displayName,
                    legacyLayerId ?? layerId
                )
        })
    }

    /**
     * Returns included layer ids from semantic context.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {number[]}
     */
    static #includedLayerIds(semanticContext) {
        return (semanticContext?.layerDescriptors || [])
            .flatMap((layer) => PcbSvgRenderer.#layerDescriptorIds(layer))
            .filter((layerId) => Number.isInteger(layerId))
    }

    /**
     * Returns all numeric identifiers that can address one layer descriptor.
     * @param {object | null} layer Layer descriptor.
     * @returns {number[]}
     */
    static #layerDescriptorIds(layer) {
        return [
            PcbSvgRenderer.#firstFiniteNumber([layer?.layerId]),
            PcbSvgRenderer.#firstFiniteNumber([layer?.legacyLayerId])
        ].filter(
            (layerId, index, layerIds) =>
                Number.isInteger(layerId) && layerIds.indexOf(layerId) === index
        )
    }

    /**
     * Resolves a legacy primitive-layer alias for a layer descriptor.
     * @param {object} layer Layer record.
     * @param {number | undefined} layerId Primary layer id.
     * @returns {number | undefined}
     */
    static #legacyLayerId(layer, layerId) {
        const explicitLegacyLayerId = PcbSvgRenderer.#firstFiniteNumber([
            layer.legacyLayerId,
            layer.legacyId
        ])
        const legacyLayerId = Number.isInteger(explicitLegacyLayerId)
            ? explicitLegacyLayerId
            : PcbLayerIdCodec.legacyLayerIdFromV7SaveId(layerId)

        if (
            !Number.isInteger(legacyLayerId) ||
            (Number.isInteger(layerId) && legacyLayerId === layerId)
        ) {
            return undefined
        }

        return legacyLayerId
    }

    /**
     * Returns true when a PCB view contains only board outline metadata.
     * @param {object} pcb Normalized PCB model.
     * @returns {boolean}
     */
    static #isBoardOutlineOnly(pcb) {
        return [
            'polygons',
            'fills',
            'tracks',
            'arcs',
            'vias',
            'pads',
            'texts',
            'dimensions',
            'components',
            'regions',
            'shapeBasedRegions'
        ].every((key) => !Array.isArray(pcb?.[key]) || pcb[key].length === 0)
    }

    /**
     * Infers one broad rendering role from a layer name.
     * @param {string} displayName Layer display name.
     * @param {number | undefined} layerId Legacy layer id.
     * @returns {string}
     */
    static #inferLayerRole(displayName, layerId) {
        const groupedRole = PcbSvgRenderer.#inferLayerRoleFromId(layerId)
        if (groupedRole) {
            return groupedRole
        }

        const normalized = String(displayName || '').toLowerCase()
        if (/overlay|silk/u.test(normalized)) return 'overlay'
        if (/paste/u.test(normalized)) return 'paste'
        if (/mask/u.test(normalized)) return 'mask'
        if (/mechanical|dimension|outline/u.test(normalized)) {
            return 'mechanical'
        }
        if (/drill/u.test(normalized)) return 'drill'
        if (
            /layer|copper|plane/u.test(normalized) ||
            /\binternal[-_\s]*\d+\b/u.test(normalized) ||
            /\binner[-_\s]*\d+\b/u.test(normalized)
        ) {
            return 'copper'
        }
        return 'other'
    }

    /**
     * Infers one layer role from a legacy Altium layer id.
     * @param {unknown} layerId Legacy layer id.
     * @returns {string}
     */
    static #inferLayerRoleFromId(layerId) {
        const legacyLayerId = Number(layerId)
        if (!Number.isInteger(legacyLayerId)) {
            return ''
        }
        if (
            PcbLayerGroups.isCopper(legacyLayerId) ||
            PcbLayerGroups.isInternalPlane(legacyLayerId)
        ) {
            return 'copper'
        }
        if (PcbLayerGroups.isOverlay(legacyLayerId)) return 'overlay'
        if (PcbLayerGroups.isPaste(legacyLayerId)) return 'paste'
        if (PcbLayerGroups.isSolderMask(legacyLayerId)) return 'mask'
        if (PcbLayerGroups.isDrill(legacyLayerId)) return 'drill'
        if (PcbLayerGroups.isKeepout(legacyLayerId)) return 'keepout'
        if (PcbLayerGroups.isMechanical(legacyLayerId)) return 'mechanical'
        if (PcbLayerGroups.isMultiLayer(legacyLayerId)) return 'multi-layer'
        return ''
    }

    /**
     * Resolves drill plating metadata for SVG and sidecar output.
     * @param {object} primitive Drill owner primitive.
     * @returns {'plated' | 'non-plated'}
     */
    static #drillPlating(primitive) {
        return primitive?.isPlated === false ? 'non-plated' : 'plated'
    }

    /**
     * Resolves the visible drill state from explicit metadata and
     * via-protection features.
     * @param {object} primitive Drill owner primitive.
     * @returns {'open' | 'covered' | 'filled' | 'capped'}
     */
    static #drillRenderState(primitive) {
        const explicit =
            primitive?.drillRenderState ||
            primitive?.renderState ||
            primitive?.drill?.renderState
        if (explicit) {
            return PcbSvgRenderer.#normalizeDrillRenderState(explicit)
        }

        const featureText = (primitive?.viaProtection?.features || [])
            .flatMap((feature) => [feature.type, feature.material])
            .join(' ')
            .toLowerCase()

        if (/cap/u.test(featureText)) return 'capped'
        if (/fill|plug/u.test(featureText)) return 'filled'
        if (/cover|tent|mask/u.test(featureText)) return 'covered'

        const ipcType = Number(
            primitive?.ipc4761Type ?? primitive?.viaProtection?.ipc4761Type
        )
        if (ipcType === 6 || ipcType === 7) return 'capped'
        if (ipcType === 3 || ipcType === 4 || ipcType === 5) return 'filled'
        if (ipcType === 1 || ipcType === 2) return 'covered'

        return 'open'
    }

    /**
     * Normalizes a drill render-state label.
     * @param {unknown} value Raw state label.
     * @returns {'open' | 'covered' | 'filled' | 'capped'}
     */
    static #normalizeDrillRenderState(value) {
        const normalized = String(value || '').toLowerCase()
        if (/cap/u.test(normalized)) return 'capped'
        if (/fill|plug/u.test(normalized)) return 'filled'
        if (/cover|tent|mask/u.test(normalized)) return 'covered'
        return 'open'
    }

    /**
     * Resolves a layer descriptor for one primitive.
     * @param {object} primitive Primitive record.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {{ layerId?: number, layerKey: string, displayName: string } | null}
     */
    static #layerForPrimitive(primitive, semanticContext) {
        const knownLayer = PcbSvgRenderer.#knownLayerForPrimitive(
            primitive,
            semanticContext
        )
        if (knownLayer) {
            return knownLayer
        }

        const layerId = PcbSvgRenderer.#firstFiniteNumber([
            primitive?.layerId,
            primitive?.layerCode
        ])
        if (Number.isInteger(layerId)) {
            return {
                layerId,
                layerKey: 'L' + layerId,
                displayName:
                    primitive?.layerName ||
                    primitive?.layer ||
                    'Layer ' + layerId,
                role: PcbSvgRenderer.#inferLayerRole('', layerId)
            }
        }

        return null
    }

    /**
     * Resolves a layer descriptor only when the layer is in recovered metadata.
     * @param {object} primitive Primitive record.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {{ layerId?: number, layerKey: string, displayName: string } | null}
     */
    static #knownLayerForPrimitive(primitive, semanticContext) {
        const layerId = PcbSvgRenderer.#firstFiniteNumber([
            primitive?.layerId,
            primitive?.layerCode
        ])
        if (Number.isInteger(layerId)) {
            return semanticContext.layersById.get(layerId) || null
        }

        const layerName =
            primitive?.layerName || primitive?.layer || primitive?.side || ''
        const byName = semanticContext.layersByName.get(
            PcbSvgRenderer.#normalizeSemanticLookup(layerName)
        )

        return (
            byName ||
            PcbSvgRenderer.#layerForPrimitiveLayerAlias(
                layerName,
                semanticContext
            )
        )
    }

    /**
     * Resolves legacy Altium primitive layer names such as MID2 to a layer.
     * @param {string} layerName Primitive layer name.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {{ layerId?: number, layerKey: string, displayName: string } | null}
     */
    static #layerForPrimitiveLayerAlias(layerName, semanticContext) {
        const legacyLayerId =
            PcbSvgRenderer.#legacyLayerIdForPrimitiveLayerName(layerName)

        return Number.isInteger(legacyLayerId)
            ? semanticContext.layersById.get(legacyLayerId) || null
            : null
    }

    /**
     * Converts common primitive layer aliases into legacy layer ids.
     * @param {string} layerName Primitive layer name.
     * @returns {number | undefined}
     */
    static #legacyLayerIdForPrimitiveLayerName(layerName) {
        const compact = PcbSvgRenderer.#normalizeSemanticLookup(
            layerName
        ).replace(/[\s_-]+/gu, '')

        if (compact === 'TOP' || compact === 'TOPLAYER') {
            return 1
        }
        if (
            compact === 'BOTTOM' ||
            compact === 'BOTTOMLAYER' ||
            compact === 'BOT' ||
            compact === 'BOTLAYER'
        ) {
            return 32
        }

        const midLayerMatch = compact.match(/^MID(?:DLE)?(?:LAYER)?(\d+)$/u)
        if (midLayerMatch) {
            return Number(midLayerMatch[1]) + 1
        }

        const internalLayerMatch = compact.match(/^(?:INTERNAL|INNER)(\d+)$/u)
        if (internalLayerMatch) {
            return Number(internalLayerMatch[1]) + 1
        }

        return undefined
    }

    /**
     * Resolves a net name for one primitive.
     * @param {object} primitive Primitive record.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #netNameForPrimitive(primitive, semanticContext) {
        if (primitive?.netName) {
            return String(primitive.netName)
        }

        const netIndex = Number(primitive?.netIndex)
        if (Number.isInteger(netIndex)) {
            return semanticContext.netByIndex.get(netIndex)?.name || ''
        }

        return ''
    }

    /**
     * Resolves a component owner for one primitive.
     * @param {object} primitive Primitive record.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object | null}
     */
    static #componentForPrimitive(primitive, semanticContext) {
        if (primitive?.designator && primitive?.pattern) {
            return primitive
        }

        const componentIndex = Number(primitive?.componentIndex)
        if (Number.isInteger(componentIndex)) {
            return semanticContext.componentsByIndex.get(componentIndex) || null
        }

        return null
    }

    /**
     * Returns class names for one net name.
     * @param {string} netName Net name.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string[]}
     */
    static #netClassNames(netName, semanticContext) {
        return netName
            ? semanticContext.netClassNamesByNetName.get(netName) || []
            : []
    }

    /**
     * Returns true when a class record describes nets.
     * @param {object} classRecord Class record.
     * @returns {boolean}
     */
    static #isNetClass(classRecord) {
        return (
            classRecord?.kindName === 'net' || Number(classRecord?.kind) === 0
        )
    }

    /**
     * Returns a pad number-like label from pad metadata.
     * @param {object} pad Pad record.
     * @returns {string}
     */
    static #padNumber(pad) {
        return String(
            pad?.padNumber || pad?.designator || pad?.number || pad?.name || ''
        )
    }

    /**
     * Returns the first finite numeric value from a list.
     * @param {unknown[]} values Candidate values.
     * @returns {number | undefined}
     */
    static #firstFiniteNumber(values) {
        for (const value of values) {
            const parsed = Number(value)
            if (Number.isFinite(parsed)) {
                return parsed
            }
        }

        return undefined
    }

    /**
     * Builds a case-insensitive lookup key for semantic names.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #normalizeSemanticLookup(value) {
        return String(value || '')
            .trim()
            .toUpperCase()
    }

    /**
     * Removes empty fields from a semantic metadata object.
     * @param {Record<string, unknown>} value Metadata object.
     * @returns {Record<string, unknown>}
     */
    static #stripEmptySemanticObject(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) {
                    return entryValue.length > 0
                }
                return (
                    entryValue !== null &&
                    entryValue !== undefined &&
                    entryValue !== ''
                )
            })
        )
    }

    /**
     * Builds a best-effort board path from outline segments.
     * @param {Array<Record<string, number | string>>} segments
     * @returns {string}
     */
    static #buildBoardPath(segments) {
        if (!segments.length) {
            return 'M 0 0 L 1000 0 L 1000 600 L 0 600 Z'
        }
        const [first] = segments
        let path =
            'M ' +
            SchematicSvgUtils.formatNumber(first.x1) +
            ' ' +
            SchematicSvgUtils.formatNumber(first.y1)

        for (const segment of segments) {
            if (segment.type === 'arc') {
                const radius = Math.max(Number(segment.radius) || 0, 1)
                const sweep = PcbArcUtils.resolveShortSweepFromCenter(segment)
                path +=
                    ' A ' +
                    SchematicSvgUtils.formatNumber(radius) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(radius) +
                    ' 0 ' +
                    '0' +
                    ' ' +
                    sweep +
                    ' ' +
                    SchematicSvgUtils.formatNumber(segment.x2) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(segment.y2)
                continue
            }
            path +=
                ' L ' +
                SchematicSvgUtils.formatNumber(segment.x2) +
                ' ' +
                SchematicSvgUtils.formatNumber(segment.y2)
        }

        return path + ' Z'
    }

    /**
     * Renders an optional transform for the whole PCB text layer.
     * @param {{ translateX?: number, translateY?: number, scaleX?: number, scaleY?: number } | undefined} transform Text group transform.
     * @returns {string}
     */
    static #renderTextGroupTransform(transform) {
        if (!transform || typeof transform !== 'object') {
            return ''
        }

        const translateX = Number(transform.translateX || 0)
        const translateY = Number(transform.translateY || 0)
        const scaleX =
            transform.scaleX === null || transform.scaleX === undefined
                ? 1
                : Number(transform.scaleX)
        const scaleY =
            transform.scaleY === null || transform.scaleY === undefined
                ? 1
                : Number(transform.scaleY)
        if (
            !Number.isFinite(translateX) ||
            !Number.isFinite(translateY) ||
            !Number.isFinite(scaleX) ||
            !Number.isFinite(scaleY) ||
            (translateX === 0 &&
                translateY === 0 &&
                scaleX === 1 &&
                scaleY === 1)
        ) {
            return ''
        }

        const parts = []
        if (translateX !== 0 || translateY !== 0) {
            parts.push(
                'translate(' +
                    SchematicSvgUtils.formatNumber(translateX) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(translateY) +
                    ')'
            )
        }
        if (scaleX !== 1 || scaleY !== 1) {
            parts.push(
                'scale(' +
                    SchematicSvgUtils.formatNumber(scaleX) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(scaleY) +
                    ')'
            )
        }

        return ' transform="' + parts.join(' ') + '"'
    }

    /**
     * Computes a reasonable viewBox.
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }} outline
     * @param {{ x: number, y: number }[]} components
     * @param {{ segments: Array<Record<string, number | string>> }[]} polygons
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} fills
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} tracks
     * @param {{ x: number, y: number, radius: number, width?: number }[]} arcs
     * @param {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }[]} regions
     * @param {{ x: number, y: number, diameter: number }[]} vias
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number }[]} pads
     * @param {{ references?: { x: number, y: number }[], textLocation?: { x: number, y: number } }[]} dimensions
     * @returns {string}
     */
    static #buildViewBox(
        outline,
        components,
        polygons,
        fills,
        tracks,
        arcs,
        regions,
        vias,
        pads,
        dimensions
    ) {
        const xs = [outline.minX, outline.minX + outline.widthMil]
        const ys = [outline.minY, outline.minY + outline.heightMil]
        for (const segment of outline.segments || []) {
            xs.push(Number(segment.x1) || 0, Number(segment.x2) || 0)
            ys.push(Number(segment.y1) || 0, Number(segment.y2) || 0)
        }

        for (const polygon of polygons) {
            for (const segment of polygon.segments || []) {
                xs.push(Number(segment.x1) || 0, Number(segment.x2) || 0)
                ys.push(Number(segment.y1) || 0, Number(segment.y2) || 0)
            }
        }

        for (const fill of fills) {
            xs.push(fill.x1, fill.x2)
            ys.push(fill.y1, fill.y2)
        }

        for (const track of tracks) {
            xs.push(track.x1, track.x2)
            ys.push(track.y1, track.y2)
        }

        for (const arc of arcs) {
            PcbArcUtils.pushExtents(xs, ys, arc)
        }

        for (const region of regions) {
            PcbRegionPrimitiveRenderer.pushExtents(xs, ys, region)
        }

        for (const via of vias) {
            const radius = (via.diameter || 0) / 2
            xs.push(via.x - radius, via.x + radius)
            ys.push(via.y - radius, via.y + radius)
        }
        for (const pad of pads) {
            const size = PcbSvgRenderer.#resolvePadSurfaceSize(pad)
            xs.push(pad.x - size.width / 2, pad.x + size.width / 2)
            ys.push(pad.y - size.height / 2, pad.y + size.height / 2)
        }
        PcbDimensionPrimitiveRenderer.pushExtents(xs, ys, dimensions)
        for (const component of components) {
            const bodyGeometry = PcbSvgRenderer.#footprintSize(
                component.pattern
            )
            xs.push(
                component.x - bodyGeometry.width / 2,
                component.x + bodyGeometry.width / 2
            )
            ys.push(
                component.y - bodyGeometry.height / 2,
                component.y + bodyGeometry.height / 2
            )
        }

        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        const maxX = Math.max(...xs)
        const maxY = Math.max(...ys)
        const padding = 240
        return [
            minX - padding,
            minY - padding,
            maxX - minX + padding * 2,
            maxY - minY + padding * 2
        ]
            .map((value) => SchematicSvgUtils.formatNumber(value))
            .join(' ')
    }

    /**
     * Resolves a small footprint-size heuristic and whether the pattern matched
     * a known package family instead of the generic fallback guess.
     * @param {string} pattern
     * @returns {{ width: number, height: number, isRecognized: boolean }}
     */
    static #footprintProfile(pattern) {
        const normalized = String(pattern || '').toUpperCase()
        if (normalized.includes('0402')) {
            return { width: 52, height: 28, isRecognized: true }
        }
        if (normalized.includes('0603')) {
            return { width: 72, height: 36, isRecognized: true }
        }
        if (normalized.includes('0805')) {
            return { width: 92, height: 48, isRecognized: true }
        }
        if (normalized.includes('SOT')) {
            return { width: 140, height: 90, isRecognized: true }
        }
        if (normalized.includes('QFN') || normalized.includes('QFP')) {
            return { width: 180, height: 180, isRecognized: true }
        }
        if (normalized.includes('SC70')) {
            return { width: 110, height: 70, isRecognized: true }
        }

        return { width: 96, height: 60, isRecognized: false }
    }

    /**
     * Returns a small footprint size heuristic for fallback body rendering.
     * @param {string} pattern
     * @returns {{ width: number, height: number }}
     */
    static #footprintSize(pattern) {
        const footprint = PcbSvgRenderer.#footprintProfile(pattern)
        return {
            width: footprint.width,
            height: footprint.height
        }
    }

    /**
     * Builds the local search box used to decide whether a component already
     * has authored pads or outline primitives and therefore should not render
     * a synthetic rounded body.
     * @param {{ x: number, y: number, pattern: string }} component
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    static #footprintDetailBounds(component) {
        const footprint = PcbSvgRenderer.#footprintProfile(component.pattern)
        const halfWidth = footprint.isRecognized
            ? footprint.width / 2 + 36
            : PcbSvgRenderer.#GENERIC_DETAIL_SEARCH_HALF_EXTENT
        const halfHeight = footprint.isRecognized
            ? footprint.height / 2 + 36
            : PcbSvgRenderer.#GENERIC_DETAIL_SEARCH_HALF_EXTENT

        return {
            minX: Number(component.x) - halfWidth,
            maxX: Number(component.x) + halfWidth,
            minY: Number(component.y) - halfHeight,
            maxY: Number(component.y) + halfHeight
        }
    }

    /**
     * Chooses one visible through-hole pad size for top-view rendering.
     * @param {{ sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number }} pad
     * @returns {{ width: number, height: number }}
     */
    static #resolvePadSurfaceSize(pad) {
        const width =
            Number(pad.sizeTopX || pad.sizeMidX || pad.sizeBottomX || 0) ||
            Number(pad.holeDiameter || 0)
        const height =
            Number(pad.sizeTopY || pad.sizeMidY || pad.sizeBottomY || 0) ||
            Number(pad.holeDiameter || 0)

        return {
            width: Math.max(width, Number(pad.holeDiameter || 0), 1),
            height: Math.max(height, Number(pad.holeDiameter || 0), 1)
        }
    }

    /**
     * Renders one through-hole pad as SVG.
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number, shapeTop?: number, rotation?: number, holeShape?: number | null, holeSlotLength?: number | null, holeRotation?: number | null, offsetTopX?: number, offsetTopY?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, cornerRadiusTop?: number | null }} pad
     * @param {number} index Stable pad index.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #renderPad(pad, index, semanticContext) {
        const size = PcbSvgRenderer.#resolvePadSurfaceSize(pad)
        const padIsCircular = PcbSvgRenderer.#isCircularPad(pad, size)
        const ringRadius = Math.max(Math.max(size.width, size.height) / 2, 0.6)
        const offsetX = Number(pad.offsetTopX || 0)
        const offsetY = Number(pad.offsetTopY || 0)
        const hasHole = Number(pad.holeDiameter || 0) > 0
        const ringMarkup = padIsCircular
            ? '<circle class="pcb-pad__ring" cx="' +
              SchematicSvgUtils.formatNumber(offsetX) +
              '" cy="' +
              SchematicSvgUtils.formatNumber(offsetY) +
              '" r="' +
              SchematicSvgUtils.formatNumber(ringRadius) +
              '" />'
            : '<rect class="pcb-pad__ring" x="' +
              SchematicSvgUtils.formatNumber(offsetX - size.width / 2) +
              '" y="' +
              SchematicSvgUtils.formatNumber(offsetY - size.height / 2) +
              '" width="' +
              SchematicSvgUtils.formatNumber(size.width) +
              '" height="' +
              SchematicSvgUtils.formatNumber(size.height) +
              '" rx="' +
              SchematicSvgUtils.formatNumber(
                  PcbSvgRenderer.#resolvePadCornerRadius(pad, size)
              ) +
              '" />'
        const holeMarkup = PcbSvgRenderer.#renderPadHole(pad, index)

        return (
            '<g class="pcb-pad pcb-pad--' +
            (padIsCircular ? 'round' : 'shaped') +
            ' pcb-pad--' +
            (hasHole ? 'through-hole' : 'smd') +
            '" transform="translate(' +
            SchematicSvgUtils.formatNumber(pad.x) +
            ' ' +
            SchematicSvgUtils.formatNumber(pad.y) +
            ') rotate(' +
            SchematicSvgUtils.formatNumber(Number(pad.rotation || 0)) +
            ')"' +
            PcbSvgRenderer.#semanticAttributes(
                'pad',
                pad,
                index,
                semanticContext
            ) +
            '>' +
            ringMarkup +
            holeMarkup +
            '</g>'
        )
    }

    /**
     * Renders semantic attributes for a generated pad mask aperture.
     * @param {object} aperture Pad mask aperture descriptor.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #padMaskApertureAttributes(aperture, semanticContext) {
        return (
            PcbSvgRenderer.#semanticAttributes(
                aperture.spec.primitiveKind,
                aperture.primitive,
                aperture.index,
                semanticContext
            ) +
            PcbSvgRenderer.#renderDataAttributes({
                'data-pad-number': PcbSvgRenderer.#padNumber(aperture.pad),
                'data-mask-kind': aperture.spec.kind,
                'data-mask-side': aperture.spec.side,
                'data-source-pad-element-key': 'pcb-pad-' + aperture.padIndex
            })
        )
    }

    /**
     * Renders one pad drill hole as SVG.
     * @param {{ holeDiameter?: number, holeShape?: number | null, holeSlotLength?: number | null, holeRotation?: number | null }} pad
     * @param {number} index Stable pad index.
     * @returns {string}
     */
    static #renderPadHole(pad, index) {
        if (Number(pad.holeDiameter || 0) <= 0) {
            return ''
        }

        const holeDiameter = Math.max(Number(pad.holeDiameter || 0), 1.2)
        const holeRadius = Math.max(holeDiameter / 2, 0.6)

        if (PcbSvgRenderer.#isSlotHole(pad)) {
            const slotLength = Math.max(
                Number(pad.holeSlotLength || 0),
                holeDiameter
            )

            return (
                '<g class="pcb-pad__hole-rotation" transform="rotate(' +
                SchematicSvgUtils.formatNumber(Number(pad.holeRotation || 0)) +
                ')">' +
                '<rect class="pcb-pad__hole pcb-pad__hole--slot" x="' +
                SchematicSvgUtils.formatNumber(-slotLength / 2) +
                '" y="' +
                SchematicSvgUtils.formatNumber(-holeDiameter / 2) +
                '" width="' +
                SchematicSvgUtils.formatNumber(slotLength) +
                '" height="' +
                SchematicSvgUtils.formatNumber(holeDiameter) +
                '" rx="' +
                SchematicSvgUtils.formatNumber(holeRadius) +
                '"' +
                PcbSvgRenderer.#renderDataAttributes({
                    'data-primitive': 'pad-hole',
                    'data-element-key': 'pcb-pad-hole-' + index,
                    'data-hole-owner': 'pad',
                    'data-hole-kind': 'pad',
                    'data-plating': PcbSvgRenderer.#drillPlating(pad),
                    'data-drill-render-state':
                        PcbSvgRenderer.#drillRenderState(pad)
                }) +
                ' />' +
                '</g>'
            )
        }

        return (
            '<circle class="pcb-pad__hole" cx="0" cy="0" r="' +
            SchematicSvgUtils.formatNumber(holeRadius) +
            '"' +
            PcbSvgRenderer.#renderDataAttributes({
                'data-primitive': 'pad-hole',
                'data-element-key': 'pcb-pad-hole-' + index,
                'data-hole-owner': 'pad',
                'data-hole-kind': 'pad',
                'data-plating': PcbSvgRenderer.#drillPlating(pad),
                'data-drill-render-state': PcbSvgRenderer.#drillRenderState(pad)
            }) +
            ' />'
        )
    }

    /**
     * Returns true when one through-hole pad should render as a circular ring.
     * @param {{ shapeTop?: number, hasRoundedRect?: boolean }} pad
     * @param {{ width: number, height: number }} size
     * @returns {boolean}
     */
    static #isCircularPad(pad, size) {
        const effectiveShape = PcbSvgRenderer.#resolvePadShape(pad)

        if (effectiveShape === PcbSvgRenderer.#PAD_SHAPE_RECTANGULAR) {
            return false
        }

        return Math.abs(Number(size.width) - Number(size.height)) < 0.001
    }

    /**
     * Returns true when one component already has authored geometry, either by
     * an explicit component ownership link or by nearby recovered primitives.
     * @param {{ componentIndex?: number | null, x: number, y: number, pattern: string }} component
     * @param {{ fills: { componentIndex?: number | null, x1: number, y1: number, x2: number, y2: number }[], tracks: { componentIndex?: number | null, x1: number, y1: number, x2: number, y2: number }[], arcs: { componentIndex?: number | null, x: number, y: number, radius: number, width?: number }[], regions?: { componentIndex?: number | null, points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }[] }} footprintPrimitives
     * @param {{ componentIndex?: number | null, x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, rotation?: number, offsetTopX?: number, offsetTopY?: number, holeDiameter?: number }[]} pads
     * @returns {boolean}
     */
    static #hasAuthoredFootprintDetail(component, footprintPrimitives, pads) {
        if (
            PcbSvgRenderer.#hasComponentOwnedFootprintDetail(
                component,
                footprintPrimitives,
                pads
            )
        ) {
            return true
        }

        const bounds = PcbSvgRenderer.#footprintDetailBounds(component)

        return (
            (footprintPrimitives.tracks || []).some((track) =>
                PcbSvgRenderer.#trackIntersectsBounds(track, bounds)
            ) ||
            (footprintPrimitives.fills || []).some((fill) =>
                PcbSvgRenderer.#fillIntersectsBounds(fill, bounds)
            ) ||
            (footprintPrimitives.arcs || []).some((arc) =>
                PcbArcUtils.intersectsBounds(arc, bounds)
            ) ||
            (footprintPrimitives.regions || []).some((region) =>
                PcbRegionPrimitiveRenderer.intersectsBounds(region, bounds)
            ) ||
            (pads || []).some((pad) =>
                PcbSvgRenderer.#padIntersectsBounds(pad, bounds)
            )
        )
    }

    /**
     * Returns true when recovered primitives directly reference the component.
     * @param {{ componentIndex?: number | null }} component
     * @param {{ fills?: { componentIndex?: number | null }[], tracks?: { componentIndex?: number | null }[], arcs?: { componentIndex?: number | null }[], regions?: { componentIndex?: number | null }[] }} footprintPrimitives
     * @param {{ componentIndex?: number | null }[]} pads
     * @returns {boolean}
     */
    static #hasComponentOwnedFootprintDetail(
        component,
        footprintPrimitives,
        pads
    ) {
        const componentIndex = Number(component?.componentIndex)
        if (!Number.isInteger(componentIndex)) {
            return false
        }

        return [
            ...(footprintPrimitives.tracks || []),
            ...(footprintPrimitives.fills || []),
            ...(footprintPrimitives.arcs || []),
            ...(footprintPrimitives.regions || []),
            ...(pads || [])
        ].some(
            (primitive) => Number(primitive?.componentIndex) === componentIndex
        )
    }

    /**
     * Returns true when one recovered pad surface overlaps a component-local
     * search box, which means the footprint already has concrete 2D items.
     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, rotation?: number, offsetTopX?: number, offsetTopY?: number, holeDiameter?: number }} pad
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #padIntersectsBounds(pad, bounds) {
        const size = PcbSvgRenderer.#resolvePadSurfaceSize(pad)
        const rotationRadians = (Number(pad.rotation || 0) * Math.PI) / 180
        const boxWidth =
            Math.abs(size.width * Math.cos(rotationRadians)) +
            Math.abs(size.height * Math.sin(rotationRadians))
        const boxHeight =
            Math.abs(size.width * Math.sin(rotationRadians)) +
            Math.abs(size.height * Math.cos(rotationRadians))
        const centerX = Number(pad.x || 0) + Number(pad.offsetTopX || 0)
        const centerY = Number(pad.y || 0) + Number(pad.offsetTopY || 0)
        const minX = centerX - boxWidth / 2
        const maxX = centerX + boxWidth / 2
        const minY = centerY - boxHeight / 2
        const maxY = centerY + boxHeight / 2

        return !(
            maxX < bounds.minX ||
            minX > bounds.maxX ||
            maxY < bounds.minY ||
            minY > bounds.maxY
        )
    }

    /**
     * Returns the visible top-layer pad shape code, including rounded-rect
     * overrides from the optional extension block.
     * @param {{ shapeTop?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null }} pad
     * @returns {number}
     */
    static #resolvePadShape(pad) {
        if (pad.hasRoundedRect && Number.isInteger(pad.roundedRectShapeTop)) {
            return Number(pad.roundedRectShapeTop)
        }
        return Number(pad.shapeTop || 0)
    }

    /**
     * Returns the corner radius for one visible pad ring.
     * @param {{ shapeTop?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, cornerRadiusTop?: number | null }} pad
     * @param {{ width: number, height: number }} size
     * @returns {number}
     */
    static #resolvePadCornerRadius(pad, size) {
        if (
            pad.hasRoundedRect &&
            Number.isFinite(pad.cornerRadiusTop) &&
            Number(pad.cornerRadiusTop) > 0
        ) {
            return (
                Math.min(size.width, size.height) *
                (Number(pad.cornerRadiusTop) / 100)
            )
        }

        if (PcbSvgRenderer.#resolvePadShape(pad) === 1) {
            return Math.min(size.width, size.height) / 2
        }

        return 0
    }

    /**
     * Returns true when one pad hole is a round-ended slot.
     * @param {{ holeShape?: number | null, holeSlotLength?: number | null, holeDiameter?: number }} pad
     * @returns {boolean}
     */
    static #isSlotHole(pad) {
        return (
            Number(pad.holeShape) === PcbSvgRenderer.#PAD_HOLE_SHAPE_SLOT &&
            Number(pad.holeSlotLength || 0) > Number(pad.holeDiameter || 0)
        )
    }

    /**
     * Returns true when one track intersects a component-local search box.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} track
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #trackIntersectsBounds(track, bounds) {
        const minX = Math.min(Number(track.x1), Number(track.x2))
        const maxX = Math.max(Number(track.x1), Number(track.x2))
        const minY = Math.min(Number(track.y1), Number(track.y2))
        const maxY = Math.max(Number(track.y1), Number(track.y2))

        return !(
            maxX < bounds.minX ||
            minX > bounds.maxX ||
            maxY < bounds.minY ||
            minY > bounds.maxY
        )
    }

    /**
     * Returns true when one fill intersects a component-local search box.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} fill
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
     * @returns {boolean}
     */
    static #fillIntersectsBounds(fill, bounds) {
        const minX = Math.min(Number(fill.x1), Number(fill.x2))
        const maxX = Math.max(Number(fill.x1), Number(fill.x2))
        const minY = Math.min(Number(fill.y1), Number(fill.y2))
        const maxY = Math.max(Number(fill.y1), Number(fill.y2))

        return !(
            maxX < bounds.minX ||
            minX > bounds.maxX ||
            maxY < bounds.minY ||
            minY > bounds.maxY
        )
    }
}
