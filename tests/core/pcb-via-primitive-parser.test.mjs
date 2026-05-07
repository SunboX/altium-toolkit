// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'
import { PcbBinaryPrimitiveTestFactory } from './PcbBinaryPrimitiveTestFactory.mjs'

/**
 * Verifies binary via records decode plated-hole geometry.
 */
test('PcbBinaryPrimitiveParser decodes via streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createViaStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseViaStream(headerBytes, dataBytes),
        [
            {
                x: 11235.2291,
                y: 9079.5466,
                diameter: 23.622,
                holeDiameter: 11.811,
                componentIndex: 4,
                netIndex: 18,
                polygonIndex: 24,
                layerCode: 74,
                layerId: 74,
                layerStartId: 1,
                layerEndId: 32,
                isSelected: true,
                isPolygonOutline: true,
                isLocked: true,
                isTentingTop: true,
                isTentingBottom: true,
                isTestFabTop: true,
                isTestFabBottom: true,
                isKeepout: true,
                planeConnectionStyle: 2,
                thermalReliefAirGap: 7,
                thermalReliefConductorCount: 6,
                thermalReliefConductorWidth: 5,
                powerPlaneReliefExpansion: 9,
                powerPlaneClearance: 11,
                pasteMaskExpansion: 1.5,
                solderMaskExpansion: 2.5,
                pasteMaskExpansionMode: 1,
                solderMaskExpansionMode: 2,
                removedPadsByLayer: [{ layerNumber: 1 }, { layerNumber: 3 }],
                solderMaskExpansionLinked: true,
                solderMaskExpansionBack: 4.5,
                externalStackEntryCount: 0,
                externalStackEntryStride: 0,
                externalStackEntries: [],
                externalStackMarker: 42,
                solderMaskExpansionFromHoleEdge: true,
                uniqueId: '0102030405060708090a0b0c0d0e0f10',
                tailSignature: 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
                positiveTolerance: 0.8,
                negativeTolerance: -0.6,
                drillLayerPairType: 7,
                diameterStackMode: 1,
                diameterByLayer: [
                    { layerNumber: 1, diameter: 24 },
                    { layerNumber: 2, diameter: 26 }
                ]
            }
        ]
    )
})

/**
 * Verifies length-prefixed via streams decode variable-size external stack
 * tails without losing record alignment.
 */
test('PcbBinaryPrimitiveParser decodes variable-length via streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createVariableLengthViaStream()
    const vias = PcbBinaryPrimitiveParser.parseViaStream(headerBytes, dataBytes)

    assert.equal(vias.length, 2)
    assert.deepEqual(vias[0].externalStackEntries, [
        {
            layerId: 32,
            sizeOnLayer: 28,
            entryState: 5
        }
    ])
    assert.equal(vias[0].externalStackMarker, 42)
    assert.equal(vias[0].solderMaskExpansionFromHoleEdge, true)
    assert.equal(vias[0].uniqueId, '101112131415161718191a1b1c1d1e1f')
    assert.equal(vias[0].tailSignature, 'b0b1b2b3b4b5b6b7b8b9babbbcbdbebf')
    assert.equal(vias[0].positiveTolerance, 1.2)
    assert.equal(vias[0].negativeTolerance, -0.4)
    assert.equal(vias[0].drillLayerPairType, 8)
    assert.equal(vias[1].x, 11235.2291)
    assert.equal(vias[1].layerId, 74)
})
