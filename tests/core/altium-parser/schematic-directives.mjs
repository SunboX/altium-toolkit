// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

const DIRECTIVE_RECORDS = [
    '|HEADER=Schematic Document',
    '|RECORD=31|CustomX=400|CustomY=240|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
    '|RECORD=22|IndexInSheet=5|Location.X=40|Location.Y=50|Color=255|Orientation=1|Symbol=2',
    '|RECORD=43|IndexInSheet=10|Location.X=120|Location.Y=160|Color=255|Orientation=1|Name=DiffPairRouting',
    '|RECORD=41|OwnerIndex=10|Name=DifferentialPair|Text=True|IsHidden=T',
    '|RECORD=41|OwnerIndex=10|Name=ClassName|Text=PAIR_CLASS|IsHidden=T',
    '|RECORD=43|IndexInSheet=11|Location.X=128|Location.Y=160|Color=255|Name=DIFFPAIR',
    '|RECORD=211|IndexInSheet=20|Location.X=20|Location.Y=30|Corner.X=80|Corner.Y=70' +
        '|Color=16711680|AreaColor=65535|IsSolid=T',
    '|RECORD=225|IndexInSheet=30|LocationCount=4|X1=260|Y1=120|X2=320|Y2=120' +
        '|X3=320|Y3=170|X4=260|Y4=170|Color=128|AreaColor=16777215|IsSolid=F',
    '|RECORD=18|Location.X=210|Location.Y=160|Width=60|Height=10|IOType=3|Alignment=1' +
        '|Color=128|TextColor=128|AreaColor=8454143|Name=PAIR_A_N',
    '|RECORD=18|Location.X=210|Location.Y=140|Width=60|Height=10|IOType=3|Alignment=2' +
        '|Color=128|TextColor=128|AreaColor=8454143|Name=PAIR_A_P',
    '|RECORD=18|Location.X=150|Location.Y=190|Width=70|Height=10|Color=128' +
        '|TextColor=128|AreaColor=8454143|Name=CORE_5V',
    '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=80|Location.Y=140|Corner.X=140|Corner.Y=140' +
        '|LineWidth=1|Color=16711680',
    '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=1|PinConglomerate=58' +
        '|PinLength=20|Location.X=80|Location.Y=140|Name=SIG_A|Designator=1',
    '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=1|PinConglomerate=56' +
        '|PinLength=20|Location.X=140|Location.Y=140|Name=SIG_B|Designator=2'
]

/**
 * Verifies Altium directive records, bidirectional ports, and directional pin
 * metadata stay available for downstream schematic rendering.
 */
test('parseAltiumArrayBuffer keeps directive records, port shapes, and electrical pin markers', () => {
    const arrayBuffer = new TextEncoder().encode(
        DIRECTIVE_RECORDS.join('')
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'directive-port-shapes.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.directives, [
        {
            x: 120,
            y: 160,
            color: '#ff0000',
            name: 'DiffPairRouting',
            orientation: 1
        },
        {
            x: 128,
            y: 160,
            color: '#ff0000',
            name: 'DIFFPAIR',
            orientation: 0
        }
    ])
    assert.deepEqual(documentModel.schematic.directiveSemantics.noErc, [
        {
            recordId: 'record-5',
            recordType: '22',
            recordIndex: 1,
            indexInSheet: 5,
            x: 40,
            y: 50,
            color: '#ff0000',
            orientation: 1,
            symbol: 2,
            symbolName: 'cross'
        }
    ])
    assert.deepEqual(
        documentModel.schematic.directiveSemantics.parameterSets.map(
            (directive) => ({
                name: directive.name,
                parameters: directive.parameters,
                parameterMap: directive.parameterMap,
                isDifferentialPair: directive.isDifferentialPair,
                differentialPairClassName: directive.differentialPairClassName
            })
        ),
        [
            {
                name: 'DiffPairRouting',
                parameters: [
                    {
                        name: 'DifferentialPair',
                        value: 'True',
                        isHidden: true,
                        ownerIndex: '10'
                    },
                    {
                        name: 'ClassName',
                        value: 'PAIR_CLASS',
                        isHidden: true,
                        ownerIndex: '10'
                    }
                ],
                parameterMap: {
                    DifferentialPair: 'True',
                    ClassName: 'PAIR_CLASS'
                },
                isDifferentialPair: true,
                differentialPairClassName: 'PAIR_CLASS'
            },
            {
                name: 'DIFFPAIR',
                parameters: [],
                parameterMap: {},
                isDifferentialPair: true,
                differentialPairClassName: ''
            }
        ]
    )
    assert.deepEqual(
        documentModel.schematic.directiveSemantics.differentialPairs.map(
            (directive) => directive.name
        ),
        ['DiffPairRouting', 'DIFFPAIR']
    )
    assert.deepEqual(
        documentModel.schematic.directiveSemantics.compileMasks.map((mask) => ({
            recordId: mask.recordId,
            x: mask.x,
            y: mask.y,
            width: mask.width,
            height: mask.height,
            fillColor: mask.fillColor
        })),
        [
            {
                recordId: 'record-20',
                x: 20,
                y: 30,
                width: 60,
                height: 40,
                fillColor: '#ffff00'
            }
        ]
    )
    assert.deepEqual(
        documentModel.schematic.directiveSemantics.blankets.map((blanket) => ({
            recordId: blanket.recordId,
            pointCount: blanket.points.length,
            isSolid: blanket.isSolid
        })),
        [
            {
                recordId: 'record-30',
                pointCount: 4,
                isSolid: false
            }
        ]
    )
    assert.deepEqual(
        documentModel.schematic.ports.map((port) => ({
            name: port.name,
            shape: port.shape
        })),
        [
            { name: 'PAIR_A_N', shape: 'double' },
            { name: 'PAIR_A_P', shape: 'double' },
            { name: 'CORE_5V', shape: 'plain' }
        ]
    )
    assert.deepEqual(
        documentModel.schematic.pins.map((pin) => ({
            name: pin.name,
            electrical: pin.electrical
        })),
        [
            { name: 'SIG_A', electrical: 1 },
            { name: 'SIG_B', electrical: 1 }
        ]
    )
})
