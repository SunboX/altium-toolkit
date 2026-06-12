import assert from 'node:assert/strict'
import test from 'node:test'
import { OleCompoundDocument } from '../../src/core/ole/OleCompoundDocument.mjs'
import { OleCompoundDocumentWriter } from '../../src/core/ole/OleCompoundDocumentWriter.mjs'

/**
 * Converts one byte view into an exact ArrayBuffer slice.
 * @param {Uint8Array} bytes Bytes to convert.
 * @returns {ArrayBuffer}
 */
function toArrayBuffer(bytes) {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    )
}

test('OleCompoundDocumentWriter writes readable nested streams', () => {
    const bytes = OleCompoundDocumentWriter.write({
        streams: new Map([
            ['Library/Data', new TextEncoder().encode('library-data')],
            ['Models/0.step', new TextEncoder().encode('ISO-10303-21;')]
        ])
    })
    const document = OleCompoundDocument.fromArrayBuffer(toArrayBuffer(bytes))

    assert.deepEqual(document.listStreams(), ['Library/Data', 'Models/0.step'])
    assert.equal(
        new TextDecoder().decode(document.getStream('Library/Data')),
        'library-data'
    )
    assert.equal(
        new TextDecoder().decode(document.getStream('Models/0.step')),
        'ISO-10303-21;'
    )
})

test('OleCompoundDocumentWriter stores short streams as regular FAT chains', () => {
    const bytes = OleCompoundDocumentWriter.write({
        streams: [['tiny.txt', new TextEncoder().encode('ok')]]
    })
    const document = OleCompoundDocument.fromArrayBuffer(toArrayBuffer(bytes))

    assert.equal(new TextDecoder().decode(document.getStream('tiny.txt')), 'ok')
    assert.equal(document.sectorByteLength, 512)
    assert.equal(document.miniSectorByteLength, 64)
})
