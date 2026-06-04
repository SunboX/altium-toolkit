// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbRuleParser } from '../../src/core/altium/PcbRuleParser.mjs'

/**
 * Verifies design-rule parsing exposes typed semantic aliases beyond the
 * original width and clearance rules.
 */
test('PcbRuleParser exposes typed fields for routing and manufacturing rules', () => {
    const rules = PcbRuleParser.parse([
        {
            sourceStream: 'Rules6/Data',
            fields: {
                NAME: 'Fanout matrix',
                RULEKIND: 'FanoutControl',
                FANOUTSTYLE: 'BGA',
                FANOUTDIRECTION: 'Out',
                BGAVIAMODE: 'DogBone',
                VIAGRID: '20mil',
                SCOPE1EXPRESSION: "InComponentClass('Dense Parts')"
            }
        },
        {
            sourceStream: 'Rules6/Data',
            fields: {
                NAME: 'Length window',
                RULEKIND: 'MatchedLengths',
                TOLERANCE: '5mil',
                DELAYTOLERANCE: '12ps',
                TARGETSOURCENAME: 'CLK_A',
                USEDELAYUNITS: 'TRUE',
                CHECKNETSINDIFFPAIR: 'FALSE',
                CHECKXSIGNALS: 'TRUE'
            }
        },
        {
            sourceStream: 'Rules6/Data',
            fields: {
                NAME: 'Assembly probes',
                RULEKIND: 'AssemblyTestpoint',
                MINSIZE: '18mil',
                PREFEREDSIZE: '24mil',
                MAXSIZE: '30mil',
                MINHOLESIZE: '8mil',
                USEGRID: 'TRUE',
                ALLOWSIDETOP: 'TRUE',
                ALLOWSIDEBOTTOM: 'FALSE'
            }
        }
    ])

    assert.equal(rules[0].ruleType.kind, 'fanout-control')
    assert.deepEqual(rules[0].typedConstraints.fanoutStyle, {
        key: 'FANOUTSTYLE',
        raw: 'BGA',
        type: 'string',
        value: 'BGA'
    })
    assert.equal(rules[0].typedConstraints.viaGrid.valueMil, 20)

    assert.equal(rules[1].ruleType.kind, 'matched-lengths')
    assert.equal(rules[1].typedConstraints.tolerance.valueMil, 5)
    assert.equal(rules[1].typedConstraints.targetSourceName.value, 'CLK_A')
    assert.equal(rules[1].typedConstraints.useDelayUnits.value, true)
    assert.equal(rules[1].typedConstraints.checkNetsInDiffPair.value, false)
    assert.equal(rules[1].typedConstraints.checkXSignals.value, true)

    assert.equal(rules[2].ruleType.kind, 'assembly-testpoint')
    assert.equal(rules[2].typedConstraints.minimumSize.valueMil, 18)
    assert.equal(rules[2].typedConstraints.preferredSize.valueMil, 24)
    assert.equal(rules[2].typedConstraints.allowSideTop.value, true)
    assert.equal(rules[2].typedConstraints.allowSideBottom.value, false)
})

/**
 * Verifies clearance-family, component clearance, and annular-ring rules get
 * stable category/kind names and typed constraint aliases.
 */
test('PcbRuleParser normalizes additional clearance and fabrication rule families', () => {
    const rules = PcbRuleParser.parse([
        {
            sourceStream: 'Rules6/Data',
            fields: {
                NAME: 'Silk mask gap',
                RULEKIND: 'SilkToSolderMaskClearance',
                MINSILKSCREENTOMASKGAP: '4mil',
                CLEARANCETOEXPOSEDCOPPER: '2mil'
            }
        },
        {
            sourceStream: 'Rules6/Data',
            fields: {
                NAME: 'Body spacing',
                RULEKIND: 'ComponentClearance',
                GAP: '10mil',
                VERTICALGAP: '0.5mm',
                COLLISIONCHECKMODE: 'STEP',
                DONOTCHECKWITHOUT3DBODY: 'TRUE'
            }
        },
        {
            sourceStream: 'Rules6/Data',
            fields: {
                NAME: 'Annular',
                RULEKIND: 'MinimumAnnularRing',
                MINIMUMRING: '6mil'
            }
        }
    ])

    assert.equal(rules[0].ruleType.kind, 'silk-to-soldermask-clearance')
    assert.equal(rules[0].ruleType.category, 'manufacturing')
    assert.equal(
        rules[0].typedConstraints.minimumSilkscreenToMaskGap.valueMil,
        4
    )
    assert.equal(rules[0].typedConstraints.clearanceToExposedCopper.valueMil, 2)

    assert.equal(rules[1].ruleType.kind, 'component-clearance')
    assert.equal(rules[1].typedConstraints.gap.valueMil, 10)
    assert.equal(rules[1].typedConstraints.verticalGap.valueMm, 0.5)
    assert.equal(rules[1].typedConstraints.collisionCheckMode.value, 'STEP')
    assert.equal(rules[1].typedConstraints.doNotCheckWithout3dBody.value, true)

    assert.equal(rules[2].ruleType.kind, 'minimum-annular-ring')
    assert.equal(rules[2].typedConstraints.minimumRing.valueMil, 6)
})
