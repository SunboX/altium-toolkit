// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Mirrors normalized PCB primitive coordinates into SVG top-view space.
 */
export class PcbGeometryFlipper {
    /**
     * Mirrors one normalized PCB model vertically.
     * @param {{ boardOutline: { minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }, polygons?: { layer?: string, segments: Array<Record<string, number | string>> }[], fills?: { x1: number, y1: number, x2: number, y2: number, layerCode?: number, layerId?: number }[], tracks?: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number, layerId?: number }[], arcs?: { x: number, y: number, radius: number, startAngle: number, endAngle: number, width: number, layerCode?: number, layerId?: number }[], vias?: { x: number, y: number, diameter: number, holeDiameter: number }[], pads?: { x: number, y: number, rotation?: number, holeRotation?: number | null }[], regions?: { points?: object[], holes?: object[][] }[], shapeBasedRegions?: { points?: object[], holes?: object[][] }[], boardRegions?: { points?: object[], holes?: object[][] }[], texts?: { x: number, y: number, rotation?: number }[], components?: { designator: string, x: number, y: number, rotation: number, layer: string, pattern: string }[] }} pcb
     * @returns {object}
     */
    static flipGeometryVertically(pcb) {
        const outline = pcb?.boardOutline
        const maxY =
            Number(outline?.minY || 0) + Number(outline?.heightMil || 0)
        const mirrorY = (value) =>
            Number(outline?.minY || 0) + maxY - Number(value || 0)

        return {
            ...pcb,
            boardOutline: {
                ...outline,
                segments: (outline?.segments || []).map((segment) =>
                    PcbGeometryFlipper.#flipSegment(segment, mirrorY)
                )
            },
            polygons: (pcb?.polygons || []).map((polygon) => ({
                ...polygon,
                segments: (polygon.segments || []).map((segment) =>
                    PcbGeometryFlipper.#flipSegment(segment, mirrorY)
                )
            })),
            fills: PcbGeometryFlipper.#flipFills(pcb?.fills || [], mirrorY),
            tracks: (pcb?.tracks || []).map((track) => ({
                ...track,
                y1: mirrorY(track.y1),
                y2: mirrorY(track.y2)
            })),
            arcs: (pcb?.arcs || []).map((arc) => ({
                ...arc,
                y: mirrorY(arc.y),
                startAngle: PcbGeometryFlipper.#normalizeAngle(
                    360 - Number(arc.startAngle || 0)
                ),
                endAngle: PcbGeometryFlipper.#normalizeAngle(
                    360 - Number(arc.endAngle || 0)
                )
            })),
            vias: (pcb?.vias || []).map((via) => ({
                ...via,
                y: mirrorY(via.y)
            })),
            pads: (pcb?.pads || []).map((pad) =>
                PcbGeometryFlipper.#flipPad(pad, mirrorY)
            ),
            regions: PcbGeometryFlipper.#flipRegions(
                pcb?.regions || [],
                mirrorY
            ),
            shapeBasedRegions: PcbGeometryFlipper.#flipRegions(
                pcb?.shapeBasedRegions || [],
                mirrorY
            ),
            boardRegions: PcbGeometryFlipper.#flipRegions(
                pcb?.boardRegions || [],
                mirrorY
            ),
            texts: (pcb?.texts || []).map((text) => ({
                ...text,
                y: mirrorY(text.y),
                rotation: PcbGeometryFlipper.#normalizeAngle(
                    360 - Number(text.rotation || 0)
                )
            })),
            components: (pcb?.components || []).map((component) => ({
                ...component,
                y: mirrorY(component.y),
                rotation: PcbGeometryFlipper.#normalizeAngle(
                    360 - Number(component.rotation || 0)
                )
            }))
        }
    }

    /**
     * Mirrors rectangular fill extents across the board Y axis.
     * @param {{ y1: number, y2: number }[]} fills
     * @param {(value: number) => number} mirrorY
     * @returns {object[]}
     */
    static #flipFills(fills, mirrorY) {
        return fills.map((fill) => {
            const y1 = mirrorY(fill.y1)
            const y2 = mirrorY(fill.y2)

            return {
                ...fill,
                y1: Math.min(y1, y2),
                y2: Math.max(y1, y2)
            }
        })
    }

    /**
     * Mirrors one pad center and rotation across the board Y axis.
     * @param {{ y: number, rotation?: number, holeRotation?: number | null }} pad
     * @param {(value: number) => number} mirrorY
     * @returns {object}
     */
    static #flipPad(pad, mirrorY) {
        return {
            ...pad,
            y: mirrorY(pad.y),
            rotation: PcbGeometryFlipper.#normalizeAngle(
                360 - Number(pad.rotation || 0)
            ),
            holeRotation:
                pad?.holeRotation === null || pad?.holeRotation === undefined
                    ? (pad?.holeRotation ?? null)
                    : PcbGeometryFlipper.#normalizeAngle(
                          360 - Number(pad.holeRotation || 0)
                      )
        }
    }

    /**
     * Mirrors one outline or polygon segment across the board Y axis.
     * @param {Record<string, number | string>} segment
     * @param {(value: number) => number} mirrorY
     * @returns {Record<string, number | string>}
     */
    static #flipSegment(segment, mirrorY) {
        if (segment.type !== 'arc') {
            return {
                ...segment,
                y1: mirrorY(Number(segment.y1 || 0)),
                y2: mirrorY(Number(segment.y2 || 0))
            }
        }

        const startAngle = Number(segment.startAngle || 0)
        const endAngle = Number(segment.endAngle || 0)

        return {
            ...segment,
            y1: mirrorY(Number(segment.y1 || 0)),
            y2: mirrorY(Number(segment.y2 || 0)),
            cy: mirrorY(Number(segment.cy || 0)),
            startAngle: PcbGeometryFlipper.#normalizeAngle(360 - startAngle),
            endAngle: PcbGeometryFlipper.#normalizeAngle(360 - endAngle)
        }
    }

    /**
     * Mirrors filled region contours and holes across the board Y axis.
     * @param {{ points?: object[], holes?: object[][] }[]} regions
     * @param {(value: number) => number} mirrorY
     * @returns {object[]}
     */
    static #flipRegions(regions, mirrorY) {
        return regions.map((region) => ({
            ...region,
            points: PcbGeometryFlipper.#flipRegionPoints(
                region.points || [],
                mirrorY
            ),
            holes: (region.holes || []).map((hole) =>
                PcbGeometryFlipper.#flipRegionPoints(hole, mirrorY)
            ),
            ...(Array.isArray(region.bendingLines)
                ? {
                      bendingLines: PcbGeometryFlipper.#flipBendingLines(
                          region.bendingLines,
                          mirrorY
                      )
                  }
                : {})
        }))
    }

    /**
     * Mirrors board-region bending-line endpoints across the board Y axis.
     * @param {{ y1?: number | null, y2?: number | null }[]} bendingLines
     * @param {(value: number) => number} mirrorY
     * @returns {object[]}
     */
    static #flipBendingLines(bendingLines, mirrorY) {
        return bendingLines.map((line) => ({
            ...line,
            y1:
                line.y1 === null || line.y1 === undefined
                    ? (line.y1 ?? null)
                    : mirrorY(line.y1),
            y2:
                line.y2 === null || line.y2 === undefined
                    ? (line.y2 ?? null)
                    : mirrorY(line.y2)
        }))
    }

    /**
     * Mirrors one region point list across the board Y axis.
     * @param {object[]} points
     * @param {(value: number) => number} mirrorY
     * @returns {object[]}
     */
    static #flipRegionPoints(points, mirrorY) {
        return points.map((point) => {
            const nextPoint = {
                ...point,
                y: mirrorY(point.y)
            }

            if (point.centerY !== null && point.centerY !== undefined) {
                nextPoint.centerY = mirrorY(point.centerY)
            }
            if (point.startAngle !== null && point.startAngle !== undefined) {
                nextPoint.startAngle = PcbGeometryFlipper.#normalizeAngle(
                    360 - Number(point.startAngle || 0)
                )
            }
            if (point.endAngle !== null && point.endAngle !== undefined) {
                nextPoint.endAngle = PcbGeometryFlipper.#normalizeAngle(
                    360 - Number(point.endAngle || 0)
                )
            }

            return nextPoint
        })
    }

    /**
     * Normalizes one circular angle into the [0, 360) range.
     * @param {number} angle
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }
}
