// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies schematic polylines continue through points whose omitted axis is
 * inherited from the preceding point.
 */
test('parseAltiumArrayBuffer carries omitted schematic polyline coordinates', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=200|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=27|LineWidth=1|Color=8388608|LocationCount=4' +
            '|X1=10|Y1=20|X2=40|Y2=20|X3=40|Y3=60|X4=80',
        '|RECORD=27|LineWidth=1|Color=8388608|LocationCount=3' +
            '|X1=90|Y1=30|X2=110|Y2=50|X3=150'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'carried-polyline-axis.SchDoc',
        arrayBuffer
    )
    const segments = documentModel.schematic.lines.map((line) => [
        line.x1,
        line.y1,
        line.x2,
        line.y2
    ])

    assert.deepEqual(segments, [
        [10, 20, 40, 20],
        [40, 20, 40, 60],
        [40, 60, 80, 60],
        [90, 30, 110, 50],
        [110, 50, 150, 50]
    ])
})

/**
 * Verifies a collapsed final wire segment can recover its omitted coordinate
 * from the nearest compatible pin endpoint.
 */
test('parseAltiumArrayBuffer extends collapsed final polyline points to pin endpoints', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=180|CustomY=460|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=33|PinLength=10' +
            '|Location.X=50|Location.Y=350|Name=1|Designator=1|Electrical=4',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=35|PinLength=10' +
            '|Location.X=50|Location.Y=330|Name=2|Designator=2|Electrical=4',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=3' +
            '|X1=90|Y1=380|X2=50|Y2=380|X3=50'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'collapsed-wire-endpoint.SchDoc',
        arrayBuffer
    )
    const segments = documentModel.schematic.lines.map((line) => [
        line.x1,
        line.y1,
        line.x2,
        line.y2
    ])

    assert.deepEqual(segments, [
        [90, 380, 50, 380],
        [50, 380, 50, 360]
    ])
})

/**
 * Verifies explicit junctions outrank unmarked crossing wires when restoring
 * a final omitted polyline axis.
 */
test('parseAltiumArrayBuffer restores omitted wire axes to authored junctions', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=760|CustomY=220|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=27|LineWidth=1|Color=8388608|LocationCount=2' +
            '|X1=370|Y1=160|X2=450|Y2=160',
        '|RECORD=27|LineWidth=1|Color=8388608|LocationCount=2' +
            '|X1=370|Y1=150|X2=450|Y2=150',
        '|RECORD=27|LineWidth=1|Color=8388608|LocationCount=3' +
            '|X1=450|Y1=140|X2=420|Y2=140|X3=420',
        '|RECORD=29|IndexInSheet=-1|Location.X=420|Location.Y=160|Color=128'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'authored-junction-axis.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const segments = documentModel.schematic.lines.map((line) => [
        line.x1,
        line.y1,
        line.x2,
        line.y2
    ])
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(segments, [
        [370, 160, 450, 160],
        [370, 150, 450, 150],
        [450, 140, 420, 140],
        [420, 140, 420, 160]
    ])
    assert.match(
        markup,
        /<circle class="schematic-authored-junction" cx="420" cy="60" r="2\.4" fill="var\(--schematic-default-ink-color\)" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<circle class="schematic-junction" cx="420" cy="70"/
    )
})

/**
 * Verifies short coordinate fragments that precede a record marker in the
 * printable stream stay attached to their record. Dropping the fragment makes
 * the final segment look collapsed and lets nearby junctions shorten it.
 */
test('parseAltiumArrayBuffer keeps leading coordinate fragments on schematic records', () => {
    const records = [
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|Y3=80|RECORD=27|LineWidth=1|Color=8388608|LocationCount=3' +
            '|X1=110|Y1=160|X2=120|Y2=160|X3=120|IndexInSheet=20',
        '|RECORD=29|IndexInSheet=-1|Location.X=120|Location.Y=150|Color=128'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'leading-coordinate-fragment.SchDoc',
        new TextEncoder().encode(records.join('\0')).buffer
    )
    const segments = documentModel.schematic.lines.map((line) => [
        line.x1,
        line.y1,
        line.x2,
        line.y2
    ])

    assert.deepEqual(segments, [
        [110, 160, 120, 160],
        [120, 160, 120, 80]
    ])
})

/**
 * Verifies paired crossed wires can recover final omitted axes from nearby pin
 * endpoints and same-axis wire continuations instead of flattening the cross.
 */
test('parseAltiumArrayBuffer preserves crossed polylines with omitted final axes', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=520|CustomY=460|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=35|PinLength=20' +
            '|Location.X=260|Location.Y=370|Name=E|Electrical=4',
        '|RECORD=2|OwnerIndex=701|OwnerPartId=1|PinConglomerate=33|PinLength=20' +
            '|Location.X=260|Location.Y=310|Name=E|Electrical=4',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2' +
            '|X1=330|Y1=300|X2=380|Y2=300',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2' +
            '|X1=380|Y1=300|X2=380|Y2=340',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=3' +
            '|X1=360|Y1=380|X2=360|Y2=350|X3=260',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=3' +
            '|X1=260|Y1=350|X2=360|Y2=330|X3=360'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'crossed-omitted-wire-axes.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const segments = documentModel.schematic.lines.map((line) => [
        line.x1,
        line.y1,
        line.x2,
        line.y2
    ])

    assert.deepEqual(segments, [
        [330, 300, 380, 300],
        [380, 300, 380, 340],
        [360, 380, 360, 350],
        [360, 350, 260, 330],
        [260, 350, 360, 330],
        [360, 330, 360, 300]
    ])
})

/**
 * Verifies crossed wires with explicit intermediate points are not rewritten
 * as omitted-coordinate recoveries just because nearby pins and junctions
 * could form a plausible diagonal.
 */
test('parseAltiumArrayBuffer keeps explicit crossed polyline elbows at source points', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=520|CustomY=460|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=35|PinLength=20' +
            '|Location.X=260|Location.Y=370|Name=E|Electrical=4',
        '|RECORD=2|OwnerIndex=701|OwnerPartId=1|PinConglomerate=33|PinLength=20' +
            '|Location.X=260|Location.Y=310|Name=E|Electrical=4',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=3' +
            '|X1=360|Y1=380|X2=360|Y2=350|X3=260|Y3=330',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=3' +
            '|X1=260|Y1=350|X2=360|Y2=330|X3=360|Y3=300',
        '|RECORD=29|IndexInSheet=-1|Location.X=360|Location.Y=380|Color=128',
        '|RECORD=29|IndexInSheet=-1|Location.X=360|Location.Y=300|Color=128'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'explicit-crossed-wire-elbows.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const segments = documentModel.schematic.lines.map((line) => [
        line.x1,
        line.y1,
        line.x2,
        line.y2
    ])

    assert.deepEqual(segments, [
        [360, 380, 360, 350],
        [360, 350, 260, 330],
        [260, 350, 360, 330],
        [360, 330, 360, 300]
    ])
})
