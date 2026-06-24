// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbComponentBodyPlacementNormalizer } from '../../src/core/altium/PcbComponentBodyPlacementNormalizer.mjs'

/**
 * Verifies board-space Y mirroring keeps model yaw in the same viewer frame as
 * the mirrored 2D placement.
 */
test('PcbComponentBodyPlacementNormalizer mirrors authored 3D model yaw', () => {
    const componentBodies =
        PcbComponentBodyPlacementNormalizer.normalizeComponentBodies(
            [
                {
                    sourceStream: 'ComponentBodies6/Data',
                    layer: 'MECHANICAL1',
                    identifier: 'offset_body',
                    modelId: '{MODEL-A}',
                    checksum: 123,
                    embedded: true,
                    name: 'offset-body.step',
                    positionMil: { x: 100, y: 150 },
                    rotationDeg: 30,
                    modelRotationDeg: { x: 0, y: 0, z: 270 },
                    dzMil: 0,
                    overallHeightMil: 40,
                    standoffHeightMil: 0
                }
            ],
            { minY: 0, heightMil: 500 }
        )

    assert.deepEqual(componentBodies[0].positionMil, { x: 100, y: 350 })
    assert.equal(componentBodies[0].rotationDeg, 330)
    assert.deepEqual(componentBodies[0].modelRotationDeg, {
        x: 0,
        y: 0,
        z: 90
    })
})

/**
 * Verifies source-coordinate shape body polygons stay aligned with their
 * mirrored body anchors.
 */
test('PcbComponentBodyPlacementNormalizer mirrors source-coordinate static polygon vertices', () => {
    const componentBodies =
        PcbComponentBodyPlacementNormalizer.normalizeComponentBodies(
            [
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: '',
                    identifier: 'body-a',
                    modelId: '{MODEL-B}',
                    checksum: 124,
                    embedded: false,
                    name: '',
                    positionMil: { x: 100, y: 150 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 0 },
                    dzMil: 0,
                    overallHeightMil: 40,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 40,
                        standoffHeightMil: 0,
                        verticesMil: [
                            { x: 80, y: 130 },
                            { x: 120, y: 130 },
                            { x: 120, y: 170 },
                            { x: 80, y: 170 }
                        ]
                    }
                }
            ],
            { minY: 0, heightMil: 500 }
        )

    assert.deepEqual(componentBodies[0].positionMil, { x: 100, y: 350 })
    assert.deepEqual(componentBodies[0].staticGeometry.verticesMil, [
        { x: 80, y: 370 },
        { x: 120, y: 370 },
        { x: 120, y: 330 },
        { x: 80, y: 330 }
    ])
})
