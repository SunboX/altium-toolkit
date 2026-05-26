// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { NormalizedModelSchema } from './NormalizedModelSchema.mjs'
import { PcbBoardRegionSemanticsParser } from './PcbBoardRegionSemanticsParser.mjs'
import { PcbComponentAnnotationNormalizer } from './PcbComponentAnnotationNormalizer.mjs'
import { PcbComponentBodyPlacementNormalizer } from './PcbComponentBodyPlacementNormalizer.mjs'
import { PcbComponentPrimitiveIndexer } from './PcbComponentPrimitiveIndexer.mjs'
import { PcbOutlineRecovery } from './PcbOutlineRecovery.mjs'
import { PcbRuleParser } from './PcbRuleParser.mjs'
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
     * @param {{ streamNames: string[], binaryPrimitives: Record<string, object[]>, primitiveParameters?: object, diagnostics: { printableRecordCount: number, printableStreamCount: number, binaryPrimitiveCount: number } } | null} pcbExtraction
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
        const polygonRecords = records.filter(
            (record) =>
                record.sourceStream === 'Polygons6/Data' &&
                getField(record.fields, 'KIND0')
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
        const nets = PcbModelParser.#parseNetRecords(records)
        const netNameByIndex = PcbModelParser.#buildNetNameMap(nets)
        const classes = PcbModelParser.#parseClassRecords(records)
        const rules = PcbRuleParser.parse(records)
        const polygons = polygonRecords
            .map((record) => ({
                layer: getField(record.fields, 'LAYER') || 'UNKNOWN',
                segments: AltiumLayoutParser.parseBoardOutline(record.fields)
                    .segments
            }))
            .filter((polygon) => polygon.segments.length > 0)
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
        const rawRecords = Array.isArray(pcbExtraction?.rawRecords)
            ? pcbExtraction.rawRecords
            : []
        const texts = PcbModelParser.#annotateTextFontMetrics(
            PcbComponentAnnotationNormalizer.normalizeTexts(
                rawTextPrimitives,
                rawComponentRecords
            ),
            extractedEmbeddedFonts
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
        const boardRegionContexts =
            PcbBoardRegionSemanticsParser.buildBoardRegionContexts(
                normalizedPcb.boardRegions
            )
        const boardRegionSummary =
            PcbBoardRegionSemanticsParser.summarizeBoardRegions(
                normalizedPcb.boardRegions
            )
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
        const bom = PcbModelParser.#groupBomRows(
            componentRecords.map((component) => ({
                designator: component.designator,
                pattern: component.pattern,
                source: component.source,
                value: component.description || component.pattern
            }))
        )

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

        if (rawRecords.length) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Preserved ' +
                    rawRecords.length +
                    ' raw PCB primitive records.'
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
                ruleCount: rules.length,
                polygonCount: polygons.length,
                trackCount: tracks.length,
                arcCount: arcs.length,
                viaCount: vias.length,
                boardRegionCount: boardRegionSummary.boardRegionCount,
                flexRegionCount: boardRegionSummary.flexRegionCount,
                bendingLineCount: boardRegionSummary.bendingLineCount,
                embeddedFontCount: extractedEmbeddedFonts.length,
                rawRecordCount: rawRecords.length,
                boardWidthMil: Math.round(boardOutline.widthMil),
                boardHeightMil: Math.round(boardOutline.heightMil)
            },
            diagnostics,
            pcb: {
                boardOutline: normalizedPcb.boardOutline,
                layers,
                layerSubstacks,
                boardRegionContexts,
                primitiveLayers,
                nets,
                classes,
                rules,
                components: normalizedPcb.components,
                polygons: normalizedPcb.polygons,
                fills: normalizedPcb.fills,
                tracks: normalizedPcb.tracks,
                arcs: normalizedPcb.arcs,
                vias: normalizedPcb.vias,
                pads: normalizedPcb.pads,
                regions: normalizedPcb.regions,
                shapeBasedRegions: normalizedPcb.shapeBasedRegions,
                boardRegions: normalizedPcb.boardRegions,
                texts: normalizedPcb.texts,
                embeddedModels: extractedEmbeddedModels,
                embeddedFonts: extractedEmbeddedFonts,
                rawRecords,
                componentBodies,
                componentPrimitives,
                componentPrimitiveGroups
            },
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
     * @returns {{ componentIndex: number, designator: string, uniqueId: string, x: number, y: number, layer: string, pattern: string, rotation: number, source: string, description: string, height: number | null, nameOn: boolean, commentOn: boolean }[]}
     */
    static #normalizeComponentRecords(records) {
        return records
            .map((record, index) => ({
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
                nameOn: parseBoolean(record.fields.NAMEON),
                commentOn: parseBoolean(record.fields.COMMENTON)
            }))
            .filter((component) => component.pattern && component.designator)
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
                /^M\d+$/.test(key)
        )
    }

    /**
     * Extracts ordered class members from M0, M1, ... fields.
     * @param {Record<string, string | string[]>} fields
     * @returns {string[]}
     */
    static #parseClassMembers(fields) {
        return Object.keys(fields || {})
            .filter((key) => /^M\d+$/.test(key))
            .sort(
                (left, right) => Number(left.slice(1)) - Number(right.slice(1))
            )
            .map((key) => getField(fields, key))
            .filter(Boolean)
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
