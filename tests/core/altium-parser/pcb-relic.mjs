// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies the reduced embedded PCB fixture still exposes outline, layers,
 * placement data, and a grouped BOM row.
 */
test('parseAltiumArrayBuffer parses an embedded fake PcbDoc relic', async () => {
    const documentModel = await AltiumFixtureLoader.parseRelicBoard()

    assert.equal(documentModel.kind, 'pcb')
    assert.equal(documentModel.fileType, 'PcbDoc')
    assert.equal(documentModel.pcb.boardOutline.segments.length, 5)
    assert.equal(documentModel.pcb.layers.length, 4)
    assert.equal(documentModel.pcb.components.length, 1)
    assert.deepEqual(documentModel.pcb.polygons, [])
    assert.deepEqual(documentModel.pcb.fills, [])
    assert.deepEqual(documentModel.pcb.tracks, [])
    assert.deepEqual(documentModel.pcb.vias, [])
    assert.equal(documentModel.bom.length, 1)
    assert.deepEqual(documentModel.pcb.components[0], {
        designator: 'PORT1',
        x: 900,
        y: 350,
        layer: 'BOTTOM',
        pattern: 'HDR-6',
        rotation: 180,
        source: 'CON/FAKE/HDR-6',
        description: 'Oracle header',
        height: 40
    })
})
