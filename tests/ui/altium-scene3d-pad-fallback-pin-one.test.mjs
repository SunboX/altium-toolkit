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
 * Builds a fake bottom-side flat square package whose source frame is already
 * board-facing after its authored half-turn yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomFlatHalfTurnSquarePackage() {
    const fixture = createBottomHalfTurnSquarePackage()
    fixture.documentModel.pcb.componentBodies[0] = {
        ...fixture.documentModel.pcb.componentBodies[0],
        modelRotationDeg: { x: 0, y: 0, z: 180 }
    }

    return fixture
}

/**
 * Builds a fake top-side square package whose source yaw already matches the
 * component footprint yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopAlignedSquarePackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'U2',
                    mountSide: 'top',
                    rotationDeg: 180,
                    positionMil: { x: 180, y: 160, z: 40 },
                    bodyPositionMil: { x: 180, y: 160 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'FAKE_RF_QFN.step',
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
                        designator: 'U2',
                        x: 180,
                        y: 160,
                        layer: 'TOP',
                        pattern: 'FAKE_RF_QFN14',
                        source: 'FAKE_RF_SWITCH',
                        rotation: 180,
                        parameters: {
                            Package: 'QFN-14'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'FAKE_RF_QFN',
                        name: 'FAKE_RF_QFN.step',
                        positionMil: { x: 180, y: 160 },
                        modelRotationDeg: { x: 0, y: 0, z: 180 },
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
 * Builds a fake bottom-side five-lead SOT-style package whose STEP body yaw is
 * mirrored from the footprint convention.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomFiveLeadPackage() {
    const fixture = createExactFiveLeadPackage()
    fixture.scene.externalPlacements[0] = {
        ...fixture.scene.externalPlacements[0],
        mountSide: 'bottom',
        rotationDeg: 90,
        positionMil: { x: 250, y: 200, z: -40 }
    }
    fixture.documentModel.pcb.components[0] = {
        ...fixture.documentModel.pcb.components[0],
        layer: 'BOTTOM',
        rotation: 180
    }
    fixture.documentModel.pcb.componentBodies[0] = {
        ...fixture.documentModel.pcb.componentBodies[0],
        modelRotationDeg: { x: 0, y: 0, z: 270 }
    }
    fixture.documentModel.pcb.pads = fixture.documentModel.pcb.pads.map(
        (pad) => ({
            ...pad,
            hasTopPasteMaskOpening: false,
            hasBottomPasteMaskOpening: true
        })
    )

    return fixture
}

/**
 * Builds a fake bottom-side three-lead SOT-style package whose STEP body yaw is
 * mirrored from the footprint convention.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomThreeLeadPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'Q1',
                    mountSide: 'bottom',
                    rotationDeg: 90,
                    positionMil: { x: 320, y: 260, z: -40 },
                    bodyPositionMil: { x: 320, y: 260 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_SOT523.step',
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
                        designator: 'Q1',
                        componentIndex: 4,
                        x: 320,
                        y: 260,
                        layer: 'BOTTOM',
                        pattern: 'GENERIC_SOT523',
                        source: 'GENERIC_TRANSISTOR',
                        rotation: 180
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_SOT523',
                        name: 'GENERIC_SOT523.step',
                        positionMil: { x: 320, y: 260 },
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 24
                    }
                ],
                pads: [
                    {
                        componentIndex: 4,
                        x: 290,
                        y: 240,
                        sizeBottomX: 18,
                        sizeBottomY: 26,
                        hasBottomPasteMaskOpening: true
                    },
                    {
                        componentIndex: 4,
                        x: 290,
                        y: 280,
                        sizeBottomX: 18,
                        sizeBottomY: 26,
                        hasBottomPasteMaskOpening: true
                    },
                    {
                        componentIndex: 4,
                        x: 350,
                        y: 260,
                        sizeBottomX: 18,
                        sizeBottomY: 26,
                        hasBottomPasteMaskOpening: true
                    }
                ]
            }
        }
    }
}

/**
 * Builds a fake top-side three-lead SOT-style package whose STEP body yaw is
 * perpendicular to the footprint pad rows.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopThreeLeadPackage() {
    const fixture = createBottomThreeLeadPackage()
    fixture.scene.externalPlacements[0] = {
        ...fixture.scene.externalPlacements[0],
        mountSide: 'top',
        rotationDeg: 0,
        positionMil: { x: 320, y: 260, z: 40 }
    }
    fixture.documentModel.pcb.components[0] = {
        ...fixture.documentModel.pcb.components[0],
        layer: 'TOP',
        rotation: 0
    }
    fixture.documentModel.pcb.componentBodies[0] = {
        ...fixture.documentModel.pcb.componentBodies[0],
        modelRotationDeg: { x: 0, y: 0, z: 0 }
    }
    fixture.documentModel.pcb.pads = fixture.documentModel.pcb.pads.map(
        (pad) => ({
            ...pad,
            sizeTopX: pad.sizeBottomX,
            sizeTopY: pad.sizeBottomY,
            hasTopPasteMaskOpening: true,
            hasBottomPasteMaskOpening: false
        })
    )

    return fixture
}

/**
 * Builds a fake top-side SOT23-3 package whose embedded STEP pin side is
 * opposite the asymmetric footprint convention.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopSot23ThreeLeadPackage() {
    const fixture = createTopThreeLeadPackage()
    fixture.scene.externalPlacements[0] = {
        ...fixture.scene.externalPlacements[0],
        externalModel: {
            origin: 'embedded',
            name: 'GENERIC_SOT23-3.step',
            format: 'step'
        }
    }
    fixture.documentModel.pcb.components[0] = {
        ...fixture.documentModel.pcb.components[0],
        pattern: 'GENERIC_SOT23-3',
        source: 'GENERIC_REFERENCE',
        rotation: 180
    }
    fixture.documentModel.pcb.componentBodies[0] = {
        ...fixture.documentModel.pcb.componentBodies[0],
        identifier: 'GENERIC_SOT23-3',
        name: 'GENERIC_SOT23-3.step'
    }

    return fixture
}

/**
 * Builds a fake bottom-side two-terminal passive package whose STEP body uses
 * its local Y axis as the long axis.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomTwoTerminalPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'R1',
                    mountSide: 'bottom',
                    rotationDeg: 90,
                    positionMil: { x: 420, y: 260, z: -40 },
                    bodyPositionMil: { x: 420, y: 260 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_LOCAL_Y_RES_01005.step',
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
                        designator: 'R1',
                        componentIndex: 5,
                        x: 420,
                        y: 260,
                        layer: 'BOTTOM',
                        pattern: 'GENERIC_RES01005',
                        source: 'GENERIC_RES0402',
                        rotation: 270
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_LOCAL_Y_RES_01005',
                        name: 'GENERIC_LOCAL_Y_RES_01005.step',
                        positionMil: { x: 420, y: 260 },
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 12
                    }
                ],
                pads: [
                    {
                        componentIndex: 5,
                        x: 420,
                        y: 245,
                        sizeBottomX: 12,
                        sizeBottomY: 10,
                        hasBottomPasteMaskOpening: true
                    },
                    {
                        componentIndex: 5,
                        x: 420,
                        y: 275,
                        sizeBottomX: 12,
                        sizeBottomY: 10,
                        hasBottomPasteMaskOpening: true
                    }
                ]
            }
        }
    }
}

/**
 * Builds a fake top-side two-terminal passive package whose STEP body uses its
 * local Y axis as the long axis.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopTwoTerminalPackage() {
    const fixture = createBottomTwoTerminalPackage()
    fixture.scene.externalPlacements[0] = {
        ...fixture.scene.externalPlacements[0],
        mountSide: 'top',
        rotationDeg: 0,
        positionMil: { x: 420, y: 260, z: 40 }
    }
    fixture.documentModel.pcb.components[0] = {
        ...fixture.documentModel.pcb.components[0],
        layer: 'TOP',
        rotation: 90
    }
    fixture.documentModel.pcb.componentBodies[0] = {
        ...fixture.documentModel.pcb.componentBodies[0],
        modelRotationDeg: { x: 0, y: 0, z: 0 }
    }
    fixture.documentModel.pcb.pads = fixture.documentModel.pcb.pads.map(
        (pad) => ({
            ...pad,
            sizeTopX: pad.sizeBottomX,
            sizeTopY: pad.sizeBottomY,
            hasTopPasteMaskOpening: true,
            hasBottomPasteMaskOpening: false
        })
    )

    return fixture
}

/**
 * Builds a fake diagonal top-side two-terminal passive package.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopDiagonalTwoTerminalPackage() {
    const center = { x: 500, y: 500 }

    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'R2',
                    mountSide: 'top',
                    rotationDeg: 315,
                    positionMil: { x: center.x, y: center.y, z: 40 },
                    bodyPositionMil: { ...center },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_RES_0402.step',
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
                        designator: 'R2',
                        componentIndex: 6,
                        x: center.x,
                        y: center.y,
                        layer: 'TOP',
                        pattern: 'GENERIC_RES_0402',
                        source: 'GENERIC_RES_0402',
                        rotation: 315,
                        parameters: {
                            'Package / Case': '0402 (1005 Metric)'
                        }
                    }
                ],
                componentBodies: [],
                pads: [
                    {
                        componentIndex: 6,
                        x: center.x + 14,
                        y: center.y - 14,
                        sizeTopX: 24,
                        sizeTopY: 24,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 6,
                        x: center.x - 14,
                        y: center.y + 14,
                        sizeTopX: 24,
                        sizeTopY: 24,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 6,
                        x: center.x,
                        y: center.y,
                        sizeTopX: 8,
                        sizeTopY: 8,
                        hasTopPasteMaskOpening: false
                    }
                ]
            }
        }
    }
}

/**
 * Builds fake diagonal 01005 packages whose STEP body uses its local X axis as
 * the long axis.
 * @returns {{ scene: object, documentModel: object }}
 */
function createTopDiagonal01005Packages() {
    const firstCenter = { x: 600, y: 500 }
    const secondCenter = { x: 630, y: 500 }

    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'R3',
                    mountSide: 'top',
                    rotationDeg: 315,
                    positionMil: { x: firstCenter.x, y: firstCenter.y, z: 40 },
                    bodyPositionMil: { ...firstCenter },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_RES01005.step',
                        format: 'step'
                    }
                },
                {
                    designator: 'R4',
                    mountSide: 'top',
                    rotationDeg: 315,
                    positionMil: {
                        x: secondCenter.x,
                        y: secondCenter.y,
                        z: 40
                    },
                    bodyPositionMil: { ...secondCenter },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_RES01005.step',
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
                        designator: 'R3',
                        componentIndex: 7,
                        x: firstCenter.x,
                        y: firstCenter.y,
                        layer: 'TOP',
                        pattern: 'GENERIC_RES01005',
                        source: 'GENERIC_RES_01005',
                        rotation: 315
                    },
                    {
                        designator: 'R4',
                        componentIndex: 8,
                        x: secondCenter.x,
                        y: secondCenter.y,
                        layer: 'TOP',
                        pattern: 'GENERIC_RES01005',
                        source: 'GENERIC_RES_01005',
                        rotation: 315
                    }
                ],
                componentBodies: [],
                pads: [
                    {
                        componentIndex: 7,
                        x: firstCenter.x - 5,
                        y: firstCenter.y + 5,
                        sizeTopX: 6,
                        sizeTopY: 8,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 7,
                        x: firstCenter.x + 5,
                        y: firstCenter.y - 5,
                        sizeTopX: 6,
                        sizeTopY: 8,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 8,
                        x: secondCenter.x + 5,
                        y: secondCenter.y - 5,
                        sizeTopX: 6,
                        sizeTopY: 8,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 8,
                        x: secondCenter.x - 5,
                        y: secondCenter.y + 5,
                        sizeTopX: 6,
                        sizeTopY: 8,
                        hasTopPasteMaskOpening: true
                    }
                ]
            }
        }
    }
}

/**
 * Builds a fake demo-style 0402 package whose embedded model yaw already
 * matches the source Altium body.
 * @returns {{ scene: object, documentModel: object }}
 */
function createDemoStyleTopPassivePackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'C1',
                    mountSide: 'top',
                    rotationDeg: 270,
                    positionMil: { x: 300, y: 200, z: 40 },
                    bodyPositionMil: { x: 300, y: 200 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 270 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_0402_CAP.step',
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
                        designator: 'C1',
                        componentIndex: 9,
                        x: 300,
                        y: 200,
                        layer: 'TOP',
                        pattern: 'GENERIC_CAP_0402',
                        source: 'GENERIC_CAP_0402',
                        rotation: 270
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_0402_CAP',
                        name: 'GENERIC_0402_CAP.step',
                        positionMil: { x: 300, y: 200 },
                        modelRotationDeg: { x: 0, y: 0, z: 270 },
                        standoffHeightMil: 0,
                        overallHeightMil: 20
                    }
                ],
                pads: [
                    {
                        componentIndex: 9,
                        x: 300,
                        y: 180,
                        sizeTopX: 20,
                        sizeTopY: 20,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 9,
                        x: 300,
                        y: 220,
                        sizeTopX: 20,
                        sizeTopY: 20,
                        hasTopPasteMaskOpening: true
                    }
                ]
            }
        }
    }
}

/**
 * Builds a fake demo-style top SOT23 package whose embedded yaw is already
 * aligned with the source Altium footprint.
 * @returns {{ scene: object, documentModel: object }}
 */
function createDemoStyleTopSot23Package() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'Q2',
                    mountSide: 'top',
                    rotationDeg: 180,
                    positionMil: { x: 420, y: 320, z: 40 },
                    bodyPositionMil: { x: 420, y: 320 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 180 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_SOT23_3.step',
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
                        designator: 'Q2',
                        componentIndex: 10,
                        x: 420,
                        y: 320,
                        layer: 'TOP',
                        pattern: 'GENERIC_SOT23_3',
                        source: 'GENERIC_TRANSISTOR',
                        rotation: 180
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_SOT23_3',
                        name: 'GENERIC_SOT23_3.step',
                        positionMil: { x: 420, y: 320 },
                        modelRotationDeg: { x: 0, y: 0, z: 180 },
                        standoffHeightMil: 0,
                        overallHeightMil: 50
                    }
                ],
                pads: [
                    {
                        componentIndex: 10,
                        x: 457,
                        y: 276,
                        sizeTopX: 37,
                        sizeTopY: 39,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 10,
                        x: 383,
                        y: 276,
                        sizeTopX: 37,
                        sizeTopY: 39,
                        hasTopPasteMaskOpening: true
                    },
                    {
                        componentIndex: 10,
                        x: 420,
                        y: 364,
                        sizeTopX: 37,
                        sizeTopY: 39,
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
 * Verifies bottom-side flat square packages keep their authored half-turn yaw.
 */
test('Altium bottom flat square package keeps half-turn yaw', () => {
    const { scene, documentModel } = createBottomFlatHalfTurnSquarePackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
})

/**
 * Verifies top-side square packages are not flipped when their authored yaw
 * already matches the component footprint yaw.
 */
test('Altium top square package keeps aligned source yaw', () => {
    const { scene, documentModel } = createTopAlignedSquarePackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U2')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
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

/**
 * Verifies bottom-side five-lead SOT packages keep the footprint pin-one
 * convention after resolving their source-X pad-row yaw.
 */
test('Altium bottom five-lead SOT package uses footprint yaw', () => {
    const { scene, documentModel } = createBottomFiveLeadPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U3')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})

/**
 * Verifies bottom-side three-lead SOT523 packages with a source-X body axis
 * quarter-turn their leads onto the footprint pad sides.
 */
test('Altium bottom three-lead SOT523 package uses source-X footprint yaw', () => {
    const { scene, documentModel } = createBottomThreeLeadPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'Q1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 90)
})

/**
 * Verifies top-side three-lead SOT packages align their local-Y body axis to
 * the footprint pad rows instead of trusting the STEP source yaw.
 */
test('Altium top three-lead SOT package uses footprint yaw', () => {
    const { scene, documentModel } = createTopThreeLeadPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'Q1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
})

/**
 * Verifies top-side SOT23-3 packages add the pin-side half-turn after the long
 * axis is aligned to the footprint rows.
 */
test('Altium top SOT23-3 package corrects asymmetric pin-side yaw', () => {
    const { scene, documentModel } = createTopSot23ThreeLeadPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'Q1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
})

/**
 * Verifies demo-style embedded passives do not replace authored Altium yaw
 * with a derived pad-axis yaw.
 */
test('Altium demo-style passive package keeps authored yaw', () => {
    const { scene, documentModel } = createDemoStyleTopPassivePackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'C1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})

/**
 * Verifies demo-style embedded SOT23 bodies do not receive the generic
 * footprint-yaw override when the authored yaw already carries orientation.
 */
test('Altium demo-style SOT23 package keeps authored yaw', () => {
    const { scene, documentModel } = createDemoStyleTopSot23Package()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'Q2')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
})

/**
 * Verifies bottom-side embedded two-terminal passives mirror local-Y footprint
 * yaw onto the source frame.
 */
test('Altium bottom two-terminal package uses footprint yaw', () => {
    const { scene, documentModel } = createBottomTwoTerminalPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'R1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
})

/**
 * Verifies top-side embedded two-terminal passives mirror local-Y footprint yaw
 * onto the source frame.
 */
test('Altium top two-terminal package uses footprint yaw', () => {
    const { scene, documentModel } = createTopTwoTerminalPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'R1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
})

/**
 * Verifies standard embedded diagonal top-side two-terminal passives mirror
 * their source-frame yaw so their local X long axis renders on the pad axis.
 */
test('Altium embedded diagonal two-terminal package mirrors local-x footprint yaw', () => {
    const { scene, documentModel } = createTopDiagonalTwoTerminalPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'R2')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 45)
})

/**
 * Verifies embedded 01005 two-terminal passives mirror local-X pad-axis yaw for
 * both pad record orders.
 */
test('Altium embedded 01005 two-terminal package mirrors local-x footprint yaw', () => {
    const { scene, documentModel } = createTopDiagonal01005Packages()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const byDesignator = new Map(
        repaired.externalPlacements.map((placement) => [
            placement.designator,
            placement
        ])
    )

    assert.equal(repaired.externalPlacements.length, 2)
    assert.equal(byDesignator.get('R3')?.rotationDeg, 45)
    assert.equal(byDesignator.get('R4')?.rotationDeg, 45)
})
