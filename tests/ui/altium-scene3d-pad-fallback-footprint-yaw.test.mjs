import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds one fake two-column package pad.
 * @param {number} componentIndex Component owner index.
 * @param {number} x Pad X coordinate.
 * @param {number} y Pad Y coordinate.
 * @param {string} netName Obfuscated net name.
 * @returns {object}
 */
function createDfnPad(componentIndex, x, y, netName) {
    return {
        componentIndex,
        x,
        y,
        sizeTopX: 39,
        sizeTopY: 30,
        hasTopPasteMaskOpening: true,
        netName
    }
}

/**
 * Builds a fake top-side DFN-like power package whose embedded body yaw is a
 * quarter-turn away from the component footprint yaw.
 * @param {string} projectionSource Placement projection source.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopDfnPowerPackage(projectionSource = 'pad-fallback') {
    const componentIndex = 31
    const leftX = 390
    const rightX = 610
    const yValues = [325, 375, 425, 475]

    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'Q8',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 500, y: 400, z: 31.5 },
                    bodyPositionMil: { x: 500, y: 400 },
                    projection: { source: projectionSource },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_DFN_POWER.step',
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
                        designator: 'Q8',
                        componentIndex,
                        x: 500,
                        y: 400,
                        layer: 'TOP',
                        pattern: 'DFN-5X6-8L',
                        source: 'GENERIC_POWER_DEVICE',
                        rotation: 0,
                        parameters: {
                            Case: 'DFN-5X6',
                            PackageDescription: 'DFN 5x6',
                            'Pin Count': '8'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_DFN_POWER',
                        name: 'GENERIC_DFN_POWER.step',
                        positionMil: { x: 500, y: 400 },
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 43
                    }
                ],
                pads: [
                    ...yValues.map((y) =>
                        createDfnPad(componentIndex, rightX, y, 'N_D')
                    ),
                    createDfnPad(componentIndex, leftX, yValues[0], 'N_S'),
                    createDfnPad(componentIndex, leftX, yValues[1], 'N_S'),
                    createDfnPad(componentIndex, leftX, yValues[2], 'N_S'),
                    createDfnPad(componentIndex, leftX, yValues[3], 'N_G')
                ]
            }
        }
    }
}

/**
 * Builds a fake bottom-side IPC-named SOT23-3 package whose body yaw is a
 * quarter-turn away from the footprint yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomIpcSot23Package() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'Q9',
                    mountSide: 'bottom',
                    rotationDeg: 90,
                    positionMil: { x: 320, y: 260, z: -31.5 },
                    bodyPositionMil: { x: 320, y: 260 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_IPC_SOT.step',
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
                        designator: 'Q9',
                        componentIndex: 9,
                        x: 320,
                        y: 260,
                        layer: 'BOTTOM',
                        pattern: 'SOT95P240X110-3N',
                        source: 'GENERIC_TRANSISTOR',
                        rotation: 270,
                        parameters: {
                            Case: 'SOT23-3',
                            PackageDescription: 'SOT23 3-Leads, Pitch 0.95mm'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'SOT95P240X110-3N',
                        name: 'SOT95P240X110-3N.step',
                        positionMil: { x: 320, y: 260 },
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 43
                    }
                ],
                pads: [
                    {
                        componentIndex: 9,
                        x: 320,
                        y: 215,
                        sizeBottomX: 41,
                        sizeBottomY: 26,
                        hasBottomPasteMaskOpening: true
                    },
                    {
                        componentIndex: 9,
                        x: 283,
                        y: 305,
                        sizeBottomX: 41,
                        sizeBottomY: 26,
                        hasBottomPasteMaskOpening: true
                    },
                    {
                        componentIndex: 9,
                        x: 357,
                        y: 305,
                        sizeBottomX: 41,
                        sizeBottomY: 26,
                        hasBottomPasteMaskOpening: true
                    }
                ]
            }
        }
    }
}

test('Altium pad-fallback DFN package uses component footprint yaw', () => {
    const { scene, documentModel } = createTopDfnPowerPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'Q8')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
    assert.equal(
        repaired.externalPlacements[0].modelTransform.rotationDeg.z,
        -90
    )
})

test('Altium model-bounds DFN package uses component footprint yaw', () => {
    const { scene, documentModel } = createTopDfnPowerPackage('model-bounds')
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'Q8')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
    assert.equal(
        repaired.externalPlacements[0].modelTransform.rotationDeg.z,
        90
    )
    assert.equal(repaired.externalPlacements[0].modelTransform.scale?.z ?? 1, 1)
})

test('Altium pad-fallback power DFN package mirrors source length marker', () => {
    const { scene, documentModel } = createTopDfnPowerPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'Q8')
    assert.equal(repaired.externalPlacements[0].modelTransform.scale.z, -1)
})

test('Altium bottom IPC SOT23 package uses mirrored component footprint yaw', () => {
    const { scene, documentModel } = createBottomIpcSot23Package()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'Q9')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 90)
})
