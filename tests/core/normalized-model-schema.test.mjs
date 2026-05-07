// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { NormalizedModelSchema as ExportedNormalizedModelSchema } from '../../src/parser.mjs'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'
import { NormalizedModelSchema } from '../../src/core/altium/NormalizedModelSchema.mjs'
import { PcbLibModelParser } from '../../src/core/altium/PcbLibModelParser.mjs'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'
import { PrjPcbModelParser } from '../../src/core/altium/PrjPcbModelParser.mjs'

/**
 * Encodes text as an ArrayBuffer.
 * @param {string} text
 * @returns {ArrayBuffer}
 */
function encodeText(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

test('normalized parser roots expose the current schema id', () => {
    const schematicModel = AltiumParser.parseArrayBuffer(
        'schema-check.SchDoc',
        encodeText(
            '|HEADER=Schematic Document' +
                '|RECORD=31|CustomX=100|CustomY=100|BorderOn=F|TitleBlockOn=F'
        )
    )
    const pcbModel = PcbModelParser.parse('schema-check.PcbDoc', [])
    const pcbLibraryModel = PcbLibModelParser.parse('schema-check.PcbLib', {
        footprints: []
    })
    const projectModel = PrjPcbModelParser.parseText(
        'schema-check.PrjPcb',
        '[Design]\nVersion=1.0\n'
    )

    assert.deepEqual(
        [schematicModel, pcbModel, pcbLibraryModel, projectModel].map(
            (model) => model.schema
        ),
        Array(4).fill(NormalizedModelSchema.CURRENT_SCHEMA_ID)
    )
    assert.equal(
        ExportedNormalizedModelSchema.CURRENT_SCHEMA_ID,
        NormalizedModelSchema.CURRENT_SCHEMA_ID
    )
})

test('machine-readable normalized model schema declares the emitted contract id', () => {
    const schema = JSON.parse(
        fs.readFileSync(
            new URL(
                '../../docs/schemas/altium_toolkit/normalized_model_a1.schema.json',
                import.meta.url
            ),
            'utf8'
        )
    )

    assert.equal(schema.$id, NormalizedModelSchema.CURRENT_SCHEMA_ID)
    assert.equal(schema.properties.schema.const, schema.$id)
    assert.deepEqual(schema.properties.kind.enum, [
        'schematic',
        'pcb',
        'pcb-library',
        'project'
    ])
    assert.deepEqual(schema.properties.fileType.enum, [
        'SchDoc',
        'PcbDoc',
        'PcbLib',
        'PrjPcb'
    ])
})
