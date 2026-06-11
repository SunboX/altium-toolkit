// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds and cleans bitmap masks for recovered power-diagram line artwork.
 */
export class SchematicPowerDiagramLineMasks {
    /**
     * Builds a mask for dark linework connected to the detected horizontal
     * rail seeds.
     * @param {{ width: number, height: number }} png PNG data.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {Uint8Array} seedMask Initial rail pixels.
     * @returns {Uint8Array}
     */
    static buildConnectedLineMask(png, darkMask, seedMask) {
        const connectedMask = new Uint8Array(darkMask.length)
        const gapBridgeMask = new Uint8Array(darkMask.length)
        const queue = new Uint32Array(darkMask.length)
        let readIndex = 0
        let writeIndex = 0

        for (let index = 0; index < darkMask.length; index += 1) {
            if (!darkMask[index] || !seedMask[index]) continue

            connectedMask[index] = 1
            queue[writeIndex] = index
            writeIndex += 1
        }

        let bridged = true

        while (bridged) {
            while (readIndex < writeIndex) {
                const index = queue[readIndex]
                readIndex += 1

                const x = index % png.width
                const y = Math.floor(index / png.width)
                writeIndex =
                    SchematicPowerDiagramLineMasks.#appendConnectedNeighbors(
                        darkMask,
                        connectedMask,
                        queue,
                        png.width,
                        png.height,
                        x,
                        y,
                        writeIndex
                    )
            }

            const previousWriteIndex = writeIndex
            writeIndex =
                SchematicPowerDiagramLineMasks.#appendHorizontalGapRuns(
                    darkMask,
                    connectedMask,
                    gapBridgeMask,
                    queue,
                    png.width,
                    png.height,
                    writeIndex
                )
            writeIndex = SchematicPowerDiagramLineMasks.#appendVerticalGapRuns(
                darkMask,
                connectedMask,
                gapBridgeMask,
                queue,
                png.width,
                png.height,
                writeIndex
            )
            bridged = writeIndex > previousWriteIndex
        }

        return connectedMask
    }

    /**
     * Appends dark horizontal dash runs that are separated from connected
     * linework only by a small same-row gap.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {Uint8Array} connectedMask Connected pixels.
     * @param {Uint8Array} gapBridgeMask Gap-bridged line pixels.
     * @param {Uint32Array} queue Shared queue.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} writeIndex Queue write index.
     * @returns {number}
     */
    static #appendHorizontalGapRuns(
        darkMask,
        connectedMask,
        gapBridgeMask,
        queue,
        width,
        height,
        writeIndex
    ) {
        const maximumGap = Math.max(8, Math.round(width * 0.015))
        const minimumRun = Math.max(12, Math.round(width * 0.005))
        const maximumRun = Math.max(18, Math.round(width * 0.035))

        for (let y = 0; y < height; y += 1) {
            const runs = SchematicPowerDiagramLineMasks.#collectHorizontalRuns(
                darkMask,
                connectedMask,
                width,
                y
            )

            for (let index = 0; index < runs.length; index += 1) {
                if (!runs[index].connected) continue

                writeIndex = SchematicPowerDiagramLineMasks.#appendGapRun(
                    connectedMask,
                    gapBridgeMask,
                    queue,
                    width,
                    y,
                    runs[index],
                    runs[index + 1],
                    maximumGap,
                    minimumRun,
                    maximumRun,
                    writeIndex
                )
                writeIndex = SchematicPowerDiagramLineMasks.#appendGapRun(
                    connectedMask,
                    gapBridgeMask,
                    queue,
                    width,
                    y,
                    runs[index],
                    runs[index - 1],
                    maximumGap,
                    minimumRun,
                    maximumRun,
                    writeIndex
                )
            }
        }

        return writeIndex
    }

    /**
     * Appends dark vertical dash runs that are separated from connected
     * linework only by a small same-column gap.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {Uint8Array} connectedMask Connected pixels.
     * @param {Uint8Array} gapBridgeMask Gap-bridged line pixels.
     * @param {Uint32Array} queue Shared queue.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} writeIndex Queue write index.
     * @returns {number}
     */
    static #appendVerticalGapRuns(
        darkMask,
        connectedMask,
        gapBridgeMask,
        queue,
        width,
        height,
        writeIndex
    ) {
        const maximumGap = Math.max(8, Math.round(height * 0.015))
        const minimumRun = Math.max(12, Math.round(height * 0.005))
        const maximumRun = Math.max(24, Math.round(height * 0.06))

        for (let x = 0; x < width; x += 1) {
            const runs = SchematicPowerDiagramLineMasks.#collectVerticalRuns(
                darkMask,
                gapBridgeMask,
                width,
                height,
                x
            )

            for (let index = 0; index < runs.length; index += 1) {
                if (!runs[index].connected) continue

                writeIndex = SchematicPowerDiagramLineMasks.#appendColumnGapRun(
                    connectedMask,
                    gapBridgeMask,
                    queue,
                    width,
                    x,
                    runs[index],
                    runs[index + 1],
                    maximumGap,
                    minimumRun,
                    maximumRun,
                    writeIndex
                )
                writeIndex = SchematicPowerDiagramLineMasks.#appendColumnGapRun(
                    connectedMask,
                    gapBridgeMask,
                    queue,
                    width,
                    x,
                    runs[index],
                    runs[index - 1],
                    maximumGap,
                    minimumRun,
                    maximumRun,
                    writeIndex
                )
            }
        }

        return writeIndex
    }

    /**
     * Collects dark runs on one row.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {Uint8Array} connectedMask Connected pixels.
     * @param {number} width Image width.
     * @param {number} y Row.
     * @returns {{ start: number, end: number, connected: boolean }[]}
     */
    static #collectHorizontalRuns(darkMask, connectedMask, width, y) {
        const runs = []
        let x = 0

        while (x < width) {
            while (x < width && !darkMask[y * width + x]) x += 1
            if (x >= width) break

            const start = x
            let connected = false

            while (x < width && darkMask[y * width + x]) {
                if (connectedMask[y * width + x]) connected = true
                x += 1
            }

            runs.push({ start, end: x - 1, connected })
        }

        return runs
    }

    /**
     * Collects dark runs on one column.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {Uint8Array} connectedMask Connected pixels.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} x Column.
     * @returns {{ start: number, end: number, connected: boolean }[]}
     */
    static #collectVerticalRuns(darkMask, connectedMask, width, height, x) {
        const runs = []
        let y = 0

        while (y < height) {
            while (y < height && !darkMask[y * width + x]) y += 1
            if (y >= height) break

            const start = y
            let connected = false

            while (y < height && darkMask[y * width + x]) {
                if (connectedMask[y * width + x]) connected = true
                y += 1
            }

            runs.push({ start, end: y - 1, connected })
        }

        return runs
    }

    /**
     * Appends one target run when it is close enough to a connected source run.
     * @param {Uint8Array} connectedMask Connected pixels.
     * @param {Uint8Array} gapBridgeMask Gap-bridged line pixels.
     * @param {Uint32Array} queue Shared queue.
     * @param {number} width Image width.
     * @param {number} y Row.
     * @param {{ start: number, end: number }} source Source run.
     * @param {{ start: number, end: number, connected: boolean } | undefined} target Target run.
     * @param {number} maximumGap Maximum bridge gap.
     * @param {number} minimumRun Minimum target run length.
     * @param {number} maximumRun Maximum target run length.
     * @param {number} writeIndex Queue write index.
     * @returns {number}
     */
    static #appendGapRun(
        connectedMask,
        gapBridgeMask,
        queue,
        width,
        y,
        source,
        target,
        maximumGap,
        minimumRun,
        maximumRun,
        writeIndex
    ) {
        if (!target || target.connected) return writeIndex

        const gap =
            target.start > source.end
                ? target.start - source.end - 1
                : source.start - target.end - 1
        const runLength = target.end - target.start + 1

        if (
            gap > maximumGap ||
            runLength < minimumRun ||
            runLength > maximumRun
        ) {
            return writeIndex
        }

        for (let x = target.start; x <= target.end; x += 1) {
            const targetIndex = y * width + x
            if (connectedMask[targetIndex]) continue

            connectedMask[targetIndex] = 1
            gapBridgeMask[targetIndex] = 1
            queue[writeIndex] = targetIndex
            writeIndex += 1
        }

        return writeIndex
    }

    /**
     * Appends one vertical target run when it is close enough to a connected
     * source run.
     * @param {Uint8Array} connectedMask Connected pixels.
     * @param {Uint8Array} gapBridgeMask Gap-bridged line pixels.
     * @param {Uint32Array} queue Shared queue.
     * @param {number} width Image width.
     * @param {number} x Column.
     * @param {{ start: number, end: number }} source Source run.
     * @param {{ start: number, end: number, connected: boolean } | undefined} target Target run.
     * @param {number} maximumGap Maximum bridge gap.
     * @param {number} minimumRun Minimum target run length.
     * @param {number} maximumRun Maximum target run length.
     * @param {number} writeIndex Queue write index.
     * @returns {number}
     */
    static #appendColumnGapRun(
        connectedMask,
        gapBridgeMask,
        queue,
        width,
        x,
        source,
        target,
        maximumGap,
        minimumRun,
        maximumRun,
        writeIndex
    ) {
        if (!target || target.connected) return writeIndex

        const gap =
            target.start > source.end
                ? target.start - source.end - 1
                : source.start - target.end - 1
        const runLength = target.end - target.start + 1

        if (
            gap > maximumGap ||
            runLength < minimumRun ||
            runLength > maximumRun
        ) {
            return writeIndex
        }

        for (let y = target.start; y <= target.end; y += 1) {
            const targetIndex = y * width + x
            if (connectedMask[targetIndex]) continue

            connectedMask[targetIndex] = 1
            gapBridgeMask[targetIndex] = 1
            queue[writeIndex] = targetIndex
            writeIndex += 1
        }

        return writeIndex
    }

    /**
     * Removes tall, narrow orange components that are more likely to be
     * ordinary wire fragments than power-port labels or caps.
     * @param {Uint8Array} orangeMask Orange candidate pixels.
     * @param {number} width Image width.
     * @param {number} height Image height.
     */
    static removeNarrowLineComponents(orangeMask, width, height) {
        const seen = new Uint8Array(orangeMask.length)
        const queue = new Uint32Array(orangeMask.length)
        const maximumNarrowWidth = Math.max(8, Math.round(width * 0.0024))
        const minimumTallHeight = Math.max(20, Math.round(height * 0.02))

        for (let index = 0; index < orangeMask.length; index += 1) {
            if (!orangeMask[index] || seen[index]) continue

            const component = SchematicPowerDiagramLineMasks.#readComponent(
                orangeMask,
                seen,
                queue,
                width,
                height,
                index
            )

            if (
                component.width <= maximumNarrowWidth &&
                component.height >= minimumTallHeight &&
                !SchematicPowerDiagramLineMasks.#hasDenseOrangeContext(
                    orangeMask,
                    width,
                    height,
                    component
                )
            ) {
                for (let cursor = 0; cursor < component.length; cursor += 1) {
                    orangeMask[queue[cursor]] = 0
                }
            }
        }
    }

    /**
     * Appends all eight-connected dark neighbors.
     * @param {Uint8Array} darkMask Dark source pixels.
     * @param {Uint8Array} connectedMask Connected pixels.
     * @param {Uint32Array} queue Shared queue.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} x Pixel x.
     * @param {number} y Pixel y.
     * @param {number} writeIndex Queue write index.
     * @returns {number}
     */
    static #appendConnectedNeighbors(
        darkMask,
        connectedMask,
        queue,
        width,
        height,
        x,
        y,
        writeIndex
    ) {
        for (let dy = -1; dy <= 1; dy += 1) {
            const nextY = y + dy
            if (nextY < 0 || nextY >= height) continue

            for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) continue

                const nextX = x + dx
                if (nextX < 0 || nextX >= width) continue

                const nextIndex = nextY * width + nextX
                if (!darkMask[nextIndex] || connectedMask[nextIndex]) {
                    continue
                }

                connectedMask[nextIndex] = 1
                queue[writeIndex] = nextIndex
                writeIndex += 1
            }
        }

        return writeIndex
    }

    /**
     * Reads one four-connected mask component into the shared queue.
     * @param {Uint8Array} mask Source mask.
     * @param {Uint8Array} seen Visited pixels.
     * @param {Uint32Array} queue Shared queue.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} startIndex Component seed.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number, length: number }}
     */
    static #readComponent(mask, seen, queue, width, height, startIndex) {
        let readIndex = 0
        let writeIndex = 0
        let minX = width
        let minY = height
        let maxX = 0
        let maxY = 0

        seen[startIndex] = 1
        queue[writeIndex] = startIndex
        writeIndex += 1

        while (readIndex < writeIndex) {
            const index = queue[readIndex]
            readIndex += 1

            const x = index % width
            const y = Math.floor(index / width)
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)

            writeIndex = SchematicPowerDiagramLineMasks.#appendComponentPixel(
                mask,
                seen,
                queue,
                width,
                height,
                x - 1,
                y,
                writeIndex
            )
            writeIndex = SchematicPowerDiagramLineMasks.#appendComponentPixel(
                mask,
                seen,
                queue,
                width,
                height,
                x + 1,
                y,
                writeIndex
            )
            writeIndex = SchematicPowerDiagramLineMasks.#appendComponentPixel(
                mask,
                seen,
                queue,
                width,
                height,
                x,
                y - 1,
                writeIndex
            )
            writeIndex = SchematicPowerDiagramLineMasks.#appendComponentPixel(
                mask,
                seen,
                queue,
                width,
                height,
                x,
                y + 1,
                writeIndex
            )
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
            length: writeIndex
        }
    }

    /**
     * Appends one component neighbor when it is in-bounds and unvisited.
     * @param {Uint8Array} mask Source mask.
     * @param {Uint8Array} seen Visited pixels.
     * @param {Uint32Array} queue Shared queue.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {number} x Pixel x.
     * @param {number} y Pixel y.
     * @param {number} writeIndex Queue write index.
     * @returns {number}
     */
    static #appendComponentPixel(
        mask,
        seen,
        queue,
        width,
        height,
        x,
        y,
        writeIndex
    ) {
        if (x < 0 || x >= width || y < 0 || y >= height) return writeIndex

        const index = y * width + x
        if (!mask[index] || seen[index]) return writeIndex

        seen[index] = 1
        queue[writeIndex] = index

        return writeIndex + 1
    }

    /**
     * Returns true when a narrow component sits inside a dense orange word or
     * cap context.
     * @param {Uint8Array} orangeMask Orange candidate pixels.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} component Component bounds.
     * @returns {boolean}
     */
    static #hasDenseOrangeContext(orangeMask, width, height, component) {
        const contextX = Math.max(24, Math.round(width * 0.045))
        const contextY = Math.max(8, Math.round(height * 0.015))
        const minimumDenseRowPixels = Math.max(16, Math.round(width * 0.003))
        const left = Math.max(0, component.minX - contextX)
        const right = Math.min(width - 1, component.maxX + contextX)
        const top = Math.max(0, component.minY - contextY)
        const bottom = Math.min(height - 1, component.maxY + contextY)

        for (let y = top; y <= bottom; y += 1) {
            let rowPixels = 0
            const rowOffset = y * width

            for (let x = left; x <= right; x += 1) {
                if (orangeMask[rowOffset + x]) rowPixels += 1
            }

            if (rowPixels >= minimumDenseRowPixels) return true
        }

        return false
    }
}
