// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies multipart designators are derived from the active component part id
 * even when the raw owner text carries a stale suffix from another section.
 */
test('parseAltiumArrayBuffer normalizes stale multipart designator suffixes', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=320|CustomY=260|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|LibReference=IC/FAKE/MULTI-UNIT|PartCount=3|IndexInSheet=10' +
            '|OwnerPartId=-1|Location.X=80|Location.Y=210|CurrentPartId=1',
        '|RECORD=34|OwnerIndex=700|OwnerPartId=-1|Location.X=80|Location.Y=220' +
            '|Color=8388608|FontID=1|Text=U9B|Name=Designator',
        '|RECORD=41|OwnerIndex=700|OwnerPartId=-1|Location.X=80|Location.Y=200' +
            '|Color=8388608|FontID=1|Text=FAKE-MULTI|Name=Value',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=58|PinLength=10' +
            '|Location.X=80|Location.Y=210|Name=A_IN|Designator=1',
        '|RECORD=1|LibReference=IC/FAKE/MULTI-UNIT|PartCount=3|IndexInSheet=20' +
            '|OwnerPartId=-1|Location.X=180|Location.Y=110|CurrentPartId=2',
        '|RECORD=34|OwnerIndex=800|OwnerPartId=-1|Location.X=180|Location.Y=120' +
            '|Color=8388608|FontID=1|Text=U9|Name=Designator',
        '|RECORD=41|OwnerIndex=800|OwnerPartId=-1|Location.X=180|Location.Y=100' +
            '|Color=8388608|FontID=1|Text=FAKE-MULTI|Name=Value',
        '|RECORD=2|OwnerIndex=800|OwnerPartId=2|PinConglomerate=58|PinLength=10' +
            '|Location.X=180|Location.Y=110|Name=B_IN|Designator=2'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBufferToRendererModel(
        'multipart-designator-demo.SchDoc',
        arrayBuffer
    )
    const designators = documentModel.schematic.texts
        .filter((text) => text.name === 'Designator')
        .map((text) => text.text)
        .sort()

    assert.deepEqual(designators, ['U9A', 'U9B'])
})

/**
 * Verifies the parser-level active owner matching uses the serialized owner
 * block for the same record objects it later filters and normalizes.
 */
test('parseAltiumArrayBuffer preserves serialized multipart owner blocks', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=620|CustomY=520|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|LibReference=IC/FAKE/MULTI-UNIT|PartCount=2|IndexInSheet=10' +
            '|OwnerPartId=-1|Location.X=100|Location.Y=100|CurrentPartId=1',
        '|RECORD=34|OwnerIndex=700|OwnerPartId=-1|Location.X=100|Location.Y=120' +
            '|Color=8388608|FontID=1|Text=U9|Name=Designator',
        '|RECORD=41|OwnerIndex=700|OwnerPartId=-1|Location.X=100|Location.Y=80' +
            '|Color=8388608|FontID=1|Text=FAKE-MULTI|Name=Value',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=58|PinLength=10' +
            '|Location.X=100|Location.Y=100|Name=A1|Designator=1',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=2|PinConglomerate=58|PinLength=10' +
            '|Location.X=200|Location.Y=200|Name=A2|Designator=2',
        '|RECORD=1|LibReference=IC/FAKE/MULTI-UNIT|PartCount=2|IndexInSheet=20' +
            '|OwnerPartId=-1|Location.X=200|Location.Y=200|CurrentPartId=2',
        '|RECORD=34|OwnerIndex=800|OwnerPartId=-1|Location.X=200|Location.Y=220' +
            '|Color=8388608|FontID=1|Text=U9|Name=Designator',
        '|RECORD=41|OwnerIndex=800|OwnerPartId=-1|Location.X=200|Location.Y=180' +
            '|Color=8388608|FontID=1|Text=FAKE-MULTI|Name=Value',
        '|RECORD=2|OwnerIndex=800|OwnerPartId=1|PinConglomerate=58|PinLength=10' +
            '|Location.X=400|Location.Y=400|Name=B1|Designator=1',
        '|RECORD=2|OwnerIndex=800|OwnerPartId=2|PinConglomerate=58|PinLength=10' +
            '|Location.X=500|Location.Y=500|Name=B2|Designator=2'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBufferToRendererModel(
        'serialized-owner-demo.SchDoc',
        arrayBuffer
    )
    const designators = documentModel.schematic.texts
        .filter((text) => text.name === 'Designator')
        .map((text) => text.text)
        .sort()
    const ownerPins = documentModel.schematic.pins
        .filter((pin) => ['700', '800'].includes(pin.ownerIndex))
        .map((pin) => ({
            ownerIndex: pin.ownerIndex,
            name: pin.name
        }))
        .sort((left, right) => left.ownerIndex.localeCompare(right.ownerIndex))

    assert.deepEqual(designators, ['U9A', 'U9B'])
    assert.deepEqual(ownerPins, [
        { ownerIndex: '700', name: 'A1' },
        { ownerIndex: '800', name: 'B2' }
    ])
})
