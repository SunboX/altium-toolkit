// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser, DraftsmanDigestParser } from '../../src/parser.mjs'

/**
 * Encodes text into an ArrayBuffer.
 * @param {string} text Text content.
 * @returns {ArrayBuffer}
 */
function encodeText(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

/**
 * Encodes a tiny LZ4 frame with one literal-only compressed block.
 * @param {string} text Text content.
 * @returns {ArrayBuffer}
 */
function encodeLiteralLz4Frame(text) {
    const payload = new TextEncoder().encode(text)
    const literalLength = payload.length
    const literalTail = []
    let remainingLiteralLength = literalLength - 15

    if (literalLength >= 15) {
        while (remainingLiteralLength >= 255) {
            literalTail.push(255)
            remainingLiteralLength -= 255
        }
        literalTail.push(remainingLiteralLength)
    }

    const block = new Uint8Array(1 + literalTail.length + payload.byteLength)
    block[0] = Math.min(literalLength, 15) << 4
    block.set(literalTail, 1)
    block.set(payload, 1 + literalTail.length)

    const frame = new Uint8Array(4 + 3 + 4 + block.byteLength + 4)
    const view = new DataView(frame.buffer)
    let offset = 0
    frame.set([0x04, 0x22, 0x4d, 0x18], offset)
    offset += 4
    frame[offset] = 0x60
    offset += 1
    frame[offset] = 0x40
    offset += 1
    frame[offset] = 0
    offset += 1
    view.setUint32(offset, block.byteLength, true)
    offset += 4
    frame.set(block, offset)
    offset += block.byteLength
    view.setUint32(offset, 0, true)

    return frame.buffer
}

test('DraftsmanDigestParser extracts a read-only drawing digest', () => {
    const model = DraftsmanDigestParser.parse(
        'review.PCBDwf',
        encodeText(`<DraftsmanDocument SourceDocumentName="Board.PcbDoc">
    <Page Id="P1" Name="Assembly">
        <TitleBlock Id="T1" Title="Assembly View" DocumentNumber="DWG-1" />
        <Note Id="N1" Text="Inspect first article" X="10" Y="20" />
        <Image Id="I1" Name="logo.png" NativeFormat="PNG" ByteSize="1024" />
        <Table Id="U1" Name="Generic Table" />
    </Page>
    <Page Id="P2" Title="Drill View">
        <Text Id="N2" Text="Drill notes" />
    </Page>
</DraftsmanDocument>`)
    )

    assert.equal(model.kind, 'draftsman')
    assert.equal(model.fileType, 'PCBDwf')
    assert.equal(model.summary.pageCount, 2)
    assert.equal(model.summary.noteCount, 2)
    assert.equal(model.summary.imageCount, 1)
    assert.equal(model.summary.unsupportedRawItemCount, 1)
    assert.equal(model.draftsman.schema, 'altium-toolkit.draftsman.digest.a1')
    assert.equal(model.draftsman.sourceDocumentName, 'Board.PcbDoc')
    assert.deepEqual(model.draftsman.pages[0], {
        index: 0,
        id: 'P1',
        name: 'Assembly',
        title: 'Assembly',
        titleBlocks: [
            {
                id: 'T1',
                title: 'Assembly View',
                documentNumber: 'DWG-1',
                fields: {
                    Id: 'T1',
                    Title: 'Assembly View',
                    DocumentNumber: 'DWG-1'
                }
            }
        ],
        notes: [
            {
                id: 'N1',
                text: 'Inspect first article',
                x: 10,
                y: 20,
                fields: {
                    Id: 'N1',
                    Text: 'Inspect first article',
                    X: '10',
                    Y: '20'
                }
            }
        ],
        images: [
            {
                id: 'I1',
                name: 'logo.png',
                nativeFormat: 'PNG',
                byteSize: 1024,
                fields: {
                    Id: 'I1',
                    Name: 'logo.png',
                    NativeFormat: 'PNG',
                    ByteSize: '1024'
                }
            }
        ],
        unsupportedRawItems: [
            {
                kind: 'Table',
                id: 'U1',
                name: 'Generic Table',
                rawXml: '<Table Id="U1" Name="Generic Table" />',
                fields: {
                    Id: 'U1',
                    Name: 'Generic Table'
                }
            }
        ]
    })
})

test('DraftsmanDigestParser preserves unsupported XML subtrees', () => {
    const model = DraftsmanDigestParser.parse(
        'review.PCBDwf',
        encodeText(`<DraftsmanDocument>
    <Page Id="P1">
        <DrawingView Id="D1" Name="Assembly">
            <Child Id="C1" Name="Nested" />
        </DrawingView>
    </Page>
</DraftsmanDocument>`)
    )

    assert.deepEqual(model.draftsman.pages[0].unsupportedRawItems, [
        {
            kind: 'DrawingView',
            id: 'D1',
            name: 'Assembly',
            rawXml: [
                '<DrawingView Id="D1" Name="Assembly">',
                '            <Child Id="C1" Name="Nested" />',
                '        </DrawingView>'
            ].join('\n'),
            fields: {
                Id: 'D1',
                Name: 'Assembly'
            }
        }
    ])
})

test('AltiumParser routes PCBDwf buffers into Draftsman digest models', () => {
    const model = AltiumParser.parseArrayBufferToRendererModel(
        'review.PCBDwf',
        encodeText('<DraftsmanDocument><Page Id="P1" /></DraftsmanDocument>')
    )

    assert.equal(model.kind, 'draftsman')
    assert.equal(model.fileType, 'PCBDwf')
    assert.equal(model.summary.pageCount, 1)
})

test('DraftsmanDigestParser decodes legacy LZ4 text containers', () => {
    const model = DraftsmanDigestParser.parse(
        'compressed.PCBDwf',
        encodeLiteralLz4Frame(
            '<DraftsmanDocument><Page Id="P1" Title="Compressed" /></DraftsmanDocument>'
        )
    )

    assert.equal(model.summary.pageCount, 1)
    assert.equal(model.draftsman.pages[0].title, 'Compressed')
    assert.equal(model.diagnostics[0].code, 'draftsman.digest.lz4-container')
})

test('DraftsmanDigestParser degrades unsupported binary payloads into diagnostics', () => {
    const model = DraftsmanDigestParser.parse(
        'binary.PCBDwf',
        new Uint8Array([0, 1, 2, 3]).buffer
    )

    assert.equal(model.kind, 'draftsman')
    assert.equal(model.summary.pageCount, 0)
    assert.equal(
        model.diagnostics[0].code,
        'draftsman.digest.unsupported-container'
    )
})
