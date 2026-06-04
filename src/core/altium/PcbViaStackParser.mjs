// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Decodes optional Altium via stack and mask-expansion fields.
 */
export class PcbViaStackParser {
    static #FLAGS_1_OFFSET = 6

    static #FLAGS_2_OFFSET = 7

    static #PLANE_CONNECTION_STYLE_OFFSET = 36

    static #THERMAL_RELIEF_AIR_GAP_OFFSET = 37

    static #THERMAL_RELIEF_CONDUCTOR_COUNT_OFFSET = 41

    static #THERMAL_RELIEF_CONDUCTOR_WIDTH_OFFSET = 43

    static #POWER_PLANE_RELIEF_EXPANSION_OFFSET = 47

    static #POWER_PLANE_CLEARANCE_OFFSET = 51

    static #PASTE_MASK_EXPANSION_OFFSET = 55

    static #SOLDER_MASK_EXPANSION_OFFSET = 59

    static #PASTE_MASK_MODE_OFFSET = 64

    static #SOLDER_MASK_MODE_OFFSET = 71

    static #DIAMETER_STACK_MODE_OFFSET = 79

    static #DIAMETER_BY_LAYER_OFFSET = 80

    static #REMOVED_PAD_FLAGS_OFFSET = 214

    static #SOLDER_MASK_LINKED_OFFSET = 246

    static #SOLDER_MASK_EXPANSION_BACK_OFFSET = 247

    static #EXTERNAL_STACK_TABLE_OFFSET = 251

    static #EXTERNAL_STACK_ENTRY_HEADER_BYTE_LENGTH = 9

    static #SOLDER_MASK_FROM_HOLE_EDGE_OFFSET = 263

    static #UNIQUE_ID_OFFSET = 264

    static #TAIL_SIGNATURE_OFFSET = 280

    static #POSITIVE_TOLERANCE_OFFSET = 296

    static #NEGATIVE_TOLERANCE_OFFSET = 300

    static #DRILL_LAYER_PAIR_TYPE_OFFSET = 317

    static #PROPAGATION_DELAY_OFFSET = 321

    static #HOLE_TOLERANCE_UNSET = 0x7fffffff

    static #PICOSECONDS_PER_SECOND = 1_000_000_000_000

    static #PHYSICAL_LAYER_COUNT = 32

    /**
     * Decodes optional via stack metadata from one via record view.
     * @param {DataView} view
     * @returns {Record<string, unknown>}
     */
    static parse(view) {
        const result = {}
        const externalStack = PcbViaStackParser.#parseExternalStack(view)
        const externalStackShift = PcbViaStackParser.#externalStackShift(
            view,
            externalStack.externalStackEntryCount,
            externalStack.externalStackEntryStride
        )
        const pasteMaskExpansion = PcbViaStackParser.#readMilIfAvailable(
            view,
            PcbViaStackParser.#PASTE_MASK_EXPANSION_OFFSET
        )
        const solderMaskExpansion = PcbViaStackParser.#readMilIfAvailable(
            view,
            PcbViaStackParser.#SOLDER_MASK_EXPANSION_OFFSET
        )
        const pasteMaskExpansionMode = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#PASTE_MASK_MODE_OFFSET
        )
        const solderMaskExpansionMode = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#SOLDER_MASK_MODE_OFFSET
        )
        const diameterStackMode = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#DIAMETER_STACK_MODE_OFFSET
        )
        const diameterByLayer = PcbViaStackParser.#parseDiameterByLayer(view)

        if (pasteMaskExpansion) {
            result.pasteMaskExpansion = pasteMaskExpansion
        }
        if (solderMaskExpansion) {
            result.solderMaskExpansion = solderMaskExpansion
        }
        if (pasteMaskExpansionMode) {
            result.pasteMaskExpansionMode = pasteMaskExpansionMode
        }
        if (solderMaskExpansionMode) {
            result.solderMaskExpansionMode = solderMaskExpansionMode
        }
        if (diameterStackMode || diameterByLayer.length) {
            result.diameterStackMode = diameterStackMode || 0
            result.diameterByLayer = diameterByLayer
        }

        return {
            ...PcbViaStackParser.#parseFlags(view),
            ...PcbViaStackParser.#parsePlaneReliefFields(view),
            ...result,
            ...PcbViaStackParser.#parseRemovedPads(view),
            ...PcbViaStackParser.#parseBackSolderMask(view),
            ...externalStack,
            ...PcbViaStackParser.#parseTail(view, externalStackShift)
        }
    }

    /**
     * Decodes via state flags shared by Altium readers.
     * @param {DataView} view
     * @returns {Record<string, boolean>}
     */
    static #parseFlags(view) {
        const flags1 = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#FLAGS_1_OFFSET
        )
        const flags2 = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#FLAGS_2_OFFSET
        )

        if (!flags1 && !flags2) {
            return {}
        }

        return {
            isSelected: (flags1 & 0x01) !== 0,
            isPolygonOutline: (flags1 & 0x02) !== 0,
            isLocked: (flags1 & 0x04) === 0,
            isTentingTop: (flags1 & 0x20) !== 0,
            isTentingBottom: (flags1 & 0x40) !== 0,
            isTestFabTop: (flags1 & 0x80) !== 0,
            isTestFabBottom: (flags2 & 0x01) !== 0,
            isKeepout: (flags2 & 0x02) !== 0
        }
    }

    /**
     * Decodes optional plane-connection and thermal-relief fields.
     * @param {DataView} view
     * @returns {Record<string, number>}
     */
    static #parsePlaneReliefFields(view) {
        const result = {}
        const planeConnectionStyle = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#PLANE_CONNECTION_STYLE_OFFSET
        )
        const thermalReliefAirGap = PcbViaStackParser.#readMilIfAvailable(
            view,
            PcbViaStackParser.#THERMAL_RELIEF_AIR_GAP_OFFSET
        )
        const thermalReliefConductorCount =
            PcbViaStackParser.#readUint16IfAvailable(
                view,
                PcbViaStackParser.#THERMAL_RELIEF_CONDUCTOR_COUNT_OFFSET
            )
        const thermalReliefConductorWidth =
            PcbViaStackParser.#readMilIfAvailable(
                view,
                PcbViaStackParser.#THERMAL_RELIEF_CONDUCTOR_WIDTH_OFFSET
            )
        const powerPlaneReliefExpansion = PcbViaStackParser.#readMilIfAvailable(
            view,
            PcbViaStackParser.#POWER_PLANE_RELIEF_EXPANSION_OFFSET
        )
        const powerPlaneClearance = PcbViaStackParser.#readMilIfAvailable(
            view,
            PcbViaStackParser.#POWER_PLANE_CLEARANCE_OFFSET
        )

        if (planeConnectionStyle) {
            result.planeConnectionStyle = planeConnectionStyle
        }
        if (thermalReliefAirGap) {
            result.thermalReliefAirGap = thermalReliefAirGap
        }
        if (thermalReliefConductorCount) {
            result.thermalReliefConductorCount = thermalReliefConductorCount
        }
        if (thermalReliefConductorWidth) {
            result.thermalReliefConductorWidth = thermalReliefConductorWidth
        }
        if (powerPlaneReliefExpansion) {
            result.powerPlaneReliefExpansion = powerPlaneReliefExpansion
        }
        if (powerPlaneClearance) {
            result.powerPlaneClearance = powerPlaneClearance
        }

        return result
    }

    /**
     * Decodes the per-layer removed-pad bitmap.
     * @param {DataView} view
     * @returns {Record<string, { layerNumber: number }[]>}
     */
    static #parseRemovedPads(view) {
        if (
            !view ||
            PcbViaStackParser.#REMOVED_PAD_FLAGS_OFFSET +
                PcbViaStackParser.#PHYSICAL_LAYER_COUNT >
                view.byteLength
        ) {
            return {}
        }

        const removedPadsByLayer = []

        for (
            let index = 0;
            index < PcbViaStackParser.#PHYSICAL_LAYER_COUNT;
            index += 1
        ) {
            const removed = view.getUint8(
                PcbViaStackParser.#REMOVED_PAD_FLAGS_OFFSET + index
            )

            if (removed) {
                removedPadsByLayer.push({ layerNumber: index + 1 })
            }
        }

        return removedPadsByLayer.length ? { removedPadsByLayer } : {}
    }

    /**
     * Decodes linked/back solder-mask expansion fields.
     * @param {DataView} view
     * @returns {Record<string, boolean | number>}
     */
    static #parseBackSolderMask(view) {
        const result = {}
        const linked = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#SOLDER_MASK_LINKED_OFFSET
        )
        const backExpansion = PcbViaStackParser.#readMilIfAvailable(
            view,
            PcbViaStackParser.#SOLDER_MASK_EXPANSION_BACK_OFFSET
        )

        if (linked) {
            result.solderMaskExpansionLinked = true
        }
        if (backExpansion) {
            result.solderMaskExpansionBack = backExpansion
        }

        return result
    }

    /**
     * Decodes optional external stack-table entries and the following marker.
     * @param {DataView} view
     * @returns {Record<string, unknown>}
     */
    static #parseExternalStack(view) {
        if (
            !view ||
            PcbViaStackParser.#EXTERNAL_STACK_TABLE_OFFSET + 8 > view.byteLength
        ) {
            return {}
        }

        const count = view.getUint32(
            PcbViaStackParser.#EXTERNAL_STACK_TABLE_OFFSET,
            true
        )
        const stride = view.getUint32(
            PcbViaStackParser.#EXTERNAL_STACK_TABLE_OFFSET + 4,
            true
        )
        const result = {
            externalStackEntryCount: count,
            externalStackEntryStride: stride,
            externalStackEntries: []
        }
        const entries = PcbViaStackParser.#parseExternalStackEntries(
            view,
            count,
            stride
        )
        const markerOffset =
            PcbViaStackParser.#EXTERNAL_STACK_TABLE_OFFSET +
            8 +
            entries.byteLength
        const marker = PcbViaStackParser.#readByteIfAvailable(
            view,
            markerOffset
        )

        result.externalStackEntries = entries.values
        if (marker) {
            result.externalStackMarker = marker
        }

        return PcbViaStackParser.#hasExternalStackData(result) ? result : {}
    }

    /**
     * Decodes one sane external via stack table.
     * @param {DataView} view
     * @param {number} count
     * @param {number} stride
     * @returns {{ values: object[], byteLength: number }}
     */
    static #parseExternalStackEntries(view, count, stride) {
        if (
            count <= 0 ||
            count > 64 ||
            stride <
                PcbViaStackParser.#EXTERNAL_STACK_ENTRY_HEADER_BYTE_LENGTH ||
            stride > 64
        ) {
            return { values: [], byteLength: 0 }
        }

        const dataOffset = PcbViaStackParser.#EXTERNAL_STACK_TABLE_OFFSET + 8
        const byteLength = count * stride

        if (dataOffset + byteLength > view.byteLength) {
            return { values: [], byteLength: 0 }
        }

        const values = []

        for (let index = 0; index < count; index += 1) {
            const offset = dataOffset + index * stride
            values.push({
                layerId: view.getUint32(offset, true),
                sizeOnLayer: view.getInt32(offset + 4, true) / 10000,
                entryState: view.getUint8(offset + 8)
            })
        }

        return { values, byteLength }
    }

    /**
     * Checks whether the external stack block carries non-default data.
     * @param {Record<string, unknown>} result
     * @returns {boolean}
     */
    static #hasExternalStackData(result) {
        return (
            result.externalStackEntryCount !== 0 ||
            result.externalStackEntryStride !== 0 ||
            result.externalStackEntries.length !== 0 ||
            result.externalStackMarker !== undefined
        )
    }

    /**
     * Computes the tail offset shift introduced by external stack entries.
     * @param {DataView} view
     * @param {number | undefined} count
     * @param {number | undefined} stride
     * @returns {number}
     */
    static #externalStackShift(view, count, stride) {
        if (!view || !count || !stride || count > 64 || stride > 64) {
            return 0
        }

        const shift = count * stride

        if (
            PcbViaStackParser.#POSITIVE_TOLERANCE_OFFSET + shift + 4 >
                view.byteLength ||
            PcbViaStackParser.#DRILL_LAYER_PAIR_TYPE_OFFSET + shift >=
                view.byteLength
        ) {
            return 0
        }

        return shift
    }

    /**
     * Decodes tail metadata after any optional external stack table.
     * @param {DataView} view
     * @param {number} offsetShift
     * @returns {Record<string, boolean | number | string>}
     */
    static #parseTail(view, offsetShift) {
        const result = {}
        const fromHoleEdge = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#SOLDER_MASK_FROM_HOLE_EDGE_OFFSET + offsetShift
        )
        const uniqueId = PcbViaStackParser.#readHexBytesIfAvailable(
            view,
            PcbViaStackParser.#UNIQUE_ID_OFFSET + offsetShift,
            16
        )
        const tailSignature = PcbViaStackParser.#readHexBytesIfAvailable(
            view,
            PcbViaStackParser.#TAIL_SIGNATURE_OFFSET + offsetShift,
            16
        )
        const positiveTolerance =
            PcbViaStackParser.#readHoleToleranceIfAvailable(
                view,
                PcbViaStackParser.#POSITIVE_TOLERANCE_OFFSET + offsetShift
            )
        const negativeTolerance =
            PcbViaStackParser.#readHoleToleranceIfAvailable(
                view,
                PcbViaStackParser.#NEGATIVE_TOLERANCE_OFFSET + offsetShift
            )
        const propagationDelayPs =
            PcbViaStackParser.#readPropagationDelayIfAvailable(
                view,
                PcbViaStackParser.#PROPAGATION_DELAY_OFFSET + offsetShift
            )
        const drillLayerPairType = PcbViaStackParser.#readByteIfAvailable(
            view,
            PcbViaStackParser.#DRILL_LAYER_PAIR_TYPE_OFFSET + offsetShift
        )

        if (fromHoleEdge) {
            result.solderMaskExpansionFromHoleEdge = true
        }
        if (uniqueId) {
            result.uniqueId = uniqueId
        }
        if (tailSignature) {
            result.tailSignature = tailSignature
        }
        if (positiveTolerance !== null) {
            result.positiveTolerance = positiveTolerance
        }
        if (negativeTolerance !== null) {
            result.negativeTolerance = negativeTolerance
        }
        PcbViaStackParser.#assignHoleTolerance(
            result,
            positiveTolerance,
            negativeTolerance
        )
        if (propagationDelayPs !== null) {
            result.propagationDelayPs = propagationDelayPs
        }
        if (drillLayerPairType) {
            result.drillLayerPairType = drillLayerPairType
        }

        return result
    }

    /**
     * Decodes non-empty via diameters by layer.
     * @param {DataView} view
     * @returns {{ layerNumber: number, diameter: number }[]}
     */
    static #parseDiameterByLayer(view) {
        const entries = []

        for (
            let index = 0;
            index < PcbViaStackParser.#PHYSICAL_LAYER_COUNT;
            index += 1
        ) {
            const offset =
                PcbViaStackParser.#DIAMETER_BY_LAYER_OFFSET + index * 4
            const diameter = PcbViaStackParser.#readMilIfAvailable(view, offset)

            if (diameter) {
                entries.push({
                    layerNumber: index + 1,
                    diameter
                })
            }
        }

        return entries
    }

    /**
     * Reads one signed fixed-point mil value when fully available.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static #readMilIfAvailable(view, offset) {
        if (!view || offset + 4 > view.byteLength) {
            return null
        }

        return view.getInt32(offset, true) / 10000
    }

    /**
     * Reads one optional hole tolerance and suppresses unset sentinel values.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static #readHoleToleranceIfAvailable(view, offset) {
        if (!view || offset + 4 > view.byteLength) {
            return null
        }

        const rawValue = view.getInt32(offset, true)
        if (
            rawValue === 0 ||
            rawValue === PcbViaStackParser.#HOLE_TOLERANCE_UNSET
        ) {
            return null
        }

        return rawValue / 10000
    }

    /**
     * Adds grouped semantic hole tolerance fields when tolerances are present.
     * @param {Record<string, unknown>} result
     * @param {number | null} positiveTolerance
     * @param {number | null} negativeTolerance
     */
    static #assignHoleTolerance(result, positiveTolerance, negativeTolerance) {
        const holeTolerance = {}

        if (positiveTolerance !== null) {
            holeTolerance.positive = positiveTolerance
        }
        if (negativeTolerance !== null) {
            holeTolerance.negative = negativeTolerance
        }
        if (Object.keys(holeTolerance).length) {
            result.holeTolerance = holeTolerance
        }
    }

    /**
     * Reads one optional via propagation delay stored as seconds.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static #readPropagationDelayIfAvailable(view, offset) {
        if (!view || offset + 4 > view.byteLength) {
            return null
        }

        const seconds = view.getFloat32(offset, true)
        const picoseconds = seconds * PcbViaStackParser.#PICOSECONDS_PER_SECOND

        if (
            !Number.isFinite(picoseconds) ||
            Math.abs(picoseconds) < 0.001 ||
            Math.abs(picoseconds) > 1_000_000
        ) {
            return null
        }

        return Number(picoseconds.toFixed(4))
    }

    /**
     * Reads one byte when available.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static #readByteIfAvailable(view, offset) {
        if (!view || offset >= view.byteLength) {
            return null
        }

        return view.getUint8(offset)
    }

    /**
     * Reads one unsigned 16-bit value when available.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number | null}
     */
    static #readUint16IfAvailable(view, offset) {
        if (!view || offset + 2 > view.byteLength) {
            return null
        }

        return view.getUint16(offset, true)
    }

    /**
     * Reads non-zero bytes as a lowercase hexadecimal string.
     * @param {DataView} view
     * @param {number} offset
     * @param {number} byteLength
     * @returns {string | null}
     */
    static #readHexBytesIfAvailable(view, offset, byteLength) {
        if (!view || offset + byteLength > view.byteLength) {
            return null
        }

        const bytes = []
        let hasData = false

        for (let index = 0; index < byteLength; index += 1) {
            const value = view.getUint8(offset + index)
            bytes.push(value.toString(16).padStart(2, '0'))
            hasData ||= value !== 0
        }

        return hasData ? bytes.join('') : null
    }
}
