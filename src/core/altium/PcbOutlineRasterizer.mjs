/**
 * Shared raster and contour helpers for PCB outline recovery.
 */
export class PcbOutlineRasterizer {
    /**
     * Resolves one raster cell size for mechanical boundary recovery.
     * @param {{ widthMil: number, heightMil: number }} bounds
     * @returns {number}
     */
    static resolveRasterResolution(bounds) {
        const longestAxis = Math.max(bounds.widthMil, bounds.heightMil, 1)

        return Math.max(Math.ceil(longestAxis / 280), 4)
    }

    /**
     * Resolves one higher-fidelity raster cell size for closing an authored
     * route contour into a board silhouette.
     * @param {{ widthMil: number, heightMil: number }} bounds
     * @returns {number}
     */
    static resolveSilhouetteResolution(bounds) {
        const longestAxis = Math.max(bounds.widthMil, bounds.heightMil, 1)

        return Math.max(Math.ceil(longestAxis / 900), 4)
    }

    /**
     * Draws one closed outline segment family into a raster mask.
     * @param {Array<Record<string, number | string>>} segments
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {number} resolutionMil
     * @param {number} originX
     * @param {number} originY
     * @returns {Uint8Array}
     */
    static drawOutlineMask(
        segments,
        rasterWidth,
        rasterHeight,
        resolutionMil,
        originX,
        originY
    ) {
        const mask = new Uint8Array(rasterWidth * rasterHeight)

        for (const segment of segments) {
            if (segment.type === 'arc') {
                PcbOutlineRasterizer.#drawArcMaskSegment(
                    mask,
                    segment,
                    rasterWidth,
                    rasterHeight,
                    resolutionMil,
                    originX,
                    originY
                )
                continue
            }

            PcbOutlineRasterizer.#drawLineMaskSegment(
                mask,
                segment,
                rasterWidth,
                rasterHeight,
                resolutionMil,
                originX,
                originY
            )
        }

        return mask
    }

    /**
     * Draws one thick line boundary mask from the candidate track family.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width: number }[]} tracks
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {number} resolutionMil
     * @param {number} originX
     * @param {number} originY
     * @returns {Uint8Array}
     */
    static drawBoundaryMask(
        tracks,
        rasterWidth,
        rasterHeight,
        resolutionMil,
        originX,
        originY
    ) {
        const mask = new Uint8Array(rasterWidth * rasterHeight)

        for (const track of tracks) {
            const startX = (track.x1 - originX) / resolutionMil
            const startY = (track.y1 - originY) / resolutionMil
            const endX = (track.x2 - originX) / resolutionMil
            const endY = (track.y2 - originY) / resolutionMil
            const steps = Math.max(
                Math.ceil(Math.abs(endX - startX) * 2),
                Math.ceil(Math.abs(endY - startY) * 2),
                1
            )
            const radius = Math.max(
                1,
                Math.ceil(Number(track.width || 0) / resolutionMil / 2)
            )

            for (let step = 0; step <= steps; step += 1) {
                const ratio = step / steps
                const x = startX + (endX - startX) * ratio
                const y = startY + (endY - startY) * ratio

                PcbOutlineRasterizer.#paintDisk(
                    mask,
                    rasterWidth,
                    rasterHeight,
                    x,
                    y,
                    radius
                )
            }
        }

        return mask
    }

    /**
     * Expands one raster mask by one eight-neighbor ring.
     * @param {Uint8Array} mask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @returns {Uint8Array}
     */
    static dilateMask(mask, rasterWidth, rasterHeight) {
        const dilatedMask = mask.slice()

        for (let y = 0; y < rasterHeight; y += 1) {
            for (let x = 0; x < rasterWidth; x += 1) {
                if (!mask[y * rasterWidth + x]) {
                    continue
                }

                for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
                    for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
                        const nextX = x + deltaX
                        const nextY = y + deltaY

                        if (
                            nextX < 0 ||
                            nextY < 0 ||
                            nextX >= rasterWidth ||
                            nextY >= rasterHeight
                        ) {
                            continue
                        }

                        dilatedMask[nextY * rasterWidth + nextX] = 1
                    }
                }
            }
        }

        return dilatedMask
    }

    /**
     * Contracts one raster mask by one eight-neighbor ring.
     * @param {Uint8Array} mask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @returns {Uint8Array}
     */
    static erodeMask(mask, rasterWidth, rasterHeight) {
        const erodedMask = new Uint8Array(mask.length)

        for (let y = 0; y < rasterHeight; y += 1) {
            for (let x = 0; x < rasterWidth; x += 1) {
                if (!mask[y * rasterWidth + x]) {
                    continue
                }

                let keepCell = true

                for (let deltaY = -1; deltaY <= 1 && keepCell; deltaY += 1) {
                    for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
                        const nextX = x + deltaX
                        const nextY = y + deltaY

                        if (
                            nextX < 0 ||
                            nextY < 0 ||
                            nextX >= rasterWidth ||
                            nextY >= rasterHeight ||
                            !mask[nextY * rasterWidth + nextX]
                        ) {
                            keepCell = false
                            break
                        }
                    }
                }

                if (keepCell) {
                    erodedMask[y * rasterWidth + x] = 1
                }
            }
        }

        return erodedMask
    }

    /**
     * Flood-fills the raster exterior from the padded image border.
     * @param {Uint8Array} boundaryMask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @returns {Uint8Array}
     */
    static floodExterior(boundaryMask, rasterWidth, rasterHeight) {
        const exteriorMask = new Uint8Array(rasterWidth * rasterHeight)
        const queue = []

        const push = (x, y) => {
            if (x < 0 || y < 0 || x >= rasterWidth || y >= rasterHeight) {
                return
            }

            const index = y * rasterWidth + x

            if (boundaryMask[index] || exteriorMask[index]) {
                return
            }

            exteriorMask[index] = 1
            queue.push({ x, y })
        }

        for (let x = 0; x < rasterWidth; x += 1) {
            push(x, 0)
            push(x, rasterHeight - 1)
        }

        for (let y = 0; y < rasterHeight; y += 1) {
            push(0, y)
            push(rasterWidth - 1, y)
        }

        while (queue.length) {
            const cell = queue.shift()

            push(cell.x + 1, cell.y)
            push(cell.x - 1, cell.y)
            push(cell.x, cell.y + 1)
            push(cell.x, cell.y - 1)
        }

        return exteriorMask
    }

    /**
     * Builds one solid region mask from one outline boundary and its flooded
     * exterior.
     * @param {Uint8Array} boundaryMask
     * @param {Uint8Array} exteriorMask
     * @returns {Uint8Array}
     */
    static buildSolidMask(boundaryMask, exteriorMask) {
        const solidMask = new Uint8Array(boundaryMask.length)

        for (let index = 0; index < boundaryMask.length; index += 1) {
            if (!exteriorMask[index]) {
                solidMask[index] = 1
            }
        }

        return solidMask
    }

    /**
     * Applies one binary closing pass family to a filled outline mask so small
     * scallops merge back into the board body.
     * @param {Uint8Array} solidMask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {number} closingPasses
     * @returns {Uint8Array}
     */
    static closeSolidMask(solidMask, rasterWidth, rasterHeight, closingPasses) {
        let closedMask = solidMask.slice()

        for (let pass = 0; pass < closingPasses; pass += 1) {
            closedMask = PcbOutlineRasterizer.dilateMask(
                closedMask,
                rasterWidth,
                rasterHeight
            )
        }

        for (let pass = 0; pass < closingPasses; pass += 1) {
            closedMask = PcbOutlineRasterizer.erodeMask(
                closedMask,
                rasterWidth,
                rasterHeight
            )
        }

        return closedMask
    }

    /**
     * Returns true when one closed region still contains every component
     * sample after one board-route closure pass.
     * @param {Uint8Array} mask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {{ x: number, y: number }[]} components
     * @param {number} resolutionMil
     * @param {number} originX
     * @param {number} originY
     * @returns {boolean}
     */
    static maskContainsAllComponents(
        mask,
        rasterWidth,
        rasterHeight,
        components,
        resolutionMil,
        originX,
        originY
    ) {
        return components.every((component) => {
            const componentCell = PcbOutlineRasterizer.coordinateToRasterCell(
                component.x,
                component.y,
                resolutionMil,
                originX,
                originY,
                rasterWidth,
                rasterHeight
            )

            if (!componentCell) {
                return false
            }

            return mask[componentCell.y * rasterWidth + componentCell.x] === 1
        })
    }

    /**
     * Chooses the smallest enclosed raster region that contains all sampled
     * component coordinates.
     * @param {Uint8Array} boundaryMask
     * @param {Uint8Array} exteriorMask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {{ x: number, y: number }[]} componentCells
     * @param {{ centerX: number, centerY: number }} componentBounds
     * @param {number} resolutionMil
     * @param {number} originX
     * @param {number} originY
     * @returns {Uint8Array | null}
     */
    static recoverPlacementInterior(
        boundaryMask,
        exteriorMask,
        rasterWidth,
        rasterHeight,
        componentCells,
        componentBounds,
        resolutionMil,
        originX,
        originY
    ) {
        const seeds = []
        const seenSeedKeys = new Set()

        for (const componentCell of componentCells) {
            const seedKey = PcbOutlineRasterizer.#pointKey(
                componentCell.x,
                componentCell.y
            )

            if (seenSeedKeys.has(seedKey)) {
                continue
            }

            seenSeedKeys.add(seedKey)
            seeds.push(componentCell)
        }

        const centroidCell = PcbOutlineRasterizer.coordinateToRasterCell(
            componentBounds.centerX,
            componentBounds.centerY,
            resolutionMil,
            originX,
            originY,
            rasterWidth,
            rasterHeight
        )

        if (centroidCell) {
            const centroidKey = PcbOutlineRasterizer.#pointKey(
                centroidCell.x,
                centroidCell.y
            )

            if (!seenSeedKeys.has(centroidKey)) {
                seeds.unshift(centroidCell)
            }
        }

        let bestInteriorMask = null
        let bestArea = Number.POSITIVE_INFINITY
        const triedSeeds = new Set()

        for (const seedCell of seeds) {
            const seedIndex = seedCell.y * rasterWidth + seedCell.x
            const seedKey = PcbOutlineRasterizer.#pointKey(
                seedCell.x,
                seedCell.y
            )

            if (
                boundaryMask[seedIndex] ||
                exteriorMask[seedIndex] ||
                triedSeeds.has(seedKey)
            ) {
                continue
            }

            triedSeeds.add(seedKey)
            const interiorMask = PcbOutlineRasterizer.#floodInterior(
                boundaryMask,
                exteriorMask,
                rasterWidth,
                rasterHeight,
                seedCell
            )

            let area = 0

            for (const value of interiorMask) {
                area += value
            }

            if (!area || area >= bestArea) {
                continue
            }

            const containsAllComponents = componentCells.every(
                (componentCell) => {
                    const componentIndex =
                        componentCell.y * rasterWidth + componentCell.x

                    return interiorMask[componentIndex]
                }
            )

            if (!containsAllComponents) {
                continue
            }

            bestInteriorMask = interiorMask
            bestArea = area
        }

        return bestInteriorMask
    }

    /**
     * Converts one document-space coordinate into a bounded raster cell.
     * @param {number} x
     * @param {number} y
     * @param {number} resolutionMil
     * @param {number} originX
     * @param {number} originY
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @returns {{ x: number, y: number } | null}
     */
    static coordinateToRasterCell(
        x,
        y,
        resolutionMil,
        originX,
        originY,
        rasterWidth,
        rasterHeight
    ) {
        const cellX = Math.round((x - originX) / resolutionMil)
        const cellY = Math.round((y - originY) / resolutionMil)

        if (
            cellX < 0 ||
            cellY < 0 ||
            cellX >= rasterWidth ||
            cellY >= rasterHeight
        ) {
            return null
        }

        return { x: cellX, y: cellY }
    }

    /**
     * Traces all closed contour loops around one raster interior mask.
     * @param {Uint8Array} interiorMask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {number} resolutionMil
     * @param {number} originX
     * @param {number} originY
     * @returns {{ x: number, y: number }[][]}
     */
    static traceInteriorLoops(
        interiorMask,
        rasterWidth,
        rasterHeight,
        resolutionMil,
        originX,
        originY
    ) {
        const edges = []
        const isInterior = (x, y) =>
            x >= 0 &&
            y >= 0 &&
            x < rasterWidth &&
            y < rasterHeight &&
            interiorMask[y * rasterWidth + x]

        for (let y = 0; y < rasterHeight; y += 1) {
            for (let x = 0; x < rasterWidth; x += 1) {
                if (!isInterior(x, y)) {
                    continue
                }

                if (!isInterior(x, y - 1)) {
                    edges.push([
                        { x, y },
                        { x: x + 1, y }
                    ])
                }
                if (!isInterior(x + 1, y)) {
                    edges.push([
                        { x: x + 1, y },
                        { x: x + 1, y: y + 1 }
                    ])
                }
                if (!isInterior(x, y + 1)) {
                    edges.push([
                        { x: x + 1, y: y + 1 },
                        { x, y: y + 1 }
                    ])
                }
                if (!isInterior(x - 1, y)) {
                    edges.push([
                        { x, y: y + 1 },
                        { x, y }
                    ])
                }
            }
        }

        const outgoingEdges = new Map()

        for (const [start, end] of edges) {
            const startKey = PcbOutlineRasterizer.#pointKey(start.x, start.y)

            if (!outgoingEdges.has(startKey)) {
                outgoingEdges.set(startKey, [])
            }

            outgoingEdges.get(startKey).push(end)
        }

        const loops = []

        while (outgoingEdges.size) {
            const [startKey] = outgoingEdges.entries().next().value
            const startPoint = PcbOutlineRasterizer.#parsePointKey(startKey)
            const loop = [{ x: startPoint.x, y: startPoint.y }]
            let currentKey = startKey

            while (true) {
                const nextPoint = outgoingEdges.get(currentKey)?.shift()

                if (!nextPoint) {
                    outgoingEdges.delete(currentKey)
                    break
                }

                if (!outgoingEdges.get(currentKey)?.length) {
                    outgoingEdges.delete(currentKey)
                }

                loop.push({ x: nextPoint.x, y: nextPoint.y })
                currentKey = PcbOutlineRasterizer.#pointKey(
                    nextPoint.x,
                    nextPoint.y
                )

                if (currentKey === startKey) {
                    break
                }
            }

            if (loop.length < 4) {
                continue
            }

            loops.push(
                loop.map((point) => ({
                    x: originX + point.x * resolutionMil,
                    y: originY + point.y * resolutionMil
                }))
            )
        }

        return loops
    }

    /**
     * Draws one line outline segment into the raster mask.
     * @param {Uint8Array} mask
     * @param {Record<string, number | string>} segment
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {number} resolutionMil
     * @param {number} originX
     * @param {number} originY
     * @returns {void}
     */
    static #drawLineMaskSegment(
        mask,
        segment,
        rasterWidth,
        rasterHeight,
        resolutionMil,
        originX,
        originY
    ) {
        const startX = (Number(segment.x1 || 0) - originX) / resolutionMil
        const startY = (Number(segment.y1 || 0) - originY) / resolutionMil
        const endX = (Number(segment.x2 || 0) - originX) / resolutionMil
        const endY = (Number(segment.y2 || 0) - originY) / resolutionMil
        const steps = Math.max(
            Math.ceil(Math.abs(endX - startX) * 3),
            Math.ceil(Math.abs(endY - startY) * 3),
            1
        )

        for (let step = 0; step <= steps; step += 1) {
            const ratio = step / steps
            const x = startX + (endX - startX) * ratio
            const y = startY + (endY - startY) * ratio

            PcbOutlineRasterizer.#paintDisk(
                mask,
                rasterWidth,
                rasterHeight,
                x,
                y,
                1
            )
        }
    }

    /**
     * Draws one arc outline segment into the raster mask.
     * @param {Uint8Array} mask
     * @param {Record<string, number | string>} segment
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {number} resolutionMil
     * @param {number} originX
     * @param {number} originY
     * @returns {void}
     */
    static #drawArcMaskSegment(
        mask,
        segment,
        rasterWidth,
        rasterHeight,
        resolutionMil,
        originX,
        originY
    ) {
        const startAngle = Number(segment.startAngle || 0)
        const endAngle = Number(segment.endAngle || 0)
        let delta = endAngle - startAngle

        if (Math.abs(delta) < 1e-6) {
            delta = 360
        }

        if (delta < 0) {
            delta += 360
        }

        const radius = Math.max(Number(segment.radius) || 0, resolutionMil)
        const steps = Math.max(
            Math.ceil(
                ((2 * Math.PI * radius * (delta / 360)) / resolutionMil) * 3
            ),
            12
        )

        for (let step = 0; step <= steps; step += 1) {
            const angle =
                ((startAngle + delta * (step / steps)) * Math.PI) / 180
            const x =
                (Number(segment.cx || 0) + radius * Math.cos(angle) - originX) /
                resolutionMil
            const y =
                (Number(segment.cy || 0) + radius * Math.sin(angle) - originY) /
                resolutionMil

            PcbOutlineRasterizer.#paintDisk(
                mask,
                rasterWidth,
                rasterHeight,
                x,
                y,
                1
            )
        }
    }

    /**
     * Paints one solid disk into the raster mask.
     * @param {Uint8Array} mask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @returns {void}
     */
    static #paintDisk(mask, rasterWidth, rasterHeight, x, y, radius) {
        const centerX = Math.round(x)
        const centerY = Math.round(y)

        for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
            for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
                if (deltaX * deltaX + deltaY * deltaY > radius * radius) {
                    continue
                }

                const nextX = centerX + deltaX
                const nextY = centerY + deltaY

                if (
                    nextX < 0 ||
                    nextY < 0 ||
                    nextX >= rasterWidth ||
                    nextY >= rasterHeight
                ) {
                    continue
                }

                mask[nextY * rasterWidth + nextX] = 1
            }
        }
    }

    /**
     * Flood-fills the enclosed raster region containing one candidate seed.
     * @param {Uint8Array} boundaryMask
     * @param {Uint8Array} exteriorMask
     * @param {number} rasterWidth
     * @param {number} rasterHeight
     * @param {{ x: number, y: number }} seedCell
     * @returns {Uint8Array}
     */
    static #floodInterior(
        boundaryMask,
        exteriorMask,
        rasterWidth,
        rasterHeight,
        seedCell
    ) {
        const interiorMask = new Uint8Array(rasterWidth * rasterHeight)
        const queue = [seedCell]
        interiorMask[seedCell.y * rasterWidth + seedCell.x] = 1

        while (queue.length) {
            const cell = queue.shift()

            for (const neighbor of [
                { x: cell.x + 1, y: cell.y },
                { x: cell.x - 1, y: cell.y },
                { x: cell.x, y: cell.y + 1 },
                { x: cell.x, y: cell.y - 1 }
            ]) {
                if (
                    neighbor.x < 0 ||
                    neighbor.y < 0 ||
                    neighbor.x >= rasterWidth ||
                    neighbor.y >= rasterHeight
                ) {
                    continue
                }

                const index = neighbor.y * rasterWidth + neighbor.x

                if (
                    boundaryMask[index] ||
                    exteriorMask[index] ||
                    interiorMask[index]
                ) {
                    continue
                }

                interiorMask[index] = 1
                queue.push(neighbor)
            }
        }

        return interiorMask
    }

    /**
     * Returns one stable point key.
     * @param {number} x
     * @param {number} y
     * @returns {string}
     */
    static #pointKey(x, y) {
        return x + ':' + y
    }

    /**
     * Parses one stable point key.
     * @param {string} key
     * @returns {{ x: number, y: number }}
     */
    static #parsePointKey(key) {
        const [x, y] = String(key || '').split(':')

        return {
            x: Number(x),
            y: Number(y)
        }
    }
}
