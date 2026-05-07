// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Verifies native Texts6 designator records and PrimitiveParameters/Data
 * records enrich components by Altium-owned indexes and unique IDs.
 */
test('PcbModelParser applies Texts6 designators and primitive parameters', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            createBoardRecord(),
            {
                sourceStream: 'Components6/Data',
                fields: {
                    LAYER: 'TOP',
                    X: '100mil',
                    Y: '120mil',
                    PATTERN: 'QFN-56',
                    ROTATION: '0',
                    HEIGHT: '20mil',
                    SOURCEDESIGNATOR: 'U1',
                    UNIQUEID: 'UID-C1',
                    NAMEON: 'TRUE'
                }
            }
        ],
        {
            streamNames: ['PrimitiveParameters/Data', 'Texts6/Data'],
            binaryPrimitives: {
                texts: [
                    {
                        text: 'U1A',
                        ownerIndex: 0,
                        componentIndex: 0,
                        x: 120,
                        y: 140,
                        height: 10,
                        layerId: 33,
                        kind: 0,
                        visibilityFlags: 0,
                        rotation: 0,
                        role: 'designator',
                        isDesignator: true
                    }
                ]
            },
            primitiveParameters: {
                groups: [
                    {
                        primitiveId: 'UID-C1',
                        parameters: {
                            Manufacturer: 'Acme',
                            MPN: 'XYZ-1',
                            Description: 'Display MCU'
                        }
                    }
                ],
                byPrimitiveId: {
                    'UID-C1': {
                        Manufacturer: 'Acme',
                        MPN: 'XYZ-1',
                        Description: 'Display MCU'
                    }
                }
            },
            diagnostics: {
                printableRecordCount: 2,
                printableStreamCount: 2,
                binaryPrimitiveCount: 1,
                primitiveParameterGroupCount: 1
            }
        }
    )

    assert.deepEqual(documentModel.pcb.components[0], {
        componentIndex: 0,
        designator: 'U1A',
        baseDesignator: 'U1',
        displayDesignator: 'U1A',
        designatorSource: 'Texts6/Data',
        uniqueId: 'UID-C1',
        x: 100,
        y: 380,
        layer: 'TOP',
        pattern: 'QFN-56',
        rotation: 0,
        source: '',
        description: 'Display MCU',
        height: 20,
        parameters: {
            Manufacturer: 'Acme',
            MPN: 'XYZ-1',
            Description: 'Display MCU'
        },
        parameterSource: 'PrimitiveParameters/Data'
    })
    assert.equal(documentModel.pcb.texts[0].visible, true)
    assert.deepEqual(documentModel.bom[0], {
        designators: ['U1A'],
        quantity: 1,
        pattern: 'QFN-56',
        source: 'Unknown source',
        value: 'Display MCU'
    })
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
