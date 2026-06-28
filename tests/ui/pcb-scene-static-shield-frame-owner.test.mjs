// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a fake board where a static frame body is exactly anchored on a
 * nearby electrical part but belongs to the mechanical frame component.
 * @returns {object}
 */
function buildStaticFrameOwnerDocument() {
    return {
        fileName: 'static-frame-owner-fake.PcbDoc',
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
            componentBodies: [buildStaticFrameBody()],
            components: [
                {
                    componentIndex: 1,
                    designator: 'U1',
                    x: 4500,
                    y: 4500,
                    rotation: 0,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_QFN_UNIT',
                    source: 'IC_FAKE_UNIT',
                    height: 24
                },
                {
                    componentIndex: 2,
                    designator: 'M1',
                    x: 4740,
                    y: 4500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE_RFI_SHIELD_FRAME',
                    source: 'FAKE_RF_SHIELD_FRAME_UNIT',
                    height: 120
                }
            ]
        }
    }
}

/**
 * Builds one fake static shield-frame body.
 * @returns {object}
 */
function buildStaticFrameBody() {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        layer: '',
        identifier: 'Frame',
        modelId: '{00000000-0000-0000-0000-000000000901}',
        checksum: 901,
        embedded: false,
        name: '',
        positionMil: { x: 4500, y: 4500 },
        rotationDeg: 0,
        modelTypeName: 'extruded-polygon',
        overallHeightMil: 120,
        standoffHeightMil: 20,
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'complete',
            units: 'mil',
            heightMil: 100,
            standoffHeightMil: 20,
            verticesMil: [
                { x: 4420, y: 4480 },
                { x: 4580, y: 4480 },
                { x: 4580, y: 4520 },
                { x: 4420, y: 4520 }
            ]
        }
    }
}

/**
 * Builds one fake static shield-frame body in a dense scene.
 * @param {number} index Body index.
 * @returns {object}
 */
function buildDenseStaticFrameBody(index) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        layer: 'MECHANICAL13',
        identifier: 'Frame' + index,
        modelId: '{00000000-0000-0000-0000-000000001' + index + '}',
        checksum: 1000 + index,
        embedded: false,
        name: '',
        positionMil: { x: 4200 + index, y: 4500 },
        rotationDeg: 0,
        modelTypeName: 'extruded-polygon',
        overallHeightMil: 80,
        standoffHeightMil: 20,
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'complete',
            units: 'mil',
            heightMil: 60,
            standoffHeightMil: 20,
            verticesMil: [
                { x: 4185 + index, y: 4485 },
                { x: 4215 + index, y: 4485 },
                { x: 4215 + index, y: 4515 },
                { x: 4185 + index, y: 4515 }
            ]
        }
    }
}

/**
 * Builds one fake non-owner component with long neutral identity text.
 * @param {number} index Component index.
 * @returns {object}
 */
function buildDenseNeutralComponent(index) {
    return {
        componentIndex: index,
        designator: 'U' + index,
        x: 4200 + index,
        y: 4500,
        rotation: 0,
        layer: 'TOP',
        pattern: 'FAKE_SIGNAL_PACKAGE_' + index,
        source: 'neutral package identity '.repeat(8),
        description: 'ordinary assembled component '.repeat(8),
        height: 20
    }
}

/**
 * Builds a fake dense shield-frame ownership document.
 * @param {number} count Dense frame and component count.
 * @returns {object}
 */
function buildDenseStaticFrameOwnerDocument(count) {
    return {
        fileName: 'dense-static-frame-owner-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 4000,
                minY: 4000,
                widthMil: 2000,
                heightMil: 1000,
                segments: []
            },
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: Array.from({ length: count }, (_, index) =>
                buildDenseStaticFrameBody(index)
            ),
            components: [
                ...Array.from({ length: count }, (_, index) =>
                    buildDenseNeutralComponent(index)
                ),
                {
                    componentIndex: count,
                    designator: 'M1',
                    x: 4240,
                    y: 4500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE_RF_SHIELD_FRAME',
                    source: 'MECH/RF_SHIELD_FRAME',
                    height: null
                }
            ]
        }
    }
}

test('PcbScene3dBuilder assigns static frame bodies to shield-frame owners', () => {
    const scene = PcbScene3dBuilder.build(buildStaticFrameOwnerDocument())
    const placement = scene.staticBodyPlacements[0]

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(placement.selectionKey, 'M1')
    assert.equal(placement.mountSide, 'top')
    assert.ok(placement.positionMil.z > 0)
})

test('PcbScene3dBuilder resolves dense static frame owners without repeated identity scans', () => {
    const startedAt = performance.now()
    const scene = PcbScene3dBuilder.build(
        buildDenseStaticFrameOwnerDocument(120)
    )
    const elapsedMs = performance.now() - startedAt

    assert.equal(scene.staticBodyPlacements.length, 120)
    assert.ok(
        elapsedMs < 1000,
        'Expected dense static frame owner resolution under 1000ms, got ' +
            Math.round(elapsedMs) +
            'ms'
    )
})
