// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AsciiRecordParser } from './AsciiRecordParser.mjs'
import { ParserUtils } from './ParserUtils.mjs'
import { SchematicTextParser } from './SchematicTextParser.mjs'
import { SchematicTextPostProcessor } from './SchematicTextPostProcessor.mjs'
import { SchematicStandaloneCalloutNormalizer } from './SchematicStandaloneCalloutNormalizer.mjs'
import { SchematicAnnotationParser } from './SchematicAnnotationParser.mjs'
import { SchematicDirectiveParser } from './SchematicDirectiveParser.mjs'
import { SchematicPinParser } from './SchematicPinParser.mjs'
import { SchematicPrimitiveParser } from './SchematicPrimitiveParser.mjs'
import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { ParserDiagnosticNormalizer } from './ParserDiagnosticNormalizer.mjs'
import { AltiumUnsupportedFeatureError } from './ParserErrors.mjs'
import { IntLibModelParser } from './IntLibModelParser.mjs'
import { IntLibStreamExtractor } from './IntLibStreamExtractor.mjs'
import { DraftsmanDigestParser } from './DraftsmanDigestParser.mjs'
import { PcbModelParser } from './PcbModelParser.mjs'
import { PcbLibModelParser } from './PcbLibModelParser.mjs'
import { PcbLibStreamExtractor } from './PcbLibStreamExtractor.mjs'
import { SchLibModelParser } from './SchLibModelParser.mjs'
import { SchLibStreamExtractor } from './SchLibStreamExtractor.mjs'
import { PrjPcbModelParser } from './PrjPcbModelParser.mjs'
import { PrjScrModelParser } from './PrjScrModelParser.mjs'
import { PcbStreamExtractor } from './PcbStreamExtractor.mjs'
import { SchematicMultipartOwnerMatcher } from './SchematicMultipartOwnerMatcher.mjs'
import { SchematicSheetStyleResolver } from './SchematicSheetStyleResolver.mjs'
import { SchematicSheetParser } from './SchematicSheetParser.mjs'
import { SchematicJunctionParser } from './SchematicJunctionParser.mjs'
import { SchematicBusEntryParser } from './SchematicBusEntryParser.mjs'
import { SchematicImageParser } from './SchematicImageParser.mjs'
import { SchematicImageDiagnosticsBuilder } from './SchematicImageDiagnosticsBuilder.mjs'
import { SchematicNetlistBuilder } from './SchematicNetlistBuilder.mjs'
import { SchematicRecordTypeRegistry } from './SchematicRecordTypeRegistry.mjs'
import { SchematicComponentTextResolver } from './SchematicComponentTextResolver.mjs'
import { SchematicComponentOwnerTextResolver } from './SchematicComponentOwnerTextResolver.mjs'
import { SchematicOwnershipGraphParser } from './SchematicOwnershipGraphParser.mjs'
import { SchematicStreamExtractor } from './SchematicStreamExtractor.mjs'
import { SchematicTemplateParser } from './SchematicTemplateParser.mjs'
import { SchematicThumbnailParser } from './SchematicThumbnailParser.mjs'
import { SchematicHarnessParser } from './SchematicHarnessParser.mjs'
import { SchematicImplementationParser } from './SchematicImplementationParser.mjs'
import { SchematicCodeSymbolParser } from './SchematicCodeSymbolParser.mjs'
import { SchematicHyperlinkParser } from './SchematicHyperlinkParser.mjs'
import { SchematicCrossSheetConnectorParser } from './SchematicCrossSheetConnectorParser.mjs'
import { SchematicRepeatedChannelParser } from './SchematicRepeatedChannelParser.mjs'
import { SchematicDisplayModeCatalogParser } from './SchematicDisplayModeCatalogParser.mjs'
import { SchematicBindingProvenanceParser } from './SchematicBindingProvenanceParser.mjs'
import { SchematicConnectivityQaBuilder } from './SchematicConnectivityQaBuilder.mjs'
import { SchematicQaReportBuilder } from './SchematicQaReportBuilder.mjs'
import { SchematicWireNormalizer } from './SchematicWireNormalizer.mjs'
import { AltiumSchematicArcAngleNormalizer } from './AltiumSchematicArcAngleNormalizer.mjs'
import { AltiumSchematicFreeGraphicStrokeNormalizer } from './AltiumSchematicFreeGraphicStrokeNormalizer.mjs'
import { AltiumSchematicHiddenDesignatorResolver } from './AltiumSchematicHiddenDesignatorResolver.mjs'
import { AltiumSchematicPackedImageResolver } from './AltiumSchematicPackedImageResolver.mjs'
import { AltiumSchematicSheetBoundsNormalizer } from './AltiumSchematicSheetBoundsNormalizer.mjs'
import { CircuitJsonModelAdapter } from '../circuit-json/CircuitJsonModelAdapter.mjs'
const {
    countMatchingKeys,
    getDisplayText,
    getField,
    parseBoolean,
    parseNumericField,
    parseSchematicLineWidth,
    toColor,
    dedupeByDesignator,
    stripExtension
} = ParserUtils
const {
    collectTitleBlockFooterOwners,
    extractSchematicFonts,
    extractSchematicFontDiagnostics,
    extractSchematicMetadata,
    extractSchematicOwnerMetadata,
    extractSchematicTitleBlock,
    normalizeSchematicTextRecord
} = SchematicTextParser
const { buildSchematicSyntheticTexts } = SchematicAnnotationParser
const {
    parseSchematicCrosses,
    parseSchematicPins,
    parseSchematicPolygon,
    parseSchematicPolyline,
    parseSchematicPorts
} = SchematicPinParser

/**
 * Parses native Altium files into Circuit JSON element arrays.
 */
export class AltiumParser {
    /**
     * Parses a native Altium buffer into a Circuit JSON element array.
     * @param {string} fileName
     * @param {ArrayBuffer} arrayBuffer
     * @returns {object[]}
     */
    static parseArrayBuffer(fileName, arrayBuffer) {
        return CircuitJsonModelAdapter.fromRendererModel(
            AltiumParser.parseArrayBufferToRendererModel(fileName, arrayBuffer)
        )
    }

    /**
     * Parses a native Altium buffer into a non-throwing Circuit JSON envelope.
     * @param {string} fileName
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ ok: true, model: object[], diagnostics: object[] } | { ok: false, model: null, diagnostics: object[] }}
     */
    static tryParseArrayBuffer(fileName, arrayBuffer) {
        return AltiumParser.#tryParse(fileName, () =>
            AltiumParser.parseArrayBuffer(fileName, arrayBuffer)
        )
    }

    /**
     * Parses a native Altium buffer into a non-throwing renderer model envelope.
     * @param {string} fileName
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ ok: true, model: object, diagnostics: object[] } | { ok: false, model: null, diagnostics: object[] }}
     */
    static tryParseArrayBufferToRendererModel(fileName, arrayBuffer) {
        return AltiumParser.#tryParse(fileName, () =>
            AltiumParser.parseArrayBufferToRendererModel(fileName, arrayBuffer)
        )
    }

    /**
     * Parses a native Altium buffer into the renderer compatibility model.
     * @param {string} fileName
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ schema: string, kind: 'schematic' | 'pcb' | 'pcb-library' | 'schematic-library' | 'project' | 'project-script' | 'integrated-library' | 'draftsman', fileType: 'SchDoc' | 'PcbDoc' | 'PcbLib' | 'SchLib' | 'PrjPcb' | 'PrjScr' | 'IntLib' | 'PCBDwf', fileName: string, summary: Record<string, number | string>, diagnostics: { severity: 'info' | 'warning', message: string }[], schematic?: Record<string, unknown>, pcb?: Record<string, unknown>, pcbLibrary?: Record<string, unknown>, schematicLibrary?: Record<string, unknown>, project?: Record<string, unknown>, projectScript?: Record<string, unknown>, integratedLibrary?: Record<string, unknown>, draftsman?: Record<string, unknown>, bom: { designators: string[], quantity: number, pattern: string, source: string, value: string }[] }}
     */
    static parseArrayBufferToRendererModel(fileName, arrayBuffer) {
        const records = AsciiRecordParser.parse(arrayBuffer)
        const fileType = AltiumParser.#sniffFileType(fileName, records)
        if (fileType === 'SchDoc') {
            const schematicExtraction =
                SchematicStreamExtractor.extractFromArrayBuffer(arrayBuffer)
            return AltiumParser.#parseSchematic(
                fileName,
                schematicExtraction?.records || records,
                arrayBuffer,
                schematicExtraction
            )
        }
        if (fileType === 'PcbDoc') {
            const pcbExtraction =
                PcbStreamExtractor.extractFromArrayBuffer(arrayBuffer)
            return PcbModelParser.parse(
                fileName,
                pcbExtraction?.records || records,
                pcbExtraction
            )
        }
        if (fileType === 'PcbLib') {
            return PcbLibModelParser.parse(
                fileName,
                PcbLibStreamExtractor.extractFromArrayBuffer(arrayBuffer)
            )
        }
        if (fileType === 'SchLib') {
            return SchLibModelParser.parse(
                fileName,
                SchLibStreamExtractor.extractFromArrayBuffer(arrayBuffer)
            )
        }
        if (fileType === 'PrjPcb') {
            return PrjPcbModelParser.parse(fileName, arrayBuffer)
        }
        if (fileType === 'PrjScr') {
            return PrjScrModelParser.parse(fileName, arrayBuffer)
        }
        if (fileType === 'IntLib') {
            return IntLibModelParser.parse(
                fileName,
                IntLibStreamExtractor.extractFromArrayBuffer(arrayBuffer)
            )
        }
        if (fileType === 'PCBDwf') {
            return DraftsmanDigestParser.parse(fileName, arrayBuffer)
        }
        throw new AltiumUnsupportedFeatureError(
            'Unsupported file type: ' + fileName,
            { fileName }
        )
    }

    /**
     * Runs one parser function and returns a normalized result envelope.
     * @param {string} fileName
     * @param {() => object | object[]} parser
     * @returns {{ ok: true, model: object | object[], diagnostics: object[] } | { ok: false, model: null, diagnostics: object[] }}
     */
    static #tryParse(fileName, parser) {
        try {
            const model = parser()
            return {
                ok: true,
                model,
                diagnostics: ParserDiagnosticNormalizer.normalizeMany(
                    model?.diagnostics || [],
                    { source: fileName }
                )
            }
        } catch (error) {
            return AltiumParser.#safeParseFailure(fileName, error)
        }
    }

    /**
     * Builds one safe-parse failure envelope.
     * @param {string} fileName
     * @param {unknown} error
     * @returns {{ ok: false, model: null, diagnostics: object[] }}
     */
    static #safeParseFailure(fileName, error) {
        const diagnostic = ParserDiagnosticNormalizer.normalize(error, {
            code: 'parser.safe.parse.failed',
            severity: 'error',
            source: fileName
        })
        const errorKind = diagnostic.errorKind || 'parse'

        return {
            ok: false,
            model: null,
            diagnostics: [
                {
                    ...diagnostic,
                    code: 'parser.safe.parse.failed',
                    fileName: String(fileName || ''),
                    errorKind,
                    errorName:
                        error && typeof error === 'object' && 'name' in error
                            ? String(error.name)
                            : 'Error'
                }
            ]
        }
    }

    /**
     * Chooses the format based on extension and content.
     * @param {string} fileName
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {'SchDoc' | 'PcbDoc' | 'PcbLib' | 'SchLib' | 'PrjPcb' | 'PrjScr' | 'IntLib' | 'PCBDwf'}
     */
    static #sniffFileType(fileName, records) {
        const normalized = String(fileName || '').toLowerCase()
        if (normalized.endsWith('.schdoc')) return 'SchDoc'
        if (normalized.endsWith('.pcbdoc')) return 'PcbDoc'
        if (normalized.endsWith('.pcblib')) return 'PcbLib'
        if (normalized.endsWith('.schlib')) return 'SchLib'
        if (normalized.endsWith('.prjpcb')) return 'PrjPcb'
        if (normalized.endsWith('.prjscr')) return 'PrjScr'
        if (normalized.endsWith('.intlib')) return 'IntLib'
        if (normalized.endsWith('.pcbdwf')) return 'PCBDwf'

        const hasSchematicHeader = records.some((record) =>
            getField(record.fields, 'HEADER').includes('Schematic')
        )
        const hasSchematicLibraryHeader = records.some((record) =>
            getField(record.fields, 'HEADER').includes('Schematic Library')
        )
        return hasSchematicLibraryHeader
            ? 'SchLib'
            : hasSchematicHeader
              ? 'SchDoc'
              : 'PcbDoc'
    }
    /**
     * Normalizes a schematic document.
     * @param {string} fileName
     * @param {{ raw: string, fields: Record<string, string | string[]> }[]} records
     * @param {ArrayBuffer} arrayBuffer
     * @param {{ embeddedFiles?: object } | null} schematicExtraction
     * @returns {ReturnType<typeof AltiumParser.parseArrayBufferToRendererModel>}
     */
    static #parseSchematic(
        fileName,
        records,
        arrayBuffer,
        schematicExtraction = null
    ) {
        const recordIndexAwareRecords = records.map((record, recordIndex) => ({
            ...record,
            recordIndex
        }))
        const componentRecords = recordIndexAwareRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '1'
        )
        const recordTypes = SchematicRecordTypeRegistry.summarize(records)
        const ownersWithImplicitDisplayMode =
            AltiumParser.#collectOwnersWithImplicitDisplayMode(records)
        const activeOwnerDisplayModes =
            AltiumParser.#collectActiveOwnerDisplayModes(
                recordIndexAwareRecords,
                componentRecords
            )
        const activeMultipartOwnerParts =
            SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
                recordIndexAwareRecords,
                componentRecords
            )
        const sheetRecord = records.find(
            (record) => getField(record.fields, 'RECORD') === '31'
        )
        const textRecords = records.filter((record) =>
            AltiumParser.#hasDisplayText(record.fields)
        )
        const drawableRecords = records.filter((record) =>
            AltiumParser.#isDrawableSchematicRecord(
                record.fields,
                ownersWithImplicitDisplayMode,
                activeOwnerDisplayModes,
                activeMultipartOwnerParts
            )
        )
        const drawableTextRecords = textRecords.filter((record) =>
            AltiumParser.#isDrawableSchematicRecord(
                record.fields,
                ownersWithImplicitDisplayMode,
                activeOwnerDisplayModes,
                activeMultipartOwnerParts
            )
        )
        const lineRecords = records.filter(
            (record) =>
                AltiumParser.#isDrawableSchematicRecord(
                    record.fields,
                    ownersWithImplicitDisplayMode,
                    activeOwnerDisplayModes,
                    activeMultipartOwnerParts
                ) &&
                getField(record.fields, 'RECORD') !== '211' &&
                getField(record.fields, 'RECORD') !== '30' &&
                getField(record.fields, 'RECORD') !== '37' &&
                !SchematicPrimitiveParser.isRectangleRecord(record.fields) &&
                !SchematicPrimitiveParser.isRoundedRectangleRecord(
                    record.fields
                ) &&
                !SchematicPrimitiveParser.isIeeeSymbolRecord(record.fields) &&
                !AltiumParser.#hasDisplayText(record.fields) &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Corner')
        )
        const regionRecords = drawableRecords.filter(
            (record) =>
                getField(record.fields, 'RECORD') === '211' &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Corner')
        )
        const rectangleRecords = drawableRecords.filter(
            (record) =>
                SchematicPrimitiveParser.isRectangleRecord(record.fields) &&
                ((AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                    AltiumParser.#hasCoordinatePair(record.fields, 'Corner')) ||
                    SchematicPrimitiveParser.isPointListedRectangleRecord(
                        record.fields
                    ))
        )
        const roundedRectangleRecords = drawableRecords.filter(
            (record) =>
                SchematicPrimitiveParser.isRoundedRectangleRecord(
                    record.fields
                ) &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Corner')
        )
        const ieeeSymbolRecords = drawableRecords.filter(
            (record) =>
                SchematicPrimitiveParser.isIeeeSymbolRecord(record.fields) &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location')
        )
        const arcRecords = drawableRecords.filter(
            (record) =>
                ['11', '12'].includes(getField(record.fields, 'RECORD')) &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                parseNumericField(record.fields, 'Radius') !== null
        )
        const bezierRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '5'
        )
        const pieRecords = drawableRecords.filter(
            (record) =>
                getField(record.fields, 'RECORD') === '9' &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                parseNumericField(record.fields, 'Radius') !== null
        )
        const ellipseRecords = drawableRecords.filter(
            (record) =>
                getField(record.fields, 'RECORD') === '8' &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                parseNumericField(record.fields, 'Radius') !== null
        )
        const polylineRecords = drawableRecords.filter(
            (record) =>
                getField(record.fields, 'RECORD') === '26' ||
                getField(record.fields, 'RECORD') === '27' ||
                getField(record.fields, 'RECORD') === '6'
        )
        const polygonRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '7'
        )
        const pinRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '2'
        )
        const portRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '18'
        )
        const directiveRecords = drawableRecords.filter(
            (record) =>
                getField(record.fields, 'RECORD') === '43' &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location')
        )
        const crossRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '22'
        )
        const ownership = SchematicOwnershipGraphParser.parse(
            recordIndexAwareRecords
        )
        const harnesses = SchematicHarnessParser.parse(recordIndexAwareRecords)
        const implementations = SchematicImplementationParser.parse(
            recordIndexAwareRecords
        )
        const codeSymbols = SchematicCodeSymbolParser.parse(
            recordIndexAwareRecords
        )
        const displayModes = SchematicDisplayModeCatalogParser.parse(
            recordIndexAwareRecords
        )
        const bindings = SchematicBindingProvenanceParser.parse(
            recordIndexAwareRecords,
            implementations
        )
        const crossSheetConnectors = SchematicCrossSheetConnectorParser.parse(
            recordIndexAwareRecords
        )
        const repeatedChannels = SchematicRepeatedChannelParser.parse(
            recordIndexAwareRecords
        )
        const relatedTexts = new Map()

        for (const record of records) {
            const ownerIndex = getField(record.fields, 'OwnerIndex')
            if (!ownerIndex) continue
            if (!relatedTexts.has(ownerIndex)) {
                relatedTexts.set(ownerIndex, [])
            }
            relatedTexts.get(ownerIndex).push(record)
        }

        const metadataTexts = extractSchematicMetadata(textRecords)
        const ownerMetadataTexts = extractSchematicOwnerMetadata(textRecords)
        const schematicFonts = extractSchematicFonts(sheetRecord?.fields)
        const schematicRenderDiagnostics = extractSchematicFontDiagnostics(
            sheetRecord?.fields
        )
        const storedSheetWidth =
            parseNumericField(sheetRecord?.fields, 'CustomX') || 1500
        const storedSheetHeight =
            parseNumericField(sheetRecord?.fields, 'CustomY') || 950
        const templatePageSize =
            AltiumLayoutParser.resolveSchematicTemplatePageSize(
                sheetRecord?.fields,
                storedSheetWidth,
                storedSheetHeight
            )
        const sheetWidth = templatePageSize?.width || storedSheetWidth
        const sheetHeight = templatePageSize?.height || storedSheetHeight
        const sheetMargin =
            parseNumericField(sheetRecord?.fields, 'CustomMarginWidth') || 20
        const sheet = {
            width: sheetWidth,
            height: sheetHeight,
            sourceWidth: templatePageSize?.sourceWidth || storedSheetWidth,
            sourceHeight: templatePageSize?.sourceHeight || storedSheetHeight,
            visibleGrid:
                parseNumericField(sheetRecord?.fields, 'VisibleGridSize') || 10,
            snapGrid:
                parseNumericField(sheetRecord?.fields, 'SnapGridSize') || 5,
            borderOn: parseBoolean(sheetRecord?.fields.BorderOn),
            titleBlockOn: parseBoolean(sheetRecord?.fields.TitleBlockOn),
            marginWidth: sheetMargin,
            xZones: Math.max(
                (parseNumericField(sheetRecord?.fields, 'CustomXZones') || 6) -
                    2,
                1
            ),
            yZones: Math.max(
                parseNumericField(sheetRecord?.fields, 'CustomYZones') || 4,
                1
            ),
            fonts: schematicFonts,
            sheetStyle:
                parseNumericField(sheetRecord?.fields, 'SheetStyle') || 0,
            ...(templatePageSize?.paperSize
                ? { paperSize: templatePageSize.paperSize }
                : {}),
            titleBlock: extractSchematicTitleBlock(
                textRecords,
                metadataTexts,
                sheetWidth,
                schematicFonts
            )
        }
        const footerOwnerIndexes = collectTitleBlockFooterOwners(
            textRecords,
            sheet.width
        )

        let lines = [
            ...lineRecords.map((record, index) => ({
                x1: parseNumericField(record.fields, 'Location.X') || 0,
                y1: parseNumericField(record.fields, 'Location.Y') || 0,
                x2: parseNumericField(record.fields, 'Corner.X') || 0,
                y2: parseNumericField(record.fields, 'Corner.Y') || 0,
                color: toColor(record.fields.Color, '#a44a1b'),
                width: parseSchematicLineWidth(record.fields),
                lineStyle: parseNumericField(record.fields, 'LineStyle') || 0,
                recordType: getField(record.fields, 'RECORD') || undefined,
                renderOrder:
                    parseNumericField(record.fields, 'IndexInSheet') ?? index,
                ownerIndex: getField(record.fields, 'OwnerIndex') || undefined
            })),
            ...polylineRecords.flatMap((record, index) =>
                parseSchematicPolyline(record.fields, {
                    isBus: getField(record.fields, 'RECORD') === '26',
                    recordType: getField(record.fields, 'RECORD') || undefined
                }).map((line, segmentIndex) => ({
                    ...line,
                    renderOrder:
                        (parseNumericField(record.fields, 'IndexInSheet') ??
                            index) +
                        segmentIndex / 100,
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }))
            ),
            ...polygonRecords.flatMap((record, index) =>
                parseSchematicPolygon(record.fields).map(
                    (line, segmentIndex) => ({
                        ...line,
                        recordType:
                            getField(record.fields, 'RECORD') || undefined,
                        renderOrder:
                            (parseNumericField(record.fields, 'IndexInSheet') ??
                                index) +
                            segmentIndex / 100,
                        ownerIndex:
                            getField(record.fields, 'OwnerIndex') || undefined
                    })
                )
            )
        ]
        const ownerDrawnInternalPinOwners =
            AltiumParser.#collectInaccessibleOwnerDrawnPrimitiveOwners(
                drawableRecords
            )
        const numericEndpointLabelOwners =
            AltiumParser.#collectNumericEndpointLabelOwners(
                componentRecords,
                recordIndexAwareRecords
            )
        const pins = parseSchematicPins(pinRecords, {
            ownerDrawnInternalPinOwners,
            numericEndpointLabelOwners
        })
        const junctions = SchematicJunctionParser.parseSchematicJunctions(
            recordIndexAwareRecords
        )
        lines = SchematicWireNormalizer.extendCollapsedPolylineEndpoints(
            lines,
            pins,
            junctions
        )
        let polygons =
            SchematicPrimitiveParser.parseSchematicPolygons(polygonRecords)
        ;({ lines, polygons } =
            SchematicWireNormalizer.normalizeStandaloneCalloutArrowheads(
                lines,
                polygons
            ))
        const arcs = SchematicPrimitiveParser.parseSchematicArcs(arcRecords)
        const beziers =
            SchematicPrimitiveParser.parseSchematicBeziers(bezierRecords)
        const pies = SchematicPrimitiveParser.parseSchematicPies(pieRecords)
        const ellipses =
            SchematicPrimitiveParser.parseSchematicEllipses(ellipseRecords)
        const rectangles =
            SchematicPrimitiveParser.inferMissingOwnerRectangleRenderOrders(
                rectangleRecords,
                SchematicPrimitiveParser.parseSchematicRectangles(
                    rectangleRecords
                ),
                lines,
                polygons,
                ellipses,
                arcs
            )
        const regions =
            SchematicPrimitiveParser.parseSchematicRegions(regionRecords)
        const roundedRectangles =
            SchematicPrimitiveParser.parseSchematicRoundedRectangles(
                roundedRectangleRecords
            )
        const ieeeSymbols =
            SchematicPrimitiveParser.parseSchematicIeeeSymbols(
                ieeeSymbolRecords
            )
        const directives =
            SchematicDirectiveParser.parseSchematicDirectives(directiveRecords)
        const directiveSemantics =
            SchematicDirectiveParser.parseDirectiveSemantics(
                recordIndexAwareRecords
            )
        const { sheetSymbols, sheetEntries } = SchematicSheetParser.parse(
            recordIndexAwareRecords
        )
        const busEntries = SchematicBusEntryParser.parseSchematicBusEntries(
            recordIndexAwareRecords
        )
        const { images, diagnostics: imageDiagnostics } =
            SchematicImageParser.parseSchematicImages(
                recordIndexAwareRecords,
                arrayBuffer
            )
        const imageDiagnosticsReport = SchematicImageDiagnosticsBuilder.build({
            images
        })
        const { thumbnails, diagnostics: thumbnailDiagnostics } =
            SchematicThumbnailParser.parse(arrayBuffer)
        const template = SchematicTemplateParser.parse(
            recordIndexAwareRecords,
            sheetRecord,
            sheet
        )

        const ports = parseSchematicPorts(portRecords, lines)
        const crosses = parseSchematicCrosses(crossRecords)
        let texts = drawableTextRecords
            .map((record) =>
                normalizeSchematicTextRecord(
                    record.fields,
                    metadataTexts,
                    sheet,
                    schematicFonts,
                    ownerMetadataTexts,
                    footerOwnerIndexes
                )
            )
            .filter(Boolean)
        const normalizedStandaloneCallouts =
            SchematicStandaloneCalloutNormalizer.normalize(lines, texts)
        const normalizedLines = normalizedStandaloneCallouts.lines
        texts = normalizedStandaloneCallouts.texts
        texts = SchematicTextPostProcessor.dropDuplicatePortLabels(texts, ports)
        texts = SchematicTextPostProcessor.decorateMultipartDesignators(
            texts,
            activeMultipartOwnerParts
        )
        texts.push(
            ...buildSchematicSyntheticTexts(
                records,
                pins,
                schematicFonts
            ).filter(
                (syntheticText) =>
                    !texts.some(
                        (text) =>
                            text.text === syntheticText.text &&
                            Math.abs(text.x - syntheticText.x) <= 80 &&
                            Math.abs(text.y - syntheticText.y) <= 20
                    )
            )
        )
        const anchoredTexts =
            SchematicTextPostProcessor.anchorWireLabelsNearDesignators(
                SchematicTextPostProcessor.anchorComponentTextsFromOwnerBounds(
                    texts,
                    normalizedLines,
                    pins,
                    ports,
                    {
                        rectangles,
                        roundedRectangles,
                        ellipses,
                        arcs,
                        pies
                    }
                ),
                normalizedLines,
                pins,
                ports
            )
        const textFrames =
            SchematicTextParser.extractSchematicTextFrames(anchoredTexts)

        const components = componentRecords.map((record) => {
            const x = parseNumericField(record.fields, 'Location.X') || 0
            const y = parseNumericField(record.fields, 'Location.Y') || 0
            const libReference =
                getField(record.fields, 'LibReference') ||
                getField(record.fields, 'DesignItemId')
            const ownerTexts =
                SchematicComponentOwnerTextResolver.resolveOwnerTexts(
                    record,
                    recordIndexAwareRecords,
                    relatedTexts
                )

            const designator = SchematicComponentTextResolver.resolveDesignator(
                ownerTexts,
                anchoredTexts,
                {
                    x,
                    y,
                    libReference
                }
            )

            return {
                x,
                y,
                libReference,
                designator: designator === null ? 'U?' : designator,
                value: SchematicComponentTextResolver.resolveValue(
                    ownerTexts,
                    anchoredTexts,
                    { x, y, libReference }
                ),
                uniqueId: getField(record.fields, 'UniqueID')
            }
        })
        const resolvedSheet = AltiumLayoutParser.resolveSchematicSheetSize(
            sheet,
            textRecords,
            normalizedLines,
            anchoredTexts,
            components,
            pins,
            rectangles,
            regions,
            ports,
            crosses
        )
        const componentDesignatorsByOwnerIndex =
            AltiumParser.#componentDesignatorsByOwnerIndex(
                recordIndexAwareRecords,
                componentRecords,
                components
            )

        resolvedSheet.xZones =
            SchematicSheetStyleResolver.resolveXZones(resolvedSheet)
        resolvedSheet.yZones =
            SchematicSheetStyleResolver.resolveYZones(resolvedSheet)
        delete resolvedSheet.sheetStyle
        const hyperlinks = SchematicHyperlinkParser.parse(
            recordIndexAwareRecords,
            resolvedSheet
        )

        const title =
            AltiumParser.#findNamedText(textRecords, 'Title') ||
            stripExtension(fileName)
        const bom = AltiumParser.#groupBomRows(
            components.map((component) => ({
                designator: component.designator,
                pattern: '',
                source: component.libReference,
                value: component.value || component.libReference
            }))
        )

        const diagnostics = [
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    records.length +
                    ' printable schematic records.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' + components.length + ' schematic components.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    normalizedLines.length +
                    ' drawable line segments.'
            }
        ]

        if (!sheetRecord) {
            diagnostics.push({
                severity: 'warning',
                message:
                    'Sheet metadata record 31 was not found. Using fallback dimensions.'
            })
        }
        diagnostics.push(
            ...schematicRenderDiagnostics.fontFallbacks.map((fallback) => ({
                severity: fallback.severity,
                code: fallback.code,
                fontId: fallback.fontId,
                sourceFamily: fallback.sourceFamily,
                resolvedFamily: fallback.resolvedFamily,
                message: fallback.message
            }))
        )
        diagnostics.push(...imageDiagnostics)
        diagnostics.push(...thumbnailDiagnostics)
        const { nets, diagnostics: netDiagnostics } =
            SchematicNetlistBuilder.build({
                lines: normalizedLines,
                texts: anchoredTexts,
                pins,
                ports,
                crossSheetConnectors: crossSheetConnectors?.connectors || [],
                junctions,
                busEntries,
                sheetEntries,
                componentDesignatorsByOwnerIndex
            })
        AltiumParser.#suppressRedundantSinglePinPowerNetNames(
            pins,
            nets,
            anchoredTexts
        )
        diagnostics.push(...netDiagnostics)
        const qa = SchematicQaReportBuilder.build({
            records: recordIndexAwareRecords,
            sheet: resolvedSheet,
            lines: normalizedLines,
            texts: anchoredTexts
        })
        const connectivityQa = SchematicConnectivityQaBuilder.build({
            nets,
            lines: normalizedLines,
            texts: anchoredTexts,
            pins,
            ports,
            junctions,
            sheetEntries,
            harnesses
        })
        const embeddedFiles = schematicExtraction?.embeddedFiles || null
        const nativeStreams = schematicExtraction?.nativeStreams || null
        const opaqueRecords = Array.isArray(schematicExtraction?.opaqueRecords)
            ? schematicExtraction.opaqueRecords
            : []

        if (embeddedFiles?.diagnostics?.length) {
            diagnostics.push(
                ...embeddedFiles.diagnostics.map((issue) => ({
                    severity: issue.severity === 'info' ? 'info' : 'warning',
                    code: issue.code,
                    message: issue.message
                }))
            )
        }

        const documentModel = NormalizedModelSchema.attach({
            kind: 'schematic',
            fileType: 'SchDoc',
            fileName,
            summary: {
                title,
                componentCount: components.length,
                lineCount: lines.length,
                textCount: anchoredTexts.length,
                ...(hyperlinks.length
                    ? { hyperlinkCount: hyperlinks.length }
                    : {}),
                recordTypeCount: recordTypes.length,
                bomRowCount: bom.length,
                ...(nativeStreams?.summary?.streamCount
                    ? {
                          nativeStreamCount: nativeStreams.summary.streamCount
                      }
                    : {}),
                opaqueRecordCount: opaqueRecords.length
            },
            diagnostics,
            schematic: {
                sheet: resolvedSheet,
                recordTypes,
                ...(schematicRenderDiagnostics.fontFallbacks.length
                    ? { renderDiagnostics: schematicRenderDiagnostics }
                    : {}),
                lines: normalizedLines,
                polygons,
                rectangles,
                roundedRectangles,
                regions,
                ellipses,
                arcs,
                beziers,
                pies,
                ieeeSymbols,
                directives,
                directiveSemantics,
                texts: anchoredTexts,
                textFrames,
                ...(hyperlinks.length ? { hyperlinks } : {}),
                components,
                pins,
                ports,
                crosses,
                sheetSymbols: sheetSymbols.map(
                    ({ sourceRecordIndex, indexInSheet, ...sheetSymbol }) =>
                        sheetSymbol
                ),
                sheetEntries,
                junctions,
                busEntries,
                images,
                imageDiagnostics: imageDiagnosticsReport,
                ...(thumbnails.length ? { thumbnails } : {}),
                nets,
                ownership,
                ...(template ? { template } : {}),
                ...(harnesses ? { harnesses } : {}),
                ...(implementations ? { implementations } : {}),
                ...(codeSymbols ? { codeSymbols } : {}),
                ...(displayModes ? { displayModes } : {}),
                ...(bindings ? { bindings } : {}),
                ...(crossSheetConnectors ? { crossSheetConnectors } : {}),
                ...(repeatedChannels ? { repeatedChannels } : {}),
                ...(embeddedFiles &&
                (embeddedFiles.files?.length ||
                    embeddedFiles.diagnostics?.length)
                    ? { embeddedFiles }
                    : {}),
                ...(nativeStreams ? { nativeStreams } : {}),
                ...(opaqueRecords.length ? { opaqueRecords } : {}),
                qa,
                connectivityQa
            },
            bom
        })

        return AltiumParser.#prepareSchematicDocument(
            documentModel,
            arrayBuffer
        )
    }

    /**
     * Applies universal schematic post-processing after the parser has built
     * the normalized renderer model.
     * @param {object} documentModel Parsed schematic document model.
     * @param {ArrayBuffer} arrayBuffer Source file buffer.
     * @returns {object}
     */
    static #prepareSchematicDocument(documentModel, arrayBuffer) {
        return AltiumSchematicPackedImageResolver.hydrate(
            AltiumSchematicFreeGraphicStrokeNormalizer.normalize(
                AltiumSchematicSheetBoundsNormalizer.normalize(
                    AltiumSchematicArcAngleNormalizer.normalize(
                        AltiumSchematicHiddenDesignatorResolver.annotate(
                            documentModel,
                            arrayBuffer
                        )
                    )
                )
            ),
            arrayBuffer
        )
    }

    /**
     * Maps native component owner indexes to resolved component designators.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Indexed schematic records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} componentRecords Component records.
     * @param {{ designator?: string }[]} components Normalized components.
     * @returns {Map<string, string>}
     */
    static #componentDesignatorsByOwnerIndex(
        records,
        componentRecords,
        components
    ) {
        const designatorsByOwnerIndex = new Map()

        for (let index = 0; index < componentRecords.length; index += 1) {
            const designator = String(
                components[index]?.designator || ''
            ).trim()

            if (!designator) {
                continue
            }

            for (const ownerIndex of SchematicComponentOwnerTextResolver.resolveOwnerIndexes(
                componentRecords[index],
                records
            )) {
                const key = String(ownerIndex || '').trim()
                if (key && !designatorsByOwnerIndex.has(key)) {
                    designatorsByOwnerIndex.set(key, designator)
                }
            }
        }

        return designatorsByOwnerIndex
    }

    /**
     * Hides one-pin owner pin names when a connected power port already labels
     * the same net, preserving the numeric pin endpoint label.
     * @param {{ ownerIndex?: string, name?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[]} pins
     * @param {{ powerPorts?: { text?: string }[], pins?: { ownerIndex?: string, name?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[] }[]} nets
     * @param {{ x: number, y: number, text?: string, recordType?: string }[]} texts
     * @returns {void}
     */
    static #suppressRedundantSinglePinPowerNetNames(pins, nets, texts = []) {
        const ownerPinCounts = new Map()

        for (const pin of pins || []) {
            const ownerIndex = String(pin.ownerIndex || '').trim()

            if (!ownerIndex) continue

            ownerPinCounts.set(
                ownerIndex,
                (ownerPinCounts.get(ownerIndex) || 0) + 1
            )
        }

        for (const net of nets || []) {
            const powerPortNames = new Set(
                (net.powerPorts || [])
                    .map((powerPort) =>
                        AltiumParser.#normalizePowerNetLabel(powerPort.text)
                    )
                    .filter(Boolean)
            )

            if (!powerPortNames.size) continue

            for (const pin of net.pins || []) {
                if (
                    AltiumParser.#canSuppressSinglePinName(
                        pin,
                        ownerPinCounts
                    ) &&
                    powerPortNames.has(
                        AltiumParser.#normalizePowerNetLabel(pin.name)
                    )
                ) {
                    AltiumParser.#setPinLabelMode(pin, pins, 'number-only')
                }
            }
        }

        const powerPorts = (texts || []).filter(
            (text) => text?.recordType === '17'
        )

        for (const pin of pins || []) {
            if (!AltiumParser.#canSuppressSinglePinName(pin, ownerPinCounts)) {
                continue
            }

            const pinName = AltiumParser.#normalizePowerNetLabel(pin.name)
            const connectionPoint = AltiumParser.#resolvePinConnectionPoint(pin)
            const matchesDirectPowerPort = powerPorts.some(
                (powerPort) =>
                    pinName ===
                        AltiumParser.#normalizePowerNetLabel(powerPort.text) &&
                    AltiumParser.#pointsAreNear(connectionPoint, powerPort, 2)
            )

            if (matchesDirectPowerPort) {
                AltiumParser.#setPinLabelMode(pin, pins, 'number-only')
            }
        }
    }

    /**
     * Updates a net pin and its matching top-level pin when both are present.
     * @param {object} pin Net or top-level pin.
     * @param {object[]} pins Top-level pins.
     * @param {'hidden' | 'number-only' | 'name-only' | 'name-and-number'} labelMode New label mode.
     * @returns {void}
     */
    static #setPinLabelMode(pin, pins, labelMode) {
        pin.labelMode = labelMode

        const sourcePin = (pins || []).find((candidate) =>
            AltiumParser.#pinsReferToSameSource(candidate, pin)
        )

        if (sourcePin) {
            sourcePin.labelMode = labelMode
        }
    }

    /**
     * Returns true when two pin rows describe the same native source pin.
     * @param {object} left First pin.
     * @param {object} right Second pin.
     * @returns {boolean}
     */
    static #pinsReferToSameSource(left, right) {
        if (left === right) {
            return true
        }

        return (
            String(left?.ownerIndex || '') ===
                String(right?.ownerIndex || '') &&
            String(left?.designator || '') ===
                String(right?.designator || '') &&
            String(left?.name || '') === String(right?.name || '') &&
            AltiumParser.#pointsAreNear(left, right, 0.01)
        )
    }

    /**
     * Returns true when a pin is the only pin on its owner and currently shows
     * a name label.
     * @param {{ ownerIndex?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }} pin
     * @param {Map<string, number>} ownerPinCounts
     * @returns {boolean}
     */
    static #canSuppressSinglePinName(pin, ownerPinCounts) {
        const ownerIndex = String(pin?.ownerIndex || '').trim()
        const labelMode = pin?.labelMode || 'name-and-number'

        return (
            ownerIndex &&
            ownerPinCounts.get(ownerIndex) === 1 &&
            labelMode !== 'hidden' &&
            labelMode !== 'number-only'
        )
    }

    /**
     * Resolves the outer electrical endpoint for a normalized schematic pin.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ x: number, y: number }}
     */
    static #resolvePinConnectionPoint(pin) {
        switch (pin.orientation) {
            case 'right':
                return { x: pin.x + pin.length, y: pin.y }
            case 'top':
                return { x: pin.x, y: pin.y + pin.length }
            case 'bottom':
                return { x: pin.x, y: pin.y - pin.length }
            case 'left':
            default:
                return { x: pin.x - pin.length, y: pin.y }
        }
    }

    /**
     * Returns true when two schematic points are close enough to represent the
     * same recovered connection endpoint.
     * @param {{ x: number, y: number }} left
     * @param {{ x: number, y: number }} right
     * @param {number} tolerance
     * @returns {boolean}
     */
    static #pointsAreNear(left, right, tolerance) {
        return (
            Math.abs(Number(left.x) - Number(right.x)) <= tolerance &&
            Math.abs(Number(left.y) - Number(right.y)) <= tolerance
        )
    }

    /**
     * Normalizes a power-net label for structural comparisons.
     * @param {string | undefined} label
     * @returns {string}
     */
    static #normalizePowerNetLabel(label) {
        return String(label || '')
            .trim()
            .toUpperCase()
    }

    /**
     * Finds a visible text string with a given logical name.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {string} logicalName
     * @returns {string}
     */
    static #findNamedText(records, logicalName) {
        const match = records.find(
            (record) =>
                getField(record.fields, 'Name').toLowerCase() ===
                logicalName.toLowerCase()
        )
        return match ? getDisplayText(match.fields) : ''
    }

    /**
     * Collects owners whose active symbol primitives already exist without an
     * explicit display-mode selector.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Set<string>}
     */
    static #collectOwnersWithImplicitDisplayMode(records) {
        const owners = new Set()
        for (const record of records) {
            const ownerIndex = getField(record.fields, 'OwnerIndex')
            const ownerPartId = getField(record.fields, 'OwnerPartId')

            if (
                ownerIndex &&
                ownerPartId &&
                ownerPartId !== '-1' &&
                !getField(record.fields, 'OwnerPartDisplayMode') &&
                SchematicComponentOwnerTextResolver.isDisplayModeSelectablePrimitive(
                    record.fields
                )
            ) {
                owners.add(ownerIndex)
            }
        }

        return owners
    }

    /**
     * Maps component owner indexes to their active display mode.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} componentRecords
     * @returns {Map<string, number>}
     */
    static #collectActiveOwnerDisplayModes(records, componentRecords) {
        const activeDisplayModes = new Map()

        for (const componentRecord of componentRecords) {
            const displayMode =
                parseNumericField(componentRecord.fields, 'DisplayMode') || 1
            const displayModeCount =
                parseNumericField(componentRecord.fields, 'DisplayModeCount') ||
                0
            const ownerIndexes = AltiumParser.#componentOwnerIndexCandidates(
                records,
                componentRecord
            )

            if (displayModeCount <= 1 && !ownerIndexes.size) {
                continue
            }

            for (const ownerIndex of ownerIndexes) {
                activeDisplayModes.set(ownerIndex, displayMode)
            }
        }

        return activeDisplayModes
    }

    /**
     * Resolves owner indexes that may point at one component placement.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }} componentRecord
     * @returns {Set<string>}
     */
    static #componentOwnerIndexCandidates(records, componentRecord) {
        const ownerIndexes = new Set()
        const indexInSheet = parseNumericField(
            componentRecord.fields,
            'IndexInSheet'
        )

        if (indexInSheet !== null) {
            ownerIndexes.add(String(indexInSheet))
        }
        if (Number.isInteger(componentRecord.recordIndex)) {
            ownerIndexes.add(String(componentRecord.recordIndex))
        }

        for (const ownerIndex of AltiumParser.#serializedOwnerDisplayModeIndexes(
            records,
            componentRecord.recordIndex
        )) {
            ownerIndexes.add(ownerIndex)
        }

        return ownerIndexes
    }

    /**
     * Collects display-mode owner indexes serialized after one component record.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {number | undefined} componentRecordIndex
     * @returns {Set<string>}
     */
    static #serializedOwnerDisplayModeIndexes(records, componentRecordIndex) {
        const ownerIndexes = new Set()
        if (!Number.isInteger(componentRecordIndex)) {
            return ownerIndexes
        }

        for (
            let index = componentRecordIndex + 1;
            index < records.length;
            index += 1
        ) {
            const record = records[index]
            if (getField(record.fields, 'RECORD') === '1') {
                break
            }

            if (!getField(record.fields, 'OwnerPartDisplayMode')) {
                continue
            }

            const ownerIndex = getField(record.fields, 'OwnerIndex')
            if (ownerIndex) {
                ownerIndexes.add(ownerIndex)
            }
        }

        return ownerIndexes
    }

    /**
     * Collects symbol owners that draw an inaccessible body around compact
     * internal pins.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Set<string>}
     */
    static #collectInaccessibleOwnerDrawnPrimitiveOwners(records) {
        const owners = new Set()

        for (const record of records) {
            const ownerIndex = getField(record.fields, 'OwnerIndex')
            const ownerPartId = getField(record.fields, 'OwnerPartId')

            if (
                ownerIndex &&
                ownerPartId &&
                ownerPartId !== '-1' &&
                parseBoolean(record.fields.IsNotAccesible) &&
                SchematicComponentOwnerTextResolver.isDisplayModeSelectablePrimitive(
                    record.fields
                )
            ) {
                owners.add(ownerIndex)
            }
        }

        return owners
    }

    /**
     * Collects component owners whose passive two-pin numeric endpoints are
     * intended to remain visible in the schematic body.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} componentRecords Component records.
     * @param {{ fields: Record<string, string | string[]>, recordIndex?: number }[]} records Indexed schematic records.
     * @returns {Set<string>}
     */
    static #collectNumericEndpointLabelOwners(componentRecords, records) {
        const owners = new Set()

        for (const componentRecord of componentRecords) {
            if (
                parseNumericField(componentRecord.fields, 'ComponentKind') !== 4
            ) {
                continue
            }

            for (const ownerIndex of SchematicComponentOwnerTextResolver.resolveOwnerIndexes(
                componentRecord,
                records
            )) {
                owners.add(ownerIndex)
            }
        }

        return owners
    }

    /**
     * Returns true when one schematic record belongs to the active symbol
     * display mode for its owner.
     * @param {Record<string, string | string[]>} fields
     * @param {Set<string>} ownersWithImplicitDisplayMode
     * @param {Map<string, number>} activeOwnerDisplayModes
     * @returns {boolean}
     */
    static #isActiveSchematicDisplayModeRecord(
        fields,
        ownersWithImplicitDisplayMode,
        activeOwnerDisplayModes
    ) {
        const ownerIndex = getField(fields, 'OwnerIndex')
        const ownerPartDisplayMode = parseNumericField(
            fields,
            'OwnerPartDisplayMode'
        )
        if (!ownerIndex || ownerPartDisplayMode === null) {
            return true
        }

        if (ownersWithImplicitDisplayMode.has(ownerIndex)) {
            return false
        }

        const activeDisplayMode = activeOwnerDisplayModes.get(ownerIndex)
        if (activeDisplayMode !== undefined) {
            return ownerPartDisplayMode === activeDisplayMode
        }

        return true
    }

    /**
     * Returns true when one schematic record belongs to both the active
     * display mode and the active multipart owner part for its owner.
     * @param {Record<string, string | string[]>} fields
     * @param {Set<string>} ownersWithImplicitDisplayMode
     * @param {Map<string, number>} activeOwnerDisplayModes
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {boolean}
     */
    static #isDrawableSchematicRecord(
        fields,
        ownersWithImplicitDisplayMode,
        activeOwnerDisplayModes,
        activeMultipartOwnerParts
    ) {
        return (
            AltiumParser.#isActiveSchematicDisplayModeRecord(
                fields,
                ownersWithImplicitDisplayMode,
                activeOwnerDisplayModes
            ) &&
            SchematicMultipartOwnerMatcher.isActiveOwnerPartRecord(
                fields,
                activeMultipartOwnerParts
            )
        )
    }

    /**
     * Groups designators into BOM rows.
     * @param {{ designator: string, pattern: string, source: string, value: string }[]} entries
     * @returns {{ designators: string[], quantity: number, pattern: string, source: string, value: string }[]}
     */
    static #groupBomRows(entries) {
        const groups = new Map()

        for (const entry of entries) {
            const key = [entry.pattern, entry.source, entry.value].join('::')
            if (!groups.has(key)) {
                groups.set(key, {
                    designators: [],
                    quantity: 0,
                    pattern: entry.pattern,
                    source: entry.source,
                    value: entry.value
                })
            }

            const row = groups.get(key)
            row.designators.push(entry.designator)
            row.quantity += 1
        }

        return [...groups.values()]
            .map((row) => ({
                ...row,
                designators: row.designators.sort((left, right) =>
                    left.localeCompare(right, undefined, { numeric: true })
                )
            }))
            .sort((left, right) =>
                left.designators[0].localeCompare(
                    right.designators[0],
                    undefined,
                    {
                        numeric: true
                    }
                )
            )
    }

    /**
     * Returns true when a record has a text payload.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static #hasDisplayText(fields) {
        return Boolean(getDisplayText(fields) || getField(fields, 'Text'))
    }

    /**
     * Returns true when both X and Y exist for a point prefix.
     * @param {Record<string, string | string[]>} fields
     * @param {string} prefix
     * @returns {boolean}
     */
    static #hasCoordinatePair(fields, prefix) {
        return (
            parseNumericField(fields, prefix + '.X') !== null &&
            parseNumericField(fields, prefix + '.Y') !== null
        )
    }
}
