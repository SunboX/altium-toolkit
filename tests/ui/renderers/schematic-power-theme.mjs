// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { unzlibSync, zlibSync } from 'fflate'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies black source power-diagram connectivity uses the app schematic
 * palette instead of the generic text color.
 */
test('renderSchematicSvg themes black power-diagram wires and power ports', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Power palette schematic' },
        schematic: {
            sheet: { width: 180, height: 120 },
            lines: [
                {
                    x1: 40,
                    y1: 60,
                    x2: 90,
                    y2: 60,
                    color: '#000000',
                    width: 1,
                    recordType: '27'
                },
                {
                    x1: 90,
                    y1: 60,
                    x2: 140,
                    y2: 60,
                    color: '#000000',
                    width: 1,
                    recordType: '27'
                },
                {
                    x1: 90,
                    y1: 40,
                    x2: 90,
                    y2: 60,
                    color: '#000000',
                    width: 1,
                    recordType: '27'
                }
            ],
            texts: [
                {
                    x: 90,
                    y: 60,
                    text: 'VCC1P8_LMS',
                    color: '#000000',
                    hidden: false,
                    recordType: '17',
                    style: 2,
                    fontSize: 18,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    powerPortDirection: 'up',
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<line x1="40" y1="60" x2="90" y2="60" stroke="var\(--schematic-default-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="90" cy="60" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
    assert.match(
        markup,
        /<g class="schematic-power-port schematic-power-port--rail" stroke-linecap="round"><line x1="90" y1="60" x2="90" y2="48" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="90" y="46" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="17"/
    )
})

/**
 * Verifies power-diagram PNG artwork stays source-colored unless the renderer
 * explicitly enables image colorization.
 */
test('renderSchematicSvg leaves power-diagram images source-colored by default', () => {
    const sourcePng = buildSyntheticPowerDiagramPng()
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Embedded power chart' },
        schematic: {
            sheet: { width: 120, height: 80 },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            images: [
                {
                    x: 0,
                    y: 0,
                    cornerX: 120,
                    cornerY: 80,
                    fileName: 'C:\\neutral\\generic_power_diagram.png',
                    mimeType: 'image/png',
                    dataBase64: sourcePng,
                    diagnosticState: 'embedded'
                }
            ]
        }
    })
    const embeddedPng = extractFirstPngImageBase64(markup)
    const decoded = decodeNoFilterRgbaPng(embeddedPng)

    assert.match(markup, /schematic-embedded-image--power-diagram/)
    assert.equal(embeddedPng, sourcePng)
    assert.deepEqual(readPixel(decoded, 10, 32), [0, 0, 0, 255])
    assert.deepEqual(readPixel(decoded, 24, 6), [0, 0, 0, 255])
    assert.deepEqual(readPixel(decoded, 88, 36), [255, 204, 204, 255])
})

/**
 * Verifies power-diagram PNG artwork is recolored selectively when enabled:
 * power labels become orange, connected linework becomes blue, and colored
 * block contents stay source-colored.
 */
test('renderSchematicSvg themes power-diagram images without tinting blocks when enabled', () => {
    const sourcePng = buildSyntheticPowerDiagramPng()
    const markup = SchematicSvgRenderer.render(
        {
            summary: { title: 'Embedded power chart' },
            schematic: {
                sheet: { width: 120, height: 80 },
                lines: [],
                texts: [],
                components: [],
                pins: [],
                ports: [],
                crosses: [],
                images: [
                    {
                        x: 0,
                        y: 0,
                        cornerX: 120,
                        cornerY: 80,
                        fileName: 'C:\\neutral\\generic_power_diagram.png',
                        mimeType: 'image/png',
                        dataBase64: sourcePng,
                        diagnosticState: 'embedded'
                    }
                ]
            }
        },
        { colorizeImages: true }
    )
    const processedPng = extractFirstPngImageBase64(markup)
    const decoded = decodeNoFilterRgbaPng(processedPng)

    assert.match(markup, /schematic-embedded-image--power-diagram/)
    assert.doesNotMatch(
        markup,
        /filter="url\(#schematic-blueprint-image-filter\)"/
    )
    assert.deepEqual(readPixel(decoded, 10, 32), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 26, 32), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 26, 14), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 26, 18), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 24, 6), [0xa8, 0x4a, 0x12, 255])
    assert.deepEqual(readPixel(decoded, 26, 48), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 26, 52), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 38, 68), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 59, 68), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 88, 73), [0x00, 0x91, 0xac, 255])
    assert.deepEqual(readPixel(decoded, 86, 42), [0, 0, 0, 255])
    assert.deepEqual(readPixel(decoded, 88, 36), [255, 204, 204, 255])
})

/**
 * Builds a small fake power-diagram PNG.
 * @returns {string}
 */
function buildSyntheticPowerDiagramPng() {
    const width = 120
    const height = 90
    const rgba = new Uint8Array(width * height * 4)

    fillRectangle(rgba, width, 0, 0, width, height, [230, 230, 230, 255])
    fillRectangle(rgba, width, 70, 30, 36, 26, [255, 204, 204, 255])
    strokeRectangle(rgba, width, 68, 28, 40, 30, [0, 0, 0, 255])
    fillRectangle(rgba, width, 82, 42, 8, 3, [0, 0, 0, 255])
    fillRectangle(rgba, width, 18, 5, 19, 4, [0, 0, 0, 255])
    fillRectangle(rgba, width, 20, 14, 13, 2, [0, 0, 0, 255])
    fillRectangle(rgba, width, 25, 14, 3, 19, [0, 0, 0, 255])
    fillRectangle(rgba, width, 8, 32, 72, 3, [0, 0, 0, 255])
    fillRectangle(rgba, width, 25, 32, 3, 29, [0, 0, 0, 255])
    fillRectangle(rgba, width, 20, 44, 13, 2, [0, 0, 0, 255])
    fillRectangle(rgba, width, 8, 60, 72, 3, [0, 0, 0, 255])
    fillRectangle(rgba, width, 25, 60, 3, 10, [0, 0, 0, 255])
    fillRectangle(rgba, width, 24, 66, 5, 5, [0, 0, 0, 255])
    fillRectangle(rgba, width, 34, 68, 14, 2, [0, 0, 0, 255])
    fillRectangle(rgba, width, 55, 68, 14, 2, [0, 0, 0, 255])
    fillRectangle(rgba, width, 76, 68, 14, 2, [0, 0, 0, 255])
    fillRectangle(rgba, width, 88, 72, 2, 12, [0, 0, 0, 255])

    return encodeNoFilterRgbaPng(width, height, rgba)
}

/**
 * Fills one rectangle in an RGBA buffer.
 * @param {Uint8Array} rgba RGBA buffer.
 * @param {number} width Image width.
 * @param {number} x Left.
 * @param {number} y Top.
 * @param {number} rectangleWidth Rectangle width.
 * @param {number} rectangleHeight Rectangle height.
 * @param {number[]} color RGBA color.
 */
function fillRectangle(
    rgba,
    width,
    x,
    y,
    rectangleWidth,
    rectangleHeight,
    color
) {
    for (let py = y; py < y + rectangleHeight; py += 1) {
        for (let px = x; px < x + rectangleWidth; px += 1) {
            const offset = (py * width + px) * 4
            rgba.set(color, offset)
        }
    }
}

/**
 * Draws a one-pixel rectangle outline.
 * @param {Uint8Array} rgba RGBA buffer.
 * @param {number} width Image width.
 * @param {number} x Left.
 * @param {number} y Top.
 * @param {number} rectangleWidth Rectangle width.
 * @param {number} rectangleHeight Rectangle height.
 * @param {number[]} color RGBA color.
 */
function strokeRectangle(
    rgba,
    width,
    x,
    y,
    rectangleWidth,
    rectangleHeight,
    color
) {
    fillRectangle(rgba, width, x, y, rectangleWidth, 1, color)
    fillRectangle(
        rgba,
        width,
        x,
        y + rectangleHeight - 1,
        rectangleWidth,
        1,
        color
    )
    fillRectangle(rgba, width, x, y, 1, rectangleHeight, color)
    fillRectangle(
        rgba,
        width,
        x + rectangleWidth - 1,
        y,
        1,
        rectangleHeight,
        color
    )
}

/**
 * Extracts the first embedded PNG data URL from SVG markup.
 * @param {string} markup SVG markup.
 * @returns {string}
 */
function extractFirstPngImageBase64(markup) {
    const match = markup.match(/href="data:image\/png;base64,([^"]+)"/)

    assert.ok(match)

    return match[1]
}

/**
 * Encodes an RGBA image as a no-filter PNG.
 * @param {number} width Image width.
 * @param {number} height Image height.
 * @param {Uint8Array} rgba RGBA pixels.
 * @returns {string}
 */
function encodeNoFilterRgbaPng(width, height, rgba) {
    const rowLength = width * 4
    const raw = new Uint8Array((rowLength + 1) * height)

    for (let y = 0; y < height; y += 1) {
        raw[y * (rowLength + 1)] = 0
        raw.set(
            rgba.subarray(y * rowLength, (y + 1) * rowLength),
            y * (rowLength + 1) + 1
        )
    }

    return Buffer.from(
        concatByteArrays([
            Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            pngChunk('IHDR', pngHeader(width, height)),
            pngChunk('IDAT', zlibSync(raw, { level: 1 })),
            pngChunk('IEND', new Uint8Array())
        ])
    ).toString('base64')
}

/**
 * Decodes a no-filter RGBA PNG.
 * @param {string} base64 PNG base64.
 * @returns {{ width: number, height: number, rgba: Uint8Array }}
 */
function decodeNoFilterRgbaPng(base64) {
    const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
    const chunks = readPngChunks(bytes)
    const header = chunks.find((chunk) => chunk.type === 'IHDR')?.data
    const idat = concatByteArrays(
        chunks
            .filter((chunk) => chunk.type === 'IDAT')
            .map((chunk) => chunk.data)
    )

    assert.ok(header)

    const headerView = new DataView(
        header.buffer,
        header.byteOffset,
        header.byteLength
    )
    const width = headerView.getUint32(0, false)
    const height = headerView.getUint32(4, false)
    const rowLength = width * 4
    const raw = unzlibSync(idat)
    const rgba = new Uint8Array(width * height * 4)

    for (let y = 0; y < height; y += 1) {
        assert.equal(raw[y * (rowLength + 1)], 0)
        rgba.set(
            raw.subarray(
                y * (rowLength + 1) + 1,
                y * (rowLength + 1) + 1 + rowLength
            ),
            y * rowLength
        )
    }

    return { width, height, rgba }
}

/**
 * Reads one pixel from decoded RGBA data.
 * @param {{ width: number, rgba: Uint8Array }} decoded Decoded image.
 * @param {number} x Pixel x.
 * @param {number} y Pixel y.
 * @returns {number[]}
 */
function readPixel(decoded, x, y) {
    const offset = (y * decoded.width + x) * 4

    return Array.from(decoded.rgba.subarray(offset, offset + 4))
}

/**
 * Builds PNG IHDR chunk data.
 * @param {number} width Image width.
 * @param {number} height Image height.
 * @returns {Uint8Array}
 */
function pngHeader(width, height) {
    const header = new Uint8Array(13)
    const view = new DataView(header.buffer)

    view.setUint32(0, width, false)
    view.setUint32(4, height, false)
    header[8] = 8
    header[9] = 6

    return header
}

/**
 * Builds one PNG chunk.
 * @param {string} type Chunk type.
 * @param {Uint8Array} data Chunk data.
 * @returns {Uint8Array}
 */
function pngChunk(type, data) {
    const typeBytes = new TextEncoder().encode(type)
    const chunk = new Uint8Array(12 + data.length)
    const view = new DataView(chunk.buffer)

    view.setUint32(0, data.length, false)
    chunk.set(typeBytes, 4)
    chunk.set(data, 8)
    view.setUint32(
        8 + data.length,
        crc32(concatByteArrays([typeBytes, data])),
        false
    )

    return chunk
}

/**
 * Reads PNG chunks without validating checksums.
 * @param {Uint8Array} bytes PNG bytes.
 * @returns {{ type: string, data: Uint8Array }[]}
 */
function readPngChunks(bytes) {
    const chunks = []
    let offset = 8

    while (offset + 12 <= bytes.length) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset)
        const length = view.getUint32(0, false)
        const type = String.fromCharCode(
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7]
        )
        const dataStart = offset + 8
        const dataEnd = dataStart + length
        chunks.push({ type, data: bytes.slice(dataStart, dataEnd) })
        offset = dataEnd + 4
        if (type === 'IEND') break
    }

    return chunks
}

/**
 * Computes PNG CRC-32.
 * @param {Uint8Array} bytes Bytes to checksum.
 * @returns {number}
 */
function crc32(bytes) {
    let crc = 0xffffffff

    for (const byte of bytes) {
        crc ^= byte
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
        }
    }

    return (crc ^ 0xffffffff) >>> 0
}

/**
 * Concatenates byte arrays.
 * @param {Uint8Array[]} chunks Byte arrays.
 * @returns {Uint8Array}
 */
function concatByteArrays(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const output = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
        output.set(chunk, offset)
        offset += chunk.length
    }

    return output
}
