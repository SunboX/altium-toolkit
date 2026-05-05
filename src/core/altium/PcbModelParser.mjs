import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { PcbOutlineRecovery } from './PcbOutlineRecovery.mjs'
import { ParserUtils } from './ParserUtils.mjs'

const {
    countMatchingKeys,
    dedupeByDesignator,
    getField,
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
     * @param {{ streamNames: string[], binaryPrimitives: { fills: { x1: number, y1: number, x2: number, y2: number, layerCode: number, layerId: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number, layerId: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode: number, layerId: number }[], vias: { x: number, y: number, diameter: number, holeDiameter: number }[], pads: { x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean }[] }, diagnostics: { printableRecordCount: number, printableStreamCount: number, binaryPrimitiveCount: number } } | null} pcbExtraction
     * @returns {{ kind: 'pcb', fileType: 'PcbDoc', fileName: string, summary: Record<string, number | string>, diagnostics: { severity: 'info' | 'warning', message: string }[], pcb: { boardOutline: { widthMil: number, heightMil: number, minX: number, minY: number, segments: Array<Record<string, number | string>> }, layers: { index: number, name: string, layerId: number | null }[], primitiveLayers: { layerId: number, name: string }[], components: { designator: string, x: number, y: number, layer: string, pattern: string, rotation: number, source: string, description: string, height: number | null }[], polygons: { layer: string, segments: Array<Record<string, number | string>> }[], fills: { x1: number, y1: number, x2: number, y2: number, layerCode: number, layerId: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number, layerId: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode: number, layerId: number }[], vias: { x: number, y: number, diameter: number, holeDiameter: number }[], pads: { x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean }[] }, bom: { designators: string[], quantity: number, pattern: string, source: string, value: string }[] }}
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
        const componentRecords = dedupeByDesignator(
            records
                .filter(
                    (record) =>
                        getField(record.fields, 'PATTERN') &&
                        getField(record.fields, 'SOURCEDESIGNATOR')
                )
                .map((record) => ({
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
                    height: parseNumericField(record.fields, 'HEIGHT')
                }))
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
            components: componentRecords
        })
        const componentBodies = PcbModelParser.#normalizeComponentBodies(
            extractedComponentBodies,
            boardOutline
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
                embeddedModels: extractedEmbeddedModels,
                componentBodies
            },
            bom
        }
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
