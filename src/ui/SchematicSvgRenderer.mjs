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

const { createSvgText, escapeHtml, formatNumber, projectSchematicY } =
    SchematicSvgUtils

/**
 * Renders normalized schematic models into presentational SVG.
 */
export class SchematicSvgRenderer {
    /**
     * Renders a normalized schematic model into SVG markup.
     * @param {{ fileName?: string, summary: { title?: string }, schematic?: { sheet: { width: number, height: number, sourceWidth?: number, sourceHeight?: number, paperSize?: string, borderOn?: boolean, titleBlockOn?: boolean, marginWidth?: number, xZones?: number, yZones?: number, titleBlock?: { title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string } }, lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, isBus?: boolean, ownerIndex?: string, renderOrder?: number }[], polygons?: { points: { x: number, y: number }[], color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string, renderOrder?: number }[], rectangles?: { x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string, renderOrder?: number }[], regions?: { x: number, y: number, width: number, height: number, color: string, fill: string, renderOrder?: number }[], ellipses?: { x: number, y: number, radiusX: number, radiusY: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string, renderOrder?: number }[], arcs?: { x: number, y: number, radius: number, startAngle: number, endAngle: number, color: string, width: number, ownerIndex?: string, renderOrder?: number }[], directives?: { x: number, y: number, color: string, name: string, orientation?: number }[], texts: { x: number, y: number, text: string, color: string, recordType?: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number, sourceOrientation?: number, isMirrored?: boolean, anchor?: 'start' | 'middle' | 'end', powerPortDirection?: 'up' | 'down' | 'left' | 'right', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }[], components: { x: number, y: number, designator: string }[], pins?: { x: number, y: number, length: number, name: string, nameSegments?: { text: string, overline: boolean }[], designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', electrical?: number, symbolOuter?: number, color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex?: string }[], ports?: { x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' | 'up' | 'down', shape?: 'single' | 'double' | 'plain' }[], crosses?: { x: number, y: number, size: number, color: string }[] } }} documentModel
     * @returns {string}
     */
    static render(documentModel) {
        const schematic = documentModel?.schematic
        if (!schematic) {
            return '<section class="altium-renderer-empty">No schematic entities were recovered from this file.</section>'
        }

        const width = Math.max(schematic.sheet.width || 1000, 100)
        const height = Math.max(schematic.sheet.height || 700, 100)
        const allTexts = schematic.texts || []
        const lines = schematic.lines.slice(0, 2500)
        const polygons = (schematic.polygons || []).slice(0, 1000)
        const rectangles = (schematic.rectangles || []).slice(0, 500)
        const regions = (schematic.regions || []).slice(0, 250)
        const ellipses = (schematic.ellipses || []).slice(0, 500)
        const arcs = (schematic.arcs || []).slice(0, 1000)
        const directives = (schematic.directives || []).slice(0, 250)
        const texts = allTexts
        const components = schematic.components.slice(0, 180)
        const pins = (schematic.pins || []).slice(0, 1000)
        const ports = (schematic.ports || []).slice(0, 250)
        const crosses = (schematic.crosses || []).slice(0, 250)
        const sheetSymbols = (schematic.sheetSymbols || []).slice(0, 250)
        const sheetEntries = (schematic.sheetEntries || []).slice(0, 500)
        const authoredJunctions = (schematic.junctions || []).slice(0, 500)
        const busEntries = (schematic.busEntries || []).slice(0, 500)
        const images = (schematic.images || []).slice(0, 100)
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
            schematic.sheet,
            documentModel?.fileName
        )
        const regionMarkup = SchematicRegionRenderer.buildMarkup(
            regions,
            height
        )
        const contentTransform = SchematicContentLayout.buildTransform(
            width,
            height,
            schematic
        )
        const contentClipId = SchematicContentLayout.buildClipId(
            width,
            height,
            schematic
        )
        const contentClipMarkup = SchematicContentLayout.buildClipMarkup(
            width,
            height,
            schematic,
            contentClipId
        )
        const ownerlessLines = lines.filter((line) => !line.ownerIndex)
        const ownerlessPolygons = polygons.filter(
            (polygon) => !polygon.ownerIndex
        )
        const ownerlessRectangles = rectangles.filter(
            (rectangle) => !rectangle.ownerIndex
        )
        const ownerlessEllipses = ellipses.filter(
            (ellipse) => !ellipse.ownerIndex
        )
        const ownerlessArcs = arcs.filter((arc) => !arc.ownerIndex)
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
            .map((polygon) =>
                SchematicShapeRenderer.buildPolygonMarkup(polygon, height)
            )
            .join('')
        const rectangleMarkup = ownerlessRectangles
            .map((rectangle) =>
                SchematicShapeRenderer.buildRectangleMarkup(rectangle, height)
            )
            .join('')
        const ellipseMarkup = ownerlessEllipses
            .map((ellipse) =>
                SchematicShapeRenderer.buildEllipseMarkup(ellipse, height)
            )
            .join('')
        const lineMarkup = ownerlessLines
            .map((line) =>
                SchematicSvgRenderer.#buildSchematicLineMarkup(line, height)
            )
            .join('')
        const arcMarkup = ownerlessArcs
            .map((arc) => SchematicShapeRenderer.buildArcMarkup(arc, height))
            .join('')
        const ownerGeometryMarkup =
            SchematicSvgRenderer.#buildOwnerGeometryMarkup(
                lines,
                polygons,
                rectangles,
                ellipses,
                arcs,
                height
            )
        const sheetSymbolMarkup =
            SchematicSheetSymbolRenderer.buildSheetSymbolMarkup(
                sheetSymbols,
                height
            )
        const sheetEntryMarkup =
            SchematicSheetSymbolRenderer.buildSheetEntryMarkup(
                sheetEntries,
                height
            )
        const busEntryMarkup = busEntries
            .map((busEntry) =>
                SchematicSvgRenderer.#buildSchematicBusEntryMarkup(
                    busEntry,
                    height
                )
            )
            .join('')
        const authoredJunctionMarkup = authoredJunctions
            .map((junction) =>
                SchematicSvgRenderer.#buildAuthoredSchematicJunctionMarkup(
                    junction,
                    height
                )
            )
            .join('')
        const imageMarkup = SchematicImageRenderer.buildMarkup(images, height)

        const textMarkup = resolvedTexts
            .map((text) =>
                SchematicSvgRenderer.#buildSchematicTextMarkup(
                    text,
                    height,
                    lines,
                    pins
                )
            )
            .join('')

        const componentMarkup = drawableComponents
            .map((component) =>
                SchematicSvgRenderer.#buildFallbackComponentMarkup(
                    component,
                    height,
                    schematic.sheet
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
            .map((pin) =>
                SchematicPinSvgRenderer.buildMarkup(
                    pin,
                    height,
                    schematic.sheet,
                    rotatedVerticalNumberOwners,
                    explicitOwnerPinNameLabels,
                    explicitOwnerPinLabelOffsets
                )
            )
            .join('')
        const portMarkup = SchematicPortRenderer.buildMarkup(
            ports,
            height,
            schematic.sheet
        )
        const directiveMarkup = SchematicDirectiveRenderer.buildMarkup(
            directives,
            height,
            schematic.sheet
        )
        const junctionMarkup = SchematicJunctionRenderer.buildMarkup(
            lines,
            crosses,
            ports,
            resolvedTexts.filter((text) => text.recordType === '17'),
            height
        )
        const crossMarkup = crosses
            .map((cross) =>
                SchematicSvgRenderer.#buildSchematicCrossMarkup(cross, height)
            )
            .join('')

        return (
            '<section class="svg-panel">' +
            '<header class="svg-panel__header"><h3>' +
            escapeHtml(documentModel?.summary?.title || 'Schematic') +
            '</h3><p>' +
            lines.length +
            ' line segments, ' +
            components.length +
            ' components</p></header>' +
            '<svg class="schematic-svg" viewBox="0 0 ' +
            formatNumber(width) +
            ' ' +
            formatNumber(height) +
            '" preserveAspectRatio="xMidYMid meet" aria-label="Schematic view">' +
            '<rect class="sheet-backdrop" x="0" y="0" width="' +
            formatNumber(width) +
            '" height="' +
            formatNumber(height) +
            '" rx="18" />' +
            contentClipMarkup +
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
     * Builds interleaved owner geometry so symbol-internal primitives preserve
     * their recovered Altium paint order instead of batching fills ahead of all
     * linework.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string, renderOrder?: number }[]} lines
     * @param {{ points: { x: number, y: number }[], ownerIndex?: string, renderOrder?: number }[]} polygons
     * @param {{ x: number, y: number, width: number, height: number, ownerIndex?: string, renderOrder?: number }[]} rectangles
     * @param {{ x: number, y: number, radiusX: number, radiusY: number, ownerIndex?: string, renderOrder?: number }[]} ellipses
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, ownerIndex?: string, renderOrder?: number }[]} arcs
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildOwnerGeometryMarkup(
        lines,
        polygons,
        rectangles,
        ellipses,
        arcs,
        sheetHeight
    ) {
        const items = []

        for (const polygon of polygons) {
            if (!polygon.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(polygon),
                typeOrder: 0,
                markup: SchematicShapeRenderer.buildPolygonMarkup(
                    polygon,
                    sheetHeight
                )
            })
        }

        for (const rectangle of rectangles) {
            if (!rectangle.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(
                        rectangle
                    ),
                typeOrder: 1,
                markup: SchematicShapeRenderer.buildRectangleMarkup(
                    rectangle,
                    sheetHeight
                )
            })
        }

        for (const ellipse of ellipses) {
            if (!ellipse.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(ellipse),
                typeOrder: 2,
                markup: SchematicShapeRenderer.buildEllipseMarkup(
                    ellipse,
                    sheetHeight
                )
            })
        }

        for (const line of lines) {
            if (!line.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(line),
                typeOrder: 3,
                markup: SchematicSvgRenderer.#buildSchematicLineMarkup(
                    line,
                    sheetHeight
                )
            })
        }

        for (const arc of arcs) {
            if (!arc.ownerIndex) {
                continue
            }

            items.push({
                renderOrder:
                    SchematicSvgRenderer.#resolvePrimitiveRenderOrder(arc),
                typeOrder: 4,
                markup: SchematicShapeRenderer.buildArcMarkup(arc, sheetHeight)
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
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, isBus?: boolean }} line
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildSchematicLineMarkup(line, sheetHeight) {
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
        if (Number(line.lineStyle || 0) !== 1) {
            return ''
        }
        const dashLength = Math.max(Number(line.width || 1) * 8, 8)
        const gapLength = Math.max(Number(line.width || 1) * 5, 5)
        return (
            ' stroke-dasharray="' +
            formatNumber(dashLength) +
            ' ' +
            formatNumber(gapLength) +
            '" stroke-linecap="round"'
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
     * @param {{ x: number, y: number, text: string, color: string, recordType?: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number, sourceOrientation?: number, isMirrored?: boolean, anchor?: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }} text
     * @param {number} sheetHeight
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number, length: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {string}
     */
    static #buildSchematicTextMarkup(text, sheetHeight, lines, pins) {
        const matchedOwnerPin =
            SchematicOwnerPinLabelLayout.findExplicitOwnerPinLabelMatch(
                text,
                pins
            )

        if (text.recordType === '17') {
            return SchematicPowerPortRenderer.buildMarkup(
                text,
                lines,
                pins,
                sheetHeight
            )
        }

        if (text.recordType === '209' || text.recordType === '28') {
            return SchematicNoteRenderer.buildMarkup(text, sheetHeight)
        }
        const placement = SchematicSvgRenderer.#resolveSchematicTextPlacement(
            text,
            sheetHeight,
            matchedOwnerPin
        )

        return createSvgText(
            'schematic-label',
            placement.x,
            placement.y,
            text.text,
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
        )
    }

    /**
     * Resolves final text placement for schematic free-text annotations.
     * @param {{ x: number, y: number, text: string, recordType?: string, fontSize?: number, rotation?: number, anchor?: 'start' | 'middle' | 'end' }} text
     * @param {number} sheetHeight
     * @param {{ x: number, y: number, name?: string, ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom' } | null} matchedOwnerPin
     * @returns {{ x: number, y: number, anchor: 'start' | 'middle' | 'end' }}
     */
    static #resolveSchematicTextPlacement(text, sheetHeight, matchedOwnerPin) {
        const mirroredOwnerPinPlacement =
            SchematicOwnerPinLabelLayout.resolveMirroredOwnerPinLabelPlacement(
                text,
                matchedOwnerPin
            )

        return {
            x: mirroredOwnerPinPlacement?.x ?? text.x,
            y: projectSchematicY(
                sheetHeight,
                mirroredOwnerPinPlacement?.y ?? text.y
            ),
            anchor: text.anchor || 'start'
        }
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
     * @returns {string}
     */
    static #buildFallbackComponentMarkup(component, sheetHeight, sheet) {
        return createSvgText(
            'schematic-designator',
            component.x + 8,
            projectSchematicY(sheetHeight, component.y) - 8,
            component.designator || '',
            'var(--schematic-default-ink-color)',
            'start',
            SchematicTypography.buildViewerSchematicFontOptions(sheet)
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
