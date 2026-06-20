/**
 * Mirrors Altium PCB render models into the same bottom-view frame used by
 * the 3D bottom preset.
 */
export class AltiumPcbBottomViewMirror {
    /**
     * Mirrors a side-resolved Altium PCB model horizontally around the board.
     * @param {object | null} documentModel Side-resolved PCB document model.
     * @returns {object | null}
     */
    static apply(documentModel) {
        const pcb = documentModel?.pcb
        const outline = pcb?.boardOutline
        if (!pcb || !outline) {
            return documentModel || null
        }

        const mirrorX = AltiumPcbBottomViewMirror.#buildMirrorX(outline)

        return {
            ...documentModel,
            pcb: {
                ...pcb,
                boardOutline: AltiumPcbBottomViewMirror.#mirrorOutline(
                    outline,
                    mirrorX
                ),
                polygons: AltiumPcbBottomViewMirror.#mirrorPolygons(
                    pcb.polygons,
                    mirrorX
                ),
                fills: AltiumPcbBottomViewMirror.#mirrorFills(
                    pcb.fills,
                    mirrorX
                ),
                tracks: AltiumPcbBottomViewMirror.#mirrorTracks(
                    pcb.tracks,
                    mirrorX
                ),
                arcs: AltiumPcbBottomViewMirror.#mirrorArcs(pcb.arcs, mirrorX),
                regions: AltiumPcbBottomViewMirror.#mirrorRegions(
                    pcb.regions,
                    mirrorX
                ),
                shapeBasedRegions: AltiumPcbBottomViewMirror.#mirrorRegions(
                    pcb.shapeBasedRegions,
                    mirrorX
                ),
                boardRegions: AltiumPcbBottomViewMirror.#mirrorRegions(
                    pcb.boardRegions,
                    mirrorX
                ),
                vias: AltiumPcbBottomViewMirror.#mirrorVias(pcb.vias, mirrorX),
                pads: AltiumPcbBottomViewMirror.#mirrorPads(pcb.pads, mirrorX),
                texts: AltiumPcbBottomViewMirror.#mirrorTexts(pcb.texts),
                textGroupTransform:
                    AltiumPcbBottomViewMirror.#buildTextGroupTransform(outline),
                components: AltiumPcbBottomViewMirror.#mirrorComponents(
                    pcb.components,
                    mirrorX
                )
            }
        }
    }

    /**
     * Builds the board-space X-axis mirror function.
     * @param {{ minX?: number, widthMil?: number }} outline Board outline.
     * @returns {(value: unknown) => number}
     */
    static #buildMirrorX(outline) {
        const minX = Number(outline?.minX || 0)
        const maxX = minX + Number(outline?.widthMil || 0)

        return (value) => minX + maxX - Number(value || 0)
    }

    /**
     * Builds the SVG text-layer mirror used by the bottom 3D preset.
     * @param {{ minX?: number, widthMil?: number }} outline Board outline.
     * @returns {{ translateX: number, translateY: number, scaleX: number, scaleY: number }}
     */
    static #buildTextGroupTransform(outline) {
        const minX = Number(outline?.minX || 0)
        const maxX = minX + Number(outline?.widthMil || 0)

        return {
            translateX: minX + maxX,
            translateY: 0,
            scaleX: -1,
            scaleY: 1
        }
    }

    /**
     * Mirrors the board outline segment coordinates.
     * @param {object} outline Board outline.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object}
     */
    static #mirrorOutline(outline, mirrorX) {
        return {
            ...outline,
            segments: AltiumPcbBottomViewMirror.#mirrorSegments(
                outline?.segments,
                mirrorX
            )
        }
    }

    /**
     * Mirrors polygon segment coordinates.
     * @param {readonly object[] | undefined} polygons Polygon primitives.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorPolygons(polygons, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(polygons).map((polygon) => ({
            ...polygon,
            segments: AltiumPcbBottomViewMirror.#mirrorSegments(
                polygon?.segments,
                mirrorX
            )
        }))
    }

    /**
     * Mirrors path segment X coordinates.
     * @param {readonly object[] | undefined} segments Path segments.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorSegments(segments, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(segments).map((segment) => ({
            ...segment,
            x1: mirrorX(segment?.x1),
            x2: mirrorX(segment?.x2),
            ...(segment?.cx === null || segment?.cx === undefined
                ? {}
                : { cx: mirrorX(segment.cx) })
        }))
    }

    /**
     * Mirrors rectangular fill extents.
     * @param {readonly object[] | undefined} fills Fill primitives.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorFills(fills, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(fills).map((fill) => ({
            ...fill,
            x1: mirrorX(fill?.x1),
            x2: mirrorX(fill?.x2),
            points: AltiumPcbBottomViewMirror.#mirrorPointList(
                fill?.points,
                mirrorX
            ),
            holes: AltiumPcbBottomViewMirror.#mirrorHoleLists(
                fill?.holes,
                mirrorX
            )
        }))
    }

    /**
     * Mirrors line track endpoints.
     * @param {readonly object[] | undefined} tracks Track primitives.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorTracks(tracks, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(tracks).map((track) => ({
            ...track,
            x1: mirrorX(track?.x1),
            x2: mirrorX(track?.x2)
        }))
    }

    /**
     * Mirrors arc centers and angular spans.
     * @param {readonly object[] | undefined} arcs Arc primitives.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorArcs(arcs, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(arcs).map((arc) => ({
            ...arc,
            x: mirrorX(arc?.x),
            startAngle: AltiumPcbBottomViewMirror.#mirrorAngleX(
                arc?.startAngle
            ),
            endAngle: AltiumPcbBottomViewMirror.#mirrorAngleX(arc?.endAngle)
        }))
    }

    /**
     * Mirrors filled region contours and holes.
     * @param {readonly object[] | undefined} regions Region primitives.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorRegions(regions, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(regions).map((region) => ({
            ...region,
            points: AltiumPcbBottomViewMirror.#mirrorPointList(
                region?.points,
                mirrorX
            ),
            holes: AltiumPcbBottomViewMirror.#mirrorHoleLists(
                region?.holes,
                mirrorX
            ),
            ...(Array.isArray(region?.bendingLines)
                ? {
                      bendingLines:
                          AltiumPcbBottomViewMirror.#mirrorBendingLines(
                              region.bendingLines,
                              mirrorX
                          )
                  }
                : {})
        }))
    }

    /**
     * Mirrors via centers.
     * @param {readonly object[] | undefined} vias Via primitives.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorVias(vias, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(vias).map((via) => ({
            ...via,
            x: mirrorX(via?.x)
        }))
    }

    /**
     * Mirrors pad centers and X-axis local offsets.
     * @param {readonly object[] | undefined} pads Pad primitives.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorPads(pads, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(pads).map((pad) => ({
            ...pad,
            x: mirrorX(pad?.x),
            rotation: AltiumPcbBottomViewMirror.#mirrorRotation(pad?.rotation),
            holeRotation:
                pad?.holeRotation === null || pad?.holeRotation === undefined
                    ? (pad?.holeRotation ?? null)
                    : AltiumPcbBottomViewMirror.#mirrorRotation(
                          pad.holeRotation
                      ),
            ...(pad?.offsetTopX === null || pad?.offsetTopX === undefined
                ? {}
                : { offsetTopX: -Number(pad.offsetTopX || 0) })
        }))
    }

    /**
     * Preserves PCB text insertion points for the mirrored text layer.
     * @param {readonly object[] | undefined} texts Text primitives.
     * @returns {object[]}
     */
    static #mirrorTexts(texts) {
        return AltiumPcbBottomViewMirror.#array(texts).map((text) => ({
            ...text
        }))
    }

    /**
     * Mirrors component origins and package rotations.
     * @param {readonly object[] | undefined} components Component records.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorComponents(components, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(components).map(
            (component) => ({
                ...component,
                x: mirrorX(component?.x),
                rotation: AltiumPcbBottomViewMirror.#mirrorRotation(
                    component?.rotation
                )
            })
        )
    }

    /**
     * Mirrors a list of point objects.
     * @param {readonly object[] | undefined} points Point list.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorPointList(points, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(points).map((point) => ({
            ...point,
            x: mirrorX(point?.x),
            ...(point?.centerX === null || point?.centerX === undefined
                ? {}
                : { centerX: mirrorX(point.centerX) }),
            ...(point?.startAngle === null || point?.startAngle === undefined
                ? {}
                : {
                      startAngle: AltiumPcbBottomViewMirror.#mirrorAngleX(
                          point.startAngle
                      )
                  }),
            ...(point?.endAngle === null || point?.endAngle === undefined
                ? {}
                : {
                      endAngle: AltiumPcbBottomViewMirror.#mirrorAngleX(
                          point.endAngle
                      )
                  })
        }))
    }

    /**
     * Mirrors nested hole point lists.
     * @param {readonly object[][] | undefined} holes Hole point lists.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[][]}
     */
    static #mirrorHoleLists(holes, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(holes).map((hole) =>
            AltiumPcbBottomViewMirror.#mirrorPointList(hole, mirrorX)
        )
    }

    /**
     * Mirrors board-region bending-line X endpoints.
     * @param {readonly object[] | undefined} bendingLines Bending lines.
     * @param {(value: unknown) => number} mirrorX X-axis mirror function.
     * @returns {object[]}
     */
    static #mirrorBendingLines(bendingLines, mirrorX) {
        return AltiumPcbBottomViewMirror.#array(bendingLines).map((line) => ({
            ...line,
            x1:
                line?.x1 === null || line?.x1 === undefined
                    ? (line?.x1 ?? null)
                    : mirrorX(line.x1),
            x2:
                line?.x2 === null || line?.x2 === undefined
                    ? (line?.x2 ?? null)
                    : mirrorX(line.x2)
        }))
    }

    /**
     * Mirrors an object rotation across the board X axis.
     * @param {unknown} angle Rotation angle in degrees.
     * @returns {number}
     */
    static #mirrorRotation(angle) {
        return AltiumPcbBottomViewMirror.#normalizeAngle(
            180 - Number(angle || 0)
        )
    }

    /**
     * Mirrors a polar angle across the board X axis.
     * @param {unknown} angle Angle in degrees.
     * @returns {number}
     */
    static #mirrorAngleX(angle) {
        return AltiumPcbBottomViewMirror.#normalizeAngle(
            180 - Number(angle || 0)
        )
    }

    /**
     * Normalizes one angle into the [0, 360) range.
     * @param {number} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }

    /**
     * Returns an array copy for transform operations.
     * @param {readonly object[] | undefined} value Input collection.
     * @returns {object[]}
     */
    static #array(value) {
        return Array.isArray(value) ? Array.from(value) : []
    }
}
