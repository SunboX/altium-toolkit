// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies escaped active-low markers are parsed into display text and
 * overline runs independent of pin parsing.
 */
test('SchematicTextRunParser parses overline text runs', async () => {
    const { SchematicTextRunParser } =
        await import('../../src/legacy-parser.mjs')

    assert.deepEqual(SchematicTextRunParser.parseOverlineRuns('L\\D\\A\\C\\'), {
        text: 'LDAC',
        hasOverline: true,
        segments: [{ text: 'LDAC', overline: true }]
    })
    assert.deepEqual(SchematicTextRunParser.parseOverlineRuns('R\\ST'), {
        text: 'RST',
        hasOverline: true,
        segments: [
            { text: 'R', overline: true },
            { text: 'ST', overline: false }
        ]
    })
    assert.deepEqual(SchematicTextRunParser.parseOverlineRuns('DATA'), {
        text: 'DATA',
        hasOverline: false,
        segments: [{ text: 'DATA', overline: false }]
    })
})

/**
 * Verifies schematic text records expose reusable textSegments metadata for
 * active-low labels and render those segments into SVG tspans.
 */
test('schematic text records expose and render overline segments', async () => {
    const { AltiumParser } = await import('../../src/legacy-parser.mjs')
    const { SchematicSvgRenderer } =
        await import('../../src/legacy-renderers.mjs')
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=160|CustomY=100|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=4|CustomYZones=3' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=4|Location.X=20|Location.Y=30|Color=255|FontID=1|Text=L\\D\\A\\C\\|Name=NetLabel'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'overline-text.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.texts[0].text, 'LDAC')
    assert.deepEqual(documentModel.schematic.texts[0].textSegments, [
        { text: 'LDAC', overline: true }
    ])

    const markup = SchematicSvgRenderer.render(documentModel)
    assert.match(markup, /<tspan text-decoration="overline">LDAC<\/tspan>/)
})
