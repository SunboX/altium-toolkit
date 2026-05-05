// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Decodes fixed-size binary PCB primitive streams recovered from OLE-backed
 * PcbDoc files.
 */
export class PcbBinaryPrimitiveParser {
    static #ARC_OBJECT_ID = 1

    static #ARC_RECORD_MIN_BYTE_LENGTH = 45

    static #TRACK_OBJECT_ID = 4

    static #PAD_OBJECT_ID = 2

    static #PAD_SUBRECORD_COUNT = 6

    static #PAD_MAIN_SUBRECORD_INDEX = 4

    static #PAD_EXTENSION_SUBRECORD_INDEX = 5

    static #PAD_MAIN_RECORD_MIN_BYTE_LENGTH = 61

    static #PAD_EXTENSION_MIN_BYTE_LENGTH = 596

    /**
     * Decodes one length-prefixed track stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number, layerId: number }[]}
     */
    static parseTrackStream(headerBytes, dataBytes) {
        const count = PcbBinaryPrimitiveParser.#readRecordCount(headerBytes)
        const normalizedData = PcbBinaryPrimitiveParser.#toUint8Array(dataBytes)

        if (!count) {
            return []
        }

        let offset = 0
        const tracks = []

        for (let index = 0; index < count; index += 1) {
            if (offset + 5 > normalizedData.byteLength) {
                return []
            }

            const objectId = normalizedData[offset]
            offset += 1

            if (objectId !== PcbBinaryPrimitiveParser.#TRACK_OBJECT_ID) {
                return []
            }

            const payloadLength = new DataView(
                normalizedData.buffer,
                normalizedData.byteOffset + offset,
                4
            ).getUint32(0, true)
            offset += 4

            if (offset + payloadLength > normalizedData.byteLength) {
                return []
            }

            const payload = new DataView(
                normalizedData.buffer,
                normalizedData.byteOffset + offset,
                payloadLength
            )
            const layerId = payload.getUint8(0)

            tracks.push({
                x1: PcbBinaryPrimitiveParser.#readMil(payload, 13),
                y1: PcbBinaryPrimitiveParser.#readMil(payload, 17),
                x2: PcbBinaryPrimitiveParser.#readMil(payload, 21),
                y2: PcbBinaryPrimitiveParser.#readMil(payload, 25),
                width: PcbBinaryPrimitiveParser.#readMil(payload, 29),
                layerCode: layerId,
                layerId
            })

            offset += payloadLength
        }

        return tracks
    }

    /**
     * Decodes one fixed-size via stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, diameter: number, holeDiameter: number }[]}
     */
    static parseViaStream(headerBytes, dataBytes) {
        return PcbBinaryPrimitiveParser.#sliceFixedRecords(
            headerBytes,
            dataBytes,
            326
        ).map((view) => ({
            x: PcbBinaryPrimitiveParser.#readMil(view, 18),
            y: PcbBinaryPrimitiveParser.#readMil(view, 22),
            diameter: PcbBinaryPrimitiveParser.#readMil(view, 26),
            holeDiameter: PcbBinaryPrimitiveParser.#readMil(view, 30)
        }))
    }

    /**
     * Decodes one fixed-size fill stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, layerCode: number, layerId: number }[]}
     */
    static parseFillStream(headerBytes, dataBytes) {
        return PcbBinaryPrimitiveParser.#sliceFixedRecords(
            headerBytes,
            dataBytes,
            55
        ).map((view) => ({
            x1: PcbBinaryPrimitiveParser.#readMil(view, 18),
            y1: PcbBinaryPrimitiveParser.#readMil(view, 22),
            x2: PcbBinaryPrimitiveParser.#readMil(view, 26),
            y2: PcbBinaryPrimitiveParser.#readMil(view, 30),
            layerCode: view.getUint16(46, true),
            layerId: view.getUint8(5)
        }))
    }

    /**
     * Decodes one length-prefixed arc stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode: number, layerId: number }[]}
     */
    static parseArcStream(headerBytes, dataBytes) {
        const count = PcbBinaryPrimitiveParser.#readRecordCount(headerBytes)
        const normalizedData = PcbBinaryPrimitiveParser.#toUint8Array(dataBytes)

        if (!count) {
            return []
        }

        let offset = 0
        const arcs = []

        for (let index = 0; index < count; index += 1) {
            if (offset + 5 > normalizedData.byteLength) {
                return []
            }

            const objectId = normalizedData[offset]
            offset += 1

            if (objectId !== PcbBinaryPrimitiveParser.#ARC_OBJECT_ID) {
                return []
            }

            const payloadLength = new DataView(
                normalizedData.buffer,
                normalizedData.byteOffset + offset,
                4
            ).getUint32(0, true)
            offset += 4

            if (
                payloadLength <
                    PcbBinaryPrimitiveParser.#ARC_RECORD_MIN_BYTE_LENGTH ||
                offset + payloadLength > normalizedData.byteLength
            ) {
                return []
            }

            const payload = new DataView(
                normalizedData.buffer,
                normalizedData.byteOffset + offset,
                payloadLength
            )
            const layerId = payload.getUint8(0)

            arcs.push({
                x: PcbBinaryPrimitiveParser.#readMil(payload, 13),
                y: PcbBinaryPrimitiveParser.#readMil(payload, 17),
                radius: PcbBinaryPrimitiveParser.#readMil(payload, 21),
                startAngle: payload.getFloat64(25, true),
                endAngle: payload.getFloat64(33, true),
                width: PcbBinaryPrimitiveParser.#readMil(payload, 41),
                layerCode: layerId,
                layerId
            })

            offset += payloadLength
        }

        return arcs
    }

    /**
     * Decodes one variable-length pad stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean, holeShape: number | null, holeSlotLength: number | null, holeRotation: number | null, hasRoundedRect: boolean, roundedRectShapeTop: number | null, cornerRadiusTop: number | null, offsetTopX: number, offsetTopY: number }[]}
     */
    static parsePadStream(headerBytes, dataBytes) {
        const count = PcbBinaryPrimitiveParser.#readRecordCount(headerBytes)
        const normalizedData = PcbBinaryPrimitiveParser.#toUint8Array(dataBytes)

        if (!count) {
            return []
        }

        let offset = 0
        const pads = []

        for (let index = 0; index < count; index += 1) {
            if (offset + 1 > normalizedData.byteLength) {
                return []
            }

            const objectId = normalizedData[offset]
            offset += 1

            if (objectId !== PcbBinaryPrimitiveParser.#PAD_OBJECT_ID) {
                return []
            }

            const subrecords = []

            for (
                let subrecordIndex = 0;
                subrecordIndex < PcbBinaryPrimitiveParser.#PAD_SUBRECORD_COUNT;
                subrecordIndex += 1
            ) {
                if (offset + 4 > normalizedData.byteLength) {
                    return []
                }

                const subrecordLength = new DataView(
                    normalizedData.buffer,
                    normalizedData.byteOffset + offset,
                    4
                ).getUint32(0, true)
                offset += 4

                if (offset + subrecordLength > normalizedData.byteLength) {
                    return []
                }

                subrecords.push(
                    new DataView(
                        normalizedData.buffer,
                        normalizedData.byteOffset + offset,
                        subrecordLength
                    )
                )
                offset += subrecordLength
            }

            const pad = PcbBinaryPrimitiveParser.#parsePadSubrecords(subrecords)

            if (!pad) {
                return []
            }

            pads.push(pad)
        }

        return pads
    }

    /**
     * Splits one fixed-length record stream into DataView slices.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @param {number} recordByteLength
     * @returns {DataView[]}
     */
    static #sliceFixedRecords(headerBytes, dataBytes, recordByteLength) {
        const normalizedData = PcbBinaryPrimitiveParser.#toUint8Array(dataBytes)
        const count = PcbBinaryPrimitiveParser.#readRecordCount(headerBytes)

        if (!count) {
            return []
        }

        if (normalizedData.byteLength < count * recordByteLength) {
            return []
        }

        const views = []

        for (let index = 0; index < count; index += 1) {
            views.push(
                new DataView(
                    normalizedData.buffer,
                    normalizedData.byteOffset + index * recordByteLength,
                    recordByteLength
                )
            )
        }

        return views
    }

    /**
     * Decodes one pad payload from its subrecords.
     * @param {DataView[]} subrecords
     * @returns {{ x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean, holeShape: number | null, holeSlotLength: number | null, holeRotation: number | null, hasRoundedRect: boolean, roundedRectShapeTop: number | null, cornerRadiusTop: number | null, offsetTopX: number, offsetTopY: number } | null}
     */
    static #parsePadSubrecords(subrecords) {
        const mainRecord =
            subrecords[PcbBinaryPrimitiveParser.#PAD_MAIN_SUBRECORD_INDEX]
        const extensionRecord =
            subrecords[PcbBinaryPrimitiveParser.#PAD_EXTENSION_SUBRECORD_INDEX]

        if (
            !mainRecord ||
            mainRecord.byteLength <
                PcbBinaryPrimitiveParser.#PAD_MAIN_RECORD_MIN_BYTE_LENGTH
        ) {
            return null
        }

        return {
            x: PcbBinaryPrimitiveParser.#readMil(mainRecord, 13),
            y: PcbBinaryPrimitiveParser.#readMil(mainRecord, 17),
            sizeTopX: PcbBinaryPrimitiveParser.#readMil(mainRecord, 21),
            sizeTopY: PcbBinaryPrimitiveParser.#readMil(mainRecord, 25),
            sizeMidX: PcbBinaryPrimitiveParser.#readMil(mainRecord, 29),
            sizeMidY: PcbBinaryPrimitiveParser.#readMil(mainRecord, 33),
            sizeBottomX: PcbBinaryPrimitiveParser.#readMil(mainRecord, 37),
            sizeBottomY: PcbBinaryPrimitiveParser.#readMil(mainRecord, 41),
            holeDiameter: PcbBinaryPrimitiveParser.#readMil(mainRecord, 45),
            shapeTop: mainRecord.getUint8(49),
            shapeMid: mainRecord.getUint8(50),
            shapeBottom: mainRecord.getUint8(51),
            rotation: mainRecord.getFloat64(52, true),
            isPlated: mainRecord.getUint8(60) !== 0,
            ...PcbBinaryPrimitiveParser.#parsePadExtensionBlock(extensionRecord)
        }
    }

    /**
     * Decodes one optional pad extension block.
     * @param {DataView | undefined} extensionRecord
     * @returns {{ holeShape: number | null, holeSlotLength: number | null, holeRotation: number | null, hasRoundedRect: boolean, roundedRectShapeTop: number | null, cornerRadiusTop: number | null, offsetTopX: number, offsetTopY: number }}
     */
    static #parsePadExtensionBlock(extensionRecord) {
        if (
            !extensionRecord ||
            extensionRecord.byteLength <
                PcbBinaryPrimitiveParser.#PAD_EXTENSION_MIN_BYTE_LENGTH
        ) {
            return {
                holeShape: null,
                holeSlotLength: null,
                holeRotation: null,
                hasRoundedRect: false,
                roundedRectShapeTop: null,
                cornerRadiusTop: null,
                offsetTopX: 0,
                offsetTopY: 0
            }
        }

        return {
            holeShape: extensionRecord.getUint8(262),
            holeSlotLength: PcbBinaryPrimitiveParser.#readMil(
                extensionRecord,
                263
            ),
            holeRotation: extensionRecord.getFloat64(267, true),
            hasRoundedRect: extensionRecord.getUint8(531) !== 0,
            roundedRectShapeTop: extensionRecord.getUint8(532),
            cornerRadiusTop: extensionRecord.getUint8(564),
            offsetTopX: PcbBinaryPrimitiveParser.#readMil(extensionRecord, 275),
            offsetTopY: PcbBinaryPrimitiveParser.#readMil(extensionRecord, 403)
        }
    }

    /**
     * Normalizes one byte-like input into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes)
    }

    /**
     * Reads one little-endian record count from a binary stream header.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @returns {number}
     */
    static #readRecordCount(headerBytes) {
        const normalizedHeader =
            PcbBinaryPrimitiveParser.#toUint8Array(headerBytes)

        if (normalizedHeader.byteLength < 4) {
            return 0
        }

        return new DataView(
            normalizedHeader.buffer,
            normalizedHeader.byteOffset,
            normalizedHeader.byteLength
        ).getUint32(0, true)
    }

    /**
     * Reads one signed fixed-point mil coordinate.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readMil(view, offset) {
        return view.getInt32(offset, true) / 10000
    }
}
