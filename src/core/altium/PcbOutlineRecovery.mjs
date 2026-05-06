// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbGeometryFlipper } from './PcbGeometryFlipper.mjs'
import { PcbOutlineRasterizer } from './PcbOutlineRasterizer.mjs'

/**
 * Recovers a board-facing PCB outline from mechanical boundary tracks and
 * normalizes PCB coordinates into SVG top-view space.
 */
export class PcbOutlineRecovery {
    static #BOARD_ROUTE_CLOSURE_MIL = 40

    static #MAX_BOARD_ROUTE_AREA_INCREASE_RATIO = 1.12

    static #MIN_BOARD_ROUTE_COMPLEXITY_SEGMENTS = 8

    static #MIN_BOARD_ROUTE_SIGNIFICANT_GAIN_RATIO = 1.002

    static #MIN_COMPONENT_MARGIN_MIL = 120

    static #MAX_DIRECT_RENDER_BOARD_ROUTE_SEGMENTS = 12

    static #MAX_DIRECT_RENDER_ARC_SWEEP_DEGREES = 120

    /**
     * Selects a recoverable board outline from mechanical track layers.
     * @param {{ fallbackOutline: { minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }, components: { x: number, y: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerId?: number }[] }} options
     * @returns {{ source: 'board-route' | 'fallback' | 'mechanical-track-layer', layerId: number | null, outline: { minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> } }}
     */
    static recoverOutline(options) {
        const fallbackOutline = options?.fallbackOutline || {
            minX: 0,
            minY: 0,
            widthMil: 0,
            heightMil: 0,
            segments: []
        }
        const componentBounds = PcbOutlineRecovery.#buildComponentBounds(
            options?.components || []
        )

        if (!componentBounds) {
            return {
                source: 'fallback',
                layerId: null,
                outline: fallbackOutline
            }
        }

        const boardRouteOutline = PcbOutlineRecovery.#recoverBoardRouteOutline(
            fallbackOutline,
            options?.components || [],
            componentBounds
        )

        if (boardRouteOutline) {
            return {
                source: 'board-route',
                layerId: null,
                outline: boardRouteOutline
            }
        }

        const boundaryLayer = PcbOutlineRecovery.#selectBoundaryLayer(
            options?.tracks || [],
            componentBounds
        )

        if (!boundaryLayer) {
            return {
                source: 'fallback',
                layerId: null,
                outline: fallbackOutline
            }
        }

        const recoveredOutline =
            PcbOutlineRecovery.#traceTrackOutline(
                boundaryLayer.tracks,
                options?.components || [],
                componentBounds
            ) || PcbOutlineRecovery.#buildRectOutline(boundaryLayer.bounds)

        return {
            source: 'mechanical-track-layer',
            layerId: boundaryLayer.layerId,
            outline: recoveredOutline
        }
    }

    /**
     * Mirrors one normalized PCB model vertically so the SVG matches the
     * authored top-view orientation.
     * @param {{ boardOutline: { minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }, polygons?: { layer?: string, segments: Array<Record<string, number | string>> }[], fills?: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks?: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs?: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[], vias?: { x: number, y: number, diameter: number, holeDiameter: number }[], pads?: { x: number, y: number, rotation?: number, holeRotation?: number | null }[], texts?: { x: number, y: number, rotation?: number }[], components?: { designator: string, x: number, y: number, rotation: number, layer: string, pattern: string }[] }} pcb
     * @returns {{ boardOutline: { minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }, polygons: { layer?: string, segments: Array<Record<string, number | string>> }[], fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[], vias: { x: number, y: number, diameter: number, holeDiameter: number }[], pads: { x: number, y: number, rotation?: number, holeRotation?: number | null }[], texts: { x: number, y: number, rotation?: number }[], components: { designator: string, x: number, y: number, rotation: number, layer: string, pattern: string }[] }}
     */
    static flipGeometryVertically(pcb) {
        return PcbGeometryFlipper.flipGeometryVertically(pcb)
    }

    /**
     * Chooses the smallest mechanical track layer that still encloses all
     * placements with a practical board-edge margin.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width: number, layerId?: number }[]} tracks
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} componentBounds
     * @returns {{ layerId: number, bounds: { minX: number, minY: number, maxX: number, maxY: number, widthMil: number, heightMil: number }, tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerId?: number }[] } | null}
     */
    static #selectBoundaryLayer(tracks, componentBounds) {
        const groupedTracks = new Map()

        for (const track of tracks) {
            const layerId = Number(track.layerId)

            if (!Number.isInteger(layerId) || layerId < 57) {
                continue
            }

            if (!groupedTracks.has(layerId)) {
                groupedTracks.set(layerId, [])
            }

            groupedTracks.get(layerId).push(track)
        }

        const candidates = []

        for (const [layerId, layerTracks] of groupedTracks.entries()) {
            if (layerTracks.length < 4) {
                continue
            }

            const bounds = PcbOutlineRecovery.#buildTrackBounds(layerTracks)
            if (!bounds) {
                continue
            }

            const margins = {
                left: componentBounds.minX - bounds.minX,
                right: bounds.maxX - componentBounds.maxX,
                top: componentBounds.minY - bounds.minY,
                bottom: bounds.maxY - componentBounds.maxY
            }
            const minMargin = Math.min(
                margins.left,
                margins.right,
                margins.top,
                margins.bottom
            )

            if (minMargin < PcbOutlineRecovery.#MIN_COMPONENT_MARGIN_MIL) {
                continue
            }

            candidates.push({
                layerId,
                bounds,
                tracks: layerTracks,
                area: bounds.widthMil * bounds.heightMil
            })
        }

        candidates.sort((left, right) => left.area - right.area)

        return candidates[0] || null
    }

    /**
     * Builds one track-bounds envelope.
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} tracks
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, widthMil: number, heightMil: number } | null}
     */
    static #buildTrackBounds(tracks) {
        if (!tracks.length) {
            return null
        }

        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY

        for (const track of tracks) {
            minX = Math.min(minX, track.x1, track.x2)
            minY = Math.min(minY, track.y1, track.y2)
            maxX = Math.max(maxX, track.x1, track.x2)
            maxY = Math.max(maxY, track.y1, track.y2)
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            widthMil: maxX - minX,
            heightMil: maxY - minY
        }
    }

    /**
     * Builds one placement bounds envelope.
     * @param {{ x: number, y: number }[]} components
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, centerX: number, centerY: number } | null}
     */
    static #buildComponentBounds(components) {
        if (!components.length) {
            return null
        }

        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY

        for (const component of components) {
            minX = Math.min(minX, component.x)
            minY = Math.min(minY, component.y)
            maxX = Math.max(maxX, component.x)
            maxY = Math.max(maxY, component.y)
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        }
    }

    /**
     * Returns true when one fallback route contour is complex enough to merit
     * board-silhouette recovery instead of using its raw routed path directly.
     * @param {{ segments?: Array<Record<string, number | string>> } | undefined} outline
     * @returns {boolean}
     */
    static #hasRecoverableBoardRouteComplexity(outline) {
        const segments = outline?.segments || []

        return (
            segments.length >=
                PcbOutlineRecovery.#MIN_BOARD_ROUTE_COMPLEXITY_SEGMENTS ||
            segments.some((segment) => segment.type === 'arc')
        )
    }

    /**
     * Converts one authored route contour into a board-body silhouette by
     * filling the enclosed region and closing small scallops caused by routed
     * hole bites. When the closure gain is negligible the authored contour is
     * preserved as-is.
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }} fallbackOutline
     * @param {{ x: number, y: number }[]} components
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} componentBounds
     * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> } | null}
     */
    static #recoverBoardRouteOutline(
        fallbackOutline,
        components,
        componentBounds
    ) {
        if (
            !componentBounds ||
            !PcbOutlineRecovery.#hasRecoverableBoardRouteComplexity(
                fallbackOutline
            )
        ) {
            return null
        }

        const bounds = {
            minX: Number(fallbackOutline.minX || 0),
            minY: Number(fallbackOutline.minY || 0),
            maxX:
                Number(fallbackOutline.minX || 0) +
                Number(fallbackOutline.widthMil || 0),
            maxY:
                Number(fallbackOutline.minY || 0) +
                Number(fallbackOutline.heightMil || 0),
            widthMil: Number(fallbackOutline.widthMil || 0),
            heightMil: Number(fallbackOutline.heightMil || 0)
        }

        if (!bounds.widthMil || !bounds.heightMil) {
            return null
        }

        if (
            PcbOutlineRecovery.#isDirectlyRenderableBoardRoute(fallbackOutline)
        ) {
            return fallbackOutline
        }

        const resolutionMil =
            PcbOutlineRasterizer.resolveSilhouetteResolution(bounds)
        const closingPasses = Math.max(
            Math.ceil(
                PcbOutlineRecovery.#BOARD_ROUTE_CLOSURE_MIL / resolutionMil
            ),
            4
        )
        const paddingCells = closingPasses + 8
        const rasterWidth = Math.max(
            Math.ceil(bounds.widthMil / resolutionMil) + paddingCells * 2 + 1,
            32
        )
        const rasterHeight = Math.max(
            Math.ceil(bounds.heightMil / resolutionMil) + paddingCells * 2 + 1,
            32
        )
        const originX = bounds.minX - paddingCells * resolutionMil
        const originY = bounds.minY - paddingCells * resolutionMil
        const boundaryMask = PcbOutlineRasterizer.drawOutlineMask(
            fallbackOutline.segments || [],
            rasterWidth,
            rasterHeight,
            resolutionMil,
            originX,
            originY
        )
        const exteriorMask = PcbOutlineRasterizer.floodExterior(
            boundaryMask,
            rasterWidth,
            rasterHeight
        )
        const solidMask = PcbOutlineRasterizer.buildSolidMask(
            boundaryMask,
            exteriorMask
        )
        const closedMask = PcbOutlineRasterizer.closeSolidMask(
            solidMask,
            rasterWidth,
            rasterHeight,
            closingPasses
        )

        if (
            !PcbOutlineRasterizer.maskContainsAllComponents(
                closedMask,
                rasterWidth,
                rasterHeight,
                components,
                resolutionMil,
                originX,
                originY
            )
        ) {
            return null
        }

        const contourLoops = PcbOutlineRasterizer.traceInteriorLoops(
            closedMask,
            rasterWidth,
            rasterHeight,
            resolutionMil,
            originX,
            originY
        )

        if (!contourLoops.length) {
            return null
        }

        const points = contourLoops.sort(
            (left, right) =>
                Math.abs(PcbOutlineRecovery.#computeLoopArea(right)) -
                Math.abs(PcbOutlineRecovery.#computeLoopArea(left))
        )[0]
        const simplifiedPoints = PcbOutlineRecovery.#simplifyLoopPoints(points)

        if (simplifiedPoints.length < 4) {
            return null
        }

        const recoveredOutline =
            PcbOutlineRecovery.#buildOutlineFromPoints(simplifiedPoints)
        const rawArea = PcbOutlineRecovery.#computeOutlineArea(fallbackOutline)
        const recoveredArea = Math.abs(
            PcbOutlineRecovery.#computeLoopArea(simplifiedPoints)
        )

        if (!rawArea || recoveredArea < rawArea) {
            return null
        }

        const areaIncreaseRatio = recoveredArea / rawArea

        if (
            areaIncreaseRatio >
            PcbOutlineRecovery.#MAX_BOARD_ROUTE_AREA_INCREASE_RATIO
        ) {
            return null
        }

        if (
            areaIncreaseRatio <
            PcbOutlineRecovery.#MIN_BOARD_ROUTE_SIGNIFICANT_GAIN_RATIO
        ) {
            return fallbackOutline
        }

        return recoveredOutline
    }

    /**
     * Rasterizes one mechanical boundary layer and traces the filled region
     * that encloses the placement centroid.
     * @param {{ x1: number, y1: number, x2: number, y2: number, width: number }[]} tracks
     * @param {{ x: number, y: number }[]} components
     * @param {{ centerX: number, centerY: number }} componentBounds
     * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> } | null}
     */
    static #traceTrackOutline(tracks, components, componentBounds) {
        const bounds = PcbOutlineRecovery.#buildTrackBounds(tracks)

        if (!bounds) {
            return null
        }

        const resolutionMil =
            PcbOutlineRasterizer.resolveRasterResolution(bounds)
        const paddingCells = 6
        const rasterWidth = Math.max(
            Math.ceil(bounds.widthMil / resolutionMil) + paddingCells * 2 + 1,
            16
        )
        const rasterHeight = Math.max(
            Math.ceil(bounds.heightMil / resolutionMil) + paddingCells * 2 + 1,
            16
        )
        const originX = bounds.minX - paddingCells * resolutionMil
        const originY = bounds.minY - paddingCells * resolutionMil

        const componentCells = components
            .map((component) =>
                PcbOutlineRasterizer.coordinateToRasterCell(
                    component.x,
                    component.y,
                    resolutionMil,
                    originX,
                    originY,
                    rasterWidth,
                    rasterHeight
                )
            )
            .filter(Boolean)

        for (let dilationPasses = 0; dilationPasses <= 2; dilationPasses += 1) {
            let boundaryMask = PcbOutlineRasterizer.drawBoundaryMask(
                tracks,
                rasterWidth,
                rasterHeight,
                resolutionMil,
                originX,
                originY
            )

            for (let pass = 0; pass < dilationPasses; pass += 1) {
                boundaryMask = PcbOutlineRasterizer.dilateMask(
                    boundaryMask,
                    rasterWidth,
                    rasterHeight
                )
            }

            const exteriorMask = PcbOutlineRasterizer.floodExterior(
                boundaryMask,
                rasterWidth,
                rasterHeight
            )
            const interiorMask = PcbOutlineRasterizer.recoverPlacementInterior(
                boundaryMask,
                exteriorMask,
                rasterWidth,
                rasterHeight,
                componentCells,
                componentBounds,
                resolutionMil,
                originX,
                originY
            )

            if (!interiorMask) {
                continue
            }
            const contourLoops = PcbOutlineRasterizer.traceInteriorLoops(
                interiorMask,
                rasterWidth,
                rasterHeight,
                resolutionMil,
                originX,
                originY
            )

            if (!contourLoops.length) {
                continue
            }

            const points = contourLoops.sort(
                (left, right) =>
                    Math.abs(PcbOutlineRecovery.#computeLoopArea(right)) -
                    Math.abs(PcbOutlineRecovery.#computeLoopArea(left))
            )[0]
            const simplifiedPoints =
                PcbOutlineRecovery.#simplifyLoopPoints(points)

            if (simplifiedPoints.length < 4) {
                continue
            }

            return PcbOutlineRecovery.#buildOutlineFromPoints(simplifiedPoints)
        }

        return null
    }

    /**
     * Returns true when one authored board-route contour is already simple
     * enough to render directly without silhouette recovery.
     * @param {{ segments?: Array<Record<string, number | string>> } | undefined} outline
     * @returns {boolean}
     */
    static #isDirectlyRenderableBoardRoute(outline) {
        const segments = outline?.segments || []

        if (
            !segments.length ||
            segments.length >
                PcbOutlineRecovery.#MAX_DIRECT_RENDER_BOARD_ROUTE_SEGMENTS
        ) {
            return false
        }

        const arcSegments = segments.filter((segment) => segment.type === 'arc')

        if (!arcSegments.length) {
            return false
        }

        if (
            arcSegments.some(
                (segment) =>
                    PcbOutlineRecovery.#computeArcSweep(segment) >
                    PcbOutlineRecovery.#MAX_DIRECT_RENDER_ARC_SWEEP_DEGREES
            )
        ) {
            return false
        }

        return PcbOutlineRecovery.#isClosedOutlinePath(segments)
    }

    /**
     * Returns true when consecutive outline segments connect closely enough to
     * form one closed authored contour.
     * @param {Array<Record<string, number | string>>} segments
     * @returns {boolean}
     */
    static #isClosedOutlinePath(segments) {
        if (!segments.length) {
            return false
        }

        for (let index = 0; index < segments.length; index += 1) {
            const current = segments[index]
            const next = segments[(index + 1) % segments.length]
            const deltaX = Number(current.x2 || 0) - Number(next.x1 || 0)
            const deltaY = Number(current.y2 || 0) - Number(next.y1 || 0)

            if (
                Math.hypot(deltaX, deltaY) >
                PcbOutlineRecovery.#BOARD_ROUTE_CLOSURE_MIL
            ) {
                return false
            }
        }

        return true
    }

    /**
     * Builds one rectangular fallback outline from bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number, widthMil: number, heightMil: number }} bounds
     * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }}
     */
    static #buildRectOutline(bounds) {
        return {
            minX: bounds.minX,
            minY: bounds.minY,
            widthMil: bounds.widthMil,
            heightMil: bounds.heightMil,
            segments: [
                {
                    type: 'line',
                    x1: bounds.minX,
                    y1: bounds.minY,
                    x2: bounds.maxX,
                    y2: bounds.minY
                },
                {
                    type: 'line',
                    x1: bounds.maxX,
                    y1: bounds.minY,
                    x2: bounds.maxX,
                    y2: bounds.maxY
                },
                {
                    type: 'line',
                    x1: bounds.maxX,
                    y1: bounds.maxY,
                    x2: bounds.minX,
                    y2: bounds.maxY
                },
                {
                    type: 'line',
                    x1: bounds.minX,
                    y1: bounds.maxY,
                    x2: bounds.minX,
                    y2: bounds.minY
                }
            ]
        }
    }

    /**
     * Builds one segment outline from traced loop points.
     * @param {{ x: number, y: number }[]} points
     * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }}
     */
    static #buildOutlineFromPoints(points) {
        const segments = []
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY

        for (const point of points) {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
        }

        for (let index = 0; index < points.length; index += 1) {
            const current = points[index]
            const next = points[(index + 1) % points.length]

            segments.push({
                type: 'line',
                x1: current.x,
                y1: current.y,
                x2: next.x,
                y2: next.y
            })
        }

        return {
            minX,
            minY,
            widthMil: maxX - minX,
            heightMil: maxY - minY,
            segments
        }
    }

    /**
     * Removes duplicate closure points and intermediate collinear corners.
     * @param {{ x: number, y: number }[]} points
     * @returns {{ x: number, y: number }[]}
     */
    static #simplifyLoopPoints(points) {
        const normalizedPoints = points.slice()

        if (normalizedPoints.length > 1) {
            const first = normalizedPoints[0]
            const last = normalizedPoints[normalizedPoints.length - 1]

            if (
                Math.abs(first.x - last.x) < 1e-6 &&
                Math.abs(first.y - last.y) < 1e-6
            ) {
                normalizedPoints.pop()
            }
        }

        let changed = true

        while (changed && normalizedPoints.length > 3) {
            changed = false

            for (
                let index = 0;
                index < normalizedPoints.length && normalizedPoints.length > 3;
                index += 1
            ) {
                const previous =
                    normalizedPoints[
                        (index - 1 + normalizedPoints.length) %
                            normalizedPoints.length
                    ]
                const current = normalizedPoints[index]
                const next =
                    normalizedPoints[(index + 1) % normalizedPoints.length]

                if (
                    (Math.abs(previous.x - current.x) < 1e-6 &&
                        Math.abs(current.x - next.x) < 1e-6) ||
                    (Math.abs(previous.y - current.y) < 1e-6 &&
                        Math.abs(current.y - next.y) < 1e-6)
                ) {
                    normalizedPoints.splice(index, 1)
                    changed = true
                    break
                }
            }
        }

        return normalizedPoints
    }

    /**
     * Computes the signed polygon area of one traced loop.
     * @param {{ x: number, y: number }[]} points
     * @returns {number}
     */
    static #computeLoopArea(points) {
        let area = 0

        for (let index = 0; index < points.length; index += 1) {
            const current = points[index]
            const next = points[(index + 1) % points.length]

            area += current.x * next.y - next.x * current.y
        }

        return area / 2
    }

    /**
     * Computes one approximate routed outline area by sampling arc segments
     * densely enough for board-route closure decisions.
     * @param {{ segments?: Array<Record<string, number | string>> } | undefined} outline
     * @returns {number}
     */
    static #computeOutlineArea(outline) {
        const segments = outline?.segments || []

        if (!segments.length) {
            return 0
        }

        const points = []

        for (const segment of segments) {
            const sampledPoints =
                PcbOutlineRecovery.#sampleSegmentPoints(segment)

            if (!sampledPoints.length) {
                continue
            }

            if (!points.length) {
                points.push(sampledPoints[0])
            }

            points.push(...sampledPoints.slice(1))
        }

        if (points.length < 3) {
            return 0
        }

        return Math.abs(PcbOutlineRecovery.#computeLoopArea(points))
    }

    /**
     * Samples one line or arc segment into polygon points for approximate area
     * calculations.
     * @param {Record<string, number | string>} segment
     * @returns {{ x: number, y: number }[]}
     */
    static #sampleSegmentPoints(segment) {
        if (segment.type !== 'arc') {
            return [
                {
                    x: Number(segment.x1 || 0),
                    y: Number(segment.y1 || 0)
                },
                {
                    x: Number(segment.x2 || 0),
                    y: Number(segment.y2 || 0)
                }
            ]
        }

        const startAngle = Number(segment.startAngle || 0)
        const endAngle = Number(segment.endAngle || 0)
        let delta = endAngle - startAngle

        if (Math.abs(delta) < 1e-6) {
            delta = 360
        }

        if (delta < 0) {
            delta += 360
        }

        const steps = Math.max(Math.ceil(Math.abs(delta) / 10), 8)
        const radius = Number(segment.radius) || 0
        const centerX = Number(segment.cx || 0)
        const centerY = Number(segment.cy || 0)
        const points = []

        for (let step = 0; step <= steps; step += 1) {
            const angle =
                ((startAngle + delta * (step / steps)) * Math.PI) / 180

            points.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            })
        }

        return points
    }

    /**
     * Computes one normalized positive arc sweep in degrees.
     * @param {Record<string, number | string>} segment
     * @returns {number}
     */
    static #computeArcSweep(segment) {
        const startAngle = Number(segment.startAngle || 0)
        const endAngle = Number(segment.endAngle || 0)
        let delta = endAngle - startAngle

        if (Math.abs(delta) < 1e-6) {
            delta = 360
        }

        if (delta < 0) {
            delta += 360
        }

        return delta
    }
}
