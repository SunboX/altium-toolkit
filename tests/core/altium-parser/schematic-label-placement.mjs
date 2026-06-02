// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies wire labels that start at a right-facing pin endpoint move past the
 * visible pin number instead of merging into the pin label.
 */
test('parseAltiumArrayBuffer offsets right-pin wire labels past visible pin numbers', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=260|CustomY=220|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=48|PinLength=20' +
            '|Location.X=150|Location.Y=160|Name=IO|Designator=3|SymBol_Outer=34|Electrical=4',
        '|RECORD=27|LineWidth=1|Color=128|LocationCount=2|X1=170|Y1=160|X2=220|Y2=160',
        '|RECORD=25|Location.X=170|Location.Y=160|Color=8388608|FontID=1|Text=NET_A'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'right-pin-wire-label.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const wireLabel = documentModel.schematic.texts.find(
        (text) => text.text === 'NET_A'
    )

    assert.equal(wireLabel.anchor, 'start')
    assert.equal(wireLabel.y, 160)
    assert.ok(wireLabel.x >= 176)
})
