// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'
import { PcbBinaryPrimitiveTestFactory } from './PcbBinaryPrimitiveTestFactory.mjs'

/**
 * Creates synthetic binary fill primitive streams.
 */
class PcbFillPrimitiveTestFactory {
    /**
     * Creates a variable-length object-id/length-prefixed fill stream.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createVariableLengthFillStream() {
        const headerBytes = new Uint8Array(4)
        const headerView = new DataView(headerBytes.buffer)
        const firstRecord = PcbFillPrimitiveTestFactory.#createFillRecord({
            payloadLength: 60,
            x1: 11039.3046,
            y1: 8902.9081,
            x2: 11049.1471,
            y2: 8916.6876,
            layerId: 33,
            layerCode: 256,
            componentIndex: 5,
            netIndex: 19,
            polygonIndex: 25
        })
        const secondRecord = PcbFillPrimitiveTestFactory.#createFillRecord({
            payloadLength: 50,
            x1: 420,
            y1: 360,
            x2: 460,
            y2: 390,
            layerId: 34,
            layerCode: 512,
            componentIndex: 8,
            netIndex: 22,
            polygonIndex: null
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
     * Creates one object-id/length-prefixed fill record.
     * @param {{ payloadLength: number, x1: number, y1: number, x2: number, y2: number, layerId: number, layerCode: number, componentIndex: number, netIndex: number, polygonIndex: number | null }} options
     * @returns {Uint8Array}
     */
    static #createFillRecord(options) {
        const dataBytes = new Uint8Array(5 + options.payloadLength)
        const dataView = new DataView(dataBytes.buffer)

        dataView.setUint8(0, 6)
        dataView.setUint32(1, options.payloadLength, true)
        dataView.setUint8(5, options.layerId)
        dataView.setUint16(8, options.netIndex, true)
        dataView.setUint16(
            10,
            options.polygonIndex === null ? 0xffff : options.polygonIndex,
            true
        )
        dataView.setUint16(12, options.componentIndex, true)
        PcbFillPrimitiveTestFactory.#writeMil(dataView, 18, options.x1)
        PcbFillPrimitiveTestFactory.#writeMil(dataView, 22, options.y1)
        PcbFillPrimitiveTestFactory.#writeMil(dataView, 26, options.x2)
        PcbFillPrimitiveTestFactory.#writeMil(dataView, 30, options.y2)
        dataView.setUint16(46, options.layerCode, true)

        return dataBytes
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
}

/**
 * Verifies object-id/length-prefixed fills preserve record alignment when
 * Altium emits variable-size fill payloads.
 */
test('PcbBinaryPrimitiveParser decodes variable-length fill streams', () => {
    const { headerBytes, dataBytes } =
        PcbFillPrimitiveTestFactory.createVariableLengthFillStream()

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
            },
            {
                x1: 420,
                y1: 360,
                x2: 460,
                y2: 390,
                componentIndex: 8,
                netIndex: 22,
                polygonIndex: null,
                layerCode: 512,
                layerId: 34
            }
        ]
    )
})

/**
 * Verifies legacy fixed-layout fill records decode rectangular copper fills.
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
