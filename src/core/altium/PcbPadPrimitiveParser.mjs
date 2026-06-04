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

        const records = PcbPadPrimitiveParser.#readPadRecordSequence(
            normalizedData,
            0,
            count
        )
        const pads = []

        if (!records) {
            return []
        }

        for (const record of records) {
            const pad = PcbPadPrimitiveParser.#parsePadSubrecords(
                record.subrecords
            )

            if (!pad) {
                return []
            }

            pads.push(pad)
        }

        return pads
    }

    /**
     * Reads all expected pad records without recursive suffix validation.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} count
     * @returns {{ subrecords: DataView[], nextOffset: number }[] | null}
     */
    static #readPadRecordSequence(bytes, offset, count) {
        const firstRecord = PcbPadPrimitiveParser.#readPadRecordAt(
            bytes,
            offset
        )

        if (!firstRecord) {
            return null
        }

        const records = [firstRecord]
        const alternativeScanOffsets = [null]
        let depth = 1
        let scanOffset = firstRecord.nextOffset

        while (depth < count) {
            const candidate = PcbPadPrimitiveParser.#findNextPadRecordCandidate(
                bytes,
                scanOffset
            )

            if (!candidate) {
                let foundAlternative = false

                while (depth > 1 && !foundAlternative) {
                    depth -= 1
                    records.length = depth

                    const alternativeOffset = alternativeScanOffsets[depth]
                    alternativeScanOffsets.length = depth

                    if (alternativeOffset !== null) {
                        scanOffset = alternativeOffset
                        foundAlternative = true
                    }
                }

                if (!foundAlternative) {
                    return null
                }

                continue
            }

            records[depth] = candidate.record
            alternativeScanOffsets[depth] = candidate.alternativeOffset
            depth += 1
            scanOffset = candidate.record.nextOffset
        }

        return records
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
     * Finds the next readable pad record after optional unknown subrecords.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {{ record: { subrecords: DataView[], nextOffset: number }, alternativeOffset: number | null } | null}
     */
    static #findNextPadRecordCandidate(bytes, offset) {
        let cursor = offset

        while (cursor < bytes.byteLength) {
            const record = PcbPadPrimitiveParser.#readPadRecordAt(bytes, cursor)
            const unknownSubrecord = PcbPadPrimitiveParser.#readSubrecordAt(
                bytes,
                cursor
            )

            if (record) {
                return {
                    record,
                    alternativeOffset: unknownSubrecord?.nextOffset ?? null
                }
            }

            if (!unknownSubrecord) {
                return null
            }

            cursor = unknownSubrecord.nextOffset
        }

        return null
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
