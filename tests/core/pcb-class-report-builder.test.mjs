// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbClassReportBuilder } from '../../src/parser.mjs'

test('PcbClassReportBuilder resolves class members and flags unresolved rows', () => {
    const report = PcbClassReportBuilder.build({
        nets: [{ name: 'GND' }],
        components: [{ designator: 'U1' }],
        pads: [{ designator: '1' }],
        differentialPairs: [{ name: 'USB_D' }],
        classes: [
            {
                name: 'Power Nets',
                kind: 0,
                kindName: 'net',
                enabled: true,
                members: ['GND', 'MISSING_NET']
            },
            {
                name: 'Assembly',
                kind: 1,
                kindName: 'component',
                enabled: false,
                members: ['U1']
            },
            {
                name: 'Pad Checks',
                kind: 3,
                kindName: 'pad',
                enabled: true,
                members: ['1']
            },
            {
                name: 'High Speed',
                kind: 6,
                kindName: 'diff-pair',
                enabled: true,
                members: ['USB_D']
            },
            {
                name: 'Empty Nets',
                kind: 0,
                kindName: 'net',
                enabled: true,
                members: []
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.pcb.class-report.a1')
    assert.equal(report.summary.classCount, 5)
    assert.equal(report.summary.enabledClassCount, 4)
    assert.equal(report.summary.disabledClassCount, 1)
    assert.equal(report.summary.netClassCount, 2)
    assert.equal(report.summary.componentClassCount, 1)
    assert.equal(report.summary.padClassCount, 1)
    assert.equal(report.summary.differentialPairClassCount, 1)
    assert.equal(report.summary.emptyClassCount, 1)
    assert.equal(report.summary.unresolvedMemberCount, 1)
    assert.deepEqual(report.byKind, [
        { kindName: 'component', count: 1 },
        { kindName: 'diff-pair', count: 1 },
        { kindName: 'net', count: 2 },
        { kindName: 'pad', count: 1 }
    ])

    const power = report.classes.find(
        (classRow) => classRow.name === 'Power Nets'
    )
    assert.deepEqual(power.resolvedMembers, [
        {
            name: 'GND',
            kind: 'net'
        }
    ])
    assert.deepEqual(power.unresolvedMembers, ['MISSING_NET'])
    assert.deepEqual(
        report.issues.map((issue) => issue.code),
        ['pcb.class.unresolved-member', 'pcb.class.empty']
    )
})
