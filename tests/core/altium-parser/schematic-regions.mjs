import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies authored sheet overlay regions normalize as rectangular overlays
 * instead of leaking through the generic line-segment parser.
 */
test('parseAltiumArrayBuffer keeps authored sheet overlay regions out of line primitives', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=500|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=211|IndexInSheet=24|Location.X=160|Location.Y=60|Corner.X=320|Corner.Y=160' +
            '|Color=255|AreaColor=13631487' +
            '|RECORD=13|Location.X=70|Location.Y=210|Corner.X=140|Corner.Y=210|Color=128|LineWidth=1'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'sheet-overlay-region.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.regions, [
        {
            x: 160,
            y: 60,
            width: 160,
            height: 100,
            color: '#ff0000',
            fill: '#ffffcf',
            renderOrder: 24
        }
    ])
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 160 &&
                line.y1 === 60 &&
                line.x2 === 320 &&
                line.y2 === 160
        ),
        false
    )
})

/**
 * Verifies sparse A4 footer rows still recover separate sheet number, sheet
 * total, and drawn-by fields when the drawn-by row sits below the number row.
 */
test('parseAltiumArrayBuffer keeps A4 footer sheet numbering when drawn-by sits on a lower row', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=1350|CustomY=800|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=4|Location.X=1040|Location.Y=80|Color=128|FontID=2|Text=EMBER-TRIGGER Board' +
            '|RECORD=4|Location.X=1250|Location.Y=45|Color=128|FontID=1|Text=01' +
            '|RECORD=4|Location.X=1205|Location.Y=30|Color=128|FontID=1|Text=1' +
            '|RECORD=4|Location.X=1235|Location.Y=30|Color=128|FontID=1|Text=8' +
            '|RECORD=4|Location.X=1270|Location.Y=20|Color=128|FontID=1|Text=NR'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'footer-row-a4.SchDoc',
        arrayBuffer
    )

    assert.equal(
        documentModel.schematic.sheet.titleBlock.title,
        'EMBER-TRIGGER Board'
    )
    assert.equal(documentModel.schematic.sheet.titleBlock.revision, '01')
    assert.equal(documentModel.schematic.sheet.titleBlock.sheetNumber, '1')
    assert.equal(documentModel.schematic.sheet.titleBlock.sheetTotal, '8')
    assert.equal(documentModel.schematic.sheet.titleBlock.drawnBy, 'NR')
    assert.deepEqual(documentModel.schematic.sheet.titleBlock.footerHints, {
        title: {
            x: 1040,
            y: 80,
            color: '#800000',
            fontSize: 14,
            fontFamily: 'Times New Roman',
            fontWeight: 700
        },
        revision: {
            x: 1250,
            y: 45,
            color: '#800000',
            fontSize: 10,
            fontFamily: 'Times New Roman',
            fontWeight: 400
        },
        sheetNumber: {
            x: 1205,
            y: 30,
            color: '#800000',
            fontSize: 10,
            fontFamily: 'Times New Roman',
            fontWeight: 400
        },
        sheetTotal: {
            x: 1235,
            y: 30,
            color: '#800000',
            fontSize: 10,
            fontFamily: 'Times New Roman',
            fontWeight: 400
        }
    })
})
