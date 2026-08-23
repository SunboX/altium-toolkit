// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbScene3dBuilder as ConvergedPcbScene3dBuilder } from '../../src/convergence/PcbScene3dBuilder.mjs'
import { PcbScene3dBuilder as HistoricalPcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds neutral source metadata for late-owner seating normalization.
 * @returns {object}
 */
function createDocumentModel() {
    return {
        pcb: {
            components: [
                { designator: 'U7' },
                { designator: 'U8' },
                { designator: 'U9' }
            ],
            componentBodies: [
                {
                    name: 'neutral-body.step',
                    positionMil: { x: 120, y: 140 },
                    standoffHeightMil: 0,
                    dzMil: 35
                },
                {
                    name: 'raised-body.step',
                    positionMil: { x: 320, y: 140 },
                    standoffHeightMil: 20,
                    dzMil: 20
                },
                {
                    name: 'anonymous-body.step',
                    positionMil: { x: 520, y: 140 },
                    standoffHeightMil: 0,
                    dzMil: 25
                },
                {
                    name: 'adjusted-body.step',
                    positionMil: { x: 720, y: 140 },
                    standoffHeightMil: 0,
                    dzMil: 25
                }
            ]
        }
    }
}

/**
 * Builds the post-adapter scene emitted by the preserved historical builder.
 * @returns {object}
 */
function createHistoricalScene() {
    return {
        externalPlacements: [
            {
                designator: 'U7',
                bodyPositionMil: { x: 120, y: 140 },
                modelTransform: { dzMil: 35 },
                externalModel: { name: 'neutral-body.step' }
            },
            {
                designator: 'U8',
                bodyPositionMil: { x: 320, y: 140 },
                modelTransform: { dzMil: 20 },
                externalModel: { name: 'raised-body.step' }
            },
            {
                designator: 'anonymous-body',
                bodyPositionMil: { x: 520, y: 140 },
                modelTransform: { dzMil: 25 },
                externalModel: { name: 'anonymous-body.step' }
            },
            {
                designator: 'U9',
                bodyPositionMil: { x: 720, y: 140 },
                modelTransform: { dzMil: 10 },
                externalModel: { name: 'adjusted-body.step' }
            }
        ]
    }
}

test('convergence seats zero-standoff bodies after late owner recovery', () => {
    const originalBuild = HistoricalPcbScene3dBuilder.build
    HistoricalPcbScene3dBuilder.build = () => createHistoricalScene()

    try {
        const scene = ConvergedPcbScene3dBuilder.build(createDocumentModel())

        assert.equal(scene.externalPlacements[0].modelTransform.dzMil, 0)
        assert.equal(scene.externalPlacements[1].modelTransform.dzMil, 20)
        assert.equal(scene.externalPlacements[2].modelTransform.dzMil, 25)
        assert.equal(scene.externalPlacements[3].modelTransform.dzMil, 10)
    } finally {
        HistoricalPcbScene3dBuilder.build = originalBuild
    }
})
