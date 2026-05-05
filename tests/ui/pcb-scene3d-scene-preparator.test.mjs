// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dScenePreparator } from '../../src/ui/PcbScene3dScenePreparator.mjs'

/**
 * Verifies initial scene prep leaves STEP payload loading for the deferred
 * runtime path instead of blocking the first prepared scene description.
 */
test('PcbScene3dScenePreparator does not preload STEP meshes during initial prep', async () => {
    let stepLoaderCalls = 0

    const sceneDescription = await PcbScene3dScenePreparator.prepare(
        {
            pcb: {
                boardOutline: {
                    widthMil: 1000,
                    heightMil: 500,
                    minX: 0,
                    minY: 0,
                    segments: []
                },
                components: []
            }
        },
        {
            buildScene: () => ({
                board: {
                    widthMil: 1000,
                    heightMil: 500,
                    minX: 0,
                    minY: 0,
                    centerX: 500,
                    centerY: 250,
                    segments: []
                },
                components: [
                    {
                        designator: 'U1',
                        externalModel: {
                            origin: 'embedded',
                            name: 'alpha.step',
                            format: 'step',
                            sourceStream: 'Models/0'
                        }
                    }
                ],
                externalPlacements: [
                    {
                        designator: 'J1',
                        externalModel: {
                            origin: 'embedded',
                            name: 'beta.step',
                            format: 'step',
                            sourceStream: 'Models/1'
                        }
                    }
                ],
                detail: {}
            }),
            stepLoader: {
                async loadModel() {
                    stepLoaderCalls += 1
                    return {
                        meshPayloads: [
                            {
                                name: 'body',
                                color: null,
                                positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
                                normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
                                indices: [0, 1, 2],
                                faceColors: []
                            }
                        ]
                    }
                }
            }
        }
    )

    assert.equal(stepLoaderCalls, 0)
    assert.equal(
        Array.isArray(
            sceneDescription.components[0].externalModel.preparedMeshPayloads
        ),
        false
    )
    assert.equal(
        Array.isArray(
            sceneDescription.externalPlacements[0].externalModel
                .preparedMeshPayloads
        ),
        false
    )
})
