// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Verifies PCB class records are exposed from native Classes6/Data records,
 * including the split name/detail record form used by real Altium files.
 */
test('PcbModelParser exposes PCB classes from native class records', () => {
    const documentModel = PcbModelParser.parse('demo.PcbDoc', [
        createBoardRecord(),
        {
            sourceStream: 'Classes6/Data',
            fields: {
                NAME: 'Power Nets'
            }
        },
        {
            sourceStream: 'Classes6/Data',
            fields: {
                KIND: '0',
                MEMBERCOUNT: '2',
                M0: 'GND',
                M1: '+3V3',
                ENABLED: 'FALSE',
                UNIQUEID: 'CLASS-POWER'
            }
        },
        {
            sourceStream: 'Classes6/Data',
            fields: {
                NAME: 'Mounting Parts',
                KIND: '1',
                MEMBERCOUNT: '2',
                M0: 'J1',
                M1: 'H1',
                ENABLED: 'TRUE',
                UNIQUEID: 'CLASS-MOUNT'
            }
        },
        {
            sourceStream: 'Classes6/Data',
            fields: {
                NAME: 'USB Diff Pairs',
                KIND: '6',
                M0: 'USB_D',
                UNIQUEID: 'CLASS-USB'
            }
        }
    ])

    assert.deepEqual(documentModel.pcb.classes, [
        {
            classIndex: 0,
            name: 'Power Nets',
            kind: 0,
            kindName: 'net',
            memberCount: 2,
            members: ['GND', '+3V3'],
            enabled: false,
            uniqueId: 'CLASS-POWER'
        },
        {
            classIndex: 1,
            name: 'Mounting Parts',
            kind: 1,
            kindName: 'component',
            memberCount: 2,
            members: ['J1', 'H1'],
            enabled: true,
            uniqueId: 'CLASS-MOUNT'
        },
        {
            classIndex: 2,
            name: 'USB Diff Pairs',
            kind: 6,
            kindName: 'diff-pair',
            memberCount: 1,
            members: ['USB_D'],
            enabled: true,
            uniqueId: 'CLASS-USB'
        }
    ])
    assert.equal(documentModel.summary.classCount, 3)
    assert.ok(
        documentModel.diagnostics.some(
            (diagnostic) =>
                diagnostic.message === 'Recovered 3 PCB class definitions.'
        )
    )
})

/**
 * Creates the standard synthetic rectangular board record for parser tests.
 * @returns {{ sourceStream: string, fields: Record<string, string> }}
 */
function createBoardRecord() {
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
            V9_STACK_LAYER1_LAYERID: '1'
        }
    }
}
