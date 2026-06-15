// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbNetMembershipReportBuilder } from '../../src/parser.mjs'

test('PcbNetMembershipReportBuilder summarizes declared and observed copper nets', () => {
    const report = PcbNetMembershipReportBuilder.build({
        nets: [{ name: 'GND' }, { name: 'AIRWIRE' }, { name: 'EMPTY' }],
        pads: [
            { designator: '1', netName: 'GND', layerId: 1 },
            { designator: '2', netName: 'AIRWIRE', layerId: 1 },
            { designator: '3', netName: 'AIRWIRE', layerId: 1 }
        ],
        tracks: [{ netName: 'GND', layerId: 1 }],
        arcs: [{ netName: 'FLOATING', layerId: 1 }],
        vias: [{ netName: 'GND', layerId: 2 }],
        fills: [{ netName: 'GND', layerId: 1 }, { layerId: 3 }],
        regions: [{ netLabel: 'POUR_A', layerId: 3 }],
        polygons: [{ netName: 'GND', layerId: 1 }]
    })

    assert.equal(report.schema, 'altium-toolkit.pcb.net-membership.a1')
    assert.equal(report.summary.declaredNetCount, 3)
    assert.equal(report.summary.observedNetCount, 4)
    assert.equal(report.summary.undeclaredNetCount, 2)
    assert.equal(report.summary.emptyDeclaredNetCount, 1)
    assert.equal(report.summary.possibleUnroutedNetCount, 1)
    assert.equal(report.summary.unownedPrimitiveCount, 1)
    assert.deepEqual(report.emptyDeclaredNets, ['EMPTY'])
    assert.deepEqual(report.undeclaredNets, ['FLOATING', 'POUR_A'])
    assert.deepEqual(report.possibleUnroutedNets, ['AIRWIRE'])

    const ground = report.byNet.find((net) => net.netName === 'GND')
    assert.deepEqual(
        {
            declared: ground.declared,
            totalPrimitiveCount: ground.totalPrimitiveCount,
            padCount: ground.padCount,
            trackCount: ground.trackCount,
            arcCount: ground.arcCount,
            viaCount: ground.viaCount,
            fillCount: ground.fillCount,
            regionCount: ground.regionCount,
            polygonCount: ground.polygonCount,
            layers: ground.layers,
            padDesignators: ground.padDesignators
        },
        {
            declared: true,
            totalPrimitiveCount: 5,
            padCount: 1,
            trackCount: 1,
            arcCount: 0,
            viaCount: 1,
            fillCount: 1,
            regionCount: 0,
            polygonCount: 1,
            layers: [1, 2],
            padDesignators: ['1']
        }
    )
    assert.deepEqual(report.unownedPrimitives, [
        {
            primitiveKey: 'fills-1',
            family: 'fills',
            index: 1,
            layerId: 3
        }
    ])
})
