// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies closed owner polygons restore a missing final axis from the first
 * point when carrying the previous point would collapse the final side.
 */
test('parseAltiumArrayBuffer closes owner polygon points with omitted final axis', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=240|CustomY=220|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=7|OwnerIndex=700|OwnerPartId=1|IndexInSheet=1|LineWidth=1' +
            '|Color=16711680|AreaColor=16711680|IsSolid=T|LocationCount=4' +
            '|X1=120|Y1=180|X2=120|Y2=160|X3=122|Y3=160|X4=122'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'closed-owner-polygon-axis.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const ownerPolygon = documentModel.schematic.polygons[0]
    const ownerLines = documentModel.schematic.lines.filter(
        (line) => line.ownerIndex === '700'
    )

    assert.deepEqual(ownerPolygon.points, [
        { x: 120, y: 180 },
        { x: 120, y: 160 },
        { x: 122, y: 160 },
        { x: 122, y: 180 }
    ])
    assert.deepEqual(
        ownerLines.map((line) => [line.x1, line.y1, line.x2, line.y2]),
        [
            [120, 180, 120, 160],
            [120, 160, 122, 160],
            [122, 160, 122, 180],
            [122, 180, 120, 180]
        ]
    )
})

/**
 * Verifies ownerless callout leaders snap to their dashed frame and arrowheads
 * keep Altium's black drawing defaults when no color fields exist.
 */
test('parseAltiumArrayBuffer restores ownerless callout arrow defaults', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=1120|CustomY=700|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=6|LineStyle=1|LineStyleExt=1|LineWidth=1|LocationCount=5' +
            '|X1=1060|Y1=620|X2=910|Y2=620|X3=910|Y3=640|X4=1060|Y5=620|X5=1060',
        '|RECORD=6|LineStyle=1|LineStyleExt=1|LineWidth=1|LocationCount=2' +
            '|X1=900|Y1=610|X2=910',
        '|RECORD=7|LineWidth=1|IsSolid=T|LocationCount=3' +
            '|X1=900|Y1=610|X2=904|Y2=617|X3=907'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'ownerless-callout-arrow.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const arrowPolygon = documentModel.schematic.polygons[0]
    const segments = documentModel.schematic.lines.map((line) => [
        line.x1,
        line.y1,
        line.x2,
        line.y2,
        line.color
    ])

    assert.deepEqual(arrowPolygon, {
        points: [
            { x: 900, y: 610 },
            { x: 905, y: 618.75 },
            { x: 908.75, y: 615 }
        ],
        color: '#000000',
        fill: '#000000',
        isSolid: true,
        transparent: false,
        lineWidth: 0.85,
        renderOrder: 0,
        ownerIndex: undefined
    })
    assert.deepEqual(segments, [
        [1060, 620, 910, 620, '#000000'],
        [910, 620, 910, 640, '#000000'],
        [910, 640, 1060, 640, '#000000'],
        [1060, 640, 1060, 620, '#000000'],
        [900, 610, 910, 620, '#000000'],
        [900, 610, 905, 618.75, '#000000'],
        [905, 618.75, 908.75, 615, '#000000'],
        [908.75, 615, 900, 610, '#000000']
    ])
})
