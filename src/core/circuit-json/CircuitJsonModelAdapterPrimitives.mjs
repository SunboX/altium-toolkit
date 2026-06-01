// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const MILS_PER_MM = 39.37007874015748

/**
 * Shared primitive conversions for Circuit JSON adapters.
 */
export class CircuitJsonModelAdapterPrimitives {
    /**
     * Returns a deterministic id scope for one parsed file.
     * @param {Record<string, unknown>} model
     * @param {string} sourceFormat
     * @returns {string}
     */
    static idScope(model, sourceFormat) {
        return CircuitJsonModelAdapterPrimitives.id('', [
            sourceFormat,
            model.fileType || 'document',
            model.fileName || model.summary?.title || 'untitled'
        ])
    }

    /**
     * Returns a deterministic Circuit JSON id.
     * @param {string} scope
     * @param {unknown[]} parts
     * @returns {string}
     */
    static id(scope, parts) {
        const idParts = [scope, ...parts]
            .filter(
                (part) => part !== undefined && part !== null && part !== ''
            )
            .map((part) => CircuitJsonModelAdapterPrimitives.#idPart(part))

        return ['cj', ...idParts].filter(Boolean).join('_')
    }

    /**
     * Returns a string value.
     * @param {unknown} value
     * @param {string} fallback
     * @returns {string}
     */
    static string(value, fallback) {
        const text = String(value ?? '').trim()
        return text || fallback
    }

    /**
     * Returns a finite number value.
     * @param {unknown} value
     * @param {number | null} fallback
     * @returns {number | null}
     */
    static number(value, fallback) {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : fallback
    }

    /**
     * Converts a mil value to millimeters.
     * @param {unknown} value
     * @param {number} fallback
     * @returns {number}
     */
    static milNumber(value, fallback) {
        return CircuitJsonModelAdapterPrimitives.round(
            (CircuitJsonModelAdapterPrimitives.number(value, fallback) || 0) /
                MILS_PER_MM
        )
    }

    /**
     * Returns an unscaled point.
     * @param {unknown} x
     * @param {unknown} y
     * @returns {{ x: number, y: number }}
     */
    static point(x, y) {
        return {
            x: CircuitJsonModelAdapterPrimitives.round(
                CircuitJsonModelAdapterPrimitives.number(x, 0) || 0
            ),
            y: CircuitJsonModelAdapterPrimitives.round(
                CircuitJsonModelAdapterPrimitives.number(y, 0) || 0
            )
        }
    }

    /**
     * Returns a mil-scaled point.
     * @param {unknown} x
     * @param {unknown} y
     * @returns {{ x: number, y: number }}
     */
    static milPoint(x, y) {
        return {
            x: CircuitJsonModelAdapterPrimitives.milNumber(x, 0),
            y: CircuitJsonModelAdapterPrimitives.milNumber(y, 0)
        }
    }

    /**
     * Rounds model coordinates to a stable precision.
     * @param {number} value
     * @returns {number}
     */
    static round(value) {
        return Math.round(value * 1_000_000) / 1_000_000
    }

    /**
     * Returns array values only.
     * @param {unknown} value
     * @returns {unknown[]}
     */
    static array(value) {
        return Array.isArray(value) ? value : []
    }

    /**
     * Infers the source format label.
     * @param {Record<string, unknown>} model
     * @returns {string}
     */
    static sourceFormat(model) {
        if (model.sourceFormat) return String(model.sourceFormat)
        if (
            String(model.fileType || '')
                .toLowerCase()
                .includes('kicad')
        ) {
            return 'KiCad'
        }
        return 'Altium Designer'
    }

    /**
     * Returns a component map key.
     * @param {Record<string, unknown>} component
     * @param {number} componentIndex
     * @returns {string}
     */
    static componentKey(component, componentIndex) {
        return String(component.componentIndex ?? componentIndex)
    }

    /**
     * Returns a source port id.
     * @param {string} idScope
     * @param {Record<string, unknown>} primitive
     * @param {number} index
     * @param {string} sourceComponentId
     * @returns {string}
     */
    static sourcePortId(idScope, primitive, index, sourceComponentId) {
        return CircuitJsonModelAdapterPrimitives.id(idScope, [
            'source_port',
            sourceComponentId,
            primitive.name || primitive.pinName || primitive.pinNumber || index
        ])
    }

    /**
     * Returns a source net id.
     * @param {string} idScope
     * @param {unknown} netName
     * @returns {string}
     */
    static sourceNetId(idScope, netName) {
        return CircuitJsonModelAdapterPrimitives.id(idScope, [
            'source_net',
            netName
        ])
    }

    /**
     * Returns or creates a source net id for a PCB primitive.
     * @param {string} idScope
     * @param {Record<string, unknown>} primitive
     * @param {Map<string, string>} sourceNetIds
     * @returns {string | undefined}
     */
    static netIdForPrimitive(idScope, primitive, sourceNetIds) {
        const key = String(
            primitive.netName || primitive.net || primitive.netIndex || ''
        )
        if (!key) return undefined
        if (!sourceNetIds.has(key)) {
            sourceNetIds.set(
                key,
                CircuitJsonModelAdapterPrimitives.sourceNetId(idScope, key)
            )
        }
        return sourceNetIds.get(key)
    }

    /**
     * Returns true when a PCB pad has a drill hole.
     * @param {Record<string, unknown>} pad
     * @returns {boolean}
     */
    static isThroughHolePad(pad) {
        return (
            (CircuitJsonModelAdapterPrimitives.number(pad.holeDiameter, 0) ||
                0) > 0
        )
    }

    /**
     * Returns a Circuit JSON pad shape label.
     * @param {Record<string, unknown>} pad
     * @returns {string}
     */
    static padShape(pad) {
        const shape = String(
            pad.shapeTopName || pad.shapeName || pad.shape || ''
        ).toLowerCase()
        if (shape.includes('round') || shape.includes('circle')) return 'circle'
        if (shape.includes('oval')) return 'pill'
        return 'rect'
    }

    /**
     * Returns a normalized board side.
     * @param {unknown} layer
     * @returns {'top' | 'bottom'}
     */
    static side(layer) {
        return String(layer || '')
            .toLowerCase()
            .includes('bottom')
            ? 'bottom'
            : 'top'
    }

    /**
     * Returns a normalized copper layer name.
     * @param {Record<string, unknown>} primitive
     * @returns {string}
     */
    static layerName(primitive) {
        if (primitive.layerName) return String(primitive.layerName)
        if (primitive.layer) return String(primitive.layer).toLowerCase()
        if (primitive.layerId === 1) return 'top'
        if (primitive.layerId === 32) return 'bottom'
        return 'top'
    }

    /**
     * Returns schematic port facing direction.
     * @param {Record<string, unknown>} pin
     * @returns {string | null}
     */
    static facingDirection(pin) {
        const orientation = String(pin.orientation || '').toLowerCase()
        if (['left', 'right', 'up', 'down'].includes(orientation)) {
            return orientation
        }
        if (orientation === 'top') return 'up'
        if (orientation === 'bottom') return 'down'
        return null
    }

    /**
     * Returns true when a schematic text represents a net label.
     * @param {Record<string, unknown>} text
     * @returns {boolean}
     */
    static isNetLabel(text) {
        const role = String(text.role || text.kind || text.recordType || '')
            .toLowerCase()
            .trim()
        return (
            role.includes('net') ||
            role.includes('label') ||
            role.includes('power')
        )
    }

    /**
     * Converts a renderer outline to Circuit JSON points.
     * @param {Record<string, unknown> | undefined} boardOutline
     * @returns {{ x: number, y: number }[]}
     */
    static outlinePoints(boardOutline) {
        const segments = CircuitJsonModelAdapterPrimitives.array(
            boardOutline?.segments
        )
        if (segments.length > 0) {
            const points = segments.map((segment) =>
                CircuitJsonModelAdapterPrimitives.milPoint(
                    segment.x1,
                    segment.y1
                )
            )
            const last = segments[segments.length - 1]
            points.push(
                CircuitJsonModelAdapterPrimitives.milPoint(last.x2, last.y2)
            )
            return points
        }

        const minX =
            CircuitJsonModelAdapterPrimitives.number(boardOutline?.minX, 0) || 0
        const minY =
            CircuitJsonModelAdapterPrimitives.number(boardOutline?.minY, 0) || 0
        const width =
            CircuitJsonModelAdapterPrimitives.number(
                boardOutline?.widthMil,
                0
            ) || 0
        const height =
            CircuitJsonModelAdapterPrimitives.number(
                boardOutline?.heightMil,
                0
            ) || 0

        return [
            CircuitJsonModelAdapterPrimitives.milPoint(minX, minY),
            CircuitJsonModelAdapterPrimitives.milPoint(minX + width, minY),
            CircuitJsonModelAdapterPrimitives.milPoint(
                minX + width,
                minY + height
            ),
            CircuitJsonModelAdapterPrimitives.milPoint(minX, minY + height)
        ]
    }

    /**
     * Strips the extension from a file name.
     * @param {unknown} fileName
     * @returns {string}
     */
    static stripExtension(fileName) {
        return String(fileName || '').replace(/\.[^.]+$/u, '')
    }

    /**
     * Normalizes one id part.
     * @param {unknown} value
     * @returns {string}
     */
    static #idPart(value) {
        return String(value)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
    }
}
