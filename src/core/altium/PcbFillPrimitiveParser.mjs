// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbPrimitiveRecordSlicer } from './PcbPrimitiveRecordSlicer.mjs'
import { PcbPrimitiveOwnershipIndexParser } from './PcbPrimitiveOwnershipIndexParser.mjs'

/**
 * Decodes Altium fill primitive streams.
 */
export class PcbFillPrimitiveParser {
    static #FILL_OBJECT_ID = 6

    static #FILL_RECORD_BYTE_LENGTH = 55

    static #FILL_PAYLOAD_MIN_BYTE_LENGTH = 50

    /**
     * Decodes one fill stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number }[]}
     */
    static parseFillStream(headerBytes, dataBytes) {
        return PcbFillPrimitiveParser.#sliceFillRecords(
            headerBytes,
            dataBytes
        ).map((view) => PcbFillPrimitiveParser.#parseFillRecord(view))
    }

    /**
     * Decodes one fill record view into a normalized primitive.
     * @param {DataView} view
     * @returns {{ x1: number, y1: number, x2: number, y2: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number }}
     */
    static #parseFillRecord(view) {
        const ownershipIndexes =
            PcbPrimitiveOwnershipIndexParser.readOwnershipIndexes(view, {
                component: 12,
                net: 8,
                polygon: 10
            })

        return {
            x1: PcbFillPrimitiveParser.#readMil(view, 18),
            y1: PcbFillPrimitiveParser.#readMil(view, 22),
            x2: PcbFillPrimitiveParser.#readMil(view, 26),
            y2: PcbFillPrimitiveParser.#readMil(view, 30),
            ...ownershipIndexes,
            layerCode: view.getUint16(46, true),
            layerId: view.getUint8(5)
        }
    }

    /**
     * Splits a fill stream into record views, preserving variable payload
     * lengths when fills are stored with object-id and payload-length prefixes.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {DataView[]}
     */
    static #sliceFillRecords(headerBytes, dataBytes) {
        return PcbPrimitiveRecordSlicer.slicePrimitiveRecords({
            headerBytes,
            dataBytes,
            objectId: PcbFillPrimitiveParser.#FILL_OBJECT_ID,
            fixedRecordByteLength:
                PcbFillPrimitiveParser.#FILL_RECORD_BYTE_LENGTH,
            minimumPayloadByteLength:
                PcbFillPrimitiveParser.#FILL_PAYLOAD_MIN_BYTE_LENGTH,
            lengthPrefixedView: 'record'
        }).map((record) => record.view)
    }

    /**
     * Reads one standard fixed-point mil value.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readMil(view, offset) {
        return view.getInt32(offset, true) / 10000
    }
}
