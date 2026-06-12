// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

const DIRECTIVE_RECORDS = [
    '|HEADER=Schematic Document',
    '|RECORD=31|CustomX=400|CustomY=240|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
    '|RECORD=43|Location.X=120|Location.Y=160|Color=255|Orientation=1|Name=DiffPairRouting',
    '|RECORD=43|Location.X=128|Location.Y=160|Color=255|Name=DIFFPAIR',
    '|RECORD=43|Location.X=90|Location.Y=120|Color=255|Orientation=1|Name=ZONE_SCOPE_A',
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

const OUTER_MARKER_RECORDS = [
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

const OUTER_MARKER_VARIANT_RECORDS = [
    '|HEADER=Schematic Document',
    '|RECORD=31|CustomX=320|CustomY=220|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
    '|RECORD=6|OwnerIndex=700|IsNotAccesible=T|IndexInSheet=1|OwnerPartId=1|LineWidth=1' +
        '|Color=11796480|LocationCount=5|X1=120|Y1=160|X2=220|Y2=160|X3=220|Y3=40' +
        '|X4=120|Y4=40|X5=120|Y5=160',
    '|RECORD=2|OwnerIndex=700|OwnerPartId=1|SymBol_Outer=2|FormalType=1|Electrical=4' +
        '|PinConglomerate=58|PinLength=20|Location.X=120|Location.Y=140|Name=IN_A|Designator=1',
    '|RECORD=2|OwnerIndex=700|OwnerPartId=1|SymBol_Outer=34|FormalType=1|Electrical=4' +
        '|PinConglomerate=58|PinLength=20|Location.X=120|Location.Y=120|Name=IO_A|Designator=2',
    '|RECORD=2|OwnerIndex=700|OwnerPartId=1|SymBol_Outer=33|FormalType=1|Electrical=4' +
        '|PinConglomerate=56|PinLength=20|Location.X=220|Location.Y=100|Name=OUT_B|Designator=3',
    '|RECORD=2|OwnerIndex=700|OwnerPartId=1|SymBol_Outer=34|FormalType=1|Electrical=4' +
        '|PinConglomerate=56|PinLength=20|Location.X=220|Location.Y=80|Name=IO_B|Designator=4'
]

const DEFAULT_ELECTRICAL_MARKER_RECORDS = [
    '|HEADER=Schematic Document',
    '|RECORD=31|CustomX=260|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
    '|RECORD=6|OwnerIndex=800|IsNotAccesible=T|IndexInSheet=1|OwnerPartId=1|LineWidth=1' +
        '|Color=11796480|LocationCount=5|X1=120|Y1=140|X2=180|Y2=140|X3=180|Y3=80' +
        '|X4=120|Y4=80|X5=120|Y5=140',
    '|RECORD=2|OwnerIndex=800|OwnerPartId=1|FormalType=1|PinConglomerate=58' +
        '|PinLength=20|Location.X=120|Location.Y=120|Name=IN_A|Designator=1',
    '|RECORD=2|OwnerIndex=800|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=58' +
        '|PinLength=20|Location.X=120|Location.Y=100|Name=PASS_A|Designator=2',
    '|RECORD=2|OwnerIndex=800|OwnerPartId=1|FormalType=1|PinConglomerate=56' +
        '|PinLength=20|Location.X=180|Location.Y=120|Name=IN_B|Designator=3'
]

/**
 * Verifies directive glyphs, double-ended ports, plain ports, and electrical
 * pin arrows all stay visible in the final schematic SVG.
 */
test('renderSchematicSvg draws directive glyphs, double-tip ports, and electrical pin arrows', () => {
    const arrayBuffer = new TextEncoder().encode(
        DIRECTIVE_RECORDS.join('')
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'directive-port-shapes.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, /schematic-directive schematic-directive--route/)
    assert.match(markup, /schematic-directive schematic-directive--pair/)
    assert.match(
        markup,
        /schematic-directive schematic-directive--parameter-set/
    )
    assert.match(markup, />DiffPairRouting</)
    assert.match(markup, />ZONE_SCOPE_A</)
    assert.match(
        markup,
        /<polygon points="218,75 262,75 270,80 262,85 218,85 210,80" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="150,45 220,45 220,55 150,55" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="75,97 75,103 80,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><polygon points="72,97 72,103 67,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g><text class="schematic-pin-number" x="64" y="99" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">1<\/text>/
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="145,97 145,103 140,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><polygon points="148,97 148,103 153,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g><text class="schematic-pin-number" x="156" y="99" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">2<\/text>/
    )
    assert.equal(
        (markup.match(/class="schematic-pin-marker"/g) || []).length,
        2
    )
})

/**
 * Verifies side-attached parameter-set callouts honor Altium's horizontal
 * orientation codes instead of reusing top/bottom marker placement.
 */
test('renderSchematicSvg orients side parameter-set callouts horizontally', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Side directive schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 120,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    }
                }
            },
            lines: [],
            rectangles: [
                {
                    x: 40,
                    y: 40,
                    width: 40,
                    height: 40,
                    color: '#ff0000',
                    fill: '#ffffff',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    lineStyle: 1
                },
                {
                    x: 120,
                    y: 40,
                    width: 40,
                    height: 40,
                    color: '#ff0000',
                    fill: '#ffffff',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    lineStyle: 1
                }
            ],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            directives: [
                {
                    x: 40,
                    y: 60,
                    color: '#ff0000',
                    name: 'LEFT_SCOPE',
                    orientation: 2
                },
                {
                    x: 160,
                    y: 60,
                    color: '#ff0000',
                    name: 'RIGHT_SCOPE',
                    orientation: 0
                }
            ]
        }
    })

    assert.match(
        markup,
        /<line x1="40" y1="60" x2="29" y2="60" stroke="var\(--schematic-alert-color\)" stroke-width="1" \/><circle cx="22" cy="60" r="7"/
    )
    assert.match(
        markup,
        /<text class="schematic-directive-label" x="6" y="63\.06" fill="var\(--schematic-alert-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">LEFT_SCOPE<\/text>/
    )
    assert.match(
        markup,
        /<line x1="160" y1="60" x2="171" y2="60" stroke="var\(--schematic-alert-color\)" stroke-width="1" \/><circle cx="178" cy="60" r="7"/
    )
    assert.match(
        markup,
        /<text class="schematic-directive-label" x="194" y="63\.06" fill="var\(--schematic-alert-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">RIGHT_SCOPE<\/text>/
    )
    assert.doesNotMatch(markup, /schematic-directive-info"[^>]*transform=/)
})

/**
 * Verifies top-oriented parameter-set labels stay attached to their info
 * marker instead of drifting into unrelated heading text above the callout.
 */
test('renderSchematicSvg keeps top parameter-set labels near the info marker', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Top directive schematic' },
        schematic: {
            sheet: {
                width: 220,
                height: 140,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    }
                }
            },
            lines: [],
            texts: [
                {
                    x: 110,
                    y: 125,
                    text: 'Pitch: 0.05" (1.27mm)',
                    color: '#ff0000',
                    fontSize: 14,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            directives: [
                {
                    x: 70,
                    y: 82,
                    color: '#ff0000',
                    name: 'FPGA_GPIO',
                    orientation: 1
                }
            ]
        }
    })

    assert.match(
        markup,
        /<circle cx="70" cy="46" r="7" fill="none" stroke="var\(--schematic-alert-color\)" stroke-width="1" \/><text class="schematic-directive-label" x="70" y="37" fill="var\(--schematic-alert-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400">FPGA_GPIO<\/text>/
    )
    assert.doesNotMatch(
        markup,
        /<text class="schematic-directive-label" x="70" y="24"/
    )
})

/**
 * Verifies authored outer pin symbols stay visible as single triangles and
 * escaped active-low runs render as overlined pin-name spans.
 */
test('renderSchematicSvg draws authored outer pin markers and overlined pin labels', () => {
    const documentModel = AltiumParser.parseArrayBuffer(
        'outer-pin-markers.SchDoc',
        new TextEncoder().encode(OUTER_MARKER_RECORDS.join('')).buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(
        (markup.match(/class="schematic-pin-marker"/g) || []).length,
        4
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="114,62 114,68 120,65" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g><text class="schematic-pin-number" x="112" y="64"/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="127" y="68" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400"><tspan text-decoration="overline">CS<\/tspan><\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="127" y="108" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400"><tspan text-decoration="overline">WP<\/tspan><tspan text-decoration="none">\/IO2<\/tspan><\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="127" y="128" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400"><tspan text-decoration="overline">HOLD<\/tspan><tspan text-decoration="none">\/IO3<\/tspan><\/text>/
    )
})

/**
 * Verifies authored outer-pin marker variants stay distinct instead of being
 * flattened into one inward-facing triangle.
 */
test('renderSchematicSvg draws inward, outward, and double outer pin markers from authored flags', () => {
    const documentModel = AltiumParser.parseArrayBuffer(
        'outer-pin-marker-variants.SchDoc',
        new TextEncoder().encode(OUTER_MARKER_VARIANT_RECORDS.join('')).buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(
        (markup.match(/class="schematic-pin-marker"/g) || []).length,
        4
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="114,77 114,83 120,80" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g>/
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="114,97 114,103 120,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><polygon points="111,97 111,103 105,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g>/
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="220,117 220,123 226,120" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g>/
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="226,137 226,143 220,140" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><polygon points="229,137 229,143 235,140" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g>/
    )
})

/**
 * Verifies omitted formal Electrical fields use Altium's default input marker
 * while passive pins remain plain line contacts.
 */
test('renderSchematicSvg draws default input pin markers from omitted electrical type', () => {
    const documentModel = AltiumParser.parseArrayBuffer(
        'default-input-pin-markers.SchDoc',
        new TextEncoder().encode(DEFAULT_ELECTRICAL_MARKER_RECORDS.join(''))
            .buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(
        (markup.match(/class="schematic-pin-marker"/g) || []).length,
        2
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="114,57 114,63 120,60" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g>/
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="186,57 186,63 180,60" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g>/
    )
})
