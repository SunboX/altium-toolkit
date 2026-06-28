// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a small rectangular board outline for bottom-half-turn tests.
 * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: { type: string, x1: number, y1: number, x2: number, y2: number }[] }}
 */
function buildBoardOutline() {
    return {
        minX: 0,
        minY: 0,
        widthMil: 1000,
        heightMil: 500,
        segments: [
            { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
            { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
            { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
            { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
        ]
    }
}

/**
 * Builds a minimal registry that resolves synthetic body models.
 * @returns {{ resolveComponentModel: () => null, resolveComponentBodyModel: (componentBody: { name?: string, sourceStream?: string }) => { origin: string, name: string, format: string, sourceStream: string } }}
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
                sourceStream: String(componentBody.sourceStream || '')
            }
        }
    }
}

/**
 * Builds a document with one bottom-side explicit 3D body.
 * @param {{ componentIndex: number, holeDiameter: number, designator: string, pattern: string, source: string, modelName: string, modelId: string, parameters?: Record<string, unknown>, modelRotationDeg?: { x?: number, y?: number, z?: number } }} options Case options.
 * @returns {object}
 */
function buildBottomBodyDocument(options) {
    return {
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: buildBoardOutline(),
            pads: [
                {
                    componentIndex: options.componentIndex,
                    x: 250,
                    y: 200,
                    sizeBottomX: 60,
                    sizeBottomY: 80,
                    holeDiameter: options.holeDiameter,
                    hasBottomSolderMaskOpening: true
                }
            ],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                {
                    sourceStream: 'ComponentBodies6/Data',
                    layer: 'MECHANICAL13',
                    identifier: options.modelId,
                    modelId: options.modelId,
                    checksum: options.componentIndex * 101,
                    embedded: true,
                    name: options.modelName,
                    positionMil: { x: 250, y: 200 },
                    rotationDeg: 0,
                    modelRotationDeg: options.modelRotationDeg || {
                        x: 180,
                        y: 0,
                        z: 90
                    },
                    dzMil: 0
                }
            ],
            components: [
                {
                    componentIndex: options.componentIndex,
                    designator: options.designator,
                    x: 250,
                    y: 200,
                    rotation: 0,
                    layer: 'BOTTOM',
                    pattern: options.pattern,
                    source: options.source,
                    parameters: options.parameters || {},
                    height: 80
                }
            ]
        }
    }
}

/**
 * Builds a scene for one bottom-side body case.
 * @param {object} options Case options.
 * @returns {object}
 */
function buildScene(options) {
    return PcbScene3dBuilder.build(buildBottomBodyDocument(options), {
        modelRegistry: buildModelRegistry()
    })
}

/**
 * Verifies bottom-side surface-mount bodies do not keep Altium's authored
 * model half-turn after the renderer has already mirrored the mount side.
 */
test('PcbScene3dBuilder normalizes bottom surface-mount body half-turns', () => {
    const scene = buildScene({
        componentIndex: 3,
        holeDiameter: 0,
        designator: 'J3',
        pattern: 'SURFACE_CONTACTS',
        source: 'CON/SURFACE_CONTACTS',
        modelName: 'surface-body.step',
        modelId: '{MODEL-SURFACE}'
    })

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'J3')
    assert.deepEqual(scene.externalPlacements[0].modelTransform.rotationDeg, {
        x: 0,
        y: -0,
        z: 0
    })
})

/**
 * Verifies bottom-side QFN bodies keep their source-frame half-turn because
 * the source model's contact side must stay board-facing after mounting.
 */
test('PcbScene3dBuilder preserves bottom UQFN source half-turns', () => {
    const scene = buildScene({
        componentIndex: 5,
        holeDiameter: 0,
        designator: 'U5',
        pattern: 'GENERIC_UQFN16',
        source: 'GENERIC_LEVEL_TRANSLATOR',
        modelName: 'GENERIC_UQFN16.step',
        modelId: '{MODEL-UQFN}',
        modelRotationDeg: { x: 180, y: 0, z: 180 },
        parameters: {
            PackageDescription: 'Bottom-side 16-UFQFN perimeter package'
        }
    })

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'U5')
    assert.deepEqual(scene.externalPlacements[0].modelTransform.rotationDeg, {
        x: -180,
        y: -0,
        z: 0
    })
})

/**
 * Verifies bottom through-hole bodies keep their local half-turn because pin
 * tails are allowed to cross the PCB plane.
 */
test('PcbScene3dBuilder keeps bottom through-hole body half-turns', () => {
    const scene = buildScene({
        componentIndex: 4,
        holeDiameter: 30,
        designator: 'J4',
        pattern: 'PIN_HEADER',
        source: 'CON/PIN_HEADER',
        modelName: 'pin-body.step',
        modelId: '{MODEL-PIN}'
    })

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'J4')
    assert.deepEqual(scene.externalPlacements[0].modelTransform.rotationDeg, {
        x: -180,
        y: -0,
        z: 0
    })
})
