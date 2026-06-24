// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a minimal fake board outline.
 * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: object[] }}
 */
function buildBoardOutline() {
    return {
        minX: 0,
        minY: 0,
        widthMil: 1000,
        heightMil: 1000,
        segments: []
    }
}

/**
 * Builds a minimal fake static body document.
 * @returns {object}
 */
function buildDocument() {
    return {
        fileName: 'static-owner-fake.PcbDoc',
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
                    layer: '',
                    identifier: '',
                    modelId: '{00000000-0000-0000-0000-000000000101}',
                    checksum: 101,
                    embedded: false,
                    name: '',
                    positionMil: { x: 500, y: 500 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    overallHeightMil: 40,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'complete',
                        units: 'mil',
                        heightMil: 40,
                        standoffHeightMil: 0,
                        verticesMil: [
                            { x: -120, y: -90 },
                            { x: 120, y: -90 },
                            { x: 120, y: 90 },
                            { x: -120, y: 90 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'U9',
                    x: 500,
                    y: 500,
                    rotation: 90,
                    layer: 'BOTTOM',
                    pattern: 'QFN_FAKE_28',
                    source: 'IO_FAKE_CORE',
                    height: 40
                },
                {
                    componentIndex: 1,
                    designator: 'Y1',
                    x: 530,
                    y: 500,
                    rotation: 270,
                    layer: 'TOP',
                    pattern: 'CLOCK_FAKE_UNIT',
                    source: 'TCXO_FAKE_UNIT',
                    height: 40
                }
            ]
        }
    }
}

test('PcbScene3dBuilder keeps exact static bodies on their component side', () => {
    const scene = PcbScene3dBuilder.build(buildDocument())

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(scene.staticBodyPlacements[0].designator, 'U9')
    assert.equal(scene.staticBodyPlacements[0].mountSide, 'bottom')
    assert.deepEqual(scene.staticBodyPlacements[0].positionMil, {
        x: 0,
        y: 0,
        z: -51.5
    })
})
