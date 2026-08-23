// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies recovered moon-sheet geometry occupies a reasonable share of
 * the parsed page size so the rendered sheet does not appear undersized.
 */
test('parseAltiumArrayBuffer infers a tight-enough moon sheet size', async () => {
    const documentModel = await AltiumFixtureLoader.parseMoonSheet()
    assert.equal(documentModel.schematic.sheet.paperSize, 'A4')
    assert.equal(documentModel.schematic.sheet.width, 1169)
    assert.equal(documentModel.schematic.sheet.height, 827)
})

/**
 * Verifies larger recovered pages snap to the next matching ISO paper size
 * instead of shrinking tightly to visible geometry.
 */
test('parseAltiumArrayBuffer resolves the sample dawn sheet to A3', async () => {
    const documentModel = await AltiumFixtureLoader.parseDawnSheet()

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1654)
    assert.equal(documentModel.schematic.sheet.height, 1169)
})

/**
 * Verifies standard-style sheets still snap to the footer-implied A3 page
 * even when the visible schematic content stops well left of the title block.
 */
test('parseAltiumArrayBuffer keeps footer-driven A3 sizing when content is narrower than the footer', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|SheetStyle=1|CustomX=1500|CustomY=950|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=4|Location.X=1262|Location.Y=1017|Color=8388608|FontID=1|Text=SIG_OUT' +
            '|RECORD=4|Location.X=1225|Location.Y=75|Color=8388608|FontID=2|Text=EMBER-UNIT Power' +
            '|RECORD=4|Location.X=1420|Location.Y=80|Color=255|FontID=2|Text=CORE-MOD' +
            '|RECORD=4|Location.X=1455|Location.Y=50|Color=8388608|FontID=1|Text=03' +
            '|RECORD=4|Location.X=1405|Location.Y=30|Color=8388608|FontID=1|Text=2' +
            '|RECORD=4|Location.X=1435|Location.Y=30|Color=8388608|FontID=1|Text=7'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'footer-width-bias.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1654)
    assert.equal(documentModel.schematic.sheet.height, 1169)
    assert.equal(documentModel.schematic.sheet.xZones, 8)
    assert.equal(documentModel.schematic.sheet.sourceWidth, 1500)
    assert.equal(documentModel.schematic.sheet.sourceHeight, 950)
})

/**
 * Verifies portrait standard sheets derive their zone rows from the resolved
 * ISO page orientation when the source omits explicit zone fields.
 */
test('parseAltiumArrayBuffer derives portrait standard sheet zone rows', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|SheetStyle=1|CustomX=1169|CustomY=1654|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=F|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|TemplateFileName=C:\\\\Templates\\\\A3_FAKE_portrait.SchDot' +
            '|RECORD=4|Location.X=1050|Location.Y=1614|Color=8388608|FontID=1|Text=EDGE'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'portrait-standard-zones.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1169)
    assert.equal(documentModel.schematic.sheet.height, 1654)
    assert.equal(documentModel.schematic.sheet.xZones, 4)
    assert.equal(documentModel.schematic.sheet.yZones, 8)
})

/**
 * Verifies portrait standard templates keep their native coordinate frame
 * when the stored dimensions are landscape-ordered.
 */
test('parseAltiumArrayBuffer swaps native portrait template dimensions', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|SheetStyle=1|WorkspaceOrientation=1|CustomX=1550|CustomY=1110' +
            '|VisibleGridSize=10|SnapGridSize=5|BorderOn=T|TitleBlockOn=F' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|TemplateFileName=C:\\\\Templates\\\\A3_FAKE_portrait.SchDot' +
            '|RECORD=209|Location.X=373|Location.Y=1481|Corner.X=739|Corner.Y=1516' +
            '|FontID=1|Color=8388608|Text=FAKE SECTION' +
            '|RECORD=6|Location.X=20|Location.Y=20|Corner.X=1090|Corner.Y=20|Color=128'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'native-portrait-frame.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1110)
    assert.equal(documentModel.schematic.sheet.height, 1550)
    assert.equal(documentModel.schematic.sheet.sourceWidth, 1110)
    assert.equal(documentModel.schematic.sheet.sourceHeight, 1550)
    assert.equal(documentModel.schematic.sheet.xZones, 4)
    assert.equal(documentModel.schematic.sheet.yZones, 8)
})

/**
 * Verifies standard template graphics can define a native landscape frame
 * that is smaller than the promoted ISO page envelope.
 */
test('parseAltiumArrayBuffer derives native landscape template dimensions', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|SheetStyle=1|CustomX=1000|CustomY=800' +
            '|VisibleGridSize=10|SnapGridSize=5|BorderOn=T|TitleBlockOn=F' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|TemplateFileName=C:\\\\Templates\\\\A3_FAKE.SchDot' +
            '|RECORD=209|Location.X=606|Location.Y=1047|Corner.X=974|Corner.Y=1082' +
            '|FontID=1|Color=8388608|Text=FAKE SECTION' +
            '|RECORD=6|Location.X=1070|Location.Y=30|Corner.X=1530|Corner.Y=30|Color=128'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'native-landscape-frame.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1550)
    assert.equal(documentModel.schematic.sheet.height, 1110)
    assert.equal(documentModel.schematic.sheet.sourceWidth, 1550)
    assert.equal(documentModel.schematic.sheet.sourceHeight, 1110)
    assert.equal(documentModel.schematic.sheet.xZones, 8)
    assert.equal(documentModel.schematic.sheet.yZones, 4)
})

/**
 * Verifies native footer linework that reaches the recovered custom sheet
 * edge does not receive an extra right margin during sheet-width inference.
 */
test('parseAltiumArrayBuffer keeps native footer linework on the frame edge', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=1000|CustomY=760|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=4|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=6|OwnerIndex=1|Location.X=660|Location.Y=80|Corner.X=1130|Corner.Y=80|LineWidth=1|Color=128' +
            '|RECORD=6|OwnerIndex=1|Location.X=660|Location.Y=105|Corner.X=1130|Corner.Y=105|LineWidth=1|Color=128' +
            '|RECORD=6|Location.X=120|Location.Y=760|Corner.X=160|Corner.Y=760|LineWidth=1|Color=128' +
            '|RECORD=4|Location.X=720|Location.Y=90|Color=8388608|FontID=1|Text=Neutral footer'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'native-footer-edge.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.width, 1150)
    assert.equal(documentModel.schematic.sheet.height, 800)
    assert.equal(documentModel.schematic.sheet.sourceWidth, 1000)
    assert.equal(documentModel.schematic.sheet.sourceHeight, 760)
})

/**
 * Verifies custom-style sheets keep their declared page size even when the
 * visible drawing occupies only one smaller region of the authored page.
 */
test('parseAltiumArrayBuffer keeps declared custom sheet size for non-standard style sheets', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=1500|CustomY=950|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=4|Location.X=760|Location.Y=511|Color=8388608|FontID=1|Text=USB_D_N' +
            '|RECORD=18|Location.X=816|Location.Y=511|Name=USB_D_N|Width=65|Height=10|Color=8388608|AreaColor=65535'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'custom-sheet-size.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.width, 1500)
    assert.equal(documentModel.schematic.sheet.height, 950)
    assert.equal(documentModel.schematic.sheet.sourceWidth, 1500)
    assert.equal(documentModel.schematic.sheet.sourceHeight, 950)
    assert.equal(documentModel.schematic.sheet.xZones, 4)
    assert.equal(documentModel.schematic.sheet.yZones, 4)
})

/**
 * Verifies custom-style sheets fall back to the next fitting standard page
 * when authored geometry overruns the declared custom page envelope.
 */
test('parseAltiumArrayBuffer promotes overflowing custom sheets to the next fitting standard page', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|SheetStyle=2|CustomX=1500|CustomY=950|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=13|Location.X=140|Location.Y=60|Corner.X=2135|Corner.Y=1532|Color=8388608|LineWidth=1' +
            '|RECORD=4|Location.X=1900|Location.Y=90|Color=8388608|FontID=2|Text=SKYLACE-CINDER' +
            '|RECORD=4|Location.X=2130|Location.Y=90|Color=255|FontID=2|Text=SIGIL-VAULT' +
            '|RECORD=4|Location.X=2125|Location.Y=60|Color=8388608|FontID=1|Text=01'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'overflowing-custom-sheet.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A2')
    assert.equal(documentModel.schematic.sheet.width, 2339)
    assert.equal(documentModel.schematic.sheet.height, 1654)
    assert.equal(documentModel.schematic.sheet.sourceWidth, 1500)
    assert.equal(documentModel.schematic.sheet.sourceHeight, 950)
    assert.equal(documentModel.schematic.sheet.xZones, 8)
    assert.equal(documentModel.schematic.sheet.yZones, 4)
})

/**
 * Verifies dawn-sheet off-sheet ports keep the same pointed side Altium uses
 * when explicit port style is omitted from the stored record.
 */
test('parseAltiumArrayBuffer infers dawn-sheet port direction from connectivity', async () => {
    const documentModel = await AltiumFixtureLoader.parseDawnSheet()
    const resolveDirection = (name) =>
        documentModel.schematic.ports.find((port) => port.name === name)
            ?.direction

    assert.equal(resolveDirection('AURA_RST'), 'left')
    assert.equal(resolveDirection('SIGIL_SEL'), 'left')
    assert.equal(resolveDirection('EMBER_RST'), 'left')
    assert.equal(resolveDirection('EMBER_SENSE'), 'right')
})

/**
 * Verifies style-4 off-sheet ports preserve their vertical up/down direction
 * so the renderer can rotate the callout geometry instead of forcing a
 * horizontal left/right symbol.
 */
test('parseAltiumArrayBuffer infers vertical style-4 port direction from connectivity', async () => {
    const dawnDocument = await AltiumFixtureLoader.parseDawnSheet()
    const cinderDocument = await AltiumFixtureLoader.parseCinderSheet()
    const mc1 = dawnDocument.schematic.ports.find(
        (port) => port.name === 'GLYPH_1' && port.x === 475 && port.y === 150
    )
    const mc0 = cinderDocument.schematic.ports.find(
        (port) => port.name === 'GLYPH_0' && port.x === 910 && port.y === 650
    )

    assert.deepEqual(
        {
            x: mc1?.x,
            y: mc1?.y,
            width: mc1?.width,
            height: mc1?.height,
            direction: mc1?.direction
        },
        {
            x: 475,
            y: 150,
            width: 30,
            height: 10,
            direction: 'down'
        }
    )
    assert.deepEqual(
        {
            x: mc0?.x,
            y: mc0?.y,
            width: mc0?.width,
            height: mc0?.height,
            direction: mc0?.direction
        },
        {
            x: 910,
            y: 650,
            width: 25,
            height: 10,
            direction: 'up'
        }
    )
})

/**
 * Verifies record-26 bus trunks on the dawn sheet survive normalization so
 * grouped net routes render instead of disappearing entirely.
 */
test('parseAltiumArrayBuffer preserves dawn-sheet bus trunks', async () => {
    const documentModel = await AltiumFixtureLoader.parseDawnSheet()

    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 300 &&
                line.y1 === 700 &&
                line.x2 === 300 &&
                line.y2 === 680 &&
                line.isBus === true
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 415 &&
                line.y1 === 550 &&
                line.x2 === 415 &&
                line.y2 === 460 &&
                line.isBus === true
        ),
        true
    )
})

/**
 * Verifies the nova sheet keeps only the active multipart WYRN2 sections,
 * preserving one label per visible section and snapping back to A3.
 */
test('parseAltiumArrayBuffer restores active multipart sections on the nova sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const u2Pins = documentModel.schematic.pins.filter((pin) =>
        ['1672', '2172', '3833'].includes(pin.ownerIndex)
    )
    const sectionLabels = documentModel.schematic.texts.filter((text) =>
        [
            'Rune Gate',
            'Cinder Well',
            'Nova / Echo',
            'NAND FLASH',
            'Digital Audio',
            'Ethernet MAC',
            'Multi-Purpose Quad SPI',
            'Slave 8-bit IF',
            'SDRAM controller'
        ].includes(text.text)
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1654)
    assert.equal(documentModel.schematic.sheet.height, 1169)
    assert.equal(u2Pins.length, 65)
    assert.deepEqual(
        sectionLabels
            .map((text) => text.text)
            .sort((left, right) => left.localeCompare(right)),
        ['Cinder Well', 'Nova / Echo', 'Rune Gate']
    )
})

/**
 * Verifies moon-sheet component texts anchor according to their owner
 * geometry instead of using one blanket rule for every designator.
 */
test('parseAltiumArrayBuffer anchors moon-sheet component texts from owner geometry', async () => {
    const documentModel = await AltiumFixtureLoader.parseMoonSheet()
    const anchors = documentModel.schematic.texts
        .filter((text) =>
            [
                'ORB70',
                'ORB82',
                'ORB68',
                'GLINT148',
                'GLINT134',
                'ORB187',
                'ORB190'
            ].includes(text.text)
        )
        .map((text) => ({
            text: text.text,
            anchor: text.anchor
        }))
        .sort((left, right) =>
            left.text.localeCompare(right.text, undefined, { numeric: true })
        )

    assert.deepEqual(anchors, [
        { text: 'GLINT134', anchor: 'end' },
        { text: 'GLINT148', anchor: 'end' },
        { text: 'ORB68', anchor: 'start' },
        { text: 'ORB70', anchor: 'start' },
        { text: 'ORB82', anchor: 'start' },
        { text: 'ORB187', anchor: 'start' },
        { text: 'ORB190', anchor: 'start' }
    ])
})

/**
 * Verifies cinder-sheet multipart designators keep side-aware anchors on the
 * reduced fake resistor sections.
 */
test('parseAltiumArrayBuffer keeps side-aware resistor designators aligned on the cinder sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseCinderSheet()
    const anchors = documentModel.schematic.texts
        .filter((text) => ['SIGIL51', 'SIGIL56'].includes(text.text))
        .map((text) => ({
            text: text.text,
            ownerIndex: String(text.ownerIndex || ''),
            anchor: text.anchor
        }))
        .sort(
            (left, right) =>
                left.ownerIndex.localeCompare(right.ownerIndex) ||
                left.text.localeCompare(right.text)
        )

    assert.deepEqual(anchors, [
        { text: 'SIGIL51', ownerIndex: '2891', anchor: 'end' },
        { text: 'SIGIL56', ownerIndex: '2953', anchor: 'start' }
    ])
})

/**
 * Verifies the multipart resistor stack keeps the active suffixes on the
 * repeated cinder-sheet sections while leaving the single connector
 * designator unsuffixed.
 */
test('parseAltiumArrayBuffer resolves multipart designators without suffixing the cinder-sheet connector', async () => {
    const documentModel = await AltiumFixtureLoader.parseCinderSheet()
    const designators = documentModel.schematic.texts
        .filter(
            (text) =>
                ['4010', '4050', '4088', '4126', '4164'].includes(
                    String(text.ownerIndex || '')
                ) && text.name === 'Designator'
        )
        .map((text) => ({
            ownerIndex: String(text.ownerIndex || ''),
            text: text.text,
            anchor: text.anchor
        }))
        .sort((left, right) => left.ownerIndex.localeCompare(right.ownerIndex))

    assert.deepEqual(designators, [
        { ownerIndex: '4010', text: 'SIGIL92B', anchor: 'end' },
        { ownerIndex: '4050', text: 'SIGIL92A', anchor: 'end' },
        { ownerIndex: '4088', text: 'SIGIL92C', anchor: 'end' },
        { ownerIndex: '4126', text: 'SIGIL92D', anchor: 'end' },
        { ownerIndex: '4164', text: 'PIER4', anchor: 'start' }
    ])
    assert.equal(
        documentModel.schematic.texts.some((text) => text.text === 'PIER4A'),
        false
    )
})

/**
 * Verifies each multipart cinder-sheet owner keeps only its active pin pair
 * instead of rendering all four overlapping owner-part variants.
 */
test('parseAltiumArrayBuffer keeps only active multipart resistor pin pairs on the cinder sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseCinderSheet()
    const pinGroups = ['4010', '4050', '4088', '4126'].map((ownerIndex) => ({
        ownerIndex,
        pins: documentModel.schematic.pins
            .filter((pin) => pin.ownerIndex === ownerIndex)
            .map((pin) => ({
                designator: pin.designator,
                labelMode: pin.labelMode
            }))
            .sort(
                (left, right) =>
                    Number(left.designator) - Number(right.designator)
            )
    }))

    assert.deepEqual(pinGroups, [
        {
            ownerIndex: '4010',
            pins: [
                { designator: '2', labelMode: 'number-only' },
                { designator: '7', labelMode: 'number-only' }
            ]
        },
        {
            ownerIndex: '4050',
            pins: [
                { designator: '1', labelMode: 'number-only' },
                { designator: '8', labelMode: 'number-only' }
            ]
        },
        {
            ownerIndex: '4088',
            pins: [
                { designator: '3', labelMode: 'number-only' },
                { designator: '6', labelMode: 'number-only' }
            ]
        },
        {
            ownerIndex: '4126',
            pins: [
                { designator: '4', labelMode: 'number-only' },
                { designator: '5', labelMode: 'number-only' }
            ]
        }
    ])
})
