// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'
import { PcbBinaryPrimitiveTestFactory } from './PcbBinaryPrimitiveTestFactory.mjs'

/**
 * Builds synthetic PCB arc streams for primitive parser tests.
 */
class PcbArcPrimitiveTestFactory {
    /**
     * Creates one legacy fixed-layout arc stream without object prefixes.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createFixedArcStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const firstRecord = PcbArcPrimitiveTestFactory.#createArcPayload({
            layerId: 33,
            netIndex: 20,
            polygonIndex: 26,
            componentIndex: 6,
            x: 420,
            y: 360,
            radius: 48,
            startAngle: 90,
            endAngle: 180,
            width: 6
        })
        const secondRecord = PcbArcPrimitiveTestFactory.#createArcPayload({
            layerId: 34,
            netIndex: 21,
            polygonIndex: 27,
            componentIndex: 7,
            x: 1000,
            y: 2000,
            radius: 125,
            startAngle: 270,
            endAngle: 315,
            width: 8
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
     * Creates one legacy fixed-layout arc payload.
     * @param {{ layerId: number, netIndex: number, polygonIndex: number, componentIndex: number, x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number }} options
     * @returns {Uint8Array}
     */
    static #createArcPayload(options) {
        const dataBytes = new Uint8Array(60)
        const dataView = new DataView(dataBytes.buffer)

        dataView.setUint8(0, options.layerId)
        dataView.setUint16(3, options.netIndex, true)
        dataView.setUint16(5, options.polygonIndex, true)
        dataView.setUint16(7, options.componentIndex, true)
        PcbArcPrimitiveTestFactory.#writeMil(dataView, 13, options.x)
        PcbArcPrimitiveTestFactory.#writeMil(dataView, 17, options.y)
        PcbArcPrimitiveTestFactory.#writeMil(dataView, 21, options.radius)
        dataView.setFloat64(25, options.startAngle, true)
        dataView.setFloat64(33, options.endAngle, true)
        PcbArcPrimitiveTestFactory.#writeMil(dataView, 41, options.width)

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
 * Verifies legacy fixed-layout arc streams decode without object-id prefixes.
 */
test('PcbBinaryPrimitiveParser decodes fixed-payload arc streams', () => {
    const { headerBytes, dataBytes } =
        PcbArcPrimitiveTestFactory.createFixedArcStream()

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
            },
            {
                x: 1000,
                y: 2000,
                radius: 125,
                startAngle: 270,
                endAngle: 315,
                width: 8,
                componentIndex: 7,
                netIndex: 21,
                polygonIndex: 27,
                layerCode: 34,
                layerId: 34
            }
        ]
    )
})

/**
 * Verifies object-id/length-prefixed arc records decode authored circular geometry.
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
