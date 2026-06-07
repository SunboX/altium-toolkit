// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { PcbBoardRegionSemanticsParser } from './PcbBoardRegionSemanticsParser.mjs'
import { PcbBomProfileBuilder } from './PcbBomProfileBuilder.mjs'
import { PcbComponentAnnotationNormalizer } from './PcbComponentAnnotationNormalizer.mjs'
import { PcbComponentBodyPlacementNormalizer } from './PcbComponentBodyPlacementNormalizer.mjs'
import { PcbComponentKindPolicy } from './PcbComponentKindPolicy.mjs'
import { PcbComponentPrimitiveIndexer } from './PcbComponentPrimitiveIndexer.mjs'
import { PcbCustomPadShapeParser } from './PcbCustomPadShapeParser.mjs'
import { PcbDimensionParser } from './PcbDimensionParser.mjs'
import { PcbLayerStackReadModelBuilder } from './PcbLayerStackReadModelBuilder.mjs'
import { PcbMechanicalLayerPairParser } from './PcbMechanicalLayerPairParser.mjs'
import { PcbDefaultsParser } from './PcbDefaultsParser.mjs'
import { PcbMaskPasteResolver } from './PcbMaskPasteResolver.mjs'
import { PcbOutlineRecovery } from './PcbOutlineRecovery.mjs'
import { PcbOwnershipGraphBuilder } from './PcbOwnershipGraphBuilder.mjs'
import { PcbPlacedFootprintManifestBuilder } from './PcbPlacedFootprintManifestBuilder.mjs'
import { PcbPickPlacePositionResolver } from './PcbPickPlacePositionResolver.mjs'
import { PcbPolygonRecordParser } from './PcbPolygonRecordParser.mjs'
import { PcbReviewMetadataBuilder } from './PcbReviewMetadataBuilder.mjs'
import { PcbRigidFlexTopologyBuilder } from './PcbRigidFlexTopologyBuilder.mjs'
import { PcbRouteAnalysisBuilder } from './PcbRouteAnalysisBuilder.mjs'
import { PcbRuleParser } from './PcbRuleParser.mjs'
import { PcbSpecialStringResolver } from './PcbSpecialStringResolver.mjs'
import { PcbStatisticsBuilder } from './PcbStatisticsBuilder.mjs'
import { ParserUtils } from './ParserUtils.mjs'

const {
    countMatchingKeys,
    dedupeByDesignator,
    getField,
    parseBoolean,
    parseNumericField,
    stripExtension,
    toColor
} = ParserUtils

/**
 * Normalizes PCB records into the viewer's board model.
 */
export class PcbModelParser {
    /**
     * Parses a normalized PCB model.
     *
     * When Nets6/Data is present, the model exposes native net definitions and
     * resolved primitive netName fields keyed by numeric netIndex values.
     * @param {string} fileName
     * @param {{ raw: string, fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @param {{ streamNames: string[], binaryPrimitives: Record<string, object[]>, primitiveParameters?: object, viaStructures?: object, customPadShapes?: object, extendedPrimitiveInformation?: object, unions?: object, diagnostics: { printableRecordCount: number, printableStreamCount: number, binaryPrimitiveCount: number } } | null} pcbExtraction
     * @returns {{ schema: string, kind: 'pcb', fileType: 'PcbDoc', fileName: string, summary: Record<string, number | string>, diagnostics: { severity: 'info' | 'warning', message: string }[], pcb: Record<string, unknown>, bom: { designators: string[], quantity: number, pattern: string, source: string, value: string }[] }}
     */
    static parse(fileName, records, pcbExtraction = null) {
        const boardRecords = records.filter(
            (record) => record.sourceStream === 'Board6/Data'
        )
        const boardRecord =
            boardRecords.find(
                (record) =>
                    getField(record.fields, 'KIND0') &&
                    record.sourceStream === 'Board6/Data'
            ) || records.find((record) => getField(record.fields, 'KIND0'))
        const layerRecord =
            boardRecords.find(
                (record) =>
                    countMatchingKeys(
                        record.fields,
                        /^V9_STACK_LAYER\d+_NAME$/
                    ) > 0 && record.sourceStream === 'Board6/Data'
            ) ||
            records.find(
                (record) =>
                    countMatchingKeys(
                        record.fields,
                        /^V9_STACK_LAYER\d+_NAME$/
                    ) > 0
            )
        const rawTextPrimitives = pcbExtraction?.binaryPrimitives?.texts || []
        const rawComponentRecords =
            PcbComponentAnnotationNormalizer.enrichComponents(
                PcbModelParser.#normalizeComponentRecords(
                    PcbModelParser.#selectComponentRecords(records)
                ),
                rawTextPrimitives,
                pcbExtraction?.primitiveParameters
            )
        const componentRecords = dedupeByDesignator(
            rawComponentRecords.map((component) =>
                PcbModelParser.#publicComponentRecord(component)
            )
        )
        const fallbackBoardOutline = AltiumLayoutParser.parseBoardOutline(
            boardRecord?.fields || {}
        )
        const layers = AltiumLayoutParser.parseLayerStack(
            layerRecord?.fields || {}
        )
        const layerSubstacks =
            PcbBoardRegionSemanticsParser.parseLayerSubstacks(
                boardRecords.map((record) => record.fields)
            )
        const primitiveLayers = AltiumLayoutParser.parsePrimitiveLayerNames(
            boardRecords.map((record) => record.fields)
        )
        const mechanicalLayerPairs = PcbMechanicalLayerPairParser.parse(
            boardRecords.map((record) => record.fields),
            layers,
            primitiveLayers
        )
        const layerFlipMetadata =
            PcbMechanicalLayerPairParser.buildFlipMetadata(mechanicalLayerPairs)
        const appearance3d = PcbModelParser.#parseAppearance3d(boardRecords)
        const nets = PcbModelParser.#parseNetRecords(records)
        const netNameByIndex = PcbModelParser.#buildNetNameMap(nets)
        const classes = PcbModelParser.#parseClassRecords(records)
        const differentialPairData = PcbModelParser.#buildDifferentialPairData(
            PcbModelParser.#parseDifferentialPairRecords(records),
            classes
        )
        const rules = PcbRuleParser.parse(records)
        const defaults = PcbDefaultsParser.parse(
            boardRecord?.fields || {},
            'pcb-document'
        )
        const dimensions = PcbDimensionParser.parse(records)
        const polygons = PcbPolygonRecordParser.parse(records)
        const tracks = PcbModelParser.#annotatePrimitiveNetNames(
            pcbExtraction?.binaryPrimitives?.tracks || [],
            netNameByIndex
        )
        const arcs = PcbModelParser.#annotatePrimitiveNetNames(
            pcbExtraction?.binaryPrimitives?.arcs || [],
            netNameByIndex
        )
        const vias = PcbModelParser.#annotatePrimitiveNetNames(
            pcbExtraction?.binaryPrimitives?.vias || [],
            netNameByIndex
        )
        const fills = PcbModelParser.#annotatePrimitiveNetNames(
            pcbExtraction?.binaryPrimitives?.fills || [],
            netNameByIndex
        )
        const pads = PcbModelParser.#annotatePrimitiveNetNames(
            pcbExtraction?.binaryPrimitives?.pads || [],
            netNameByIndex
        )
        const regions = PcbModelParser.#annotatePrimitiveNetNames(
            pcbExtraction?.binaryPrimitives?.regions || [],
            netNameByIndex
        )
        const shapeBasedRegions = PcbModelParser.#annotatePrimitiveNetNames(
            pcbExtraction?.binaryPrimitives?.shapeBasedRegions || [],
            netNameByIndex
        )
        const boardRegions = PcbBoardRegionSemanticsParser.enrichBoardRegions(
            PcbModelParser.#annotatePrimitiveNetNames(
                pcbExtraction?.binaryPrimitives?.boardRegions || [],
                netNameByIndex
            ),
            layerSubstacks
        )
        const extractedEmbeddedModels = Array.isArray(
            pcbExtraction?.embeddedModels?.models
        )
            ? pcbExtraction.embeddedModels.models
            : []
        const extractedComponentBodies = Array.isArray(
            pcbExtraction?.embeddedModels?.componentBodies
        )
            ? pcbExtraction.embeddedModels.componentBodies
            : []
        const extractedEmbeddedFonts = Array.isArray(
            pcbExtraction?.embeddedFonts?.fonts
        )
            ? pcbExtraction.embeddedFonts.fonts
            : []
        const embeddedFiles = pcbExtraction?.embeddedFiles || {
            schema: 'altium-toolkit.embedded-files.a1',
            files: [],
            diagnostics: []
        }
        const embeddedModelIntegrity = pcbExtraction?.embeddedModels
            ?.integrity || {
            schema: 'altium-toolkit.pcb.embedded-model-integrity.a1',
            issues: []
        }
        const rawRecords = Array.isArray(pcbExtraction?.rawRecords)
            ? pcbExtraction.rawRecords
            : []
        const viaStructures = pcbExtraction?.viaStructures || {
            structures: [],
            links: [],
            byPrimitiveIndex: {}
        }
        const customPadShapes = pcbExtraction?.customPadShapes || {
            entries: [],
            byPrimitiveIndex: {}
        }
        const extendedPrimitiveInformation =
            pcbExtraction?.extendedPrimitiveInformation || {
                entries: [],
                byPrimitiveIndex: {},
                byPrimitiveKey: {}
            }
        const unions = pcbExtraction?.unions || {
            userUnions: [],
            smartUnions: [],
            byIndex: {},
            smartByIndex: {},
            membersByPrimitiveKey: {}
        }
        const texts = PcbSpecialStringResolver.annotateTexts(
            PcbModelParser.#annotateTextFontMetrics(
                PcbComponentAnnotationNormalizer.normalizeTexts(
                    rawTextPrimitives,
                    rawComponentRecords
                ),
                extractedEmbeddedFonts
            ),
            pcbExtraction?.specialStringParameters || {}
        )
        const recoveredOutline = PcbOutlineRecovery.recoverOutline({
            fallbackOutline: fallbackBoardOutline,
            components: componentRecords,
            tracks
        })
        const boardOutline = recoveredOutline.outline
        const normalizedPcb = PcbOutlineRecovery.flipGeometryVertically({
            boardOutline,
            polygons,
            fills,
            tracks,
            arcs,
            vias,
            pads,
            regions,
            shapeBasedRegions,
            boardRegions,
            texts,
            components: componentRecords
        })
        PcbCustomPadShapeParser.attachToPads(
            normalizedPcb.pads,
            customPadShapes,
            normalizedPcb
        )
        const boardRegionContexts =
            PcbBoardRegionSemanticsParser.buildBoardRegionContexts(
                normalizedPcb.boardRegions
            )
        const boardRegionSummary =
            PcbBoardRegionSemanticsParser.summarizeBoardRegions(
                normalizedPcb.boardRegions
            )
        const layerStackReadModel = PcbLayerStackReadModelBuilder.build({
            fileName,
            boardRecords,
            streamNames: pcbExtraction?.streamNames || [],
            layers,
            primitiveLayers,
            layerSubstacks,
            boardRegions: normalizedPcb.boardRegions
        })
        const rigidFlexTopology =
            PcbRigidFlexTopologyBuilder.build(layerStackReadModel)
        const componentBodies =
            PcbComponentBodyPlacementNormalizer.normalizeComponentBodies(
                extractedComponentBodies,
                boardOutline
            )
        const componentPrimitiveGroups =
            PcbComponentPrimitiveIndexer.buildGroups(
                normalizedPcb.components,
                normalizedPcb,
                componentBodies
            )
        const componentPrimitives = PcbComponentPrimitiveIndexer.indexGroups(
            componentPrimitiveGroups
        )
        const ownership = PcbOwnershipGraphBuilder.build({
            ...normalizedPcb,
            nets
        })
        const pnp = PcbPickPlacePositionResolver.buildModel(
            normalizedPcb.components,
            componentPrimitiveGroups,
            { sourceComponents: componentRecords }
        )
        const routeAnalysis = PcbRouteAnalysisBuilder.build({
            ...normalizedPcb,
            layers,
            primitiveLayers,
            nets,
            classes,
            differentialPairs: differentialPairData.differentialPairs,
            differentialPairClasses:
                differentialPairData.differentialPairClasses
        })
        const reviewMetadata = PcbReviewMetadataBuilder.build({
            routeAnalysis,
            embeddedModels: extractedEmbeddedModels,
            componentBodies,
            layers,
            primitiveLayers,
            polygons: normalizedPcb.polygons,
            tracks: normalizedPcb.tracks,
            arcs: normalizedPcb.arcs,
            fills: normalizedPcb.fills,
            vias: normalizedPcb.vias,
            pads: normalizedPcb.pads,
            regions: normalizedPcb.regions,
            shapeBasedRegions: normalizedPcb.shapeBasedRegions
        })
        const footprintExtractionManifest =
            PcbPlacedFootprintManifestBuilder.build({
                fileName,
                components: normalizedPcb.components,
                componentPrimitiveGroups,
                embeddedModels: extractedEmbeddedModels
            })
        const statistics = PcbStatisticsBuilder.build({
            ...normalizedPcb,
            layers,
            primitiveLayers,
            rules
        })
        const maskPaste = PcbMaskPasteResolver.build({
            pads: normalizedPcb.pads,
            vias: normalizedPcb.vias,
            rules,
            defaults
        })
        const bom = PcbModelParser.#groupBomRows(
            componentRecords
                .filter(
                    (component) =>
                        component.componentKind?.includeInBom !== false
                )
                .map((component) => ({
                    designator: component.designator,
                    pattern: component.pattern,
                    source: component.source,
                    value: component.description || component.pattern
                }))
        )
        const bomProfile = PcbBomProfileBuilder.build(componentRecords, {
            source: 'pcb-document'
        })

        const diagnostics = [
            {
                severity: 'info',
                message:
                    'Recovered ' + records.length + ' printable PCB records.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    componentRecords.length +
                    ' PCB component placements.'
            },
            {
                severity: 'info',
                message: 'Recovered ' + layers.length + ' layer stack entries.'
            },
            {
                severity: 'info',
                message: 'Recovered ' + nets.length + ' PCB net definitions.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' + classes.length + ' PCB class definitions.'
            },
            {
                severity: 'info',
                message: 'Recovered ' + rules.length + ' PCB design rules.'
            }
        ]

        if (boardRegionSummary.boardRegionCount) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    boardRegionSummary.boardRegionCount +
                    ' board planning ' +
                    PcbModelParser.#plural(
                        boardRegionSummary.boardRegionCount,
                        'region',
                        'regions'
                    ) +
                    ' and ' +
                    boardRegionSummary.bendingLineCount +
                    ' bending ' +
                    PcbModelParser.#plural(
                        boardRegionSummary.bendingLineCount,
                        'line',
                        'lines'
                    ) +
                    '.'
            })
        }

        for (const issue of layerStackReadModel?.diagnostics || []) {
            diagnostics.push({
                severity: issue.severity || 'warning',
                code: issue.code,
                message: issue.message
            })
        }

        for (const issue of rigidFlexTopology?.diagnostics || []) {
            diagnostics.push({
                severity: issue.severity || 'warning',
                code: issue.code,
                message: issue.message
            })
        }

        if (pcbExtraction) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    pcbExtraction.streamNames.length +
                    ' PCB data streams from the compound document.'
            })
            diagnostics.push({
                severity: 'info',
                message:
                    'Decoded ' +
                    tracks.length +
                    ' tracks, ' +
                    arcs.length +
                    ' arcs, ' +
                    vias.length +
                    ' vias, ' +
                    pads.length +
                    ' pads, ' +
                    texts.length +
                    ' texts, and ' +
                    regions.length +
                    ' regions, ' +
                    shapeBasedRegions.length +
                    ' shape-based regions, and ' +
                    fills.length +
                    ' fills, and ' +
                    polygons.length +
                    ' polygons.'
            })
        }

        if (extractedEmbeddedModels.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    extractedEmbeddedModels.length +
                    ' embedded 3D model payloads.'
            })
        }

        if (extractedEmbeddedFonts.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    extractedEmbeddedFonts.length +
                    ' embedded PCB font payloads.'
            })
        }

        if (embeddedFiles.files.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Inventoried ' +
                    embeddedFiles.files.length +
                    ' generic embedded payload ' +
                    PcbModelParser.#plural(
                        embeddedFiles.files.length,
                        'stream',
                        'streams'
                    ) +
                    '.'
            })
        }

        for (const issue of embeddedModelIntegrity.issues || []) {
            diagnostics.push({
                severity: issue.severity === 'info' ? 'info' : 'warning',
                code: issue.code,
                message: issue.message
            })
        }

        for (const issue of embeddedFiles.diagnostics || []) {
            diagnostics.push({
                severity: issue.severity === 'info' ? 'info' : 'warning',
                code: issue.code,
                message: issue.message
            })
        }

        if (rawRecords.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Preserved ' +
                    rawRecords.length +
                    ' raw PCB primitive records.'
            })
        }

        if (viaStructures.structures?.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    viaStructures.structures.length +
                    ' PCB via protection structure ' +
                    PcbModelParser.#plural(
                        viaStructures.structures.length,
                        'definition',
                        'definitions'
                    ) +
                    '.'
            })
        }

        if (extendedPrimitiveInformation.entries?.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    extendedPrimitiveInformation.entries.length +
                    ' extended PCB primitive information records.'
            })
        }

        if (customPadShapes.entries?.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    customPadShapes.entries.length +
                    ' custom pad shape sidecar records.'
            })
        }

        if (unions.userUnions?.length || unions.smartUnions?.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    unions.userUnions.length +
                    ' user unions and ' +
                    unions.smartUnions.length +
                    ' smart unions.'
            })
        }

        if (recoveredOutline.source === 'board-route') {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered board outline from the authored board-route contour.'
            })
        }

        if (recoveredOutline.source === 'mechanical-track-layer') {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered board outline from mechanical track layer ' +
                    recoveredOutline.layerId +
                    '.'
            })
        }

        if (!boardRecord) {
            diagnostics.push({
                severity: 'warning',
                message:
                    'Board geometry record was not found. PCB view uses component extents only.'
            })
        }

        return NormalizedModelSchema.attach({
            kind: 'pcb',
            fileType: 'PcbDoc',
            fileName,
            summary: {
                title: stripExtension(fileName),
                componentCount: componentRecords.length,
                layerCount: layers.length || primitiveLayers.length,
                outlineSegmentCount: boardOutline.segments.length,
                bomRowCount: bom.length,
                netCount: nets.length,
                classCount: classes.length,
                differentialPairCount:
                    differentialPairData.differentialPairs.length,
                differentialPairClassCount:
                    differentialPairData.differentialPairClasses.length,
                ruleCount: rules.length,
                routeReviewGroupCount:
                    reviewMetadata.summary.routeGroupCount || 0,
                boardAssemblyViewCount:
                    reviewMetadata.summary.boardAssemblyViewCount || 0,
                extractableFootprintCount:
                    footprintExtractionManifest.summary
                        .extractableFootprintCount || 0,
                dimensionCount: dimensions.length,
                mechanicalLayerPairCount: mechanicalLayerPairs.length,
                polygonCount: polygons.length,
                trackCount: tracks.length,
                arcCount: arcs.length,
                viaCount: vias.length,
                viaStructureCount: viaStructures.structures?.length || 0,
                extendedPrimitiveInformationCount:
                    extendedPrimitiveInformation.entries?.length || 0,
                customPadShapeCount: customPadShapes.entries?.length || 0,
                userUnionCount: unions.userUnions?.length || 0,
                smartUnionCount: unions.smartUnions?.length || 0,
                routedNetCount: routeAnalysis.summary.routedNetCount,
                routedLengthMil: routeAnalysis.summary.totalLengthMil,
                boardRegionCount: boardRegionSummary.boardRegionCount,
                flexRegionCount: boardRegionSummary.flexRegionCount,
                bendingLineCount: boardRegionSummary.bendingLineCount,
                layerStackSubstackCount:
                    layerStackReadModel?.summary.substackCount || 0,
                layerStackBranchCount:
                    layerStackReadModel?.summary.branchCount || 0,
                impedanceProfileCount:
                    layerStackReadModel?.summary.impedanceProfileCount || 0,
                backdrillSpanCount:
                    layerStackReadModel?.summary.backdrillSpanCount || 0,
                cavityRegionCount:
                    layerStackReadModel?.summary.cavityRegionCount || 0,
                stiffenerLayerCount:
                    layerStackReadModel?.summary.stiffenerLayerCount || 0,
                embeddedModelIssueCount:
                    embeddedModelIntegrity.issues?.length || 0,
                embeddedFontCount: extractedEmbeddedFonts.length,
                embeddedFileCount: embeddedFiles.files.length,
                rawRecordCount: rawRecords.length,
                boardWidthMil: Math.round(boardOutline.widthMil),
                boardHeightMil: Math.round(boardOutline.heightMil)
            },
            diagnostics,
            pcb: {
                boardOutline: normalizedPcb.boardOutline,
                layers,
                layerSubstacks,
                ...(layerStackReadModel ? { layerStackReadModel } : {}),
                ...(rigidFlexTopology ? { rigidFlexTopology } : {}),
                mechanicalLayerPairs,
                layerFlipMetadata,
                boardRegionContexts,
                primitiveLayers,
                appearance3d,
                nets,
                classes,
                differentialPairs: differentialPairData.differentialPairs,
                differentialPairClasses:
                    differentialPairData.differentialPairClasses,
                rules,
                ...(defaults ? { defaults } : {}),
                maskPaste,
                bomProfile,
                dimensions,
                components: normalizedPcb.components,
                pickPlace: pnp,
                routeAnalysis,
                reviewMetadata,
                footprintExtractionManifest,
                polygons: normalizedPcb.polygons,
                fills: normalizedPcb.fills,
                tracks: normalizedPcb.tracks,
                arcs: normalizedPcb.arcs,
                vias: normalizedPcb.vias,
                viaStructures,
                extendedPrimitiveInformation,
                customPadShapes,
                unions,
                pads: normalizedPcb.pads,
                regions: normalizedPcb.regions,
                shapeBasedRegions: normalizedPcb.shapeBasedRegions,
                boardRegions: normalizedPcb.boardRegions,
                texts: normalizedPcb.texts,
                embeddedModels: extractedEmbeddedModels,
                embeddedModelIntegrity,
                embeddedFonts: extractedEmbeddedFonts,
                embeddedFiles,
                rawRecords,
                componentBodies,
                componentPrimitives,
                componentPrimitiveGroups,
                ownership,
                statistics
            },
            pnp,
            bom
        })
    }

    /**
     * Selects component placement records using the native component table when
     * present and a legacy heuristic only for older extracted content.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @returns {{ fields: Record<string, string | string[]>, sourceStream?: string }[]}
     */
    static #selectComponentRecords(records) {
        const nativeRecords = records.filter(
            (record) => record.sourceStream === 'Components6/Data'
        )

        if (nativeRecords.length) {
            return nativeRecords
        }

        return records.filter(
            (record) =>
                getField(record.fields, 'PATTERN') &&
                getField(record.fields, 'SOURCEDESIGNATOR')
        )
    }

    /**
     * Normalizes component placement fields while preserving native index order.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ componentIndex: number, designator: string, uniqueId: string, x: number, y: number, layer: string, pattern: string, rotation: number, source: string, description: string, height: number | null, provenance: object, nameOn: boolean, commentOn: boolean }[]}
     */
    static #normalizeComponentRecords(records) {
        return records
            .map((record, index) => {
                const provenance = PcbModelParser.#parseComponentProvenance(
                    record.fields
                )
                const componentKind = PcbComponentKindPolicy.parse(
                    record.fields
                )
                const parameters = PcbModelParser.#parseComponentParameters(
                    record.fields
                )

                return {
                    componentIndex: index,
                    designator: getField(record.fields, 'SOURCEDESIGNATOR'),
                    uniqueId:
                        getField(record.fields, 'UNIQUEID') ||
                        getField(record.fields, 'UID') ||
                        getField(record.fields, 'UNIQUEIDPRIMITIVEINFORMATION'),
                    x: parseNumericField(record.fields, 'X') || 0,
                    y: parseNumericField(record.fields, 'Y') || 0,
                    layer: getField(record.fields, 'LAYER') || 'TOP',
                    pattern: getField(record.fields, 'PATTERN'),
                    rotation: parseNumericField(record.fields, 'ROTATION') || 0,
                    source:
                        getField(record.fields, 'SOURCELIBREFERENCE') ||
                        getField(record.fields, 'SOURCEFOOTPRINTLIBRARY'),
                    description: getField(record.fields, 'SOURCEDESCRIPTION'),
                    height: parseNumericField(record.fields, 'HEIGHT'),
                    ...(Object.keys(parameters).length ? { parameters } : {}),
                    ...(componentKind ? { componentKind } : {}),
                    ...(Object.keys(provenance).length ? { provenance } : {}),
                    nameOn: parseBoolean(record.fields.NAMEON),
                    commentOn: parseBoolean(record.fields.COMMENTON)
                }
            })
            .filter((component) => component.pattern && component.designator)
    }

    /**
     * Parses schematic/project provenance from one PCB component row.
     * @param {Record<string, string | string[]>} fields
     * @returns {Record<string, unknown>}
     */
    static #parseComponentProvenance(fields) {
        const sourceUniqueId = getField(fields, 'SOURCEUNIQUEID')
        const sourceHierarchicalPath = getField(
            fields,
            'SOURCEHIERARCHICALPATH'
        )
        const sourceFootprintLibrary = getField(
            fields,
            'SOURCEFOOTPRINTLIBRARY'
        )

        const provenance = PcbModelParser.#stripEmptyObject({
            channelOffset: parseNumericField(fields, 'CHANNELOFFSET'),
            sourceDesignator: getField(fields, 'SOURCEDESIGNATOR'),
            sourceUniqueId,
            sourceUniqueIdSegments:
                PcbModelParser.#splitAltiumPath(sourceUniqueId),
            sourceHierarchicalPath,
            sourceHierarchySegments: PcbModelParser.#splitAltiumPath(
                sourceHierarchicalPath
            ),
            sourceFootprintLibrary,
            sourceFootprintLibraryName: PcbModelParser.#basenameFromAltiumPath(
                sourceFootprintLibrary
            ),
            sourceLibReference: getField(fields, 'SOURCELIBREFERENCE'),
            sourceComponentLibrary: getField(fields, 'SOURCECOMPONENTLIBRARY'),
            sourceComponentLibraryIdentifierKind: parseNumericField(
                fields,
                'SOURCECOMPLIBIDENTIFIERKIND'
            ),
            sourceComponentLibraryIdentifier: getField(
                fields,
                'SOURCECOMPLIBRARYIDENTIFIER'
            ),
            footprintDescription: getField(fields, 'FOOTPRINTDESCRIPTION'),
            nameAutoPosition: parseNumericField(fields, 'NAMEAUTOPOSITION'),
            commentAutoPosition: parseNumericField(
                fields,
                'COMMENTAUTOPOSITION'
            ),
            lockStrings: PcbModelParser.#optionalBooleanField(
                fields,
                'LOCKSTRINGS'
            ),
            enablePinSwapping: PcbModelParser.#optionalBooleanField(
                fields,
                'ENABLEPINSWAPPING'
            ),
            enablePartSwapping: PcbModelParser.#optionalBooleanField(
                fields,
                'ENABLEPARTSWAPPING'
            )
        })
        const nonRedundantKeys = Object.keys(provenance).filter(
            (key) => !['sourceDesignator', 'sourceLibReference'].includes(key)
        )

        return nonRedundantKeys.length ? provenance : {}
    }

    /**
     * Parses component parameter name/value rows from printable component data.
     * @param {Record<string, string | string[]>} fields Component fields.
     * @returns {Record<string, string>}
     */
    static #parseComponentParameters(fields) {
        const parameters = {}
        const indexes = PcbModelParser.#componentParameterIndexes(fields)

        for (const index of indexes) {
            const name = PcbModelParser.#firstField(fields, [
                'PARAMETER' + index + 'NAME',
                'PARAMETER' + index + '_NAME',
                'PARAMETERNAME' + index,
                'PARAMETER_NAME' + index
            ])
            const value = PcbModelParser.#firstField(fields, [
                'PARAMETER' + index + 'VALUE',
                'PARAMETER' + index + '_VALUE',
                'PARAMETERVALUE' + index,
                'PARAMETER_VALUE' + index,
                'PARAMETER' + index + 'TEXT',
                'PARAMETERTEXT' + index
            ])
            if (!name) continue
            parameters[name] = value
        }

        return parameters
    }

    /**
     * Collects component parameter indexes from count and field names.
     * @param {Record<string, string | string[]>} fields Component fields.
     * @returns {number[]}
     */
    static #componentParameterIndexes(fields) {
        const indexes = new Set()
        const count =
            parseNumericField(fields, 'PARAMETERCOUNT') ??
            parseNumericField(fields, 'PARAMETERSCOUNT')

        if (Number.isInteger(count) && count > 0) {
            for (let index = 0; index < count; index += 1) {
                indexes.add(index)
            }
        }

        for (const key of Object.keys(fields || {})) {
            const match = /^PARAMETER_?(\d+)_?(NAME|VALUE|TEXT)$/iu.exec(key)
            if (match) {
                indexes.add(Number.parseInt(match[1], 10))
            }
            const alternateMatch = /^PARAMETER(NAME|VALUE|TEXT)(\d+)$/iu.exec(
                key
            )
            if (alternateMatch) {
                indexes.add(Number.parseInt(alternateMatch[2], 10))
            }
        }

        return [...indexes].sort((left, right) => left - right)
    }

    /**
     * Normalizes native Nets6/Data records in stream order.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @returns {{ netIndex: number, name: string, uniqueId: string, color: string, visible: boolean, overrideColor: boolean, keepout: boolean, locked: boolean, userRouted: boolean, loopRemoval: boolean, jumpersVisible: boolean, polygonOutline: boolean, layer: string, unionIndex: number }[]}
     */
    static #parseNetRecords(records) {
        return records
            .filter((record) => record.sourceStream === 'Nets6/Data')
            .map((record, index) =>
                PcbModelParser.#normalizeNetRecord(record.fields, index)
            )
            .filter((net) => net.name || net.uniqueId)
    }

    /**
     * Normalizes one native Altium PCB net record.
     * @param {Record<string, string | string[]>} fields
     * @param {number} fallbackIndex
     * @returns {{ netIndex: number, name: string, uniqueId: string, color: string, visible: boolean, overrideColor: boolean, keepout: boolean, locked: boolean, userRouted: boolean, loopRemoval: boolean, jumpersVisible: boolean, polygonOutline: boolean, layer: string, unionIndex: number }}
     */
    static #normalizeNetRecord(fields, fallbackIndex) {
        const explicitIndex = PcbModelParser.#firstIntegerField(fields, [
            'NETINDEX',
            'INDEX'
        ])
        const uniqueId = getField(fields, 'UNIQUEID') || getField(fields, 'UID')
        const name =
            getField(fields, 'NAME') || getField(fields, 'NETNAME') || uniqueId

        return {
            netIndex:
                explicitIndex === null ? Number(fallbackIndex) : explicitIndex,
            name,
            uniqueId,
            color: toColor(getField(fields, 'COLOR'), '#ffff00'),
            visible: PcbModelParser.#parseBooleanField(fields, 'VISIBLE', true),
            overrideColor: PcbModelParser.#parseBooleanField(
                fields,
                'OVERRIDECOLORFORDRAW',
                false
            ),
            keepout: PcbModelParser.#parseBooleanField(
                fields,
                'KEEPOUT',
                false
            ),
            locked: PcbModelParser.#parseBooleanField(fields, 'LOCKED', false),
            userRouted: PcbModelParser.#parseBooleanField(
                fields,
                'USERROUTED',
                true
            ),
            loopRemoval: PcbModelParser.#parseBooleanField(
                fields,
                'LOOPREMOVAL',
                true
            ),
            jumpersVisible: PcbModelParser.#parseBooleanField(
                fields,
                'JUMPERSVISIBLE',
                true
            ),
            polygonOutline: PcbModelParser.#parseBooleanField(
                fields,
                'POLYGONOUTLINE',
                false
            ),
            layer: getField(fields, 'LAYER') || '',
            unionIndex: parseNumericField(fields, 'UNIONINDEX') || 0
        }
    }

    /**
     * Builds a net-name lookup keyed by native net index.
     * @param {{ netIndex: number, name: string }[]} nets
     * @returns {Map<number, string>}
     */
    static #buildNetNameMap(nets) {
        const netNameByIndex = new Map()

        for (const net of nets) {
            if (Number.isInteger(net.netIndex) && net.name) {
                netNameByIndex.set(net.netIndex, net.name)
            }
        }

        return netNameByIndex
    }

    /**
     * Parses native DifferentialPairs6/Data records in stream order.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @returns {{ pairIndex: number, name: string, positiveNetName: string, negativeNetName: string, netNames: string[], gatherControl: boolean, uniqueId: string }[]}
     */
    static #parseDifferentialPairRecords(records) {
        return records
            .filter(
                (record) => record.sourceStream === 'DifferentialPairs6/Data'
            )
            .map((record, index) => {
                const positiveNetName = getField(
                    record.fields,
                    'POSITIVENETNAME'
                )
                const negativeNetName = getField(
                    record.fields,
                    'NEGATIVENETNAME'
                )

                return {
                    pairIndex: index,
                    name: getField(record.fields, 'NAME'),
                    positiveNetName,
                    negativeNetName,
                    netNames: [positiveNetName, negativeNetName].filter(
                        Boolean
                    ),
                    gatherControl: PcbModelParser.#parseBooleanField(
                        record.fields,
                        'GATHERCONTROL',
                        false
                    ),
                    uniqueId:
                        getField(record.fields, 'UNIQUEID') ||
                        getField(record.fields, 'UID')
                }
            })
            .filter(
                (pair) =>
                    pair.name ||
                    pair.positiveNetName ||
                    pair.negativeNetName ||
                    pair.uniqueId
            )
    }

    /**
     * Joins differential-pair class members to concrete pair records.
     * @param {{ pairIndex: number, name: string, positiveNetName: string, negativeNetName: string, netNames: string[], gatherControl: boolean, uniqueId: string }[]} pairs
     * @param {{ classIndex: number, name: string, kindName: string, members: string[] }[]} classes
     * @returns {{ differentialPairs: object[], differentialPairClasses: object[] }}
     */
    static #buildDifferentialPairData(pairs, classes) {
        const pairsByName = new Map(
            (pairs || []).map((pair) => [
                PcbModelParser.#normalizeLookupName(pair.name),
                pair
            ])
        )
        const classNamesByPair = new Map()
        const differentialPairClasses = (classes || [])
            .filter((classRecord) => classRecord.kindName === 'diff-pair')
            .map((classRecord) => {
                const pairNames = []
                const unresolvedMembers = []

                for (const member of classRecord.members || []) {
                    const pair = pairsByName.get(
                        PcbModelParser.#normalizeLookupName(member)
                    )

                    if (!pair) {
                        unresolvedMembers.push(member)
                        continue
                    }

                    pairNames.push(pair.name)
                    const classNames = classNamesByPair.get(pair.name) || []
                    classNames.push(classRecord.name)
                    classNamesByPair.set(pair.name, classNames)
                }

                return {
                    classIndex: classRecord.classIndex,
                    name: classRecord.name,
                    members: [...classRecord.members],
                    pairNames,
                    unresolvedMembers
                }
            })

        return {
            differentialPairs: (pairs || []).map((pair) => ({
                ...pair,
                classNames: classNamesByPair.get(pair.name) || []
            })),
            differentialPairClasses
        }
    }

    /**
     * Splits an authored hierarchy or unique-id path into stable segments.
     * @param {string | undefined} value Path-like field value.
     * @returns {string[]}
     */
    static #splitAltiumPath(value) {
        return String(value || '')
            .split(/[\\/]+/u)
            .map((segment) => segment.trim())
            .filter(Boolean)
    }

    /**
     * Returns the terminal segment from a native path-like field value.
     * @param {string | undefined} value Path-like field value.
     * @returns {string}
     */
    static #basenameFromAltiumPath(value) {
        const segments = PcbModelParser.#splitAltiumPath(value)

        return segments.length ? segments[segments.length - 1] : ''
    }

    /**
     * Removes empty values while preserving explicit false and zero values.
     * @param {Record<string, unknown>} value Object to normalize.
     * @returns {Record<string, unknown>}
     */
    static #stripEmptyObject(value) {
        return Object.fromEntries(
            Object.entries(value || {}).filter(([, entryValue]) => {
                if (Array.isArray(entryValue)) {
                    return entryValue.length > 0
                }
                if (typeof entryValue === 'string') {
                    return entryValue.length > 0
                }
                return entryValue !== null && entryValue !== undefined
            })
        )
    }

    /**
     * Parses an optional boolean field without inventing a default value.
     * @param {Record<string, string | string[]>} fields Native fields.
     * @param {string} key Field name.
     * @returns {boolean | null}
     */
    static #optionalBooleanField(fields, key) {
        const raw = getField(fields, key)

        return raw ? parseBoolean(raw) : null
    }

    /**
     * Builds a case-insensitive lookup key for class and pair names.
     * @param {string | undefined} value Raw lookup value.
     * @returns {string}
     */
    static #normalizeLookupName(value) {
        return String(value || '')
            .trim()
            .toUpperCase()
    }

    /**
     * Extracts authored Altium 3D appearance colors from board metadata.
     * @param {{ fields: Record<string, string | string[]> }[]} boardRecords
     * @returns {{ boardCoreColor?: number, solderMaskTopColor?: number, solderMaskBottomColor?: number, copperColor?: number, silkscreenTopColor?: number, silkscreenBottomColor?: number } | null}
     */
    static #parseAppearance3d(boardRecords) {
        const configText = (Array.isArray(boardRecords) ? boardRecords : [])
            .map((record) => getField(record.fields, '3DCONFIGURATION'))
            .find(Boolean)
        if (!configText) {
            return null
        }

        const config = PcbModelParser.#parseConfigurationFields(configText)
        const appearance = {
            boardCoreColor: PcbModelParser.#parseAltiumBgrColor(
                config.get('CFG3D.BOARDCORECOLOR')
            ),
            solderMaskTopColor: PcbModelParser.#parseAltiumBgrColor(
                config.get('CFG3D.TOPSOLDERMASKCOLOR')
            ),
            solderMaskBottomColor: PcbModelParser.#parseAltiumBgrColor(
                config.get('CFG3D.BOTSOLDERMASKCOLOR')
            ),
            copperColor: PcbModelParser.#parseAltiumBgrColor(
                config.get('CFG3D.COPPERCOLOR')
            ),
            silkscreenTopColor: PcbModelParser.#parseAltiumBgrColor(
                config.get('CFG3D.TOPSILKSCREENCOLOR')
            ),
            silkscreenBottomColor: PcbModelParser.#parseAltiumBgrColor(
                config.get('CFG3D.BOTSILKSCREENCOLOR')
            )
        }

        return Object.values(appearance).some(Number.isInteger)
            ? appearance
            : null
    }

    /**
     * Parses backtick-delimited Altium configuration key/value fields.
     * @param {string} value
     * @returns {Map<string, string>}
     */
    static #parseConfigurationFields(value) {
        const fields = new Map()

        String(value || '')
            .split('`')
            .forEach((segment) => {
                const separatorIndex = segment.indexOf('=')
                if (separatorIndex <= 0) {
                    return
                }

                fields.set(
                    segment.slice(0, separatorIndex).toUpperCase(),
                    segment.slice(separatorIndex + 1)
                )
            })

        return fields
    }

    /**
     * Converts Altium decimal BGR color storage into an RGB integer.
     * @param {string | undefined} value
     * @returns {number | undefined}
     */
    static #parseAltiumBgrColor(value) {
        const parsed = Number.parseInt(String(value ?? '').trim(), 10)
        if (!Number.isFinite(parsed)) {
            return undefined
        }

        const bgr = parsed & 0xffffff
        return ((bgr & 0xff) << 16) | (bgr & 0xff00) | (bgr >> 16)
    }

    /**
     * Adds resolved net names to decoded primitives without changing geometry.
     * @param {{ netIndex?: number | string | null }[]} primitives
     * @param {Map<number, string>} netNameByIndex
     * @returns {object[]}
     */
    static #annotatePrimitiveNetNames(primitives, netNameByIndex) {
        return (primitives || []).map((primitive) => {
            const netIndex = Number(primitive?.netIndex)
            const netName = Number.isInteger(netIndex)
                ? netNameByIndex.get(netIndex)
                : ''

            return netName ? { ...primitive, netName } : primitive
        })
    }

    /**
     * Normalizes native Classes6/Data records in stream order.
     * @param {{ fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @returns {{ classIndex: number, name: string, kind: number, kindName: string, memberCount: number, members: string[], enabled: boolean, uniqueId: string }[]}
     */
    static #parseClassRecords(records) {
        return PcbModelParser.#mergeClassRecordFields(
            records.filter((record) => record.sourceStream === 'Classes6/Data')
        )
            .map((fields, index) =>
                PcbModelParser.#normalizeClassRecord(fields, index)
            )
            .filter(
                (classRecord) =>
                    classRecord.name ||
                    classRecord.uniqueId ||
                    classRecord.members.length
            )
    }

    /**
     * Merges adjacent name/detail records while preserving standalone class
     * records. Altium often stores class display fields and class membership
     * fields in separate consecutive records.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Record<string, string | string[]>[]}
     */
    static #mergeClassRecordFields(records) {
        const mergedRecords = []
        let pendingNameFields = null

        for (const record of records) {
            const fields = record.fields || {}
            const hasName = Boolean(getField(fields, 'NAME'))
            const hasPayload = PcbModelParser.#hasClassPayload(fields)

            if (pendingNameFields && hasName) {
                mergedRecords.push(pendingNameFields)
                pendingNameFields = null
            }

            if (hasName && !hasPayload) {
                pendingNameFields = fields
                continue
            }

            if (pendingNameFields) {
                mergedRecords.push({ ...pendingNameFields, ...fields })
                pendingNameFields = null
                continue
            }

            mergedRecords.push(fields)
        }

        if (pendingNameFields) {
            mergedRecords.push(pendingNameFields)
        }

        return mergedRecords
    }

    /**
     * Normalizes one native Altium PCB class record.
     * @param {Record<string, string | string[]>} fields
     * @param {number} classIndex
     * @returns {{ classIndex: number, name: string, kind: number, kindName: string, memberCount: number, members: string[], enabled: boolean, uniqueId: string }}
     */
    static #normalizeClassRecord(fields, classIndex) {
        const kind = parseNumericField(fields, 'KIND') || 0
        const members = PcbModelParser.#parseClassMembers(fields)
        const memberCount = parseNumericField(fields, 'MEMBERCOUNT')

        return {
            classIndex,
            name: getField(fields, 'NAME'),
            kind,
            kindName: PcbModelParser.#classKindName(kind),
            memberCount: memberCount === null ? members.length : memberCount,
            members,
            enabled: PcbModelParser.#parseBooleanField(fields, 'ENABLED', true),
            uniqueId: getField(fields, 'UNIQUEID') || getField(fields, 'UID')
        }
    }

    /**
     * Returns true when one Classes6/Data field set carries semantic payload
     * beyond an adjacent display-name record.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static #hasClassPayload(fields) {
        return Object.keys(fields || {}).some(
            (key) =>
                key === 'KIND' ||
                key === 'MEMBERCOUNT' ||
                key === 'ENABLED' ||
                key === 'UNIQUEID' ||
                /^(?:M|MEMBER)\d+$/.test(key)
        )
    }

    /**
     * Extracts ordered class members from M0/MEMBER0-style fields.
     * @param {Record<string, string | string[]>} fields
     * @returns {string[]}
     */
    static #parseClassMembers(fields) {
        return Object.keys(fields || {})
            .filter((key) => /^(?:M|MEMBER)\d+$/.test(key))
            .sort(
                (left, right) =>
                    PcbModelParser.#classMemberIndex(left) -
                    PcbModelParser.#classMemberIndex(right)
            )
            .map((key) => getField(fields, key))
            .filter(Boolean)
    }

    /**
     * Extracts the numeric index from a class member field name.
     * @param {string} key Field key.
     * @returns {number}
     */
    static #classMemberIndex(key) {
        return Number(String(key).replace(/^(?:M|MEMBER)/u, ''))
    }

    /**
     * Returns a stable display name for one native PCB class kind.
     * @param {number} kind
     * @returns {string}
     */
    static #classKindName(kind) {
        return (
            {
                0: 'net',
                1: 'component',
                2: 'from-to',
                3: 'pad',
                4: 'layer',
                6: 'diff-pair',
                7: 'polygon'
            }[Number(kind)] || 'unknown'
        )
    }

    /**
     * Parses one Altium boolean field with a default for omitted fields.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @param {boolean} fallback
     * @returns {boolean}
     */
    static #parseBooleanField(fields, key, fallback) {
        const raw = getField(fields, key)

        return raw ? parseBoolean(raw) : fallback
    }

    /**
     * Returns the first integer-like numeric field value.
     * @param {Record<string, string | string[]>} fields
     * @param {string[]} keys
     * @returns {number | null}
     */
    static #firstIntegerField(fields, keys) {
        for (const key of keys) {
            const parsed = parseNumericField(fields, key)
            if (Number.isInteger(parsed)) {
                return parsed
            }
        }

        return null
    }

    /**
     * Returns the first non-empty printable field value.
     * @param {Record<string, string | string[]>} fields Source fields.
     * @param {string[]} keys Candidate keys.
     * @returns {string}
     */
    static #firstField(fields, keys) {
        for (const key of keys) {
            const value = getField(fields, key)
            if (value) return value
        }

        return ''
    }

    /**
     * Groups component placements into BOM rows.
     * @param {{ designator: string, pattern: string, source: string, value: string }[]} componentRecords
     * @returns {{ designators: string[], quantity: number, pattern: string, source: string, value: string }[]}
     */
    static #groupBomRows(componentRecords) {
        const groupedRows = new Map()

        for (const component of componentRecords) {
            const groupKey = [
                component.pattern || '',
                component.source || '',
                component.value || ''
            ].join('\u0000')

            if (!groupedRows.has(groupKey)) {
                groupedRows.set(groupKey, {
                    designators: [],
                    quantity: 0,
                    pattern: component.pattern || 'Unknown footprint',
                    source: component.source || 'Unknown source',
                    value:
                        component.value || component.pattern || 'Unknown part'
                })
            }

            const row = groupedRows.get(groupKey)
            row.designators.push(component.designator)
            row.quantity += 1
        }

        return [...groupedRows.values()].sort((left, right) =>
            left.pattern.localeCompare(right.pattern)
        )
    }

    /**
     * Adds embedded-font metric references to decoded TrueType text primitives.
     * @param {{ fontFamily?: string, fontName?: string, fontStyle?: string, fontWeight?: number }[]} texts
     * @param {{ index: number, name: string, style: string, metrics?: object }[]} embeddedFonts
     * @returns {object[]}
     */
    static #annotateTextFontMetrics(texts, embeddedFonts) {
        const fontsByKey = new Map()

        for (const font of embeddedFonts || []) {
            for (const key of PcbModelParser.#fontLookupKeys(font)) {
                fontsByKey.set(key, font)
            }
        }

        return (texts || []).map((text) => {
            const family = text.fontFamily || text.fontName || ''
            const style = PcbModelParser.#textFontStyleName(text)
            const font =
                fontsByKey.get(PcbModelParser.#fontLookupKey(family, style)) ||
                fontsByKey.get(PcbModelParser.#fontLookupKey(family, ''))

            return font
                ? {
                      ...text,
                      embeddedFontIndex: font.index,
                      fontMetrics: font.metrics || {}
                  }
                : text
        })
    }

    /**
     * Builds all lookup aliases for one embedded font.
     * @param {{ name?: string, style?: string }} font
     * @returns {string[]}
     */
    static #fontLookupKeys(font) {
        return [
            PcbModelParser.#fontLookupKey(font.name, font.style),
            PcbModelParser.#fontLookupKey(font.name, '')
        ]
    }

    /**
     * Builds a normalized font lookup key.
     * @param {string | undefined} family
     * @param {string | undefined} style
     * @returns {string}
     */
    static #fontLookupKey(family, style) {
        return (
            String(family || '')
                .trim()
                .toLowerCase() +
            '\u0000' +
            String(style || '')
                .trim()
                .toLowerCase()
        )
    }

    /**
     * Converts SVG-style text font flags into the embedded-font style label.
     * @param {{ fontStyle?: string, fontWeight?: number }} text
     * @returns {'Regular' | 'Bold' | 'Italic' | 'Bold Italic'}
     */
    static #textFontStyleName(text) {
        const isBold = Number(text?.fontWeight || 0) >= 600
        const isItalic =
            String(text?.fontStyle || '').toLowerCase() === 'italic'

        if (isBold && isItalic) return 'Bold Italic'
        if (isBold) return 'Bold'
        if (isItalic) return 'Italic'

        return 'Regular'
    }

    /**
     * Removes parser-only display metadata from the public component model.
     * @param {object} component
     * @returns {object}
     */
    static #publicComponentRecord(component) {
        const {
            nameOn: _nameOn,
            commentOn: _commentOn,
            ...publicComponent
        } = component

        if (!publicComponent.uniqueId) {
            delete publicComponent.uniqueId
        }

        return publicComponent
    }

    /**
     * Chooses a singular or plural word based on a count.
     * @param {number} count
     * @param {string} singular
     * @param {string} plural
     * @returns {string}
     */
    static #plural(count, singular, plural) {
        return Number(count) === 1 ? singular : plural
    }
}
