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

    static #TEXT_OBJECT_ID = 5

    static #TEXT_RECORD_MIN_BYTE_LENGTH = 64

    static #TEXT_RECORD_MAX_BYTE_LENGTH = 2048

    static #TRACK_OBJECT_ID = 4

    static #PAD_OBJECT_ID = 2

    static #PAD_SUBRECORD_COUNT = 6

    static #PAD_MAIN_SUBRECORD_INDEX = 4

    static #PAD_EXTENSION_SUBRECORD_INDEX = 5

    static #PAD_MAIN_RECORD_MIN_BYTE_LENGTH = 61

    static #PAD_EXTENSION_MIN_BYTE_LENGTH = 596

    static #REGION_OBJECT_ID = 11

    static #REGION_HEADER_BYTE_LENGTH = 18

    static #REGION_VERTEX_BYTE_LENGTH = 16

    static #SHAPE_REGION_VERTEX_BYTE_LENGTH = 37

    /**
     * Decodes one length-prefixed track stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width: number, componentIndex: number | null, layerCode: number, layerId: number }[]}
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
                componentIndex: PcbBinaryPrimitiveParser.#readComponentIndex(
                    payload,
                    7
                ),
                netIndex: PcbBinaryPrimitiveParser.#readLinkIndex(payload, 3),
                polygonIndex: PcbBinaryPrimitiveParser.#readLinkIndex(
                    payload,
                    5
                ),
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
     * @returns {{ x: number, y: number, diameter: number, holeDiameter: number, componentIndex: number | null }[]}
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
            holeDiameter: PcbBinaryPrimitiveParser.#readMil(view, 30),
            componentIndex: PcbBinaryPrimitiveParser.#readComponentIndex(
                view,
                12
            ),
            netIndex: PcbBinaryPrimitiveParser.#readLinkIndex(view, 8),
            polygonIndex: PcbBinaryPrimitiveParser.#readLinkIndex(view, 10)
        }))
    }

    /**
     * Decodes one fixed-size fill stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, componentIndex: number | null, layerCode: number, layerId: number }[]}
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
            componentIndex: PcbBinaryPrimitiveParser.#readComponentIndex(
                view,
                12
            ),
            netIndex: PcbBinaryPrimitiveParser.#readLinkIndex(view, 8),
            polygonIndex: PcbBinaryPrimitiveParser.#readLinkIndex(view, 10),
            layerCode: view.getUint16(46, true),
            layerId: view.getUint8(5)
        }))
    }

    /**
     * Decodes one length-prefixed arc stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, componentIndex: number | null, layerCode: number, layerId: number }[]}
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
                componentIndex: PcbBinaryPrimitiveParser.#readComponentIndex(
                    payload,
                    7
                ),
                netIndex: PcbBinaryPrimitiveParser.#readLinkIndex(payload, 3),
                polygonIndex: PcbBinaryPrimitiveParser.#readLinkIndex(
                    payload,
                    5
                ),
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
     * @returns {{ x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean, holeShape: number | null, holeSlotLength: number | null, holeRotation: number | null, hasRoundedRect: boolean, roundedRectShapeTop: number | null, cornerRadiusTop: number | null, offsetTopX: number, offsetTopY: number, componentIndex: number | null }[]}
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
     * Decodes one variable-length PCB text stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ text: string, x: number, y: number, height: number, layerId: number, ownerIndex: number | null, kind: number, visibilityFlags: number, rotation: number }[]}
     */
    static parseTextStream(headerBytes, dataBytes) {
        const count = PcbBinaryPrimitiveParser.#readRecordCount(headerBytes)
        const normalizedData = PcbBinaryPrimitiveParser.#toUint8Array(dataBytes)

        if (!count) {
            return []
        }

        let offset = 0
        const texts = []

        for (let index = 0; index < count; index += 1) {
            if (
                !PcbBinaryPrimitiveParser.#isTextRecordStart(
                    normalizedData,
                    offset
                )
            ) {
                return texts
            }

            const payloadLength = PcbBinaryPrimitiveParser.#readUint32FromBytes(
                normalizedData,
                offset + 1
            )
            const payloadOffset = offset + 5
            const payloadEnd = payloadOffset + payloadLength

            if (payloadEnd > normalizedData.byteLength) {
                return texts
            }

            const nextOffset =
                index === count - 1
                    ? normalizedData.byteLength
                    : PcbBinaryPrimitiveParser.#findNextTextRecordOffset(
                          normalizedData,
                          payloadEnd,
                          payloadLength
                      )
            const text = PcbBinaryPrimitiveParser.#parseTextRecord(
                new DataView(
                    normalizedData.buffer,
                    normalizedData.byteOffset + payloadOffset,
                    payloadLength
                ),
                normalizedData.slice(payloadEnd, nextOffset)
            )

            if (text) {
                texts.push(text)
            }

            offset = nextOffset
        }

        return texts
    }

    /**
     * Decodes one variable-length PCB region stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @param {{ shapeBased?: boolean }} [options]
     * @returns {{ layerId: number, layerCode: number, netIndex: number | null, polygonIndex: number | null, componentIndex: number | null, kind: number, isKeepout: boolean, isBoardCutout: boolean, isShapeBased: boolean, points: object[], holes: object[][], properties: Record<string, string> }[]}
     */
    static parseRegionStream(headerBytes, dataBytes, options = {}) {
        const count = PcbBinaryPrimitiveParser.#readRecordCount(headerBytes)
        const normalizedData = PcbBinaryPrimitiveParser.#toUint8Array(dataBytes)

        if (!count) {
            return []
        }

        let offset = 0
        const regions = []

        for (let index = 0; index < count; index += 1) {
            const parsedRegion = PcbBinaryPrimitiveParser.#parseRegionRecord(
                normalizedData,
                offset,
                options.shapeBased === true
            )

            if (!parsedRegion) {
                return regions
            }

            regions.push(parsedRegion.region)
            offset += parsedRegion.byteLength
        }

        return regions
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
     * @returns {{ x: number, y: number, sizeTopX: number, sizeTopY: number, sizeMidX: number, sizeMidY: number, sizeBottomX: number, sizeBottomY: number, holeDiameter: number, shapeTop: number, shapeMid: number, shapeBottom: number, rotation: number, isPlated: boolean, holeShape: number | null, holeSlotLength: number | null, holeRotation: number | null, hasRoundedRect: boolean, roundedRectShapeTop: number | null, cornerRadiusTop: number | null, offsetTopX: number, offsetTopY: number, componentIndex: number | null } | null}
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
            componentIndex: PcbBinaryPrimitiveParser.#readComponentIndex(
                mainRecord,
                7
            ),
            netIndex: PcbBinaryPrimitiveParser.#readLinkIndex(mainRecord, 3),
            polygonIndex: PcbBinaryPrimitiveParser.#readLinkIndex(
                mainRecord,
                5
            ),
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
     * Parses one variable-length PCB region record.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {boolean} shapeBased
     * @returns {{ region: { layerId: number, layerCode: number, netIndex: number | null, polygonIndex: number | null, componentIndex: number | null, kind: number, isKeepout: boolean, isBoardCutout: boolean, isShapeBased: boolean, points: object[], holes: object[][], properties: Record<string, string> }, byteLength: number } | null}
     */
    static #parseRegionRecord(bytes, offset, shapeBased) {
        if (
            offset + 5 > bytes.byteLength ||
            bytes[offset] !== PcbBinaryPrimitiveParser.#REGION_OBJECT_ID
        ) {
            return null
        }

        const payloadLength = PcbBinaryPrimitiveParser.#readUint32FromBytes(
            bytes,
            offset + 1
        )
        const payloadOffset = offset + 5
        const payloadEnd = payloadOffset + payloadLength

        if (
            payloadLength <
                PcbBinaryPrimitiveParser.#REGION_HEADER_BYTE_LENGTH ||
            payloadEnd > bytes.byteLength
        ) {
            return null
        }

        const view = new DataView(
            bytes.buffer,
            bytes.byteOffset + payloadOffset,
            payloadLength
        )
        const layerId = view.getUint8(0)
        const flags2 = view.getUint8(2)
        const holeCount = view.getUint16(14, true)
        let cursor = PcbBinaryPrimitiveParser.#REGION_HEADER_BYTE_LENGTH

        if (cursor + 4 > view.byteLength) {
            return null
        }

        const propertyByteLength = view.getUint32(cursor, true)
        cursor += 4
        if (cursor + propertyByteLength > view.byteLength) {
            return null
        }

        const properties = PcbBinaryPrimitiveParser.#parsePropertyBytes(
            new Uint8Array(
                view.buffer,
                view.byteOffset + cursor,
                propertyByteLength
            )
        )
        cursor += propertyByteLength
        if (cursor < view.byteLength && view.getUint8(cursor) === 0) {
            cursor += 1
        }

        if (cursor + 4 > view.byteLength) {
            return null
        }

        const authoredPointCount = view.getUint32(cursor, true)
        cursor += 4
        const pointCount = shapeBased
            ? authoredPointCount + 1
            : authoredPointCount
        const parsedPoints = shapeBased
            ? PcbBinaryPrimitiveParser.#readShapeRegionVertices(
                  view,
                  cursor,
                  pointCount
              )
            : PcbBinaryPrimitiveParser.#readRegionVertices(
                  view,
                  cursor,
                  pointCount
              )
        if (!parsedPoints) {
            return null
        }
        cursor = parsedPoints.offset

        const holes = []
        for (let holeIndex = 0; holeIndex < holeCount; holeIndex += 1) {
            if (cursor + 4 > view.byteLength) {
                return null
            }
            const holeVertexCount = view.getUint32(cursor, true)
            cursor += 4
            const parsedHole = PcbBinaryPrimitiveParser.#readRegionVertices(
                view,
                cursor,
                holeVertexCount
            )
            if (!parsedHole) {
                return null
            }
            holes.push(parsedHole.points)
            cursor = parsedHole.offset
        }

        return {
            region: {
                layerId,
                layerCode: layerId,
                netIndex: PcbBinaryPrimitiveParser.#readLinkIndex(view, 3),
                polygonIndex: PcbBinaryPrimitiveParser.#readLinkIndex(view, 5),
                componentIndex: PcbBinaryPrimitiveParser.#readComponentIndex(
                    view,
                    7
                ),
                kind: Number(properties.KIND || 0),
                isKeepout: flags2 === 2,
                isBoardCutout:
                    String(properties.ISBOARDCUTOUT || '').toUpperCase() ===
                    'TRUE',
                isShapeBased:
                    shapeBased ||
                    String(properties.ISSHAPEBASED || '').toUpperCase() ===
                        'TRUE',
                points: parsedPoints.points,
                holes,
                properties
            },
            byteLength: 5 + payloadLength
        }
    }

    /**
     * Reads one simple double-coordinate region vertex list.
     * @param {DataView} view
     * @param {number} offset
     * @param {number} count
     * @returns {{ points: { x: number, y: number }[], offset: number } | null}
     */
    static #readRegionVertices(view, offset, count) {
        const byteLength =
            count * PcbBinaryPrimitiveParser.#REGION_VERTEX_BYTE_LENGTH
        if (offset + byteLength > view.byteLength) {
            return null
        }

        const points = []
        let cursor = offset
        for (let index = 0; index < count; index += 1) {
            points.push({
                x: view.getFloat64(cursor, true) / 10000,
                y: view.getFloat64(cursor + 8, true) / 10000
            })
            cursor += PcbBinaryPrimitiveParser.#REGION_VERTEX_BYTE_LENGTH
        }

        return { points, offset: cursor }
    }

    /**
     * Reads one shape-based region vertex list with optional arc metadata.
     * @param {DataView} view
     * @param {number} offset
     * @param {number} count
     * @returns {{ points: object[], offset: number } | null}
     */
    static #readShapeRegionVertices(view, offset, count) {
        const byteLength =
            count * PcbBinaryPrimitiveParser.#SHAPE_REGION_VERTEX_BYTE_LENGTH
        if (offset + byteLength > view.byteLength) {
            return null
        }

        const points = []
        let cursor = offset
        for (let index = 0; index < count; index += 1) {
            const isArc = view.getUint8(cursor) !== 0
            points.push({
                x: view.getInt32(cursor + 1, true) / 10000,
                y: view.getInt32(cursor + 5, true) / 10000,
                isArc,
                centerX: view.getInt32(cursor + 9, true) / 10000,
                centerY: view.getInt32(cursor + 13, true) / 10000,
                radius: view.getInt32(cursor + 17, true) / 10000,
                startAngle: view.getFloat64(cursor + 21, true),
                endAngle: view.getFloat64(cursor + 29, true)
            })
            cursor += PcbBinaryPrimitiveParser.#SHAPE_REGION_VERTEX_BYTE_LENGTH
        }

        return { points, offset: cursor }
    }

    /**
     * Parses Altium pipe-separated property bytes.
     * @param {Uint8Array} bytes
     * @returns {Record<string, string>}
     */
    static #parsePropertyBytes(bytes) {
        const text = new TextDecoder().decode(bytes).replace(/\u0000+$/u, '')
        const properties = {}

        for (const part of text.split('|')) {
            const [key, ...valueParts] = part.split('=')
            if (!key || !valueParts.length) {
                continue
            }
            properties[key.trim()] = valueParts.join('=').trim()
        }

        return properties
    }

    /**
     * Parses one fixed PCB text payload and its variable string tail.
     * @param {DataView} payload
     * @param {Uint8Array} textBytes
     * @returns {{ text: string, x: number, y: number, height: number, layerId: number, ownerIndex: number | null, kind: number, visibilityFlags: number, rotation: number } | null}
     */
    static #parseTextRecord(payload, textBytes) {
        if (
            payload.byteLength <
            PcbBinaryPrimitiveParser.#TEXT_RECORD_MIN_BYTE_LENGTH
        ) {
            return null
        }

        const text = PcbBinaryPrimitiveParser.#decodeTextBytes(textBytes)
        if (!text) {
            return null
        }

        const ownerIndex = payload.getInt16(7, true)
        const visibilityFlags = payload.getUint32(41, true)

        return {
            text,
            layerId: payload.getUint8(0),
            ownerIndex: ownerIndex === -1 ? null : ownerIndex,
            x: PcbBinaryPrimitiveParser.#readMil(payload, 13),
            y: PcbBinaryPrimitiveParser.#readMil(payload, 17),
            height: PcbBinaryPrimitiveParser.#readMil(payload, 21),
            kind: payload.getUint32(25, true),
            visibilityFlags,
            rotation:
                PcbBinaryPrimitiveParser.#textRotationFromFlags(visibilityFlags)
        }
    }

    /**
     * Decodes the printable text payload that trails a fixed text record.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static #decodeTextBytes(bytes) {
        const start = bytes.findIndex((byte) => byte >= 0x20 && byte <= 0x7e)

        if (start < 0) {
            return ''
        }

        return new TextDecoder()
            .decode(bytes.slice(start))
            .replace(/\u0000/gu, '')
            .replace(/\r\n?/gu, '\n')
            .replace(/^[\u0000-\u001f\u007f-\u009f]+/gu, '')
            .trim()
    }

    /**
     * Finds the next length-prefixed PCB text record after one string tail.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} payloadLength
     * @returns {number}
     */
    static #findNextTextRecordOffset(bytes, offset, payloadLength) {
        for (let cursor = offset; cursor < bytes.byteLength - 5; cursor += 1) {
            if (
                PcbBinaryPrimitiveParser.#isTextRecordStart(
                    bytes,
                    cursor,
                    payloadLength
                )
            ) {
                return cursor
            }
        }

        return bytes.byteLength
    }

    /**
     * Returns true when a byte offset looks like a text record boundary.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} [expectedPayloadLength]
     * @returns {boolean}
     */
    static #isTextRecordStart(bytes, offset, expectedPayloadLength) {
        if (offset + 5 > bytes.byteLength) {
            return false
        }

        if (bytes[offset] !== PcbBinaryPrimitiveParser.#TEXT_OBJECT_ID) {
            return false
        }

        const payloadLength = PcbBinaryPrimitiveParser.#readUint32FromBytes(
            bytes,
            offset + 1
        )

        return (
            payloadLength === expectedPayloadLength ||
            (expectedPayloadLength === undefined &&
                payloadLength >=
                    PcbBinaryPrimitiveParser.#TEXT_RECORD_MIN_BYTE_LENGTH &&
                payloadLength <=
                    PcbBinaryPrimitiveParser.#TEXT_RECORD_MAX_BYTE_LENGTH)
        )
    }

    /**
     * Resolves the text rotation encoded in the visibility/options bit field.
     * @param {number} visibilityFlags
     * @returns {number}
     */
    static #textRotationFromFlags(visibilityFlags) {
        return (Number(visibilityFlags) & 0x00010000) !== 0 ? 90 : 0
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
     * Reads one little-endian unsigned integer from a byte view.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @returns {number}
     */
    static #readUint32FromBytes(bytes, offset) {
        return new DataView(
            bytes.buffer,
            bytes.byteOffset + offset,
            bytes.byteLength - offset
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

    /**
     * Reads one PCB primitive component linkage field.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static #readComponentIndex(view, offset) {
        return PcbBinaryPrimitiveParser.#readLinkIndex(view, offset)
    }

    /**
     * Reads one PCB primitive linkage field.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static #readLinkIndex(view, offset) {
        if (offset + 2 > view.byteLength) {
            return null
        }

        const value = view.getUint16(offset, true)
        return value === 0xffff ? null : value
    }
}
