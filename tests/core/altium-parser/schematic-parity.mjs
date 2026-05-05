// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies the parser exposes first-class sheet hierarchy and authored
 * connectivity markers instead of dropping them or folding them into generic
 * line/text buckets only.
 */
test('parseAltiumArrayBuffer normalizes sheet symbols, sheet entries, junctions, and bus entries', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=320|CustomY=240|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=15|IndexInSheet=7|Location.X=80|Location.Y=180|XSize=140|YSize=90' +
            '|Color=8388608|AreaColor=8454143|IsSolid=T|UniqueId=BOX-1',
        '|RECORD=16|IndexInSheet=8|OwnerIndex=7|Name=SIG_OUT|Side=0|IOType=1|Style=2' +
            '|DistanceFromTop=3|DistanceFromTop_FRAC1=0|Color=128|AreaColor=8454143' +
            '|TextColor=128|TextFontID=1|TextStyle=Full',
        '|RECORD=29|Location.X=140|Location.Y=120|Color=255',
        '|RECORD=37|IndexInSheet=9|Location.X=40|Location.Y=80|Corner.X=60|Corner.Y=100' +
            '|Color=255|LineWidth=1'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'parity-coverage.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.sheetSymbols, [
        {
            x: 80,
            y: 180,
            width: 140,
            height: 90,
            color: '#000080',
            fill: '#ffff80',
            isSolid: true,
            transparent: false,
            ownerIndex: undefined,
            uniqueId: 'BOX-1',
            renderOrder: 7
        }
    ])
    assert.deepEqual(documentModel.schematic.sheetEntries, [
        {
            ownerIndex: '7',
            name: 'SIG_OUT',
            side: 'left',
            direction: 'output',
            style: 2,
            x: 80,
            y: 150,
            color: '#800000',
            fill: '#ffff80',
            textColor: '#800000',
            harnessType: '',
            renderOrder: 8
        }
    ])
    assert.deepEqual(documentModel.schematic.junctions, [
        {
            x: 140,
            y: 120,
            color: '#ff0000',
            renderOrder: 3
        }
    ])
    assert.deepEqual(documentModel.schematic.busEntries, [
        {
            x1: 40,
            y1: 80,
            x2: 60,
            y2: 100,
            color: '#ff0000',
            width: 1,
            renderOrder: 9
        }
    ])
})
