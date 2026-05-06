// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AsciiRecordParser } from './AsciiRecordParser.mjs'
import { PcbBinaryPrimitiveParser } from './PcbBinaryPrimitiveParser.mjs'
import { PcbEmbeddedModelExtractor } from './PcbEmbeddedModelExtractor.mjs'
import { OleCompoundDocument } from '../ole/OleCompoundDocument.mjs'
import { OleConstants } from '../ole/OleConstants.mjs'

/**
 * Extracts stream-scoped printable and binary PCB content from OLE-backed
 * PcbDoc containers.
 */
export class PcbStreamExtractor {
    /**
     * Returns true when one buffer starts with the OLE compound-document
     * signature.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {boolean}
     */
    static isCompoundDocument(arrayBuffer) {
        const bytes = new Uint8Array(
            arrayBuffer,
            0,
            Math.min(
                arrayBuffer.byteLength,
                OleConstants.HEADER_SIGNATURE.length
            )
        )

        if (bytes.byteLength < OleConstants.HEADER_SIGNATURE.length) {
            return false
        }

        return OleConstants.HEADER_SIGNATURE.every(
            (value, index) => bytes[index] === value
        )
    }

    /**
     * Extracts PCB content directly from one OLE-backed PcbDoc buffer.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ records: Array<{ raw: string, fields: Record<string, string | string[]>, sourceStream: string }>, streamNames: string[], binaryPrimitives: { fills: { x1: number, y1: number, x2: number, y2: number, layerCode: number, componentIndex?: number | null }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number, componentIndex?: number | null }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode: number, layerId: number, componentIndex?: number | null }[], vias: { x: number, y: number, diameter: number, holeDiameter: number, componentIndex?: number | null }[], pads: { x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean, componentIndex?: number | null }[] }, diagnostics: { printableRecordCount: number, printableStreamCount: number, binaryPrimitiveCount: number } } | null}
     */
    static extractFromArrayBuffer(arrayBuffer) {
        if (!PcbStreamExtractor.isCompoundDocument(arrayBuffer)) {
            return null
        }

        const compoundDocument =
            OleCompoundDocument.fromArrayBuffer(arrayBuffer)
        const streams = new Map()

        for (const name of compoundDocument.listStreams()) {
            streams.set(name, compoundDocument.getStream(name))
        }

        return PcbStreamExtractor.extractFromStreams(streams)
    }

    /**
     * Extracts stream-scoped printable records and known binary primitives from
     * a stream map.
     * @param {Map<string, Uint8Array>} streams
     * @returns {{ records: Array<{ raw: string, fields: Record<string, string | string[]>, sourceStream: string }>, streamNames: string[], binaryPrimitives: { fills: { x1: number, y1: number, x2: number, y2: number, layerCode: number, componentIndex?: number | null }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number, componentIndex?: number | null }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode: number, layerId: number, componentIndex?: number | null }[], vias: { x: number, y: number, diameter: number, holeDiameter: number, componentIndex?: number | null }[], pads: { x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean, componentIndex?: number | null }[] }, diagnostics: { printableRecordCount: number, printableStreamCount: number, binaryPrimitiveCount: number } }}
     */
    static extractFromStreams(streams) {
        const records = []
        const printableStreamNames = new Set()
        const usedStreamNames = new Set()
        const binaryPrimitives = {
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            texts: [],
            regions: [],
            shapeBasedRegions: [],
            boardRegions: []
        }

        for (const [name, bytes] of streams.entries()) {
            if (!name.endsWith('/Data')) {
                continue
            }

            const recordBuffer = PcbStreamExtractor.#toArrayBuffer(bytes)
            const streamRecords = AsciiRecordParser.parse(recordBuffer).map(
                (record) => ({
                    ...record,
                    sourceStream: name
                })
            )

            if (!streamRecords.length) {
                continue
            }

            records.push(...streamRecords)
            printableStreamNames.add(name)
            usedStreamNames.add(name)
        }

        const arcHeaderBytes = streams.get('Arcs6/Header')
        const arcDataBytes = streams.get('Arcs6/Data')
        const trackHeaderBytes = streams.get('Tracks6/Header')
        const trackDataBytes = streams.get('Tracks6/Data')
        const viaHeaderBytes = streams.get('Vias6/Header')
        const viaDataBytes = streams.get('Vias6/Data')
        const fillHeaderBytes = streams.get('Fills6/Header')
        const fillDataBytes = streams.get('Fills6/Data')
        const padHeaderBytes = streams.get('Pads6/Header')
        const padDataBytes = streams.get('Pads6/Data')
        const textHeaderBytes =
            streams.get('Texts6/Header') || streams.get('Texts/Header')
        const textDataBytes =
            streams.get('Texts6/Data') || streams.get('Texts/Data')
        const textStreamName = streams.has('Texts6/Data')
            ? 'Texts6/Data'
            : 'Texts/Data'
        const regionHeaderBytes = streams.get('Regions6/Header')
        const regionDataBytes = streams.get('Regions6/Data')
        const shapeBasedRegionHeaderBytes = streams.get(
            'ShapeBasedRegions6/Header'
        )
        const shapeBasedRegionDataBytes = streams.get('ShapeBasedRegions6/Data')
        const boardRegionHeaderBytes = streams.get('BoardRegions/Header')
        const boardRegionDataBytes = streams.get('BoardRegions/Data')

        if (arcHeaderBytes && arcDataBytes) {
            binaryPrimitives.arcs = PcbBinaryPrimitiveParser.parseArcStream(
                arcHeaderBytes,
                arcDataBytes
            )
            if (binaryPrimitives.arcs.length) {
                usedStreamNames.add('Arcs6/Data')
            }
        }

        if (trackHeaderBytes && trackDataBytes) {
            binaryPrimitives.tracks = PcbBinaryPrimitiveParser.parseTrackStream(
                trackHeaderBytes,
                trackDataBytes
            )
            if (binaryPrimitives.tracks.length) {
                usedStreamNames.add('Tracks6/Data')
            }
        }

        if (viaHeaderBytes && viaDataBytes) {
            binaryPrimitives.vias = PcbBinaryPrimitiveParser.parseViaStream(
                viaHeaderBytes,
                viaDataBytes
            )
            if (binaryPrimitives.vias.length) {
                usedStreamNames.add('Vias6/Data')
            }
        }

        if (fillHeaderBytes && fillDataBytes) {
            binaryPrimitives.fills = PcbBinaryPrimitiveParser.parseFillStream(
                fillHeaderBytes,
                fillDataBytes
            )
            if (binaryPrimitives.fills.length) {
                usedStreamNames.add('Fills6/Data')
            }
        }

        if (padHeaderBytes && padDataBytes) {
            binaryPrimitives.pads = PcbBinaryPrimitiveParser.parsePadStream(
                padHeaderBytes,
                padDataBytes
            )
            if (binaryPrimitives.pads.length) {
                usedStreamNames.add('Pads6/Data')
            }
        }

        if (textHeaderBytes && textDataBytes) {
            binaryPrimitives.texts = PcbBinaryPrimitiveParser.parseTextStream(
                textHeaderBytes,
                textDataBytes
            )
            if (binaryPrimitives.texts.length) {
                usedStreamNames.add(textStreamName)
            }
        }

        if (regionHeaderBytes && regionDataBytes) {
            binaryPrimitives.regions =
                PcbBinaryPrimitiveParser.parseRegionStream(
                    regionHeaderBytes,
                    regionDataBytes
                )
            if (binaryPrimitives.regions.length) {
                usedStreamNames.add('Regions6/Data')
            }
        }

        if (shapeBasedRegionHeaderBytes && shapeBasedRegionDataBytes) {
            binaryPrimitives.shapeBasedRegions =
                PcbBinaryPrimitiveParser.parseRegionStream(
                    shapeBasedRegionHeaderBytes,
                    shapeBasedRegionDataBytes,
                    { shapeBased: true }
                )
            if (binaryPrimitives.shapeBasedRegions.length) {
                usedStreamNames.add('ShapeBasedRegions6/Data')
            }
        }

        if (boardRegionHeaderBytes && boardRegionDataBytes) {
            binaryPrimitives.boardRegions =
                PcbBinaryPrimitiveParser.parseRegionStream(
                    boardRegionHeaderBytes,
                    boardRegionDataBytes
                )
            if (binaryPrimitives.boardRegions.length) {
                usedStreamNames.add('BoardRegions/Data')
            }
        }

        const embeddedModels =
            PcbEmbeddedModelExtractor.extractFromStreams(streams)

        if (
            embeddedModels.models.length ||
            embeddedModels.componentBodies.length
        ) {
            usedStreamNames.add('Models/Data')
            embeddedModels.models.forEach((model) =>
                usedStreamNames.add(model.sourceStream)
            )
            embeddedModels.componentBodies.forEach((componentBody) =>
                usedStreamNames.add(componentBody.sourceStream)
            )
        }

        return {
            records,
            streamNames: [...usedStreamNames].sort((left, right) =>
                left.localeCompare(right)
            ),
            binaryPrimitives,
            embeddedModels,
            diagnostics: {
                printableRecordCount: records.length,
                printableStreamCount: printableStreamNames.size,
                binaryPrimitiveCount:
                    binaryPrimitives.arcs.length +
                    binaryPrimitives.tracks.length +
                    binaryPrimitives.vias.length +
                    binaryPrimitives.fills.length +
                    binaryPrimitives.pads.length +
                    binaryPrimitives.texts.length +
                    binaryPrimitives.regions.length +
                    binaryPrimitives.shapeBasedRegions.length +
                    binaryPrimitives.boardRegions.length
            }
        }
    }

    /**
     * Normalizes one byte view into an isolated ArrayBuffer.
     * @param {Uint8Array} bytes
     * @returns {ArrayBuffer}
     */
    static #toArrayBuffer(bytes) {
        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )
    }
}
