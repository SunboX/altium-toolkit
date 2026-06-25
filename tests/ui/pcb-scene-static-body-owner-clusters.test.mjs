// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a fake board with compact chip bodies touching as one long cluster.
 * @returns {object}
 */
function buildTouchingChipChainDocument() {
    const centers = [5000, 5022, 5044]

    return {
        fileName: 'static-touching-chip-chain-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 4900,
                minY: 4900,
                widthMil: 300,
                heightMil: 200,
                segments: []
            },
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: centers.flatMap((x) => [
                buildSourceFragmentBody(x - 9.25, 5000, 5, 12, 950),
                buildSourceFragmentBody(x, 5000, 14, 12, 951),
                buildSourceFragmentBody(x + 9.25, 5000, 5, 12, 950)
            ]),
            components: centers.map((x, index) => ({
                componentIndex: index,
                designator: 'R' + String(50 + index),
                x,
                y: 5000,
                rotation: 0,
                layer: 'TOP',
                pattern: 'FAKE0201',
                source: 'PASSIVE_FAKE_UNIT',
                height: 10
            }))
        }
    }
}

/**
 * Builds one fake source-coordinate static fragment.
 * @param {number} x Fragment center X coordinate.
 * @param {number} y Fragment center Y coordinate.
 * @param {number} width Fragment width.
 * @param {number} depth Fragment depth.
 * @param {number} id Stable fake identity suffix.
 * @returns {object}
 */
function buildSourceFragmentBody(x, y, width, depth, id) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        layer: '',
        identifier: '',
        modelId:
            '{00000000-0000-0000-0000-' + String(id).padStart(12, '0') + '}',
        checksum: id,
        embedded: false,
        name: '',
        positionMil: { x, y },
        rotationDeg: 0,
        modelTypeName: 'extruded-polygon',
        overallHeightMil: 10,
        standoffHeightMil: 0,
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'complete',
            units: 'mil',
            heightMil: 10,
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

test('PcbScene3dBuilder keeps touching chip chains on their center owners', () => {
    const scene = PcbScene3dBuilder.build(buildTouchingChipChainDocument())

    assert.deepEqual(
        ['R50', 'R51', 'R52'].map(
            (designator) =>
                scene.staticBodyPlacements.filter(
                    (placement) => placement.selectionKey === designator
                ).length
        ),
        [3, 3, 3]
    )
})
