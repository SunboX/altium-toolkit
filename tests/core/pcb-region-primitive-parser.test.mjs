// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'
import { PcbRegionPrimitiveParser } from '../../src/core/altium/PcbRegionPrimitiveParser.mjs'
import { PcbBinaryPrimitiveTestFactory } from './PcbBinaryPrimitiveTestFactory.mjs'

/**
 * Creates synthetic binary region primitive streams.
 */
class PcbRegionPrimitiveTestFactory {
    /**
     * Creates a variable-length region stream with mixed property boundaries.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createMixedBoundaryRegionStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const firstRecord = PcbRegionPrimitiveTestFactory.#createRegionRecord({
            layerId: 37,
            flags2: 2,
            netIndex: 31,
            polygonIndex: 41,
            componentIndex: 9,
            holeCount: 1,
            properties: {
                KIND: '7',
                ISBOARDCUTOUT: 'TRUE',
                ISSHAPEBASED: 'FALSE'
            },
            addPropertyTerminator: true,
            points: [
                [100, 200],
                [300, 200],
                [300, 400],
                [100, 400]
            ],
            holes: [
                [
                    [140, 240],
                    [180, 240],
                    [180, 280],
                    [140, 280]
                ]
            ]
        })
        const secondRecord = PcbRegionPrimitiveTestFactory.#createRegionRecord({
            layerId: 38,
            flags2: 0,
            netIndex: null,
            polygonIndex: 42,
            componentIndex: null,
            holeCount: 0,
            properties: {
                KIND: '3',
                ISSHAPEBASED: 'FALSE'
            },
            addPropertyTerminator: false,
            points: [
                [10, 20],
                [30, 20],
                [30, 40]
            ],
            holes: []
        })
        const dataBytes = new Uint8Array(
            firstRecord.byteLength + secondRecord.byteLength
        )

        headerView.setUint32(0, 2, true)
        dataBytes.set(firstRecord, 0)
        dataBytes.set(secondRecord, firstRecord.byteLength)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one object-id/length-prefixed region record.
     * @param {{ layerId: number, flags2: number, netIndex: number | null, polygonIndex: number | null, componentIndex: number | null, holeCount: number, properties: Record<string, string>, addPropertyTerminator: boolean, points: number[][], holes: number[][][] }} options
     * @returns {Uint8Array}
     */
    static #createRegionRecord(options) {
        const propertyBytes = new TextEncoder().encode(
            Object.entries(options.properties)
                .map(([key, value]) => `${key}=${value}`)
                .join('|')
        )
        const propertyTerminatorLength = options.addPropertyTerminator ? 1 : 0
        const contentLength =
            18 +
            4 +
            propertyBytes.byteLength +
            propertyTerminatorLength +
            4 +
            options.points.length * 16 +
            options.holes.reduce(
                (total, hole) => total + 4 + hole.length * 16,
                0
            )
        const dataBytes = new Uint8Array(5 + contentLength)
        const dataView = new DataView(dataBytes.buffer)
        let offset = 0

        dataView.setUint8(offset, 11)
        offset += 1
        dataView.setUint32(offset, contentLength, true)
        offset += 4
        dataView.setUint8(offset, options.layerId)
        offset += 1
        offset += 1
        dataView.setUint8(offset, options.flags2)
        offset += 1
        PcbRegionPrimitiveTestFactory.#writeNullableLink(
            dataView,
            offset,
            options.netIndex
        )
        offset += 2
        PcbRegionPrimitiveTestFactory.#writeNullableLink(
            dataView,
            offset,
            options.polygonIndex
        )
        offset += 2
        PcbRegionPrimitiveTestFactory.#writeNullableLink(
            dataView,
            offset,
            options.componentIndex
        )
        offset += 2
        offset += 5
        dataView.setUint16(offset, options.holeCount, true)
        offset += 2
        offset += 2
        dataView.setUint32(offset, propertyBytes.byteLength, true)
        offset += 4
        dataBytes.set(propertyBytes, offset)
        offset += propertyBytes.byteLength
        if (options.addPropertyTerminator) {
            dataView.setUint8(offset, 0)
            offset += 1
        }
        offset = PcbRegionPrimitiveTestFactory.#writeRegionVertices(
            dataView,
            offset,
            options.points
        )
        for (const hole of options.holes) {
            offset = PcbRegionPrimitiveTestFactory.#writeRegionVertices(
                dataView,
                offset,
                hole
            )
        }

        return dataBytes
    }

    /**
     * Writes one nullable two-byte link index.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number | null} value
     */
    static #writeNullableLink(dataView, offset, value) {
        dataView.setUint16(offset, value === null ? 0xffff : value, true)
    }

    /**
     * Writes one length-prefixed list of double-coordinate region vertices.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number[][]} vertices
     * @returns {number}
     */
    static #writeRegionVertices(dataView, offset, vertices) {
        dataView.setUint32(offset, vertices.length, true)
        offset += 4

        for (const [x, y] of vertices) {
            dataView.setFloat64(offset, x * 10000, true)
            offset += 8
            dataView.setFloat64(offset, y * 10000, true)
            offset += 8
        }

        return offset
    }
}

/**
 * Verifies variable-length region records preserve record boundaries when the
 * property block may or may not include a null terminator before vertices.
 */
test('PcbRegionPrimitiveParser decodes mixed-boundary region streams', () => {
    const { headerBytes, dataBytes } =
        PcbRegionPrimitiveTestFactory.createMixedBoundaryRegionStream()

    assert.deepEqual(
        PcbRegionPrimitiveParser.parseRegionStream(headerBytes, dataBytes),
        [
            {
                layerId: 37,
                layerCode: 37,
                netIndex: 31,
                polygonIndex: 41,
                componentIndex: 9,
                kind: 7,
                isKeepout: true,
                isBoardCutout: true,
                isShapeBased: false,
                points: [
                    { x: 100, y: 200 },
                    { x: 300, y: 200 },
                    { x: 300, y: 400 },
                    { x: 100, y: 400 }
                ],
                holes: [
                    [
                        { x: 140, y: 240 },
                        { x: 180, y: 240 },
                        { x: 180, y: 280 },
                        { x: 140, y: 280 }
                    ]
                ],
                properties: {
                    KIND: '7',
                    ISBOARDCUTOUT: 'TRUE',
                    ISSHAPEBASED: 'FALSE'
                }
            },
            {
                layerId: 38,
                layerCode: 38,
                netIndex: null,
                polygonIndex: 42,
                componentIndex: null,
                kind: 3,
                isKeepout: false,
                isBoardCutout: false,
                isShapeBased: false,
                points: [
                    { x: 10, y: 20 },
                    { x: 30, y: 20 },
                    { x: 30, y: 40 }
                ],
                holes: [],
                properties: {
                    KIND: '3',
                    ISSHAPEBASED: 'FALSE'
                }
            }
        ]
    )
})

/**
 * Verifies the aggregate binary primitive parser keeps region contour geometry
 * and native ownership links intact.
 */
test('PcbBinaryPrimitiveParser decodes region streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createRegionStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseRegionStream(headerBytes, dataBytes),
        [
            {
                layerId: 37,
                layerCode: 37,
                netIndex: 31,
                polygonIndex: 41,
                componentIndex: 9,
                kind: 0,
                isKeepout: false,
                isBoardCutout: false,
                isShapeBased: false,
                points: [
                    { x: 100, y: 200 },
                    { x: 300, y: 200 },
                    { x: 300, y: 400 },
                    { x: 100, y: 400 }
                ],
                holes: [
                    [
                        { x: 140, y: 240 },
                        { x: 180, y: 240 },
                        { x: 180, y: 280 },
                        { x: 140, y: 280 }
                    ]
                ],
                properties: {
                    KIND: '0',
                    ISBOARDCUTOUT: 'FALSE',
                    ISSHAPEBASED: 'FALSE'
                }
            }
        ]
    )
})
