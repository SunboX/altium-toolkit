// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { unzlibSync, zlibSync } from 'fflate'
import { SchematicPowerDiagramLineMasks } from './SchematicPowerDiagramLineMasks.mjs'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const BLUE = [0x00, 0x91, 0xac]
const ORANGE = [0xa8, 0x4a, 0x12]
const MAX_CACHE_ENTRIES = 8

/**
 * Applies schematic palette hints to recovered bitmap power diagrams.
 */
export class SchematicPowerDiagramImageProcessor {
    static #processedCache = new Map()

    /**
     * Processes one embedded PNG payload and returns a replacement base64 body.
     * Unsupported images are returned unchanged.
     * @param {{ dataBase64?: string, mimeType?: string }} image Embedded image.
     * @returns {string}
     */
    static process(image) {
        const dataBase64 = String(image?.dataBase64 || '')

        if (!dataBase64 || image?.mimeType !== 'image/png') {
            return dataBase64
        }

        if (
            SchematicPowerDiagramImageProcessor.#processedCache.has(dataBase64)
        ) {
            return SchematicPowerDiagramImageProcessor.#processedCache.get(
                dataBase64
            )
        }

        try {
            const png = SchematicPowerDiagramImageProcessor.#decodePngRgba(
                SchematicPowerDiagramImageProcessor.#decodeBase64(dataBase64)
            )
            SchematicPowerDiagramImageProcessor.#recolorPowerDiagram(png)
            const processed = SchematicPowerDiagramImageProcessor.#encodeBase64(
                SchematicPowerDiagramImageProcessor.#encodePngRgba(png)
            )

            SchematicPowerDiagramImageProcessor.#cacheResult(
                dataBase64,
                processed
            )

            return processed
        } catch {
            return dataBase64
        }
    }

    /**
     * Stores one processed result while bounding memory use.
     * @param {string} source Source base64.
     * @param {string} processed Processed base64.
     */
    static #cacheResult(source, processed) {
        SchematicPowerDiagramImageProcessor.#processedCache.set(
            source,
            processed
        )

        while (
            SchematicPowerDiagramImageProcessor.#processedCache.size >
            MAX_CACHE_ENTRIES
        ) {
            const oldestKey =
                SchematicPowerDiagramImageProcessor.#processedCache
                    .keys()
                    .next().value
            SchematicPowerDiagramImageProcessor.#processedCache.delete(
                oldestKey
            )
        }
    }

    /**
     * Recolors one decoded power-diagram bitmap in place.
     * @param {{ width: number, height: number, rgba: Uint8Array }} png PNG data.
     */
    static #recolorPowerDiagram(png) {
        const protectedMask =
            SchematicPowerDiagramImageProcessor.#buildProtectedMask(png)
        const darkMask = SchematicPowerDiagramImageProcessor.#buildDarkMask(
            png,
            protectedMask
        )
        const railMask =
            SchematicPowerDiagramImageProcessor.#buildHorizontalRailMask(
                png,
                darkMask
            )
        const orangeMask =
            SchematicPowerDiagramImageProcessor.#buildPowerPortMask(
                png,
                darkMask,
                railMask,
                protectedMask
            )
        const blueMask = SchematicPowerDiagramLineMasks.buildConnectedLineMask(
            png,
            darkMask,
            railMask
        )

        for (let index = 0; index < darkMask.length; index += 1) {
            if (!darkMask[index]) continue

            const offset = index * 4

            if (orangeMask[index]) {
                png.rgba[offset] = ORANGE[0]
                png.rgba[offset + 1] = ORANGE[1]
                png.rgba[offset + 2] = ORANGE[2]
            } else if (blueMask[index]) {
                png.rgba[offset] = BLUE[0]
                png.rgba[offset + 1] = BLUE[1]
                png.rgba[offset + 2] = BLUE[2]
            }
        }
    }

    /**
     * Protects colored block bodies and nearby black text/borders from
     * recoloring.
     * @param {{ width: number, height: number, rgba: Uint8Array }} png PNG data.
     * @returns {Uint8Array}
     */
    static #buildProtectedMask(png) {
        const colored = new Uint8Array(png.width * png.height)
        const radius = Math.max(
            5,
            Math.round(Math.min(png.width, png.height) * 0.006)
        )

        for (let index = 0; index < colored.length; index += 1) {
            const offset = index * 4
            if (
                png.rgba[offset + 3] > 127 &&
                SchematicPowerDiagramImageProcessor.#isColoredFillPixel(
                    png.rgba[offset],
                    png.rgba[offset + 1],
                    png.rgba[offset + 2]
                )
            ) {
                colored[index] = 1
            }
        }

        return SchematicPowerDiagramImageProcessor.#dilateMask(
            colored,
            png.width,
            png.height,
            radius
        )
    }

    /**
     * Builds a mask of dark source artwork outside protected colored blocks.
     * @param {{ rgba: Uint8Array }} png PNG data.
     * @param {Uint8Array} protectedMask Protected pixels.
     * @returns {Uint8Array}
     */
    static #buildDarkMask(png, protectedMask) {
        const darkMask = new Uint8Array(protectedMask.length)

        for (let index = 0; index < darkMask.length; index += 1) {
            if (protectedMask[index]) continue

            const offset = index * 4
            const red = png.rgba[offset]
            const green = png.rgba[offset + 1]
            const blue = png.rgba[offset + 2]

            if (png.rgba[offset + 3] > 127 && Math.max(red, green, blue) < 92) {
                darkMask[index] = 1
            }
        }

        return darkMask
    }

    /**
     * Builds a mask for long horizontal power rails and their junction dots.
     * @param {{ width: number, height: number }} png PNG data.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @returns {Uint8Array}
     */
    static #buildHorizontalRailMask(png, darkMask) {
        const blueMask = new Uint8Array(darkMask.length)
        const minimumRun = Math.max(24, Math.round(png.width * 0.04))
        const verticalRadius = Math.max(2, Math.round(png.height * 0.003))

        for (let y = 0; y < png.height; y += 1) {
            let x = 0

            while (x < png.width) {
                const start = x
                while (x < png.width && darkMask[y * png.width + x]) {
                    x += 1
                }

                if (x - start >= minimumRun) {
                    SchematicPowerDiagramImageProcessor.#markDarkWindow(
                        blueMask,
                        darkMask,
                        png.width,
                        png.height,
                        start,
                        y - verticalRadius,
                        x - 1,
                        y + verticalRadius
                    )
                }

                x = Math.max(x + 1, start + 1)
            }
        }

        return blueMask
    }

    /**
     * Builds a mask for detected power-port caps, stems, and labels.
     * @param {{ width: number, height: number }} png PNG data.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {Uint8Array} blueMask Rail pixels.
     * @param {Uint8Array} protectedMask Protected pixels.
     * @returns {Uint8Array}
     */
    static #buildPowerPortMask(png, darkMask, blueMask, protectedMask) {
        const orangeMask = new Uint8Array(darkMask.length)
        const minimumCap = Math.max(6, Math.round(png.width * 0.006))
        const maximumCap = Math.max(18, Math.round(png.width * 0.021))
        const maximumStem = Math.max(18, Math.round(png.height * 0.085))
        const stemRadius = Math.max(2, Math.round(png.width * 0.0012))
        const labelDetectionHalfWidth = Math.max(
            14,
            Math.round(png.width * 0.035)
        )
        const labelHalfWidth = Math.max(24, Math.round(png.width * 0.095))
        const labelHeight = Math.max(12, Math.round(png.height * 0.06))

        for (let y = 0; y < png.height; y += 1) {
            let x = 0

            while (x < png.width) {
                const start = x
                while (x < png.width && darkMask[y * png.width + x]) {
                    x += 1
                }

                const runLength = x - start
                if (runLength >= minimumCap && runLength <= maximumCap) {
                    const centerX = Math.round((start + x - 1) / 2)
                    const railY =
                        SchematicPowerDiagramImageProcessor.#findRailBelow(
                            blueMask,
                            darkMask,
                            png.width,
                            png.height,
                            centerX,
                            y,
                            maximumStem,
                            stemRadius
                        )

                    if (railY !== null) {
                        if (
                            !SchematicPowerDiagramImageProcessor.#hasPowerPortLabelAbove(
                                darkMask,
                                protectedMask,
                                png.width,
                                png.height,
                                centerX,
                                y,
                                labelDetectionHalfWidth,
                                labelHeight
                            )
                        ) {
                            x = Math.max(x + 1, start + 1)
                            continue
                        }

                        SchematicPowerDiagramImageProcessor.#markLabelWindow(
                            orangeMask,
                            darkMask,
                            protectedMask,
                            png.width,
                            png.height,
                            centerX - labelHalfWidth,
                            y - labelHeight,
                            centerX + labelHalfWidth,
                            y - stemRadius
                        )
                    }
                }

                x = Math.max(x + 1, start + 1)
            }
        }

        SchematicPowerDiagramLineMasks.removeNarrowLineComponents(
            orangeMask,
            png.width,
            png.height
        )

        return orangeMask
    }

    /**
     * Returns true when a cap candidate has label-like dark pixels above it.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {Uint8Array} protectedMask Protected pixels.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} centerX Cap center x.
     * @param {number} y Cap y.
     * @param {number} halfWidth Label search half-width.
     * @param {number} labelHeight Label search height.
     * @returns {boolean}
     */
    static #hasPowerPortLabelAbove(
        darkMask,
        protectedMask,
        width,
        height,
        centerX,
        y,
        halfWidth,
        labelHeight
    ) {
        const left = Math.max(0, Math.floor(centerX - halfWidth))
        const right = Math.min(width - 1, Math.ceil(centerX + halfWidth))
        const top = Math.max(0, Math.floor(y - labelHeight))
        const bottom = Math.min(height - 1, Math.ceil(y - 2))
        const minimumPixels = Math.max(32, Math.round(labelHeight * 1.5))
        const maximumLineSpan = Math.max(6, Math.round((right - left) * 0.85))
        let pixels = 0
        let wideRows = 0

        for (let row = top; row <= bottom; row += 1) {
            let rowPixels = 0
            let rowLeft = null
            let rowRight = null
            const rowOffset = row * width

            for (let column = left; column <= right; column += 1) {
                const index = rowOffset + column
                if (!darkMask[index] || protectedMask[index]) {
                    continue
                }

                rowPixels += 1
                rowLeft = rowLeft === null ? column : Math.min(rowLeft, column)
                rowRight =
                    rowRight === null ? column : Math.max(rowRight, column)
            }

            if (rowLeft === null || rowRight === null) continue

            const rowSpan = rowRight - rowLeft
            if (rowSpan >= maximumLineSpan) continue

            pixels += rowPixels

            if (rowSpan >= 5) {
                wideRows += 1
            }
        }

        return pixels >= minimumPixels && wideRows >= 2
    }

    /**
     * Finds the nearest blue rail below a candidate port cap.
     * @param {Uint8Array} blueMask Rail pixels.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} x Center x.
     * @param {number} y Start y.
     * @param {number} maximumStem Maximum stem length.
     * @param {number} radius Horizontal search radius.
     * @returns {number | null}
     */
    static #findRailBelow(
        blueMask,
        darkMask,
        width,
        height,
        x,
        y,
        maximumStem,
        radius
    ) {
        const endY = Math.min(height - 1, y + maximumStem)

        for (let candidateY = y + 3; candidateY <= endY; candidateY += 1) {
            if (
                !SchematicPowerDiagramImageProcessor.#windowHasMaskPixel(
                    blueMask,
                    width,
                    height,
                    x - radius,
                    candidateY,
                    x + radius,
                    candidateY
                )
            ) {
                continue
            }

            if (
                SchematicPowerDiagramImageProcessor.#verticalDarkCoverage(
                    darkMask,
                    width,
                    height,
                    x,
                    y,
                    candidateY,
                    radius
                ) >= 0.62
            ) {
                return candidateY
            }
        }

        return null
    }

    /**
     * Computes dark-pixel coverage along one vertical stem candidate.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} x Center x.
     * @param {number} y1 Start y.
     * @param {number} y2 End y.
     * @param {number} radius Horizontal radius.
     * @returns {number}
     */
    static #verticalDarkCoverage(darkMask, width, height, x, y1, y2, radius) {
        let coveredRows = 0
        const totalRows = Math.max(y2 - y1 + 1, 1)

        for (let y = Math.max(0, y1); y <= Math.min(height - 1, y2); y += 1) {
            if (
                SchematicPowerDiagramImageProcessor.#windowHasMaskPixel(
                    darkMask,
                    width,
                    height,
                    x - radius,
                    y,
                    x + radius,
                    y
                )
            ) {
                coveredRows += 1
            }
        }

        return coveredRows / totalRows
    }

    /**
     * Marks dark pixels within one rectangle.
     * @param {Uint8Array} target Target mask.
     * @param {Uint8Array} darkMask Dark source mask.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} x1 Left.
     * @param {number} y1 Top.
     * @param {number} x2 Right.
     * @param {number} y2 Bottom.
     */
    static #markDarkWindow(target, darkMask, width, height, x1, y1, x2, y2) {
        const left = Math.max(0, Math.floor(x1))
        const right = Math.min(width - 1, Math.ceil(x2))
        const top = Math.max(0, Math.floor(y1))
        const bottom = Math.min(height - 1, Math.ceil(y2))

        for (let y = top; y <= bottom; y += 1) {
            const rowOffset = y * width
            for (let x = left; x <= right; x += 1) {
                const index = rowOffset + x
                if (darkMask[index]) {
                    target[index] = 1
                }
            }
        }
    }

    /**
     * Marks dark label pixels while respecting protected colored boxes.
     * @param {Uint8Array} target Target mask.
     * @param {Uint8Array} darkMask Dark source mask.
     * @param {Uint8Array} protectedMask Protected pixels.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} x1 Left.
     * @param {number} y1 Top.
     * @param {number} x2 Right.
     * @param {number} y2 Bottom.
     */
    static #markLabelWindow(
        target,
        darkMask,
        protectedMask,
        width,
        height,
        x1,
        y1,
        x2,
        y2
    ) {
        const left = Math.max(0, Math.floor(x1))
        const right = Math.min(width - 1, Math.ceil(x2))
        const top = Math.max(0, Math.floor(y1))
        const bottom = Math.min(height - 1, Math.ceil(y2))

        for (let y = top; y <= bottom; y += 1) {
            const rowOffset = y * width
            for (let x = left; x <= right; x += 1) {
                const index = rowOffset + x
                if (darkMask[index] && !protectedMask[index]) {
                    target[index] = 1
                }
            }
        }
    }

    /**
     * Returns true when a mask contains any pixel in the given bounds.
     * @param {Uint8Array} mask Pixel mask.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} x1 Left.
     * @param {number} y1 Top.
     * @param {number} x2 Right.
     * @param {number} y2 Bottom.
     * @returns {boolean}
     */
    static #windowHasMaskPixel(mask, width, height, x1, y1, x2, y2) {
        const left = Math.max(0, Math.floor(x1))
        const right = Math.min(width - 1, Math.ceil(x2))
        const top = Math.max(0, Math.floor(y1))
        const bottom = Math.min(height - 1, Math.ceil(y2))

        for (let y = top; y <= bottom; y += 1) {
            const rowOffset = y * width
            for (let x = left; x <= right; x += 1) {
                if (mask[rowOffset + x]) {
                    return true
                }
            }
        }

        return false
    }

    /**
     * Expands a binary mask using a square window.
     * @param {Uint8Array} mask Input mask.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} radius Dilation radius.
     * @returns {Uint8Array}
     */
    static #dilateMask(mask, width, height, radius) {
        const horizontal = new Uint8Array(mask.length)
        const output = new Uint8Array(mask.length)

        for (let y = 0; y < height; y += 1) {
            let count = 0
            for (let x = 0; x < width; x += 1) {
                const addX = x + radius
                const removeX = x - radius - 1
                if (addX < width) count += mask[y * width + addX]
                if (removeX >= 0) count -= mask[y * width + removeX]
                if (count > 0) horizontal[y * width + x] = 1
            }
        }

        for (let x = 0; x < width; x += 1) {
            let count = 0
            for (let y = 0; y < height; y += 1) {
                const addY = y + radius
                const removeY = y - radius - 1
                if (addY < height) count += horizontal[addY * width + x]
                if (removeY >= 0) count -= horizontal[removeY * width + x]
                if (count > 0) output[y * width + x] = 1
            }
        }

        return output
    }

    /**
     * Returns true for colored block-fill pixels.
     * @param {number} red Red channel.
     * @param {number} green Green channel.
     * @param {number} blue Blue channel.
     * @returns {boolean}
     */
    static #isColoredFillPixel(red, green, blue) {
        const maximum = Math.max(red, green, blue)
        const minimum = Math.min(red, green, blue)

        return maximum > 120 && maximum - minimum > 18
    }

    /**
     * Decodes one non-interlaced 8-bit RGBA PNG.
     * @param {Uint8Array} bytes PNG bytes.
     * @returns {{ width: number, height: number, rgba: Uint8Array }}
     */
    static #decodePngRgba(bytes) {
        if (
            bytes.length < 33 ||
            !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
        ) {
            throw new Error('Unsupported PNG signature')
        }

        const chunks = SchematicPowerDiagramImageProcessor.#readPngChunks(bytes)
        const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')?.data
        if (!ihdr) throw new Error('Missing PNG header')

        const headerView = new DataView(
            ihdr.buffer,
            ihdr.byteOffset,
            ihdr.byteLength
        )
        const width = headerView.getUint32(0, false)
        const height = headerView.getUint32(4, false)

        if (
            ihdr[8] !== 8 ||
            ihdr[9] !== 6 ||
            ihdr[10] !== 0 ||
            ihdr[11] !== 0 ||
            ihdr[12] !== 0
        ) {
            throw new Error('Unsupported PNG encoding')
        }

        const idat = SchematicPowerDiagramImageProcessor.#concatByteArrays(
            chunks
                .filter((chunk) => chunk.type === 'IDAT')
                .map((chunk) => chunk.data)
        )
        const raw = unzlibSync(idat)

        return {
            width,
            height,
            rgba: SchematicPowerDiagramImageProcessor.#unfilterRgbaScanlines(
                raw,
                width,
                height
            )
        }
    }

    /**
     * Decodes base64 in both browser and Node runtimes.
     * @param {string} dataBase64 Base64 data.
     * @returns {Uint8Array}
     */
    static #decodeBase64(dataBase64) {
        if (typeof Buffer !== 'undefined') {
            return Uint8Array.from(Buffer.from(dataBase64, 'base64'))
        }

        const binary = globalThis.atob(dataBase64)
        const bytes = new Uint8Array(binary.length)

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index)
        }

        return bytes
    }

    /**
     * Encodes base64 in both browser and Node runtimes.
     * @param {Uint8Array} bytes Bytes to encode.
     * @returns {string}
     */
    static #encodeBase64(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64')
        }

        const chunkSize = 0x8000
        const chunks = []

        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            chunks.push(
                String.fromCharCode(
                    ...bytes.subarray(offset, offset + chunkSize)
                )
            )
        }

        return globalThis.btoa(chunks.join(''))
    }

    /**
     * Reads PNG chunks without validating checksums.
     * @param {Uint8Array} bytes PNG bytes.
     * @returns {{ type: string, data: Uint8Array }[]}
     */
    static #readPngChunks(bytes) {
        const chunks = []
        let offset = PNG_SIGNATURE.length

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

            if (dataEnd + 4 > bytes.length) {
                throw new Error('Truncated PNG chunk')
            }

            chunks.push({
                type,
                data: bytes.slice(dataStart, dataEnd)
            })

            offset = dataEnd + 4
            if (type === 'IEND') break
        }

        return chunks
    }

    /**
     * Reconstructs RGBA rows from PNG filtered scanlines.
     * @param {Uint8Array} raw Inflated scanline bytes.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @returns {Uint8Array}
     */
    static #unfilterRgbaScanlines(raw, width, height) {
        const bytesPerPixel = 4
        const rowLength = width * bytesPerPixel
        const expectedLength = height * (rowLength + 1)
        const rgba = new Uint8Array(width * height * bytesPerPixel)
        const previous = new Uint8Array(rowLength)

        if (raw.length < expectedLength) {
            throw new Error('Truncated PNG scanlines')
        }

        for (let y = 0; y < height; y += 1) {
            const rowStart = y * (rowLength + 1)
            const filter = raw[rowStart]
            const current = rgba.subarray(y * rowLength, (y + 1) * rowLength)
            const source = raw.subarray(rowStart + 1, rowStart + 1 + rowLength)

            for (let index = 0; index < rowLength; index += 1) {
                const left =
                    index >= bytesPerPixel ? current[index - bytesPerPixel] : 0
                const up = previous[index]
                const upLeft =
                    index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0

                current[index] =
                    (source[index] +
                        SchematicPowerDiagramImageProcessor.#filterPredictor(
                            filter,
                            left,
                            up,
                            upLeft
                        )) &
                    0xff
            }

            previous.set(current)
        }

        return rgba
    }

    /**
     * Returns one PNG row-filter predictor.
     * @param {number} filter PNG filter type.
     * @param {number} left Left byte.
     * @param {number} up Previous-row byte.
     * @param {number} upLeft Previous-row left byte.
     * @returns {number}
     */
    static #filterPredictor(filter, left, up, upLeft) {
        if (filter === 0) return 0
        if (filter === 1) return left
        if (filter === 2) return up
        if (filter === 3) return Math.floor((left + up) / 2)
        if (filter === 4) {
            return SchematicPowerDiagramImageProcessor.#paethPredictor(
                left,
                up,
                upLeft
            )
        }

        throw new Error('Unsupported PNG row filter')
    }

    /**
     * Computes the PNG Paeth predictor.
     * @param {number} left Left byte.
     * @param {number} up Previous-row byte.
     * @param {number} upLeft Previous-row left byte.
     * @returns {number}
     */
    static #paethPredictor(left, up, upLeft) {
        const estimate = left + up - upLeft
        const leftDistance = Math.abs(estimate - left)
        const upDistance = Math.abs(estimate - up)
        const upLeftDistance = Math.abs(estimate - upLeft)

        if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
            return left
        }

        return upDistance <= upLeftDistance ? up : upLeft
    }

    /**
     * Encodes RGBA pixels into a minimal PNG payload.
     * @param {{ width: number, height: number, rgba: Uint8Array }} png PNG data.
     * @returns {Uint8Array}
     */
    static #encodePngRgba(png) {
        const scanlineLength = png.width * 4 + 1
        const raw = new Uint8Array(scanlineLength * png.height)

        for (let y = 0; y < png.height; y += 1) {
            const rowOffset = y * scanlineLength
            raw[rowOffset] = 0
            raw.set(
                png.rgba.subarray(y * png.width * 4, (y + 1) * png.width * 4),
                rowOffset + 1
            )
        }

        return SchematicPowerDiagramImageProcessor.#concatByteArrays([
            Uint8Array.from(PNG_SIGNATURE),
            SchematicPowerDiagramImageProcessor.#pngChunk(
                'IHDR',
                SchematicPowerDiagramImageProcessor.#pngHeader(
                    png.width,
                    png.height
                )
            ),
            SchematicPowerDiagramImageProcessor.#pngChunk(
                'IDAT',
                zlibSync(raw, { level: 1 })
            ),
            SchematicPowerDiagramImageProcessor.#pngChunk(
                'IEND',
                new Uint8Array()
            )
        ])
    }

    /**
     * Builds PNG IHDR chunk data.
     * @param {number} width Pixel width.
     * @param {number} height Pixel height.
     * @returns {Uint8Array}
     */
    static #pngHeader(width, height) {
        const header = new Uint8Array(13)
        const view = new DataView(header.buffer)

        view.setUint32(0, width, false)
        view.setUint32(4, height, false)
        header[8] = 8
        header[9] = 6
        header[10] = 0
        header[11] = 0
        header[12] = 0

        return header
    }

    /**
     * Builds a PNG chunk.
     * @param {string} type Four-byte chunk type.
     * @param {Uint8Array} data Chunk data.
     * @returns {Uint8Array}
     */
    static #pngChunk(type, data) {
        const typeBytes = new TextEncoder().encode(type)
        const chunk = new Uint8Array(12 + data.length)
        const view = new DataView(chunk.buffer)

        view.setUint32(0, data.length, false)
        chunk.set(typeBytes, 4)
        chunk.set(data, 8)
        view.setUint32(
            8 + data.length,
            SchematicPowerDiagramImageProcessor.#crc32(
                SchematicPowerDiagramImageProcessor.#concatByteArrays([
                    typeBytes,
                    data
                ])
            ),
            false
        )

        return chunk
    }

    /**
     * Computes a PNG-compatible CRC-32 checksum.
     * @param {Uint8Array} bytes Bytes to checksum.
     * @returns {number}
     */
    static #crc32(bytes) {
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
    static #concatByteArrays(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const output = new Uint8Array(totalLength)
        let offset = 0

        for (const chunk of chunks) {
            output.set(chunk, offset)
            offset += chunk.length
        }

        return output
    }
}
