// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import test from 'node:test'

import { PcbLibModelParser } from '../../src/core/altium/PcbLibModelParser.mjs'
import { PcbLibStreamExtractor } from '../../src/core/altium/PcbLibStreamExtractor.mjs'
import { PcbBinaryPrimitiveTestFactory } from './PcbBinaryPrimitiveTestFactory.mjs'

/**
 * Builds synthetic PcbLib stream maps that mirror Altium's footprint-library
 * container layout without embedding native customer or vendor files.
 */
class PcbLibStreamTestFactory {
    /**
     * Creates one stream map with two footprint storages and mixed primitive
     * records in each footprint Data stream.
     * @returns {Map<string, Uint8Array>}
     */
    static createStreamMap() {
        const streams = new Map()
        const longName = 'Large/Test Footprint With Path Separators'
        const longStorageName = 'Large_Test Footprint With Path S'

        streams.set(
            'Library/Data',
            PcbLibStreamTestFactory.#createLibraryData([
                'PAD_TRACK_SAMPLE',
                longName
            ])
        )
        streams.set(
            'Library/ComponentParamsTOC/Data',
            PcbLibStreamTestFactory.#createComponentParamsToc([
                {
                    name: 'PAD_TRACK_SAMPLE',
                    padCount: 1,
                    height: '1.25mm',
                    description: 'Synthetic pad and route footprint'
                },
                {
                    name: longName,
                    padCount: 0,
                    height: '2.50mm',
                    description: 'Synthetic mechanical outline footprint'
                }
            ])
        )
        streams.set(
            'SectionKeys',
            PcbLibStreamTestFactory.#createSectionKeys([
                {
                    fullName: longName,
                    storageName: longStorageName
                }
            ])
        )
        streams.set(
            'PAD_TRACK_SAMPLE/Header',
            PcbLibStreamTestFactory.#createCountHeader(5)
        )
        streams.set(
            'PAD_TRACK_SAMPLE/Parameters',
            PcbLibStreamTestFactory.#createProperties({
                PATTERN: 'PAD_TRACK_SAMPLE',
                DESCRIPTION: 'Synthetic pad and route footprint',
                HEIGHT: '1.25mm',
                ITEMGUID: '{00000000-0000-0000-0000-000000000001}'
            })
        )
        streams.set(
            'PAD_TRACK_SAMPLE/Data',
            PcbLibStreamTestFactory.#createFootprintData('PAD_TRACK_SAMPLE', [
                PcbBinaryPrimitiveTestFactory.createPadStream().dataBytes,
                PcbBinaryPrimitiveTestFactory.createTrackStream().dataBytes,
                PcbBinaryPrimitiveTestFactory.createArcStream().dataBytes,
                PcbLibStreamTestFactory.#createLengthPrefixedFillRecord(),
                new Uint8Array([99])
            ])
        )
        streams.set(
            longStorageName + '/Header',
            PcbLibStreamTestFactory.#createCountHeader(2)
        )
        streams.set(
            longStorageName + '/Parameters',
            PcbLibStreamTestFactory.#createProperties({
                PATTERN: longName,
                DESCRIPTION: 'Synthetic mechanical outline footprint',
                HEIGHT: '2.50mm'
            })
        )
        streams.set(
            longStorageName + '/Data',
            PcbLibStreamTestFactory.#createFootprintData(longName, [
                PcbLibStreamTestFactory.#createLengthPrefixedViaRecord(),
                PcbBinaryPrimitiveTestFactory.createRegionStream().dataBytes
            ])
        )

        return streams
    }

    /**
     * Creates one stream map with PcbLib-scoped embedded model storage.
     * @returns {Map<string, Uint8Array>}
     */
    static createStreamMapWithLibraryModels() {
        const streams = PcbLibStreamTestFactory.createStreamMap()
        const stepText = [
            'ISO-10303-21;',
            'HEADER;',
            'ENDSEC;',
            'DATA;',
            'ENDSEC;',
            'END-ISO-10303-21;'
        ].join('\n')

        streams.set(
            'Library/Models/Data',
            PcbLibStreamTestFactory.#createLengthPrefixedAscii(
                'EMBED=TRUE|MODELSOURCE=Undefined|ID={11111111-2222-3333-4444-555555555555}|ROTX=0.000|ROTY=0.000|ROTZ=90.000|DZ=50000|CHECKSUM=123456789|NAME=SYNTHETIC_BODY.step\u0000'
            )
        )
        streams.set(
            'Library/Models/0',
            Uint8Array.from(deflateSync(new TextEncoder().encode(stepText)))
        )

        return streams
    }

    /**
     * Creates one `Library/Data` stream body.
     * @param {string[]} footprintNames
     * @returns {Uint8Array}
     */
    static #createLibraryData(footprintNames) {
        const header = PcbLibStreamTestFactory.#createProperties({
            HEADER: 'PCB 6.0 Binary Library File',
            WEIGHT: '0'
        })
        const countBytes = new Uint8Array(4)
        const countView = new DataView(countBytes.buffer)
        const nameBlocks = footprintNames.map((name) =>
            PcbLibStreamTestFactory.#createStringBlock(name)
        )

        countView.setUint32(0, footprintNames.length, true)

        return PcbLibStreamTestFactory.#concat([
            header,
            countBytes,
            ...nameBlocks
        ])
    }

    /**
     * Creates one packed ComponentParamsTOC data stream.
     * @param {{ name: string, padCount: number, height: string, description: string }[]} entries
     * @returns {Uint8Array}
     */
    static #createComponentParamsToc(entries) {
        return PcbLibStreamTestFactory.#concat(
            entries.map((entry) =>
                PcbLibStreamTestFactory.#createLengthPrefixedAscii(
                    'Name=' +
                        entry.name +
                        '|Pad Count=' +
                        entry.padCount +
                        '|Height=' +
                        entry.height +
                        '|Description=' +
                        entry.description +
                        '\r\n\u0000'
                )
            )
        )
    }

    /**
     * Creates one SectionKeys stream.
     * @param {{ fullName: string, storageName: string }[]} entries
     * @returns {Uint8Array}
     */
    static #createSectionKeys(entries) {
        const countBytes = new Uint8Array(4)
        const countView = new DataView(countBytes.buffer)

        countView.setUint32(0, entries.length, true)

        return PcbLibStreamTestFactory.#concat([
            countBytes,
            ...entries.flatMap((entry) => [
                PcbLibStreamTestFactory.#createStringBlock(entry.fullName),
                PcbLibStreamTestFactory.#createStringBlock(entry.storageName)
            ])
        ])
    }

    /**
     * Creates one footprint Data stream from a name and raw primitive records.
     * @param {string} name
     * @param {Uint8Array[]} primitiveRecords
     * @returns {Uint8Array}
     */
    static #createFootprintData(name, primitiveRecords) {
        return PcbLibStreamTestFactory.#concat([
            PcbLibStreamTestFactory.#createStringBlock(name),
            ...primitiveRecords
        ])
    }

    /**
     * Creates one little-endian count stream.
     * @param {number} count
     * @returns {Uint8Array}
     */
    static #createCountHeader(count) {
        const bytes = new Uint8Array(4)

        new DataView(bytes.buffer).setUint32(0, count, true)

        return bytes
    }

    /**
     * Creates one pipe-delimited property stream.
     * @param {Record<string, string>} properties
     * @returns {Uint8Array}
     */
    static #createProperties(properties) {
        return PcbLibStreamTestFactory.#createLengthPrefixedAscii(
            '|' +
                Object.entries(properties)
                    .map(([key, value]) => key + '=' + value)
                    .join('|') +
                '\u0000'
        )
    }

    /**
     * Creates one Pascal-style PCB string block.
     * @param {string} text
     * @returns {Uint8Array}
     */
    static #createStringBlock(text) {
        const encoded = new TextEncoder().encode(text)
        const bytes = new Uint8Array(4 + 1 + encoded.byteLength)
        const view = new DataView(bytes.buffer)

        view.setUint32(0, 1 + encoded.byteLength, true)
        bytes.set([encoded.byteLength], 4)
        bytes.set(encoded, 5)

        return bytes
    }

    /**
     * Creates one length-prefixed ASCII body.
     * @param {string} body
     * @returns {Uint8Array}
     */
    static #createLengthPrefixedAscii(body) {
        const encoded = new TextEncoder().encode(body)
        const bytes = new Uint8Array(4 + encoded.byteLength)
        const view = new DataView(bytes.buffer)

        view.setUint32(0, encoded.byteLength, true)
        bytes.set(encoded, 4)

        return bytes
    }

    /**
     * Creates one length-prefixed fill primitive record.
     * @returns {Uint8Array}
     */
    static #createLengthPrefixedFillRecord() {
        const { dataBytes } = PcbBinaryPrimitiveTestFactory.createFillStream()
        const record = new Uint8Array(dataBytes)
        const view = new DataView(record.buffer)

        record[0] = 6
        view.setUint32(1, record.byteLength - 5, true)

        return record
    }

    /**
     * Creates one length-prefixed via primitive record.
     * @returns {Uint8Array}
     */
    static #createLengthPrefixedViaRecord() {
        const { dataBytes } = PcbBinaryPrimitiveTestFactory.createViaStream()
        const record = new Uint8Array(dataBytes)
        const view = new DataView(record.buffer)

        record[0] = 3
        view.setUint32(1, record.byteLength - 5, true)

        return record
    }

    /**
     * Concatenates byte arrays.
     * @param {Uint8Array[]} chunks
     * @returns {Uint8Array}
     */
    static #concat(chunks) {
        const byteLength = chunks.reduce(
            (sum, chunk) => sum + chunk.byteLength,
            0
        )
        const bytes = new Uint8Array(byteLength)
        let offset = 0

        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return bytes
    }
}

/**
 * Verifies PcbLib streams are parsed through the library/footprint container
 * workflow used by native Altium footprint libraries.
 */
test('PcbLibStreamExtractor extracts declared footprint storages', () => {
    const extraction = PcbLibStreamExtractor.extractFromStreams(
        PcbLibStreamTestFactory.createStreamMap()
    )

    assert.deepEqual(
        extraction.footprints.map((footprint) => footprint.name),
        ['PAD_TRACK_SAMPLE', 'Large/Test Footprint With Path Separators']
    )
    assert.equal(extraction.libraryHeader.HEADER, 'PCB 6.0 Binary Library File')
    assert.equal(
        extraction.footprints[1].sourceStorage,
        'Large_Test Footprint With Path S'
    )
    assert.equal(
        extraction.footprints[0].parameters.PATTERN,
        'PAD_TRACK_SAMPLE'
    )
    assert.equal(extraction.footprints[0].pads.length, 1)
    assert.equal(extraction.footprints[0].tracks.length, 1)
    assert.equal(extraction.footprints[0].arcs.length, 1)
    assert.equal(extraction.footprints[0].fills.length, 1)
    assert.equal(extraction.footprints[0].rawRecords.length, 5)
    assert.deepEqual(
        {
            source: extraction.footprints[0].rawRecords[4].source,
            sourceStorage: extraction.footprints[0].rawRecords[4].sourceStorage,
            sourceStream: extraction.footprints[0].rawRecords[4].sourceStream,
            type: extraction.footprints[0].rawRecords[4].type,
            typeId: extraction.footprints[0].rawRecords[4].typeId,
            recordIndex: extraction.footprints[0].rawRecords[4].recordIndex,
            byteLength: extraction.footprints[0].rawRecords[4].byteLength,
            supported: extraction.footprints[0].rawRecords[4].supported,
            parsed: extraction.footprints[0].rawRecords[4].parsed,
            rawBase64: extraction.footprints[0].rawRecords[4].rawBase64
        },
        {
            source: 'pcblib',
            sourceStorage: 'PAD_TRACK_SAMPLE',
            sourceStream: 'PAD_TRACK_SAMPLE/Data',
            type: 'unknown',
            typeId: 99,
            recordIndex: 4,
            byteLength: 1,
            supported: false,
            parsed: false,
            rawBase64: 'Yw=='
        }
    )
    assert.equal(extraction.footprints[1].vias.length, 1)
    assert.equal(extraction.footprints[1].regions.length, 1)
    assert.equal(extraction.diagnostics.footprintCount, 2)
    assert.equal(extraction.diagnostics.primitiveCount, 6)
    assert.equal(extraction.diagnostics.rawRecordCount, 7)
})

/**
 * Verifies PcbLib-specific model streams are included in embedded model
 * recovery.
 */
test('PcbLibStreamExtractor extracts library-scoped embedded models', () => {
    const extraction = PcbLibStreamExtractor.extractFromStreams(
        PcbLibStreamTestFactory.createStreamMapWithLibraryModels()
    )

    assert.deepEqual(
        extraction.embeddedModels.models.map((model) => ({
            name: model.name,
            format: model.format,
            sourceStream: model.sourceStream
        })),
        [
            {
                name: 'SYNTHETIC_BODY.step',
                format: 'step',
                sourceStream: 'Library/Models/0'
            }
        ]
    )
    assert.equal(extraction.diagnostics.embeddedModelCount, 1)
    assert.ok(extraction.streamNames.includes('Library/Models/0'))
})

/**
 * Verifies the parser produces a stable public model for PcbLib files.
 */
test('PcbLibModelParser normalizes footprint libraries', () => {
    const extraction = PcbLibStreamExtractor.extractFromStreams(
        PcbLibStreamTestFactory.createStreamMap()
    )
    const model = PcbLibModelParser.parse(
        'synthetic-footprints.PcbLib',
        extraction
    )

    assert.equal(model.kind, 'pcb-library')
    assert.equal(model.fileType, 'PcbLib')
    assert.equal(model.summary.title, 'synthetic-footprints')
    assert.equal(model.summary.footprintCount, 2)
    assert.equal(model.summary.padCount, 1)
    assert.equal(model.summary.trackCount, 1)
    assert.equal(model.summary.arcCount, 1)
    assert.equal(model.summary.viaCount, 1)
    assert.equal(model.summary.regionCount, 1)
    assert.equal(model.summary.rawRecordCount, 7)
    assert.equal(model.pcbLibrary.footprints[0].primitiveCount, 4)
    assert.equal(model.pcbLibrary.footprints[0].rawRecords.length, 5)
    assert.equal(model.pcbLibrary.footprints[0].rawRecords[4].type, 'unknown')
    assert.equal(model.pcbLibrary.footprints[0].componentParams.padCount, 1)
    assert.equal(
        model.pcbLibrary.footprints[1].componentParams.description,
        'Synthetic mechanical outline footprint'
    )
    assert.deepEqual(
        model.pcbLibrary.footprints.flatMap((footprint) =>
            footprint.primitiveOrder.map((entry) => entry.type)
        ),
        ['pad', 'track', 'arc', 'fill', 'via', 'region']
    )
    assert.equal(model.bom.length, 0)
})
