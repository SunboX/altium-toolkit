// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Builds one synthetic PCB component record.
 * @param {object} fields Native component fields.
 * @returns {{ sourceStream: string, fields: object }}
 */
function componentRecord(fields) {
    return {
        sourceStream: 'Components6/Data',
        fields: {
            SOURCEDESIGNATOR: fields.designator,
            PATTERN: fields.pattern || 'PKG_FAKE',
            SOURCELIBREFERENCE: fields.source || 'LIB_FAKE',
            SOURCEDESCRIPTION: fields.description || fields.pattern || 'Part',
            X: String(fields.x || 0),
            Y: String(fields.y || 0),
            LAYER: fields.layer || 'TOP',
            ROTATION: String(fields.rotation || 0),
            ...fields.native
        }
    }
}

test('PcbModelParser exposes native component kind policy fields', () => {
    const model = PcbModelParser.parse('kind-policy.PcbDoc', [
        componentRecord({
            designator: 'U1',
            pattern: 'QFN_FAKE',
            native: {
                COMPONENTKIND: '0'
            }
        }),
        componentRecord({
            designator: 'TP1',
            pattern: 'TP_FAKE',
            native: {
                COMPONENTKIND: '5',
                COMPONENTKINDVERSION2: '5'
            }
        }),
        componentRecord({
            designator: 'G1',
            pattern: 'LOGO_FAKE',
            native: {
                COMPONENTKIND: '2'
            }
        }),
        componentRecord({
            designator: 'JMP1',
            pattern: 'JUMPER_FAKE',
            native: {
                COMPONENTKINDVERSION3: '6'
            }
        })
    ])

    assert.deepEqual(
        model.pcb.components.map((component) => ({
            designator: component.designator,
            componentKind: component.componentKind
        })),
        [
            {
                designator: 'G1',
                componentKind: {
                    value: 2,
                    name: 'graphical',
                    displayName: 'Graphical',
                    includeInBom: false,
                    includeInNetlist: false,
                    includeInPnp: false
                }
            },
            {
                designator: 'JMP1',
                componentKind: {
                    value: 6,
                    name: 'jumper',
                    displayName: 'Jumper',
                    includeInBom: true,
                    includeInNetlist: true,
                    includeInPnp: true
                }
            },
            {
                designator: 'TP1',
                componentKind: {
                    value: 5,
                    name: 'standard-no-bom',
                    displayName: 'Standard No BOM',
                    includeInBom: false,
                    includeInNetlist: true,
                    includeInPnp: true
                }
            },
            {
                designator: 'U1',
                componentKind: {
                    value: 0,
                    name: 'standard',
                    displayName: 'Standard',
                    includeInBom: true,
                    includeInNetlist: true,
                    includeInPnp: true
                }
            }
        ]
    )
    assert.deepEqual(
        model.bom.map((row) => row.designators),
        [['JMP1'], ['U1']]
    )
    assert.deepEqual(
        model.pnp.entries.map((entry) => ({
            designator: entry.designator,
            includeInPnp: entry.componentKind.includeInPnp
        })),
        [
            { designator: 'G1', includeInPnp: false },
            { designator: 'JMP1', includeInPnp: true },
            { designator: 'TP1', includeInPnp: true },
            { designator: 'U1', includeInPnp: true }
        ]
    )
})
