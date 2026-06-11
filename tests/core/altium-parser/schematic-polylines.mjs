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

/**
 * Verifies schematic cubic curves and wedge primitives are exposed as
 * first-class renderer model primitives instead of disappearing into raw
 * record summaries.
 */
test('parseAltiumArrayBuffer exposes schematic bezier and pie primitives', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=300|CustomY=200|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=5|OwnerIndex=51|IndexInSheet=8|LineWidth=2|LineStyle=1|Color=128|LocationCount=4' +
            '|X1=10|Y1=20|X2=30|Y2=60|X3=70|Y3=60|X4=90|Y4=20',
        '|RECORD=9|IndexInSheet=12|Location.X=150|Location.Y=90|Radius=40|SecondaryRadius=20' +
            '|StartAngle=30|EndAngle=120|Color=255|AreaColor=65535|LineWidth=3|IsSolid=T'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'curve-primitives.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(documentModel.schematic.beziers, [
        {
            points: [
                { x: 10, y: 20 },
                { x: 30, y: 60 },
                { x: 70, y: 60 },
                { x: 90, y: 20 }
            ],
            segments: [
                {
                    start: { x: 10, y: 20 },
                    control1: { x: 30, y: 60 },
                    control2: { x: 70, y: 60 },
                    end: { x: 90, y: 20 }
                }
            ],
            color: '#800000',
            width: 2,
            lineStyle: 1,
            renderOrder: 8,
            ownerIndex: '51'
        }
    ])
    assert.deepEqual(documentModel.schematic.pies, [
        {
            x: 150,
            y: 90,
            radius: 40,
            radiusY: 20,
            startAngle: 30,
            endAngle: 120,
            color: '#ff0000',
            fill: '#ffff00',
            isSolid: true,
            transparent: false,
            lineWidth: 3,
            renderOrder: 12
        }
    ])
    assert.match(markup, /class="schematic-bezier"/)
    assert.match(markup, /C 30 140 70 140 90 180/)
    assert.match(markup, /class="schematic-pie"/)
    assert.match(markup, /fill="#ffff00"/)
})

/**
 * Verifies rounded rectangles and IEEE-style schematic symbols are first-class
 * renderer primitives rather than unsupported record summaries.
 */
test('parseAltiumArrayBuffer exposes schematic rounded rectangles and IEEE symbols', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=260|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=10|UniqueID=ROUND-A|IndexInSheet=6|OwnerIndex=90|Location.X=30|Location.Y=40|Corner.X=110|Corner.Y=90' +
            '|CornerRadius=8|LineWidth=2|LineStyle=1|Color=255|AreaColor=65280|IsSolid=T',
        '|RECORD=3|UniqueID=IEEE-A|IndexInSheet=7|OwnerIndex=90|Location.X=150|Location.Y=70|Size=18' +
            '|Symbol=4|LineWidth=2|Color=128'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'shape-symbol-primitives.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(documentModel.schematic.roundedRectangles, [
        {
            x: 30,
            y: 40,
            width: 80,
            height: 50,
            radius: 8,
            color: '#ff0000',
            fill: '#00ff00',
            isSolid: true,
            transparent: false,
            lineWidth: 2,
            lineStyle: 1,
            renderOrder: 6,
            ownerIndex: '90',
            recordId: 'ROUND-A'
        }
    ])
    assert.deepEqual(documentModel.schematic.ieeeSymbols, [
        {
            x: 150,
            y: 70,
            symbol: 4,
            symbolName: 'inverter',
            size: 18,
            color: '#800000',
            lineWidth: 2,
            renderOrder: 7,
            ownerIndex: '90',
            recordId: 'IEEE-A'
        }
    ])
    assert.match(markup, /class="schematic-rounded-rectangle"/)
    assert.match(markup, /rx="8"/)
    assert.match(markup, /stroke-dasharray=/)
    assert.match(
        markup,
        /class="schematic-ieee-symbol schematic-ieee-symbol--inverter"/
    )
    assert.match(markup, /data-primitive="rounded-rectangle"/)
    assert.match(markup, /data-primitive="ieee-symbol"/)
})

/**
 * Verifies authored polyline endpoint marker metadata survives parsing and is
 * rendered as deterministic SVG marker attributes.
 */
test('parseAltiumArrayBuffer preserves schematic polyline endpoint markers', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=220|CustomY=140|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=6|IndexInSheet=7|LineWidth=1|Color=128|LocationCount=2' +
            '|X1=20|Y1=60|X2=120|Y2=60|StartLineShape=1|StartLineShapeSize=6|EndLineShape=2|EndLineShapeSize=10'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'line-markers.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const line = documentModel.schematic.lines[0]
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(line.startMarker, {
        shape: 1,
        shapeName: 'arrow',
        size: 6
    })
    assert.deepEqual(line.endMarker, {
        shape: 2,
        shapeName: 'filled-arrow',
        size: 10
    })
    assert.match(markup, /marker-start="url\(#schematic-marker-arrow-6\)"/)
    assert.match(
        markup,
        /marker-end="url\(#schematic-marker-filled-arrow-10\)"/
    )
})

/**
 * Verifies text-frame records expose their authored rectangle and typography
 * contract while still rendering through the existing note/text pathway.
 */
test('parseAltiumArrayBuffer exposes schematic text frame metadata', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=240|CustomY=160|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=12|FontName2=Arial|Bold2=T|Italic2=T|Rotation2=0',
        '|RECORD=28|IndexInSheet=4|Location.X=40|Location.Y=100|Corner.X=180|Corner.Y=40' +
            '|Text=Frame~1Body|FontID=2|TextColor=128|Color=255|AreaColor=65535|LineWidth=2' +
            '|ShowBorder=T|IsSolid=T|TextMargin=5|Justification=4'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'frame-contract.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const textFrame = documentModel.schematic.textFrames[0]
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(textFrame, {
        x: 40,
        y: 100,
        cornerX: 180,
        cornerY: 40,
        width: 140,
        height: 60,
        text: 'Frame\nBody',
        alignment: 'center',
        borderWidth: 2,
        color: '#800000',
        borderColor: '#ff0000',
        fill: '#ffff00',
        isSolid: true,
        showBorder: true,
        font: {
            size: 12,
            family: 'Arial',
            weight: 700,
            style: 'italic'
        },
        textMargin: 5,
        renderOrder: 4
    })
    assert.match(markup, /class="schematic-note-box"/)
    assert.match(markup, /stroke-width="2"/)
    assert.match(markup, /font-family="Arial"/)
    assert.match(
        markup,
        /<text class="schematic-note-text" x="110"[^>]*text-anchor="middle"/
    )
    assert.match(markup, />Frame</)
    assert.match(markup, />Body</)
})
