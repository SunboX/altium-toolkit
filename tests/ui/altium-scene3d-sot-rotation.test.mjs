// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a compact board outline for SOT placement tests.
 * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: object[] }}
 */
function buildBoardOutline() {
    return {
        minX: 0,
        minY: 0,
        widthMil: 1000,
        heightMil: 700,
        segments: []
    }
}

/**
 * Resolves every synthetic embedded body as a STEP model.
 * @returns {{ resolveComponentModel: () => null, resolveComponentBodyModel: (componentBody: object) => object }}
 */
function buildModelRegistry() {
    return {
        resolveComponentModel() {
            return null
        },
        resolveComponentBodyModel(componentBody) {
            return {
                origin: 'embedded',
                name: componentBody.name,
                format: 'step',
                sourceStream: 'Models/0'
            }
        }
    }
}

/**
 * Verifies compact top-side SOT23-3 pad-fallback bodies align their footprint
 * rows and apply the source-frame pin-side half-turn.
 */
test('PcbScene3dBuilder corrects compact top-side SOT23-3 pin-side yaw', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: buildBoardOutline(),
                pads: [
                    {
                        componentIndex: 1,
                        x: 454.7244,
                        y: 462.5984,
                        sizeTopX: 23.622,
                        sizeTopY: 39.3701,
                        rotation: 90,
                        hasTopPasteMaskOpening: true,
                        hasBottomPasteMaskOpening: false,
                        holeDiameter: 0
                    },
                    {
                        componentIndex: 1,
                        x: 454.7244,
                        y: 537.4016,
                        sizeTopX: 23.622,
                        sizeTopY: 39.3701,
                        rotation: 90,
                        hasTopPasteMaskOpening: true,
                        hasBottomPasteMaskOpening: false,
                        holeDiameter: 0
                    },
                    {
                        componentIndex: 1,
                        x: 545.2756,
                        y: 500,
                        sizeTopX: 23.622,
                        sizeTopY: 39.3701,
                        rotation: 90,
                        hasTopPasteMaskOpening: true,
                        hasBottomPasteMaskOpening: false,
                        holeDiameter: 0
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
                        identifier: 'SOT23-3_BODY',
                        modelId: '{FAKE-SOT-3}',
                        embedded: true,
                        name: 'sot23-3-body.step',
                        positionMil: { x: 500, y: 500 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        standoffHeightMil: -0.5,
                        overallHeightMil: 50
                    }
                ],
                components: [
                    {
                        componentIndex: 1,
                        designator: 'U1',
                        x: 500,
                        y: 500,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'SOT23-3_FAKE',
                        height: 40
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U1')
    assert.equal(placement.projection.source, 'pad-fallback')
    assert.equal(placement.rotationDeg, 270)
})

/**
 * Verifies top-side SOT23-5 pad-fallback bodies keep authored yaw when the
 * source body and footprint already use the same pin-side convention.
 */
test('PcbScene3dBuilder keeps aligned top-side SOT23-5 yaw', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: buildBoardOutline(),
                pads: [
                    {
                        componentIndex: 1,
                        x: 455,
                        y: 470,
                        sizeTopX: 24,
                        sizeTopY: 40,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 1,
                        x: 455,
                        y: 500,
                        sizeTopX: 24,
                        sizeTopY: 40,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 1,
                        x: 455,
                        y: 530,
                        sizeTopX: 24,
                        sizeTopY: 40,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 1,
                        x: 545,
                        y: 480,
                        sizeTopX: 24,
                        sizeTopY: 40,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 1,
                        x: 545,
                        y: 520,
                        sizeTopX: 24,
                        sizeTopY: 40,
                        hasTopPasteMaskOpening: true
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
                        identifier: 'SOT23-5_BODY',
                        modelId: '{FAKE-SOT-5}',
                        embedded: true,
                        name: 'sot23-5-body.step',
                        positionMil: { x: 500, y: 500 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        standoffHeightMil: 0,
                        overallHeightMil: 58
                    }
                ],
                components: [
                    {
                        componentIndex: 1,
                        designator: 'U5',
                        x: 500,
                        y: 500,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'SOT23-5_FAKE',
                        source: 'FAKE_LDO',
                        height: 40
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U5')
    assert.equal(placement.projection.source, 'pad-fallback')
    assert.equal(placement.rotationDeg, 0)
})

/**
 * Verifies bottom-side SOT523 pad-fallback bodies with a source-X long axis
 * receive a quarter-turn to put the leads on the footprint pad sides.
 */
test('PcbScene3dBuilder corrects compact bottom-side SOT523 source-X yaw', () => {
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: buildBoardOutline(),
                pads: [
                    {
                        componentIndex: 2,
                        x: 470,
                        y: 500,
                        sizeBottomX: 19.685,
                        sizeBottomY: 23.622,
                        rotation: 90,
                        hasTopPasteMaskOpening: false,
                        hasBottomPasteMaskOpening: true,
                        holeDiameter: 0
                    },
                    {
                        componentIndex: 2,
                        x: 530,
                        y: 480,
                        sizeBottomX: 19.685,
                        sizeBottomY: 23.622,
                        rotation: 90,
                        hasTopPasteMaskOpening: false,
                        hasBottomPasteMaskOpening: true,
                        holeDiameter: 0
                    },
                    {
                        componentIndex: 2,
                        x: 530,
                        y: 520,
                        sizeBottomX: 19.685,
                        sizeBottomY: 23.622,
                        rotation: 90,
                        hasTopPasteMaskOpening: false,
                        hasBottomPasteMaskOpening: true,
                        holeDiameter: 0
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
                        identifier: 'GENERIC_SOT523_SOURCE_X',
                        modelId: '{FAKE-SOT523-X}',
                        embedded: true,
                        name: 'generic-sot523-source-x.step',
                        positionMil: { x: 500, y: 500 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 31.5
                    }
                ],
                components: [
                    {
                        componentIndex: 2,
                        designator: 'Q2',
                        x: 500,
                        y: 500,
                        rotation: 180,
                        layer: 'BOTTOM',
                        pattern: 'SOT523_FAKE',
                        height: 31.5
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'Q2')
    assert.equal(placement.projection.source, 'pad-fallback')
    assert.equal(placement.rotationDeg, 90)
})
