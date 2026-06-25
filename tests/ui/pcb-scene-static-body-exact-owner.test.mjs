// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a fake board where a named package sub-body sits exactly on a
 * bottom-side owner while a top-side neighbor is nearby.
 * @returns {object}
 */
function buildExactNamedSubBodyDocument() {
    return {
        fileName: 'static-named-sub-body-fake.PcbDoc',
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
                buildNamedSourceFragmentBody('Plastic', 4500, 4500, 40, 56)
            ],
            components: [
                {
                    componentIndex: 7,
                    designator: 'U7',
                    x: 4500,
                    y: 4500,
                    rotation: 0,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_SWITCH_UNIT',
                    source: 'IC_FAKE_UNIT',
                    height: 16
                },
                {
                    componentIndex: 8,
                    designator: 'R8',
                    x: 4518,
                    y: 4500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                }
            ]
        }
    }
}

/**
 * Builds one named source-coordinate static package fragment.
 * @param {string} identifier Body identity.
 * @param {number} x Fragment center X coordinate.
 * @param {number} y Fragment center Y coordinate.
 * @param {number} width Fragment width.
 * @param {number} depth Fragment depth.
 * @returns {object}
 */
function buildNamedSourceFragmentBody(identifier, x, y, width, depth) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        layer: 'MECHANICAL13',
        identifier,
        modelId: '{00000000-0000-0000-0000-000000000777}',
        checksum: 777,
        embedded: false,
        name: '',
        positionMil: { x, y },
        rotationDeg: 0,
        modelTypeName: 'extruded-polygon',
        overallHeightMil: 16,
        standoffHeightMil: 0,
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'complete',
            units: 'mil',
            heightMil: 16,
            standoffHeightMil: 0,
            verticesMil: [
                { x: x - width / 2, y: y - depth / 2 },
                { x: x + width / 2, y: y - depth / 2 },
                { x: x + width / 2, y: y + depth / 2 },
                { x: x - width / 2, y: y + depth / 2 }
            ]
        }
    }
}

test('PcbScene3dBuilder keeps exact named static sub-bodies on their component side', () => {
    const scene = PcbScene3dBuilder.build(buildExactNamedSubBodyDocument())
    const placement = scene.staticBodyPlacements[0]

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(placement.designator, 'U7')
    assert.equal(placement.selectionKey, 'U7')
    assert.equal(placement.mountSide, 'bottom')
    assert.ok(placement.positionMil.z < 0)
})
