// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a fake board with a centered source-coordinate static body whose
 * opaque body label does not identify the owning passive component.
 * @returns {object}
 */
function buildCenteredSourceBodyDocument() {
    return {
        fileName: 'static-centered-owner-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 4000,
                minY: 4000,
                widthMil: 1000,
                heightMil: 1000,
                segments: []
            },
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: 'MECHANICAL15',
                    identifier: 'KXQBT',
                    modelId: '{00000000-0000-0000-0000-000000000951}',
                    checksum: 951,
                    embedded: false,
                    name: '',
                    positionMil: { x: 4500, y: 4500 },
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
                            { x: 4448, y: 4458 },
                            { x: 4552, y: 4458 },
                            { x: 4552, y: 4542 },
                            { x: 4448, y: 4542 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 7,
                    designator: 'L7',
                    x: 4500,
                    y: 4500,
                    rotation: 180,
                    layer: 'BOTTOM',
                    pattern: 'FAKE2520',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 40
                },
                {
                    componentIndex: 8,
                    designator: 'U8',
                    x: 4540,
                    y: 4500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE_QFN_UNIT',
                    source: 'IC_FAKE_UNIT',
                    height: 40
                }
            ]
        }
    }
}

test('PcbScene3dBuilder assigns centered source-coordinate static bodies to exact bottom owners', () => {
    const scene = PcbScene3dBuilder.build(buildCenteredSourceBodyDocument())
    const placement = scene.staticBodyPlacements[0]

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(placement.selectionKey, 'L7')
    assert.equal(placement.mountSide, 'bottom')
    assert.ok(placement.positionMil.z < 0)
})
