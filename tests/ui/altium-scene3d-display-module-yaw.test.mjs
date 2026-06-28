import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a fake top-side display module whose embedded body yaw disagrees with
 * the component footprint yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopDisplayModule() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'DS9',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 500, y: 500, z: 31.5 },
                    bodyPositionMil: { x: 500, y: 500 },
                    projection: {
                        source: 'pad-fallback',
                        boundsMil: { width: 160, depth: 430, height: 100 }
                    },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: -4
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_DISPLAY_MODULE.step',
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
                        designator: 'DS9',
                        componentIndex: 9,
                        x: 500,
                        y: 500,
                        layer: 'TOP',
                        pattern: 'GENERIC_DISPLAY_MODULE',
                        source: 'GENERIC_DISPLAY_MODULE',
                        rotation: 0,
                        parameters: {
                            PackageDescription: '34 x 46 mm display module',
                            'Part Description': 'Generic TFT display module',
                            SMD: 'Yes',
                            'Pin Count': '14'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_DISPLAY_MODULE',
                        name: 'GENERIC_DISPLAY_MODULE.step',
                        positionMil: { x: 500, y: 500 },
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        standoffHeightMil: -4,
                        overallHeightMil: 100
                    }
                ],
                pads: createEdgePads(9, 890, 300)
            }
        }
    }
}

/**
 * Builds a fake top-side display module whose full model bounds are authored
 * from the connector edge and must face the offset pad row.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopModelBoundsEdgeDisplayModule() {
    const fixture = createTopDisplayModule()
    fixture.scene.externalPlacements[0] = {
        ...fixture.scene.externalPlacements[0],
        projection: {
            source: 'model-bounds',
            boundsMil: { width: 1340, depth: 1820, height: 106 }
        }
    }

    return fixture
}

/**
 * Builds one offset row of surface pads for a module edge contact.
 * @param {number} componentIndex Owning component index.
 * @param {number} x Pad row X.
 * @param {number} firstY First pad Y.
 * @returns {object[]}
 */
function createEdgePads(componentIndex, x, firstY) {
    return Array.from({ length: 14 }, (_, index) => ({
        componentIndex,
        x,
        y: firstY + index * 31.5,
        sizeTopX: 157,
        sizeTopY: 20,
        sizeMidX: 157,
        sizeMidY: 20,
        hasTopPasteMaskOpening: true
    }))
}

test('Altium top display module uses footprint yaw for offset edge pads', () => {
    const { scene, documentModel } = createTopDisplayModule()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'DS9')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
})

test('Altium model-bounds display module faces its offset edge pads', () => {
    const { scene, documentModel } = createTopModelBoundsEdgeDisplayModule()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'DS9')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})
