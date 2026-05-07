// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbArcPrimitiveParser } from './PcbArcPrimitiveParser.mjs'
import { PcbFillPrimitiveParser } from './PcbFillPrimitiveParser.mjs'
import { PcbPadPrimitiveParser } from './PcbPadPrimitiveParser.mjs'
import { PcbRegionPrimitiveParser } from './PcbRegionPrimitiveParser.mjs'
import { PcbTextPrimitiveParser } from './PcbTextPrimitiveParser.mjs'
import { PcbTrackPrimitiveParser } from './PcbTrackPrimitiveParser.mjs'
import { PcbViaPrimitiveParser } from './PcbViaPrimitiveParser.mjs'

/**
 * Decodes binary PCB primitive streams recovered from OLE-backed PcbDoc files,
 * including legacy fixed-layout records and object-id/length-prefixed records.
 */
export class PcbBinaryPrimitiveParser {
    /**
     * Decodes one track stream in either supported binary record format.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number }[]}
     */
    static parseTrackStream(headerBytes, dataBytes) {
        return PcbTrackPrimitiveParser.parseTrackStream(headerBytes, dataBytes)
    }

    /**
     * Decodes one via stream in either supported binary record format.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, diameter: number, holeDiameter: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number | null, layerId: number | null, layerStartId: number | null, layerEndId: number | null }[]}
     */
    static parseViaStream(headerBytes, dataBytes) {
        return PcbViaPrimitiveParser.parseViaStream(headerBytes, dataBytes)
    }

    /**
     * Decodes one fill stream in either supported binary record format.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number }[]}
     */
    static parseFillStream(headerBytes, dataBytes) {
        return PcbFillPrimitiveParser.parseFillStream(headerBytes, dataBytes)
    }

    /**
     * Decodes one arc stream in either supported binary record format.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number }[]}
     */
    static parseArcStream(headerBytes, dataBytes) {
        return PcbArcPrimitiveParser.parseArcStream(headerBytes, dataBytes)
    }

    /**
     * Decodes one variable-length pad stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, shapeTopName: string | null, shapeMidName: string | null, shapeBottomName: string | null, rotation: number, isPlated: boolean, holeShape: number | null, holeSlotLength: number | null, holeRotation: number | null, hasRoundedRect: boolean, roundedRectShapeTop: number | null, cornerRadiusTop: number | null, offsetTopX: number, offsetTopY: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number | null, layerId: number | null, legacyLayerId: number | null, layerV7SaveId: number | null, [key: string]: unknown }[]}
     */
    static parsePadStream(headerBytes, dataBytes) {
        return PcbPadPrimitiveParser.parsePadStream(headerBytes, dataBytes)
    }

    /**
     * Decodes one variable-length PCB text stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @param {{ wideStrings?: Map<number | string, string> | Record<string, string> | { byIndex?: Record<string, string> } }} [options]
     * @returns {{ text: string, x: number, y: number, height: number, layerId: number, ownerIndex: number | null, kind: number, visibilityFlags: number, rotation: number, role?: string, isDesignator?: boolean, isComment?: boolean, isPlaceholder?: boolean, componentIndex?: number }[]}
     */
    static parseTextStream(headerBytes, dataBytes, options = {}) {
        return PcbTextPrimitiveParser.parseTextStream(
            headerBytes,
            dataBytes,
            options
        )
    }

    /**
     * Decodes one variable-length PCB region stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @param {{ shapeBased?: boolean }} [options]
     * @returns {{ layerId: number, layerCode: number, netIndex: number | null, polygonIndex: number | null, componentIndex: number | null, kind: number, isKeepout: boolean, isBoardCutout: boolean, isShapeBased: boolean, points: object[], holes: object[][], properties: Record<string, string> }[]}
     */
    static parseRegionStream(headerBytes, dataBytes, options = {}) {
        return PcbRegionPrimitiveParser.parseRegionStream(
            headerBytes,
            dataBytes,
            options
        )
    }
}
