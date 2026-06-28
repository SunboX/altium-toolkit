import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a fake top-side through-hole connector whose source body yaw matches
 * the footprint yaw but whose model-bounds projection still faces backward.
 * @returns {{ scene: object, documentModel: object }}
 */
function createModelBoundsThroughHoleConnector() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'J1',
                    mountSide: 'top',
                    rotationDeg: 270,
                    positionMil: { x: 26, y: 0, z: 31.5 },
                    bodyPositionMil: { x: 526, y: 500 },
                    projection: {
                        source: 'model-bounds',
                        boundsMil: { width: 490, depth: 370, height: 190 }
                    },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: -136
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_DIRECTIONAL_HEADER.step',
                        format: 'step'
                    }
                }
            ]
        },
        documentModel: {
            sourceFormat: 'altium',
            kind: 'pcb',
            pcb: {
                components: [
                    {
                        designator: 'J1',
                        componentIndex: 1,
                        x: 500,
                        y: 500,
                        layer: 'TOP',
                        pattern: 'GENERIC_DIRECTIONAL_HEADER',
                        source: 'GENERIC_CONNECTOR_HEADER',
                        description: 'Fake through-hole directional connector',
                        rotation: 270,
                        parameters: {
                            Family: 'Header',
                            'Pin Count': '4',
                            SMD: 'No'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_DIRECTIONAL_HEADER',
                        name: 'GENERIC_DIRECTIONAL_HEADER.step',
                        positionMil: { x: 526, y: 500 },
                        modelRotationDeg: { x: 90, y: 0, z: 270 },
                        standoffHeightMil: -136,
                        overallHeightMil: 230
                    }
                ],
                pads: [
                    createThroughHolePad(500, 350),
                    createThroughHolePad(500, 450),
                    createThroughHolePad(500, 550),
                    createThroughHolePad(500, 650)
                ]
            }
        }
    }
}

/**
 * Builds one fake through-hole pad for the connector.
 * @param {number} x Pad X coordinate.
 * @param {number} y Pad Y coordinate.
 * @returns {object}
 */
function createThroughHolePad(x, y) {
    return {
        componentIndex: 1,
        x,
        y,
        sizeTopX: 60,
        sizeTopY: 60,
        sizeMidX: 60,
        sizeMidY: 60,
        sizeBottomX: 60,
        sizeBottomY: 60,
        holeDiameter: 32,
        hasTopPasteMaskOpening: false,
        hasBottomPasteMaskOpening: false
    }
}

test('Altium top model-bounds through-hole connector receives board-facing half-turn', () => {
    const { scene, documentModel } = createModelBoundsThroughHoleConnector()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'J1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 90)
})
