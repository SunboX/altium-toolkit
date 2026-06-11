// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Parses synthetic schematic record strings through the public parser.
 * @param {string[]} records Printable fake schematic records.
 * @returns {object}
 */
function parseSchematicRecords(records) {
    return AltiumParser.parseArrayBuffer(
        'owner-text-and-pins.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
}

/**
 * Verifies visible owner comment templates resolve against same-owner hidden
 * parameters instead of leaking the last global metadata value into every part.
 */
test('parseAltiumArrayBuffer resolves component value placeholders per owner', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=260|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=100|Location.X=120|Location.Y=120|LibReference=FAKE/CELL-A|UniqueID=CMP-A',
        '|RECORD=34|OwnerIndex=100|Location.X=110|Location.Y=135|Color=8388608|FontID=1|Text=A7|Name=Designator',
        '|RECORD=41|OwnerIndex=100|Location.X=110|Location.Y=105|Color=8388608|FontID=1|IsHidden=T|Text=LOCAL-A|Name=value',
        '|RECORD=41|OwnerIndex=100|Location.X=110|Location.Y=105|Color=8388608|FontID=1|Text==value|Name=Comment',
        '|RECORD=1|IndexInSheet=200|Location.X=300|Location.Y=120|LibReference=FAKE/CELL-B|UniqueID=CMP-B',
        '|RECORD=34|OwnerIndex=200|Location.X=290|Location.Y=135|Color=8388608|FontID=1|Text=B8|Name=Designator',
        '|RECORD=41|OwnerIndex=200|Location.X=290|Location.Y=105|Color=8388608|FontID=1|IsHidden=T|Text=LOCAL-B|Name=Value',
        '|RECORD=41|OwnerIndex=200|Location.X=290|Location.Y=105|Color=8388608|FontID=1|Text==VALUE|Name=Comment'
    ])
    const valuesByDesignator = Object.fromEntries(
        documentModel.schematic.components.map((component) => [
            component.designator,
            component.value
        ])
    )
    const visibleValues = documentModel.schematic.texts
        .filter((text) => text.name === 'Comment')
        .map((text) => text.text)
        .sort((left, right) => left.localeCompare(right))

    assert.deepEqual(valuesByDesignator, {
        A7: 'LOCAL-A',
        B8: 'LOCAL-B'
    })
    assert.deepEqual(visibleValues, ['LOCAL-A', 'LOCAL-B'])
})

/**
 * Verifies hidden owner values win over unrelated nearby visible comments when
 * the same owner also carries a visible unresolved comment placeholder.
 */
test('parseAltiumArrayBuffer prefers hidden owner value over nearby comments', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=260|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=300|Location.X=200|Location.Y=120|LibReference=FAKE/CELL-C|UniqueID=CMP-C',
        '|RECORD=34|OwnerIndex=300|Location.X=195|Location.Y=135|Color=8388608|FontID=1|Text=C9|Name=Designator',
        '|RECORD=41|OwnerIndex=300|Location.X=120|Location.Y=120|Color=8388608|FontID=1|IsHidden=T|Text=OWNED-C|Name=Value',
        '|RECORD=41|OwnerIndex=300|Location.X=120|Location.Y=120|Color=8388608|FontID=1|Text==VALUE|Name=Comment',
        '|RECORD=1|IndexInSheet=400|Location.X=220|Location.Y=120|LibReference=FAKE/CELL-D|UniqueID=CMP-D',
        '|RECORD=34|OwnerIndex=400|Location.X=215|Location.Y=135|Color=8388608|FontID=1|Text=D10|Name=Designator',
        '|RECORD=41|OwnerIndex=400|Location.X=210|Location.Y=120|Color=8388608|FontID=1|Text=NEAR-D|Name=Comment'
    ])
    const valuesByDesignator = Object.fromEntries(
        documentModel.schematic.components.map((component) => [
            component.designator,
            component.value
        ])
    )

    assert.equal(valuesByDesignator.C9, 'OWNED-C')
    assert.equal(valuesByDesignator.D10, 'NEAR-D')
})

/**
 * Verifies compact owner-drawn internal terminal groups keep connectivity but
 * do not render pin names and numbers over the symbol body.
 */
test('parseAltiumArrayBuffer hides compact internal owner-drawn pin labels', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=300|Location.X=240|Location.Y=160|LibReference=FAKE/CORE-CELL|UniqueID=CMP-C',
        '|RECORD=6|OwnerIndex=300|OwnerPartId=1|IsNotAccesible=T|LocationCount=5|LineWidth=1|Color=8388608' +
            '|X1=230|Y1=170|X2=250|Y2=170|X3=250|Y3=150|X4=230|Y4=150|X5=230|Y5=170',
        '|RECORD=2|OwnerIndex=300|OwnerPartId=1|PinConglomerate=51|PinLength=10|Location.X=240|Location.Y=150|Name=X|Designator=1',
        '|RECORD=2|OwnerIndex=300|OwnerPartId=1|PinConglomerate=49|PinLength=10|Location.X=240|Location.Y=170|Name=X|Designator=3',
        '|RECORD=2|OwnerIndex=300|OwnerPartId=1|PinConglomerate=48|PinLength=10|Location.X=250|Location.Y=156|Name=GND|Designator=2',
        '|RECORD=2|OwnerIndex=300|OwnerPartId=1|PinConglomerate=48|PinLength=10|Location.X=250|Location.Y=164|Name=GND|Designator=4',
        '|RECORD=34|OwnerIndex=300|Location.X=220|Location.Y=180|Color=8388608|FontID=1|Text=Y7|Name=Designator',
        '|RECORD=41|OwnerIndex=300|Location.X=220|Location.Y=140|Color=8388608|FontID=1|IsHidden=T|Text=FREQ-A|Name=Value',
        '|RECORD=41|OwnerIndex=300|Location.X=220|Location.Y=140|Color=8388608|FontID=1|Text==VALUE|Name=Comment'
    ])
    const ownerPins = documentModel.schematic.pins
        .filter((pin) => pin.ownerIndex === '300')
        .map((pin) => ({
            name: pin.name,
            designator: pin.designator,
            labelMode: pin.labelMode
        }))

    assert.equal(ownerPins.length, 4)
    assert.deepEqual(
        ownerPins.map((pin) => pin.labelMode),
        ['hidden', 'hidden', 'hidden', 'hidden']
    )
})

/**
 * Verifies bridge-style component-kind 4 symbols keep their numeric endpoint
 * labels even though Altium stores the two passive pins as hidden records.
 */
test('parseAltiumArrayBuffer shows numeric endpoint labels on two-pin bridge components', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=120|Location.X=220|Location.Y=160|LibReference=FAKE/BRIDGE-CELL' +
            '|DesignItemId=FAKE/BRIDGE-CELL|UniqueID=CMP-E|ComponentKind=4|AllPinCount=2',
        '|RECORD=9|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=1' +
            '|Location.X=225|Location.Y=160|Radius=5|LineWidth=1|StartAngle=270|EndAngle=90' +
            '|AreaColor=12632256|IsSolid=T',
        '|RECORD=9|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=2' +
            '|Location.X=213|Location.Y=160|Radius=5|LineWidth=1|StartAngle=90|EndAngle=270' +
            '|AreaColor=12632256|IsSolid=T',
        '|RECORD=6|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=3|LineWidth=2' +
            '|LocationCount=2|X1=212|Y1=160|X2=226|Y2=160',
        '|RECORD=2|OwnerIndex=500|OwnerPartId=1|Electrical=4|PinConglomerate=50|PinLength=11' +
            '|Location.X=207|Location.Y=160|Name=1|Designator=1',
        '|RECORD=2|OwnerIndex=500|OwnerPartId=1|Electrical=4|PinConglomerate=48|PinLength=11' +
            '|Location.X=231|Location.Y=160|Name=2|Designator=2',
        '|RECORD=34|OwnerIndex=500|Location.X=208|Location.Y=170|Color=8388608|FontID=1|Text=K7|Name=Designator',
        '|RECORD=41|OwnerIndex=500|Location.X=208|Location.Y=150|Color=8388608|FontID=1|Text=LINK-CELL|Name=Comment'
    ])
    const ownerPins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '500'
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(
        ownerPins.map((pin) => ({
            designator: pin.designator,
            labelMode: pin.labelMode
        })),
        [
            { designator: '1', labelMode: 'number-only' },
            { designator: '2', labelMode: 'number-only' }
        ]
    )
    assert.equal(
        (markup.match(/class="schematic-pin-number"/g) || []).length,
        2
    )
    assert.equal((markup.match(/class="schematic-pin-name"/g) || []).length, 0)
})

/**
 * Verifies compact owner-drawn two-pin symbols keep their contact numbers but
 * suppress internal terminal names that Altium stores for connectivity.
 */
test('parseAltiumArrayBuffer hides compact two-pin internal terminal names', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=260|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=700|Location.X=130|Location.Y=90|LibReference=FAKE/EDGE-CELL|UniqueID=CMP-I',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=34|PinLength=10' +
            '|Location.X=120|Location.Y=90|Name=X|Designator=1',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=35|PinLength=10' +
            '|Location.X=130|Location.Y=80|Name=Y|Designator=2',
        '|RECORD=11|OwnerIndex=700|IsNotAccesible=T|IndexInSheet=2|OwnerPartId=1' +
            '|Location.X=130|Location.Y=90|Radius=10|SecondaryRadius=10|LineWidth=1|EndAngle=360.000|Color=128',
        '|RECORD=6|OwnerIndex=700|IsNotAccesible=T|IndexInSheet=3|OwnerPartId=1|LineWidth=1|Color=128' +
            '|LocationCount=2|X1=122|Y1=90|X2=124|Y2=90',
        '|RECORD=34|OwnerIndex=700|Location.X=120|Location.Y=115|Color=8388608|FontID=1|Text=J7|Name=Designator',
        '|RECORD=41|OwnerIndex=700|Location.X=120|Location.Y=105|Color=8388608|FontID=1|Text=EDGE-CELL|Name=Comment'
    ])
    const ownerPins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '700'
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(
        ownerPins.map((pin) => ({
            name: pin.name,
            designator: pin.designator,
            labelMode: pin.labelMode
        })),
        [
            { name: 'X', designator: '1', labelMode: 'number-only' },
            { name: 'Y', designator: '2', labelMode: 'number-only' }
        ]
    )
    assert.equal(
        (markup.match(/class="schematic-pin-number"/g) || []).length,
        2
    )
    assert.equal((markup.match(/class="schematic-pin-name"/g) || []).length, 0)
})

/**
 * Verifies single-pin owner names do not duplicate a connected power-port
 * label that already names the same net.
 */
test('parseAltiumArrayBuffer suppresses redundant single-pin power labels', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=260|CustomY=140|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=610|Location.X=110|Location.Y=60|LibReference=FAKE/SINGLE-CONTACT|UniqueID=CMP-F',
        '|RECORD=2|OwnerIndex=610|OwnerPartId=1|Electrical=4|PinConglomerate=48|PinLength=20' +
            '|Location.X=110|Location.Y=60|Name=GND|Designator=1',
        '|RECORD=13|Location.X=130|Location.Y=60|Corner.X=160|Corner.Y=60|LineWidth=1|Color=128',
        '|RECORD=17|Style=4|ShowNetName=T|Orientation=3|Location.X=160|Location.Y=60|Color=128|FontID=1|Text=GND'
    ])
    const ownerPins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '610'
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(
        ownerPins.map((pin) => ({
            name: pin.name,
            designator: pin.designator,
            labelMode: pin.labelMode
        })),
        [{ name: 'GND', designator: '1', labelMode: 'number-only' }]
    )
    assert.equal(
        (markup.match(/class="schematic-pin-number"/g) || []).length,
        1
    )
    assert.equal((markup.match(/class="schematic-pin-name"/g) || []).length, 0)
    assert.match(markup, /class="schematic-power-port-label"[^>]*>GND<\/text>/)
})

/**
 * Verifies directly attached power ports suppress duplicate one-pin owner
 * names even when the recovered endpoint coordinates differ slightly.
 */
test('parseAltiumArrayBuffer suppresses redundant directly attached power pin labels', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=260|CustomY=140|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=620|Location.X=110|Location.Y=60|LibReference=FAKE/SINGLE-CONTACT|UniqueID=CMP-H',
        '|RECORD=2|OwnerIndex=620|OwnerPartId=1|Electrical=4|PinConglomerate=48|PinLength=20' +
            '|Location.X=110|Location.Y=60|Name=GND|Designator=1',
        '|RECORD=17|Style=4|ShowNetName=T|Orientation=3|Location.X=129|Location.Y=60|Color=128|FontID=1|Text=GND'
    ])
    const ownerPins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '620'
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(
        ownerPins.map((pin) => ({
            name: pin.name,
            designator: pin.designator,
            labelMode: pin.labelMode
        })),
        [{ name: 'GND', designator: '1', labelMode: 'number-only' }]
    )
    assert.equal(
        (markup.match(/class="schematic-pin-number"/g) || []).length,
        1
    )
    assert.equal((markup.match(/class="schematic-pin-name"/g) || []).length, 0)
    assert.match(markup, /class="schematic-power-port-label"[^>]*>GND<\/text>/)
})

/**
 * Verifies compact bridge pie halves bulge away from the internal centerline.
 */
test('renderSchematicSvg orients compact bridge pie halves outward', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=120|Location.X=220|Location.Y=160|LibReference=FAKE/BRIDGE-CELL' +
            '|DesignItemId=FAKE/BRIDGE-CELL|UniqueID=CMP-G|ComponentKind=4|AllPinCount=2',
        '|RECORD=9|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=1' +
            '|Location.X=225|Location.Y=160|Radius=5|LineWidth=1|StartAngle=270|EndAngle=90' +
            '|AreaColor=12632256|IsSolid=T',
        '|RECORD=9|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=2' +
            '|Location.X=213|Location.Y=160|Radius=5|LineWidth=1|StartAngle=90|EndAngle=270' +
            '|AreaColor=12632256|IsSolid=T',
        '|RECORD=6|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=3|LineWidth=2' +
            '|LocationCount=2|X1=212|Y1=160|X2=226|Y2=160',
        '|RECORD=2|OwnerIndex=500|OwnerPartId=1|Electrical=4|PinConglomerate=50|PinLength=11' +
            '|Location.X=207|Location.Y=160|Name=1|Designator=1',
        '|RECORD=2|OwnerIndex=500|OwnerPartId=1|Electrical=4|PinConglomerate=48|PinLength=11' +
            '|Location.X=231|Location.Y=160|Name=2|Designator=2',
        '|RECORD=34|OwnerIndex=500|Location.X=208|Location.Y=170|Color=8388608|FontID=1|Text=K9|Name=Designator',
        '|RECORD=41|OwnerIndex=500|Location.X=208|Location.Y=150|Color=8388608|FontID=1|Text=LINK-CELL|Name=Comment'
    ])
    const markup = SchematicSvgRenderer.render(documentModel)
    const piePaths = [
        ...markup.matchAll(/<path class="schematic-pie" d="([^"]+)"/g)
    ].map((match) => match[1])

    assert.deepEqual(piePaths, [
        'M 225 50 L 225 55 A 5 5 0 0 0 225 45 Z',
        'M 213 50 L 213 45 A 5 5 0 0 0 213 55 Z'
    ])
})

/**
 * Verifies native horizontal contact pins using the 40-family conglomerate
 * values keep their connector stubs and numeric labels.
 */
test('parseAltiumArrayBuffer keeps 40-family horizontal contact pins', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=420|CustomY=260|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=900|Location.X=220|Location.Y=100|LibReference=FAKE/EDGE-CONTACT' +
            '|DesignItemId=FAKE/EDGE-CONTACT|UniqueID=CMP-H|AllPinCount=3',
        '|RECORD=14|OwnerIndex=900|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=1' +
            '|Location.X=180|Location.Y=80|Corner.X=220|Corner.Y=120|LineWidth=1|AreaColor=16777215',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=1|Electrical=4|PinConglomerate=42|PinLength=15' +
            '|Location.X=180|Location.Y=110|Name=1|Designator=1',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=1|Electrical=4|PinConglomerate=40|PinLength=20' +
            '|Location.X=220|Location.Y=100|Name=2|Designator=2',
        '|RECORD=2|OwnerIndex=900|OwnerPartId=1|Electrical=4|PinConglomerate=40|PinLength=20' +
            '|Location.X=220|Location.Y=90|Name=3|Designator=3'
    ])
    const pins = documentModel.schematic.pins
        .filter((pin) => pin.ownerIndex === '900')
        .map((pin) => ({
            designator: pin.designator,
            orientation: pin.orientation,
            length: pin.length,
            labelMode: pin.labelMode
        }))
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(pins, [
        {
            designator: '1',
            orientation: 'left',
            length: 15,
            labelMode: 'number-only'
        },
        {
            designator: '2',
            orientation: 'right',
            length: 20,
            labelMode: 'number-only'
        },
        {
            designator: '3',
            orientation: 'right',
            length: 20,
            labelMode: 'number-only'
        }
    ])
    assert.match(
        markup,
        /<line class="schematic-pin-line" x1="180" y1="50" x2="165" y2="50"/
    )
    assert.match(
        markup,
        /<line class="schematic-pin-line" x1="220" y1="60" x2="240" y2="60"/
    )
    assert.match(
        markup,
        /<line class="schematic-pin-line" x1="220" y1="70" x2="240" y2="70"/
    )
})

/**
 * Verifies compact bridge designators are lifted clear of curved owner bodies,
 * not only line and pin bounds.
 */
test('parseAltiumArrayBuffer keeps compact bridge designators above curved bodies', () => {
    const documentModel = parseSchematicRecords([
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=120|Location.X=220|Location.Y=160|LibReference=FAKE/BRIDGE-CELL' +
            '|DesignItemId=FAKE/BRIDGE-CELL|UniqueID=CMP-F|ComponentKind=4|AllPinCount=2',
        '|RECORD=9|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=1' +
            '|Location.X=225|Location.Y=160|Radius=5|LineWidth=1|StartAngle=270|EndAngle=90' +
            '|AreaColor=12632256|IsSolid=T',
        '|RECORD=9|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=2' +
            '|Location.X=213|Location.Y=160|Radius=5|LineWidth=1|StartAngle=90|EndAngle=270' +
            '|AreaColor=12632256|IsSolid=T',
        '|RECORD=6|OwnerIndex=500|OwnerPartId=1|IsNotAccesible=T|IndexInSheet=3|LineWidth=2' +
            '|LocationCount=2|X1=212|Y1=160|X2=226|Y2=160',
        '|RECORD=2|OwnerIndex=500|OwnerPartId=1|Electrical=4|PinConglomerate=50|PinLength=11' +
            '|Location.X=207|Location.Y=160|Name=1|Designator=1',
        '|RECORD=2|OwnerIndex=500|OwnerPartId=1|Electrical=4|PinConglomerate=48|PinLength=11' +
            '|Location.X=231|Location.Y=160|Name=2|Designator=2',
        '|RECORD=34|OwnerIndex=500|Location.X=208|Location.Y=165|Color=8388608|FontID=1|Text=K8|Name=Designator',
        '|RECORD=41|OwnerIndex=500|Location.X=208|Location.Y=145|Color=8388608|FontID=1|Text=LINK-CELL|Name=Comment'
    ])
    const designatorText = documentModel.schematic.texts.find(
        (text) => text.name === 'Designator' && text.ownerIndex === '500'
    )

    assert.equal(designatorText?.text, 'K8')
    assert.equal(designatorText?.y, 169)
})
