// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbPrimitiveOwnershipIndexParser } from './PcbPrimitiveOwnershipIndexParser.mjs'
import { PrintableTextDecoder } from './PrintableTextDecoder.mjs'

/**
 * Decodes Altium PCB region primitive streams.
 */
export class PcbRegionPrimitiveParser {
    static #REGION_OBJECT_ID = 11

    static #REGION_HEADER_BYTE_LENGTH = 18

    static #REGION_VERTEX_BYTE_LENGTH = 16

    static #SHAPE_REGION_VERTEX_BYTE_LENGTH = 37

    /**
     * Decodes one variable-length PCB region stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @param {{ shapeBased?: boolean }} [options]
     * @returns {{ layerId: number, layerCode: number, netIndex: number | null, polygonIndex: number | null, componentIndex: number | null, kind: number, isKeepout: boolean, isBoardCutout: boolean, isShapeBased: boolean, points: object[], holes: object[][], properties: Record<string, string> }[]}
     */
    static parseRegionStream(headerBytes, dataBytes, options = {}) {
        const count = PcbRegionPrimitiveParser.#readRecordCount(headerBytes)
        const normalizedData = PcbRegionPrimitiveParser.#toUint8Array(dataBytes)

        if (!count) {
            return []
        }

        let offset = 0
        const regions = []

        for (let index = 0; index < count; index += 1) {
            const parsedRegion = PcbRegionPrimitiveParser.#parseRegionRecord(
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
     * Parses one variable-length PCB region record.
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {boolean} shapeBased
     * @returns {{ region: { layerId: number, layerCode: number, netIndex: number | null, polygonIndex: number | null, componentIndex: number | null, kind: number, isKeepout: boolean, isBoardCutout: boolean, isShapeBased: boolean, points: object[], holes: object[][], properties: Record<string, string> }, byteLength: number } | null}
     */
    static #parseRegionRecord(bytes, offset, shapeBased) {
        if (
            offset + 5 > bytes.byteLength ||
            bytes[offset] !== PcbRegionPrimitiveParser.#REGION_OBJECT_ID
        ) {
            return null
        }

        const payloadLength = PcbRegionPrimitiveParser.#readUint32FromBytes(
            bytes,
            offset + 1
        )
        const payloadOffset = offset + 5
        const payloadEnd = payloadOffset + payloadLength

        if (
            payloadLength <
                PcbRegionPrimitiveParser.#REGION_HEADER_BYTE_LENGTH ||
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
        let cursor = PcbRegionPrimitiveParser.#REGION_HEADER_BYTE_LENGTH

        if (cursor + 4 > view.byteLength) {
            return null
        }

        const propertyByteLength = view.getUint32(cursor, true)
        cursor += 4
        if (cursor + propertyByteLength > view.byteLength) {
            return null
        }

        const properties = PcbRegionPrimitiveParser.#parsePropertyBytes(
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
            ? PcbRegionPrimitiveParser.#readShapeRegionVertices(
                  view,
                  cursor,
                  pointCount
              )
            : PcbRegionPrimitiveParser.#readRegionVertices(
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
            const parsedHole = PcbRegionPrimitiveParser.#readRegionVertices(
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

        const ownershipIndexes =
            PcbPrimitiveOwnershipIndexParser.readOwnershipIndexes(view, {
                component: 7,
                net: 3,
                polygon: 5
            })
        const kind = PcbRegionPrimitiveParser.#numericKind(properties.KIND)
        const legacyCutout =
            PcbRegionPrimitiveParser.#legacyCutoutClassification(
                properties,
                kind
            )

        return {
            region: {
                layerId,
                layerCode: layerId,
                ...ownershipIndexes,
                kind,
                ...legacyCutout.fields,
                isKeepout: flags2 === 2,
                isBoardCutout:
                    legacyCutout.isBoardCutout ||
                    String(properties.ISBOARDCUTOUT || '').toUpperCase() ===
                        'TRUE',
                ...legacyCutout.cutoutFlags,
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
     * Parses a region kind while avoiding NaN for legacy symbolic labels.
     * @param {string | undefined} rawKind Raw KIND value.
     * @returns {number | null}
     */
    static #numericKind(rawKind) {
        if (rawKind === undefined || rawKind === null || rawKind === '') {
            return 0
        }

        const kind = Number(rawKind)
        return Number.isFinite(kind) ? kind : null
    }

    /**
     * Builds cutout fields from legacy string KIND labels.
     * @param {Record<string, string>} properties Native property map.
     * @param {number | null} numericKind Parsed numeric kind.
     * @returns {{ isBoardCutout: boolean, fields: object, cutoutFlags: object }}
     */
    static #legacyCutoutClassification(properties, numericKind) {
        const rawKind = String(properties.KIND || '').trim()
        if (numericKind !== null || !rawKind) {
            return {
                isBoardCutout: false,
                fields: {},
                cutoutFlags: {}
            }
        }

        const normalized = rawKind.replace(/[^a-z0-9]/giu, '').toLowerCase()
        const isBoardCutout = normalized === 'boardcutout'
        const isPolygonPourCutout =
            normalized === 'polygonpourcutout' ||
            normalized === 'polygoncutout' ||
            normalized === 'pourcutout'
        const classification =
            isBoardCutout || isPolygonPourCutout
                ? {
                      isBoardCutout,
                      isPolygonPourCutout,
                      source: 'legacy-kind',
                      rawKind
                  }
                : null

        return {
            isBoardCutout,
            fields: {
                rawKind
            },
            cutoutFlags: classification
                ? {
                      isPolygonPourCutout,
                      cutoutClassification: classification
                  }
                : {}
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
            count * PcbRegionPrimitiveParser.#REGION_VERTEX_BYTE_LENGTH
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
            cursor += PcbRegionPrimitiveParser.#REGION_VERTEX_BYTE_LENGTH
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
            count * PcbRegionPrimitiveParser.#SHAPE_REGION_VERTEX_BYTE_LENGTH
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
            cursor += PcbRegionPrimitiveParser.#SHAPE_REGION_VERTEX_BYTE_LENGTH
        }

        return { points, offset: cursor }
    }

    /**
     * Parses Altium pipe-separated property bytes.
     * @param {Uint8Array} bytes
     * @returns {Record<string, string>}
     */
    static #parsePropertyBytes(bytes) {
        const text = PrintableTextDecoder.decodeBytes(bytes).replace(
            /\u0000+$/u,
            ''
        )
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
            PcbRegionPrimitiveParser.#toUint8Array(headerBytes)

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
     * Reads one little-endian unsigned integer from a byte view.
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
}
