// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Verifies bottom-side embedded model offsets let the viewer seat matched
 * bodies from their bounds instead of preserving Altium source-origin standoffs.
 */
test('PcbScene3dBuilder seats bottom-side matched embedded standoffs on the board face', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'offset-contract.PcbDoc',
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 1000,
                    heightMil: 500,
                    segments: []
                },
                pads: [],
                tracks: [],
                arcs: [],
                fills: [],
                vias: [],
                polygons: [],
                embeddedModels: [],
                componentBodies: [
                    {
                        sourceStream: 'ShapeBasedComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'Fixture Socket',
                        modelId: 'fixture-socket-body',
                        checksum: 101,
                        embedded: true,
                        name: 'Fixture-Socket.step',
                        positionMil: { x: 600, y: 250 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        standoffHeightMil: -120,
                        overallHeightMil: 300
                    },
                    {
                        sourceStream: 'ShapeBasedComponentBodies6/Data',
                        layer: 'MECHANICAL13',
                        identifier: 'Fixture End Socket',
                        modelId: 'fixture-end-socket-body',
                        checksum: 102,
                        embedded: true,
                        name: 'Fixture-End-Socket.step',
                        positionMil: { x: 700, y: 250 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        dzMil: 118.1102,
                        standoffHeightMil: -135.8268,
                        overallHeightMil: 234.2519
                    }
                ],
                components: [
                    {
                        designator: 'J1',
                        x: 600,
                        y: 250,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: 'Fixture Socket',
                        source: 'Fixture Socket',
                        height: 300
                    },
                    {
                        designator: 'J2',
                        x: 700,
                        y: 250,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: 'Fixture End Socket',
                        source: 'Fixture End Socket',
                        height: 234.2519
                    }
                ]
            }
        },
        {
            modelRegistry: {
                resolveComponentModel() {
                    return null
                },
                resolveComponentBodyModel(componentBody) {
                    return {
                        origin: 'embedded',
                        name: componentBody.name,
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/fixture-socket'
                    }
                }
            }
        }
    )

    assert.equal(scene.externalPlacements.length, 2)
    assert.equal(scene.externalPlacements[0].mountSide, 'bottom')
    assert.equal(scene.externalPlacements[0].positionMil.z, -31.5)
    assert.equal(scene.externalPlacements[0].modelTransform.dzMil, 0)
    assert.equal(scene.externalPlacements[1].mountSide, 'bottom')
    assert.equal(scene.externalPlacements[1].positionMil.z, -31.5)
    assert.equal(scene.externalPlacements[1].modelTransform.dzMil, 0)
})
