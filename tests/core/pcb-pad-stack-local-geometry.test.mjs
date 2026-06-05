// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbPadStackParser } from '../../src/core/altium/PcbPadStackParser.mjs'

/**
 * Creates a fake PAD main subrecord with the requested pad-stack mode.
 * @param {number} padMode Pad stack mode byte.
 * @returns {DataView}
 */
function createPadMainRecord(padMode) {
    const bytes = new Uint8Array(170)
    const view = new DataView(bytes.buffer)
    view.setUint8(62, padMode)
    return view
}

test('PcbPadStackParser exposes top-middle-bottom local stack geometry', () => {
    const metadata = PcbPadStackParser.parse(
        createPadMainRecord(1),
        undefined,
        {
            layerId: 74,
            sizeTopX: 60,
            sizeTopY: 40,
            sizeMidX: 50,
            sizeMidY: 30,
            sizeBottomX: 70,
            sizeBottomY: 45,
            shapeTop: 2,
            shapeMid: 1,
            shapeBottom: 9,
            holeDiameter: 20
        }
    )

    assert.equal(metadata.padModeName, 'top-middle-bottom')
    assert.deepEqual(metadata.localStack, {
        schema: 'altium-toolkit.pcb.pad-local-stack.a1',
        mode: 1,
        modeName: 'top-middle-bottom',
        source: 'main-record',
        layers: [
            {
                role: 'top',
                layerId: 1,
                layerKey: 'L1',
                width: 60,
                height: 40,
                shape: 2,
                shapeName: 'rectangular',
                offsetX: 0,
                offsetY: 0
            },
            {
                role: 'middle',
                layerId: null,
                layerKey: 'INNER',
                width: 50,
                height: 30,
                shape: 1,
                shapeName: 'round',
                offsetX: 0,
                offsetY: 0
            },
            {
                role: 'bottom',
                layerId: 32,
                layerKey: 'L32',
                width: 70,
                height: 45,
                shape: 9,
                shapeName: 'rounded-rectangle',
                offsetX: 0,
                offsetY: 0
            }
        ],
        hole: {
            diameter: 20,
            shape: null,
            shapeName: null,
            slotLength: null,
            rotation: null
        }
    })
})

test('PcbPadStackParser keeps simple pads without local stack geometry', () => {
    const metadata = PcbPadStackParser.parse(
        createPadMainRecord(0),
        undefined,
        {
            layerId: 1,
            sizeTopX: 60,
            sizeTopY: 40,
            holeDiameter: 0
        }
    )

    assert.equal(metadata.padModeName, 'simple')
    assert.equal(metadata.localStack, undefined)
})
