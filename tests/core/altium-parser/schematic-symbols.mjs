// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies the moon sheet preserves pin numbers on the two five-pin
 * twin-gate symbols instead of collapsing them to name-only labels.
 */
test('parseAltiumArrayBuffer keeps gate pin numbers on the moon sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseMoonSheet()
    const gatePins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '296' || pin.ownerIndex === '322'
    )

    assert.equal(gatePins.length, 10)
    assert.equal(
        gatePins.every((pin) => pin.labelMode === 'name-and-number'),
        true
    )
    assert.deepEqual(
        gatePins
            .map((pin) => ({
                ownerIndex: pin.ownerIndex,
                name: pin.name,
                designator: pin.designator,
                orientation: pin.orientation
            }))
            .sort(
                (left, right) =>
                    left.ownerIndex.localeCompare(right.ownerIndex) ||
                    left.designator.localeCompare(right.designator, undefined, {
                        numeric: true
                    })
            ),
        [
            {
                ownerIndex: '296',
                name: 'A',
                designator: '1',
                orientation: 'left'
            },
            {
                ownerIndex: '296',
                name: 'B',
                designator: '2',
                orientation: 'left'
            },
            {
                ownerIndex: '296',
                name: 'GND',
                designator: '3',
                orientation: 'left'
            },
            {
                ownerIndex: '296',
                name: 'Y',
                designator: '4',
                orientation: 'right'
            },
            {
                ownerIndex: '296',
                name: 'VCC',
                designator: '5',
                orientation: 'right'
            },
            {
                ownerIndex: '322',
                name: 'A',
                designator: '1',
                orientation: 'left'
            },
            {
                ownerIndex: '322',
                name: 'B',
                designator: '2',
                orientation: 'left'
            },
            {
                ownerIndex: '322',
                name: 'GND',
                designator: '3',
                orientation: 'left'
            },
            {
                ownerIndex: '322',
                name: 'Y',
                designator: '4',
                orientation: 'right'
            },
            {
                ownerIndex: '322',
                name: 'VCC',
                designator: '5',
                orientation: 'right'
            }
        ]
    )
})

/**
 * Verifies nova-sheet packages keep the top and bottom pin rows encoded by the
 * less-common 57/49/51 conglomerate variants, including the full dual-row
 * package labelling used by EMBER12.
 */
test('parseAltiumArrayBuffer maps nova-sheet top and bottom variant pin conglomerates', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const d12Pins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '5547'
    )

    assert.equal(d12Pins.length, 6)
    assert.equal(
        d12Pins.some(
            (pin) =>
                pin.name === 'I/O4' &&
                pin.designator === '6' &&
                pin.orientation === 'top' &&
                pin.x === 1220 &&
                pin.y === 885 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        d12Pins.some(
            (pin) =>
                pin.name === 'VDD' &&
                pin.designator === '5' &&
                pin.orientation === 'top' &&
                pin.x === 1240 &&
                pin.y === 885 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        d12Pins.some(
            (pin) =>
                pin.name === 'GND' &&
                pin.designator === '2' &&
                pin.orientation === 'bottom' &&
                pin.x === 1240 &&
                pin.y === 825 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '5760' &&
                pin.name === '5' &&
                pin.designator === '5' &&
                pin.orientation === 'bottom' &&
                pin.x === 1450 &&
                pin.y === 700 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
})

/**
 * Verifies nova-sheet power ports preserve Altium orientation metadata so the
 * renderer can honor explicit port direction before inferring from wires.
 */
test('parseAltiumArrayBuffer keeps nova-sheet AURA_3V3 power-port orientation', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()

    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.recordType === '17' &&
                text.text === 'AURA_3V3' &&
                text.x === 100 &&
                text.y === 1010 &&
                text.powerPortDirection === 'up'
        ),
        true
    )
})

/**
 * Verifies nova-sheet multipart unit designators keep the visible section suffix
 * derived from the active Altium part id instead of rendering as bare WYRN2.
 */
test('parseAltiumArrayBuffer appends active multipart suffixes to nova-sheet designators', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()

    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.ownerIndex === '1672' &&
                text.name === 'Designator' &&
                text.text === 'WYRN2A'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.ownerIndex === '3833' &&
                text.name === 'Designator' &&
                text.text === 'WYRN2B'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.ownerIndex === '2172' &&
                text.name === 'Designator' &&
                text.text === 'WYRN2J'
        ),
        true
    )
})

/**
 * Verifies escaped Altium active-low pin names are normalized into readable
 * labels before rendering.
 */
test('parseAltiumArrayBuffer decodes escaped nova-sheet pin names like VEIL_RST', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()

    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '3833' &&
                pin.designator === '1' &&
                pin.orientation === 'left' &&
                pin.name === 'VEIL_RST'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) => pin.ownerIndex === '3833' && /\\/.test(pin.name)
        ),
        false
    )
})

/**
 * Verifies escaped active-low pin labels keep readable plain text while
 * preserving the authored overbar runs and outer pin glyph metadata.
 */
test('parseAltiumArrayBuffer preserves escaped active-low pin runs and outer markers', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=320|CustomY=200|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=6|OwnerIndex=700|IsNotAccesible=T|IndexInSheet=1|OwnerPartId=1|LineWidth=1' +
            '|Color=11796480|LocationCount=5|X1=120|Y1=160|X2=220|Y2=160|X3=220|Y3=60' +
            '|X4=120|Y4=60|X5=120|Y5=160',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|SymBol_Outer=2|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=20|Location.X=120|Location.Y=140|Name=C\\\\S\\\\|Designator=1',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|SymBol_Outer=34|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=20|Location.X=120|Location.Y=120|Name=DO/IO1|Designator=2',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|SymBol_Outer=34|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=20|Location.X=120|Location.Y=100|Name=W\\\\P\\\\/IO2|Designator=3',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|SymBol_Outer=34|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=20|Location.X=120|Location.Y=80|Name=H\\\\O\\\\L\\\\D\\\\/IO3|Designator=4',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=7|PinConglomerate=56' +
            '|PinLength=20|Location.X=220|Location.Y=140|Name=VCC|Designator=8',
        '|RECORD=34|OwnerIndex=700|Location.X=120|Location.Y=165|Color=8388608|FontID=1|Text=U1|Name=Designator',
        '|RECORD=41|OwnerIndex=700|Location.X=120|Location.Y=50|Color=8388608|FontID=1|Text=FLASH|Name=Value'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'escaped-active-low-pin-runs.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const ownerPins = documentModel.schematic.pins
        .filter((pin) => pin.ownerIndex === '700')
        .map((pin) => ({
            designator: pin.designator,
            name: pin.name,
            symbolOuter: pin.symbolOuter || null,
            nameSegments: pin.nameSegments || null
        }))

    assert.deepEqual(ownerPins, [
        {
            designator: '1',
            name: 'CS',
            symbolOuter: 2,
            nameSegments: [{ text: 'CS', overline: true }]
        },
        {
            designator: '2',
            name: 'DO/IO1',
            symbolOuter: 34,
            nameSegments: null
        },
        {
            designator: '3',
            name: 'WP/IO2',
            symbolOuter: 34,
            nameSegments: [
                { text: 'WP', overline: true },
                { text: '/IO2', overline: false }
            ]
        },
        {
            designator: '4',
            name: 'HOLD/IO3',
            symbolOuter: 34,
            nameSegments: [
                { text: 'HOLD', overline: true },
                { text: '/IO3', overline: false }
            ]
        },
        {
            designator: '8',
            name: 'VCC',
            symbolOuter: null,
            nameSegments: null
        }
    ])
})

/**
 * Verifies the nova-sheet crystal CHIME2 keeps its four numbered passive pins rather
 * than dropping them because the symbol spans multiple sides.
 */
test('parseAltiumArrayBuffer keeps the nova-sheet CHIME2 crystal pins as number-only labels', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const y2Pins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '6355'
    )

    assert.equal(y2Pins.length, 4)
    assert.equal(
        y2Pins.some(
            (pin) =>
                pin.designator === '1' &&
                pin.orientation === 'left' &&
                pin.x === 165 &&
                pin.y === 395 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.equal(
        y2Pins.some(
            (pin) =>
                pin.designator === '3' &&
                pin.orientation === 'right' &&
                pin.x === 185 &&
                pin.y === 395 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.equal(
        y2Pins.some(
            (pin) =>
                pin.designator === '2' &&
                pin.orientation === 'top' &&
                pin.x === 195 &&
                pin.y === 415 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.equal(
        y2Pins.some(
            (pin) =>
                pin.designator === '4' &&
                pin.orientation === 'top' &&
                pin.x === 205 &&
                pin.y === 415 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
})

/**
 * Verifies anonymous numbered connector pins stay visible even when the symbol
 * spans multiple sides, so the renderer can keep their ground ports attached.
 */
test('parseAltiumArrayBuffer keeps anonymous multi-side connector pins and grounds', () => {
    const connectorRecords = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=1000|CustomY=500|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=19|Location.X=919|Location.Y=175|Designator=1',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=19|Location.X=919|Location.Y=195|Designator=2',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=19|Location.X=919|Location.Y=215|Designator=3',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=57|PinLength=19|Location.X=930|Location.Y=356|Designator=4',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=59|PinLength=19|Location.X=930|Location.Y=164|Designator=5',
        '|RECORD=17|Style=4|ShowNetName=T|Location.X=930|Location.Y=375|Color=128|FontID=1|Text=GND',
        '|RECORD=17|Style=4|ShowNetName=T|Location.X=930|Location.Y=145|Color=128|FontID=1|Text=GND'
    ]
    const arrayBuffer = new TextEncoder().encode(
        connectorRecords.join('')
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'anonymous-connector.SchDoc',
        arrayBuffer
    )
    const connectorPins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '4773'
    )
    const sheetHeight = documentModel.schematic.sheet.height
    const topGroundY = sheetHeight - 375
    const bottomGroundY = sheetHeight - 145
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(connectorPins.length, 5)
    assert.equal(
        connectorPins.every((pin) => pin.labelMode === 'number-only'),
        true
    )
    assert.equal(
        connectorPins.some(
            (pin) =>
                pin.designator === '4' &&
                pin.orientation === 'top' &&
                pin.x === 930 &&
                pin.y === 356
        ),
        true
    )
    assert.equal(
        connectorPins.some(
            (pin) =>
                pin.designator === '5' &&
                pin.orientation === 'bottom' &&
                pin.x === 930 &&
                pin.y === 164
        ),
        true
    )
    assert.match(markup, />4</)
    assert.match(markup, />5</)
    assert.match(
        markup,
        new RegExp(
            '<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round">' +
                '<line x1="930" y1="' +
                topGroundY +
                '" x2="930" y2="' +
                (topGroundY - 7) +
                '" stroke="var\\(--schematic-power-color\\)" \\/>'
        )
    )
    assert.match(
        markup,
        new RegExp(
            '<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round">' +
                '<line x1="930" y1="' +
                bottomGroundY +
                '" x2="930" y2="' +
                (bottomGroundY + 7) +
                '" stroke="var\\(--schematic-power-color\\)" \\/>'
        )
    )
})

/**
 * Verifies dense two-sided 48/50 pin families keep only their numeric labels
 * so owner symbol graphics are not obscured by duplicated semantic pin names.
 */
test('parseAltiumArrayBuffer keeps dense two-sided 48/50 pin families number-only', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=400|CustomY=250|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=50|PinLength=10|Location.X=200|Location.Y=150|Name=BUS_A1|Designator=1',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=50|PinLength=10|Location.X=200|Location.Y=130|Name=BUS_A2|Designator=2',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=50|PinLength=10|Location.X=200|Location.Y=110|Name=CTL_A1|Designator=3',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=50|PinLength=10|Location.X=200|Location.Y=90|Name=CTL_A2|Designator=4',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=48|PinLength=10|Location.X=240|Location.Y=150|Name=OUT_B1|Designator=5',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=48|PinLength=10|Location.X=240|Location.Y=130|Name=OUT_B2|Designator=6',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=48|PinLength=10|Location.X=240|Location.Y=110|Name=OUT_B3|Designator=7',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=48|PinLength=10|Location.X=240|Location.Y=90|Name=OUT_B4|Designator=8',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=48|PinLength=10|Location.X=240|Location.Y=70|Name=ALT_B1|Designator=9',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=50|PinLength=10|Location.X=200|Location.Y=70|Name=ALT_A1|Designator=10'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'dense-two-sided-4850.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const densePins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '700'
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(densePins.length, 10)
    assert.equal(
        densePins.every((pin) => pin.labelMode === 'number-only'),
        true
    )
    assert.match(markup, />1</)
    assert.match(markup, />10</)
    assert.doesNotMatch(markup, />BUS_A1</)
    assert.doesNotMatch(markup, />OUT_B4</)
})

/**
 * Verifies inline ground power ports preserve explicit Altium orientation so
 * the renderer does not rotate them sideways when only a horizontal wire is
 * attached at the connection point.
 */
test('parseAltiumArrayBuffer keeps explicit ground power-port orientation on horizontal wires', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=160|CustomY=100|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=13|Location.X=70|Location.Y=40|Corner.X=90|Corner.Y=40|LineWidth=1|Color=128',
        '|RECORD=17|Style=4|ShowNetName=T|Orientation=3|Location.X=90|Location.Y=40|Color=128|FontID=1|Text=GND'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'ground-orientation.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)
    const groundPort = documentModel.schematic.texts.find(
        (text) =>
            text.recordType === '17' &&
            text.text === 'GND' &&
            text.x === 90 &&
            text.y === 40
    )

    assert.equal(groundPort?.powerPortDirection, 'down')
    assert.match(
        markup,
        /<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round"><line x1="90" y1="60" x2="90" y2="67" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round"><line x1="90" y1="60" x2="97" y2="60" stroke="var\(--schematic-power-color\)" \/>/
    )
})

/**
 * Verifies nova-sheet record-14 package bodies are parsed as filled rectangles
 * instead of diagonal line segments.
 */
test('parseAltiumArrayBuffer keeps the nova-sheet EMBER12 body as a rectangle primitive', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()

    assert.equal(
        documentModel.schematic.rectangles.some(
            (rectangle) =>
                rectangle.ownerIndex === '5547' &&
                rectangle.x === 1210 &&
                rectangle.y === 825 &&
                rectangle.width === 60 &&
                rectangle.height === 60 &&
                rectangle.color === '#800000' &&
                rectangle.fill === '#ffffb0' &&
                rectangle.isSolid === true
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.ownerIndex === '5547' &&
                line.x1 === 1210 &&
                line.y1 === 825 &&
                line.x2 === 1270 &&
                line.y2 === 885
        ),
        false
    )
})

/**
 * Verifies nova-sheet inductor body arcs survive normalization with their
 * fractional center coordinates instead of being dropped entirely.
 */
test('parseAltiumArrayBuffer keeps the nova-sheet inductor coil arcs as record-12 primitives', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const l52Arcs = documentModel.schematic.arcs?.filter(
        (arc) => arc.ownerIndex === '5602'
    )

    assert.deepEqual(l52Arcs, [
        {
            x: 565,
            y: 284.8,
            radius: 5,
            startAngle: 2.3,
            endAngle: 177.7,
            color: '#0000ff',
            width: 1,
            renderOrder: 5,
            ownerIndex: '5602'
        },
        {
            x: 575,
            y: 284.8,
            radius: 5,
            startAngle: 2.3,
            endAngle: 177.7,
            color: '#0000ff',
            width: 1,
            renderOrder: 6,
            ownerIndex: '5602'
        },
        {
            x: 585,
            y: 284.8,
            radius: 5,
            startAngle: 2.3,
            endAngle: 177.7,
            color: '#0000ff',
            width: 1,
            renderOrder: 7,
            ownerIndex: '5602'
        }
    ])
})
