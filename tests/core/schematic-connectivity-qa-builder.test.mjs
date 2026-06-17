// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicConnectivityQaBuilder } from '../../src/parser.mjs'

test('SchematicConnectivityQaBuilder reports pin label and electrical ambiguity findings', () => {
    const pins = [
        {
            ownerIndex: '10',
            designator: '1',
            name: 'VCC',
            x: 100,
            y: 50,
            labelMode: 'hidden',
            electrical: 4,
            symbolOuter: 5
        },
        {
            ownerIndex: '10',
            designator: '2',
            name: 'SIG_A',
            x: 120,
            y: 50,
            labelMode: 'name-only',
            electrical: 0
        }
    ]
    const report = SchematicConnectivityQaBuilder.build({
        nets: [
            {
                name: 'VCC',
                pins: [pins[0]]
            },
            {
                name: 'SIG_A',
                pins: [pins[1]]
            }
        ],
        pins
    })

    assert.equal(report.schema, 'altium-toolkit.schematic.connectivity-qa.a1')
    assert.equal(report.summary.findingCount, 4)
    assert.equal(report.summary.hiddenPinLabelCount, 2)
    assert.equal(report.summary.powerElectricalAmbiguityCount, 1)
    assert.equal(report.summary.pinEndpointSymbolCount, 1)
    assert.deepEqual(
        report.findings.map((finding) => ({
            code: finding.code,
            ownerIndex: finding.ownerIndex,
            designator: finding.designator,
            severity: finding.severity
        })),
        [
            {
                code: 'schematic.pin.hidden-labels',
                ownerIndex: '10',
                designator: '1',
                severity: 'info'
            },
            {
                code: 'schematic.pin.power-like-name-non-power-electrical',
                ownerIndex: '10',
                designator: '1',
                severity: 'warning'
            },
            {
                code: 'schematic.pin.endpoint-symbol',
                ownerIndex: '10',
                designator: '1',
                severity: 'info'
            },
            {
                code: 'schematic.pin.hidden-number',
                ownerIndex: '10',
                designator: '2',
                severity: 'info'
            }
        ]
    )
})
