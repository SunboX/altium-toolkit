// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Verifies native PCB design rules are exposed as normalized model data.
 */
test('PcbModelParser exposes PCB design rules from native rule records', () => {
    const documentModel = PcbModelParser.parse('demo.PcbDoc', [
        createBoardRecord(),
        {
            sourceStream: 'Rules6/Data',
            fields: {
                SELECTION: 'FALSE',
                LAYER: 'TOP',
                LOCKED: 'FALSE',
                POLYGONOUTLINE: 'FALSE',
                USERROUTED: 'TRUE',
                KEEPOUT: 'FALSE',
                UNIONINDEX: '0',
                RULEKIND: 'Width',
                NETSCOPE: 'AnyNet',
                LAYERKIND: 'SameLayer',
                SCOPE1EXPRESSION: "WithinRoom('Main Room')",
                SCOPE2EXPRESSION: 'All',
                NAME: 'Width_MainRoom',
                ENABLED: 'TRUE',
                PRIORITY: '2',
                COMMENT: 'Routing width for the main room',
                UNIQUEID: 'RULE-WIDTH',
                DEFINEDBYLOGICALDOCUMENT: 'FALSE',
                MINLIMIT: '4mil',
                PREFEREDWIDTH: '6mil',
                MAXLIMIT: '8mil'
            }
        },
        {
            sourceStream: 'Rules6/Data',
            fields: {
                RULEKIND: 'Clearance',
                SCOPE1EXPRESSION: "InNetClass('Power Nets')",
                SCOPE2EXPRESSION: "InNet('GND')",
                NAME: 'Clearance_Power',
                ENABLED: 'FALSE',
                PRIORITY: '5',
                UNIQUEID: 'RULE-CLEARANCE',
                GAP: '10mil',
                GENERICCLEARANCE: '0.254mm'
            }
        }
    ])

    assert.deepEqual(documentModel.pcb.rules, [
        {
            ruleIndex: 0,
            name: 'Width_MainRoom',
            ruleKind: 'Width',
            enabled: true,
            priority: 2,
            uniqueId: 'RULE-WIDTH',
            comment: 'Routing width for the main room',
            selection: false,
            layer: 'TOP',
            locked: false,
            polygonOutline: false,
            userRouted: true,
            keepout: false,
            unionIndex: 0,
            netScope: 'AnyNet',
            layerKind: 'SameLayer',
            scope1Expression: "WithinRoom('Main Room')",
            scope2Expression: 'All',
            scope1: {
                rawExpression: "WithinRoom('Main Room')",
                predicate: 'WithinRoom',
                arguments: ['Main Room'],
                isAll: false
            },
            scope2: {
                rawExpression: 'All',
                predicate: 'All',
                arguments: [],
                isAll: true
            },
            ruleType: {
                rawKind: 'Width',
                kind: 'width',
                category: 'routing',
                displayName: 'Width'
            },
            constraints: {
                MINLIMIT: '4mil',
                PREFEREDWIDTH: '6mil',
                MAXLIMIT: '8mil'
            },
            constraintValues: {
                MINLIMIT: {
                    raw: '4mil',
                    type: 'length',
                    value: 4,
                    unit: 'mil',
                    valueMil: 4,
                    valueMm: 0.1016
                },
                PREFEREDWIDTH: {
                    raw: '6mil',
                    type: 'length',
                    value: 6,
                    unit: 'mil',
                    valueMil: 6,
                    valueMm: 0.1524
                },
                MAXLIMIT: {
                    raw: '8mil',
                    type: 'length',
                    value: 8,
                    unit: 'mil',
                    valueMil: 8,
                    valueMm: 0.2032
                }
            },
            typedConstraints: {
                minWidth: {
                    key: 'MINLIMIT',
                    raw: '4mil',
                    type: 'length',
                    value: 4,
                    unit: 'mil',
                    valueMil: 4,
                    valueMm: 0.1016
                },
                preferredWidth: {
                    key: 'PREFEREDWIDTH',
                    raw: '6mil',
                    type: 'length',
                    value: 6,
                    unit: 'mil',
                    valueMil: 6,
                    valueMm: 0.1524
                },
                maxWidth: {
                    key: 'MAXLIMIT',
                    raw: '8mil',
                    type: 'length',
                    value: 8,
                    unit: 'mil',
                    valueMil: 8,
                    valueMm: 0.2032
                }
            }
        },
        {
            ruleIndex: 1,
            name: 'Clearance_Power',
            ruleKind: 'Clearance',
            enabled: false,
            priority: 5,
            uniqueId: 'RULE-CLEARANCE',
            comment: '',
            selection: null,
            layer: '',
            locked: null,
            polygonOutline: null,
            userRouted: null,
            keepout: null,
            unionIndex: null,
            netScope: '',
            layerKind: '',
            scope1Expression: "InNetClass('Power Nets')",
            scope2Expression: "InNet('GND')",
            scope1: {
                rawExpression: "InNetClass('Power Nets')",
                predicate: 'InNetClass',
                arguments: ['Power Nets'],
                isAll: false
            },
            scope2: {
                rawExpression: "InNet('GND')",
                predicate: 'InNet',
                arguments: ['GND'],
                isAll: false
            },
            ruleType: {
                rawKind: 'Clearance',
                kind: 'clearance',
                category: 'electrical',
                displayName: 'Clearance'
            },
            constraints: {
                GAP: '10mil',
                GENERICCLEARANCE: '0.254mm'
            },
            constraintValues: {
                GAP: {
                    raw: '10mil',
                    type: 'length',
                    value: 10,
                    unit: 'mil',
                    valueMil: 10,
                    valueMm: 0.254
                },
                GENERICCLEARANCE: {
                    raw: '0.254mm',
                    type: 'length',
                    value: 0.254,
                    unit: 'mm',
                    valueMil: 10,
                    valueMm: 0.254
                }
            },
            typedConstraints: {
                minClearance: {
                    key: 'GAP',
                    raw: '10mil',
                    type: 'length',
                    value: 10,
                    unit: 'mil',
                    valueMil: 10,
                    valueMm: 0.254
                },
                genericClearance: {
                    key: 'GENERICCLEARANCE',
                    raw: '0.254mm',
                    type: 'length',
                    value: 0.254,
                    unit: 'mm',
                    valueMil: 10,
                    valueMm: 0.254
                }
            }
        }
    ])
    assert.equal(documentModel.summary.ruleCount, 2)
    assert.ok(
        documentModel.diagnostics.some(
            (diagnostic) =>
                diagnostic.message === 'Recovered 2 PCB design rules.'
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
            KIND1: '0',
            VX1: '1000mil',
            VY1: '0mil',
            KIND2: '0',
            VX2: '1000mil',
            VY2: '500mil',
            KIND3: '0',
            VX3: '0mil',
            VY3: '500mil',
            V9_STACK_LAYER1_NAME: 'Top Layer',
            V9_STACK_LAYER1_LAYERID: '1'
        }
    }
}
