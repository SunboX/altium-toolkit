// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbLayerIdCodec } from './PcbLayerIdCodec.mjs'
import { PcbPadShapeCodec } from './PcbPadShapeCodec.mjs'
import { PcbPadStackParser } from './PcbPadStackParser.mjs'
import { PcbPrimitiveOwnershipIndexParser } from './PcbPrimitiveOwnershipIndexParser.mjs'

/**
 * Decodes Altium pad primitive streams.
 */
export class PcbPadPrimitiveParser {
    static #PAD_OBJECT_ID = 2

    static #PAD_SUBRECORD_COUNT = 6

    static #PAD_MAIN_SUBRECORD_INDEX = 4

    static #PAD_EXTENSION_SUBRECORD_INDEX = 5

    static #PAD_MAIN_RECORD_MIN_BYTE_LENGTH = 61

    /**
     * Decodes one variable-length pad stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, shapeTopName: string | null, shapeMidName: string | null, shapeBottomName: string | null, padShapeNames: { top: string | null, middle: string | null, bottom: string | null }, rotation: number, isPlated: boolean, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number | null, layerId: number | null, legacyLayerId: number | null, layerV7SaveId: number | null, [key: string]: unknown }[]}
     */
    static parsePadStream(headerBytes, dataBytes) {
        const count = PcbPadPrimitiveParser.#readRecordCount(headerBytes)
        const normalizedData = PcbPadPrimitiveParser.#toUint8Array(dataBytes)

        if (!count) {
            return []
        }

        let offset = 0
        const pads = []

        for (let index = 0; index < count; index += 1) {
            const record = PcbPadPrimitiveParser.#readPadRecordAt(
                normalizedData,
                offset
            )

            if (!record) {
                return []
            }

            const pad = PcbPadPrimitiveParser.#parsePadSubrecords(
                record.subrecords
            )

            if (!pad) {
                return []
            }

            pads.push(pad)
            offset = record.nextOffset

            if (index < count - 1) {
                const nextOffset =
                    PcbPadPrimitiveParser.#findNextPadRecordOffset(
                        normalizedData,
                        offset,
                        count - index - 1
                    )

                if (nextOffset === null) {
                    return []
                }

                offset = nextOffset
            }
        }

        return pads
    }

    /**
     * Reads one pad record and its known subrecords from a stream offset.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {{ subrecords: DataView[], nextOffset: number } | null}
     */
    static #readPadRecordAt(bytes, offset) {
        if (
            offset + 1 > bytes.byteLength ||
            bytes[offset] !== PcbPadPrimitiveParser.#PAD_OBJECT_ID
        ) {
            return null
        }

        let cursor = offset + 1
        const subrecords = []

        for (
            let subrecordIndex = 0;
            subrecordIndex < PcbPadPrimitiveParser.#PAD_SUBRECORD_COUNT;
            subrecordIndex += 1
        ) {
            const subrecord = PcbPadPrimitiveParser.#readSubrecordAt(
                bytes,
                cursor
            )

            if (!subrecord) {
                return null
            }

            subrecords.push(subrecord.view)
            cursor = subrecord.nextOffset
        }

        return { subrecords, nextOffset: cursor }
    }

    /**
     * Reads one length-prefixed pad subrecord.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {{ view: DataView, nextOffset: number } | null}
     */
    static #readSubrecordAt(bytes, offset) {
        if (offset + 4 > bytes.byteLength) {
            return null
        }

        const subrecordLength = PcbPadPrimitiveParser.#readUint32FromBytes(
            bytes,
            offset
        )
        const payloadOffset = offset + 4
        const nextOffset = payloadOffset + subrecordLength

        if (nextOffset > bytes.byteLength) {
            return null
        }

        return {
            view: new DataView(
                bytes.buffer,
                bytes.byteOffset + payloadOffset,
                subrecordLength
            ),
            nextOffset
        }
    }

    /**
     * Finds the next pad record boundary after optional unknown subrecords.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} remainingCount
     * @returns {number | null}
     */
    static #findNextPadRecordOffset(bytes, offset, remainingCount) {
        let cursor = offset

        while (cursor < bytes.byteLength) {
            if (
                PcbPadPrimitiveParser.#canReadPadRecordSequence(
                    bytes,
                    cursor,
                    remainingCount
                )
            ) {
                return cursor
            }

            const unknownSubrecord = PcbPadPrimitiveParser.#readSubrecordAt(
                bytes,
                cursor
            )

            if (!unknownSubrecord) {
                return null
            }

            cursor = unknownSubrecord.nextOffset
        }

        return null
    }

    /**
     * Checks whether the remaining pad records can be read from an offset.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} remainingCount
     * @returns {boolean}
     */
    static #canReadPadRecordSequence(bytes, offset, remainingCount) {
        const record = PcbPadPrimitiveParser.#readPadRecordAt(bytes, offset)

        if (!record) {
            return false
        }

        if (remainingCount <= 1) {
            return true
        }

        return (
            PcbPadPrimitiveParser.#findNextPadRecordOffset(
                bytes,
                record.nextOffset,
                remainingCount - 1
            ) !== null
        )
    }

    /**
     * Decodes one pad payload from its subrecords.
     * @param {DataView[]} subrecords
     * @returns {{ x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, shapeTopName: string | null, shapeMidName: string | null, shapeBottomName: string | null, padShapeNames: { top: string | null, middle: string | null, bottom: string | null }, rotation: number, isPlated: boolean, componentIndex: number | null, netIndex: number | null, polygonIndex: number | null, layerCode: number | null, layerId: number | null, legacyLayerId: number | null, layerV7SaveId: number | null, [key: string]: unknown } | null}
     */
    static #parsePadSubrecords(subrecords) {
        const mainRecord =
            subrecords[PcbPadPrimitiveParser.#PAD_MAIN_SUBRECORD_INDEX]
        const extensionRecord =
            subrecords[PcbPadPrimitiveParser.#PAD_EXTENSION_SUBRECORD_INDEX]

        if (
            !mainRecord ||
            mainRecord.byteLength <
                PcbPadPrimitiveParser.#PAD_MAIN_RECORD_MIN_BYTE_LENGTH
        ) {
            return null
        }

        const layerState = PcbPadPrimitiveParser.#parsePadLayerState(mainRecord)
        const ownershipIndexes =
            PcbPrimitiveOwnershipIndexParser.readOwnershipIndexes(mainRecord, {
                component: 7,
                net: 3,
                polygon: 5
            })

        const pad = {
            x: PcbPadPrimitiveParser.#readMil(mainRecord, 13),
            y: PcbPadPrimitiveParser.#readMil(mainRecord, 17),
            sizeTopX: PcbPadPrimitiveParser.#readMil(mainRecord, 21),
            sizeTopY: PcbPadPrimitiveParser.#readMil(mainRecord, 25),
            sizeMidX: PcbPadPrimitiveParser.#readMil(mainRecord, 29),
            sizeMidY: PcbPadPrimitiveParser.#readMil(mainRecord, 33),
            sizeBottomX: PcbPadPrimitiveParser.#readMil(mainRecord, 37),
            sizeBottomY: PcbPadPrimitiveParser.#readMil(mainRecord, 41),
            holeDiameter: PcbPadPrimitiveParser.#readMil(mainRecord, 45),
            shapeTop: mainRecord.getUint8(49),
            shapeMid: mainRecord.getUint8(50),
            shapeBottom: mainRecord.getUint8(51),
            rotation: mainRecord.getFloat64(52, true),
            isPlated: mainRecord.getUint8(60) !== 0,
            ...ownershipIndexes,
            layerCode: layerState.layerId,
            layerId: layerState.layerId,
            legacyLayerId: layerState.legacyLayerId,
            layerV7SaveId: layerState.layerV7SaveId
        }

        return {
            ...pad,
            ...PcbPadShapeCodec.describePadShapes(pad),
            ...PcbPadStackParser.parse(mainRecord, extensionRecord, pad)
        }
    }

    /**
     * Decodes the visible and hidden saved-layer state from one pad main record.
     * @param {DataView} mainRecord
     * @returns {{ layerId: number | null, legacyLayerId: number | null, layerV7SaveId: number | null }}
     */
    static #parsePadLayerState(mainRecord) {
        const legacyLayerId = mainRecord.getUint8(0) || null
        const layerV7SaveId =
            mainRecord.byteLength >= 118
                ? mainRecord.getUint32(114, true) || null
                : null
        const decodedLayerId =
            PcbLayerIdCodec.legacyLayerIdFromV7SaveId(layerV7SaveId)

        return {
            layerId: decodedLayerId || legacyLayerId,
            legacyLayerId,
            layerV7SaveId
        }
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
     * Reads the little-endian record count from one stream header.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @returns {number}
     */
    static #readRecordCount(headerBytes) {
        const normalizedHeader =
            PcbPadPrimitiveParser.#toUint8Array(headerBytes)

        if (normalizedHeader.byteLength < 4) {
            return 0
        }

        return new DataView(
            normalizedHeader.buffer,
            normalizedHeader.byteOffset,
            4
        ).getUint32(0, true)
    }

    /**
     * Reads one little-endian unsigned 32-bit value from a byte array.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static #readUint32FromBytes(bytes, offset) {
        return new DataView(
            bytes.buffer,
            bytes.byteOffset + offset,
            4
        ).getUint32(0, true)
    }

    /**
     * Converts an ArrayBuffer or view into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes)
    }
}
