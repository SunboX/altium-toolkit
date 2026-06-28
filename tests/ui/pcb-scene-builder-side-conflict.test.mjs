// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a compact board outline for side-conflict matching tests.
 * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: object[] }}
 */
function buildBoardOutline() {
    return {
        minX: 0,
        minY: 0,
        widthMil: 800,
        heightMil: 500,
        segments: []
    }
}

/**
 * Builds a model registry that resolves embedded component bodies.
 * @returns {{ resolveComponentModel: () => null, resolveComponentBodyModel: (componentBody: { name?: string, sourceStream?: string }) => object }}
 */
function buildModelRegistry() {
    return {
        resolveComponentModel() {
            return null
        },
        resolveComponentBodyModel(componentBody) {
            return {
                origin: 'embedded',
                name: String(componentBody.name || ''),
                format: 'step',
                payloadText: 'ISO-10303-21;',
                sourceStream: String(componentBody.sourceStream || '')
            }
        }
    }
}

/**
 * Builds a fake PCB where a top-side mechanical body anchor lands near an
 * unrelated bottom-side passive footprint.
 * @returns {object}
 */
function buildSideConflictDocument() {
    return {
        fileName: 'side-conflict.PcbDoc',
        pcb: {
            boardOutline: buildBoardOutline(),
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: 'orion-anchor-unit',
                    modelId: '{MODEL-ORION}',
                    checksum: 701,
                    embedded: true,
                    name: 'orion-anchor-unit.step',
                    positionMil: { x: 320, y: 240 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 180, y: 0, z: 0 },
                    dzMil: 0,
                    standoffHeightMil: 0,
                    overallHeightMil: 24
                }
            ],
            components: [
                {
                    componentIndex: 4,
                    designator: 'FB1',
                    x: 306,
                    y: 229,
                    rotation: 0,
                    layer: 'BOTTOM',
                    pattern: 'BEAD_0402',
                    source: 'PASSIVE_BEAD',
                    height: 16
                }
            ]
        }
    }
}

test('PcbScene3dBuilder rejects side-conflicting precise body matches without identity affinity', () => {
    const scene = PcbScene3dBuilder.build(buildSideConflictDocument(), {
        modelRegistry: buildModelRegistry()
    })

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'orion-anchor-unit')
    assert.equal(scene.externalPlacements[0].mountSide, 'top')
})
