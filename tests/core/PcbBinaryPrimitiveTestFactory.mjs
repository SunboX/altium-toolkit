// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds synthetic PCB binary streams for primitive parser tests.
 */
export class PcbBinaryPrimitiveTestFactory {
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
        dataView.setUint8(6, 0xe3)
        dataView.setUint8(7, 0x03)
        dataView.setUint16(8, 18, true)
        dataView.setUint16(10, 24, true)
        dataView.setUint16(12, 4, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 18, 11235.2291)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 22, 9079.5466)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 26, 23.622)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 30, 11.811)
        dataView.setUint8(34, 1)
        dataView.setUint8(35, 32)
        dataView.setUint8(36, 2)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 37, 7)
        dataView.setUint16(41, 6, true)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 43, 5)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 47, 9)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 51, 11)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 55, 1.5)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 59, 2.5)
        dataView.setUint8(64, 1)
        dataView.setUint8(71, 2)
        dataView.setUint8(79, 1)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 80, 24)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 84, 26)
        dataView.setUint8(214, 1)
        dataView.setUint8(216, 1)
        dataView.setUint8(246, 1)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 247, 4.5)
        dataView.setUint8(259, 42)
        dataView.setUint8(263, 1)
        for (let index = 0; index < 16; index += 1) {
            dataView.setUint8(264 + index, index + 1)
            dataView.setUint8(280 + index, 0xa0 + index)
        }
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 296, 0.8)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(dataView, 300, -0.6)
        dataView.setUint8(317, 7)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates a length-prefixed via stream where the first via carries an
     * external stack entry that shifts the tail fields.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createVariableLengthViaStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const firstRecord = PcbBinaryPrimitiveTestFactory.#createViaRecord(330)
        const secondRecord = PcbBinaryPrimitiveTestFactory.#createViaRecord(321)
        const firstView = new DataView(firstRecord.buffer)
        const dataBytes = new Uint8Array(
            firstRecord.byteLength + secondRecord.byteLength
        )

        headerView.setUint32(0, 2, true)
        firstView.setUint32(251, 1, true)
        firstView.setUint32(255, 9, true)
        firstView.setUint32(259, 32, true)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(firstView, 263, 28)
        firstView.setUint8(267, 5)
        firstView.setUint32(268, 42, true)
        firstView.setUint8(272, 1)
        for (let index = 0; index < 16; index += 1) {
            firstView.setUint8(273 + index, 0x10 + index)
            firstView.setUint8(289 + index, 0xb0 + index)
        }
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(firstView, 305, 1.2)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(firstView, 309, -0.4)
        firstView.setUint8(326, 8)

        dataBytes.set(firstRecord, 0)
        dataBytes.set(secondRecord, firstRecord.byteLength)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates a compact length-prefixed via stream without optional tail data.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createCompactViaStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const firstRecord = PcbBinaryPrimitiveTestFactory.#createViaRecord(209)
        const secondRecord = PcbBinaryPrimitiveTestFactory.#createViaRecord(209)
        const secondView = new DataView(secondRecord.buffer)
        const dataBytes = new Uint8Array(
            firstRecord.byteLength + secondRecord.byteLength
        )

        headerView.setUint32(0, 2, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(secondView, 18, 11300)
        dataBytes.set(firstRecord, 0)
        dataBytes.set(secondRecord, firstRecord.byteLength)

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

        headerView.setUint32(0, 1, true)

        return {
            headerBytes,
            dataBytes:
                PcbBinaryPrimitiveTestFactory.#createLengthPrefixedRecord(2, [
                    new Uint8Array(0),
                    new Uint8Array(0),
                    new Uint8Array(0),
                    new Uint8Array(0),
                    PcbBinaryPrimitiveTestFactory.#createBasicPadPayload({
                        x: 9869.0874,
                        y: 7795.586,
                        componentIndex: 7,
                        netIndex: 21
                    }),
                    new Uint8Array(0)
                ])
        }
    }

    /**
     * Creates a one-pad stream pair with non-round top/middle/bottom shapes.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createPadShapeVariantStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)

        headerView.setUint32(0, 1, true)

        return {
            headerBytes,
            dataBytes:
                PcbBinaryPrimitiveTestFactory.#createLengthPrefixedRecord(2, [
                    new Uint8Array(0),
                    new Uint8Array(0),
                    new Uint8Array(0),
                    new Uint8Array(0),
                    PcbBinaryPrimitiveTestFactory.#createBasicPadPayload({
                        x: 160,
                        y: 240,
                        componentIndex: 3,
                        netIndex: 11,
                        shapeTop: 2,
                        shapeMid: 3,
                        shapeBottom: 9
                    }),
                    new Uint8Array(0)
                ])
        }
    }

    /**
     * Creates a two-pad stream where the first pad carries an unknown optional
     * subrecord after the known extension subrecord.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createPadStreamWithUnknownSubrecord() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const firstPad =
            PcbBinaryPrimitiveTestFactory.#createLengthPrefixedRecord(2, [
                new Uint8Array(0),
                new Uint8Array(0),
                new Uint8Array(0),
                new Uint8Array(0),
                PcbBinaryPrimitiveTestFactory.#createBasicPadPayload({
                    x: 9869.0874,
                    y: 7795.586,
                    componentIndex: 7,
                    netIndex: 21
                }),
                new Uint8Array(0),
                new Uint8Array([0xde, 0xad, 0xbe, 0xef])
            ])
        const secondPad =
            PcbBinaryPrimitiveTestFactory.#createLengthPrefixedRecord(2, [
                new Uint8Array(0),
                new Uint8Array(0),
                new Uint8Array(0),
                new Uint8Array(0),
                PcbBinaryPrimitiveTestFactory.#createBasicPadPayload({
                    x: 420,
                    y: 360,
                    componentIndex: 9,
                    netIndex: 33
                }),
                new Uint8Array(0)
            ])
        const dataBytes = new Uint8Array(
            firstPad.byteLength + secondPad.byteLength
        )

        headerView.setUint32(0, 2, true)
        dataBytes.set(firstPad, 0)
        dataBytes.set(secondPad, firstPad.byteLength)

        return { headerBytes, dataBytes }
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
        const extensionPayload = new Uint8Array(651)
        const extensionView = new DataView(extensionPayload.buffer)

        headerView.setUint32(0, 1, true)
        mainView.setUint8(0, 1)
        mainView.setUint16(1, 0x03f8, true)
        mainView.setUint16(3, 22, true)
        mainView.setUint16(5, 0xffff, true)
        mainView.setUint16(7, 8, true)
        mainView.setUint32(9, 123456, true)
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
        mainView.setUint8(62, 2)
        mainView.setUint8(67, 2)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(mainView, 68, 12)
        mainView.setUint16(72, 4, true)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(mainView, 74, 14)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(mainView, 78, 16)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(mainView, 82, 18)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(mainView, 86, -2.5)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(mainView, 90, 3.5)
        mainView.setUint8(96, 1)
        mainView.setUint8(97, 2)
        mainView.setUint8(98, 3)
        mainView.setUint8(99, 4)
        mainView.setUint8(100, 5)
        mainView.setUint8(101, 1)
        mainView.setUint8(102, 2)
        mainView.setUint8(103, 1)
        mainView.setUint8(104, 1)
        mainView.setUint32(114, 0x0100ffff, true)

        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 0, 40)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 4, 42)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 116, 45)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 120, 47)
        extensionView.setUint8(232, 2)
        extensionView.setUint8(262, 2)
        PcbBinaryPrimitiveTestFactory.#writeMil(extensionView, 263, 98.4252)
        extensionView.setFloat64(267, 0, true)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 275, 4)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 279, -6)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 403, 8)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 407, -10)
        extensionView.setUint8(531, 0)
        extensionView.setUint8(532, 9)
        extensionView.setUint8(533, 2)
        extensionView.setUint8(564, 35)
        extensionView.setUint8(565, 12)
        extensionView.setUint32(628, 1, true)
        extensionView.setUint32(632, 15, true)
        extensionView.setInt16(636, 37, true)
        extensionView.setUint16(638, 3, true)
        extensionView.setUint8(640, 1)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 641, 80)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(extensionView, 645, 25)
        extensionView.setUint16(649, 20, true)

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
     * Creates a one-pad stream with a top-side SMD testpoint whose manual
     * paste expansion closes the paste aperture.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createMaskOnlySmdPadStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const mainPayload = new Uint8Array(105)
        const mainView = new DataView(mainPayload.buffer)

        headerView.setUint32(0, 1, true)
        mainView.setUint8(0, 1)
        mainView.setUint16(1, 0x0080, true)
        mainView.setUint16(3, 44, true)
        mainView.setUint16(5, 0xffff, true)
        mainView.setUint16(7, 12, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 13, 1200)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 17, 1800)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 21, 12)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 25, 12)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 29, 12)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 33, 12)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 37, 12)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 41, 12)
        PcbBinaryPrimitiveTestFactory.#writeMil(mainView, 45, 0)
        mainView.setUint8(49, 1)
        mainView.setUint8(50, 1)
        mainView.setUint8(51, 1)
        mainView.setFloat64(52, 0, true)
        mainView.setUint8(60, 0)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(mainView, 86, -6.1)
        PcbBinaryPrimitiveTestFactory.#writeSignedMil(mainView, 90, 4)
        mainView.setUint8(101, 2)
        mainView.setUint8(102, 2)
        mainView.setUint8(103, 1)
        mainView.setUint8(104, 1)

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
     * Writes one standard little-endian signed fixed-point mil value.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number} valueMil
     */
    static #writeSignedMil(dataView, offset, valueMil) {
        dataView.setInt32(offset, Math.round(valueMil * 10000), true)
    }

    /**
     * Creates one basic plated through-hole pad main subrecord.
     * @param {{ x: number, y: number, componentIndex: number, netIndex: number, shapeTop?: number, shapeMid?: number, shapeBottom?: number }} options
     * @returns {Uint8Array}
     */
    static #createBasicPadPayload(options) {
        const mainPayload = new Uint8Array(64)
        const payloadView = new DataView(mainPayload.buffer)

        payloadView.setUint8(0, 74)
        payloadView.setUint16(3, options.netIndex, true)
        payloadView.setUint16(5, 0xffff, true)
        payloadView.setUint16(7, options.componentIndex, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 13, options.x)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 17, options.y)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 21, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 25, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 29, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 33, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 37, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 41, 244.0945)
        PcbBinaryPrimitiveTestFactory.#writeMil(payloadView, 45, 137.7953)
        payloadView.setUint8(49, options.shapeTop ?? 1)
        payloadView.setUint8(50, options.shapeMid ?? 1)
        payloadView.setUint8(51, options.shapeBottom ?? 1)
        payloadView.setFloat64(52, 0, true)
        payloadView.setUint8(60, 1)

        return mainPayload
    }

    /**
     * Encodes one length-prefixed via record.
     * @param {number} payloadLength
     * @returns {Uint8Array}
     */
    static #createViaRecord(payloadLength) {
        const dataBytes = new Uint8Array(5 + payloadLength)
        const dataView = new DataView(dataBytes.buffer)

        dataView.setUint8(0, 3)
        dataView.setUint32(1, payloadLength, true)
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

        return dataBytes
    }

    /**
     * Encodes one object-id/length-prefixed binary primitive record.
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
