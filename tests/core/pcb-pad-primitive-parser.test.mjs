// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'
import { PcbBinaryPrimitiveTestFactory } from './PcbBinaryPrimitiveTestFactory.mjs'

/**
 * Verifies variable-length binary pad records decode plated-hole geometry.
 */
test('PcbBinaryPrimitiveParser decodes pad streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createPadStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parsePadStream(headerBytes, dataBytes),
        [
            {
                x: 9869.0874,
                y: 7795.586,
                sizeTopX: 244.0945,
                sizeTopY: 244.0945,
                sizeMidX: 244.0945,
                sizeMidY: 244.0945,
                sizeBottomX: 244.0945,
                sizeBottomY: 244.0945,
                holeDiameter: 137.7953,
                shapeTop: 1,
                shapeMid: 1,
                shapeBottom: 1,
                shapeTopName: 'round',
                shapeMidName: 'round',
                shapeBottomName: 'round',
                padShapeNames: {
                    top: 'round',
                    middle: 'round',
                    bottom: 'round'
                },
                rotation: 0,
                isPlated: true,
                holeShape: null,
                holeSlotLength: null,
                holeRotation: null,
                hasRoundedRect: false,
                roundedRectShapeTop: null,
                cornerRadiusTop: null,
                offsetTopX: 0,
                offsetTopY: 0,
                componentIndex: 7,
                netIndex: 21,
                polygonIndex: null,
                layerCode: 74,
                layerId: 74,
                legacyLayerId: 74,
                layerV7SaveId: null
            }
        ]
    )
})

/**
 * Verifies pad record splitting remains aligned when an Altium version adds an
 * unknown optional subrecord after the known extension subrecord.
 */
test('PcbBinaryPrimitiveParser skips unknown pad subrecords before the next pad', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createPadStreamWithUnknownSubrecord()
    const pads = PcbBinaryPrimitiveParser.parsePadStream(headerBytes, dataBytes)

    assert.equal(pads.length, 2)
    assert.equal(pads[0].x, 9869.0874)
    assert.equal(pads[0].componentIndex, 7)
    assert.equal(pads[1].x, 420)
    assert.equal(pads[1].y, 360)
    assert.equal(pads[1].componentIndex, 9)
    assert.equal(pads[1].netIndex, 33)
})

/**
 * Verifies large pad streams do not depend on recursive boundary scanning.
 */
test('PcbBinaryPrimitiveParser decodes large pad streams iteratively', () => {
    const recordCount = 12_000
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createLargePadStream(recordCount)
    const pads = PcbBinaryPrimitiveParser.parsePadStream(headerBytes, dataBytes)

    assert.equal(pads.length, recordCount)
    assert.equal(pads[0].x, 100)
    assert.equal(pads[recordCount - 1].x, 12_099)
})

/**
 * Verifies raw pad shape variants are exposed as stable normalized names.
 */
test('PcbBinaryPrimitiveParser names pad shape variants', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createPadShapeVariantStream()
    const pads = PcbBinaryPrimitiveParser.parsePadStream(headerBytes, dataBytes)

    assert.equal(pads.length, 1)
    assert.equal(pads[0].shapeTop, 2)
    assert.equal(pads[0].shapeMid, 3)
    assert.equal(pads[0].shapeBottom, 9)
    assert.equal(pads[0].shapeTopName, 'rectangular')
    assert.equal(pads[0].shapeMidName, 'octagonal')
    assert.equal(pads[0].shapeBottomName, 'rounded-rectangle')
    assert.deepEqual(pads[0].padShapeNames, {
        top: 'rectangular',
        middle: 'octagonal',
        bottom: 'rounded-rectangle'
    })
})

/**
 * Verifies pad main subrecords expose explicit hole tolerances and suppress the
 * unset sentinel value.
 */
test('PcbBinaryPrimitiveParser decodes pad hole tolerances', () => {
    const setStream =
        PcbBinaryPrimitiveTestFactory.createPadHoleToleranceStream()
    const unsetStream =
        PcbBinaryPrimitiveTestFactory.createPadUnsetHoleToleranceStream()
    const pads = PcbBinaryPrimitiveParser.parsePadStream(
        setStream.headerBytes,
        setStream.dataBytes
    )
    const unsetPads = PcbBinaryPrimitiveParser.parsePadStream(
        unsetStream.headerBytes,
        unsetStream.dataBytes
    )

    assert.equal(pads.length, 1)
    assert.equal(pads[0].positiveTolerance, 1.1)
    assert.equal(pads[0].negativeTolerance, -0.7)
    assert.deepEqual(pads[0].holeTolerance, {
        positive: 1.1,
        negative: -0.7
    })
    assert.equal(unsetPads.length, 1)
    assert.equal(unsetPads[0].positiveTolerance, undefined)
    assert.equal(unsetPads[0].negativeTolerance, undefined)
    assert.equal(unsetPads[0].holeTolerance, undefined)
})

/**
 * Verifies extended pad records decode slot-hole geometry instead of dropping
 * the optional extension block.
 */
test('PcbBinaryPrimitiveParser decodes extended pad streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createExtendedPadStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parsePadStream(headerBytes, dataBytes),
        [
            {
                x: 10199.796,
                y: 7756.2159,
                sizeTopX: 125.9843,
                sizeTopY: 66.9291,
                sizeMidX: 125.9843,
                sizeMidY: 66.9291,
                sizeBottomX: 125.9843,
                sizeBottomY: 66.9291,
                holeDiameter: 39.3701,
                shapeTop: 1,
                shapeMid: 1,
                shapeBottom: 1,
                shapeTopName: 'round',
                shapeMidName: 'round',
                shapeBottomName: 'round',
                padShapeNames: {
                    top: 'round',
                    middle: 'round',
                    bottom: 'round'
                },
                rotation: 270,
                isPlated: true,
                padFlags: 0x03f8,
                isUserRouted: true,
                isTentingTop: true,
                isTentingBottom: true,
                isTestFabTop: true,
                isFabTestPointTop: true,
                isTestFabBottom: true,
                isFabTestPointBottom: true,
                isAssemblyTestPointTop: true,
                isAssemblyTestPointBottom: true,
                unionIndex: 123456,
                padMode: 2,
                padModeName: 'full-stack',
                planeConnectionStyle: 2,
                thermalReliefConductorWidth: 12,
                thermalReliefConductorCount: 4,
                thermalReliefAirGap: 14,
                powerPlaneReliefExpansion: 16,
                powerPlaneClearance: 18,
                pasteMaskExpansion: -2.5,
                solderMaskExpansion: 3.5,
                padCache: {
                    planeConnectionStyle: 2,
                    thermalReliefConductorWidth: 12,
                    thermalReliefConductorCount: 4,
                    thermalReliefAirGap: 14,
                    powerPlaneReliefExpansion: 16,
                    powerPlaneClearance: 18,
                    validity: {
                        planeConnection: 1,
                        thermalReliefConductorWidth: 2,
                        thermalReliefConductorCount: 3,
                        thermalReliefAirGap: 4,
                        powerPlaneReliefExpansion: 5
                    }
                },
                planeConnectionCacheValid: 1,
                thermalReliefConductorWidthCacheValid: 2,
                thermalReliefConductorCountCacheValid: 3,
                thermalReliefAirGapCacheValid: 4,
                thermalReliefCacheValid: 4,
                powerPlaneReliefExpansionCacheValid: 5,
                powerPlaneReliefCacheValid: 5,
                pasteMaskExpansionCacheValid: 1,
                solderMaskExpansionCacheValid: 1,
                pasteMaskExpansionMode: 1,
                solderMaskExpansionMode: 2,
                pasteMaskExpansionSource: 'rule',
                solderMaskExpansionSource: 'manual',
                effectivePasteMaskExpansion: -2.5,
                effectiveSolderMaskExpansion: 3.5,
                maskExpansion: {
                    paste: {
                        mode: 1,
                        source: 'rule',
                        expansion: -2.5,
                        effectiveExpansion: -2.5,
                        cacheValid: 1
                    },
                    solder: {
                        mode: 2,
                        source: 'manual',
                        expansion: 3.5,
                        effectiveExpansion: 3.5,
                        cacheValid: 1
                    },
                    defaultSolderExpansion: 4,
                    minPasteOpening: 0.04
                },
                pasteMaskExpansionRuleCacheValid: true,
                solderMaskExpansionRuleCacheValid: true,
                hasTopPasteMaskOpening: false,
                hasBottomPasteMaskOpening: false,
                hasTopSolderMaskOpening: false,
                hasBottomSolderMaskOpening: false,
                isSolderMaskOnly: false,
                holeShape: 2,
                holeShapeName: 'slot',
                holeSlotLength: 98.4252,
                holeRotation: 0,
                holeGeometry: {
                    shape: 2,
                    shapeName: 'slot',
                    diameter: 39.3701,
                    slotLength: 98.4252,
                    rotation: 0,
                    length: 98.4252,
                    width: 39.3701
                },
                hasRoundedRect: false,
                roundedRectShapeTop: 9,
                roundedRectShapeTopName: 'rounded-rectangle',
                cornerRadiusTop: 35,
                offsetTopX: 4,
                offsetTopY: 8,
                innerLayerSizes: [
                    { layerNumber: 2, width: 40, height: 45 },
                    { layerNumber: 3, width: 42, height: 47 }
                ],
                innerLayerShapes: [
                    {
                        layerNumber: 2,
                        shape: 2,
                        shapeName: 'rectangular',
                        effectiveShape: 2,
                        effectiveShapeName: 'rectangular'
                    },
                    {
                        layerNumber: 3,
                        shape: 0,
                        shapeName: 'none',
                        effectiveShape: 1,
                        effectiveShapeName: 'round'
                    }
                ],
                middleLayerPads: [
                    {
                        layerNumber: 2,
                        width: 40,
                        height: 45,
                        shape: 2,
                        shapeName: 'rectangular',
                        effectiveShape: 2,
                        effectiveShapeName: 'rectangular'
                    },
                    {
                        layerNumber: 3,
                        width: 42,
                        height: 47,
                        shape: 0,
                        shapeName: 'none',
                        effectiveShape: 1,
                        effectiveShapeName: 'round'
                    }
                ],
                layerOffsets: [
                    { layerNumber: 1, x: 4, y: 8 },
                    { layerNumber: 2, x: -6, y: -10 }
                ],
                layerShapes: [
                    {
                        layerNumber: 1,
                        shape: 9,
                        shapeName: 'rounded-rectangle'
                    },
                    {
                        layerNumber: 2,
                        shape: 2,
                        shapeName: 'rectangular'
                    }
                ],
                cornerRadiusByLayer: [
                    { layerNumber: 1, cornerRadius: 35 },
                    { layerNumber: 2, cornerRadius: 12 }
                ],
                fullStackLayerEntries: [
                    {
                        layerCode: 37,
                        modeFlags: 3,
                        enabled: true,
                        sizeX: 80,
                        sizeY: 25,
                        cornerRadius: 20
                    }
                ],
                componentIndex: 8,
                netIndex: 22,
                polygonIndex: null,
                layerCode: 32,
                layerId: 32,
                legacyLayerId: 1,
                layerV7SaveId: 0x0100ffff
            }
        ]
    )
})

/**
 * Verifies mask-only SMD testpoint pads expose semantic layer decisions from
 * flags, mask modes, and effective paste openings.
 */
test('PcbBinaryPrimitiveParser derives pad mask and cache semantics', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createMaskOnlySmdPadStream()
    const pads = PcbBinaryPrimitiveParser.parsePadStream(headerBytes, dataBytes)

    assert.equal(pads.length, 1)
    assert.equal(pads[0].padFlags, 0x0080)
    assert.equal(pads[0].isAssemblyTestPointTop, true)
    assert.equal(pads[0].isFabTestPointTop, undefined)
    assert.equal(pads[0].pasteMaskExpansionSource, 'manual')
    assert.equal(pads[0].solderMaskExpansionSource, 'manual')
    assert.equal(pads[0].effectivePasteMaskExpansion, -6.1)
    assert.equal(pads[0].effectiveSolderMaskExpansion, 4)
    assert.equal(pads[0].pasteMaskExpansionCacheValid, 1)
    assert.equal(pads[0].solderMaskExpansionCacheValid, 1)
    assert.equal(pads[0].hasTopPasteMaskOpening, false)
    assert.equal(pads[0].hasBottomPasteMaskOpening, false)
    assert.equal(pads[0].hasTopSolderMaskOpening, true)
    assert.equal(pads[0].hasBottomSolderMaskOpening, false)
    assert.equal(pads[0].isSolderMaskOnly, true)
    assert.deepEqual(pads[0].maskExpansion.paste, {
        mode: 2,
        source: 'manual',
        expansion: -6.1,
        effectiveExpansion: -6.1,
        cacheValid: 1
    })
})
