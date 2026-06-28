// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a fake board outline around source-coordinate package geometry.
 * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: object[] }}
 */
function buildBoardOutline() {
    return {
        minX: 4000,
        minY: 4000,
        widthMil: 1000,
        heightMil: 1000,
        segments: []
    }
}

/**
 * Builds one fake top-side BGA pad.
 * @param {number} x Pad X coordinate.
 * @param {number} y Pad Y coordinate.
 * @returns {object}
 */
function buildTopBallPad(x, y) {
    return {
        componentIndex: 7,
        x,
        y,
        sizeTopX: 8,
        sizeTopY: 8,
        sizeMidX: 8,
        sizeMidY: 8,
        sizeBottomX: 8,
        sizeBottomY: 8,
        holeDiameter: 0,
        hasTopPasteMaskOpening: true,
        hasBottomPasteMaskOpening: false
    }
}

/**
 * Builds one source sphere body at a solder-ball pad center.
 * @param {number} x Body X coordinate.
 * @param {number} y Body Y coordinate.
 * @param {number} index Stable synthetic body index.
 * @returns {object}
 */
function buildBallBody(x, y, index) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        layer: index % 2 === 0 ? 'MECHANICAL13' : '',
        identifier: 'Ball',
        modelId:
            '{00000000-0000-0000-0000-' + String(index).padStart(12, '0') + '}',
        checksum: index,
        embedded: false,
        name: '',
        positionMil: { x, y },
        rotationDeg: 0,
        modelTypeName: 'sphere',
        overallHeightMil: 8,
        standoffHeightMil: index % 2 === 0 ? 0 : -2,
        staticGeometry: {
            kind: 'sphere',
            status: 'complete',
            units: 'mil',
            radiusMil: 5,
            standoffHeightMil: index % 2 === 0 ? 0 : -2
        }
    }
}

/**
 * Builds a fake top-side BGA whose solder balls carry only generic body names.
 * @returns {object}
 */
function buildTopBallGridDocument() {
    const centerX = 4500
    const centerY = 4500
    const offsets = [-16, 0, 16]
    const positions = offsets.flatMap((y) =>
        offsets.map((x) => ({ x: centerX + x, y: centerY + y }))
    )

    return {
        fileName: 'static-ball-pad-owner-fake.PcbDoc',
        pcb: {
            boardOutline: buildBoardOutline(),
            pads: positions.map((position) =>
                buildTopBallPad(position.x, position.y)
            ),
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: positions.map((position, index) =>
                buildBallBody(position.x, position.y, index + 1)
            ),
            components: [
                {
                    componentIndex: 7,
                    designator: 'U7',
                    x: centerX,
                    y: centerY,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE_9DSBGA',
                    source: 'FAKE_POWER_BGA',
                    height: 60
                }
            ]
        }
    }
}

test('PcbScene3dBuilder places generic solder-ball static bodies on their pad owner', () => {
    const scene = PcbScene3dBuilder.build(buildTopBallGridDocument())

    assert.equal(scene.staticBodyPlacements.length, 9)
    assert.deepEqual(
        scene.staticBodyPlacements.map((placement) => placement.selectionKey),
        Array.from({ length: 9 }, () => 'U7')
    )
    assert.deepEqual(
        scene.staticBodyPlacements.map((placement) => placement.mountSide),
        Array.from({ length: 9 }, () => 'top')
    )
    assert.ok(
        scene.staticBodyPlacements.every(
            (placement) => placement.positionMil.z > 0
        )
    )
})
