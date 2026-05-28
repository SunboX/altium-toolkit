// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

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
