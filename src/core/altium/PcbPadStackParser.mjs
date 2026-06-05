// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbPadShapeCodec } from './PcbPadShapeCodec.mjs'

/**
 * Decodes the extended Altium pad stack fields from PAD subrecords.
 */
export class PcbPadStackParser {
    static #FLAGS_OFFSET = 1

    static #UNION_INDEX_OFFSET = 9

    static #PAD_MODE_OFFSET = 62

    static #PLANE_CONNECTION_STYLE_OFFSET = 67

    static #THERMAL_RELIEF_CONDUCTOR_WIDTH_OFFSET = 68

    static #THERMAL_RELIEF_CONDUCTOR_COUNT_OFFSET = 72

    static #THERMAL_RELIEF_AIR_GAP_OFFSET = 74

    static #POWER_PLANE_RELIEF_EXPANSION_OFFSET = 78

    static #POWER_PLANE_CLEARANCE_OFFSET = 82

    static #PASTE_MASK_EXPANSION_OFFSET = 86

    static #SOLDER_MASK_EXPANSION_OFFSET = 90

    static #PLANE_CONNECTION_CACHE_VALID_OFFSET = 96

    static #THERMAL_RELIEF_CONDUCTOR_WIDTH_CACHE_VALID_OFFSET = 97

    static #THERMAL_RELIEF_CONDUCTOR_COUNT_CACHE_VALID_OFFSET = 98

    static #THERMAL_RELIEF_AIR_GAP_CACHE_VALID_OFFSET = 99

    static #POWER_PLANE_RELIEF_EXPANSION_CACHE_VALID_OFFSET = 100

    static #PASTE_MASK_MODE_OFFSET = 101

    static #SOLDER_MASK_MODE_OFFSET = 102

    static #PASTE_MASK_CACHE_VALID_OFFSET = 103

    static #SOLDER_MASK_CACHE_VALID_OFFSET = 104

    static #POSITIVE_TOLERANCE_OFFSET = 162

    static #NEGATIVE_TOLERANCE_OFFSET = 166

    static #HOLE_TOLERANCE_UNSET = 0x7fffffff

    static #EXTENSION_MIN_BYTE_LENGTH = 596

    static #INNER_LAYER_COUNT = 29

    static #PHYSICAL_LAYER_COUNT = 32

    static #TOP_LAYER_ID = 1

    static #BOTTOM_LAYER_ID = 32

    static #MULTI_LAYER_ID = 74

    static #DEFAULT_SOLDER_MASK_EXPANSION = 4

    static #MIN_PASTE_OPENING = 0.04

    /**
     * Decodes optional main-record and extension-record pad stack metadata.
     * @param {DataView} mainRecord
     * @param {DataView | undefined} extensionRecord
     * @param {{ layerId?: number | null, sizeTopX?: number, sizeTopY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number }} [padContext]
     * @returns {Record<string, unknown>}
     */
    static parse(mainRecord, extensionRecord, padContext = {}) {
        const flags = PcbPadStackParser.#parseFlags(mainRecord)
        const mainRecordTail =
            PcbPadStackParser.#parseMainRecordTail(mainRecord)
        const extension = PcbPadStackParser.#parseExtensionRecord(
            extensionRecord,
            padContext
        )

        return {
            ...flags,
            ...mainRecordTail,
            ...PcbPadStackParser.#parseMaskExpansionSemantics(
                flags,
                mainRecordTail,
                padContext
            ),
            ...extension,
            ...PcbPadStackParser.#buildLocalStack(
                mainRecordTail,
                extension,
                padContext
            )
        }
    }

    /**
     * Decodes optional pad flags from the main record.
     * @param {DataView} mainRecord
     * @returns {Record<string, boolean | number>}
     */
    static #parseFlags(mainRecord) {
        if (
            !mainRecord ||
            PcbPadStackParser.#FLAGS_OFFSET + 2 > mainRecord.byteLength
        ) {
            return {}
        }

        const flags = mainRecord.getUint16(
            PcbPadStackParser.#FLAGS_OFFSET,
            true
        )

        if (!flags) {
            return {}
        }

        const result = {
            padFlags: flags
        }

        if (flags & 0x0008) {
            result.isUserRouted = true
        }
        if (flags & 0x0010) {
            result.isTestFabTop = true
            result.isFabTestPointTop = true
        }
        if (flags & 0x0020) {
            result.isTentingTop = true
        }
        if (flags & 0x0040) {
            result.isTentingBottom = true
        }
        if (flags & 0x0080) {
            result.isAssemblyTestPointTop = true
        }
        if (flags & 0x0100) {
            result.isTestFabBottom = true
            result.isFabTestPointBottom = true
        }
        if (flags & 0x0200) {
            result.isAssemblyTestPointBottom = true
        }

        return result
    }

    /**
     * Decodes optional pad mode, plane-cache, and mask-expansion fields from the
     * main record.
     * @param {DataView} mainRecord
     * @returns {Record<string, boolean | number>}
     */
    static #parseMainRecordTail(mainRecord) {
        if (!mainRecord || mainRecord.byteLength < 105) {
            return {}
        }

        const result = {
            padMode: mainRecord.getUint8(PcbPadStackParser.#PAD_MODE_OFFSET),
            padModeName: PcbPadShapeCodec.padModeName(
                mainRecord.getUint8(PcbPadStackParser.#PAD_MODE_OFFSET)
            ),
            pasteMaskExpansion: PcbPadStackParser.#readMil(
                mainRecord,
                PcbPadStackParser.#PASTE_MASK_EXPANSION_OFFSET
            ),
            solderMaskExpansion: PcbPadStackParser.#readMil(
                mainRecord,
                PcbPadStackParser.#SOLDER_MASK_EXPANSION_OFFSET
            ),
            pasteMaskExpansionMode: mainRecord.getUint8(
                PcbPadStackParser.#PASTE_MASK_MODE_OFFSET
            ),
            solderMaskExpansionMode: mainRecord.getUint8(
                PcbPadStackParser.#SOLDER_MASK_MODE_OFFSET
            )
        }

        PcbPadStackParser.#assignPadCacheFields(result, mainRecord)
        PcbPadStackParser.#assignMaskCacheFields(result, mainRecord)
        PcbPadStackParser.#assignHoleToleranceFields(result, mainRecord)

        return result
    }

    /**
     * Adds non-zero pad-cache and thermal-relief fields to an output object.
     * @param {Record<string, unknown>} result
     * @param {DataView} mainRecord
     */
    static #assignPadCacheFields(result, mainRecord) {
        const padCache = {
            planeConnectionStyle: mainRecord.getUint8(
                PcbPadStackParser.#PLANE_CONNECTION_STYLE_OFFSET
            ),
            thermalReliefConductorWidth: PcbPadStackParser.#readMil(
                mainRecord,
                PcbPadStackParser.#THERMAL_RELIEF_CONDUCTOR_WIDTH_OFFSET
            ),
            thermalReliefConductorCount: mainRecord.getUint16(
                PcbPadStackParser.#THERMAL_RELIEF_CONDUCTOR_COUNT_OFFSET,
                true
            ),
            thermalReliefAirGap: PcbPadStackParser.#readMil(
                mainRecord,
                PcbPadStackParser.#THERMAL_RELIEF_AIR_GAP_OFFSET
            ),
            powerPlaneReliefExpansion: PcbPadStackParser.#readMil(
                mainRecord,
                PcbPadStackParser.#POWER_PLANE_RELIEF_EXPANSION_OFFSET
            ),
            powerPlaneClearance: PcbPadStackParser.#readMil(
                mainRecord,
                PcbPadStackParser.#POWER_PLANE_CLEARANCE_OFFSET
            ),
            validity: {
                planeConnection: mainRecord.getUint8(
                    PcbPadStackParser.#PLANE_CONNECTION_CACHE_VALID_OFFSET
                ),
                thermalReliefConductorWidth: mainRecord.getUint8(
                    PcbPadStackParser
                        .#THERMAL_RELIEF_CONDUCTOR_WIDTH_CACHE_VALID_OFFSET
                ),
                thermalReliefConductorCount: mainRecord.getUint8(
                    PcbPadStackParser
                        .#THERMAL_RELIEF_CONDUCTOR_COUNT_CACHE_VALID_OFFSET
                ),
                thermalReliefAirGap: mainRecord.getUint8(
                    PcbPadStackParser.#THERMAL_RELIEF_AIR_GAP_CACHE_VALID_OFFSET
                ),
                powerPlaneReliefExpansion: mainRecord.getUint8(
                    PcbPadStackParser
                        .#POWER_PLANE_RELIEF_EXPANSION_CACHE_VALID_OFFSET
                )
            }
        }
        const fieldValues = {
            unionIndex: mainRecord.getUint32(
                PcbPadStackParser.#UNION_INDEX_OFFSET,
                true
            ),
            planeConnectionStyle: padCache.planeConnectionStyle,
            thermalReliefConductorWidth: padCache.thermalReliefConductorWidth,
            thermalReliefConductorCount: padCache.thermalReliefConductorCount,
            thermalReliefAirGap: padCache.thermalReliefAirGap,
            powerPlaneReliefExpansion: padCache.powerPlaneReliefExpansion,
            powerPlaneClearance: padCache.powerPlaneClearance,
            planeConnectionCacheValid: padCache.validity.planeConnection,
            thermalReliefConductorWidthCacheValid:
                padCache.validity.thermalReliefConductorWidth,
            thermalReliefConductorCountCacheValid:
                padCache.validity.thermalReliefConductorCount,
            thermalReliefAirGapCacheValid:
                padCache.validity.thermalReliefAirGap,
            thermalReliefCacheValid: padCache.validity.thermalReliefAirGap,
            powerPlaneReliefExpansionCacheValid:
                padCache.validity.powerPlaneReliefExpansion,
            powerPlaneReliefCacheValid:
                padCache.validity.powerPlaneReliefExpansion
        }

        for (const [key, value] of Object.entries(fieldValues)) {
            if (value) {
                result[key] = value
            }
        }

        if (PcbPadStackParser.#hasNonZeroPadCacheValue(padCache)) {
            result.padCache = padCache
        }
    }

    /**
     * Adds mask-expansion cache-validity fields to an output object.
     * @param {Record<string, unknown>} result
     * @param {DataView} mainRecord
     */
    static #assignMaskCacheFields(result, mainRecord) {
        const pasteCacheValid = mainRecord.getUint8(
            PcbPadStackParser.#PASTE_MASK_CACHE_VALID_OFFSET
        )
        const solderCacheValid = mainRecord.getUint8(
            PcbPadStackParser.#SOLDER_MASK_CACHE_VALID_OFFSET
        )

        if (pasteCacheValid) {
            result.pasteMaskExpansionCacheValid = pasteCacheValid
            result.pasteMaskExpansionRuleCacheValid = true
        }
        if (solderCacheValid) {
            result.solderMaskExpansionCacheValid = solderCacheValid
            result.solderMaskExpansionRuleCacheValid = true
        }
    }

    /**
     * Adds optional hole tolerance fields to an output object.
     * @param {Record<string, unknown>} result
     * @param {DataView} mainRecord
     */
    static #assignHoleToleranceFields(result, mainRecord) {
        const positiveTolerance = PcbPadStackParser.#readHoleTolerance(
            mainRecord,
            PcbPadStackParser.#POSITIVE_TOLERANCE_OFFSET
        )
        const negativeTolerance = PcbPadStackParser.#readHoleTolerance(
            mainRecord,
            PcbPadStackParser.#NEGATIVE_TOLERANCE_OFFSET
        )
        const holeTolerance = {}

        if (positiveTolerance !== null) {
            result.positiveTolerance = positiveTolerance
            holeTolerance.positive = positiveTolerance
        }
        if (negativeTolerance !== null) {
            result.negativeTolerance = negativeTolerance
            holeTolerance.negative = negativeTolerance
        }
        if (Object.keys(holeTolerance).length) {
            result.holeTolerance = holeTolerance
        }
    }

    /**
     * Returns whether one decoded pad cache contains meaningful data.
     * @param {{ planeConnectionStyle: number, thermalReliefConductorWidth: number, thermalReliefConductorCount: number, thermalReliefAirGap: number, powerPlaneReliefExpansion: number, powerPlaneClearance: number, validity: Record<string, number> }} padCache
     * @returns {boolean}
     */
    static #hasNonZeroPadCacheValue(padCache) {
        const values = [
            padCache.planeConnectionStyle,
            padCache.thermalReliefConductorWidth,
            padCache.thermalReliefConductorCount,
            padCache.thermalReliefAirGap,
            padCache.powerPlaneReliefExpansion,
            padCache.powerPlaneClearance,
            ...Object.values(padCache.validity)
        ]

        return values.some((value) => value !== 0)
    }

    /**
     * Reads one optional hole tolerance from a pad main record.
     * @param {DataView} mainRecord
     * @param {number} offset
     * @returns {number | null}
     */
    static #readHoleTolerance(mainRecord, offset) {
        if (!mainRecord || offset + 4 > mainRecord.byteLength) {
            return null
        }

        const rawValue = mainRecord.getInt32(offset, true)
        if (
            rawValue === 0 ||
            rawValue === PcbPadStackParser.#HOLE_TOLERANCE_UNSET
        ) {
            return null
        }

        return rawValue / 10000
    }

    /**
     * Adds derived mask-expansion and layer-opening semantics.
     * @param {Record<string, boolean | number>} flags
     * @param {Record<string, boolean | number>} mainRecordTail
     * @param {{ layerId?: number | null, sizeTopX?: number, sizeTopY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number }} padContext
     * @returns {Record<string, unknown>}
     */
    static #parseMaskExpansionSemantics(flags, mainRecordTail, padContext) {
        if (!('pasteMaskExpansionMode' in mainRecordTail)) {
            return {}
        }

        const pasteMode = Number(mainRecordTail.pasteMaskExpansionMode)
        const solderMode = Number(mainRecordTail.solderMaskExpansionMode)
        const pasteExpansion = Number(mainRecordTail.pasteMaskExpansion)
        const solderExpansion = Number(mainRecordTail.solderMaskExpansion)
        const effectivePasteExpansion =
            PcbPadStackParser.#effectivePasteMaskExpansion(
                pasteMode,
                pasteExpansion
            )
        const effectiveSolderExpansion =
            PcbPadStackParser.#effectiveSolderMaskExpansion(
                solderMode,
                solderExpansion
            )
        const pasteCacheValid =
            Number(mainRecordTail.pasteMaskExpansionCacheValid) || 0
        const solderCacheValid =
            Number(mainRecordTail.solderMaskExpansionCacheValid) || 0
        const layerOpenings = PcbPadStackParser.#deriveLayerOpenings(
            flags,
            padContext,
            effectivePasteExpansion,
            effectiveSolderExpansion
        )

        return {
            pasteMaskExpansionSource:
                PcbPadStackParser.#maskExpansionSource(pasteMode),
            solderMaskExpansionSource:
                PcbPadStackParser.#maskExpansionSource(solderMode),
            effectivePasteMaskExpansion: effectivePasteExpansion,
            effectiveSolderMaskExpansion: effectiveSolderExpansion,
            maskExpansion: {
                paste: {
                    mode: pasteMode,
                    source: PcbPadStackParser.#maskExpansionSource(pasteMode),
                    expansion: pasteExpansion,
                    effectiveExpansion: effectivePasteExpansion,
                    cacheValid: pasteCacheValid
                },
                solder: {
                    mode: solderMode,
                    source: PcbPadStackParser.#maskExpansionSource(solderMode),
                    expansion: solderExpansion,
                    effectiveExpansion: effectiveSolderExpansion,
                    cacheValid: solderCacheValid
                },
                defaultSolderExpansion:
                    PcbPadStackParser.#DEFAULT_SOLDER_MASK_EXPANSION,
                minPasteOpening: PcbPadStackParser.#MIN_PASTE_OPENING
            },
            ...layerOpenings
        }
    }

    /**
     * Maps one raw mask-expansion mode byte to a stable source label.
     * @param {number} mode
     * @returns {string}
     */
    static #maskExpansionSource(mode) {
        if (mode === 1) {
            return 'rule'
        }
        if (mode === 2) {
            return 'manual'
        }
        if (mode === 0) {
            return 'default'
        }

        return `unknown-${mode}`
    }

    /**
     * Resolves the effective paste-mask expansion for rendering decisions.
     * @param {number} mode
     * @param {number} expansion
     * @returns {number}
     */
    static #effectivePasteMaskExpansion(mode, expansion) {
        return mode === 1 || mode === 2 ? expansion : 0
    }

    /**
     * Resolves the effective solder-mask expansion for rendering decisions.
     * @param {number} mode
     * @param {number} expansion
     * @returns {number}
     */
    static #effectiveSolderMaskExpansion(mode, expansion) {
        return mode === 1 || mode === 2
            ? expansion
            : PcbPadStackParser.#DEFAULT_SOLDER_MASK_EXPANSION
    }

    /**
     * Derives side-specific paste/solder opening booleans.
     * @param {Record<string, boolean | number>} flags
     * @param {{ layerId?: number | null, sizeTopX?: number, sizeTopY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number }} padContext
     * @param {number} effectivePasteExpansion
     * @param {number} effectiveSolderExpansion
     * @returns {{ hasTopPasteMaskOpening: boolean, hasBottomPasteMaskOpening: boolean, hasTopSolderMaskOpening: boolean, hasBottomSolderMaskOpening: boolean, isSolderMaskOnly: boolean }}
     */
    static #deriveLayerOpenings(
        flags,
        padContext,
        effectivePasteExpansion,
        effectiveSolderExpansion
    ) {
        const sourceSides = PcbPadStackParser.#sourceSides(
            Number(padContext.layerId) || null
        )
        const hasHole = Number(padContext.holeDiameter) > 0
        const topPasteOpening =
            !hasHole &&
            sourceSides.top &&
            PcbPadStackParser.#hasPasteOpening(
                Number(padContext.sizeTopX) || 0,
                Number(padContext.sizeTopY) || 0,
                effectivePasteExpansion
            )
        const bottomPasteOpening =
            !hasHole &&
            sourceSides.bottom &&
            PcbPadStackParser.#hasPasteOpening(
                Number(padContext.sizeBottomX) || 0,
                Number(padContext.sizeBottomY) || 0,
                effectivePasteExpansion
            )
        const isSolderMaskOnly = PcbPadStackParser.#isSolderMaskOnly(
            flags,
            padContext,
            topPasteOpening,
            bottomPasteOpening
        )

        return {
            hasTopPasteMaskOpening: topPasteOpening && !isSolderMaskOnly,
            hasBottomPasteMaskOpening: bottomPasteOpening && !isSolderMaskOnly,
            hasTopSolderMaskOpening:
                sourceSides.top &&
                !flags.isTentingTop &&
                PcbPadStackParser.#hasPositiveOpening(
                    Number(padContext.sizeTopX) || 0,
                    Number(padContext.sizeTopY) || 0,
                    effectiveSolderExpansion
                ),
            hasBottomSolderMaskOpening:
                sourceSides.bottom &&
                !flags.isTentingBottom &&
                PcbPadStackParser.#hasPositiveOpening(
                    Number(padContext.sizeBottomX) || 0,
                    Number(padContext.sizeBottomY) || 0,
                    effectiveSolderExpansion
                ),
            isSolderMaskOnly
        }
    }

    /**
     * Resolves which copper side owns one pad.
     * @param {number | null} layerId
     * @returns {{ top: boolean, bottom: boolean }}
     */
    static #sourceSides(layerId) {
        return {
            top:
                layerId === PcbPadStackParser.#TOP_LAYER_ID ||
                layerId === PcbPadStackParser.#MULTI_LAYER_ID,
            bottom:
                layerId === PcbPadStackParser.#BOTTOM_LAYER_ID ||
                layerId === PcbPadStackParser.#MULTI_LAYER_ID
        }
    }

    /**
     * Returns whether a paste aperture remains open after expansion.
     * @param {number} width
     * @param {number} height
     * @param {number} expansion
     * @returns {boolean}
     */
    static #hasPasteOpening(width, height, expansion) {
        if (width <= 0 || height <= 0) {
            return false
        }

        return (
            width + 2 * expansion >= PcbPadStackParser.#MIN_PASTE_OPENING &&
            height + 2 * expansion >= PcbPadStackParser.#MIN_PASTE_OPENING
        )
    }

    /**
     * Returns whether a mask aperture has positive dimensions.
     * @param {number} width
     * @param {number} height
     * @param {number} expansion
     * @returns {boolean}
     */
    static #hasPositiveOpening(width, height, expansion) {
        return width + 2 * expansion > 0 && height + 2 * expansion > 0
    }

    /**
     * Applies the narrow mask-only SMD testpoint heuristic used by exporters.
     * @param {Record<string, boolean | number>} flags
     * @param {{ layerId?: number | null, holeDiameter?: number }} padContext
     * @param {boolean} topPasteOpening
     * @param {boolean} bottomPasteOpening
     * @returns {boolean}
     */
    static #isSolderMaskOnly(
        flags,
        padContext,
        topPasteOpening,
        bottomPasteOpening
    ) {
        const layerId = Number(padContext.layerId) || null

        if (Number(padContext.holeDiameter) > 0) {
            return false
        }
        if (
            layerId === PcbPadStackParser.#TOP_LAYER_ID &&
            !topPasteOpening &&
            PcbPadStackParser.#hasTopTestPointFlag(flags)
        ) {
            return true
        }
        if (
            layerId === PcbPadStackParser.#BOTTOM_LAYER_ID &&
            !bottomPasteOpening &&
            PcbPadStackParser.#hasBottomTestPointFlag(flags)
        ) {
            return true
        }

        return false
    }

    /**
     * Returns whether top-side testpoint-like pad flags are present.
     * @param {Record<string, boolean | number>} flags
     * @returns {boolean}
     */
    static #hasTopTestPointFlag(flags) {
        return Boolean(
            flags.isAssemblyTestPointTop ||
            flags.isFabTestPointTop ||
            flags.isTestFabTop
        )
    }

    /**
     * Returns whether bottom-side testpoint-like pad flags are present.
     * @param {Record<string, boolean | number>} flags
     * @returns {boolean}
     */
    static #hasBottomTestPointFlag(flags) {
        return Boolean(
            flags.isAssemblyTestPointBottom ||
            flags.isFabTestPointBottom ||
            flags.isTestFabBottom
        )
    }

    /**
     * Decodes optional per-layer pad stack fields from the extension record.
     * @param {DataView | undefined} extensionRecord
     * @param {{ shapeMid?: number, holeDiameter?: number }} padContext
     * @returns {Record<string, unknown>}
     */
    static #parseExtensionRecord(extensionRecord, padContext) {
        if (
            !extensionRecord ||
            extensionRecord.byteLength <
                PcbPadStackParser.#EXTENSION_MIN_BYTE_LENGTH
        ) {
            return {
                holeShape: null,
                holeSlotLength: null,
                holeRotation: null,
                hasRoundedRect: false,
                roundedRectShapeTop: null,
                cornerRadiusTop: null,
                offsetTopX: 0,
                offsetTopY: 0
            }
        }

        const innerLayerSizes =
            PcbPadStackParser.#parseInnerLayerSizes(extensionRecord)
        const innerLayerShapes = PcbPadStackParser.#parseInnerLayerShapes(
            extensionRecord,
            innerLayerSizes,
            padContext.shapeMid
        )
        const layerOffsets =
            PcbPadStackParser.#parseLayerOffsets(extensionRecord)
        const layerShapes = PcbPadStackParser.#parseLayerShapes(extensionRecord)
        const cornerRadiusByLayer =
            PcbPadStackParser.#parseCornerRadiusByLayer(extensionRecord)
        const holeShape = extensionRecord.getUint8(262)
        const holeSlotLength = PcbPadStackParser.#readMil(extensionRecord, 263)
        const holeRotation = extensionRecord.getFloat64(267, true)
        const roundedRectShapeTop = extensionRecord.getUint8(532)

        return {
            holeShape,
            holeShapeName: PcbPadShapeCodec.holeShapeName(holeShape),
            holeSlotLength,
            holeRotation,
            holeGeometry: PcbPadShapeCodec.describeHoleGeometry({
                shape: holeShape,
                diameter: Number(padContext.holeDiameter || 0),
                slotLength: holeSlotLength,
                rotation: holeRotation
            }),
            hasRoundedRect: extensionRecord.getUint8(531) !== 0,
            roundedRectShapeTop,
            roundedRectShapeTopName:
                PcbPadShapeCodec.padShapeName(roundedRectShapeTop),
            cornerRadiusTop: extensionRecord.getUint8(564),
            offsetTopX: PcbPadStackParser.#readMil(extensionRecord, 275),
            offsetTopY: PcbPadStackParser.#readMil(extensionRecord, 403),
            innerLayerSizes,
            innerLayerShapes,
            middleLayerPads: PcbPadStackParser.#buildMiddleLayerPads(
                innerLayerSizes,
                innerLayerShapes
            ),
            layerOffsets,
            layerShapes,
            cornerRadiusByLayer,
            fullStackLayerEntries:
                PcbPadStackParser.#parseFullStackLayerEntries(extensionRecord)
        }
    }

    /**
     * Builds a normalized local-stack geometry read model.
     * @param {Record<string, boolean | number>} mainRecordTail Main tail fields.
     * @param {Record<string, unknown>} extension Extension fields.
     * @param {Record<string, unknown>} padContext Parsed pad fields.
     * @returns {{ localStack?: object }}
     */
    static #buildLocalStack(mainRecordTail, extension, padContext) {
        const mode = Number(mainRecordTail.padMode)
        if (mode === 1) {
            return {
                localStack: {
                    schema: 'altium-toolkit.pcb.pad-local-stack.a1',
                    mode,
                    modeName: String(mainRecordTail.padModeName || ''),
                    source: 'main-record',
                    layers: [
                        PcbPadStackParser.#localStackLayer(
                            'top',
                            1,
                            'L1',
                            padContext,
                            extension
                        ),
                        PcbPadStackParser.#localStackLayer(
                            'middle',
                            null,
                            'INNER',
                            padContext,
                            extension
                        ),
                        PcbPadStackParser.#localStackLayer(
                            'bottom',
                            32,
                            'L32',
                            padContext,
                            extension
                        )
                    ],
                    hole: PcbPadStackParser.#localStackHole(
                        padContext,
                        extension
                    )
                }
            }
        }

        if (
            mode === 2 &&
            Array.isArray(extension.fullStackLayerEntries) &&
            extension.fullStackLayerEntries.length
        ) {
            return {
                localStack: {
                    schema: 'altium-toolkit.pcb.pad-local-stack.a1',
                    mode,
                    modeName: String(mainRecordTail.padModeName || ''),
                    source: 'extension-record',
                    layers: extension.fullStackLayerEntries.map((entry) => ({
                        role: 'layer',
                        layerId: Number(entry.layerCode),
                        layerKey: 'L' + Number(entry.layerCode),
                        enabled: entry.enabled,
                        width: entry.sizeX,
                        height: entry.sizeY,
                        cornerRadius: entry.cornerRadius,
                        modeFlags: entry.modeFlags
                    })),
                    hole: PcbPadStackParser.#localStackHole(
                        padContext,
                        extension
                    )
                }
            }
        }

        return {}
    }

    /**
     * Builds one top/middle/bottom local-stack layer entry.
     * @param {'top' | 'middle' | 'bottom'} role Layer role.
     * @param {number | null} layerId Layer id.
     * @param {string} layerKey Stable layer key.
     * @param {Record<string, unknown>} padContext Parsed pad fields.
     * @param {Record<string, unknown>} extension Extension fields.
     * @returns {object}
     */
    static #localStackLayer(role, layerId, layerKey, padContext, extension) {
        const suffix =
            role === 'top' ? 'Top' : role === 'bottom' ? 'Bottom' : 'Mid'
        const offset = PcbPadStackParser.#layerOffset(role, extension)

        return {
            role,
            layerId,
            layerKey,
            width: Number(padContext['size' + suffix + 'X'] || 0),
            height: Number(padContext['size' + suffix + 'Y'] || 0),
            shape: PcbPadStackParser.#numericOrNull(
                padContext['shape' + suffix]
            ),
            shapeName: PcbPadShapeCodec.padShapeName(
                padContext['shape' + suffix]
            ),
            offsetX: offset.x,
            offsetY: offset.y
        }
    }

    /**
     * Resolves layer offsets from extension data when present.
     * @param {'top' | 'middle' | 'bottom'} role Layer role.
     * @param {Record<string, unknown>} extension Extension fields.
     * @returns {{ x: number, y: number }}
     */
    static #layerOffset(role, extension) {
        const layerNumber = role === 'top' ? 1 : role === 'bottom' ? 32 : null
        const offset = Array.isArray(extension.layerOffsets)
            ? extension.layerOffsets.find(
                  (entry) => entry.layerNumber === layerNumber
              )
            : null

        return {
            x: Number(offset?.x || 0),
            y: Number(offset?.y || 0)
        }
    }

    /**
     * Builds local-stack hole geometry.
     * @param {Record<string, unknown>} padContext Parsed pad fields.
     * @param {Record<string, unknown>} extension Extension fields.
     * @returns {object}
     */
    static #localStackHole(padContext, extension) {
        const shape = PcbPadStackParser.#numericOrNull(extension.holeShape)

        return {
            diameter: Number(padContext.holeDiameter || 0),
            shape,
            shapeName:
                shape === null ? null : PcbPadShapeCodec.holeShapeName(shape),
            slotLength: extension.holeSlotLength ?? null,
            rotation: extension.holeRotation ?? null
        }
    }

    /**
     * Converts finite numeric values and nullish values into stable output.
     * @param {unknown} value Candidate value.
     * @returns {number | null}
     */
    static #numericOrNull(value) {
        if (value === null || value === undefined || value === '') {
            return null
        }

        const number = Number(value)
        return Number.isFinite(number) ? number : null
    }

    /**
     * Decodes non-empty inner-layer pad sizes.
     * @param {DataView} extensionRecord
     * @returns {{ layerNumber: number, width: number, height: number }[]}
     */
    static #parseInnerLayerSizes(extensionRecord) {
        const entries = []

        for (
            let index = 0;
            index < PcbPadStackParser.#INNER_LAYER_COUNT;
            index += 1
        ) {
            const width = PcbPadStackParser.#readMil(extensionRecord, index * 4)
            const height = PcbPadStackParser.#readMil(
                extensionRecord,
                116 + index * 4
            )

            if (width || height) {
                entries.push({
                    layerNumber: index + 2,
                    width,
                    height
                })
            }
        }

        return entries
    }

    /**
     * Decodes inner-layer shape values for layers that carry size or shape data.
     * @param {DataView} extensionRecord
     * @param {{ layerNumber: number }[]} innerLayerSizes
     * @param {number | null | undefined} fallbackShape
     * @returns {{ layerNumber: number, shape: number, shapeName: string | null, effectiveShape: number, effectiveShapeName: string | null }[]}
     */
    static #parseInnerLayerShapes(
        extensionRecord,
        innerLayerSizes,
        fallbackShape
    ) {
        const sizedLayers = new Set(
            innerLayerSizes.map((entry) => entry.layerNumber)
        )
        const entries = []

        for (
            let index = 0;
            index < PcbPadStackParser.#INNER_LAYER_COUNT;
            index += 1
        ) {
            const shape = extensionRecord.getUint8(232 + index)
            const layerNumber = index + 2

            if (shape || sizedLayers.has(layerNumber)) {
                entries.push({
                    layerNumber,
                    ...PcbPadShapeCodec.describeMiddleLayerShape(
                        shape,
                        fallbackShape
                    )
                })
            }
        }

        return entries
    }

    /**
     * Merges middle-layer size records with their raw and effective shapes.
     * @param {{ layerNumber: number, width: number, height: number }[]} innerLayerSizes
     * @param {{ layerNumber: number, shape: number, shapeName: string | null, effectiveShape: number, effectiveShapeName: string | null }[]} innerLayerShapes
     * @returns {{ layerNumber: number, width: number, height: number, shape: number, shapeName: string | null, effectiveShape: number, effectiveShapeName: string | null }[]}
     */
    static #buildMiddleLayerPads(innerLayerSizes, innerLayerShapes) {
        const sizesByLayer = new Map(
            innerLayerSizes.map((entry) => [entry.layerNumber, entry])
        )

        return innerLayerShapes.map((shapeEntry) => {
            const sizeEntry = sizesByLayer.get(shapeEntry.layerNumber) || {}

            return {
                layerNumber: shapeEntry.layerNumber,
                width: Number(sizeEntry.width || 0),
                height: Number(sizeEntry.height || 0),
                shape: shapeEntry.shape,
                shapeName: shapeEntry.shapeName,
                effectiveShape: shapeEntry.effectiveShape,
                effectiveShapeName: shapeEntry.effectiveShapeName
            }
        })
    }

    /**
     * Decodes non-empty per-layer pad-center offsets.
     * @param {DataView} extensionRecord
     * @returns {{ layerNumber: number, x: number, y: number }[]}
     */
    static #parseLayerOffsets(extensionRecord) {
        const entries = []

        for (
            let index = 0;
            index < PcbPadStackParser.#PHYSICAL_LAYER_COUNT;
            index += 1
        ) {
            const x = PcbPadStackParser.#readMil(
                extensionRecord,
                275 + index * 4
            )
            const y = PcbPadStackParser.#readMil(
                extensionRecord,
                403 + index * 4
            )

            if (x || y) {
                entries.push({
                    layerNumber: index + 1,
                    x,
                    y
                })
            }
        }

        return entries
    }

    /**
     * Decodes non-empty per-layer alternative pad shapes.
     * @param {DataView} extensionRecord
     * @returns {{ layerNumber: number, shape: number, shapeName: string | null }[]}
     */
    static #parseLayerShapes(extensionRecord) {
        const entries = []

        for (
            let index = 0;
            index < PcbPadStackParser.#PHYSICAL_LAYER_COUNT;
            index += 1
        ) {
            const shape = extensionRecord.getUint8(532 + index)

            if (shape) {
                entries.push({
                    layerNumber: index + 1,
                    shape,
                    shapeName: PcbPadShapeCodec.padShapeName(shape)
                })
            }
        }

        return entries
    }

    /**
     * Decodes non-empty per-layer corner-radius percentages.
     * @param {DataView} extensionRecord
     * @returns {{ layerNumber: number, cornerRadius: number }[]}
     */
    static #parseCornerRadiusByLayer(extensionRecord) {
        const entries = []

        for (
            let index = 0;
            index < PcbPadStackParser.#PHYSICAL_LAYER_COUNT;
            index += 1
        ) {
            const cornerRadius = extensionRecord.getUint8(564 + index)

            if (cornerRadius) {
                entries.push({
                    layerNumber: index + 1,
                    cornerRadius
                })
            }
        }

        return entries
    }

    /**
     * Decodes the optional full-stack tail table.
     * @param {DataView} extensionRecord
     * @returns {{ layerCode: number, modeFlags: number, enabled: boolean, sizeX: number, sizeY: number, cornerRadius: number }[]}
     */
    static #parseFullStackLayerEntries(extensionRecord) {
        const tailOffset = PcbPadStackParser.#EXTENSION_MIN_BYTE_LENGTH
        const tableHeaderOffset = tailOffset + 32

        if (extensionRecord.byteLength < tableHeaderOffset + 8) {
            return []
        }

        const count = extensionRecord.getUint32(tableHeaderOffset, true)
        const stride = extensionRecord.getUint32(tableHeaderOffset + 4, true)

        if (count <= 0 || count > 128 || stride < 15) {
            return []
        }

        const dataStart = tableHeaderOffset + 8
        const dataEnd = dataStart + count * stride

        if (dataEnd > extensionRecord.byteLength) {
            return []
        }

        const entries = []

        for (let index = 0; index < count; index += 1) {
            const offset = dataStart + index * stride
            entries.push({
                layerCode: extensionRecord.getInt16(offset, true),
                modeFlags: extensionRecord.getUint16(offset + 2, true),
                enabled: extensionRecord.getUint8(offset + 4) !== 0,
                sizeX: PcbPadStackParser.#readMil(extensionRecord, offset + 5),
                sizeY: PcbPadStackParser.#readMil(extensionRecord, offset + 9),
                cornerRadius: extensionRecord.getUint16(offset + 13, true)
            })
        }

        return entries
    }

    /**
     * Reads one signed fixed-point mil value.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readMil(view, offset) {
        return view.getInt32(offset, true) / 10000
    }
}
