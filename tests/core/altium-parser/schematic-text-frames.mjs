// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies one-line owner text frames use the center of their authored
 * rectangle when Altium omits an explicit justification field.
 */
test('parseAltiumArrayBuffer centers one-line owner text frames by default', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=180|CustomY=120|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=12|FontName1=Times New Roman|Bold1=T|Rotation1=0',
        '|RECORD=28|OwnerIndex=902|OwnerPartId=3|Location.X=20|Location.Y=90' +
            '|Corner.X=100|Corner.Y=104|Text=GROUP_1|FontID=1|TextColor=7250688' +
            '|Color=128|AreaColor=11599871|IsSolid=F|ShowBorder=F|WordWrap=T'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'owner-text-frame.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const note = documentModel.schematic.texts.find(
        (text) => text.recordType === '28'
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.ok(note)
    assert.equal(note.anchor, 'middle')
    assert.match(
        markup,
        /<text class="schematic-note-text" x="60"[^>]*text-anchor="middle"[^>]*>GROUP_1</u
    )
})

/**
 * Verifies mirrored owner-local text stays inside a rectangular owner body
 * while numeric contact labels stay inside the body near their pin edges.
 */
test('renderSchematicSvg keeps mirrored owner text inside rectangular bodies', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=260|CustomY=220|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=8|FontName2=Times New Roman|Bold2=F|Rotation2=0',
        '|RECORD=14|OwnerIndex=914|OwnerPartId=1|IndexInSheet=1' +
            '|Location.X=100|Location.Y=100|Corner.X=160|Corner.Y=160' +
            '|Color=128|AreaColor=11599871|IsSolid=T',
        '|RECORD=2|OwnerIndex=914|OwnerPartId=1|Electrical=4|PinConglomerate=58|PinLength=15' +
            '|Location.X=100|Location.Y=120|Name=6|Designator=6',
        '|RECORD=2|OwnerIndex=914|OwnerPartId=1|Electrical=4|PinConglomerate=58|PinLength=15' +
            '|Location.X=100|Location.Y=150|Name=4|Designator=4',
        '|RECORD=2|OwnerIndex=914|OwnerPartId=1|Electrical=4|PinConglomerate=56|PinLength=15' +
            '|Location.X=160|Location.Y=150|Name=3|Designator=3',
        '|RECORD=2|OwnerIndex=914|OwnerPartId=1|Electrical=4|PinConglomerate=56|PinLength=15' +
            '|Location.X=160|Location.Y=120|Name=1|Designator=1',
        '|RECORD=2|OwnerIndex=914|OwnerPartId=1|Electrical=4|SymBol_Outer=6|PinConglomerate=56|PinLength=15' +
            '|Location.X=160|Location.Y=158|Name=2|Designator=2',
        '|RECORD=4|OwnerIndex=914|OwnerPartId=1|Orientation=2|Justification=2|IsMirrored=T' +
            '|Location.X=104|Location.Y=138|Color=16711680|FontID=2|Text=GROUP_A',
        '|RECORD=4|OwnerIndex=914|OwnerPartId=1|Orientation=2|Justification=2|IsMirrored=T' +
            '|Location.X=130|Location.Y=138|Color=16711680|FontID=2|Text=GROUP_B',
        '|RECORD=4|OwnerIndex=914|OwnerPartId=1|Orientation=2|Justification=2|IsMirrored=T' +
            '|Location.X=125|Location.Y=150|Color=16711680|FontID=1|Text=1:1'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'mirrored-rectangular-numeric-body.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const anchorsByText = Object.fromEntries(
        documentModel.schematic.texts
            .filter((text) => text.ownerIndex === '914')
            .map((text) => [text.text, text.anchor])
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.deepEqual(anchorsByText, {
        GROUP_A: 'start',
        GROUP_B: 'start',
        '1:1': 'start'
    })
    assert.match(
        markup,
        /<text class="schematic-label" x="104" y="89"[^>]*>GROUP_A<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="130" y="89"[^>]*>GROUP_B<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="125" y="79"[^>]*>1:1<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="110" y="103"[^>]*text-anchor="middle"[^>]*>6</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="91"[^>]*text-anchor="end"[^>]*>6</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="110" y="73"[^>]*text-anchor="middle"[^>]*>4</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="91"[^>]*text-anchor="end"[^>]*>4</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="150" y="73"[^>]*text-anchor="middle"[^>]*>3</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="169"[^>]*text-anchor="start"[^>]*>3</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="150" y="103"[^>]*text-anchor="middle"[^>]*>1</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="169"[^>]*text-anchor="start"[^>]*>1</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="150" y="65"[^>]*text-anchor="middle"[^>]*>2</u
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="169"[^>]*text-anchor="start"[^>]*>2</u
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker">.*x1="165".*x2="171"/u
    )
})

/**
 * Verifies baseline-oriented owner-local symbol text keeps its authored
 * baseline inside owner-drawn cells even when the native record is mirrored.
 */
test('renderSchematicSvg keeps baseline-oriented owner body letters on authored baselines', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=220|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=24|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=14|OwnerIndex=927|OwnerPartId=1|IndexInSheet=1' +
            '|Location.X=40|Location.Y=40|Corner.X=180|Corner.Y=160' +
            '|Color=128|AreaColor=11599871|IsSolid=T',
        '|RECORD=13|OwnerIndex=927|OwnerPartId=1|IndexInSheet=2' +
            '|Location.X=80|Location.Y=40|Corner.X=80|Corner.Y=160' +
            '|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerIndex=927|OwnerPartId=1|IndexInSheet=3' +
            '|Location.X=80|Location.Y=100|Corner.X=180|Corner.Y=100' +
            '|LineWidth=1|Color=16711680',
        '|RECORD=4|OwnerIndex=927|OwnerPartId=1|Orientation=0|Justification=0|IsMirrored=T' +
            '|Location.X=92|Location.Y=112|Color=16711680|FontID=1|Text=A',
        '|RECORD=4|OwnerIndex=927|OwnerPartId=1|Orientation=0|Justification=0|IsMirrored=T' +
            '|Location.X=92|Location.Y=72|Color=16711680|FontID=1|Text=B'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'owner-body-letter-cells.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="92" y="88"[^>]*>A<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="92" y="128"[^>]*>B<\/text>/
    )
})

/**
 * Verifies ownerless free text drawn over a component body is constrained by
 * the nearby owner rectangle and its internal separator lines.
 */
test('renderSchematicSvg keeps ownerless body overlay letters inside inferred cells', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=220|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=14|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=14|OwnerIndex=938|OwnerPartId=1|IndexInSheet=1' +
            '|Location.X=40|Location.Y=40|Corner.X=120|Corner.Y=120' +
            '|Color=128|AreaColor=11599871|IsSolid=T',
        '|RECORD=6|IndexInSheet=2|LineWidth=1|Color=16711680|LocationCount=2' +
            '|X1=70|Y1=92|X2=120|Y2=92',
        '|RECORD=6|IndexInSheet=3|LineWidth=1|Color=16711680|LocationCount=2' +
            '|X1=70|Y1=66|X2=120|Y2=66',
        '|RECORD=4|IndexInSheet=4|OwnerPartId=-1|Location.X=74|Location.Y=64' +
            '|Color=16711680|FontID=1|Text=L',
        '|RECORD=4|IndexInSheet=5|OwnerPartId=-1|Location.X=74|Location.Y=38' +
            '|Color=16711680|FontID=1|Text=H'
    ]
    const documentModel = AltiumParser.parseArrayBuffer(
        'ownerless-overlay-letter-cells.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="74" y="114"[^>]*>L<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="74" y="140"[^>]*>H<\/text>/
    )
})
