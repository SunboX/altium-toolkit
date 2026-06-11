// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import test from 'node:test'
import { zlibSync } from 'fflate'
import { PcbEmbeddedFontExtractor } from '../../src/core/altium/PcbEmbeddedFontExtractor.mjs'
import { PcbFontMetricsParser } from '../../src/core/altium/PcbFontMetricsParser.mjs'
import { PcbLibModelParser } from '../../src/core/altium/PcbLibModelParser.mjs'
import { PcbLibStreamExtractor } from '../../src/core/altium/PcbLibStreamExtractor.mjs'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'
import { PcbStreamExtractor } from '../../src/core/altium/PcbStreamExtractor.mjs'

/**
 * Builds synthetic embedded font streams and minimal sfnt payloads.
 */
class PcbEmbeddedFontTestFactory {
    /**
     * Creates a PCB stream map with one embedded font stream.
     * @returns {Map<string, Uint8Array>}
     */
    static createPcbStreamMap() {
        return new Map([
            [
                'EmbeddedFonts6/Data',
                PcbEmbeddedFontTestFactory.createEmbeddedFontStream()
            ]
        ])
    }

    /**
     * Creates a PcbLib stream map with one embedded font stream.
     * @returns {Map<string, Uint8Array>}
     */
    static createPcbLibStreamMap() {
        return new Map([
            [
                'Library/Data',
                PcbEmbeddedFontTestFactory.#lengthPrefixedText('')
            ],
            [
                'Library/EmbeddedFonts',
                PcbEmbeddedFontTestFactory.createEmbeddedFontStream()
            ]
        ])
    }

    /**
     * Creates one stream with two records and one duplicate payload record.
     * @returns {Uint8Array}
     */
    static createEmbeddedFontStream() {
        const regularFont = PcbEmbeddedFontTestFactory.createMinimalSfnt({
            unitsPerEm: 1000,
            ascent: 760,
            descent: -240,
            lineGap: 40,
            averageAdvanceWidth: 510,
            capHeight: 690,
            weightClass: 400
        })
        const boldFont = PcbEmbeddedFontTestFactory.createMinimalSfnt({
            unitsPerEm: 2048,
            ascent: 1536,
            descent: -512,
            lineGap: 0,
            averageAdvanceWidth: 990,
            capHeight: 1400,
            weightClass: 700
        })
        const regularRecord = PcbEmbeddedFontTestFactory.#fontRecord({
            family: 'Synthetic Sans',
            alternateFamily: 'Synthetic Sans',
            style: '',
            payload: regularFont,
            metadataBytes: [0x0d, 0x00]
        })
        const duplicateRecord = PcbEmbeddedFontTestFactory.#fontRecord({
            family: 'Synthetic Sans',
            alternateFamily: 'Synthetic Sans',
            style: '',
            payload: regularFont,
            metadataBytes: [0x0d, 0x00]
        })
        const boldRecord = PcbEmbeddedFontTestFactory.#fontRecord({
            family: 'Synthetic Sans Bold',
            alternateFamily: 'Synthetic Sans',
            style: '',
            payload: boldFont,
            metadataBytes: [0x01, 0x02, 0x03]
        })

        return PcbEmbeddedFontTestFactory.#concat([
            regularRecord,
            duplicateRecord,
            boldRecord
        ])
    }

    /**
     * Creates a stream with large compressed sfnt payloads.
     * @returns {Uint8Array}
     */
    static createLargeEmbeddedFontStream() {
        const firstFont = PcbEmbeddedFontTestFactory.createMinimalSfnt(
            {
                unitsPerEm: 1000,
                ascent: 760,
                descent: -240,
                lineGap: 40,
                averageAdvanceWidth: 510,
                capHeight: 690,
                weightClass: 400
            },
            { extraTableByteCount: 5 * 1024 * 1024 }
        )
        const secondFont = PcbEmbeddedFontTestFactory.createMinimalSfnt(
            {
                unitsPerEm: 1000,
                ascent: 760,
                descent: -240,
                lineGap: 40,
                averageAdvanceWidth: 520,
                capHeight: 700,
                weightClass: 700
            },
            { extraTableByteCount: 5 * 1024 * 1024 }
        )

        return PcbEmbeddedFontTestFactory.#concat([
            PcbEmbeddedFontTestFactory.#fontRecord({
                family: 'Large Synthetic Sans',
                alternateFamily: 'Large Synthetic Sans',
                style: '',
                payload: firstFont,
                metadataBytes: [0x01],
                compressionOptions: { level: 0 }
            }),
            PcbEmbeddedFontTestFactory.#fontRecord({
                family: 'Large Synthetic Sans Bold',
                alternateFamily: 'Large Synthetic Sans',
                style: '',
                payload: secondFont,
                metadataBytes: [0x02],
                compressionOptions: { level: 0 }
            })
        ])
    }

    /**
     * Creates a minimal sfnt font with only metric-bearing tables.
     * @param {{ unitsPerEm: number, ascent: number, descent: number, lineGap: number, averageAdvanceWidth: number, capHeight: number, weightClass: number }} metrics
     * @param {{ extraTableByteCount?: number }} [options]
     * @returns {Uint8Array}
     */
    static createMinimalSfnt(metrics, options = {}) {
        const tables = [
            ['head', PcbEmbeddedFontTestFactory.#headTable(metrics)],
            ['hhea', PcbEmbeddedFontTestFactory.#hheaTable(metrics)],
            ['OS/2', PcbEmbeddedFontTestFactory.#os2Table(metrics)],
            ['hmtx', PcbEmbeddedFontTestFactory.#hmtxTable(metrics)]
        ]
        if (Number(options.extraTableByteCount || 0) > 0) {
            tables.push([
                'JUNK',
                PcbEmbeddedFontTestFactory.#deterministicBytes(
                    Number(options.extraTableByteCount || 0)
                )
            ])
        }
        const headerLength = 12 + tables.length * 16
        let payloadOffset = headerLength
        const tableRecords = []
        const tablePayloads = []

        for (const [tag, tableBytes] of tables) {
            const paddedTable =
                PcbEmbeddedFontTestFactory.#padToFour(tableBytes)
            tableRecords.push({ tag, offset: payloadOffset, tableBytes })
            tablePayloads.push(paddedTable)
            payloadOffset += paddedTable.byteLength
        }

        const bytes = new Uint8Array(payloadOffset)
        const view = new DataView(bytes.buffer)
        view.setUint32(0, 0x00010000, false)
        view.setUint16(4, tables.length, false)
        let recordOffset = 12

        for (const record of tableRecords) {
            bytes.set(new TextEncoder().encode(record.tag), recordOffset)
            view.setUint32(recordOffset + 4, 0, false)
            view.setUint32(recordOffset + 8, record.offset, false)
            view.setUint32(
                recordOffset + 12,
                record.tableBytes.byteLength,
                false
            )
            recordOffset += 16
        }

        let writeOffset = headerLength
        for (const tablePayload of tablePayloads) {
            bytes.set(tablePayload, writeOffset)
            writeOffset += tablePayload.byteLength
        }

        return bytes
    }

    /**
     * Creates an embedded-font record with UTF-16LE metadata and zlib payload.
     * @param {{ family: string, alternateFamily: string, style: string, payload: Uint8Array, metadataBytes?: number[], compressionOptions?: object }} options
     * @returns {Uint8Array}
     */
    static #fontRecord(options) {
        return PcbEmbeddedFontTestFactory.#concat([
            PcbEmbeddedFontTestFactory.#utf16Field(options.family),
            PcbEmbeddedFontTestFactory.#utf16Field(options.alternateFamily),
            PcbEmbeddedFontTestFactory.#utf16Field(options.style),
            new Uint8Array(options.metadataBytes || []),
            zlibSync(options.payload, options.compressionOptions)
        ])
    }

    /**
     * Builds deterministic incompressible-ish bytes for large sfnt padding.
     * @param {number} byteCount Number of bytes.
     * @returns {Uint8Array}
     */
    static #deterministicBytes(byteCount) {
        const bytes = new Uint8Array(byteCount)
        let state = 0x12345678

        for (let index = 0; index < bytes.byteLength; index += 1) {
            state = (1664525 * state + 1013904223) >>> 0
            bytes[index] = state & 0xff
        }

        return bytes
    }

    /**
     * Creates one length-prefixed UTF-8 text stream.
     * @param {string} text
     * @returns {Uint8Array}
     */
    static #lengthPrefixedText(text) {
        const textBytes = new TextEncoder().encode(text)
        const bytes = new Uint8Array(4 + textBytes.byteLength)
        new DataView(bytes.buffer).setUint32(0, textBytes.byteLength, true)
        bytes.set(textBytes, 4)
        return bytes
    }

    /**
     * Creates one length-prefixed UTF-16LE field.
     * @param {string} text
     * @returns {Uint8Array}
     */
    static #utf16Field(text) {
        const fieldBytes = new Uint8Array(Buffer.from(text, 'utf16le'))
        const bytes = new Uint8Array(4 + fieldBytes.byteLength)
        new DataView(bytes.buffer).setUint32(0, fieldBytes.byteLength, true)
        bytes.set(fieldBytes, 4)
        return bytes
    }

    /**
     * Creates a minimal `head` table.
     * @param {{ unitsPerEm: number }} metrics
     * @returns {Uint8Array}
     */
    static #headTable(metrics) {
        const bytes = new Uint8Array(54)
        new DataView(bytes.buffer).setUint16(18, metrics.unitsPerEm, false)
        return bytes
    }

    /**
     * Creates a minimal `hhea` table.
     * @param {{ ascent: number, descent: number, lineGap: number }} metrics
     * @returns {Uint8Array}
     */
    static #hheaTable(metrics) {
        const bytes = new Uint8Array(36)
        const view = new DataView(bytes.buffer)
        view.setInt16(4, metrics.ascent, false)
        view.setInt16(6, metrics.descent, false)
        view.setInt16(8, metrics.lineGap, false)
        view.setUint16(34, 1, false)
        return bytes
    }

    /**
     * Creates a minimal `OS/2` table.
     * @param {{ averageAdvanceWidth: number, capHeight: number, weightClass: number }} metrics
     * @returns {Uint8Array}
     */
    static #os2Table(metrics) {
        const bytes = new Uint8Array(90)
        const view = new DataView(bytes.buffer)
        view.setUint16(0, 2, false)
        view.setInt16(2, metrics.averageAdvanceWidth, false)
        view.setUint16(4, metrics.weightClass, false)
        view.setUint16(6, 5, false)
        view.setInt16(88, metrics.capHeight, false)
        return bytes
    }

    /**
     * Creates a minimal `hmtx` table.
     * @param {{ averageAdvanceWidth: number }} metrics
     * @returns {Uint8Array}
     */
    static #hmtxTable(metrics) {
        const bytes = new Uint8Array(4)
        const view = new DataView(bytes.buffer)
        view.setUint16(0, metrics.averageAdvanceWidth, false)
        view.setInt16(2, 0, false)
        return bytes
    }

    /**
     * Pads table payloads to the sfnt four-byte alignment.
     * @param {Uint8Array} bytes
     * @returns {Uint8Array}
     */
    static #padToFour(bytes) {
        const padded = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4)
        padded.set(bytes)
        return padded
    }

    /**
     * Concatenates byte arrays.
     * @param {Uint8Array[]} chunks
     * @returns {Uint8Array}
     */
    static #concat(chunks) {
        const bytes = new Uint8Array(
            chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
        )
        let offset = 0

        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return bytes
    }
}

/**
 * Verifies sfnt font metric tables are decoded without relying on real fonts.
 */
test('PcbFontMetricsParser reads sfnt metrics used for PCB text sizing', () => {
    const fontBytes = PcbEmbeddedFontTestFactory.createMinimalSfnt({
        unitsPerEm: 1000,
        ascent: 760,
        descent: -240,
        lineGap: 40,
        averageAdvanceWidth: 510,
        capHeight: 690,
        weightClass: 400
    })

    assert.deepEqual(PcbFontMetricsParser.parse(fontBytes), {
        format: 'truetype',
        unitsPerEm: 1000,
        ascent: 760,
        descent: -240,
        lineGap: 40,
        cellHeight: 1000,
        emScaleFromPcbHeight: 1,
        capHeight: 690,
        averageAdvanceWidth: 510,
        weightClass: 400,
        widthClass: 5,
        windowsAscent: 0,
        windowsDescent: 0
    })
})

/**
 * Verifies embedded PCB fonts are extracted, decompressed, measured, and
 * deduplicated by metadata and compressed payload identity.
 */
test('PcbEmbeddedFontExtractor extracts embedded font payloads and metrics', () => {
    const extracted = PcbEmbeddedFontExtractor.extractFromStreams(
        PcbEmbeddedFontTestFactory.createPcbStreamMap()
    )

    assert.equal(extracted.fonts.length, 2)
    assert.equal(extracted.fonts[0].name, 'Synthetic Sans')
    assert.equal(extracted.fonts[0].style, 'Regular')
    assert.equal(extracted.fonts[0].fileName, 'Synthetic Sans.ttf')
    assert.equal(extracted.fonts[0].sourceStream, 'EmbeddedFonts6/Data')
    assert.equal(extracted.fonts[0].format, 'truetype')
    assert.equal(extracted.fonts[0].mimeType, 'font/ttf')
    assert.equal(extracted.fonts[0].metrics.unitsPerEm, 1000)
    assert.equal(extracted.fonts[0].metrics.averageAdvanceWidth, 510)
    assert.ok(extracted.fonts[0].payloadBase64.length > 0)
    assert.equal(extracted.fonts[1].name, 'Synthetic Sans')
    assert.equal(extracted.fonts[1].style, 'Bold')
    assert.equal(extracted.fonts[1].fileName, 'Synthetic Sans-Bold.ttf')
    assert.equal(extracted.fonts[1].metrics.weightClass, 700)
})

/**
 * Verifies large embedded-font streams avoid repeated full-payload inflation
 * while locating compressed record boundaries.
 */
test('PcbEmbeddedFontExtractor locates large compressed font records quickly', () => {
    const stream = PcbEmbeddedFontTestFactory.createLargeEmbeddedFontStream()
    const startedAt = performance.now()
    const extracted = PcbEmbeddedFontExtractor.extractFromBytes(stream)
    const durationMs = performance.now() - startedAt

    assert.equal(extracted.length, 2)
    assert.ok(
        durationMs < 240,
        'expected large embedded font extraction below 240ms, got ' +
            durationMs.toFixed(1) +
            'ms'
    )
})

/**
 * Verifies PcbDoc stream extraction exposes embedded font metadata.
 */
test('PcbStreamExtractor includes embedded PCB font streams', () => {
    const extracted = PcbStreamExtractor.extractFromStreams(
        PcbEmbeddedFontTestFactory.createPcbStreamMap()
    )

    assert.deepEqual(extracted.streamNames, ['EmbeddedFonts6/Data'])
    assert.equal(extracted.embeddedFonts.fonts.length, 2)
    assert.equal(extracted.diagnostics.embeddedFontCount, 2)
})

/**
 * Verifies normalized PcbDoc models carry embedded fonts and font counters.
 */
test('PcbModelParser exposes embedded PCB fonts in the normalized model', () => {
    const extraction = PcbStreamExtractor.extractFromStreams(
        PcbEmbeddedFontTestFactory.createPcbStreamMap()
    )
    const model = PcbModelParser.parse('synthetic-board.PcbDoc', [], extraction)

    assert.equal(model.summary.embeddedFontCount, 2)
    assert.equal(model.pcb.embeddedFonts.length, 2)
    assert.equal(model.pcb.embeddedFonts[0].metrics.cellHeight, 1000)
    assert.ok(
        model.diagnostics.some((diagnostic) =>
            diagnostic.message.includes('embedded PCB font payloads')
        )
    )
})

/**
 * Verifies PcbLib stream extraction uses the same embedded-font workflow.
 */
test('PcbLib extraction and models expose embedded library fonts', () => {
    const extraction = PcbLibStreamExtractor.extractFromStreams(
        PcbEmbeddedFontTestFactory.createPcbLibStreamMap()
    )
    const model = PcbLibModelParser.parse(
        'synthetic-library.PcbLib',
        extraction
    )

    assert.deepEqual(extraction.streamNames, [
        'Library/Data',
        'Library/EmbeddedFonts'
    ])
    assert.equal(extraction.embeddedFonts.fonts.length, 2)
    assert.equal(model.summary.embeddedFontCount, 2)
    assert.equal(model.pcbLibrary.embeddedFonts.length, 2)
})
