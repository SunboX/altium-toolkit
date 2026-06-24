import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds one fake two-row IC pad.
 * @param {number} componentIndex Component index.
 * @param {number} x Pad center x coordinate.
 * @param {number} y Pad center y coordinate.
 * @returns {object}
 */
function createTwoRowIcPad(componentIndex, x, y) {
    return {
        componentIndex,
        x,
        y,
        sizeTopX: 28,
        sizeTopY: 98,
        hasTopPasteMaskOpening: true
    }
}

/**
 * Builds a fake top-side two-row IC package whose embedded source frame puts
 * the pin-one corner opposite the footprint convention.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopTwoRowIcPackage() {
    const componentIndex = 16
    const padXs = [325, 375, 425, 475, 525, 575, 625, 675]

    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'U5',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 500, y: 400, z: 40 },
                    bodyPositionMil: { x: 500, y: 400 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_SOP16.step',
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
                        designator: 'U5',
                        componentIndex,
                        x: 500,
                        y: 400,
                        layer: 'TOP',
                        pattern: 'GENERIC_SOP16',
                        source: 'GENERIC_TWO_ROW_IC',
                        rotation: 90
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_SOP16',
                        name: 'GENERIC_SOP16.step',
                        positionMil: { x: 500, y: 400 },
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 60
                    }
                ],
                pads: [
                    ...padXs.map((x) =>
                        createTwoRowIcPad(componentIndex, x, 304)
                    ),
                    ...padXs.map((x) =>
                        createTwoRowIcPad(componentIndex, x, 496)
                    )
                ]
            }
        }
    }
}

/**
 * Verifies top-side two-row IC packages receive the same pin-one half-turn
 * correction when a pad-fallback projection confirms the footprint.
 */
test('Altium top two-row IC package corrects pad-fallback pin-one yaw', () => {
    const { scene, documentModel } = createTopTwoRowIcPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U5')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})
