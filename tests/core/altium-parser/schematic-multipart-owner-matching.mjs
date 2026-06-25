// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies malformed multipart placements without a serialized CurrentPartId
 * keep the wired owner part instead of rendering every symbol section.
 */
test('parseAltiumArrayBuffer infers malformed multipart placement part from wired pin endpoints', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=340|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|LibReference=IC/FAKE/SECTIONED|OwnerPartId=-1' +
            '|Location.X=220|Location.Y=230|Color=128|Name=PinUniqueId|Text=OBFUSCATED|IsHidden=T',
        '|RECORD=14|OwnerIndex=900|OwnerPartId=1|Location.X=110|Location.Y=190|Corner.X=170|Corner.Y=250|LineWidth=1|Color=128|AreaColor=11599871|IsSolid=T',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=1|PinConglomerate=56|PinLength=20|Location.X=170|Location.Y=230|Name=QUIET_A|Designator=1',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=1|PinConglomerate=56|PinLength=20|Location.X=170|Location.Y=210|Name=QUIET_B|Designator=2',
        '|RECORD=14|OwnerIndex=900|OwnerPartId=2|Location.X=200|Location.Y=190|Corner.X=260|Corner.Y=250|LineWidth=1|Color=128|AreaColor=11599871|IsSolid=T',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=2|PinConglomerate=56|PinLength=20|Location.X=260|Location.Y=230|Name=ACTIVE_A|Designator=3',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=2|PinConglomerate=56|PinLength=20|Location.X=260|Location.Y=210|Name=ACTIVE_B|Designator=4',
        '|RECORD=14|OwnerIndex=900|OwnerPartId=3|Location.X=300|Location.Y=190|Corner.X=360|Corner.Y=250|LineWidth=1|Color=128|AreaColor=11599871|IsSolid=T',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=3|PinConglomerate=56|PinLength=20|Location.X=360|Location.Y=230|Name=SPARE_A|Designator=5',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=3|PinConglomerate=56|PinLength=20|Location.X=360|Location.Y=210|Name=SPARE_B|Designator=6',
        '|RECORD=13|OwnerPartId=-1|Location.X=280|Location.Y=230|Corner.X=320|Corner.Y=230|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerPartId=-1|Location.X=280|Location.Y=210|Corner.X=320|Corner.Y=210|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerPartId=-1|Location.X=380|Location.Y=210|Corner.X=410|Corner.Y=210|LineWidth=1|Color=16711680'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBufferToRendererModel(
        'malformed-multipart-placement.SchDoc',
        arrayBuffer
    )
    const ownerPins = documentModel.schematic.pins
        .filter((pin) => pin.ownerIndex === '900')
        .map((pin) => pin.name)
        .sort((left, right) => left.localeCompare(right))
    const ownerRectangles = documentModel.schematic.rectangles.filter(
        (rectangle) => rectangle.ownerIndex === '900'
    )

    assert.deepEqual(ownerPins, ['ACTIVE_A', 'ACTIVE_B'])
    assert.equal(ownerRectangles.length, 1)
    assert.equal(ownerRectangles[0].x, 200)
})
