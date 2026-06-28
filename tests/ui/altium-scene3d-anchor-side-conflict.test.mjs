// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds one top-side standalone body that is near an unrelated bottom-side
 * passive component anchor.
 * @returns {{ scene: object, documentModel: object }}
 */
function createNearSideConflictCase() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { centerX: 400, centerY: 250, thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'orion-anchor-unit',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: -80, y: -10, z: 40 },
                    bodyPositionMil: { x: 320, y: 240 },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    projection: { source: 'pad-fallback' },
                    externalModel: {
                        origin: 'embedded',
                        name: 'orion-anchor-unit.step',
                        format: 'step'
                    }
                }
            ]
        },
        documentModel: {
            sourceFormat: 'altium',
            kind: 'pcb',
            fileName: 'near-side-conflict-fake.PcbDoc',
            pcb: {
                components: [
                    {
                        designator: 'FB1',
                        componentIndex: 4,
                        x: 306,
                        y: 229,
                        layer: 'BOTTOM',
                        pattern: 'BEAD_0402',
                        source: 'PASSIVE_BEAD',
                        rotation: 0
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'orion-anchor-unit',
                        name: 'orion-anchor-unit.step',
                        positionMil: { x: 320, y: 240 },
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        overallHeightMil: 24
                    }
                ],
                pads: []
            }
        }
    }
}

test('Altium 3D owner repair rejects near side-conflicting anchors without identity affinity', () => {
    const { scene, documentModel } = createNearSideConflictCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(placement.designator, 'orion-anchor-unit')
    assert.equal(placement.mountSide, 'top')
})
