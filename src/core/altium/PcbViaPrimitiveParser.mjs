// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbPrimitiveRecordSlicer } from './PcbPrimitiveRecordSlicer.mjs'
import { PcbPrimitiveOwnershipIndexParser } from './PcbPrimitiveOwnershipIndexParser.mjs'
import { PcbViaStackParser } from './PcbViaStackParser.mjs'

/**
 * Decodes Altium via primitive streams.
 */
export class PcbViaPrimitiveParser {
    static #VIA_OBJECT_ID = 3

    static #VIA_RECORD_BYTE_LENGTH = 326

    static #VIA_PAYLOAD_MIN_BYTE_LENGTH = 209

    /**
     * Decodes one via stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, diameter: number, holeDiameter: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number | null, layerId: number | null, layerStartId: number | null, layerEndId: number | null, [key: string]: unknown }[]}
     */
    static parseViaStream(headerBytes, dataBytes) {
        return PcbViaPrimitiveParser.#sliceViaRecords(
            headerBytes,
            dataBytes
        ).map((view) => PcbViaPrimitiveParser.#parseViaRecord(view))
    }

    /**
     * Decodes one via record view into a normalized primitive.
     * @param {DataView} view
     * @returns {{ x: number, y: number, diameter: number, holeDiameter: number, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number | null, layerId: number | null, layerStartId: number | null, layerEndId: number | null, [key: string]: unknown }}
     */
    static #parseViaRecord(view) {
        const ownershipIndexes =
            PcbPrimitiveOwnershipIndexParser.readOwnershipIndexes(view, {
                component: 12,
                net: 8,
                polygon: 10
            })

        return {
            x: PcbViaPrimitiveParser.#readMil(view, 18),
            y: PcbViaPrimitiveParser.#readMil(view, 22),
            diameter: PcbViaPrimitiveParser.#readMil(view, 26),
            holeDiameter: PcbViaPrimitiveParser.#readMil(view, 30),
            ...ownershipIndexes,
            layerCode: view.getUint8(5) || null,
            layerId: view.getUint8(5) || null,
            layerStartId: view.getUint8(34) || null,
            layerEndId: view.getUint8(35) || null,
            ...PcbViaStackParser.parse(view)
        }
    }

    /**
     * Splits a via stream into record views, preserving variable tail lengths
     * when Altium stores object-id and payload-length prefixes.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {DataView[]}
     */
    static #sliceViaRecords(headerBytes, dataBytes) {
        return PcbPrimitiveRecordSlicer.slicePrimitiveRecords({
            headerBytes,
            dataBytes,
            objectId: PcbViaPrimitiveParser.#VIA_OBJECT_ID,
            fixedRecordByteLength:
                PcbViaPrimitiveParser.#VIA_RECORD_BYTE_LENGTH,
            minimumPayloadByteLength:
                PcbViaPrimitiveParser.#VIA_PAYLOAD_MIN_BYTE_LENGTH,
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
