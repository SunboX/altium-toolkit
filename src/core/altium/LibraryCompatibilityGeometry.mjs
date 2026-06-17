// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const COURTYARD_MARGIN_MIL = 2
const SYMBOL_FIELD_MARGIN_MIL = 10

/**
 * Computes deterministic footprint geometry used by compatibility reports.
 */
export class LibraryCompatibilityGeometry {
    /**
     * Computes merged footprint bounds.
     * @param {object} footprint Footprint row.
     * @returns {object | null}
     */
    static footprintBounds(footprint) {
        return LibraryCompatibilityGeometry.#normalizeBounds(
            [
                ...(footprint?.pads || []).map((pad) =>
                    LibraryCompatibilityGeometry.#padBounds(pad)
                ),
                ...(footprint?.tracks || []).map((track) =>
                    LibraryCompatibilityGeometry.#trackBounds(track)
                ),
                ...(footprint?.fills || []).map((fill) =>
                    LibraryCompatibilityGeometry.#boxBounds(fill)
                ),
                ...(footprint?.arcs || []).map((arc) =>
                    LibraryCompatibilityGeometry.#arcBounds(arc)
                ),
                ...(footprint?.regions || []).map((region) =>
                    LibraryCompatibilityGeometry.#regionBounds(region)
                ),
                ...(footprint?.texts || []).map((text) =>
                    LibraryCompatibilityGeometry.#textBounds(text)
                )
            ].filter(Boolean)
        )
    }

    /**
     * Builds a padded footprint courtyard bound.
     * @param {object} bounds Footprint bounds.
     * @returns {object}
     */
    static courtyard(bounds) {
        return {
            ...LibraryCompatibilityGeometry.#completeBounds({
                minX: bounds.minX - COURTYARD_MARGIN_MIL,
                minY: bounds.minY - COURTYARD_MARGIN_MIL,
                maxX: bounds.maxX + COURTYARD_MARGIN_MIL,
                maxY: bounds.maxY + COURTYARD_MARGIN_MIL
            }),
            marginMil: COURTYARD_MARGIN_MIL
        }
    }

    /**
     * Counts footprint primitive families used by bounds.
     * @param {object} footprint Footprint row.
     * @returns {object}
     */
    static sourceCounts(footprint) {
        return {
            pads: (footprint?.pads || []).length,
            tracks: (footprint?.tracks || []).length,
            arcs: (footprint?.arcs || []).length,
            fills: (footprint?.fills || []).length,
            regions: (footprint?.regions || []).length,
            texts: (footprint?.texts || []).length
        }
    }

    /**
     * Computes schematic symbol bounds from pins and drawn body primitives.
     * @param {object} symbol Schematic library symbol row.
     * @returns {object | null}
     */
    static symbolBounds(symbol) {
        const bodyBounds = LibraryCompatibilityGeometry.#normalizeBounds(
            LibraryCompatibilityGeometry.#symbolBodyBounds(symbol)
        )
        const pinBounds = LibraryCompatibilityGeometry.#normalizeBounds(
            (symbol?.pins || [])
                .map((pin) =>
                    LibraryCompatibilityGeometry.#schematicPinBounds(pin)
                )
                .filter(Boolean)
        )
        const bounds = LibraryCompatibilityGeometry.#normalizeBounds(
            [bodyBounds, pinBounds].filter(Boolean)
        )

        if (!bounds) return null

        return {
            bounds,
            ...(bodyBounds ? { bodyBounds } : {}),
            ...(pinBounds ? { pinBounds } : {}),
            fieldAnchors:
                LibraryCompatibilityGeometry.#symbolFieldAnchors(bounds),
            sourceCounts: {
                pins: (symbol?.pins || []).length,
                bodyPrimitives:
                    LibraryCompatibilityGeometry.#symbolBodyPrimitiveCount(
                        symbol
                    ),
                texts: (symbol?.texts || []).length
            }
        }
    }

    /**
     * Computes bounds for one custom-pad shape layer.
     * @param {object} layer Custom-shape layer row.
     * @returns {object | null}
     */
    static customShapeLayerBounds(layer) {
        return LibraryCompatibilityGeometry.#normalizeBounds(
            [
                ...(layer?.regions || []).map((region) =>
                    LibraryCompatibilityGeometry.#regionBounds(region)
                ),
                ...(layer?.shapeRegions || []).map((region) =>
                    LibraryCompatibilityGeometry.#regionBounds(region)
                ),
                ...(layer?.tracks || []).map((track) =>
                    LibraryCompatibilityGeometry.#trackBounds(track)
                ),
                ...(layer?.arcs || []).map((arc) =>
                    LibraryCompatibilityGeometry.#arcBounds(arc)
                ),
                ...(layer?.fills || []).map((fill) =>
                    LibraryCompatibilityGeometry.#boxBounds(fill)
                )
            ].filter(Boolean)
        )
    }

    /**
     * Returns true when a normalized bounds row has no area.
     * @param {object | null} bounds Bounds row.
     * @returns {boolean}
     */
    static hasZeroArea(bounds) {
        return Boolean(
            bounds &&
            (Number(bounds.width || 0) === 0 ||
                Number(bounds.height || 0) === 0)
        )
    }

    /**
     * Returns whether two bounds are equivalent after report rounding.
     * @param {object | null} left First bounds row.
     * @param {object | null} right Second bounds row.
     * @returns {boolean}
     */
    static sameBounds(left, right) {
        if (!left || !right) return false

        return ['minX', 'minY', 'maxX', 'maxY', 'width', 'height'].every(
            (key) => Number(left[key]) === Number(right[key])
        )
    }

    /**
     * Computes axis-aligned bounds for one pad.
     * @param {object} pad Pad row.
     * @returns {object | null}
     */
    static #padBounds(pad) {
        const x = LibraryCompatibilityGeometry.#finiteNumber(pad?.x)
        const y = LibraryCompatibilityGeometry.#finiteNumber(pad?.y)
        const width = LibraryCompatibilityGeometry.#padWidth(pad)
        const height = LibraryCompatibilityGeometry.#padHeight(pad)

        if (x === null || y === null || width === null || height === null) {
            return null
        }

        return LibraryCompatibilityGeometry.#rotatedBoxBounds(
            x,
            y,
            width,
            height,
            Number(pad?.rotation || 0)
        )
    }

    /**
     * Computes one rotated rectangle bound.
     * @param {number} centerX Center x.
     * @param {number} centerY Center y.
     * @param {number} width Rectangle width.
     * @param {number} height Rectangle height.
     * @param {number} rotationDeg Rotation in degrees.
     * @returns {object}
     */
    static #rotatedBoxBounds(centerX, centerY, width, height, rotationDeg) {
        const halfWidth = Math.abs(width) / 2
        const halfHeight = Math.abs(height) / 2
        const radians = (Number(rotationDeg) || 0) * (Math.PI / 180)
        const cos = Math.cos(radians)
        const sin = Math.sin(radians)
        const corners = [
            [-halfWidth, -halfHeight],
            [halfWidth, -halfHeight],
            [halfWidth, halfHeight],
            [-halfWidth, halfHeight]
        ].map(([x, y]) => ({
            x: centerX + x * cos - y * sin,
            y: centerY + x * sin + y * cos
        }))

        return LibraryCompatibilityGeometry.#pointsBounds(corners)
    }

    /**
     * Computes one track line bound.
     * @param {object} track Track row.
     * @returns {object | null}
     */
    static #trackBounds(track) {
        const x1 = LibraryCompatibilityGeometry.#finiteNumber(track?.x1)
        const y1 = LibraryCompatibilityGeometry.#finiteNumber(track?.y1)
        const x2 = LibraryCompatibilityGeometry.#finiteNumber(track?.x2)
        const y2 = LibraryCompatibilityGeometry.#finiteNumber(track?.y2)
        if (x1 === null || y1 === null || x2 === null || y2 === null) {
            return null
        }

        const inflate = Math.abs(Number(track?.width || 0)) / 2
        return {
            minX: Math.min(x1, x2) - inflate,
            minY: Math.min(y1, y2) - inflate,
            maxX: Math.max(x1, x2) + inflate,
            maxY: Math.max(y1, y2) + inflate
        }
    }

    /**
     * Computes one box bound.
     * @param {object} box Box-like primitive.
     * @returns {object | null}
     */
    static #boxBounds(box) {
        const x1 = LibraryCompatibilityGeometry.#finiteNumber(box?.x1)
        const y1 = LibraryCompatibilityGeometry.#finiteNumber(box?.y1)
        const x2 = LibraryCompatibilityGeometry.#finiteNumber(box?.x2)
        const y2 = LibraryCompatibilityGeometry.#finiteNumber(box?.y2)
        if (x1 === null || y1 === null || x2 === null || y2 === null) {
            return null
        }

        return {
            minX: Math.min(x1, x2),
            minY: Math.min(y1, y2),
            maxX: Math.max(x1, x2),
            maxY: Math.max(y1, y2)
        }
    }

    /**
     * Computes one full-circle arc bound.
     * @param {object} arc Arc row.
     * @returns {object | null}
     */
    static #arcBounds(arc) {
        const x = LibraryCompatibilityGeometry.#finiteNumber(arc?.x)
        const y = LibraryCompatibilityGeometry.#finiteNumber(arc?.y)
        const radius = LibraryCompatibilityGeometry.#finiteNumber(arc?.radius)
        if (x === null || y === null || radius === null) return null

        const inflate = Math.abs(Number(arc?.width || 0)) / 2
        const extent = Math.abs(radius) + inflate
        return {
            minX: x - extent,
            minY: y - extent,
            maxX: x + extent,
            maxY: y + extent
        }
    }

    /**
     * Computes one region point bound.
     * @param {object} region Region row.
     * @returns {object | null}
     */
    static #regionBounds(region) {
        const points = (region?.points || [])
            .map((point) => ({
                x: LibraryCompatibilityGeometry.#finiteNumber(point?.x),
                y: LibraryCompatibilityGeometry.#finiteNumber(point?.y)
            }))
            .filter((point) => point.x !== null && point.y !== null)

        return LibraryCompatibilityGeometry.#pointsBounds(points)
    }

    /**
     * Computes an approximate text bound.
     * @param {object} text Text row.
     * @returns {object | null}
     */
    static #textBounds(text) {
        const x = LibraryCompatibilityGeometry.#finiteNumber(text?.x)
        const y = LibraryCompatibilityGeometry.#finiteNumber(text?.y)
        const height =
            LibraryCompatibilityGeometry.#finiteNumber(text?.height) || null
        if (x === null || y === null || height === null) return null

        const width =
            Math.max(String(text?.text || '').length, 1) * height * 0.6
        return LibraryCompatibilityGeometry.#rotatedBoxBounds(
            x,
            y,
            width,
            height,
            Number(text?.rotation || 0)
        )
    }

    /**
     * Computes body primitive bounds for one schematic symbol.
     * @param {object} symbol Schematic library symbol row.
     * @returns {object[]}
     */
    static #symbolBodyBounds(symbol) {
        return [
            ...(symbol?.rectangles || []).map((box) =>
                LibraryCompatibilityGeometry.#schematicBoxBounds(box)
            ),
            ...(symbol?.roundedRectangles || []).map((box) =>
                LibraryCompatibilityGeometry.#schematicBoxBounds(box)
            ),
            ...(symbol?.lines || []).map((line) =>
                LibraryCompatibilityGeometry.#trackBounds(line)
            ),
            ...(symbol?.polygons || []).map((polygon) =>
                LibraryCompatibilityGeometry.#regionBounds(polygon)
            ),
            ...(symbol?.regions || []).map((region) =>
                LibraryCompatibilityGeometry.#regionBounds(region)
            ),
            ...(symbol?.beziers || []).map((bezier) =>
                LibraryCompatibilityGeometry.#regionBounds(bezier)
            ),
            ...(symbol?.ellipses || []).map((ellipse) =>
                LibraryCompatibilityGeometry.#ellipseBounds(ellipse)
            ),
            ...(symbol?.arcs || []).map((arc) =>
                LibraryCompatibilityGeometry.#arcBounds(arc)
            ),
            ...(symbol?.pies || []).map((pie) =>
                LibraryCompatibilityGeometry.#arcBounds(pie)
            )
        ].filter(Boolean)
    }

    /**
     * Counts drawn symbol body primitives.
     * @param {object} symbol Schematic library symbol row.
     * @returns {number}
     */
    static #symbolBodyPrimitiveCount(symbol) {
        return [
            'rectangles',
            'roundedRectangles',
            'lines',
            'polygons',
            'regions',
            'beziers',
            'ellipses',
            'arcs',
            'pies'
        ].reduce((sum, key) => sum + (symbol?.[key] || []).length, 0)
    }

    /**
     * Computes bounds for one schematic pin.
     * @param {object} pin Pin row.
     * @returns {object | null}
     */
    static #schematicPinBounds(pin) {
        const x = LibraryCompatibilityGeometry.#finiteNumber(pin?.x)
        const y = LibraryCompatibilityGeometry.#finiteNumber(pin?.y)
        const length = LibraryCompatibilityGeometry.#finiteNumber(pin?.length)

        if (x === null || y === null || length === null) return null

        const endpoint =
            {
                left: { x: x - length, y },
                right: { x: x + length, y },
                top: { x, y: y + length },
                bottom: { x, y: y - length }
            }[String(pin?.orientation || '').toLowerCase()] || null

        if (!endpoint) return null

        return LibraryCompatibilityGeometry.#pointsBounds([{ x, y }, endpoint])
    }

    /**
     * Computes bounds for one schematic box primitive.
     * @param {object} box Box-like primitive.
     * @returns {object | null}
     */
    static #schematicBoxBounds(box) {
        const x = LibraryCompatibilityGeometry.#finiteNumber(box?.x ?? box?.x1)
        const y = LibraryCompatibilityGeometry.#finiteNumber(box?.y ?? box?.y1)
        const width = LibraryCompatibilityGeometry.#finiteNumber(box?.width)
        const height = LibraryCompatibilityGeometry.#finiteNumber(box?.height)
        const x2 = LibraryCompatibilityGeometry.#finiteNumber(
            box?.x2 ?? box?.cornerX
        )
        const y2 = LibraryCompatibilityGeometry.#finiteNumber(
            box?.y2 ?? box?.cornerY
        )

        if (x !== null && y !== null && width !== null && height !== null) {
            return LibraryCompatibilityGeometry.#pointsBounds([
                { x, y },
                { x: x + width, y: y + height }
            ])
        }

        if (x !== null && y !== null && x2 !== null && y2 !== null) {
            return LibraryCompatibilityGeometry.#pointsBounds([
                { x, y },
                { x: x2, y: y2 }
            ])
        }

        return null
    }

    /**
     * Computes bounds for one schematic ellipse primitive.
     * @param {object} ellipse Ellipse row.
     * @returns {object | null}
     */
    static #ellipseBounds(ellipse) {
        const x = LibraryCompatibilityGeometry.#finiteNumber(ellipse?.x)
        const y = LibraryCompatibilityGeometry.#finiteNumber(ellipse?.y)
        const radiusX =
            LibraryCompatibilityGeometry.#finiteNumber(ellipse?.radiusX) ??
            LibraryCompatibilityGeometry.#finiteNumber(ellipse?.radius)
        const radiusY =
            LibraryCompatibilityGeometry.#finiteNumber(ellipse?.radiusY) ??
            radiusX

        if (x === null || y === null || radiusX === null || radiusY === null) {
            return null
        }

        return {
            minX: x - Math.abs(radiusX),
            minY: y - Math.abs(radiusY),
            maxX: x + Math.abs(radiusX),
            maxY: y + Math.abs(radiusY)
        }
    }

    /**
     * Builds deterministic field anchor hints from symbol bounds.
     * @param {object} bounds Normalized symbol bounds.
     * @returns {object}
     */
    static #symbolFieldAnchors(bounds) {
        return {
            designator: {
                x: bounds.minX,
                y: LibraryCompatibilityGeometry.#round(
                    bounds.maxY + SYMBOL_FIELD_MARGIN_MIL
                ),
                horizontal: 'left',
                vertical: 'bottom'
            },
            comment: {
                x: bounds.minX,
                y: LibraryCompatibilityGeometry.#round(
                    bounds.minY - SYMBOL_FIELD_MARGIN_MIL
                ),
                horizontal: 'left',
                vertical: 'top'
            }
        }
    }

    /**
     * Resolves the effective pad width.
     * @param {object} pad Pad row.
     * @returns {number | null}
     */
    static #padWidth(pad) {
        return LibraryCompatibilityGeometry.#maxPositive([
            pad?.sizeTopX,
            pad?.sizeMidX,
            pad?.sizeBottomX,
            ...(pad?.padStack?.layers || []).map((layer) => layer?.width),
            ...(pad?.localPadStack?.layers || []).map((layer) => layer?.width)
        ])
    }

    /**
     * Resolves the effective pad height.
     * @param {object} pad Pad row.
     * @returns {number | null}
     */
    static #padHeight(pad) {
        return LibraryCompatibilityGeometry.#maxPositive([
            pad?.sizeTopY,
            pad?.sizeMidY,
            pad?.sizeBottomY,
            ...(pad?.padStack?.layers || []).map((layer) => layer?.height),
            ...(pad?.localPadStack?.layers || []).map((layer) => layer?.height)
        ])
    }

    /**
     * Finds the largest finite absolute value from a list.
     * @param {unknown[]} values Candidate values.
     * @returns {number | null}
     */
    static #maxPositive(values) {
        const finiteValues = (values || [])
            .map((value) => LibraryCompatibilityGeometry.#finiteNumber(value))
            .filter((value) => value !== null)
            .map((value) => Math.abs(value))

        if (!finiteValues.length) return null
        return Math.max(...finiteValues)
    }

    /**
     * Builds bounds from points.
     * @param {{ x: number | null, y: number | null }[]} points Point rows.
     * @returns {object | null}
     */
    static #pointsBounds(points) {
        const finitePoints = (points || []).filter(
            (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
        )
        if (!finitePoints.length) return null

        return {
            minX: Math.min(...finitePoints.map((point) => point.x)),
            minY: Math.min(...finitePoints.map((point) => point.y)),
            maxX: Math.max(...finitePoints.map((point) => point.x)),
            maxY: Math.max(...finitePoints.map((point) => point.y))
        }
    }

    /**
     * Merges and normalizes multiple bounds.
     * @param {object[]} bounds Bounds rows.
     * @returns {object | null}
     */
    static #normalizeBounds(bounds) {
        const finiteBounds = (bounds || []).filter(
            (bound) =>
                Number.isFinite(bound?.minX) &&
                Number.isFinite(bound?.minY) &&
                Number.isFinite(bound?.maxX) &&
                Number.isFinite(bound?.maxY)
        )
        if (!finiteBounds.length) return null

        return LibraryCompatibilityGeometry.#completeBounds({
            minX: Math.min(...finiteBounds.map((bound) => bound.minX)),
            minY: Math.min(...finiteBounds.map((bound) => bound.minY)),
            maxX: Math.max(...finiteBounds.map((bound) => bound.maxX)),
            maxY: Math.max(...finiteBounds.map((bound) => bound.maxY))
        })
    }

    /**
     * Adds width and height fields to a bound.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Raw bounds.
     * @returns {object}
     */
    static #completeBounds(bounds) {
        return {
            minX: LibraryCompatibilityGeometry.#round(bounds.minX),
            minY: LibraryCompatibilityGeometry.#round(bounds.minY),
            maxX: LibraryCompatibilityGeometry.#round(bounds.maxX),
            maxY: LibraryCompatibilityGeometry.#round(bounds.maxY),
            width: LibraryCompatibilityGeometry.#round(
                bounds.maxX - bounds.minX
            ),
            height: LibraryCompatibilityGeometry.#round(
                bounds.maxY - bounds.minY
            )
        }
    }

    /**
     * Converts one value to a finite number.
     * @param {unknown} value Candidate number.
     * @returns {number | null}
     */
    static #finiteNumber(value) {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : null
    }

    /**
     * Rounds floating-point report values.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        return Number(Number(value).toFixed(6))
    }
}
