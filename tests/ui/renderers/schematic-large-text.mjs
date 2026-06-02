// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { TextEncoder } from 'node:util'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies large free text without explicit justification keeps its authored
 * placement instead of being inferred as a centered sheet header.
 */
test('parseAltiumArrayBuffer and renderSchematicSvg preserve authored placement for large free text', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=1500|CustomY=950|VisibleGridSize=10|SnapGridSize=10' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=4|CustomYZones=4' +
            '|FontIdCount=2|Size1=24|FontName1=Times New Roman|Bold1=T|Rotation1=0' +
            '|Size2=40|FontName2=Signal Serif|Bold2=T|Rotation2=0',
        '|RECORD=4|Location.X=90|Location.Y=900|Color=8388608|FontID=1' +
            '|Text=Power Intake and Regulator',
        '|RECORD=4|Location.X=930|Location.Y=760|Color=8388608|FontID=2' +
            '|Text=Reference Walkthrough'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'large-free-text.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="90" y="70" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="23" font-family="Times New Roman" font-weight="700">Power Intake and Regulator<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="930" y="210" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="39" font-family="Signal Serif" font-weight="700">Reference Walkthrough<\/text>/
    )
})

/**
 * Verifies imported schematic font italics survive parser normalization and
 * are emitted on both free text and recovered title-block value hints.
 */
test('parseAltiumArrayBuffer and renderSchematicSvg preserve italic schematic fonts', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|SheetStyle=1|CustomX=1654|CustomY=1169|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=24|FontName1=Times New Roman|Bold1=F|Italic1=T|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=F|Italic2=T|Rotation2=0',
        '|RECORD=4|Location.X=90|Location.Y=900|Color=8388608|FontID=1' +
            '|Text=Italic Caption',
        '|RECORD=4|Location.X=1225|Location.Y=75|Color=8388608|FontID=2|Text=EMBER-UNIT',
        '|RECORD=4|Location.X=1420|Location.Y=80|Color=8388608|FontID=2|Text=CORE-MOD',
        '|RECORD=4|Location.X=1455|Location.Y=50|Color=8388608|FontID=2|Text=0.9',
        '|RECORD=4|Location.X=1405|Location.Y=30|Color=8388608|FontID=2|Text=2',
        '|RECORD=4|Location.X=1435|Location.Y=30|Color=8388608|FontID=2|Text=7'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'italic-schematic-fonts.SchDoc',
        arrayBuffer
    )
    const label = documentModel.schematic.texts.find(
        (text) => text.text === 'Italic Caption'
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(label?.fontStyle, 'italic')
    assert.equal(
        documentModel.schematic.sheet.titleBlock.footerHints.revision.fontStyle,
        'italic'
    )
    assert.match(
        markup,
        /<text class="schematic-label"[^>]*font-style="italic"[^>]*>Italic Caption<\/text>/
    )
    assert.match(
        markup,
        /<text class="sheet-title-value"[^>]*font-style="italic"[^>]*>0\.9<\/text>/
    )
})
