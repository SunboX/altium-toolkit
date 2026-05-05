// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies owner geometry keeps record order so later solid polygons can cover
 * earlier internal stubs, while neutral gray fills stay literal instead of
 * collapsing to the note-border theme token.
 */
test('renderSchematicSvg preserves owner primitive order and literal neutral polygon fills', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=200|CustomY=100|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=13|OwnerIndex=700|IndexInSheet=1|OwnerPartId=1|Location.X=151|Location.Y=40|Corner.X=160|Corner.Y=40|LineWidth=1|Color=16711680',
        '|RECORD=7|OwnerIndex=700|IndexInSheet=2|OwnerPartId=1|LineWidth=1|Color=16711680|AreaColor=12632256|IsSolid=T|LocationCount=3' +
            '|X1=155|Y1=48|X2=155|Y2=32|X3=139|Y3=40'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'owner-geometry-order.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)
    const lineSnippet =
        '<line x1="151" y1="60" x2="160" y2="60" stroke="var(--schematic-accent-ink-color)" stroke-width="1" />'
    const polygonSnippet =
        '<polygon class="schematic-polygon" points="155,52 155,68 139,60" fill="#c0c0c0" stroke="var(--schematic-accent-ink-color)" stroke-width="1" stroke-linejoin="round" />'

    assert.match(
        markup,
        new RegExp(polygonSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    )
    assert.notEqual(markup.indexOf(lineSnippet), -1)
    assert.notEqual(markup.indexOf(polygonSnippet), -1)
    assert.ok(markup.indexOf(lineSnippet) < markup.indexOf(polygonSnippet))
})

/**
 * Verifies owner body rectangles without IndexInSheet render before indexed
 * side-view contact pads so the full visible pad stack stays on top.
 */
test('renderSchematicSvg keeps missing-order owner bodies behind indexed connector pads', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=600|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=14|OwnerIndex=700|OwnerPartId=1|Location.X=300|Location.Y=330|Corner.X=350|Corner.Y=520|LineWidth=1|Color=128|AreaColor=11599871|IsSolid=T',
        '|RECORD=14|OwnerIndex=700|IndexInSheet=1|OwnerPartId=1|Location.X=319|Location.Y=497|Corner.X=338|Corner.Y=503|LineWidth=1|Color=16711680|AreaColor=16711680|IsSolid=T',
        '|RECORD=13|OwnerIndex=700|IndexInSheet=2|OwnerPartId=1|Location.X=328|Location.Y=500|Corner.X=350|Corner.Y=500|LineWidth=1|Color=16711680'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'side-view-stack-order.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)
    const bodySnippet =
        '<rect class="schematic-rectangle" x="300" y="80" width="50" height="190"'
    const padSnippet =
        '<rect class="schematic-rectangle" x="319" y="97" width="19" height="6"'

    assert.notEqual(markup.indexOf(bodySnippet), -1)
    assert.notEqual(markup.indexOf(padSnippet), -1)
    assert.ok(markup.indexOf(bodySnippet) < markup.indexOf(padSnippet))
})

/**
 * Verifies ground power ports attached at a wire tee prefer the downward
 * symbol orientation and contribute a junction branch at the connection point.
 */
test('renderSchematicSvg keeps ground power ports vertical at tees and renders their junction dot', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Ground tee schematic' },
        schematic: {
            sheet: { width: 160, height: 100 },
            lines: [
                { x1: 125, y1: 40, x2: 90, y2: 40, color: '#000080', width: 1 },
                { x1: 90, y1: 40, x2: 90, y2: 65, color: '#000080', width: 1 }
            ],
            texts: [
                {
                    x: 90,
                    y: 40,
                    text: 'GND',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 4,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    sourceOrientation: 3,
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round"><line x1="90" y1="60" x2="90" y2="67" stroke="var\(--schematic-power-color\)" \/><line x1="83" y1="67" x2="97" y2="67" stroke="var\(--schematic-power-color\)" \/><line x1="85" y1="70" x2="95" y2="70" stroke="var\(--schematic-power-color\)" \/><line x1="87" y1="73" x2="93" y2="73" stroke="var\(--schematic-power-color\)" \/><text class="schematic-power-port-label" x="90" y="85" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400">GND<\/text>/
    )
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="90" cy="60" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
    assert.ok(
        markup.indexOf('class="schematic-junction" cx="90" cy="60"') >
            markup.indexOf(
                'class="schematic-power-port schematic-power-port--ground"'
            )
    )
    assert.doesNotMatch(markup, /<line x1="90" y1="60" x2="83" y2="60"/)
})
