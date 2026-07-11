// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { AltiumParser } from '../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer as LegacySchematicSvgRenderer } from '../src/ui/SchematicSvgRenderer.mjs'
import { SchematicSvgRenderer } from '../src/extensions.mjs'

const FIXTURE = new TextEncoder().encode(
    [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=220|CustomY=140|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|IndexInSheet=10|Location.X=50|Location.Y=60|LibReference=NEUTRAL_HIDE|UniqueID=CMP-H',
        '|RECORD=6|OwnerIndex=710|OwnerPartID=1|LocationCount=2|X1=45|Y1=55|X2=55|Y2=55',
        '|RECORD=34|OwnerIndex=710|OwnerPartID=-1|Location.X=50|Location.Y=70|FontID=1|IsHidden=T|Text=HID1|Name=Designator',
        '|RECORD=1|IndexInSheet=20|Location.X=140|Location.Y=60|LibReference=NEUTRAL_SHOW|UniqueID=CMP-V',
        '|RECORD=6|OwnerIndex=720|OwnerPartID=1|LocationCount=2|X1=135|Y1=55|X2=145|Y2=55',
        '|RECORD=34|OwnerIndex=720|OwnerPartID=-1|Location.X=140|Location.Y=70|FontID=1|Text=VIS1|Name=Designator'
    ].join('\u0000')
).buffer

/**
 * Builds the neutral native renderer fixture.
 * @returns {Record<string, any>} Parsed native renderer model.
 */
function createFixture() {
    return AltiumParser.parseArrayBufferToRendererModel(
        'hidden-fallback-labels.SchDoc',
        FIXTURE.slice(0)
    )
}

test('native convergence renderer suppresses hidden fallback designators without mutating input', () => {
    const documentModel = createFixture()
    const hiddenComponent = documentModel.schematic.components[0]
    const legacyMarkup = LegacySchematicSvgRenderer.render(documentModel)
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(hiddenComponent.schematicDesignatorVisible, false)
    assert.equal(hiddenComponent.designator, 'HID1')
    assert.match(legacyMarkup, />HID1</u)
    assert.doesNotMatch(markup, />HID1</u)
    assert.match(markup, />VIS1</u)
    assert.equal(hiddenComponent.designator, 'HID1')
})

test('native convergence renderer is byte-for-byte legacy-compatible when visibility needs no adaptation', () => {
    const documentModel = createFixture()
    documentModel.schematic.components[0].schematicDesignatorVisible = true

    assert.equal(SchematicSvgRenderer.render.length, 1)
    assert.equal(
        SchematicSvgRenderer.render(documentModel),
        LegacySchematicSvgRenderer.render(documentModel)
    )
})

test('native convergence renderer never caches mutable rows behind shallow-frozen containers', () => {
    const documentModel = createFixture()
    const hiddenComponent = documentModel.schematic.components[0]
    Object.freeze(documentModel.schematic.components)
    Object.freeze(documentModel.schematic)
    Object.freeze(documentModel)

    assert.doesNotMatch(SchematicSvgRenderer.render(documentModel), />HID1</u)

    hiddenComponent.schematicDesignatorVisible = true
    assert.match(SchematicSvgRenderer.render(documentModel), />HID1</u)
})

test('native convergence facade leaves the historical renderer source manifest exact', async () => {
    const manifest = JSON.parse(
        await readFile(
            new URL(
                '../spec/native-source-manifest-v1.1.41.json',
                import.meta.url
            ),
            'utf8'
        )
    )
    const renderer = manifest.files.find(
        (row) => row.path === 'src/ui/SchematicSvgRenderer.mjs'
    )
    const source = await readFile(
        new URL('../src/ui/SchematicSvgRenderer.mjs', import.meta.url)
    )

    assert.ok(renderer)
    assert.equal(
        createHash('sha256').update(source).digest('hex'),
        renderer.sha256
    )
})
