// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { PcbOutlineRecovery } from './PcbOutlineRecovery.mjs'
import { ParserUtils } from './ParserUtils.mjs'

const {
    countMatchingKeys,
    dedupeByDesignator,
    getField,
    parseBoolean,
    parseNumericField,
    stripExtension
} = ParserUtils

/**
 * Normalizes PCB records into the viewer's board model.
 */
export class PcbModelParser {
    /**
     * Parses a normalized PCB model.
     * @param {string} fileName
     * @param {{ raw: string, fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @param {{ streamNames: string[], binaryPrimitives: { fills: { x1: number, y1: number, x2: number, y2: number, layerCode: number, layerId: number, componentIndex?: number | null }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number, layerId: number, componentIndex?: number | null }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode: number, layerId: number, componentIndex?: number | null }[], vias: { x: number, y: number, diameter: number, holeDiameter: number, componentIndex?: number | null }[], pads: { x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean, componentIndex?: number | null }[] }, diagnostics: { printableRecordCount: number, printableStreamCount: number, binaryPrimitiveCount: number } } | null} pcbExtraction
     * @returns {{ kind: 'pcb', fileType: 'PcbDoc', fileName: string, summary: Record<string, number | string>, diagnostics: { severity: 'info' | 'warning', message: string }[], pcb: { boardOutline: { widthMil: number, heightMil: number, minX: number, minY: number, segments: Array<Record<string, number | string>> }, layers: { index: number, name: string, layerId: number | null }[], primitiveLayers: { layerId: number, name: string }[], components: { componentIndex: number, designator: string, x: number, y: number, layer: string, pattern: string, rotation: number, source: string, description: string, height: number | null }[], polygons: { layer: string, segments: Array<Record<string, number | string>> }[], fills: { x1: number, y1: number, x2: number, y2: number, layerCode: number, layerId: number, componentIndex?: number | null }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number, layerId: number, componentIndex?: number | null }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode: number, layerId: number, componentIndex?: number | null }[], vias: { x: number, y: number, diameter: number, holeDiameter: number, componentIndex?: number | null }[], pads: { x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean, componentIndex?: number | null }[] }, bom: { designators: string[], quantity: number, pattern: string, source: string, value: string }[] }}
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
        const rawComponentRecords = PcbModelParser.#normalizeComponentRecords(
            PcbModelParser.#selectComponentRecords(records)
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
        const primitiveLayers = AltiumLayoutParser.parsePrimitiveLayerNames(
            boardRecords.map((record) => record.fields)
        )
        const polygons = polygonRecords
            .map((record) => ({
                layer: getField(record.fields, 'LAYER') || 'UNKNOWN',
                segments: AltiumLayoutParser.parseBoardOutline(record.fields)
                    .segments
            }))
            .filter((polygon) => polygon.segments.length > 0)
        const tracks = pcbExtraction?.binaryPrimitives?.tracks || []
        const arcs = pcbExtraction?.binaryPrimitives?.arcs || []
        const vias = pcbExtraction?.binaryPrimitives?.vias || []
        const fills = pcbExtraction?.binaryPrimitives?.fills || []
        const pads = pcbExtraction?.binaryPrimitives?.pads || []
        const regions = pcbExtraction?.binaryPrimitives?.regions || []
        const shapeBasedRegions =
            pcbExtraction?.binaryPrimitives?.shapeBasedRegions || []
        const boardRegions = pcbExtraction?.binaryPrimitives?.boardRegions || []
        const texts = PcbModelParser.#normalizeTexts(
            pcbExtraction?.binaryPrimitives?.texts || [],
            rawComponentRecords
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
        const componentBodies = PcbModelParser.#normalizeComponentBodies(
            extractedComponentBodies,
            boardOutline
        )
        const componentPrimitiveGroups =
            PcbModelParser.#buildComponentPrimitiveGroups(
                normalizedPcb.components,
                normalizedPcb,
                componentBodies
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
            }
        ]

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

        return {
            kind: 'pcb',
            fileType: 'PcbDoc',
            fileName,
            summary: {
                title: stripExtension(fileName),
                componentCount: componentRecords.length,
                layerCount: layers.length,
                outlineSegmentCount: boardOutline.segments.length,
                bomRowCount: bom.length,
                polygonCount: polygons.length,
                trackCount: tracks.length,
                arcCount: arcs.length,
                viaCount: vias.length,
                boardWidthMil: Math.round(boardOutline.widthMil),
                boardHeightMil: Math.round(boardOutline.heightMil)
            },
            diagnostics,
            pcb: {
                boardOutline: normalizedPcb.boardOutline,
                layers,
                primitiveLayers,
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
                componentBodies,
                componentPrimitiveGroups
            },
            bom
        }
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
     * @returns {{ componentIndex: number, designator: string, x: number, y: number, layer: string, pattern: string, rotation: number, source: string, description: string, height: number | null, nameOn: boolean, commentOn: boolean }[]}
     */
    static #normalizeComponentRecords(records) {
        return records
            .map((record, index) => ({
                componentIndex: index,
                designator: getField(record.fields, 'SOURCEDESIGNATOR'),
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
     * Groups normalized primitives by their native component index.
     * @param {{ componentIndex: number, designator: string }[]} components
     * @param {{ fills?: object[], tracks?: object[], arcs?: object[], pads?: object[], texts?: object[] }} pcb
     * @param {{ componentIndex?: number | null }[]} componentBodies
     * @returns {{ componentIndex: number, designator: string, pads: object[], tracks: object[], arcs: object[], fills: object[], texts: object[], componentBodies: object[] }[]}
     */
    static #buildComponentPrimitiveGroups(components, pcb, componentBodies) {
        return (components || []).map((component) => {
            const componentIndex = Number(component.componentIndex)

            return {
                componentIndex,
                designator: component.designator,
                pads: PcbModelParser.#primitivesForComponent(
                    pcb.pads,
                    componentIndex
                ),
                tracks: PcbModelParser.#primitivesForComponent(
                    pcb.tracks,
                    componentIndex
                ),
                arcs: PcbModelParser.#primitivesForComponent(
                    pcb.arcs,
                    componentIndex
                ),
                fills: PcbModelParser.#primitivesForComponent(
                    pcb.fills,
                    componentIndex
                ),
                regions: PcbModelParser.#primitivesForComponent(
                    pcb.regions,
                    componentIndex
                ),
                shapeBasedRegions: PcbModelParser.#primitivesForComponent(
                    pcb.shapeBasedRegions,
                    componentIndex
                ),
                texts: (pcb.texts || []).filter(
                    (text) => Number(text?.ownerIndex) === componentIndex
                ),
                componentBodies: PcbModelParser.#primitivesForComponent(
                    componentBodies,
                    componentIndex
                )
            }
        })
    }

    /**
     * Returns primitives linked to a component by native Altium index.
     * @param {{ componentIndex?: number | null }[] | undefined} primitives
     * @param {number} componentIndex
     * @returns {object[]}
     */
    static #primitivesForComponent(primitives, componentIndex) {
        return (primitives || []).filter((primitive) => {
            const rawComponentIndex = primitive?.componentIndex
            if (
                rawComponentIndex === null ||
                rawComponentIndex === undefined ||
                rawComponentIndex === ''
            ) {
                return false
            }

            return Number(rawComponentIndex) === componentIndex
        })
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
     * Marks decoded PCB text primitives as visible or hidden based on their
     * linked component display flags.
     * @param {{ text: string, ownerIndex?: number | null, kind?: number, visibilityFlags?: number }[]} texts
     * @param {{ designator: string, nameOn: boolean, commentOn: boolean }[]} components
     * @returns {object[]}
     */
    static #normalizeTexts(texts, components) {
        return (texts || []).map((text) => ({
            ...text,
            visible: PcbModelParser.#isVisibleText(text, components)
        }))
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

        return publicComponent
    }

    /**
     * Returns true when one PCB text primitive should render in board view.
     * @param {{ text: string, ownerIndex?: number | null, kind?: number, visibilityFlags?: number }} text
     * @param {{ designator: string, nameOn: boolean, commentOn: boolean }[]} components
     * @returns {boolean}
     */
    static #isVisibleText(text, components) {
        if (!Number.isInteger(text?.ownerIndex)) {
            return true
        }

        const component = components[Number(text.ownerIndex)]
        if (!component) {
            return (Number(text?.visibilityFlags || 0) & 1) === 0
        }

        if (
            PcbModelParser.#normalizeText(text.text) ===
            PcbModelParser.#normalizeText(component.designator)
        ) {
            return component.nameOn
        }

        if (Number(text?.kind) === 1) {
            return component.commentOn
        }

        if ((Number(text?.visibilityFlags || 0) & 1) !== 0) {
            return component.nameOn
        }

        return true
    }

    /**
     * Normalizes text for display-flag comparisons.
     * @param {unknown} text
     * @returns {string}
     */
    static #normalizeText(text) {
        return String(text || '')
            .trim()
            .toUpperCase()
    }

    /**
     * Flips embedded component-body placements into the viewer coordinate
     * system.
     * @param {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null }[]} componentBodies
     * @param {{ minY: number, heightMil: number }} boardOutline
     * @returns {{ sourceStream: string, layer: string, identifier: string, modelId: string, checksum: number | null, embedded: boolean, name: string, positionMil: { x: number, y: number }, rotationDeg: number, modelRotationDeg: { x: number, y: number, z: number }, dzMil: number, overallHeightMil: number | null, standoffHeightMil: number | null }[]}
     */
    static #normalizeComponentBodies(componentBodies, boardOutline) {
        const maxY =
            Number(boardOutline?.minY || 0) +
            Number(boardOutline?.heightMil || 0)
        const mirrorY = (value) =>
            Number(boardOutline?.minY || 0) + maxY - Number(value || 0)

        return componentBodies.map((componentBody) => ({
            ...componentBody,
            positionMil: {
                x: Number(componentBody.positionMil?.x || 0),
                y: mirrorY(componentBody.positionMil?.y || 0)
            },
            rotationDeg: PcbModelParser.#normalizeAngle(
                360 - Number(componentBody.rotationDeg || 0)
            ),
            modelRotationDeg: {
                x: Number(componentBody.modelRotationDeg?.x || 0),
                y: Number(componentBody.modelRotationDeg?.y || 0),
                z: PcbModelParser.#normalizeAngle(
                    360 - Number(componentBody.modelRotationDeg?.z || 0)
                )
            }
        }))
    }

    /**
     * Normalizes one angle into the range [0, 360).
     * @param {number} angle
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }
}
