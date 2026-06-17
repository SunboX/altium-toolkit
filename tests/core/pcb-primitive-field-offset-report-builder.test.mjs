// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies parser consumers can build byte-offset evidence from preserved raw
 * primitive records without re-slicing the native stream.
 */
test('PcbPrimitiveFieldOffsetReportBuilder reports default primitive field offsets', async () => {
    const { PcbPrimitiveFieldOffsetReportBuilder } =
        await import('../../src/parser.mjs')

    const report = PcbPrimitiveFieldOffsetReportBuilder.build({
        fileName: 'offset-map.PcbDoc',
        rawRecords: [
            {
                sourceStream: 'Tracks6/Data',
                family: 'tracks',
                type: 'track',
                typeId: 4,
                recordIndex: 2,
                offset: 120,
                byteLength: 54,
                payloadByteLength: 49,
                encoding: 'length-prefixed'
            }
        ]
    })

    assert.equal(report.schema, 'altium-toolkit.pcb.primitive-field-offsets.a1')
    assert.deepEqual(report.summary, {
        recordCount: 1,
        mappedRecordCount: 1,
        fieldCount: 14,
        streamCount: 1,
        unmatchedRecordCount: 0
    })
    assert.deepEqual(report.streams, [
        {
            sourceStream: 'Tracks6/Data',
            recordCount: 1,
            fieldCount: 14,
            fieldNames: [
                'layerId',
                'flags',
                'keepout',
                'netIndex',
                'polygonIndex',
                'componentIndex',
                'x1',
                'y1',
                'x2',
                'y2',
                'width',
                'unionIndex',
                'lengthTuning',
                'userRouted'
            ]
        }
    ])
    assert.deepEqual(
        report.fields
            .filter((field) => ['layerId', 'x1', 'width'].includes(field.name))
            .map((field) => ({
                sourceStream: field.sourceStream,
                recordIndex: field.recordIndex,
                name: field.name,
                relativeTo: field.relativeTo,
                offset: field.offset,
                absoluteOffset: field.absoluteOffset,
                byteLength: field.byteLength,
                encoding: field.encoding,
                available: field.available
            })),
        [
            {
                sourceStream: 'Tracks6/Data',
                recordIndex: 2,
                name: 'layerId',
                relativeTo: 'payload',
                offset: 0,
                absoluteOffset: 125,
                byteLength: 1,
                encoding: 'uint8',
                available: true
            },
            {
                sourceStream: 'Tracks6/Data',
                recordIndex: 2,
                name: 'x1',
                relativeTo: 'payload',
                offset: 13,
                absoluteOffset: 138,
                byteLength: 4,
                encoding: 'mil-int32-le',
                available: true
            },
            {
                sourceStream: 'Tracks6/Data',
                recordIndex: 2,
                name: 'width',
                relativeTo: 'payload',
                offset: 29,
                absoluteOffset: 154,
                byteLength: 4,
                encoding: 'mil-int32-le',
                available: true
            }
        ]
    )
})

/**
 * Verifies callers can supply focused field maps for partially decoded or
 * experimental primitive streams.
 */
test('PcbPrimitiveFieldOffsetReportBuilder accepts custom field maps', async () => {
    const { PcbPrimitiveFieldOffsetReportBuilder } =
        await import('../../src/parser.mjs')

    const report = PcbPrimitiveFieldOffsetReportBuilder.build({
        rawRecords: [
            {
                sourceStream: 'Custom6/Data',
                family: 'custom',
                type: 'custom',
                recordIndex: 0,
                offset: 32,
                byteLength: 8,
                encoding: 'fixed'
            }
        ],
        fieldMaps: [
            {
                sourceStream: 'Custom6/Data',
                relativeTo: 'record',
                fields: [
                    {
                        name: 'marker',
                        offset: 0,
                        byteLength: 1,
                        encoding: 'uint8'
                    },
                    {
                        name: 'tail',
                        offset: 6,
                        byteLength: 4,
                        encoding: 'bytes'
                    }
                ]
            }
        ]
    })

    assert.deepEqual(report.summary, {
        recordCount: 1,
        mappedRecordCount: 1,
        fieldCount: 2,
        streamCount: 1,
        unmatchedRecordCount: 0
    })
    assert.deepEqual(
        report.fields.map((field) => ({
            name: field.name,
            absoluteOffset: field.absoluteOffset,
            available: field.available
        })),
        [
            { name: 'marker', absoluteOffset: 32, available: true },
            { name: 'tail', absoluteOffset: 38, available: false }
        ]
    )
})
