import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a fake model-anchor connector recovered by part-code metadata.
 * @returns {{ scene: object, documentModel: object }}
 */
function createModelAnchorPartCodeConnectorCase() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { centerX: 500, centerY: 250, thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: '788641001',
                    mountSide: 'bottom',
                    rotationDeg: 270,
                    positionMil: { x: -90, y: 10, z: -40 },
                    bodyPositionMil: { x: 410, y: 260 },
                    modelTransform: {
                        rotationDeg: { x: -180, y: 0, z: 0 },
                        dzMil: 0
                    },
                    projection: { source: 'model-anchor-fallback' },
                    externalModel: {
                        origin: 'embedded',
                        name: '788641001.step',
                        format: 'step'
                    }
                }
            ]
        },
        documentModel: {
            sourceFormat: 'altium',
            kind: 'pcb',
            fileName: 'model-anchor-owner-fake.PcbDoc',
            pcb: {
                components: [
                    {
                        designator: 'J5',
                        componentIndex: 77,
                        x: 500,
                        y: 300,
                        layer: 'BOTTOM',
                        pattern: 'FAKE_0788641001_CONTACTS',
                        source: 'FAKE_0788641001_CONTACTS',
                        description: 'Fake header connector',
                        rotation: 90
                    }
                ],
                componentBodies: [
                    {
                        identifier: '788641001',
                        name: '788641001.step',
                        positionMil: { x: 410, y: 260 },
                        modelRotationDeg: { x: 180, y: 0, z: 270 },
                        overallHeightMil: 80
                    }
                ],
                pads: [
                    createMechanicalPad(77, 440, 260),
                    createMechanicalPad(77, 440, 300),
                    createMechanicalPad(77, 440, 340),
                    createMechanicalPad(77, 560, 260),
                    createMechanicalPad(77, 560, 300),
                    createMechanicalPad(77, 560, 340)
                ]
            }
        }
    }
}

/**
 * Builds one fake non-paste mechanical connector pad.
 * @param {number} componentIndex Owning component index.
 * @param {number} x Pad X coordinate.
 * @param {number} y Pad Y coordinate.
 * @returns {object}
 */
function createMechanicalPad(componentIndex, x, y) {
    return {
        componentIndex,
        x,
        y,
        sizeTopX: 50,
        sizeTopY: 70,
        sizeMidX: 50,
        sizeMidY: 70,
        hasTopPasteMaskOpening: false,
        hasBottomPasteMaskOpening: false,
        layerCode: 32
    }
}

/**
 * Verifies part-code recovered model-anchor connectors are centered on the
 * matched footprint when owned mechanical pads define the actual owner center.
 */
test('Altium 3D owner repair centers part-code model-anchor connectors', () => {
    const { scene, documentModel } = createModelAnchorPartCodeConnectorCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(placement.designator, 'J5')
    assert.equal(placement.mountSide, 'bottom')
    assert.deepEqual(placement.positionMil, { x: 0, y: 50, z: -40 })
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: -90,
        y: -40
    })
    assert.deepEqual(placement.modelTransform.offsetMil, {
        x: 40,
        y: -90,
        z: 0
    })
})
