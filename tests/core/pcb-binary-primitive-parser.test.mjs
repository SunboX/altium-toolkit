// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'

/**
 * Builds synthetic PCB binary streams for primitive parser tests.
 */
class PcbBinaryPrimitiveTestFactory {
    /**
     * Creates a one-track stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createTrackStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(54)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)
        const payloadOffset = 5

        headerView.setUint32(0, 1, true)
        dataView.setUint8(0, 4)
        dataView.setUint32(1, 49, true)
        dataView.setUint8(payloadOffset, 68)
        dataView.setUint16(payloadOffset + 3, 17, true)
        dataView.setUint16(payloadOffset + 5, 23, true)
        dataView.setUint16(payloadOffset + 7, 3, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 13,
            1000
        )
        PcbBinaryPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 17,
            2000
        )
        PcbBinaryPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 21,
            1500
        )
        PcbBinaryPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 25,
            2000
        )
        PcbBinaryPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 29,
            10
        )

        return { headerBytes, dataBytes }
    }

    /**
     * Creates a one-via stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createViaStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(326)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        dataView.setUint8(5, 74)
        dataView.setUint16(8, 18, true)
        dataView.setUint16(10, 24, true)
        dataView.setUint16(12, 4, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 18, 11235.2291)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 22, 9079.5466)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 26, 23.622)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 30, 11.811)
        dataView.setUint8(34, 1)
        dataView.setUint8(35, 32)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates a one-fill stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createFillStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(55)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        dataView.setUint16(8, 19, true)
        dataView.setUint16(10, 25, true)
        dataView.setUint16(12, 5, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 18, 11039.3046)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 22, 8902.9081)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 26, 11049.1471)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 30, 8916.6876)
        dataBytes[5] = 33
        dataView.setUint16(46, 256, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates a one-arc stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createArcStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(65)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)
        const payloadOffset = 5

        headerView.setUint32(0, 1, true)
        dataView.setUint8(0, 1)
        dataView.setUint32(1, 60, true)
        dataView.setUint8(payloadOffset, 33)
        dataView.setUint16(payloadOffset + 3, 20, true)
        dataView.setUint16(payloadOffset + 5, 26, true)
        dataView.setUint16(payloadOffset + 7, 6, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 13,
            420
        )
        PcbBinaryPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 17,
            360
        )
        PcbBinaryPrimitiveTestFactory.#writeMil(
            dataView,
            payloadOffset + 21,
            48
        )
        dataView.setFloat64(payloadOffset + 25, 90, true)
        dataView.setFloat64(payloadOffset + 33, 180, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, payloadOffset + 41, 6)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates a one-pad stream pair with one plated mounting-hole pad.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createPadStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const mainPayload = new Uint8Array(64)
        const payloadView = new DataView(mainPayload.buffer)

        headerView.setUint32(0, 1, true)
        payloadView.setUint8(0, 74)
        payloadView.setUint16(3, 21, true)
        payloadView.setUint16(5, 0xffff, true)
        payloadView.setUint16(7, 7, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 13, 9869.0874)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 17, 7795.586)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 21, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 25, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 29, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 33, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 37, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 41, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 45, 137.7953)
        payloadView.setUint8(49, 1)
        payloadView.setUint8(50, 1)
        payloadView.setUint8(51, 1)
        payloadView.setFloat64(52, 0, true)
        payloadView.setUint8(60, 1)

        return {
            headerBytes,
            dataBytes:
                PcbBinaryPrimitiveTestFactory.#createLengthPrefixedRecord(2, [
                    new Uint8Array(0),
                    new Uint8Array(0),
                    new Uint8Array(0),
                    new Uint8Array(0),
                    mainPayload,
                    new Uint8Array(0)
                ])
        }
    }

    /**
     * Creates a one-pad stream pair with one slotted oblong plated pad that
     * uses the optional extension block.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createExtendedPadStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const mainPayload = new Uint8Array(185)
        const mainView = new DataView(mainPayload.buffer)
        const extensionPayload = new Uint8Array(596)
        const extensionView = new DataView(extensionPayload.buffer)

        headerView.setUint32(0, 1, true)
        mainView.setUint8(0, 1)
        mainView.setUint16(3, 22, true)
        mainView.setUint16(5, 0xffff, true)
        mainView.setUint16(7, 8, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 13, 10199.796)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 17, 7756.2159)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 21, 125.9843)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 25, 66.9291)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 29, 125.9843)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 33, 66.9291)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 37, 125.9843)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 41, 66.9291)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 45, 39.3701)
        mainView.setUint8(49, 1)
        mainView.setUint8(50, 1)
        mainView.setUint8(51, 1)
        mainView.setFloat64(52, 270, true)
        mainView.setUint8(60, 1)
        mainView.setUint32(114, 0x0100ffff, true)

        extensionView.setUint8(262, 2)
        PcbBinaryPrimitiveTestFactory.#writeMil(extensionView, 263, 98.4252)
        extensionView.setFloat64(267, 0, true)
        extensionView.setUint8(531, 0)
        extensionView.setUint8(532, 1)
        extensionView.setUint8(564, 0)

        return {
            headerBytes,
            dataBytes:
                PcbBinaryPrimitiveTestFactory.#createLengthPrefixedRecord(2, [
                    new Uint8Array(0),
                    new Uint8Array(0),
                    new Uint8Array(0),
                    new Uint8Array(0),
                    mainPayload,
                    extensionPayload
                ])
        }
    }

    /**
     * Creates a one-region stream pair with one rectangular cutout hole.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createRegionStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const properties = new TextEncoder().encode(
            'KIND=0|ISBOARDCUTOUT=FALSE|ISSHAPEBASED=FALSE'
        )
        const contentLength =
            18 + 4 + properties.byteLength + 4 + 4 * 16 + 4 + 4 * 16
        const dataBytes = new Uint8Array(5 + contentLength)
        const dataView = new DataView(dataBytes.buffer)
        let offset = 0

        headerView.setUint32(0, 1, true)
        dataView.setUint8(offset, 11)
        offset += 1
        dataView.setUint32(offset, contentLength, true)
        offset += 4
        dataView.setUint8(offset, 37)
        offset += 1
        dataView.setUint8(offset, 4)
        offset += 1
        dataView.setUint8(offset, 0)
        offset += 1
        dataView.setUint16(offset, 31, true)
        offset += 2
        dataView.setUint16(offset, 41, true)
        offset += 2
        dataView.setUint16(offset, 9, true)
        offset += 2
        offset += 5
        dataView.setUint16(offset, 1, true)
        offset += 2
        offset += 2
        dataView.setUint32(offset, properties.byteLength, true)
        offset += 4
        dataBytes.set(properties, offset)
        offset += properties.byteLength
        offset = PcbBinaryPrimitiveTestFactory.#writeRegionVertices(
            dataView,
            offset,
            [
                [100, 200],
                [300, 200],
                [300, 400],
                [100, 400]
            ]
        )
        offset = PcbBinaryPrimitiveTestFactory.#writeRegionVertices(
            dataView,
            offset,
            [
                [140, 240],
                [180, 240],
                [180, 280],
                [140, 280]
            ]
        )

        return { headerBytes, dataBytes }
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

    /**
     * Writes one standard little-endian fixed-point mil value.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number} valueMil
     */
    static #writeMil(dataView, offset, valueMil) {
        dataView.setUint32(offset, Math.round(valueMil * 10000), true)
    }

    /**
     * Encodes one variable-length binary primitive record.
     * @param {number} objectId
     * @param {Uint8Array[]} subrecords
     * @returns {Uint8Array}
     */
    static #createLengthPrefixedRecord(objectId, subrecords) {
        const totalLength =
            1 +
            subrecords.reduce(
                (sum, subrecord) => sum + 4 + subrecord.byteLength,
                0
            )
        const dataBytes = new Uint8Array(totalLength)
        const dataView = new DataView(dataBytes.buffer)
        let offset = 0

        dataView.setUint8(offset, objectId)
        offset += 1

        for (const subrecord of subrecords) {
            dataView.setUint32(offset, subrecord.byteLength, true)
            offset += 4
            dataBytes.set(subrecord, offset)
            offset += subrecord.byteLength
        }

        return dataBytes
    }
}

/**
 * Verifies fixed-size binary track records decode copper geometry.
 */
test('PcbBinaryPrimitiveParser decodes track streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createTrackStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseTrackStream(headerBytes, dataBytes),
        [
            {
                x1: 1000,
                y1: 2000,
                x2: 1500,
                y2: 2000,
                width: 10,
                componentIndex: 3,
                netIndex: 17,
                polygonIndex: 23,
                layerCode: 68,
                layerId: 68
            }
        ]
    )
})

/**
 * Verifies binary via records decode plated-hole geometry.
 */
test('PcbBinaryPrimitiveParser decodes via streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createViaStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseViaStream(headerBytes, dataBytes),
        [
            {
                x: 11235.2291,
                y: 9079.5466,
                diameter: 23.622,
                holeDiameter: 11.811,
                componentIndex: 4,
                netIndex: 18,
                polygonIndex: 24,
                layerCode: 74,
                layerId: 74,
                layerStartId: 1,
                layerEndId: 32
            }
        ]
    )
})

/**
 * Verifies binary fill records decode rectangular copper fills.
 */
test('PcbBinaryPrimitiveParser decodes fill streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createFillStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseFillStream(headerBytes, dataBytes),
        [
            {
                x1: 11039.3046,
                y1: 8902.9081,
                x2: 11049.1471,
                y2: 8916.6876,
                componentIndex: 5,
                netIndex: 19,
                polygonIndex: 25,
                layerCode: 256,
                layerId: 33
            }
        ]
    )
})

/**
 * Verifies fixed-size binary arc records decode authored circular geometry.
 */
test('PcbBinaryPrimitiveParser decodes arc streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createArcStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseArcStream(headerBytes, dataBytes),
        [
            {
                x: 420,
                y: 360,
                radius: 48,
                startAngle: 90,
                endAngle: 180,
                width: 6,
                componentIndex: 6,
                netIndex: 20,
                polygonIndex: 26,
                layerCode: 33,
                layerId: 33
            }
        ]
    )
})

/**
 * Verifies variable-length binary pad records decode plated-hole geometry.
 */
test('PcbBinaryPrimitiveParser decodes pad streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createPadStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parsePadStream(headerBytes, dataBytes),
        [
            {
                x: 9869.0874,
                y: 7795.586,
                sizeTopX: 244.0945,
                sizeTopY: 244.0945,
                sizeMidX: 244.0945,
                sizeMidY: 244.0945,
                sizeBottomX: 244.0945,
                sizeBottomY: 244.0945,
                holeDiameter: 137.7953,
                shapeTop: 1,
                shapeMid: 1,
                shapeBottom: 1,
                rotation: 0,
                isPlated: true,
                holeShape: null,
                holeSlotLength: null,
                holeRotation: null,
                hasRoundedRect: false,
                roundedRectShapeTop: null,
                cornerRadiusTop: null,
                offsetTopX: 0,
                offsetTopY: 0,
                componentIndex: 7,
                netIndex: 21,
                polygonIndex: null,
                layerCode: 74,
                layerId: 74,
                legacyLayerId: 74,
                layerV7SaveId: null
            }
        ]
    )
})

/**
 * Verifies extended pad records decode slot-hole geometry instead of dropping
 * the optional extension block.
 */
test('PcbBinaryPrimitiveParser decodes extended pad streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createExtendedPadStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parsePadStream(headerBytes, dataBytes),
        [
            {
                x: 10199.796,
                y: 7756.2159,
                sizeTopX: 125.9843,
                sizeTopY: 66.9291,
                sizeMidX: 125.9843,
                sizeMidY: 66.9291,
                sizeBottomX: 125.9843,
                sizeBottomY: 66.9291,
                holeDiameter: 39.3701,
                shapeTop: 1,
                shapeMid: 1,
                shapeBottom: 1,
                rotation: 270,
                isPlated: true,
                holeShape: 2,
                holeSlotLength: 98.4252,
                holeRotation: 0,
                hasRoundedRect: false,
                roundedRectShapeTop: 1,
                cornerRadiusTop: 0,
                offsetTopX: 0,
                offsetTopY: 0,
                componentIndex: 8,
                netIndex: 22,
                polygonIndex: null,
                layerCode: 32,
                layerId: 32,
                legacyLayerId: 1,
                layerV7SaveId: 0x0100ffff
            }
        ]
    )
})

/**
 * Verifies region records decode Altium contour geometry and native ownership
 * links without component-specific inference.
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
