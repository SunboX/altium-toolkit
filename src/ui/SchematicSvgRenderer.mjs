// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicJunctionRenderer } from './SchematicJunctionRenderer.mjs'
import { SchematicPortRenderer } from './SchematicPortRenderer.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'
import { SchematicPowerPortRenderer } from './SchematicPowerPortRenderer.mjs'
import { SchematicNoteRenderer } from './SchematicNoteRenderer.mjs'
import { SchematicDirectiveRenderer } from './SchematicDirectiveRenderer.mjs'
import { SchematicShapeRenderer } from './SchematicShapeRenderer.mjs'
import { SchematicPinSvgRenderer } from './SchematicPinSvgRenderer.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'
import { SchematicSheetChromeRenderer } from './SchematicSheetChromeRenderer.mjs'
import { SchematicContentLayout } from './SchematicContentLayout.mjs'
import { SchematicOwnerPinLabelLayout } from './SchematicOwnerPinLabelLayout.mjs'
import { SchematicRegionRenderer } from './SchematicRegionRenderer.mjs'
import { SchematicSheetSymbolRenderer } from './SchematicSheetSymbolRenderer.mjs'
import { SchematicImageRenderer } from './SchematicImageRenderer.mjs'
import { TextGeometrySidecarBuilder } from './TextGeometrySidecarBuilder.mjs'
import { SchematicRenderOpsSidecarBuilder } from './SchematicRenderOpsSidecarBuilder.mjs'
import { SchematicProjectParameterResolver } from '../core/altium/SchematicProjectParameterResolver.mjs'

const { createSvgText, escapeHtml, formatNumber, projectSchematicY } =
    SchematicSvgUtils
const SECTION_HEADING_MIN_FONT_SIZE = 18
const SECTION_HEADING_BASELINE_LIFT_RATIO = 0.36
const SECTION_HEADING_LINE_Y_TOLERANCE = 0.75
const SECTION_HEADING_LINE_X_PADDING = 15

/**
 * Renders normalized schematic models into presentational SVG.
 */
export class SchematicSvgRenderer {
    static #SEMANTIC_SCHEMA = 'altium-toolkit.schematic.svg.semantics.a1'

    /**
     * Renders a normalized schematic model into SVG markup.
     * @param {{ fileName?: string, summary: { title?: string }, schematic?: { sheet: { width: number, height: number, sourceWidth?: number, sourceHeight?: number, paperSize?: string, borderOn?: boolean, titleBlockOn?: boolean, marginWidth?: number, xZones?: number, yZones?: number, titleBlock?: { title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string } }, lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, isBus?: boolean, ownerIndex?: string, renderOrder?: number, recordType?: string }[], polygons?: { points: { x: number, y: number }[], color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string, renderOrder?: number }[], rectangles?: { x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string, renderOrder?: number }[], regions?: { x: number, y: number, width: number, height: number, color: string, fill: string, renderOrder?: number }[], ellipses?: { x: number, y: number, radiusX: number, radiusY: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string, renderOrder?: number }[], arcs?: { x: number, y: number, radius: number, startAngle: number, endAngle: number, color: string, width: number, ownerIndex?: string, renderOrder?: number }[], directives?: { x: number, y: number, color: string, name: string, orientation?: number }[], texts: { x: number, y: number, text: string, color: string, recordType?: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, rotation?: number, sourceOrientation?: number, isMirrored?: boolean, anchor?: 'start' | 'middle' | 'end', powerPortDirection?: 'up' | 'down' | 'left' | 'right', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }[], components: { x: number, y: number, designator: string }[], pins?: { x: number, y: number, length: number, name: string, nameSegments?: { text: string, overline: boolean }[], designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number, color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex?: string }[], ports?: { x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' | 'up' | 'down', shape?: 'single' | 'double' | 'plain' }[], crosses?: { x: number, y: number, size: number, color: string }[] } }} documentModel
     * @param {{ projectParameters?: Record<string, string | number | boolean | null | undefined> }} options Render options.
     * @returns {string}
     */
    static render(documentModel, options = {}) {
        const renderOptions =
            SchematicSvgRenderer.#normalizeRenderOptions(options)
        const renderModel = options.projectParameters
            ? SchematicProjectParameterResolver.applyToDocumentModel(
                  documentModel,
                  options.projectParameters,
                  { replaceText: true }
              )
            : documentModel
        const schematic = renderModel?.schematic
        if (!schematic) {
            return '<section class="altium-renderer-empty">No schematic entities were recovered from this file.</section>'
        }

        const renderedSheet = SchematicSvgRenderer.#resolveRenderedSheet(
            schematic.sheet
        )
        const width = renderedSheet.width
        const height = renderedSheet.height
        const contentHeight = renderedSheet.contentHeight
        const renderedSchematic =
            renderedSheet.contentSheet === schematic.sheet
                ? schematic
                : { ...schematic, sheet: renderedSheet.contentSheet }
        const allTexts = schematic.texts || []
        const lines = (schematic.lines || []).slice(0, 2500)
        const polygons = (schematic.polygons || []).slice(0, 1000)
        const rectangles = (schematic.rectangles || []).slice(0, 500)
        const roundedRectangles = (schematic.roundedRectangles || []).slice(
            0,
            500
        )
        const regions = (schematic.regions || []).slice(0, 250)
        const ellipses = (schematic.ellipses || []).slice(0, 500)
        const arcs = (schematic.arcs || []).slice(0, 1000)
        const beziers = (schematic.beziers || []).slice(0, 500)
        const pies = (schematic.pies || []).slice(0, 500)
        const ieeeSymbols = (schematic.ieeeSymbols || []).slice(0, 500)
        const directives = (schematic.directives || []).slice(0, 250)
        const texts = allTexts
        const components = (schematic.components || []).slice(0, 180)
        const pins = (schematic.pins || []).slice(0, 1000)
        const ports = (schematic.ports || []).slice(0, 250)
        const crosses = (schematic.crosses || []).slice(0, 250)
        const sheetSymbols = (schematic.sheetSymbols || []).slice(0, 250)
        const sheetEntries = (schematic.sheetEntries || []).slice(0, 500)
        const authoredJunctions = (schematic.junctions || []).slice(0, 500)
        const busEntries = (schematic.busEntries || []).slice(0, 500)
        const images = (schematic.images || []).slice(0, 100)
        const semanticContext =
            SchematicSvgRenderer.#buildSemanticContext(schematic)
        const semanticMetadata = SchematicSvgRenderer.#buildSemanticMetadata(
            schematic,
            semanticContext
        )
        const textGeometryMarkup = renderOptions.includeTextGeometrySidecar
            ? SchematicSvgRenderer.#buildTextGeometryMetadataMarkup(
                  texts,
                  semanticContext
              )
            : ''
        const renderOperationsMarkup =
            renderOptions.includeRenderOperationsSidecar
                ? SchematicSvgRenderer.#buildRenderOperationsMetadataMarkup(
                      renderedSchematic,
                      contentHeight,
                      semanticMetadata,
                      renderOptions
                  )
                : ''
        const drawableComponents = components.filter(
            (component) =>
                SchematicSvgRenderer.#isDrawableSchematicComponent(component) &&
                !SchematicTypography.hasNearbyVisibleDesignatorText(
                    component,
                    allTexts
                )
        )
        const frameMarkup = SchematicSvgRenderer.#buildSheetChromeMarkup(
            width,
            height,
            renderedSheet.sheet,
            renderModel?.fileName
        )
        const regionMarkup = SchematicRegionRenderer.buildMarkup(
            regions,
            contentHeight
        )
        const contentTransform = SchematicContentLayout.buildTransform(
            width,
            contentHeight,
            renderedSchematic
        )
        const contentClipId = SchematicContentLayout.buildClipId(
            width,
            height,
            renderedSchematic
        )
        const contentClipMarkup = SchematicContentLayout.buildClipMarkup(
            width,
            height,
            renderedSchematic,
            contentClipId
        )
        const ownerlessLines = lines.filter((line) => !line.ownerIndex)
        const ownerlessPolygons = polygons.filter(
            (polygon) => !polygon.ownerIndex
        )
        const ownerlessRectangles = rectangles.filter(
            (rectangle) => !rectangle.ownerIndex
        )
        const ownerlessRoundedRectangles = roundedRectangles.filter(
            (rectangle) => !rectangle.ownerIndex
        )
        const ownerlessEllipses = ellipses.filter(
            (ellipse) => !ellipse.ownerIndex
        )
        const ownerlessArcs = arcs.filter((arc) => !arc.ownerIndex)
        const ownerlessBeziers = beziers.filter((bezier) => !bezier.ownerIndex)
        const ownerlessPies = pies.filter((pie) => !pie.ownerIndex)
        const ownerlessIeeeSymbols = ieeeSymbols.filter(
            (symbol) => !symbol.ownerIndex
        )
        const resolvedTexts = texts.map((text) =>
            text.recordType === '17'
                ? {
                      ...text,
                      powerPortDirection:
                          SchematicPowerPortRenderer.resolveOutwardDirection(
                              text,
                              lines,
                              pins
                          )
                  }
                : text
        )
        const polygonMarkup = ownerlessPolygons
            .map((polygon, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildPolygonMarkup(
                        polygon,
                        contentHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'polygon',
                        polygon,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'polygons',
                            polygon,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const rectangleMarkup = ownerlessRectangles
            .map((rectangle, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildRectangleMarkup(
                        rectangle,
                        contentHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'rectangle',
                        rectangle,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'rectangles',
                            rectangle,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const roundedRectangleMarkup = ownerlessRoundedRectangles
            .map((rectangle, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildRoundedRectangleMarkup(
                        rectangle,
                        contentHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'rounded-rectangle',
                        rectangle,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'roundedRectangles',
                            rectangle,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const ellipseMarkup = ownerlessEllipses
            .map((ellipse, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildEllipseMarkup(
                        ellipse,
                        contentHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'ellipse',
                        ellipse,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'ellipses',
                            ellipse,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const lineMarkup = ownerlessLines
            .map((line, index) =>
                SchematicSvgRenderer.#buildSchematicLineMarkup(
                    line,
                    contentHeight,
                    SchematicSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'lines',
                        line,
                        index
                    ),
                    semanticContext
                )
            )
            .join('')
        const arcMarkup = ownerlessArcs
            .map((arc, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildArcMarkup(arc, contentHeight),
                    SchematicSvgRenderer.#semanticAttributes(
                        'arc',
                        arc,
                        SchematicSvgRenderer.#primitiveIndex(
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
        const bezierMarkup = ownerlessBeziers
            .map((bezier, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildBezierMarkup(
                        bezier,
                        contentHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'bezier',
                        bezier,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'beziers',
                            bezier,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const pieMarkup = ownerlessPies
            .map((pie, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildPieMarkup(pie, contentHeight),
                    SchematicSvgRenderer.#semanticAttributes(
                        'pie',
                        pie,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'pies',
                            pie,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const ieeeSymbolMarkup = ownerlessIeeeSymbols
            .map((symbol, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildIeeeSymbolMarkup(
                        symbol,
                        contentHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'ieee-symbol',
                        symbol,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'ieeeSymbols',
                            symbol,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const ownerGeometryMarkup =
            SchematicSvgRenderer.#buildOwnerGeometryMarkup(
                lines,
                polygons,
                rectangles,
                roundedRectangles,
                ellipses,
                arcs,
                beziers,
                pies,
                ieeeSymbols,
                contentHeight,
                semanticContext
            )
        const sheetSymbolMarkup =
            SchematicSheetSymbolRenderer.buildSheetSymbolMarkup(
                sheetSymbols,
                contentHeight
            )
        const sheetEntryMarkup =
            SchematicSheetSymbolRenderer.buildSheetEntryMarkup(
                sheetEntries,
                contentHeight
            )
        const busEntryMarkup = busEntries
            .map((busEntry) =>
                SchematicSvgRenderer.#buildSchematicBusEntryMarkup(
                    busEntry,
                    contentHeight
                )
            )
            .join('')
        const resolvedAuthoredJunctions =
            SchematicSvgRenderer.#resolveAuthoredSchematicJunctions(
                authoredJunctions,
                lines
            )
        const authoredJunctionMarkup = resolvedAuthoredJunctions
            .map((junction) =>
                SchematicSvgRenderer.#buildAuthoredSchematicJunctionMarkup(
                    junction,
                    contentHeight
                )
            )
            .join('')
        const imageMarkup = SchematicImageRenderer.buildMarkup(
            images,
            contentHeight
        )
        const markerDefsMarkup =
            SchematicSvgRenderer.#buildSchematicLineMarkerDefs(lines)

        const textMarkup = resolvedTexts
            .map((text, index) =>
                SchematicSvgRenderer.#buildSchematicTextMarkup(
                    text,
                    contentHeight,
                    lines,
                    pins,
                    SchematicSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'texts',
                        text,
                        index
                    ),
                    semanticContext
                )
            )
            .join('')

        const componentMarkup = drawableComponents
            .map((component, index) =>
                SchematicSvgRenderer.#buildFallbackComponentMarkup(
                    component,
                    contentHeight,
                    renderedSheet.contentSheet,
                    SchematicSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'components',
                        component,
                        index
                    ),
                    semanticContext
                )
            )
            .join('')

        const rotatedVerticalNumberOwners =
            SchematicTypography.collectRotatedVerticalNumberOwners(pins)
        const explicitOwnerPinNameLabels =
            SchematicTypography.collectExplicitOwnerPinNameLabels(texts)
        const explicitOwnerPinLabelOffsets =
            SchematicOwnerPinLabelLayout.collectExplicitOwnerPinLabelOffsets(
                texts,
                pins
            )
        const pinMarkup = pins
            .map((pin, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicPinSvgRenderer.buildMarkup(
                        pin,
                        contentHeight,
                        renderedSheet.contentSheet,
                        rotatedVerticalNumberOwners,
                        explicitOwnerPinNameLabels,
                        explicitOwnerPinLabelOffsets
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'pin',
                        pin,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'pins',
                            pin,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const portMarkup = SchematicPortRenderer.buildMarkup(
            ports,
            contentHeight,
            renderedSheet.contentSheet
        )
        const directiveMarkup = directives
            .map((directive, index) =>
                SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicDirectiveRenderer.buildMarkup(
                        [directive],
                        contentHeight,
                        renderedSheet.contentSheet
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'directive',
                        directive,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'directives',
                            directive,
                            index
                        ),
                        semanticContext
                    )
                )
            )
            .join('')
        const junctionMarkup = SchematicJunctionRenderer.buildMarkup(
            lines,
            crosses,
            ports,
            resolvedTexts.filter((text) => text.recordType === '17'),
            contentHeight,
            resolvedAuthoredJunctions
        )
        const crossMarkup = crosses
            .map((cross) =>
                SchematicSvgRenderer.#buildSchematicCrossMarkup(
                    cross,
                    contentHeight
                )
            )
            .join('')

        return (
            '<section class="svg-panel">' +
            '<header class="svg-panel__header"><h3>' +
            escapeHtml(renderModel?.summary?.title || 'Schematic') +
            '</h3><p>' +
            lines.length +
            ' line segments, ' +
            components.length +
            ' components</p></header>' +
            '<svg class="schematic-svg"' +
            SchematicSvgRenderer.#renderRootViewBoxAttributes(
                renderOptions,
                '0 0 ' + formatNumber(width) + ' ' + formatNumber(height)
            ) +
            ' preserveAspectRatio="xMidYMid meet" aria-label="Schematic view" data-semantic-schema="' +
            SchematicSvgRenderer.#SEMANTIC_SCHEMA +
            '"' +
            SchematicSvgRenderer.#renderDataAttributes({
                'data-doc-id': renderOptions.documentId,
                'data-doc-ver': renderOptions.documentVersion
            }) +
            '>' +
            '<rect class="sheet-backdrop" x="0" y="0" width="' +
            formatNumber(width) +
            '" height="' +
            formatNumber(height) +
            '" rx="18" />' +
            contentClipMarkup +
            '<metadata id="schematic-semantic-metadata" data-schema="' +
            SchematicSvgRenderer.#SEMANTIC_SCHEMA +
            '">' +
            escapeHtml(JSON.stringify(semanticMetadata)) +
            '</metadata>' +
            textGeometryMarkup +
            renderOperationsMarkup +
            markerDefsMarkup +
            '<g class="schematic-content"' +
            ' clip-path="url(#' +
            escapeHtml(contentClipId) +
            ')"' +
            contentTransform +
            '>' +
            '<g class="schematic-polygons">' +
            polygonMarkup +
            '</g>' +
            '<g class="schematic-rectangles">' +
            rectangleMarkup +
            roundedRectangleMarkup +
            '</g>' +
            '<g class="schematic-ellipses">' +
            ellipseMarkup +
            '</g>' +
            '<g class="schematic-lines" stroke-linecap="round">' +
            lineMarkup +
            '</g>' +
            '<g class="schematic-arcs" stroke-linecap="round">' +
            arcMarkup +
            '</g>' +
            '<g class="schematic-beziers" stroke-linecap="round">' +
            bezierMarkup +
            '</g>' +
            '<g class="schematic-pies">' +
            pieMarkup +
            '</g>' +
            '<g class="schematic-ieee-symbols">' +
            ieeeSymbolMarkup +
            '</g>' +
            '<g class="schematic-owner-geometry" stroke-linecap="round">' +
            ownerGeometryMarkup +
            '</g>' +
            '<g class="schematic-sheet-symbols">' +
            sheetSymbolMarkup +
            '</g>' +
            '<g class="schematic-bus-entries" stroke-linecap="round">' +
            busEntryMarkup +
            '</g>' +
            '<g class="schematic-images">' +
            imageMarkup +
            '</g>' +
            '<g class="schematic-pins" stroke-linecap="round">' +
            pinMarkup +
            '</g>' +
            '<g class="schematic-ports">' +
            portMarkup +
            '</g>' +
            '<g class="schematic-directives">' +
            directiveMarkup +
            '</g>' +
            '<g class="schematic-crosses" stroke-linecap="round">' +
            crossMarkup +
            '</g>' +
            '<g class="schematic-components">' +
            componentMarkup +
            '</g>' +
            '<g class="schematic-sheet-entries">' +
            sheetEntryMarkup +
            '</g>' +
            '<g class="schematic-texts">' +
            textMarkup +
            '</g>' +
            '<g class="schematic-junctions">' +
            authoredJunctionMarkup +
            junctionMarkup +
            '</g>' +
            '</g>' +
            frameMarkup +
            '<g class="schematic-regions">' +
            regionMarkup +
            '</g>' +
            '</svg></section>'
        )
    }

    /**
     * Normalizes schematic SVG export options.
     * @param {Record<string, unknown>} options Raw render options.
     * @returns {{ includeViewBox: boolean, documentId: string, documentVersion: string, includeTextGeometrySidecar: boolean, includeRenderOperationsSidecar: boolean, renderOperationProfile: string }}
     */
    static #normalizeRenderOptions(options) {
        const includeViewBox =
            options?.includeViewBox ?? options?.include_view_box

        return {
            includeViewBox: includeViewBox === false ? false : true,
            documentId: String(options?.documentId || options?.docId || ''),
            documentVersion: String(
                options?.documentVersion || options?.documentVer || ''
            ),
            includeTextGeometrySidecar:
                options?.includeTextGeometrySidecar === true ||
                options?.textGeometry === 'sidecar',
            includeRenderOperationsSidecar:
                options?.includeRenderOperationsSidecar === true ||
                options?.renderOperations === 'sidecar',
            renderOperationProfile: String(
                options?.renderOperationProfile || 'default'
            )
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
            ? ' viewBox="' + escapeHtml(viewBox) + '"'
            : ''
    }

    /**
     * Builds optional text geometry metadata markup.
     * @param {object[]} texts Text rows.
     * @param {object} semanticContext Semantic context.
     * @returns {string}
     */
    static #buildTextGeometryMetadataMarkup(texts, semanticContext) {
        const metadata = TextGeometrySidecarBuilder.buildSchematic(
            texts,
            semanticContext.primitiveIndexes?.texts
        )

        return (
            '<metadata id="schematic-text-geometry" data-schema="' +
            TextGeometrySidecarBuilder.SCHEMA_ID +
            '">' +
            escapeHtml(JSON.stringify(metadata)) +
            '</metadata>'
        )
    }

    /**
     * Builds optional render-operation metadata markup.
     * @param {object} schematic Rendered schematic model.
     * @param {number} contentHeight Render content height.
     * @param {object} semanticMetadata Semantic metadata.
     * @param {object} renderOptions Normalized render options.
     * @returns {string}
     */
    static #buildRenderOperationsMetadataMarkup(
        schematic,
        contentHeight,
        semanticMetadata,
        renderOptions
    ) {
        const metadata = SchematicRenderOpsSidecarBuilder.build(schematic, {
            contentHeight,
            semanticMetadata,
            profile: renderOptions.renderOperationProfile
        })

        return (
            '<metadata id="schematic-render-operations" data-schema="' +
            SchematicRenderOpsSidecarBuilder.SCHEMA_ID +
            '">' +
            escapeHtml(JSON.stringify(metadata)) +
            '</metadata>'
        )
    }

    /**
     * Builds reusable SVG marker definitions for authored line endpoints.
     * @param {{ startMarker?: object, endMarker?: object }[]} lines Drawable lines.
     * @returns {string}
     */
    static #buildSchematicLineMarkerDefs(lines) {
        const markers = SchematicSvgRenderer.#collectSchematicLineMarkers(lines)

        if (!markers.length) {
            return ''
        }

        return (
            '<defs class="schematic-line-marker-defs">' +
            markers
                .map((marker) =>
                    SchematicSvgRenderer.#buildSchematicLineMarkerDef(marker)
                )
                .join('') +
            '</defs>'
        )
    }

    /**
     * Collects unique endpoint markers in stable order.
     * @param {{ startMarker?: object, endMarker?: object }[]} lines Drawable lines.
     * @returns {object[]}
     */
    static #collectSchematicLineMarkers(lines) {
        const seen = new Set()
        const markers = []

        for (const line of lines || []) {
            for (const marker of [line.startMarker, line.endMarker]) {
                if (!marker) {
                    continue
                }

                const id = SchematicSvgRenderer.#schematicLineMarkerId(marker)
                if (seen.has(id)) {
                    continue
                }

                seen.add(id)
                markers.push(marker)
            }
        }

        return markers
    }

    /**
     * Builds one SVG marker definition.
     * @param {{ shapeName?: string, size?: number }} marker Marker metadata.
     * @returns {string}
     */
    static #buildSchematicLineMarkerDef(marker) {
        const id = SchematicSvgRenderer.#schematicLineMarkerId(marker)
        const shapeName = String(marker?.shapeName || '')
        const fill =
            shapeName === 'filled-arrow' || shapeName === 'square'
                ? 'context-stroke'
                : 'none'
        const shape =
            shapeName === 'circle'
                ? '<circle cx="5" cy="5" r="3.2" fill="none" stroke="context-stroke" stroke-width="1.4" />'
                : shapeName === 'square'
                  ? '<rect x="2" y="2" width="6" height="6" fill="context-stroke" stroke="context-stroke" stroke-width="1" />'
                  : '<path d="M 1 1 L 9 5 L 1 9" fill="' +
                    fill +
                    '" stroke="context-stroke" stroke-width="1.4" stroke-linejoin="round" />'

        return (
            '<marker id="' +
            escapeHtml(id) +
            '" viewBox="0 0 10 10" markerWidth="' +
            formatNumber(Math.max(Number(marker?.size || 6), 1)) +
            '" markerHeight="' +
            formatNumber(Math.max(Number(marker?.size || 6), 1)) +
            '" refX="5" refY="5" orient="auto-start-reverse">' +
            shape +
            '</marker>'
        )
    }

    /**
     * Builds a deterministic marker id from normalized marker metadata.
     * @param {{ shapeName?: string, size?: number }} marker Marker metadata.
     * @returns {string}
     */
    static #schematicLineMarkerId(marker) {
        return (
            'schematic-marker-' +
            String(marker?.shapeName || 'marker')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/gu, '-') +
            '-' +
            formatNumber(Math.max(Number(marker?.size || 6), 1)).replace(
                /\./gu,
                '-'
            )
        )
    }

    /**
     * Builds reusable semantic lookup data for one schematic render.
     * @param {object} schematic Normalized schematic model.
     * @returns {object}
     */
    static #buildSemanticContext(schematic) {
        const components = schematic?.components || []
        const componentsByOwnerIndex = new Map()
        const componentsByDesignator = new Map()

        for (const component of components) {
            const ownerKey = String(component?.ownerIndex || '').trim()
            if (ownerKey) {
                componentsByOwnerIndex.set(ownerKey, component)
            }
            if (component?.designator) {
                componentsByDesignator.set(component.designator, component)
            }
        }

        const netByPrimitive = new Map()
        for (const net of schematic?.nets || []) {
            for (const segment of net.segments || []) {
                netByPrimitive.set(segment, net)
            }
            for (const label of net.labels || []) {
                netByPrimitive.set(label, net)
            }
            for (const powerPort of net.powerPorts || []) {
                netByPrimitive.set(powerPort, net)
            }
            for (const pin of net.pins || []) {
                netByPrimitive.set(pin, net)
            }
            for (const port of net.ports || []) {
                netByPrimitive.set(port, net)
            }
            for (const sheetEntry of net.sheetEntries || []) {
                netByPrimitive.set(sheetEntry, net)
            }
        }

        return {
            componentsByOwnerIndex,
            componentsByDesignator,
            netByPrimitive,
            primitiveIndexes: {
                lines: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.lines || []
                ),
                polygons: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.polygons || []
                ),
                rectangles: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.rectangles || []
                ),
                roundedRectangles: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.roundedRectangles || []
                ),
                ellipses: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.ellipses || []
                ),
                arcs: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.arcs || []
                ),
                beziers: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.beziers || []
                ),
                pies: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.pies || []
                ),
                ieeeSymbols: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.ieeeSymbols || []
                ),
                directives: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.directives || []
                ),
                texts: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.texts || []
                ),
                pins: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.pins || []
                ),
                ports: SchematicSvgRenderer.#objectIndexMap(
                    schematic?.ports || []
                ),
                components: SchematicSvgRenderer.#objectIndexMap(components)
            }
        }
    }

    /**
     * Builds a compact JSON sidecar describing schematic SVG semantic links.
     * @param {object} schematic Normalized schematic model.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {{ schema: string, nets: object[], components: object[] }}
     */
    static #buildSemanticMetadata(schematic, semanticContext) {
        return {
            schema: SchematicSvgRenderer.#SEMANTIC_SCHEMA,
            elements: SchematicSvgRenderer.#buildElementMetadata(
                schematic,
                semanticContext
            ),
            nets: (schematic?.nets || []).map((net) =>
                SchematicSvgRenderer.#buildNetMetadata(net, semanticContext)
            ),
            components: (schematic?.components || []).map((component) =>
                SchematicSvgRenderer.#buildComponentMetadata(
                    component,
                    schematic,
                    semanticContext
                )
            )
        }
    }

    /**
     * Builds one flat element sidecar for every source-addressable schematic
     * primitive family that can participate in SVG review tooling.
     * @param {object} schematic Normalized schematic model.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object[]}
     */
    static #buildElementMetadata(schematic, semanticContext) {
        return [
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.lines || [],
                'lines',
                'line',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.polygons || [],
                'polygons',
                'polygon',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.rectangles || [],
                'rectangles',
                'rectangle',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.roundedRectangles || [],
                'roundedRectangles',
                'rounded-rectangle',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.ellipses || [],
                'ellipses',
                'ellipse',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.arcs || [],
                'arcs',
                'arc',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.beziers || [],
                'beziers',
                'bezier',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.pies || [],
                'pies',
                'pie',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.ieeeSymbols || [],
                'ieeeSymbols',
                'ieee-symbol',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.texts || [],
                'texts',
                'text',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.components || [],
                'components',
                'component',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.pins || [],
                'pins',
                'pin',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.ports || [],
                'ports',
                'port',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementMetadataForCollection(
                schematic?.directives || [],
                'directives',
                'directive',
                semanticContext
            )
        ]
    }

    /**
     * Builds semantic metadata entries for one primitive collection.
     * @param {object[]} records Primitive records.
     * @param {string} collectionKey Collection key.
     * @param {string} primitiveKind Primitive kind.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object[]}
     */
    static #elementMetadataForCollection(
        records,
        collectionKey,
        primitiveKind,
        semanticContext
    ) {
        return (records || []).map((record, fallbackIndex) => {
            const index = SchematicSvgRenderer.#primitiveIndex(
                semanticContext,
                collectionKey,
                record,
                fallbackIndex
            )
            const component =
                SchematicSvgRenderer.#componentForSchematicPrimitive(
                    primitiveKind,
                    record,
                    semanticContext
                )
            const net = semanticContext.netByPrimitive.get(record)

            return SchematicSvgRenderer.#stripEmptySemanticObject({
                elementKey:
                    'schematic-' +
                    SchematicSvgRenderer.#elementKeyPrimitiveKind(
                        primitiveKind,
                        record
                    ) +
                    '-' +
                    index,
                primitive: SchematicSvgRenderer.#metadataPrimitiveKind(
                    primitiveKind,
                    record
                ),
                recordId: SchematicSvgRenderer.#recordId(
                    primitiveKind,
                    record,
                    index
                ),
                component: component?.designator,
                componentUniqueId: component?.uniqueId,
                net: net?.name,
                pin:
                    primitiveKind === 'pin'
                        ? SchematicSvgRenderer.#pinLabel(record)
                        : undefined
            })
        })
    }

    /**
     * Builds metadata for one schematic net.
     * @param {object} net Net record.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object}
     */
    static #buildNetMetadata(net, semanticContext) {
        const pins = []
        const components = []
        const elementKeys = [
            ...SchematicSvgRenderer.#elementKeysForObjects(
                net.segments || [],
                'lines',
                'line',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementKeysForObjects(
                [...(net.labels || []), ...(net.powerPorts || [])],
                'texts',
                'text',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementKeysForObjects(
                net.pins || [],
                'pins',
                'pin',
                semanticContext
            ),
            ...SchematicSvgRenderer.#elementKeysForObjects(
                net.ports || [],
                'ports',
                'port',
                semanticContext
            )
        ]

        for (const pin of net.pins || []) {
            const component =
                SchematicSvgRenderer.#componentForSchematicPrimitive(
                    'pin',
                    pin,
                    semanticContext
                )
            if (component?.designator) {
                components.push(component.designator)
                pins.push(
                    component.designator +
                        ':' +
                        SchematicSvgRenderer.#pinLabel(pin)
                )
                continue
            }
            const pinLabel = SchematicSvgRenderer.#pinLabel(pin)
            if (pinLabel) {
                pins.push(pinLabel)
            }
        }

        return SchematicSvgRenderer.#stripEmptySemanticObject({
            name: net.name,
            elementKeys: SchematicSvgRenderer.#dedupe(elementKeys),
            components: SchematicSvgRenderer.#dedupe(components),
            pins: SchematicSvgRenderer.#dedupe(pins)
        })
    }

    /**
     * Builds metadata for one schematic component.
     * @param {object} component Component record.
     * @param {object} schematic Normalized schematic model.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object}
     */
    static #buildComponentMetadata(component, schematic, semanticContext) {
        const componentIndex = SchematicSvgRenderer.#primitiveIndex(
            semanticContext,
            'components',
            component,
            0
        )
        const pins = (schematic?.pins || []).filter(
            (pin) =>
                SchematicSvgRenderer.#componentForSchematicPrimitive(
                    'pin',
                    pin,
                    semanticContext
                ) === component
        )
        const nets = pins
            .map((pin) => semanticContext.netByPrimitive.get(pin)?.name)
            .filter(Boolean)
        const pinLabels = pins
            .map((pin) => SchematicSvgRenderer.#pinLabel(pin))
            .filter(Boolean)
        const elementKeys = [
            'schematic-component-' + componentIndex,
            ...SchematicSvgRenderer.#elementKeysForObjects(
                pins,
                'pins',
                'pin',
                semanticContext
            )
        ]

        return SchematicSvgRenderer.#stripEmptySemanticObject({
            designator: component.designator,
            uniqueId: component.uniqueId,
            elementKeys: SchematicSvgRenderer.#dedupe(elementKeys),
            pins: SchematicSvgRenderer.#dedupe(pinLabels),
            nets: SchematicSvgRenderer.#dedupe(nets)
        })
    }

    /**
     * Builds SVG data attributes for one schematic primitive.
     * @param {string} primitiveKind Public primitive kind.
     * @param {object} primitive Primitive record.
     * @param {number} index Stable primitive index.
     * @param {object | undefined} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #semanticAttributes(
        primitiveKind,
        primitive,
        index,
        semanticContext
    ) {
        if (!semanticContext) {
            return ''
        }

        if (!SchematicSvgRenderer.#hasExplicitRecordId(primitive)) {
            return ''
        }

        const component = SchematicSvgRenderer.#componentForSchematicPrimitive(
            primitiveKind,
            primitive,
            semanticContext
        )
        const net = semanticContext.netByPrimitive.get(primitive)

        return SchematicSvgRenderer.#renderDataAttributes({
            'data-primitive': primitiveKind,
            'data-element-key': 'schematic-' + primitiveKind + '-' + index,
            'data-record-id': SchematicSvgRenderer.#recordId(
                primitiveKind,
                primitive,
                index
            ),
            'data-component': component?.designator,
            'data-component-unique-id': component?.uniqueId,
            'data-net': net?.name,
            'data-pin':
                primitiveKind === 'pin'
                    ? SchematicSvgRenderer.#pinLabel(primitive)
                    : undefined
        })
    }

    /**
     * Finds the component associated with a schematic primitive.
     * @param {string} primitiveKind Public primitive kind.
     * @param {object} primitive Primitive record.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {object | null}
     */
    static #componentForSchematicPrimitive(
        primitiveKind,
        primitive,
        semanticContext
    ) {
        if (primitiveKind === 'component') {
            return primitive
        }

        const explicitDesignator =
            primitive?.componentDesignator || primitive?.component || ''
        if (explicitDesignator) {
            return (
                semanticContext.componentsByDesignator.get(
                    explicitDesignator
                ) || null
            )
        }

        const ownerIndex = String(primitive?.ownerIndex || '').trim()
        return ownerIndex
            ? semanticContext.componentsByOwnerIndex.get(ownerIndex) || null
            : null
    }

    /**
     * Returns element keys for a primitive object list.
     * @param {object[]} records Primitive records.
     * @param {string} collectionKey Primitive collection key.
     * @param {string} primitiveKind Public primitive kind.
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string[]}
     */
    static #elementKeysForObjects(
        records,
        collectionKey,
        primitiveKind,
        semanticContext
    ) {
        return (records || [])
            .map((record) => {
                const index =
                    semanticContext.primitiveIndexes?.[collectionKey]?.get(
                        record
                    )
                return Number.isInteger(index)
                    ? 'schematic-' + primitiveKind + '-' + index
                    : ''
            })
            .filter(Boolean)
    }

    /**
     * Returns a stable primitive index from the original schematic collection.
     * @param {object} semanticContext Semantic lookup context.
     * @param {string} collectionKey Primitive collection key.
     * @param {object} primitive Primitive record.
     * @param {number} fallbackIndex Rendered fallback index.
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
     * Builds an object identity map for stable primitive indexes.
     * @param {object[]} records Primitive records.
     * @returns {Map<object, number>}
     */
    static #objectIndexMap(records) {
        return new Map((records || []).map((record, index) => [record, index]))
    }

    /**
     * Inserts generated attributes into the first SVG element in a markup
     * fragment.
     * @param {string} markup SVG markup.
     * @param {string} attributes Rendered attributes.
     * @returns {string}
     */
    static #appendSvgAttributes(markup, attributes) {
        if (!markup || !attributes) {
            return markup || ''
        }

        return String(markup).replace(/(\s*\/?>)/u, attributes + '$1')
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
                return ' ' + name + '="' + escapeHtml(renderedValue) + '"'
            })
            .join('')
    }

    /**
     * Returns a stable source record id when present, else a renderer key.
     * @param {string} primitiveKind Public primitive kind.
     * @param {object} primitive Primitive record.
     * @param {number} index Stable primitive index.
     * @returns {string}
     */
    static #recordId(primitiveKind, primitive, index) {
        const candidate =
            primitive?.recordId ??
            primitive?.sourceRecordId ??
            primitive?.sourceRecordIndex

        return candidate === null || candidate === undefined || candidate === ''
            ? 'schematic-' + primitiveKind + '-' + index
            : String(candidate)
    }

    /**
     * Resolves the primitive token used by SVG element keys.
     * @param {string} primitiveKind Public primitive kind.
     * @param {object} primitive Primitive record.
     * @returns {string}
     */
    static #elementKeyPrimitiveKind(primitiveKind, primitive) {
        if (primitiveKind === 'text' && primitive?.recordType === '28') {
            return 'text'
        }

        return primitiveKind
    }

    /**
     * Resolves the primitive token used by semantic metadata.
     * @param {string} primitiveKind Public primitive kind.
     * @param {object} primitive Primitive record.
     * @returns {string}
     */
    static #metadataPrimitiveKind(primitiveKind, primitive) {
        if (primitiveKind === 'text' && primitive?.recordType === '28') {
            return 'text-frame'
        }

        return primitiveKind
    }

    /**
     * Returns true when a primitive carries source record identity.
     * @param {object} primitive Primitive record.
     * @returns {boolean}
     */
    static #hasExplicitRecordId(primitive) {
        return (
            (primitive?.recordId !== null &&
                primitive?.recordId !== undefined &&
                primitive?.recordId !== '') ||
            (primitive?.sourceRecordId !== null &&
                primitive?.sourceRecordId !== undefined &&
                primitive?.sourceRecordId !== '') ||
            (primitive?.sourceRecordIndex !== null &&
                primitive?.sourceRecordIndex !== undefined &&
                primitive?.sourceRecordIndex !== '')
        )
    }

    /**
     * Returns a displayable pin designator.
     * @param {object} pin Pin record.
     * @returns {string}
     */
    static #pinLabel(pin) {
        return String(pin?.designator || pin?.pinNumber || pin?.name || '')
    }

    /**
     * Deduplicates values while preserving insertion order.
     * @param {unknown[]} values Candidate values.
     * @returns {unknown[]}
     */
    static #dedupe(values) {
        return [...new Set((values || []).filter(Boolean))]
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
     * Resolves the rendered dimensions and sheet metadata used by SVG output.
     * @param {{ width?: number, height?: number, sourceWidth?: number, sourceHeight?: number, marginWidth?: number, paperSize?: string, borderOn?: boolean } | undefined} sheet
     * @returns {{ width: number, height: number, contentHeight: number, sheet: object, contentSheet: object }}
     */
    static #resolveRenderedSheet(sheet) {
        const width = Math.max(Number(sheet?.width || 1000), 100)
        const height = Math.max(Number(sheet?.height || 700), 100)
        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        const renderedHeight = SchematicSvgRenderer.#resolveRenderedSheetHeight(
            sheet,
            width,
            height,
            margin
        )

        if (renderedHeight === height) {
            return {
                width,
                height,
                contentHeight: height,
                sheet: sheet || {},
                contentSheet: sheet || {}
            }
        }
        const contentHeight = renderedHeight - margin

        return {
            width,
            height: renderedHeight,
            contentHeight,
            sheet: {
                ...(sheet || {}),
                width,
                height: renderedHeight,
                sourceWidth: width,
                sourceHeight: renderedHeight
            },
            contentSheet: {
                ...(sheet || {}),
                width,
                height: contentHeight,
                sourceWidth: width,
                sourceHeight: contentHeight
            }
        }
    }

    /**
     * Adds top and bottom zone bands for preserved custom border sheets whose
     * stored Y extent describes the inner drawing frame.
     * @param {{ width?: number, height?: number, sourceWidth?: number, sourceHeight?: number, marginWidth?: number, paperSize?: string, borderOn?: boolean } | undefined} sheet
     * @param {number} width
     * @param {number} height
     * @param {number} margin
     * @returns {number}
     */
    static #resolveRenderedSheetHeight(sheet, width, height, margin) {
        const sourceWidth = Number(sheet?.sourceWidth || 0)
        const sourceHeight = Number(sheet?.sourceHeight || 0)

        if (
            !sheet?.borderOn ||
            sheet?.paperSize ||
            width !== sourceWidth ||
            height !== sourceHeight ||
            height <= margin * 2
        ) {
            return height
        }

        return height + margin * 2
    }

    /**
     * Builds interleaved owner geometry so symbol-internal primitives preserve
     * their recovered Altium paint order instead of batching fills ahead of all
     * linework.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, renderOrder?: number }[]} lines
     * @param {{ points: { x: number, y: number }[], ownerIndex?: string, renderOrder?: number }[]} polygons
     * @param {{ x: number, y: number, width: number, height: number, ownerIndex?: string, renderOrder?: number }[]} rectangles
     * @param {{ x: number, y: number, width: number, height: number, ownerIndex?: string, renderOrder?: number }[]} roundedRectangles
     * @param {{ x: number, y: number, radiusX: number, radiusY: number, ownerIndex?: string, renderOrder?: number }[]} ellipses
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, ownerIndex?: string, renderOrder?: number }[]} arcs
     * @param {{ segments: object[], ownerIndex?: string, renderOrder?: number }[]} beziers
     * @param {{ x: number, y: number, radius: number, radiusY?: number, startAngle: number, endAngle: number, ownerIndex?: string, renderOrder?: number }[]} pies
     * @param {{ x: number, y: number, symbolName?: string, ownerIndex?: string, renderOrder?: number }[]} ieeeSymbols
     * @param {number} sheetHeight
     * @param {object} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #buildOwnerGeometryMarkup(
        lines,
        polygons,
        rectangles,
        roundedRectangles,
        ellipses,
        arcs,
        beziers,
        pies,
        ieeeSymbols,
        sheetHeight,
        semanticContext
    ) {
        const items = []

        for (const [index, polygon] of polygons.entries()) {
            if (!polygon.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(polygon),
                typeOrder: 0,
                markup: SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildPolygonMarkup(
                        polygon,
                        sheetHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'polygon',
                        polygon,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'polygons',
                            polygon,
                            index
                        ),
                        semanticContext
                    )
                )
            })
        }

        for (const [index, rectangle] of rectangles.entries()) {
            if (!rectangle.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(
                        rectangle
                    ),
                typeOrder: 1,
                markup: SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildRectangleMarkup(
                        rectangle,
                        sheetHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'rectangle',
                        rectangle,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'rectangles',
                            rectangle,
                            index
                        ),
                        semanticContext
                    )
                )
            })
        }

        for (const [index, rectangle] of roundedRectangles.entries()) {
            if (!rectangle.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(
                        rectangle
                    ),
                typeOrder: 1.5,
                markup: SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildRoundedRectangleMarkup(
                        rectangle,
                        sheetHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'rounded-rectangle',
                        rectangle,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'roundedRectangles',
                            rectangle,
                            index
                        ),
                        semanticContext
                    )
                )
            })
        }

        for (const [index, ellipse] of ellipses.entries()) {
            if (!ellipse.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(ellipse),
                typeOrder: 2,
                markup: SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildEllipseMarkup(
                        ellipse,
                        sheetHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'ellipse',
                        ellipse,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'ellipses',
                            ellipse,
                            index
                        ),
                        semanticContext
                    )
                )
            })
        }

        for (const [index, line] of lines.entries()) {
            if (!line.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(line),
                typeOrder: 3,
                markup: SchematicSvgRenderer.#buildSchematicLineMarkup(
                    line,
                    sheetHeight,
                    SchematicSvgRenderer.#primitiveIndex(
                        semanticContext,
                        'lines',
                        line,
                        index
                    ),
                    semanticContext
                )
            })
        }

        for (const [index, arc] of arcs.entries()) {
            if (!arc.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(arc),
                typeOrder: 4,
                markup: SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildArcMarkup(arc, sheetHeight),
                    SchematicSvgRenderer.#semanticAttributes(
                        'arc',
                        arc,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'arcs',
                            arc,
                            index
                        ),
                        semanticContext
                    )
                )
            })
        }

        for (const [index, bezier] of beziers.entries()) {
            if (!bezier.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(bezier),
                typeOrder: 5,
                markup: SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildBezierMarkup(
                        bezier,
                        sheetHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'bezier',
                        bezier,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'beziers',
                            bezier,
                            index
                        ),
                        semanticContext
                    )
                )
            })
        }

        for (const [index, pie] of pies.entries()) {
            if (!pie.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(pie),
                typeOrder: 6,
                markup: SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildPieMarkup(pie, sheetHeight),
                    SchematicSvgRenderer.#semanticAttributes(
                        'pie',
                        pie,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'pies',
                            pie,
                            index
                        ),
                        semanticContext
                    )
                )
            })
        }

        for (const [index, symbol] of ieeeSymbols.entries()) {
            if (!symbol.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(symbol),
                typeOrder: 7,
                markup: SchematicSvgRenderer.#appendSvgAttributes(
                    SchematicShapeRenderer.buildIeeeSymbolMarkup(
                        symbol,
                        sheetHeight
                    ),
                    SchematicSvgRenderer.#semanticAttributes(
                        'ieee-symbol',
                        symbol,
                        SchematicSvgRenderer.#primitiveIndex(
                            semanticContext,
                            'ieeeSymbols',
                            symbol,
                            index
                        ),
                        semanticContext
                    )
                )
            })
        }

        return items
            .sort((left, right) => {
                const renderDelta = left.renderOrder - right.renderOrder

                if (renderDelta !== 0) {
                    return renderDelta
                }

                return left.typeOrder - right.typeOrder
            })
            .map((item) => item.markup)
            .join('')
    }

    /**
     * Resolves one sortable render-order value for an already-normalized
     * schematic primitive.
     * @param {{ renderOrder?: number }} primitive
     * @returns {number}
     */
    static #resolvePrimitiveRenderOrder(primitive) {
        const renderOrder = Number(primitive?.renderOrder)

        if (Number.isFinite(renderOrder)) {
            return renderOrder
        }

        return Number.MAX_SAFE_INTEGER
    }

    /**
     * Builds one schematic line segment, preserving dashed line styles when
     * the source primitive requests them.
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, isBus?: boolean, recordType?: string }} line
     * @param {number} sheetHeight
     * @param {number} index Stable primitive index.
     * @param {object | undefined} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #buildSchematicLineMarkup(
        line,
        sheetHeight,
        index = 0,
        semanticContext = undefined
    ) {
        return (
            '<line x1="' +
            formatNumber(line.x1) +
            '" y1="' +
            formatNumber(projectSchematicY(sheetHeight, line.y1)) +
            '" x2="' +
            formatNumber(line.x2) +
            '" y2="' +
            formatNumber(projectSchematicY(sheetHeight, line.y2)) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    line.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(
                SchematicSvgRenderer.#resolveSchematicLineWidth(line)
            ) +
            '"' +
            SchematicSvgRenderer.#buildSchematicLineStyleAttributes(line) +
            SchematicSvgRenderer.#buildSchematicLineMarkerAttributes(line) +
            SchematicSvgRenderer.#semanticAttributes(
                'line',
                line,
                index,
                semanticContext
            ) +
            ' />'
        )
    }

    /**
     * Resolves the visible SVG stroke width for one schematic line primitive.
     * @param {{ width: number, isBus?: boolean }} line
     * @returns {number}
     */
    static #resolveSchematicLineWidth(line) {
        const baseWidth = Math.max(Number(line.width || 0), 0.8)
        if (line.isBus !== true) {
            return baseWidth
        }
        return Math.max(baseWidth * 3, 3)
    }

    /**
     * Returns SVG stroke attributes for one schematic line style.
     * @param {{ width: number, lineStyle?: number }} line
     * @returns {string}
     */
    static #buildSchematicLineStyleAttributes(line) {
        const lineStyle = Number(line.lineStyle || 0)
        if (lineStyle !== 1 && lineStyle !== 2 && lineStyle !== 3) return ''

        const dashLength = Math.max(Number(line.width || 1) * 8, 8)
        const gapLength = Math.max(Number(line.width || 1) * 5, 5)
        const dotLength = Math.max(Number(line.width || 1) * 1.5, 1.5)
        const dashPattern =
            lineStyle === 1
                ? [dashLength, gapLength]
                : lineStyle === 2
                  ? [dotLength, gapLength]
                  : [dashLength, gapLength, dotLength, gapLength]

        return (
            ' stroke-dasharray="' +
            dashPattern.map((part) => formatNumber(part)).join(' ') +
            '" stroke-linecap="round"'
        )
    }

    /**
     * Builds SVG marker attributes for one schematic line.
     * @param {{ startMarker?: object, endMarker?: object }} line Line primitive.
     * @returns {string}
     */
    static #buildSchematicLineMarkerAttributes(line) {
        return (
            (line.startMarker
                ? ' marker-start="url(#' +
                  escapeHtml(
                      SchematicSvgRenderer.#schematicLineMarkerId(
                          line.startMarker
                      )
                  ) +
                  ')"'
                : '') +
            (line.endMarker
                ? ' marker-end="url(#' +
                  escapeHtml(
                      SchematicSvgRenderer.#schematicLineMarkerId(
                          line.endMarker
                      )
                  ) +
                  ')"'
                : '')
        )
    }

    /**
     * Builds page border and title-block chrome from sheet metadata.
     * @param {number} width
     * @param {number} height
     * @param {{ borderOn?: boolean, titleBlockOn?: boolean, marginWidth?: number, paperSize?: string, xZones?: number, yZones?: number, titleBlock?: { title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string } }} sheet
     * @param {string | undefined} fileName
     * @returns {string}
     */
    static #buildSheetChromeMarkup(width, height, sheet, fileName) {
        return SchematicSheetChromeRenderer.buildMarkup(
            width,
            height,
            sheet,
            fileName
        )
    }

    /**
     * Builds one free text primitive with font metadata.
     * @param {{ x: number, y: number, text: string, color: string, recordType?: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string, rotation?: number, sourceOrientation?: number, isMirrored?: boolean, anchor?: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }} text
     * @param {number} sheetHeight
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number, length: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {number} index Stable primitive index.
     * @param {object | undefined} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #buildSchematicTextMarkup(
        text,
        sheetHeight,
        lines,
        pins,
        index = 0,
        semanticContext = undefined
    ) {
        const matchedOwnerPin =
            SchematicOwnerPinLabelLayout.findExplicitOwnerPinLabelMatch(
                text,
                pins
            )

        if (text.recordType === '17') {
            return SchematicSvgRenderer.#appendSvgAttributes(
                SchematicPowerPortRenderer.buildMarkup(
                    text,
                    lines,
                    pins,
                    sheetHeight
                ),
                SchematicSvgRenderer.#semanticAttributes(
                    'text',
                    text,
                    index,
                    semanticContext
                )
            )
        }

        if (text.recordType === '209' || text.recordType === '28') {
            return SchematicSvgRenderer.#appendSvgAttributes(
                SchematicNoteRenderer.buildMarkup(text, sheetHeight),
                SchematicSvgRenderer.#semanticAttributes(
                    'text',
                    text,
                    index,
                    semanticContext
                )
            )
        }
        const placement = SchematicSvgRenderer.#resolveSchematicTextPlacement(
            text,
            sheetHeight,
            lines,
            matchedOwnerPin
        )

        return SchematicSvgRenderer.#appendSvgAttributes(
            createSvgText(
                'schematic-label',
                placement.x,
                placement.y,
                text.resolvedText ?? text.text,
                SchematicColorResolver.resolveColor(
                    text.color,
                    '--schematic-text-color'
                ),
                SchematicOwnerPinLabelLayout.resolveSchematicTextAnchor(
                    text,
                    placement.anchor,
                    matchedOwnerPin
                ),
                SchematicTypography.buildSchematicTextRenderOptions(text)
            ),
            SchematicSvgRenderer.#semanticAttributes(
                'text',
                text,
                index,
                semanticContext
            )
        )
    }

    /**
     * Resolves final text placement for schematic free-text annotations.
     * @param {{ x: number, y: number, text: string, ownerIndex?: string, recordType?: string, fontSize?: number, rotation?: number, anchor?: 'start' | 'middle' | 'end' }} text
     * @param {number} sheetHeight
     * @param {{ x1: number, y1: number, x2: number, y2: number, lineStyle?: number }[]} lines
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' } | null} matchedOwnerPin
     * @returns {{ x: number, y: number, anchor: 'start' | 'middle' | 'end' }}
     */
    static #resolveSchematicTextPlacement(
        text,
        sheetHeight,
        lines,
        matchedOwnerPin
    ) {
        const mirroredOwnerPinPlacement =
            SchematicOwnerPinLabelLayout.resolveMirroredOwnerPinLabelPlacement(
                text,
                matchedOwnerPin
            )
        const sourceY = mirroredOwnerPinPlacement?.y ?? text.y
        const projectedY = projectSchematicY(sheetHeight, sourceY)
        const fontSize =
            SchematicTypography.resolveViewerFontSize(text.fontSize) || 0
        const baselineLift =
            SchematicSvgRenderer.#resolveSectionHeadingBaselineLift(
                text,
                lines,
                sourceY,
                fontSize,
                matchedOwnerPin
            )

        return {
            x: mirroredOwnerPinPlacement?.x ?? text.x,
            y: projectedY - baselineLift,
            anchor: text.anchor || 'start'
        }
    }

    /**
     * Lifts large section headings clear of authored dash-dot frame baselines.
     * @param {{ x: number, y: number, ownerIndex?: string, recordType?: string, fontSize?: number, rotation?: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, lineStyle?: number }[]} lines
     * @param {number} sourceY
     * @param {number} fontSize
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' } | null} matchedOwnerPin
     * @returns {number}
     */
    static #resolveSectionHeadingBaselineLift(
        text,
        lines,
        sourceY,
        fontSize,
        matchedOwnerPin
    ) {
        if (
            !SchematicSvgRenderer.#isLargeOwnerlessFreeText(
                text,
                fontSize,
                matchedOwnerPin
            )
        ) {
            return 0
        }

        return SchematicSvgRenderer.#hasSameCoordinateDashDotFrameLine(
            text,
            lines,
            sourceY
        )
            ? fontSize * SECTION_HEADING_BASELINE_LIFT_RATIO
            : 0
    }

    /**
     * Returns true when one text primitive behaves like a section heading.
     * @param {{ ownerIndex?: string, recordType?: string, rotation?: number }} text
     * @param {number} fontSize
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' } | null} matchedOwnerPin
     * @returns {boolean}
     */
    static #isLargeOwnerlessFreeText(text, fontSize, matchedOwnerPin) {
        if (matchedOwnerPin) return false
        if (text.recordType !== '4') return false
        if (String(text.ownerIndex || '').trim()) return false
        if (fontSize < SECTION_HEADING_MIN_FONT_SIZE) return false

        return SchematicSvgRenderer.#normalizeDegrees(text.rotation) === 0
    }

    /**
     * Detects section frame lines that share the title baseline coordinate.
     * @param {{ x: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, lineStyle?: number }[]} lines
     * @param {number} sourceY
     * @returns {boolean}
     */
    static #hasSameCoordinateDashDotFrameLine(text, lines, sourceY) {
        const textX = Number(text.x)
        if (!Number.isFinite(textX) || !Number.isFinite(sourceY)) return false

        return lines.some((line) => {
            if (Number(line.lineStyle || 0) !== 3) return false

            const y1 = Number(line.y1)
            const y2 = Number(line.y2)
            if (
                !Number.isFinite(y1) ||
                !Number.isFinite(y2) ||
                Math.abs(y1 - y2) > SECTION_HEADING_LINE_Y_TOLERANCE ||
                Math.abs(y1 - sourceY) > SECTION_HEADING_LINE_Y_TOLERANCE
            ) {
                return false
            }

            const minX =
                Math.min(Number(line.x1), Number(line.x2)) -
                SECTION_HEADING_LINE_X_PADDING
            const maxX =
                Math.max(Number(line.x1), Number(line.x2)) +
                SECTION_HEADING_LINE_X_PADDING

            return textX >= minX && textX <= maxX
        })
    }

    /**
     * Normalizes text rotation into a whole-degree clockwise range.
     * @param {number | undefined} rotation
     * @returns {number}
     */
    static #normalizeDegrees(rotation) {
        return ((Math.round(Number(rotation || 0)) % 360) + 360) % 360
    }

    /**
     * Builds one schematic cross marker.
     * @param {{ x: number, y: number, size: number, color: string }} cross
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildSchematicCrossMarkup(cross, sheetHeight) {
        const x = cross.x
        const y = projectSchematicY(sheetHeight, cross.y)
        const half = Math.max(Number(cross.size || 6), 4) / 2

        return (
            '<g class="schematic-cross"><line x1="' +
            formatNumber(x - half) +
            '" y1="' +
            formatNumber(y - half) +
            '" x2="' +
            formatNumber(x + half) +
            '" y2="' +
            formatNumber(y + half) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    cross.color,
                    '--schematic-alert-color'
                )
            ) +
            '" /><line x1="' +
            formatNumber(x - half) +
            '" y1="' +
            formatNumber(y + half) +
            '" x2="' +
            formatNumber(x + half) +
            '" y2="' +
            formatNumber(y - half) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    cross.color,
                    '--schematic-alert-color'
                )
            ) +
            '" /></g>'
        )
    }

    /**
     * Builds one authored schematic junction dot.
     * @param {{ x: number, y: number, color: string }} junction
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildAuthoredSchematicJunctionMarkup(junction, sheetHeight) {
        return (
            '<circle class="schematic-authored-junction" cx="' +
            formatNumber(junction.x) +
            '" cy="' +
            formatNumber(projectSchematicY(sheetHeight, junction.y)) +
            '" r="2.4" fill="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    junction.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" />'
        )
    }

    /**
     * Resolves authored junction colors from their connected wire routes.
     * @param {{ x: number, y: number, color: string }[]} junctions
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, ownerIndex?: string, isBus?: boolean, recordType?: string }[]} lines
     * @returns {{ x: number, y: number, color: string }[]}
     */
    static #resolveAuthoredSchematicJunctions(junctions, lines) {
        return junctions.map((junction) => ({
            ...junction,
            color: SchematicSvgRenderer.#resolveAuthoredSchematicJunctionColor(
                junction,
                lines
            )
        }))
    }

    /**
     * Returns the connected wire color for one authored junction.
     * @param {{ x: number, y: number, color: string }} junction
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, ownerIndex?: string, isBus?: boolean, recordType?: string }[]} lines
     * @returns {string}
     */
    static #resolveAuthoredSchematicJunctionColor(junction, lines) {
        const connectedLine = lines.find(
            (line) =>
                SchematicSvgRenderer.#isElectricalSchematicLine(line) &&
                SchematicSvgRenderer.#schematicLineContainsPoint(line, junction)
        )

        return connectedLine?.color || junction.color
    }

    /**
     * Returns true when one normalized line can carry schematic net color.
     * @param {{ ownerIndex?: string, isBus?: boolean, recordType?: string } | null | undefined} line
     * @returns {boolean}
     */
    static #isElectricalSchematicLine(line) {
        if (line?.ownerIndex || line?.isBus === true) {
            return false
        }

        if (!Object.prototype.hasOwnProperty.call(line || {}, 'recordType')) {
            return true
        }

        return !['6', '7', '26'].includes(String(line.recordType || ''))
    }

    /**
     * Returns true when one schematic line segment contains the given point.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #schematicLineContainsPoint(line, point) {
        const dx = Number(line.x2) - Number(line.x1)
        const dy = Number(line.y2) - Number(line.y1)
        const pointDx = Number(point.x) - Number(line.x1)
        const pointDy = Number(point.y) - Number(line.y1)
        const lengthSquared = dx * dx + dy * dy

        if (!lengthSquared) {
            return (
                Math.abs(Number(line.x1) - Number(point.x)) <= 0.01 &&
                Math.abs(Number(line.y1) - Number(point.y)) <= 0.01
            )
        }

        const cross = Math.abs(pointDx * dy - pointDy * dx)
        if (cross > 0.01) {
            return false
        }

        const dot = pointDx * dx + pointDy * dy
        return dot >= -0.01 && dot <= lengthSquared + 0.01
    }

    /**
     * Builds one schematic bus-entry line marker.
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number }} busEntry
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildSchematicBusEntryMarkup(busEntry, sheetHeight) {
        return (
            '<line class="schematic-bus-entry" x1="' +
            formatNumber(busEntry.x1) +
            '" y1="' +
            formatNumber(projectSchematicY(sheetHeight, busEntry.y1)) +
            '" x2="' +
            formatNumber(busEntry.x2) +
            '" y2="' +
            formatNumber(projectSchematicY(sheetHeight, busEntry.y2)) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    busEntry.color,
                    '--schematic-default-ink-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(Number(busEntry.width || 1), 0.8)) +
            '" />'
        )
    }

    /**
     * Builds one synthetic designator label for a fallback component
     * placement without the old marker circle.
     * @param {{ x: number, y: number, designator?: string }} component
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @param {number} index Stable primitive index.
     * @param {object | undefined} semanticContext Semantic lookup context.
     * @returns {string}
     */
    static #buildFallbackComponentMarkup(
        component,
        sheetHeight,
        sheet,
        index = 0,
        semanticContext = undefined
    ) {
        return SchematicSvgRenderer.#appendSvgAttributes(
            createSvgText(
                'schematic-designator',
                component.x + 8,
                projectSchematicY(sheetHeight, component.y) - 8,
                component.designator || '',
                'var(--schematic-default-ink-color)',
                'start',
                SchematicTypography.buildViewerSchematicFontOptions(sheet)
            ),
            SchematicSvgRenderer.#semanticAttributes(
                'component',
                component,
                index,
                semanticContext
            )
        )
    }

    /**
     * Returns true when a component has enough placement data to draw a
     * fallback designator label.
     * @param {{ x?: number, y?: number, designator?: string }} component
     * @returns {boolean}
     */
    static #isDrawableSchematicComponent(component) {
        if (!component) return false

        const hasCoordinates =
            Number.isFinite(component.x) &&
            Number.isFinite(component.y) &&
            (component.x !== 0 || component.y !== 0)
        const hasResolvedDesignator =
            Boolean(component.designator) && component.designator !== 'U?'

        return hasCoordinates && hasResolvedDesignator
    }
}
