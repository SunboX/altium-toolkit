import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a fake Altium PCB document with a metadata-recovered mixed pad body.
 * @returns {object}
 */
function createMixedPadContactDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'mixed-pad-contact-fake.PcbDoc',
        pcb: {
            components: [
                {
                    designator: 'J4',
                    componentIndex: 7,
                    x: 460,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'MIXED_EDGE_CONNECTOR',
                    source: 'TOKEN778899',
                    rotation: 270,
                    parameters: { 'Part Token': 'TOKEN778899' }
                }
            ],
            componentBodies: [
                {
                    identifier: 'TOKEN778899',
                    name: 'TOKEN778899.step',
                    positionMil: { x: -180, y: 250 },
                    modelRotationDeg: { x: 0, y: 0, z: 90 },
                    standoffHeightMil: -120,
                    overallHeightMil: 70
                }
            ],
            pads: [
                createSurfacePad(500, 220),
                createSurfacePad(500, 280),
                {
                    componentIndex: 7,
                    x: 420,
                    y: 250,
                    sizeTopX: 45,
                    sizeTopY: 45,
                    holeShape: 2,
                    layerCode: 74,
                    hasTopPasteMaskOpening: false
                }
            ]
        }
    }
}

/**
 * Builds one fake top-side SMT pad.
 * @param {number} x Pad X coordinate.
 * @param {number} y Pad Y coordinate.
 * @returns {object}
 */
function createSurfacePad(x, y) {
    return {
        componentIndex: 7,
        x,
        y,
        sizeTopX: 30,
        sizeTopY: 70,
        layerCode: 1,
        hasTopPasteMaskOpening: true
    }
}

/**
 * Builds a model-anchor fallback scene for the mixed fake connector.
 * @returns {object}
 */
function createModelAnchorScene() {
    return {
        sourceFormat: 'altium',
        board: { centerX: 500, centerY: 250, thicknessMil: 80 },
        externalPlacements: [
            {
                designator: 'TOKEN778899',
                mountSide: 'top',
                rotationDeg: 0,
                positionMil: { x: -680, y: 0, z: 40 },
                bodyPositionMil: { x: -180, y: 250 },
                modelTransform: {
                    rotationDeg: { x: 0, y: 0, z: 0 },
                    dzMil: 0
                },
                projection: { source: 'model-anchor-fallback' },
                externalModel: {
                    origin: 'embedded',
                    name: 'TOKEN778899.step',
                    format: 'step'
                }
            }
        ]
    }
}

/**
 * Verifies metadata-recovered mixed connector bodies carry pad contact hints.
 */
test('ECAD 3D service marks mixed Altium connector pad contact planes', () => {
    const scene = AltiumScene3dExternalPlacementAdapter.apply(
        createModelAnchorScene(),
        createMixedPadContactDocument()
    )
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'J4')
    assert.equal(placement.modelTransform.contactPadsMil.length, 2)
    assert.deepEqual(placement.modelTransform.contactPadsMil[0], {
        x: 0,
        y: -30,
        width: 30,
        depth: 70
    })
})
