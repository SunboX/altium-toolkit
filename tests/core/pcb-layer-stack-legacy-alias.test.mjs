// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Verifies layer-stack rows expose decoded legacy layer identifiers when native
 * saved-layer IDs are used by modern Altium layer-stack metadata.
 */
test('PcbModelParser exposes legacy IDs for native layer-stack signal layers', () => {
    const documentModel = PcbModelParser.parse('layer-alias.PcbDoc', [
        createLayerAliasBoardRecord()
    ])

    assert.deepEqual(
        documentModel.pcb.layers.map((layer) => ({
            name: layer.name,
            layerId: layer.layerId,
            legacyLayerId: layer.legacyLayerId
        })),
        [
            {
                name: 'Top Layer',
                layerId: 0x01000001,
                legacyLayerId: 1
            },
            {
                name: 'Internal1',
                layerId: 0x01000002,
                legacyLayerId: 2
            },
            {
                name: 'Internal2',
                layerId: 0x01000003,
                legacyLayerId: 3
            },
            {
                name: 'Bottom Layer',
                layerId: 0x0100ffff,
                legacyLayerId: 32
            }
        ]
    )
})

/**
 * Creates one obfuscated rectangular board record with native saved-layer IDs.
 * @returns {{ sourceStream: string, fields: Record<string, string> }}
 */
function createLayerAliasBoardRecord() {
    return {
        sourceStream: 'Board6/Data',
        fields: {
            KIND0: '0',
            VX0: '0mil',
            VY0: '0mil',
            CX0: '0mil',
            CY0: '0mil',
            SA0: '0',
            EA0: '0',
            R0: '0mil',
            KIND1: '0',
            VX1: '1000mil',
            VY1: '0mil',
            CX1: '0mil',
            CY1: '0mil',
            SA1: '0',
            EA1: '0',
            R1: '0mil',
            KIND2: '0',
            VX2: '1000mil',
            VY2: '500mil',
            CX2: '0mil',
            CY2: '0mil',
            SA2: '0',
            EA2: '0',
            R2: '0mil',
            KIND3: '0',
            VX3: '0mil',
            VY3: '500mil',
            CX3: '0mil',
            CY3: '0mil',
            SA3: '0',
            EA3: '0',
            R3: '0mil',
            V9_STACK_LAYER1_NAME: 'Top Layer',
            V9_STACK_LAYER1_LAYERID: String(0x01000001),
            V9_STACK_LAYER2_NAME: 'Internal1',
            V9_STACK_LAYER2_LAYERID: String(0x01000002),
            V9_STACK_LAYER3_NAME: 'Internal2',
            V9_STACK_LAYER3_LAYERID: String(0x01000003),
            V9_STACK_LAYER4_NAME: 'Bottom Layer',
            V9_STACK_LAYER4_LAYERID: String(0x0100ffff),
            LAYER1NAME: 'Top Layer',
            LAYER2NAME: 'Mid-Layer 1',
            LAYER3NAME: 'Mid-Layer 2',
            LAYER32NAME: 'Bottom Layer'
        }
    }
}
