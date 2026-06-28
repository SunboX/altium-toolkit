import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a fake scene with one top-side embedded five-lead SOT package whose
 * source yaw matches the footprint yaw and whose asymmetric pin side should
 * stay in that authored orientation.
 * @returns {{ scene: object, documentModel: object }}
 */
function createAlignedFiveLeadPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'U7',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 0, y: 0, z: 31.5 },
                    bodyPositionMil: { x: 500, y: 500 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_SOT95P280X145-5N.step',
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
                        designator: 'U7',
                        componentIndex: 7,
                        x: 500,
                        y: 500,
                        layer: 'TOP',
                        pattern: 'GENERIC_SOT95P280X145-5N',
                        source: 'GENERIC_AMPLIFIER',
                        rotation: 90,
                        parameters: {
                            Case: 'SOT23-5',
                            PackageDescription: 'SOT23 five-lead package'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_SOT95P280X145-5N',
                        name: 'GENERIC_SOT95P280X145-5N.step',
                        positionMil: { x: 500, y: 500 },
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 58
                    }
                ],
                pads: [
                    createSurfacePad(7, 538, 552),
                    createSurfacePad(7, 462, 552),
                    createSurfacePad(7, 462, 448),
                    createSurfacePad(7, 500, 448),
                    createSurfacePad(7, 538, 448)
                ]
            }
        }
    }
}

/**
 * Builds a fake scene with one top-side through-hole connector whose source
 * body yaw matches the footprint yaw but renders board-facing backwards.
 * @param {'authored-body-anchor' | 'pad-fallback'} projectionSource
 * @returns {{ scene: object, documentModel: object }}
 */
function createAlignedThroughHoleConnector(projectionSource) {
    const bodyX = projectionSource === 'authored-body-anchor' ? 526 : 500

    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'J7',
                    mountSide: 'top',
                    rotationDeg: 270,
                    positionMil: { x: bodyX - 500, y: 0, z: 31.5 },
                    bodyPositionMil: { x: bodyX, y: 500 },
                    projection: { source: projectionSource },
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
                        designator: 'J7',
                        componentIndex: 17,
                        x: 500,
                        y: 500,
                        layer: 'TOP',
                        pattern: 'GENERIC_DIRECTIONAL_HEADER',
                        source: 'GENERIC_CONNECTOR_HEADER',
                        description: 'Fake through-hole directional connector',
                        rotation: 270,
                        parameters: {
                            SMD: 'No',
                            Family: 'Header',
                            'Pin Count': '4'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_DIRECTIONAL_HEADER',
                        name: 'GENERIC_DIRECTIONAL_HEADER.step',
                        positionMil: { x: bodyX, y: 500 },
                        modelRotationDeg: { x: 90, y: 0, z: 270 },
                        standoffHeightMil: -136,
                        overallHeightMil: 230
                    }
                ],
                pads: [
                    createThroughHolePad(17, 500, 350),
                    createThroughHolePad(17, 500, 450),
                    createThroughHolePad(17, 500, 550),
                    createThroughHolePad(17, 500, 650)
                ]
            }
        }
    }
}

/**
 * Builds a fake bottom-side single-row header whose full model bounds are
 * anchored on the pin row rather than the footprint center.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomModelBoundsEdgeHeader() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'J8',
                    mountSide: 'bottom',
                    rotationDeg: 270,
                    positionMil: { x: 0, y: -550, z: -31.5 },
                    bodyPositionMil: { x: 500, y: -50 },
                    projection: {
                        source: 'model-bounds',
                        boundsMil: { width: 1100, depth: 80, height: 330 }
                    },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_EDGE_PIN_HEADER.step',
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
                        designator: 'J8',
                        componentIndex: 18,
                        x: 500,
                        y: 500,
                        layer: 'BOTTOM',
                        pattern: 'GENERIC_EDGE_PIN_HEADER',
                        source: 'GENERIC_EDGE_PIN_HEADER',
                        description: 'Fake bottom single-row header',
                        rotation: 90,
                        parameters: {
                            Family: 'Pin Header',
                            'Pin Count': '6'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_EDGE_PIN_HEADER',
                        name: 'GENERIC_EDGE_PIN_HEADER.step',
                        positionMil: { x: 500, y: -50 },
                        modelRotationDeg: { x: 0, y: 0, z: 270 },
                        standoffHeightMil: 0,
                        overallHeightMil: 330
                    }
                ],
                pads: [
                    createThroughHolePad(18, 500, 250),
                    createThroughHolePad(18, 500, 350),
                    createThroughHolePad(18, 500, 450),
                    createThroughHolePad(18, 500, 550),
                    createThroughHolePad(18, 500, 650),
                    createThroughHolePad(18, 500, 750)
                ]
            }
        }
    }
}

/**
 * Builds one fake top-side surface pad.
 * @param {number} componentIndex Owning component index.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createSurfacePad(componentIndex, x, y) {
    return {
        componentIndex,
        x,
        y,
        sizeTopX: 44,
        sizeTopY: 24,
        sizeMidX: 44,
        sizeMidY: 24,
        hasTopPasteMaskOpening: true
    }
}

/**
 * Builds one fake through-hole pad.
 * @param {number} componentIndex Owning component index.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createThroughHolePad(componentIndex, x, y) {
    return {
        componentIndex,
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

test('Altium aligned five-lead SOT package keeps authored pin-side yaw', () => {
    const { scene, documentModel } = createAlignedFiveLeadPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U7')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 90)
})

test('Altium aligned authored through-hole connector receives board-facing half-turn', () => {
    const { scene, documentModel } = createAlignedThroughHoleConnector(
        'authored-body-anchor'
    )
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'J7')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 90)
})

test('Altium aligned pad-fallback through-hole connector receives board-facing half-turn', () => {
    const { scene, documentModel } =
        createAlignedThroughHoleConnector('pad-fallback')
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'J7')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 90)
})

test('Altium model-bounds edge header keeps authored source yaw', () => {
    const { scene, documentModel } = createBottomModelBoundsEdgeHeader()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'J8')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})
