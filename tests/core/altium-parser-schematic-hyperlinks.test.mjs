// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'

/**
 * Encodes one synthetic schematic record stream.
 * @param {string[]} records Synthetic records.
 * @returns {ArrayBuffer}
 */
function encodeSchematic(records) {
    return new TextEncoder().encode(records.join('')).buffer
}

/**
 * Verifies schematic hyperlink records are normalized into first-class
 * read-model entries with source and owner metadata.
 */
test('AltiumParser exposes schematic hyperlinks in the read model', () => {
    const model = AltiumParser.parseArrayBufferToRendererModel(
        'hyperlinks.SchDoc',
        encodeSchematic([
            '|HEADER=Schematic Document',
            '|RECORD=31|CUSTOMX=100|CUSTOMY=100|BORDERON=F|TITLEBLOCKON=F' +
                '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|BOLD1=T|ITALIC1=T',
            '|RECORD=226|INDEXINSHEET=70|OWNERINDEX=20|OWNERPARTID=1' +
                '|LOCATION.X=60|LOCATION.Y=70|TEXT=Datasheet' +
                '|URL=https://example.invalid/ds|FONTID=1|COLOR=255' +
                '|AREACOLOR=65280|ORIENTATION=2|JUSTIFICATION=5' +
                '|UNIQUEID=LINK-1|ISNOTACCESIBLE=T'
        ])
    )

    assert.equal(model.kind, 'schematic')
    assert.deepEqual(model.schematic.hyperlinks, [
        {
            key: 'schematic-hyperlink-70',
            recordKey: 'schematic-record-1',
            indexInSheet: 70,
            ownerIndex: '20',
            ownerPartId: 1,
            uniqueId: 'LINK-1',
            text: 'Datasheet',
            url: 'https://example.invalid/ds',
            x: 60,
            y: 70,
            fontId: '1',
            fontSize: 10,
            fontFamily: 'Arial',
            fontWeight: 700,
            fontStyle: 'italic',
            color: '#ff0000',
            areaColor: '#00ff00',
            orientation: 2,
            rotation: 180,
            justification: 5,
            isNotAccessible: true
        }
    ])
    assert.deepEqual(
        model.schematic.recordTypes.find((row) => row.recordType === 226),
        {
            recordType: 226,
            name: 'hyperlink',
            family: 'annotation',
            supported: true,
            count: 1
        }
    )
    assert.equal(model.summary.hyperlinkCount, 1)
})
