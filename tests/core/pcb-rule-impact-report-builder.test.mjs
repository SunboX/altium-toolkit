// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbRuleImpactReportBuilder } from '../../src/parser.mjs'

/**
 * Verifies parsed PCB rules can be summarized by practical primitive and
 * manufacturing impact without re-evaluating host DRC expressions.
 */
test('PcbRuleImpactReportBuilder summarizes enabled rule impact', () => {
    const report = PcbRuleImpactReportBuilder.build({
        pcb: {
            pads: [{}, {}],
            vias: [{}],
            tracks: [{}],
            arcs: [],
            regions: [],
            polygons: [{}],
            components: [{}],
            rules: [
                {
                    ruleIndex: 0,
                    name: 'Power clearance',
                    enabled: true,
                    ruleType: {
                        kind: 'clearance',
                        category: 'electrical',
                        displayName: 'Clearance'
                    },
                    scope1: {
                        rawExpression: "InNetClass('Power')",
                        predicate: 'InNetClass',
                        arguments: ['Power'],
                        isAll: false
                    },
                    typedConstraints: {
                        clearance: {
                            key: 'CLEARANCE',
                            raw: '6mil',
                            type: 'length',
                            valueMil: 6,
                            valueMm: 0.1524
                        }
                    }
                },
                {
                    ruleIndex: 1,
                    name: 'Paste opening',
                    enabled: true,
                    ruleType: {
                        kind: 'paste-mask-expansion',
                        category: 'manufacturing',
                        displayName: 'Paste Mask Expansion'
                    },
                    scope1: {
                        rawExpression: "InPadClass('SMD Pads')",
                        predicate: 'InPadClass',
                        arguments: ['SMD Pads'],
                        isAll: false
                    },
                    typedConstraints: {
                        expansion: {
                            key: 'EXPANSION',
                            raw: '-2mil',
                            type: 'length',
                            valueMil: -2,
                            valueMm: -0.0508
                        }
                    }
                },
                {
                    ruleIndex: 2,
                    name: 'Legacy width',
                    enabled: false,
                    ruleType: {
                        kind: 'width',
                        category: 'routing',
                        displayName: 'Width'
                    },
                    typedConstraints: {
                        minimumWidth: {
                            key: 'MINWIDTH',
                            raw: '5mil',
                            type: 'length',
                            valueMil: 5
                        }
                    }
                }
            ]
        }
    })

    assert.equal(report.schema, 'altium-toolkit.pcb.rule-impact.a1')
    assert.deepEqual(report.summary, {
        ruleCount: 3,
        enabledRuleCount: 2,
        disabledRuleCount: 1,
        manufacturingRuleCount: 1,
        scopedRuleCount: 2,
        impactedFamilyCount: 6,
        lengthConstraintCount: 3
    })
    assert.deepEqual(
        report.rules.map((rule) => ({
            ruleIndex: rule.ruleIndex,
            name: rule.name,
            kind: rule.kind,
            category: rule.category,
            enabled: rule.enabled,
            affectedFamilies: rule.affectedFamilies,
            lengthConstraintCount: rule.lengthConstraints.length
        })),
        [
            {
                ruleIndex: 0,
                name: 'Power clearance',
                kind: 'clearance',
                category: 'electrical',
                enabled: true,
                affectedFamilies: [
                    'arcs',
                    'fills',
                    'pads',
                    'regions',
                    'tracks',
                    'vias'
                ],
                lengthConstraintCount: 1
            },
            {
                ruleIndex: 1,
                name: 'Paste opening',
                kind: 'paste-mask-expansion',
                category: 'manufacturing',
                enabled: true,
                affectedFamilies: ['pads'],
                lengthConstraintCount: 1
            },
            {
                ruleIndex: 2,
                name: 'Legacy width',
                kind: 'width',
                category: 'routing',
                enabled: false,
                affectedFamilies: ['arcs', 'tracks'],
                lengthConstraintCount: 1
            }
        ]
    )
    assert.deepEqual(report.rules[0].scopes, [
        {
            side: 'scope1',
            expression: "InNetClass('Power')",
            predicate: 'InNetClass',
            arguments: ['Power']
        }
    ])
})
