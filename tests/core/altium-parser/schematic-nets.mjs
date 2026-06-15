// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies the schematic parser derives normalized nets from wire geometry and
 * explicit naming primitives instead of leaving connectivity implicit.
 */
test('parseAltiumArrayBuffer builds named schematic nets from wires, labels, junctions, and power ports', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=240|CustomY=160|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=20|Y1=80|X2=60|Y2=80',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=60|Y1=80|X2=100|Y2=80',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=60|Y1=80|X2=60|Y2=110',
        '|RECORD=29|Location.X=60|Location.Y=80|Color=255',
        '|RECORD=25|Location.X=30|Location.Y=80|Color=128|FontID=1|Text=UART_RX',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=140|Y1=40|X2=170|Y2=40',
        '|RECORD=17|Style=2|ShowNetName=T|Location.X=170|Location.Y=40|Color=128|FontID=1|Text=+3V3',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=20|Y1=20|X2=40|Y2=20'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'schematic-nets.SchDoc',
        arrayBuffer
    )
    const netNames = documentModel.schematic.nets
        .map((net) => net.name)
        .sort((left, right) => left.localeCompare(right))
    const uartNet = documentModel.schematic.nets.find(
        (net) => net.name === 'UART_RX'
    )

    assert.deepEqual(netNames, ['+3V3', 'UART_RX', 'UnknownNet0'])
    assert.deepEqual(
        {
            segmentCount: uartNet?.segments.length,
            labelCount: uartNet?.labels.length,
            junctionCount: uartNet?.junctions.length
        },
        {
            segmentCount: 3,
            labelCount: 1,
            junctionCount: 1
        }
    )
})

/**
 * Verifies matching power-port names create one logical net even when the
 * connected wire islands are not geometrically adjacent on the sheet.
 */
test('parseAltiumArrayBuffer merges disconnected power-port wire islands by name', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=180|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=20|Y1=40|X2=50|Y2=40',
        '|RECORD=17|Style=2|ShowNetName=T|Location.X=50|Location.Y=40|Color=128|FontID=1|Text=+V_A',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=100|Y1=80|X2=130|Y2=80',
        '|RECORD=17|Style=2|ShowNetName=T|Location.X=130|Location.Y=80|Color=128|FontID=1|Text=+V_A'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'same-power-port-net.SchDoc',
        arrayBuffer
    )
    const matchingNets = documentModel.schematic.nets.filter(
        (net) => net.name === '+V_A'
    )

    assert.equal(matchingNets.length, 1)
    assert.equal(matchingNets[0].segments.length, 2)
    assert.deepEqual(
        matchingNets[0].powerPorts.map((powerPort) => powerPort.text),
        ['+V_A', '+V_A']
    )
})

/**
 * Verifies potential tee contacts without an authored junction are reported as
 * QA warnings instead of silently changing the normalized net merge rules.
 */
test('parseAltiumArrayBuffer warns about unjunctioned tee wire contacts', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=180|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=20|Y1=50|X2=100|Y2=50',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=60|Y1=50|X2=60|Y2=80'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'unjunctioned-tee.SchDoc',
        arrayBuffer
    )
    const teeFindings = documentModel.schematic.connectivityQa.findings.filter(
        (finding) =>
            finding.code === 'schematic.connectivity.unjunctioned-tee-contact'
    )

    assert.equal(
        documentModel.schematic.connectivityQa.summary
            .unjunctionedTeeContactCount,
        1
    )
    assert.deepEqual(teeFindings, [
        {
            code: 'schematic.connectivity.unjunctioned-tee-contact',
            severity: 'warning',
            x: 60,
            y: 50,
            segmentIndex: 1,
            touchedSegmentIndex: 0
        }
    ])
    assert.equal(documentModel.schematic.nets.length, 2)
})

/**
 * Verifies unnamed schematic nets keep their stable UnknownNet name while
 * exposing deterministic aliases from connected component pins.
 */
test('parseAltiumArrayBuffer adds pin-derived aliases to unnamed schematic nets', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=180|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=10|Location.X=70|Location.Y=60|LibReference=FAKE/CONTROL-CELL|UniqueID=CMP-A',
        '|RECORD=34|OwnerIndex=10|Location.X=62|Location.Y=76|Color=8388608|FontID=1|Text=U1|Name=Designator',
        '|RECORD=41|OwnerIndex=10|Location.X=62|Location.Y=44|Color=8388608|FontID=1|Text=CONTROL-CELL|Name=Comment',
        '|RECORD=2|OwnerIndex=10|OwnerPartId=1|PinConglomerate=48|PinLength=20' +
            '|Location.X=80|Location.Y=60|Name=READY|Designator=1',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=100|Y1=60|X2=140|Y2=60'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'pin-derived-net-aliases.SchDoc',
        arrayBuffer
    )
    const net = documentModel.schematic.nets.find(
        (candidate) => candidate.name === 'UnknownNet0'
    )

    assert.equal(net?.name, 'UnknownNet0')
    assert.equal(net?.autoName, 'U1.1')
    assert.equal(net?.autoNameSource, 'component-pin')
    assert.deepEqual(net?.aliasCandidates, ['U1.1', 'U1.READY'])
    assert.deepEqual(
        net?.pins.map((pin) => ({
            componentDesignator: pin.componentDesignator,
            designator: pin.designator,
            name: pin.name
        })),
        [
            {
                componentDesignator: 'U1',
                designator: '1',
                name: 'READY'
            }
        ]
    )
})

/**
 * Verifies record-25 net labels honor their authored vertical orientation
 * instead of falling back to generic free-text rotation rules.
 */
test('parseAltiumArrayBuffer rotates orientation-3 net labels vertically', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=200|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=25|Location.X=80|Location.Y=40|Color=128|FontID=1|Orientation=3|Text=CLK_OUT'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'net-label-orientation.SchDoc',
        arrayBuffer
    )
    const netLabel = documentModel.schematic.texts.find(
        (text) => text.recordType === '25' && text.text === 'CLK_OUT'
    )

    assert.equal(netLabel?.rotation, 90)
})
