// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies the reduced embedded dawn-sheet fixture still produces normalized
 * ports, labels, and bus geometry.
 */
test('parseAltiumArrayBuffer parses an embedded fake SchDoc sample', async () => {
    const documentModel = await AltiumFixtureLoader.parseDawnSheet()

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(documentModel.fileType, 'SchDoc')
    assert.equal(documentModel.schematic.components.length, 0)
    assert.equal(documentModel.schematic.lines.length, 14)
    assert.equal(documentModel.schematic.texts.length, 10)
    assert.equal(documentModel.schematic.ports.length, 5)
    assert.equal(
        documentModel.schematic.lines.filter((line) => line.isBus).length,
        2
    )
    assert.equal(documentModel.bom.length, 0)
    assert.equal(documentModel.summary.title, 'SKYLACE-ARC')
})

/**
 * Verifies native-style uppercase schematic fields normalize through the same
 * parser path as mixed-case fake records.
 */
test('parseAltiumArrayBuffer accepts uppercase schematic field keys', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=200|CUSTOMY=120|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=F|TITLEBLOCKON=F|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=13|LOCATION.X=20|LOCATION.Y=40|CORNER.X=90|CORNER.Y=40' +
            '|LINEWIDTH=1|COLOR=128|INDEXINSHEET=1' +
            '|RECORD=2|OWNERINDEX=700|OWNERPARTID=1|PINCONGLOMERATE=58|PINLENGTH=20' +
            '|LOCATION.X=120|LOCATION.Y=60|NAME=RUNE_A|DESIGNATOR=1|COLOR=255' +
            '|RECORD=41|LOCATION.X=140|LOCATION.Y=70|COLOR=8388608|FONTID=1' +
            '|TEXT=GLYPH_A|NAME=Designator|OWNERINDEX=700'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'uppercase-fields.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.width, 200)
    assert.equal(documentModel.schematic.lines.length, 1)
    assert.equal(documentModel.schematic.pins.length, 1)
    assert.equal(documentModel.schematic.texts.length, 1)
    assert.deepEqual(documentModel.schematic.lines[0], {
        x1: 20,
        y1: 40,
        x2: 90,
        y2: 40,
        color: '#800000',
        width: 1,
        lineStyle: 0,
        recordType: '13',
        renderOrder: 1,
        ownerIndex: undefined
    })
    assert.equal(documentModel.schematic.pins[0].name, 'RUNE_A')
    assert.equal(documentModel.schematic.texts[0].text, 'GLYPH_A')
})

/**
 * Verifies fields recovered before the marker key remain attached to their
 * owning record instead of becoming orphan printable fragments.
 */
test('parseAltiumArrayBuffer preserves fields before record markers', () => {
    const arrayBuffer = new TextEncoder().encode(
        [
            '|HEADER=Schematic Document',
            '|FONTNAME1=Times New Roman|SIZE1=10|BORDERON=T|CUSTOMX=300' +
                '|RECORD=31|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
                '|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4|FONTIDCOUNT=1',
            '|X4=20|Y4=30|X1=20|Y1=80' +
                '|RECORD=7|LOCATIONCOUNT=4|X2=80|Y2=80|X3=80|Y3=30' +
                '|COLOR=128|AREACOLOR=16776960|ISSOLID=T|LINEWIDTH=1'
        ].join('\u0000')
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'marker-prefix-fields.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.width, 300)
    assert.equal(documentModel.schematic.sheet.borderOn, true)
    assert.equal(
        documentModel.schematic.sheet.fonts['1'].family,
        'Times New Roman'
    )
    assert.deepEqual(documentModel.schematic.polygons[0].points, [
        { x: 20, y: 80 },
        { x: 80, y: 80 },
        { x: 80, y: 30 },
        { x: 20, y: 30 }
    ])
})

/**
 * Verifies visible template placeholders render after metadata resolution,
 * while internal component and directive parameters stay hidden.
 */
test('parseAltiumArrayBuffer renders visible placeholders without internal parameters', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=300|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=T|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=41|NAME=Title|TEXT=RUNE BOARD|ISHIDDEN=T' +
            '|RECORD=4|LOCATION.X=20|LOCATION.Y=150|COLOR=8388608|FONTID=1|TEXT==Title' +
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=120|NAME=PinUniqueId|TEXT=HIDDEN_PIN_KEY|FONTID=1' +
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=110|NAME=Vendor|TEXT=HIDDEN_VENDOR|FONTID=1' +
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=100|NAME=IC|TEXT=HIDDEN_DEVICE|FONTID=1' +
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=90|NAME=DifferentialPair|TEXT=True|FONTID=1' +
            '|RECORD=41|LOCATION.X=80|LOCATION.Y=70|NAME=Comment|TEXT=VISIBLE_VALUE|FONTID=1'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'visible-placeholder.SchDoc',
        arrayBuffer
    )
    const visibleTexts = documentModel.schematic.texts.map((text) => text.text)

    assert.equal(visibleTexts.includes('RUNE BOARD'), true)
    assert.equal(visibleTexts.includes('VISIBLE_VALUE'), true)
    assert.equal(visibleTexts.includes('HIDDEN_PIN_KEY'), false)
    assert.equal(visibleTexts.includes('HIDDEN_VENDOR'), false)
    assert.equal(visibleTexts.includes('HIDDEN_DEVICE'), false)
    assert.equal(visibleTexts.includes('True'), false)
})

/**
 * Verifies extended Altium line styles survive parsing and render as a
 * dash-dot frame rather than a solid outline.
 */
test('renderSchematicSvg renders extended dash-dot schematic line style', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=300|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=F|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=6|LOCATIONCOUNT=2|X1=20|Y1=150|X2=240|Y2=150' +
            '|COLOR=8323857|LINEWIDTH=2|LINESTYLEEXT=3|INDEXINSHEET=2'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'dash-dot-line.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(documentModel.schematic.lines[0].lineStyle, 3)
    assert.match(markup, /stroke-dasharray="16 10 3 10" stroke-linecap="round"/)
})

/**
 * Verifies wrapped record-28 note boxes stay in the text model and do not
 * leak into the line model as a diagonal location-to-corner segment.
 */
test('parseAltiumArrayBuffer keeps record-28 notes out of schematic lines', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=200|CustomY=100|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=28|Location.X=20|Location.Y=20|Corner.X=120|Corner.Y=60' +
            '|AreaColor=16777215|TextColor=255|FontID=1|IsSolid=T|Alignment=1|WordWrap=T|ClipToRect=T' +
            '|Text=*NOTE:~11)Alpha~12)Beta'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'wrapped-note.SchDoc',
        arrayBuffer
    )
    const note = documentModel.schematic.texts.find(
        (text) => text.recordType === '28'
    )

    assert.ok(note)
    assert.equal(documentModel.schematic.lines.length, 0)
    assert.equal(note.color, '#ff0000')
    assert.deepEqual(note.noteLines, ['*NOTE:', '1)Alpha', '2)Beta'])
    assert.equal(note.cornerX, 120)
    assert.equal(note.cornerY, 60)
})

/**
 * Verifies standard-style A3 sheets keep the footer value hints needed to
 * position the synthesized title block like the source page footer.
 */
test('parseAltiumArrayBuffer keeps standard A3 footer title-block hints', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|SheetStyle=1|CustomX=1654|CustomY=1169|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=41|Name=Title|Text=EMBER-UNIT|IsHidden=T' +
            '|RECORD=4|Location.X=1225|Location.Y=75|Color=8388608|FontID=2|Text=EMBER-UNIT Power' +
            '|RECORD=4|Location.X=1420|Location.Y=80|Color=255|FontID=2|Text=CORE-MOD' +
            '|RECORD=4|Location.X=1455|Location.Y=50|Color=8388608|FontID=1|Text=03' +
            '|RECORD=4|Location.X=1405|Location.Y=30|Color=8388608|FontID=1|Text=2' +
            '|RECORD=4|Location.X=1435|Location.Y=30|Color=8388608|FontID=1|Text=7'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'footer-hints.SchDoc',
        arrayBuffer
    )
    const titleBlock = documentModel.schematic.sheet.titleBlock

    assert.equal(documentModel.schematic.sheet.xZones, 8)
    assert.equal(titleBlock.title, 'EMBER-UNIT Power')
    assert.equal(titleBlock.documentNumber, 'CORE-MOD')
    assert.equal(titleBlock.revision, '03')
    assert.equal(titleBlock.sheetNumber, '2')
    assert.equal(titleBlock.sheetTotal, '7')
    assert.deepEqual(titleBlock.footerHints.title, {
        x: 1225,
        y: 75,
        color: '#000080',
        fontSize: 14,
        fontFamily: 'Times New Roman',
        fontWeight: 700
    })
    assert.deepEqual(titleBlock.footerHints.documentNumber, {
        x: 1420,
        y: 80,
        color: '#ff0000',
        fontSize: 14,
        fontFamily: 'Times New Roman',
        fontWeight: 700
    })
    assert.deepEqual(titleBlock.footerHints.revision, {
        x: 1455,
        y: 50,
        color: '#000080',
        fontSize: 10,
        fontFamily: 'Times New Roman',
        fontWeight: 400
    })
})

/**
 * Verifies footer placeholders resolve through hidden sheet metadata and a
 * visible bottom-row signature populates the synthesized `Drawn By` field.
 */
test('parseAltiumArrayBuffer resolves footer placeholders and visible drawn-by values', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=1500|CustomY=950|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=41|Name=Title|Text=EMBER-UNIT Power|IsHidden=T' +
            '|RECORD=41|Name=Revision|Text=03|IsHidden=T' +
            '|RECORD=41|Name=DrawnBy|Text=*|IsHidden=T' +
            '|RECORD=4|Location.X=1900|Location.Y=90|Color=8388608|FontID=2|Text==title' +
            '|RECORD=4|Location.X=2130|Location.Y=90|Color=255|FontID=2|Text=CORE-MOD' +
            '|RECORD=4|Location.X=2125|Location.Y=60|Color=8388608|FontID=1|Text==revision' +
            '|RECORD=4|Location.X=2075|Location.Y=40|Color=8388608|FontID=1|Text=8' +
            '|RECORD=4|Location.X=2105|Location.Y=40|Color=8388608|FontID=1|Text=8' +
            '|RECORD=4|Location.X=2125|Location.Y=30|Color=8388608|FontID=1|Text=OR'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'resolved-footer-placeholders.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.sheet.titleBlock, {
        title: 'EMBER-UNIT Power',
        revision: '03',
        documentNumber: 'CORE-MOD',
        sheetNumber: '8',
        sheetTotal: '8',
        date: '',
        drawnBy: 'OR',
        footerHints: {
            title: {
                x: 1900,
                y: 90,
                color: '#000080',
                fontSize: 14,
                fontFamily: 'Times New Roman',
                fontWeight: 700
            },
            documentNumber: {
                x: 2130,
                y: 90,
                color: '#ff0000',
                fontSize: 14,
                fontFamily: 'Times New Roman',
                fontWeight: 700
            },
            revision: {
                x: 2125,
                y: 60,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            },
            sheetNumber: {
                x: 2075,
                y: 40,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            },
            sheetTotal: {
                x: 2105,
                y: 40,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            }
        }
    })
})

/**
 * Verifies Altium schematic colors, title typography, and synthesized
 * connector notes are normalized from the moon-sheet fixture.
 */
test('parseAltiumArrayBuffer decodes moon sheet colors and wires', async () => {
    const documentModel = await AltiumFixtureLoader.parseMoonSheet()

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'Zephyr Node' && text.color === '#000080'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'WYRN' &&
                Math.abs(text.fontSize - 22) < 0.02 &&
                text.anchor === 'start'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'AURA_3V3' &&
                text.recordType === '17' &&
                text.style === 2 &&
                text.rotation === 0 &&
                text.anchor === 'middle'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'WYRN' && text.rotation === 90
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'SIGIL12' &&
                text.rotation === 90 &&
                text.anchor === 'start'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 175 &&
                line.y1 === 545 &&
                line.x2 === 175 &&
                line.y2 === 555 &&
                line.color === '#000080'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some((text) => text.text === '=title'),
        false
    )
    assert.equal(
        documentModel.schematic.texts.some((text) =>
            /@DESIGNATOR|INITIAL VOLTAGE/i.test(text.text)
        ),
        false
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.name === 'EN' &&
                pin.designator === '3' &&
                pin.orientation === 'left' &&
                pin.x === 455 &&
                pin.y === 545 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) => pin.x === 300 && pin.y === 230
        ),
        false
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.x === 950 &&
                pin.y === 530 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.deepEqual(documentModel.schematic.sheet.titleBlock, {
        title: 'SKYLACE-ARC',
        revision: '01',
        documentNumber: '',
        sheetNumber: '4',
        sheetTotal: '6',
        date: '',
        drawnBy: '',
        footerHints: {
            sheetNumber: {
                x: 1005,
                y: 30,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            },
            sheetTotal: {
                x: 1025,
                y: 30,
                color: '#000080',
                fontSize: 10,
                fontFamily: 'Times New Roman',
                fontWeight: 400
            }
        }
    })
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '296' &&
                pin.name === 'A' &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '322' &&
                pin.name === 'A' &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '1231' &&
                pin.x === 695 &&
                pin.y === 535 &&
                pin.orientation === 'left' &&
                pin.labelMode === 'hidden'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '638' &&
                pin.x === 175 &&
                pin.y === 535 &&
                pin.orientation === 'top' &&
                pin.labelMode === 'hidden'
        ),
        true
    )
    assert.equal(documentModel.schematic.sheet.xZones, 4)
    assert.equal(documentModel.schematic.sheet.yZones, 4)
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'SKYLACE-ARC' || text.text === '01'
        ),
        false
    )
    assert.equal(
        documentModel.schematic.crosses.some(
            (cross) =>
                cross.x === 990 && cross.y === 530 && cross.color === '#ff0000'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.ports.some(
            (port) =>
                port.name === 'RUNE_CTL' &&
                port.x === 680 &&
                port.y === 495 &&
                port.width === 60 &&
                port.height === 10
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.filter(
            (text) => text.text === 'RUNE HEADER P2.54 2X3P VERTICAL L=30.5'
        ).length,
        1
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'RUNE_CTL' || text.text === 'RUNE_FLOW'
        ),
        false
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 690 &&
                line.y1 === 427 &&
                line.x2 === 690 &&
                line.y2 === 425
        ),
        false
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 697 &&
                line.y1 === 535 &&
                line.x2 === 695 &&
                line.y2 === 535
        ),
        true
    )
    assert.deepEqual(
        documentModel.schematic.components
            .filter((component) =>
                [
                    [255, 215],
                    [225, 270],
                    [950, 540],
                    [455, 595]
                ].some(([x, y]) => component.x === x && component.y === y)
            )
            .map((component) => ({
                x: component.x,
                y: component.y,
                designator: component.designator
            }))
            .sort((left, right) => left.x - right.x || left.y - right.y),
        [
            { x: 225, y: 270, designator: 'SIGIL12' },
            { x: 255, y: 215, designator: 'GLINT94' },
            { x: 455, y: 595, designator: 'WYRN6' },
            { x: 950, y: 540, designator: 'PORT6' }
        ]
    )
})

/**
 * Verifies rotated schematic texts preserve their raw Altium orientation so
 * the renderer can distinguish opposite vertical reading directions.
 */
test('parseAltiumArrayBuffer preserves rotated text source orientation', async () => {
    const moonDocument = await AltiumFixtureLoader.parseMoonSheet()
    const cinderDocument = await AltiumFixtureLoader.parseCinderSheet()
    const sigil12Text = moonDocument.schematic.texts.find(
        (text) => text.text === 'SIGIL12'
    )
    const jtag = moonDocument.schematic.texts.find(
        (text) => text.text === 'WYRN'
    )
    const sigil24Text = cinderDocument.schematic.texts.find(
        (text) => text.text === 'SIGIL24'
    )
    const sigil24Value = cinderDocument.schematic.texts.find(
        (text) => text.text === '4K7' && text.ownerIndex === '3652'
    )

    assert.deepEqual(
        {
            text: sigil12Text?.text,
            rotation: sigil12Text?.rotation,
            sourceOrientation: sigil12Text?.sourceOrientation
        },
        {
            text: 'SIGIL12',
            rotation: 90,
            sourceOrientation: 1
        }
    )
    assert.deepEqual(
        {
            text: jtag?.text,
            rotation: jtag?.rotation,
            sourceOrientation: jtag?.sourceOrientation
        },
        {
            text: 'WYRN',
            rotation: 90,
            sourceOrientation: 1
        }
    )
    assert.deepEqual(
        {
            text: sigil24Text?.text,
            rotation: sigil24Text?.rotation,
            sourceOrientation: sigil24Text?.sourceOrientation
        },
        {
            text: 'SIGIL24',
            rotation: 90,
            sourceOrientation: 3
        }
    )
    assert.deepEqual(
        {
            text: sigil24Value?.text,
            rotation: sigil24Value?.rotation,
            sourceOrientation: sigil24Value?.sourceOrientation
        },
        {
            text: '4K7',
            rotation: 90,
            sourceOrientation: 3
        }
    )
})
