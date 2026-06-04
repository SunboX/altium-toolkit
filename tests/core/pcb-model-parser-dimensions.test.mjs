// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Builds a compact board outline record.
 * @returns {{ fields: Record<string, string>, sourceStream: string }}
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
            VX1: '300mil',
            VY1: '0mil',
            CX1: '0mil',
            CY1: '0mil',
            SA1: '0',
            EA1: '0',
            R1: '0mil',
            KIND2: '0',
            VX2: '300mil',
            VY2: '200mil',
            CX2: '0mil',
            CY2: '0mil',
            SA2: '0',
            EA2: '0',
            R2: '0mil',
            KIND3: '0',
            VX3: '0mil',
            VY3: '200mil',
            CX3: '0mil',
            CY3: '0mil',
            SA3: '0',
            EA3: '0',
            R3: '0mil'
        }
    }
}

/**
 * Verifies native PCB dimensions are parsed into a stable read-only contract.
 */
test('PcbModelParser exposes Dimensions6 data as normalized dimensions', () => {
    const model = PcbModelParser.parse('dimension-check.PcbDoc', [
        createBoardRecord(),
        {
            sourceStream: 'Dimensions6/Data',
            fields: {
                DIMENSIONTYPE: 'Linear',
                NAME: 'D1',
                LAYER: 'Mechanical 1',
                TEXT: 'L=125.46 mil',
                PREFIX: 'L=',
                SUFFIX: ' mil',
                PRECISION: '2',
                MEASUREDVALUE: '125.456mil',
                REFERENCE0_X: '10mil',
                REFERENCE0_Y: '20mil',
                REFERENCE1_X: '135.456mil',
                REFERENCE1_Y: '20mil',
                TEXTLOCATION_X: '70mil',
                TEXTLOCATION_Y: '40mil'
            }
        },
        {
            sourceStream: 'Dimensions6/Data',
            fields: {
                DIMENSIONTYPE: 'Angular',
                NAME: 'A1',
                ANGLEVALUE: '45',
                PRECISION: '1',
                REFERENCE0_X: '20mil',
                REFERENCE0_Y: '30mil',
                REFERENCE1_X: '40mil',
                REFERENCE1_Y: '60mil',
                REFERENCE2_X: '80mil',
                REFERENCE2_Y: '30mil'
            }
        }
    ])

    assert.equal(model.summary.dimensionCount, 2)
    assert.deepEqual(model.pcb.dimensions, [
        {
            dimensionIndex: 0,
            kind: 'linear',
            kindCode: 'Linear',
            name: 'D1',
            layer: 'Mechanical 1',
            text: 'L=125.46 mil',
            prefix: 'L=',
            suffix: ' mil',
            precision: 2,
            measuredValue: 125.456,
            angleValue: null,
            unit: 'mil',
            references: [
                { index: 0, x: 10, y: 20 },
                { index: 1, x: 135.456, y: 20 }
            ],
            textLocation: { x: 70, y: 40 },
            raw: {
                DIMENSIONTYPE: 'Linear',
                NAME: 'D1',
                LAYER: 'Mechanical 1',
                TEXT: 'L=125.46 mil',
                PREFIX: 'L=',
                SUFFIX: ' mil',
                PRECISION: '2',
                MEASUREDVALUE: '125.456mil',
                REFERENCE0_X: '10mil',
                REFERENCE0_Y: '20mil',
                REFERENCE1_X: '135.456mil',
                REFERENCE1_Y: '20mil',
                TEXTLOCATION_X: '70mil',
                TEXTLOCATION_Y: '40mil'
            }
        },
        {
            dimensionIndex: 1,
            kind: 'angular',
            kindCode: 'Angular',
            name: 'A1',
            layer: '',
            text: '',
            prefix: '',
            suffix: '',
            precision: 1,
            measuredValue: null,
            angleValue: 45,
            unit: '',
            references: [
                { index: 0, x: 20, y: 30 },
                { index: 1, x: 40, y: 60 },
                { index: 2, x: 80, y: 30 }
            ],
            textLocation: null,
            raw: {
                DIMENSIONTYPE: 'Angular',
                NAME: 'A1',
                ANGLEVALUE: '45',
                PRECISION: '1',
                REFERENCE0_X: '20mil',
                REFERENCE0_Y: '30mil',
                REFERENCE1_X: '40mil',
                REFERENCE1_Y: '60mil',
                REFERENCE2_X: '80mil',
                REFERENCE2_Y: '30mil'
            }
        }
    ])
})
