// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbPrimitiveRecordSlicer } from './PcbPrimitiveRecordSlicer.mjs'
import { PcbPrimitiveOwnershipIndexParser } from './PcbPrimitiveOwnershipIndexParser.mjs'

/**
 * Decodes Altium arc primitive streams.
 */
export class PcbArcPrimitiveParser {
    static #ARC_OBJECT_ID = 1

    static #ARC_RECORD_BYTE_LENGTH = 60

    static #ARC_PAYLOAD_MIN_BYTE_LENGTH = 45

    /**
     * Decodes one arc stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number }[]}
     */
    static parseArcStream(headerBytes, dataBytes) {
        return PcbArcPrimitiveParser.#sliceArcRecords(
            headerBytes,
            dataBytes
        ).map((view) => PcbArcPrimitiveParser.#parseArcRecord(view))
    }

    /**
     * Decodes one arc record view into a normalized primitive.
     * @param {DataView} view
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number }}
     */
    static #parseArcRecord(view) {
        const layerId = view.getUint8(0)
        const ownershipIndexes =
            PcbPrimitiveOwnershipIndexParser.readOwnershipIndexes(view, {
                component: 7,
                net: 3,
                polygon: 5
            })

        return {
            x: PcbArcPrimitiveParser.#readMil(view, 13),
            y: PcbArcPrimitiveParser.#readMil(view, 17),
            radius: PcbArcPrimitiveParser.#readMil(view, 21),
            startAngle: view.getFloat64(25, true),
            endAngle: view.getFloat64(33, true),
            width: PcbArcPrimitiveParser.#readMil(view, 41),
            ...ownershipIndexes,
            layerCode: layerId,
            layerId
        }
    }

    /**
     * Splits an arc stream into record views, preserving variable payload
     * lengths when arcs are stored with object-id and payload-length prefixes.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {DataView[]}
     */
    static #sliceArcRecords(headerBytes, dataBytes) {
        return PcbPrimitiveRecordSlicer.slicePrimitiveRecords({
            headerBytes,
            dataBytes,
            objectId: PcbArcPrimitiveParser.#ARC_OBJECT_ID,
            fixedRecordByteLength:
                PcbArcPrimitiveParser.#ARC_RECORD_BYTE_LENGTH,
            minimumPayloadByteLength:
                PcbArcPrimitiveParser.#ARC_PAYLOAD_MIN_BYTE_LENGTH,
            lengthPrefixedView: 'payload'
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
