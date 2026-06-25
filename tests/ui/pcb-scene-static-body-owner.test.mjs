// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'
import { PcbScene3dStaticBodyOwnerPromotion } from '../../src/ui/PcbScene3dStaticBodyOwnerPromotion.mjs'

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

/**
 * Builds a fake board with a rotated owner and a source-coordinate static body.
 * @returns {object}
 */
function buildSourceCoordinateBodyDocument() {
    return {
        fileName: 'static-source-coordinate-fake.PcbDoc',
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
                    layer: '',
                    identifier: '',
                    modelId: '{00000000-0000-0000-0000-000000000202}',
                    checksum: 202,
                    embedded: false,
                    name: '',
                    positionMil: { x: 4500, y: 4490 },
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
                            { x: 4506, y: 4487 },
                            { x: 4494, y: 4487 },
                            { x: 4494, y: 4493 },
                            { x: 4506, y: 4493 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 7,
                    designator: 'C7',
                    x: 4500,
                    y: 4500,
                    rotation: 90,
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
 * Builds a fake bottom-side source-coordinate static body.
 * @returns {object}
 */
function buildBottomSourceCoordinateBodyDocument() {
    return {
        fileName: 'static-bottom-source-coordinate-fake.PcbDoc',
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
                buildRotatedSourceFragmentBody(4500, 4500, 20, 8, 45, 203)
            ],
            components: [
                {
                    componentIndex: 8,
                    designator: 'R8',
                    x: 4500,
                    y: 4500,
                    rotation: 45,
                    layer: 'BOTTOM',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                }
            ]
        }
    }
}

/**
 * Builds a fake promoted bottom-side source-coordinate static body.
 * @returns {object}
 */
function buildPromotedBottomSourceCoordinateBodyDocument() {
    return {
        fileName: 'static-promoted-bottom-source-coordinate-fake.PcbDoc',
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
                buildRotatedSourceFragmentBody(4500, 4500, 20, 8, 45, 205),
                buildRotatedSourceFragmentBody(4508, 4508, 20, 8, 45, 204)
            ],
            components: [
                {
                    componentIndex: 9,
                    designator: 'R9',
                    x: 4500,
                    y: 4500,
                    rotation: 45,
                    layer: 'BOTTOM',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                }
            ]
        }
    }
}

/**
 * Builds a fake bottom-side passive from layerless touching static fragments.
 * @returns {object}
 */
function buildBottomLayerlessFragmentDocument() {
    return {
        fileName: 'static-bottom-fragments-fake.PcbDoc',
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
                buildSourceFragmentBody(4500, 4490, 12, 6, 303),
                buildSourceFragmentBody(4500, 4500, 12, 14, 304),
                buildSourceFragmentBody(4500, 4510, 12, 6, 305)
            ],
            components: [
                {
                    componentIndex: 8,
                    designator: 'R8',
                    x: 4500,
                    y: 4500,
                    rotation: 270,
                    layer: 'BOTTOM',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                }
            ]
        }
    }
}

/**
 * Builds a fake bottom-side passive whose edge fragment is closer to a top
 * neighbor than to the passive center.
 * @returns {object}
 */
function buildBottomSymmetricFragmentNeighborDocument() {
    return {
        fileName: 'static-bottom-fragment-neighbor-fake.PcbDoc',
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
                buildSourceFragmentBody(4500, 4490, 12, 6, 331),
                buildSourceFragmentBody(4500, 4500, 12, 14, 332),
                buildSourceFragmentBody(4500, 4510, 12, 6, 331)
            ],
            components: [
                {
                    componentIndex: 18,
                    designator: 'R18',
                    x: 4500,
                    y: 4500,
                    rotation: 270,
                    layer: 'BOTTOM',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                },
                {
                    componentIndex: 19,
                    designator: 'U19',
                    x: 4506,
                    y: 4510,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE_SOT',
                    source: 'IC_FAKE_UNIT',
                    height: 40
                }
            ]
        }
    }
}

/**
 * Builds a fake bottom-side passive from separated generic fragments.
 * @returns {object}
 */
function buildBottomGenericGuidFragmentDocument() {
    return {
        fileName: 'static-bottom-guid-fragments-fake.PcbDoc',
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
                buildSourceFragmentBody(4500, 4490, 12, 6, 401),
                buildSourceFragmentBody(4500, 4510, 12, 6, 402)
            ],
            components: [
                {
                    componentIndex: 9,
                    designator: 'R9',
                    x: 4500,
                    y: 4500,
                    rotation: 270,
                    layer: 'BOTTOM',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                }
            ]
        }
    }
}

/**
 * Builds a fake bottom-side static body directly under a top-side component.
 * @returns {object}
 */
function buildBottomStaticBodyNearTopOwnerDocument() {
    return {
        fileName: 'static-bottom-near-top-owner-fake.PcbDoc',
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
                    layer: 'MECHANICAL2',
                    identifier: 'BOTTOM_FAKE_CLIP',
                    modelId: '{00000000-0000-0000-0000-000000000451}',
                    checksum: 451,
                    embedded: false,
                    name: '',
                    positionMil: { x: 500, y: 500 },
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
                            { x: -6, y: -6 },
                            { x: 6, y: -6 },
                            { x: 6, y: 6 },
                            { x: -6, y: 6 }
                        ]
                    }
                }
            ],
            components: [
                {
                    componentIndex: 11,
                    designator: 'U11',
                    x: 500,
                    y: 500,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE_QFN',
                    source: 'IC_FAKE_UNIT',
                    height: 40
                }
            ]
        }
    }
}

/**
 * Builds a fake owner with one complete and one unrelated incomplete body.
 * @returns {object}
 */
function buildMismatchedIncompleteBodyDocument() {
    return {
        fileName: 'static-mismatched-body-fake.PcbDoc',
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
                    modelId: '{00000000-0000-0000-0000-000000000501}',
                    checksum: 501,
                    embedded: false,
                    name: '',
                    positionMil: { x: 504, y: 500 },
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
                            { x: 498, y: 494 },
                            { x: 510, y: 494 },
                            { x: 510, y: 506 },
                            { x: 498, y: 506 }
                        ]
                    }
                },
                {
                    sourceStream: 'ShapeBasedComponentBodies6/Data',
                    layer: '',
                    identifier: '',
                    modelId: '{00000000-0000-0000-0000-000000000502}',
                    checksum: 502,
                    embedded: false,
                    name: '',
                    positionMil: { x: 500, y: 500 },
                    rotationDeg: 0,
                    modelTypeName: 'extruded-polygon',
                    overallHeightMil: 10,
                    standoffHeightMil: 0,
                    staticGeometry: {
                        kind: 'extruded-polygon',
                        status: 'incomplete',
                        units: 'mil',
                        heightMil: 10,
                        standoffHeightMil: 0
                    }
                }
            ],
            components: [
                {
                    componentIndex: 10,
                    designator: 'R10',
                    x: 500,
                    y: 500,
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
 * Builds a fake passive family where a second instance has missing static
 * vertices for the same anonymous body model IDs.
 * @returns {object}
 */
function buildRepeatedAnonymousModelDocument() {
    return {
        fileName: 'static-repeated-anonymous-fake.PcbDoc',
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
                buildSourceFragmentBody(4300, 4300, 14, 12, 701),
                buildSourceFragmentBody(4290, 4300, 5, 12, 702),
                buildSourceFragmentBody(4310, 4300, 5, 12, 702),
                buildIncompleteSourceBody(4600, 4300, 701),
                buildIncompleteSourceBody(4590, 4300, 702),
                buildBodyWithoutStaticGeometry(4610, 4300, 702)
            ],
            components: [
                {
                    componentIndex: 20,
                    designator: 'R20',
                    x: 4300,
                    y: 4300,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                },
                {
                    componentIndex: 21,
                    designator: 'R21',
                    x: 4600,
                    y: 4300,
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
 * Builds a compact anonymous cluster that should be owned by the component at
 * its cluster center, even when one edge fragment is nearer to a neighbor.
 * @returns {object}
 */
function buildClusterCenterOwnerDocument() {
    return {
        fileName: 'static-cluster-center-owner-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 4800,
                minY: 4800,
                widthMil: 400,
                heightMil: 400,
                segments: []
            },
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [
                buildSourceFragmentBody(4990, 5000, 5, 12, 803),
                buildSourceFragmentBody(5000, 5000, 14, 12, 804),
                buildSourceFragmentBody(5010, 5000, 5, 12, 803),
                buildRotatedSourceFragmentBody(5004, 4996, 12, 12, 45, 801),
                buildRotatedSourceFragmentBody(5010, 4990, 12, 12, 45, 802),
                buildRotatedSourceFragmentBody(5016, 4984, 12, 12, 45, 801)
            ],
            components: [
                {
                    componentIndex: 30,
                    designator: 'R30',
                    x: 5000,
                    y: 5000,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                },
                {
                    componentIndex: 31,
                    designator: 'C31',
                    x: 5010,
                    y: 4990,
                    rotation: 135,
                    layer: 'BOTTOM',
                    pattern: 'FAKE0201',
                    source: 'PASSIVE_FAKE_UNIT',
                    height: 10
                }
            ]
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

/**
 * Builds one fake rotated source-coordinate static fragment.
 * @param {number} x Fragment center X coordinate.
 * @param {number} y Fragment center Y coordinate.
 * @param {number} width Fragment width before rotation.
 * @param {number} depth Fragment depth before rotation.
 * @param {number} rotationDeg Rotation in degrees.
 * @param {number} id Stable fake identity suffix.
 * @returns {object}
 */
function buildRotatedSourceFragmentBody(x, y, width, depth, rotationDeg, id) {
    const angleRad = (rotationDeg * Math.PI) / 180
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)
    const verticesMil = [
        { x: -width / 2, y: -depth / 2 },
        { x: width / 2, y: -depth / 2 },
        { x: width / 2, y: depth / 2 },
        { x: -width / 2, y: depth / 2 }
    ].map((vertex) => ({
        x: x + vertex.x * cos - vertex.y * sin,
        y: y + vertex.x * sin + vertex.y * cos
    }))

    return {
        ...buildSourceFragmentBody(x, y, width, depth, id),
        staticGeometry: {
            ...buildSourceFragmentBody(x, y, width, depth, id).staticGeometry,
            verticesMil
        }
    }
}

/**
 * Builds one incomplete source-coordinate extruded polygon row.
 * @param {number} x Body anchor X coordinate.
 * @param {number} y Body anchor Y coordinate.
 * @param {number} id Stable fake identity suffix.
 * @returns {object}
 */
function buildIncompleteSourceBody(x, y, id) {
    return {
        ...buildBodyWithoutStaticGeometry(x, y, id),
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'incomplete',
            units: 'mil',
            heightMil: 10,
            standoffHeightMil: 0
        }
    }
}

/**
 * Builds one anonymous extruded polygon row that has no parsed vertex payload.
 * @param {number} x Body anchor X coordinate.
 * @param {number} y Body anchor Y coordinate.
 * @param {number} id Stable fake identity suffix.
 * @returns {object}
 */
function buildBodyWithoutStaticGeometry(x, y, id) {
    return {
        sourceStream: 'ComponentBodies6/Data',
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
        bodyOpacity: 1
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

test('PcbScene3dBuilder preserves source-coordinate static body orientation', () => {
    const scene = PcbScene3dBuilder.build(buildSourceCoordinateBodyDocument())
    const placement = scene.staticBodyPlacements[0]

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(placement.designator, 'C7')
    assert.equal(placement.rotationDeg, 0)
    assert.deepEqual(placement.geometry.verticesMil, [
        { x: 6, y: -3 },
        { x: -6, y: -3 },
        { x: -6, y: 3 },
        { x: 6, y: 3 }
    ])
})

test('PcbScene3dBuilder preserves bottom source-coordinate static body world orientation', () => {
    const scene = PcbScene3dBuilder.build(
        buildBottomSourceCoordinateBodyDocument()
    )
    const placement = scene.staticBodyPlacements[0]

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(placement.designator, 'R8')
    assert.equal(placement.mountSide, 'bottom')
    assert.equal(placement.rotationDeg, 0)
    assert.deepEqual(placement.geometry.verticesMil, [
        { x: -4.2426, y: 9.8995 },
        { x: 9.8995, y: -4.2426 },
        { x: 4.2426, y: -9.8995 },
        { x: -9.8995, y: 4.2426 }
    ])
})

test('PcbScene3dBuilder preserves promoted bottom source-coordinate static body world orientation', () => {
    const scene = PcbScene3dBuilder.build(
        buildPromotedBottomSourceCoordinateBodyDocument()
    )
    const placement = scene.staticBodyPlacements.find(
        (candidate) =>
            candidate.bodyPositionMil.x === 4508 &&
            candidate.bodyPositionMil.y === 4508
    )

    assert.equal(scene.staticBodyPlacements.length, 2)
    assert.equal(placement?.selectionKey, 'R9')
    assert.equal(placement?.mountSide, 'bottom')
    assert.equal(placement?.rotationDeg, 0)
    assert.deepEqual(placement?.geometry.verticesMil, [
        { x: -4.2426, y: 9.8995 },
        { x: 9.8995, y: -4.2426 },
        { x: 4.2426, y: -9.8995 },
        { x: -9.8995, y: 4.2426 }
    ])
})

test('PcbScene3dBuilder keeps touching layerless fragments on a bottom owner', () => {
    const scene = PcbScene3dBuilder.build(
        buildBottomLayerlessFragmentDocument()
    )
    const placements = scene.staticBodyPlacements.sort(
        (left, right) => left.bodyPositionMil.y - right.bodyPositionMil.y
    )

    assert.equal(placements.length, 3)
    assert.deepEqual(
        placements.map((placement) => placement.selectionKey),
        ['R8', 'R8', 'R8']
    )
    assert.deepEqual(
        placements.map((placement) => placement.mountSide),
        ['bottom', 'bottom', 'bottom']
    )
    assert.ok(placements.every((placement) => placement.positionMil.z < 0))
})

test('PcbScene3dBuilder keeps symmetric bottom fragments with their center owner', () => {
    const scene = PcbScene3dBuilder.build(
        buildBottomSymmetricFragmentNeighborDocument()
    )
    const placements = scene.staticBodyPlacements.sort(
        (left, right) => left.bodyPositionMil.y - right.bodyPositionMil.y
    )

    assert.equal(placements.length, 3)
    assert.deepEqual(
        placements.map((placement) => placement.selectionKey),
        ['R18', 'R18', 'R18']
    )
    assert.deepEqual(
        placements.map((placement) => placement.mountSide),
        ['bottom', 'bottom', 'bottom']
    )
    assert.ok(placements.every((placement) => placement.positionMil.z < 0))
})

test('PcbScene3dBuilder skips incomplete bodies with a different model identity', () => {
    const scene = PcbScene3dBuilder.build(
        buildMismatchedIncompleteBodyDocument()
    )

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(scene.staticBodyPlacements[0].selectionKey, 'R10')
    assert.equal(
        scene.staticBodyPlacements[0].sourceIdentityKey,
        '{00000000-0000-0000-0000-000000000501}'
    )
})

test('PcbScene3dBuilder recovers repeated anonymous static model geometry', () => {
    const scene = PcbScene3dBuilder.build(buildRepeatedAnonymousModelDocument())
    const recovered = scene.staticBodyPlacements
        .filter((placement) => placement.selectionKey === 'R21')
        .sort((left, right) => left.bodyPositionMil.x - right.bodyPositionMil.x)

    assert.equal(recovered.length, 3)
    assert.deepEqual(
        recovered.map((placement) => placement.bodyPositionMil.x),
        [4590, 4600, 4610]
    )
    assert.deepEqual(
        recovered.map((placement) =>
            Math.max(
                ...placement.geometry.verticesMil.map((vertex) =>
                    Math.abs(vertex.x)
                )
            )
        ),
        [2.5, 7, 2.5]
    )
})

test('PcbScene3dBuilder assigns compact clusters by their center owner', () => {
    const scene = PcbScene3dBuilder.build(buildClusterCenterOwnerDocument())
    const clusterPlacements = scene.staticBodyPlacements.filter(
        (placement) =>
            [5004, 5010, 5016].includes(placement.bodyPositionMil.x) &&
            placement.bodyPositionMil.y < 5000
    )
    const neighborPlacements = scene.staticBodyPlacements.filter(
        (placement) =>
            [4990, 5000, 5010].includes(placement.bodyPositionMil.x) &&
            placement.bodyPositionMil.y === 5000
    )

    assert.equal(clusterPlacements.length, 3)
    assert.deepEqual(
        new Set(clusterPlacements.map((placement) => placement.selectionKey)),
        new Set(['C31'])
    )
    assert.deepEqual(
        new Set(clusterPlacements.map((placement) => placement.mountSide)),
        new Set(['bottom'])
    )
    assert.deepEqual(
        new Set(neighborPlacements.map((placement) => placement.selectionKey)),
        new Set(['R30'])
    )
})

test('PcbScene3dBuilder keeps nearest generic fragments on a bottom owner', () => {
    const scene = PcbScene3dBuilder.build(
        buildBottomGenericGuidFragmentDocument()
    )
    const placements = scene.staticBodyPlacements.sort(
        (left, right) => left.bodyPositionMil.y - right.bodyPositionMil.y
    )

    assert.equal(placements.length, 2)
    assert.deepEqual(
        placements.map((placement) => placement.selectionKey),
        ['R9', 'R9']
    )
    assert.deepEqual(
        placements.map((placement) => placement.mountSide),
        ['bottom', 'bottom']
    )
    assert.ok(placements.every((placement) => placement.positionMil.z < 0))
})

test('PcbScene3dBuilder keeps bottom static bodies off top-side nearest owners', () => {
    const scene = PcbScene3dBuilder.build(
        buildBottomStaticBodyNearTopOwnerDocument()
    )
    const placement = scene.staticBodyPlacements[0]

    assert.equal(scene.staticBodyPlacements.length, 1)
    assert.equal(placement.selectionKey, 'BOTTOM_FAKE_CLIP')
    assert.equal(placement.mountSide, 'bottom')
    assert.ok(placement.positionMil.z < 0)
})

test('PcbScene3dStaticBodyOwnerPromotion updates display designators for promoted clusters', () => {
    const owner = { designator: 'R40', layer: 'BOTTOM' }
    const placementRows = [
        {
            matchedComponent: owner,
            placement: {
                designator: 'R40',
                mountSide: 'bottom',
                positionMil: { x: 0, y: 0, z: -10 },
                bodyPositionMil: { x: 0, y: 0 },
                geometry: {
                    verticesMil: [
                        { x: -6, y: -6 },
                        { x: 6, y: -6 },
                        { x: 6, y: 6 },
                        { x: -6, y: 6 }
                    ]
                }
            }
        },
        {
            matchedComponent: owner,
            placement: {
                designator: 'U41',
                mountSide: 'bottom',
                positionMil: { x: 0, y: 12, z: -10 },
                bodyPositionMil: { x: 0, y: 12 },
                geometry: {
                    verticesMil: [
                        { x: -6, y: -6 },
                        { x: 6, y: -6 },
                        { x: 6, y: 6 },
                        { x: -6, y: 6 }
                    ]
                }
            }
        }
    ]

    PcbScene3dStaticBodyOwnerPromotion.promote(placementRows, [])

    assert.deepEqual(
        placementRows.map((row) => row.placement.designator),
        ['R40', 'R40']
    )
})
