// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'
import { PcbBinaryPrimitiveTestFactory } from './PcbBinaryPrimitiveTestFactory.mjs'

/**
 * Builds synthetic PCB track streams for primitive parser tests.
 */
class PcbTrackPrimitiveTestFactory {
    /**
     * Creates one legacy fixed-layout track stream without object prefixes.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createFixedTrackStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const firstRecord = PcbTrackPrimitiveTestFactory.#createTrackPayload({
            layerId: 68,
            netIndex: 17,
            polygonIndex: 23,
            componentIndex: 3,
            x1: 1000,
            y1: 2000,
            x2: 1500,
            y2: 2000,
            width: 10
        })
        const secondRecord = PcbTrackPrimitiveTestFactory.#createTrackPayload({
            layerId: 69,
            netIndex: 18,
            polygonIndex: 24,
            componentIndex: 4,
            x1: 420,
            y1: 360,
            x2: 460,
            y2: 390,
            width: 6
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
     * Creates one fixed-layout track stream with route metadata set.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createMetadataTrackStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const dataBytes = PcbTrackPrimitiveTestFactory.#createTrackPayload({
            layerId: 68,
            flags: 0x15,
            keepout: 1,
            netIndex: 17,
            polygonIndex: 23,
            componentIndex: 3,
            x1: 1000,
            y1: 2000,
            x2: 1500,
            y2: 2000,
            width: 10,
            unionIndex: 11,
            lengthTuning: true,
            userRouted: true
        })

        headerView.setUint32(0, 1, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one legacy fixed-layout track payload.
     * @param {{ layerId: number, flags?: number, keepout?: number, netIndex: number, polygonIndex: number, componentIndex: number, x1: number, y1: number, x2: number, y2: number, width: number, unionIndex?: number, lengthTuning?: boolean, userRouted?: boolean }} options
     * @returns {Uint8Array}
     */
    static #createTrackPayload(options) {
        const dataBytes = new Uint8Array(49)
        const dataView = new DataView(dataBytes.buffer)

        dataView.setUint8(0, options.layerId)
        dataView.setUint8(1, options.flags || 0)
        dataView.setUint8(2, options.keepout || 0)
        dataView.setUint16(3, options.netIndex, true)
        dataView.setUint16(5, options.polygonIndex, true)
        dataView.setUint16(7, options.componentIndex, true)
        PcbTrackPrimitiveTestFactory.#writeMil(dataView, 13, options.x1)
        PcbTrackPrimitiveTestFactory.#writeMil(dataView, 17, options.y1)
        PcbTrackPrimitiveTestFactory.#writeMil(dataView, 21, options.x2)
        PcbTrackPrimitiveTestFactory.#writeMil(dataView, 25, options.y2)
        PcbTrackPrimitiveTestFactory.#writeMil(dataView, 29, options.width)
        dataView.setUint8(36, options.unionIndex || 0)
        dataView.setUint8(37, options.lengthTuning ? 1 : 0)
        dataView.setUint8(44, options.userRouted ? 1 : 0)

        return dataBytes
    }

    /**
     * Writes one standard little-endian fixed-point mil value.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number} valueMil
     */
    static #writeMil(dataView, offset, valueMil) {
        dataView.setInt32(offset, Math.round(valueMil * 10000), true)
    }
}

/**
 * Verifies legacy fixed-layout track streams decode without object-id prefixes.
 */
test('PcbBinaryPrimitiveParser decodes fixed-payload track streams', () => {
    const { headerBytes, dataBytes } =
        PcbTrackPrimitiveTestFactory.createFixedTrackStream()

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
            },
            {
                x1: 420,
                y1: 360,
                x2: 460,
                y2: 390,
                width: 6,
                componentIndex: 4,
                netIndex: 18,
                polygonIndex: 24,
                layerCode: 69,
                layerId: 69
            }
        ]
    )
})

/**
 * Verifies object-id/length-prefixed track streams decode copper geometry.
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
 * Verifies track metadata flags survive binary primitive decoding.
 */
test('PcbBinaryPrimitiveParser decodes track flags and route metadata', () => {
    const { headerBytes, dataBytes } =
        PcbTrackPrimitiveTestFactory.createMetadataTrackStream()

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
                trackFlags: 0x15,
                isSelected: true,
                isLocked: false,
                isPartOfComponent: true,
                isKeepout: true,
                unionIndex: 11,
                isLengthTuning: true,
                isUserRouted: true,
                layerCode: 68,
                layerId: 68
            }
        ]
    )
})
