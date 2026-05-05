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
