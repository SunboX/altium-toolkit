import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a raster-like stair-step outline around a nominal square board.
 * @returns {object[]}
 */
function createStairStepSegments() {
    const points = [
        { x: 0, y: 100 },
        { x: 72, y: 100 },
        { x: 72, y: 96 },
        { x: 80, y: 96 },
        { x: 80, y: 92 },
        { x: 84, y: 92 },
        { x: 84, y: 88 },
        { x: 88, y: 88 },
        { x: 88, y: 84 },
        { x: 92, y: 84 },
        { x: 92, y: 80 },
        { x: 96, y: 80 },
        { x: 96, y: 72 },
        { x: 100, y: 72 },
        { x: 100, y: 0 },
        { x: 0, y: 0 }
    ]

    return points.map((point, index) => {
        const next = points[(index + 1) % points.length]
        return {
            type: 'line',
            x1: point.x,
            y1: point.y,
            x2: next.x,
            y2: next.y
        }
    })
}

/**
 * Builds one owned package pad.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createOwnedPad(x, y) {
    return {
        componentIndex: 7,
        x,
        y,
        hasTopPasteMaskOpening: true,
        sizeTopX: 10,
        sizeTopY: 10,
        sizeMidX: 10,
        sizeMidY: 10
    }
}

/**
 * Builds one nearby unrelated pad that should not inflate the package body.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createUnrelatedPad(x, y) {
    return {
        componentIndex: 99,
        x,
        y,
        hasTopPasteMaskOpening: true,
        sizeTopX: 40,
        sizeTopY: 40,
        sizeMidX: 40,
        sizeMidY: 40
    }
}

/**
 * Builds one owned rotated chip pad for local body-dimension tests.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createRotatedChipPad(x, y) {
    return {
        componentIndex: 7,
        x,
        y,
        rotation: 90,
        hasTopPasteMaskOpening: true,
        sizeTopX: 10,
        sizeTopY: 12,
        sizeMidX: 10,
        sizeMidY: 12
    }
}

/**
 * Verifies inset board cutout regions do not replace the authored edge-cut
 * outline when refining rasterized board outlines.
 */
test('PcbScene3dBuilder rejects inset cutout outlines during board refinement', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'generic-board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: createStairStepSegments()
            },
            primitiveLayers: [],
            boardRegions: [
                {
                    objectKind: 'BoardRegion',
                    isBoardCutout: true,
                    points: [
                        { x: 4, y: 96 },
                        { x: 4, y: 5 },
                        { x: 95, y: 5 },
                        { x: 95, y: 96 }
                    ]
                }
            ],
            pads: [],
            tracks: [],
            arcs: [],
            vias: [],
            components: [
                {
                    designator: 'U1',
                    x: 70,
                    y: 60,
                    layer: 'TOP',
                    pattern: 'GENERIC',
                    height: 20
                }
            ]
        }
    })

    assert.equal(scene.board.minX, 0)
    assert.equal(scene.board.minY, 0)
    assert.equal(scene.board.widthMil, 100)
    assert.equal(scene.board.heightMil, 100)
    assert.equal(scene.board.centerX, 50)
    assert.equal(scene.board.centerY, 50)
    assert.equal(scene.board.segments.length, 16)
    assert.equal(scene.components[0].positionMil.x, 20)
    assert.equal(scene.components[0].positionMil.y, 10)
})

/**
 * Verifies procedural fallback bodies use component-owned pads in dense areas
 * instead of all nearby pads.
 */
test('PcbScene3dBuilder sizes procedural bodies from owned pad spans', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'dense-owned-pad-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2400,
                heightMil: 1600,
                segments: []
            },
            components: [
                {
                    componentIndex: 7,
                    designator: 'U1',
                    x: 1000,
                    y: 800,
                    layer: 'TOP',
                    pattern: 'FAKE_DFN6',
                    source: 'FAKE_SWITCH',
                    rotation: 180,
                    height: 22
                }
            ],
            pads: [
                createOwnedPad(985, 780),
                createOwnedPad(1015, 780),
                createOwnedPad(985, 800),
                createOwnedPad(1015, 800),
                createOwnedPad(985, 820),
                createOwnedPad(1015, 820),
                createUnrelatedPad(870, 640),
                createUnrelatedPad(1130, 960)
            ],
            componentBodies: [],
            embeddedModels: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    })

    assert.deepEqual(scene.components[0].body.sizeMil, {
        width: 40,
        depth: 50,
        height: 22
    })
})

/**
 * Verifies pad-derived fallback body dimensions stay in component-local axes so
 * the renderer can apply the component rotation exactly once.
 */
test('PcbScene3dBuilder keeps rotated chip body dimensions local', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'rotated-chip-body-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 400,
                segments: []
            },
            components: [
                {
                    componentIndex: 7,
                    designator: 'P1',
                    x: 200,
                    y: 200,
                    layer: 'TOP',
                    pattern: 'RES0402',
                    source: 'FAKE_PASSIVE',
                    rotation: 90,
                    height: 14
                }
            ],
            pads: [
                createRotatedChipPad(200, 180),
                createRotatedChipPad(200, 220)
            ],
            componentBodies: [],
            embeddedModels: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    })

    assert.equal(scene.components[0].rotationDeg, 90)
    assert.deepEqual(scene.components[0].body.sizeMil, {
        width: 50,
        depth: 12,
        height: 14
    })
})

/**
 * Verifies bottom-side pad rotations are pre-compensated for the shared 3D
 * mirror path while top-side pad rotations remain unchanged.
 */
test('PcbScene3dBuilder mirrors bottom pad rotations in scene detail', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'bottom-pad-rotation-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            primitiveLayers: [],
            components: [],
            pads: [
                { x: 10, y: 10, layerId: 1, rotation: 30 },
                { x: 20, y: 20, layerId: 32, rotation: 30 },
                { x: 30, y: 30, layer: 'B.Cu', rotation: 90 }
            ],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    })

    assert.deepEqual(
        scene.detail.pads.map((pad) => pad.rotation),
        [30, 330, 270]
    )
})
