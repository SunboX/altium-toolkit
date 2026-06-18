import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a fake pad-fallback square package with a metadata owner.
 * @returns {{ scene: object, documentModel: object }}
 */
function createPadFallbackSquarePackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'U1',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: 100, y: 100, z: 40 },
                    bodyPositionMil: { x: 100, y: 100 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'FAKEA123_BODY.step',
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
                        designator: 'U1',
                        x: 400,
                        y: 300,
                        layer: 'BOTTOM',
                        pattern: 'FAKEA123_AQFN',
                        source: 'FAKEA123',
                        rotation: 90,
                        parameters: {
                            'Package / Case': '261-aQFN'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'FAKEA123_BODY',
                        name: 'FAKEA123_BODY.step',
                        positionMil: { x: 100, y: 100 },
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        standoffHeightMil: 0,
                        overallHeightMil: 40
                    }
                ],
                pads: []
            }
        }
    }
}

/**
 * Builds a fake bottom-side square package that should keep authored yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomSquarePackage() {
    const fixture = createPadFallbackSquarePackage()
    fixture.scene.externalPlacements[0] = {
        ...fixture.scene.externalPlacements[0],
        mountSide: 'bottom',
        rotationDeg: 0,
        positionMil: { x: 100, y: 100, z: -40 }
    }
    fixture.documentModel.pcb.components[0] = {
        ...fixture.documentModel.pcb.components[0],
        layer: 'BOTTOM',
        rotation: 0
    }

    return fixture
}

/**
 * Builds a fake bottom-side square package with a half-turn source frame.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomHalfTurnSquarePackage() {
    const fixture = createBottomSquarePackage()
    fixture.scene.externalPlacements[0] = {
        ...fixture.scene.externalPlacements[0],
        rotationDeg: 180,
        modelTransform: {
            ...fixture.scene.externalPlacements[0].modelTransform,
            rotationDeg: { x: 0, y: 0, z: 180 }
        }
    }
    fixture.documentModel.pcb.components[0] = {
        ...fixture.documentModel.pcb.components[0],
        rotation: 180
    }
    fixture.documentModel.pcb.componentBodies[0] = {
        ...fixture.documentModel.pcb.componentBodies[0],
        modelRotationDeg: { x: 90, y: 0, z: 180 }
    }

    return fixture
}

/**
 * Builds a fake exact five-lead SOT-style package with asymmetric pads.
 * @returns {{ scene: object, documentModel: object }}
 */
function createExactFiveLeadPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'U3',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 250, y: 200, z: 40 },
                    bodyPositionMil: { x: 250, y: 200 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_SOT25.step',
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
                        designator: 'U3',
                        componentIndex: 3,
                        x: 250,
                        y: 200,
                        layer: 'TOP',
                        pattern: 'GENERIC_SOT25',
                        source: 'GENERIC_SOT25',
                        rotation: 0
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_SOT25',
                        name: 'GENERIC_SOT25.step',
                        positionMil: { x: 250, y: 200 },
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 40
                    }
                ],
                pads: [
                    {
                        componentIndex: 3,
                        x: 210,
                        y: 170,
                        sizeTopX: 20,
                        sizeTopY: 36,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 3,
                        x: 210,
                        y: 200,
                        sizeTopX: 20,
                        sizeTopY: 36,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 3,
                        x: 210,
                        y: 230,
                        sizeTopX: 20,
                        sizeTopY: 36,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 3,
                        x: 290,
                        y: 178,
                        sizeTopX: 20,
                        sizeTopY: 36,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 3,
                        x: 290,
                        y: 222,
                        sizeTopX: 20,
                        sizeTopY: 36,
                        hasTopPasteMaskOpening: true
                    }
                ]
            }
        }
    }
}

/**
 * Verifies pad-fallback square packages can still receive pin-one yaw repair.
 */
test('Altium pad-fallback square package pin-one yaw uses component rotation', () => {
    const { scene, documentModel } = createPadFallbackSquarePackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})

/**
 * Verifies bottom-side square packages do not receive the top-side pin-one
 * yaw correction.
 */
test('Altium bottom square package keeps authored yaw', () => {
    const { scene, documentModel } = createBottomSquarePackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
})

/**
 * Verifies bottom-side square packages with a half-turn source frame receive
 * the same pin-one yaw normalization as top-side square packages.
 */
test('Altium bottom square package normalizes half-turn source yaw', () => {
    const { scene, documentModel } = createBottomHalfTurnSquarePackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
})

/**
 * Verifies exact five-lead SOT packages use the footprint pin-one convention.
 */
test('Altium exact five-lead SOT package receives asymmetric yaw correction', () => {
    const { scene, documentModel } = createExactFiveLeadPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U3')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})
