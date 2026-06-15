// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbPrimitiveRecordSlicer } from './PcbPrimitiveRecordSlicer.mjs'
import { PcbPrimitiveOwnershipIndexParser } from './PcbPrimitiveOwnershipIndexParser.mjs'

/**
 * Decodes Altium track primitive streams.
 */
export class PcbTrackPrimitiveParser {
    static #TRACK_OBJECT_ID = 4

    static #TRACK_RECORD_BYTE_LENGTH = 49

    static #TRACK_PAYLOAD_MIN_BYTE_LENGTH = 33

    /**
     * Decodes one track stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number, [key: string]: unknown }[]}
     */
    static parseTrackStream(headerBytes, dataBytes) {
        return PcbTrackPrimitiveParser.#sliceTrackRecords(
            headerBytes,
            dataBytes
        ).map((view) => PcbTrackPrimitiveParser.#parseTrackRecord(view))
    }

    /**
     * Decodes one track record view into a normalized primitive.
     * @param {DataView} view
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number, layerId: number, [key: string]: unknown }}
     */
    static #parseTrackRecord(view) {
        const layerId = view.getUint8(0)
        const ownershipIndexes =
            PcbPrimitiveOwnershipIndexParser.readOwnershipIndexes(view, {
                component: 7,
                net: 3,
                polygon: 5
            })

        return {
            x1: PcbTrackPrimitiveParser.#readMil(view, 13),
            y1: PcbTrackPrimitiveParser.#readMil(view, 17),
            x2: PcbTrackPrimitiveParser.#readMil(view, 21),
            y2: PcbTrackPrimitiveParser.#readMil(view, 25),
            width: PcbTrackPrimitiveParser.#readMil(view, 29),
            ...ownershipIndexes,
            ...PcbTrackPrimitiveParser.#parseTrackMetadata(view),
            layerCode: layerId,
            layerId
        }
    }

    /**
     * Decodes optional route-state metadata from one track record.
     * @param {DataView} view Track record view.
     * @returns {{ trackFlags?: number, isSelected?: boolean, isLocked?: boolean, isPartOfComponent?: boolean, isKeepout?: boolean, unionIndex?: number, isLengthTuning?: boolean, isUserRouted?: boolean }}
     */
    static #parseTrackMetadata(view) {
        const flags = PcbTrackPrimitiveParser.#readByteIfAvailable(view, 1)
        const keepout = PcbTrackPrimitiveParser.#readByteIfAvailable(view, 2)
        const unionIndex = PcbTrackPrimitiveParser.#readByteIfAvailable(
            view,
            36
        )
        const lengthTuning = PcbTrackPrimitiveParser.#readByteIfAvailable(
            view,
            37
        )
        const userRouted = PcbTrackPrimitiveParser.#readByteIfAvailable(
            view,
            44
        )

        if (!flags && !keepout && !unionIndex && !lengthTuning && !userRouted) {
            return {}
        }

        const result = {}

        if (flags) {
            result.trackFlags = flags
            result.isSelected = (flags & 0x01) !== 0
            result.isLocked = (flags & 0x04) === 0
            result.isPartOfComponent = (flags & 0x10) !== 0
        }
        if (keepout) {
            result.isKeepout = true
        }
        if (unionIndex) {
            result.unionIndex = unionIndex
        }
        if (lengthTuning) {
            result.isLengthTuning = true
        }
        if (userRouted) {
            result.isUserRouted = true
        }

        return result
    }

    /**
     * Splits a track stream into record views, preserving variable payload
     * lengths when tracks are stored with object-id and payload-length
     * prefixes.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {DataView[]}
     */
    static #sliceTrackRecords(headerBytes, dataBytes) {
        return PcbPrimitiveRecordSlicer.slicePrimitiveRecords({
            headerBytes,
            dataBytes,
            objectId: PcbTrackPrimitiveParser.#TRACK_OBJECT_ID,
            fixedRecordByteLength:
                PcbTrackPrimitiveParser.#TRACK_RECORD_BYTE_LENGTH,
            minimumPayloadByteLength:
                PcbTrackPrimitiveParser.#TRACK_PAYLOAD_MIN_BYTE_LENGTH,
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

    /**
     * Reads one byte when it is present in a variable-length record.
     * @param {DataView} view Record view.
     * @param {number} offset Byte offset.
     * @returns {number}
     */
    static #readByteIfAvailable(view, offset) {
        if (!view || offset >= view.byteLength) {
            return 0
        }

        return view.getUint8(offset)
    }
}
