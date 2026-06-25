// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'
import { PcbScene3dStaticBodySelectionKeyBuilder } from '../../src/ui/PcbScene3dStaticBodySelectionKeyBuilder.mjs'

/**
 * Builds one fake static 3D body record.
 * @param {number} x Body anchor X coordinate.
 * @param {number} y Body anchor Y coordinate.
 * @param {number} width Body footprint width.
 * @param {number} depth Body footprint depth.
 * @param {string} identifier Shared body identifier.
 * @param {number} [height=20] Body height.
 * @returns {object}
 */
function buildStaticBody(x, y, width, depth, identifier, height = 20) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        layer: 'MECHANICAL13',
        identifier,
        modelId:
            '{FAKE-' +
            [x, y, width, depth].map((value) => String(value)).join('-') +
            '}',
        checksum: x + y + width + depth,
        embedded: false,
        name: '',
        positionMil: { x, y },
        rotationDeg: 0,
        modelTypeName: 'extruded-polygon',
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'complete',
            units: 'mil',
            heightMil: height,
            standoffHeightMil: 0,
            verticesMil: [
                { x: -width / 2, y: -depth / 2 },
                { x: width / 2, y: -depth / 2 },
                { x: width / 2, y: depth / 2 },
                { x: -width / 2, y: depth / 2 }
            ]
        }
    }
}

/**
 * Builds the minimal scene input for static body selection tests.
 * @param {object[]} componentBodies Static body records.
 * @param {object[]} [components] Component records.
 * @returns {object}
 */
function buildDocument(componentBodies, components = []) {
    return {
        fileName: 'static-selection-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1200,
                heightMil: 800,
                segments: []
            },
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies,
            components
        }
    }
}

test('PcbScene3dBuilder assigns instance keys to repeated static body assemblies', () => {
    const scene = PcbScene3dBuilder.build(
        buildDocument([
            buildStaticBody(300, 400, 220, 40, 'FAKE_CLIP_ASSEMBLY'),
            buildStaticBody(230, 400, 60, 20, 'FAKE_CLIP_ASSEMBLY'),
            buildStaticBody(370, 400, 60, 20, 'FAKE_CLIP_ASSEMBLY'),
            buildStaticBody(900, 400, 220, 40, 'FAKE_CLIP_ASSEMBLY'),
            buildStaticBody(830, 400, 60, 20, 'FAKE_CLIP_ASSEMBLY'),
            buildStaticBody(970, 400, 60, 20, 'FAKE_CLIP_ASSEMBLY')
        ])
    )

    assert.equal(scene.staticBodyPlacements.length, 6)
    assert.deepEqual(
        new Set(
            scene.staticBodyPlacements.map((placement) => placement.designator)
        ),
        new Set(['FAKE_CLIP_ASSEMBLY'])
    )

    const leftKeys = new Set(
        scene.staticBodyPlacements
            .filter((placement) => placement.bodyPositionMil.x < 600)
            .map((placement) => placement.selectionKey)
    )
    const rightKeys = new Set(
        scene.staticBodyPlacements
            .filter((placement) => placement.bodyPositionMil.x > 600)
            .map((placement) => placement.selectionKey)
    )

    assert.equal(leftKeys.size, 1)
    assert.equal(rightKeys.size, 1)
    assert.notEqual([...leftKeys][0], [...rightKeys][0])
    assert.notEqual([...leftKeys][0], 'FAKE_CLIP_ASSEMBLY')
    assert.notEqual([...rightKeys][0], 'FAKE_CLIP_ASSEMBLY')
})

test('PcbScene3dBuilder keeps unique static body designators selectable', () => {
    const scene = PcbScene3dBuilder.build(
        buildDocument([
            buildStaticBody(300, 400, 220, 40, 'FAKE_UNIQUE_BRACKET')
        ])
    )

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(
        scene.staticBodyPlacements[0].designator,
        'FAKE_UNIQUE_BRACKET'
    )
    assert.equal(
        scene.staticBodyPlacements[0].selectionKey,
        'FAKE_UNIQUE_BRACKET'
    )
})

test('Static body selection keys promote matched owners across sibling bodies', () => {
    const placements = PcbScene3dStaticBodySelectionKeyBuilder.assign([
        {
            placement: buildSelectionPlacement(
                'MECH1',
                300,
                400,
                220,
                40,
                'FAKE_SHARED_BODY_KIND'
            ),
            matchedComponent: { designator: 'MECH1' }
        },
        {
            placement: buildSelectionPlacement(
                'FAKE_SHARED_BODY_KIND',
                230,
                400,
                60,
                20,
                'FAKE_SHARED_BODY_KIND'
            ),
            matchedComponent: null
        },
        {
            placement: buildSelectionPlacement(
                'FAKE_SHARED_BODY_KIND',
                370,
                400,
                60,
                20,
                'FAKE_SHARED_BODY_KIND'
            ),
            matchedComponent: null
        }
    ])

    assert.deepEqual(
        placements.map((placement) => placement.selectionKey),
        ['MECH1', 'MECH1', 'MECH1']
    )
})

test('Static body selection keys keep nearby separated package cores distinct', () => {
    const placements = PcbScene3dStaticBodySelectionKeyBuilder.assign([
        {
            placement: buildSelectionPlacement(
                'R1',
                500,
                500,
                12,
                14,
                'FAKE_SHARED_CORE'
            ),
            matchedComponent: { designator: 'R1' }
        },
        {
            placement: buildSelectionPlacement(
                '3D body',
                525.4,
                500,
                12,
                14,
                'FAKE_SHARED_CORE'
            ),
            matchedComponent: null
        }
    ])

    assert.equal(placements[0].selectionKey, 'R1')
    assert.notEqual(placements[1].selectionKey, 'R1')
})

test('Static body selection keys promote matched owners across touching mixed fragments', () => {
    const placements = PcbScene3dStaticBodySelectionKeyBuilder.assign([
        {
            placement: buildSelectionPlacement(
                '3D body',
                500,
                490,
                12,
                6,
                'FAKE_TERMINAL_KIND'
            ),
            matchedComponent: null
        },
        {
            placement: buildSelectionPlacement(
                'R1',
                500,
                500,
                12,
                14,
                'FAKE_CORE_KIND'
            ),
            matchedComponent: { designator: 'R1' }
        },
        {
            placement: buildSelectionPlacement(
                '3D body',
                500,
                510,
                12,
                6,
                'FAKE_TERMINAL_KIND'
            ),
            matchedComponent: null
        }
    ])

    assert.deepEqual(
        placements.map((placement) => placement.selectionKey),
        ['R1', 'R1', 'R1']
    )
})

test('Static body selection keys keep unique cluster display designators', () => {
    const placements = PcbScene3dStaticBodySelectionKeyBuilder.assign([
        {
            placement: buildSelectionPlacement(
                'C1',
                500,
                500,
                8,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U1' }
        },
        {
            placement: buildSelectionPlacement(
                'C1',
                510,
                500,
                8,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U2' }
        },
        {
            placement: buildSelectionPlacement(
                'R2',
                700,
                500,
                8,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U3' }
        },
        {
            placement: buildSelectionPlacement(
                'R2',
                710,
                500,
                8,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U4' }
        }
    ])

    assert.deepEqual(
        placements.map((placement) => placement.selectionKey),
        ['C1', 'C1', 'R2', 'R2']
    )
})

test('Static body selection keys split ambiguous touching display clusters', () => {
    const placements = PcbScene3dStaticBodySelectionKeyBuilder.assign([
        {
            placement: buildSelectionPlacement(
                'C1',
                500,
                500,
                12,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U1' }
        },
        {
            placement: buildSelectionPlacement(
                'R2',
                510,
                500,
                12,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U2' }
        },
        {
            placement: buildSelectionPlacement(
                'C1',
                520,
                500,
                12,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U3' }
        },
        {
            placement: buildSelectionPlacement(
                'R2',
                530,
                500,
                12,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U4' }
        },
        {
            placement: buildSelectionPlacement(
                'D3',
                700,
                500,
                12,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U5' }
        },
        {
            placement: buildSelectionPlacement(
                'D3',
                710,
                500,
                12,
                12,
                'FAKE_SHARED_TERMINAL'
            ),
            matchedComponent: { designator: 'U6' }
        }
    ])

    assert.deepEqual(
        placements.map((placement) => placement.selectionKey),
        ['C1', 'R2', 'C1', 'R2', 'D3', 'D3']
    )
})

/**
 * Builds a static placement row for selection-key unit tests.
 * @param {string} designator Display designator.
 * @param {number} x Placement X coordinate.
 * @param {number} y Placement Y coordinate.
 * @param {number} width Body width.
 * @param {number} depth Body depth.
 * @param {string} sourceIdentityKey Shared source identity key.
 * @returns {object}
 */
function buildSelectionPlacement(
    designator,
    x,
    y,
    width,
    depth,
    sourceIdentityKey
) {
    return {
        designator,
        sourceIdentityKey,
        mountSide: 'top',
        positionMil: { x, y },
        geometry: {
            verticesMil: [
                { x: -width / 2, y: -depth / 2 },
                { x: width / 2, y: -depth / 2 },
                { x: width / 2, y: depth / 2 },
                { x: -width / 2, y: depth / 2 }
            ]
        }
    }
}
