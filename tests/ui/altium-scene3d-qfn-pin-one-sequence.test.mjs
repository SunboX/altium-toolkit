import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a fake top-side QFN package whose tilted source yaw numerically
 * matches the component but whose ordered perimeter pads expose the pin-one
 * frame.
 * @returns {{ scene: object, documentModel: object }}
 */
function createOrderedQfnPinOnePackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'U9',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 0, y: 0, z: 31.5 },
                    bodyPositionMil: { x: 500, y: 500 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_QFN50P400X400X100-25N-S265.step',
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
                        designator: 'U9',
                        componentIndex: 9,
                        x: 500,
                        y: 500,
                        layer: 'TOP',
                        pattern: 'GENERIC_QFN50P400X400X100-25N-S265',
                        source: 'GENERIC_QFN_DEVICE',
                        rotation: 90,
                        parameters: {
                            Package: 'QFN-24 with exposed thermal pad'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_QFN50P400X400X100-25N-S265',
                        name: 'GENERIC_QFN50P400X400X100-25N-S265.step',
                        positionMil: { x: 500, y: 500 },
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 40
                    }
                ],
                pads: createOrderedQfnPads(9, 500, 500)
            }
        }
    }
}

/**
 * Builds a fake top-side flat QFN package whose board-facing STEP yaw already
 * matches the component footprint yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createFlatAlignedQfnPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'U10',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: 900, y: 700, z: 31.5 },
                    bodyPositionMil: { x: 900, y: 700 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_LFCSP16.step',
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
                        designator: 'U10',
                        componentIndex: 10,
                        x: 900,
                        y: 700,
                        layer: 'TOP',
                        pattern: 'GENERIC_QFN50P300X300X80-17N-D',
                        source: 'GENERIC_CONVERTER',
                        rotation: 0,
                        parameters: {
                            Case: 'LFCSP-16',
                            PackageDescription:
                                'QFN 0.50mm pitch square with exposed tab'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_LFCSP16',
                        name: 'GENERIC_LFCSP16.step',
                        positionMil: { x: 900, y: 700 },
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        standoffHeightMil: 0,
                        overallHeightMil: 32
                    }
                ],
                pads: createOrderedQfnPads(10, 900, 700)
            }
        }
    }
}

/**
 * Builds a fake top-side flat QFN package whose full STEP model bounds and
 * authored yaw already match the component footprint yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createFlatAlignedModelBoundsQfnPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'U14',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: 1100, y: 900, z: 31.5 },
                    bodyPositionMil: { x: 1100, y: 900 },
                    projection: {
                        source: 'model-bounds',
                        boundsMil: {
                            width: 122,
                            depth: 122,
                            height: 31
                        }
                    },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_LFCSP16_BOUNDS.step',
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
                        designator: 'U14',
                        componentIndex: 14,
                        x: 1100,
                        y: 900,
                        layer: 'TOP',
                        pattern: 'GENERIC_QFN50P300X300X80-17N-D',
                        source: 'GENERIC_SAMPLER',
                        rotation: 0,
                        parameters: {
                            Case: 'LFCSP-16',
                            PackageDescription:
                                'QFN 0.50mm pitch square with exposed tab'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_LFCSP16_BOUNDS',
                        name: 'GENERIC_LFCSP16_BOUNDS.step',
                        positionMil: { x: 1100, y: 900 },
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        standoffHeightMil: 0,
                        overallHeightMil: 31
                    }
                ],
                pads: createOrderedQfnPads(14, 1100, 900)
            }
        }
    }
}

/**
 * Builds a fake top-side model-bounds QFN package where the recovered
 * embedded model source yaw disagrees with the component body yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createModelBoundsQfnSourceYawConflictPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'U15',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 1300, y: 1000, z: 31.5 },
                    bodyPositionMil: { x: 1300, y: 1000 },
                    projection: {
                        source: 'model-bounds',
                        boundsMil: {
                            width: 163,
                            depth: 163,
                            height: 39
                        }
                    },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_QFN_SOURCE_FRAME.step',
                        format: 'step',
                        transform: {
                            rotationDeg: { x: 0, y: 0, z: 270 },
                            dzMil: 0
                        }
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
                        designator: 'U15',
                        componentIndex: 15,
                        x: 1300,
                        y: 1000,
                        layer: 'TOP',
                        pattern: 'GENERIC_QFN50P400X400X100-25N-S265',
                        source: 'GENERIC_PHY',
                        rotation: 90,
                        parameters: {
                            Case: 'QFN24',
                            PackageDescription:
                                'QFN 0.50mm pitch square with exposed tab'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_QFN_SOURCE_FRAME',
                        name: 'GENERIC_QFN_SOURCE_FRAME.step',
                        positionMil: { x: 1300, y: 1000 },
                        modelRotationDeg: { x: 0, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 39
                    }
                ],
                pads: createOrderedQfnPads(15, 1300, 1000)
            }
        }
    }
}

/**
 * Builds a fake top-side flat QFP package whose full STEP model bounds and
 * authored yaw already match the component footprint yaw.
 * @returns {{ scene: object, documentModel: object }}
 */
function createFlatAlignedModelBoundsQfpPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'U13',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: 1500, y: 1100, z: 31.5 },
                    bodyPositionMil: { x: 1500, y: 1100 },
                    projection: {
                        source: 'model-bounds',
                        boundsMil: {
                            width: 354,
                            depth: 354,
                            height: 64
                        }
                    },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_LQFP48.step',
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
                        designator: 'U13',
                        componentIndex: 13,
                        x: 1500,
                        y: 1100,
                        layer: 'TOP',
                        pattern: 'GENERIC_QFP50P900X900X160-48N',
                        source: 'GENERIC_CONTROLLER',
                        rotation: 0,
                        parameters: {
                            Case: 'LQFP48',
                            PackageDescription: 'QFP 0.50mm pitch square 48 pin'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_QFP50P900X900X160-48N',
                        name: 'GENERIC_LQFP48.step',
                        positionMil: { x: 1500, y: 1100 },
                        modelRotationDeg: { x: 0, y: 0, z: 0 },
                        standoffHeightMil: 0,
                        overallHeightMil: 64
                    }
                ],
                pads: createPerimeterQfpPads(13, 1500, 1100)
            }
        }
    }
}

/**
 * Builds a fake bottom-side UQFN package whose source transform carries the
 * bottom-face half-turn frame and whose rendered pin-one corner should follow
 * the mirrored bottom footprint convention.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomUqfnHalfTurnPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'U11',
                    mountSide: 'bottom',
                    rotationDeg: 180,
                    positionMil: { x: 1200, y: 820, z: -31.5 },
                    bodyPositionMil: { x: 1200, y: 820 },
                    projection: { source: 'pad-fallback' },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_UQFN16.step',
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
                        designator: 'U11',
                        componentIndex: 11,
                        x: 1200,
                        y: 820,
                        layer: 'BOTTOM',
                        pattern: 'GENERIC_UQFN16',
                        source: 'GENERIC_LEVEL_TRANSLATOR',
                        rotation: 180,
                        parameters: {
                            PackageDescription:
                                'Bottom-side 16-UFQFN perimeter package'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_UQFN16',
                        name: 'GENERIC_UQFN16.step',
                        positionMil: { x: 1200, y: 820 },
                        modelRotationDeg: { x: 180, y: 0, z: 180 },
                        standoffHeightMil: -2,
                        overallHeightMil: 22
                    }
                ],
                pads: createBottomUqfnPads(11, 1200, 820)
            }
        }
    }
}

/**
 * Builds a fake bottom-side large aQFN package whose projection comes from
 * embedded model bounds instead of the pad span fallback.
 * @returns {{ scene: object, documentModel: object }}
 */
function createBottomModelBoundsAqfnPackage() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 63 },
            externalPlacements: [
                {
                    designator: 'U12',
                    mountSide: 'bottom',
                    rotationDeg: 180,
                    positionMil: { x: 1026, y: 826, z: -31.5 },
                    bodyPositionMil: { x: 1026, y: 826 },
                    projection: {
                        source: 'model-bounds',
                        boundsMil: {
                            width: 452,
                            depth: 38,
                            height: 452
                        }
                    },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'GENERIC_AQFN261.step',
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
                        designator: 'U12',
                        componentIndex: 12,
                        x: 800,
                        y: 600,
                        layer: 'BOTTOM',
                        pattern: 'GENERIC_AQFN261',
                        source: 'GENERIC_RF_TRANSCEIVER',
                        rotation: 180,
                        parameters: {
                            PackageDescription: '261 pin aQFN perimeter package'
                        }
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'GENERIC_AQFN261_BODY',
                        name: 'GENERIC_AQFN261.step',
                        positionMil: { x: 1026, y: 826 },
                        modelRotationDeg: { x: 90, y: 0, z: 180 },
                        standoffHeightMil: 1,
                        overallHeightMil: 38
                    }
                ],
                pads: createBottomAqfnPads(12, 800, 600)
            }
        }
    }
}

/**
 * Builds center and perimeter pads for a square QFN-like footprint.
 * @param {number} componentIndex Owning component index.
 * @param {number} cx Component center X.
 * @param {number} cy Component center Y.
 * @returns {object[]}
 */
function createOrderedQfnPads(componentIndex, cx, cy) {
    const pads = [createSurfacePad(componentIndex, cx, cy, 104, 104)]
    const sideOffset = 77
    const pinOffsets = [-49, -29, -10, 10, 29, 49]

    for (const offset of pinOffsets) {
        pads.push(
            createSurfacePad(componentIndex, cx + sideOffset, cy + offset)
        )
    }
    for (const offset of [...pinOffsets].reverse()) {
        pads.push(
            createSurfacePad(componentIndex, cx + offset, cy + sideOffset)
        )
    }
    for (const offset of [...pinOffsets].reverse()) {
        pads.push(
            createSurfacePad(componentIndex, cx - sideOffset, cy + offset)
        )
    }
    for (const offset of pinOffsets) {
        pads.push(
            createSurfacePad(componentIndex, cx + offset, cy - sideOffset)
        )
    }

    return pads
}

/**
 * Builds bottom-side perimeter pads for a compact UQFN-like footprint.
 * @param {number} componentIndex Owning component index.
 * @param {number} cx Component center X.
 * @param {number} cy Component center Y.
 * @returns {object[]}
 */
function createBottomUqfnPads(componentIndex, cx, cy) {
    const sideOffset = 47
    const pinOffsets = [-32, -16, 0, 16]

    return [
        ...pinOffsets.map((offset) =>
            createBottomSurfacePad(componentIndex, cx + sideOffset, cy + offset)
        ),
        ...[...pinOffsets]
            .reverse()
            .map((offset) =>
                createBottomSurfacePad(
                    componentIndex,
                    cx + offset,
                    cy + sideOffset
                )
            ),
        ...[...pinOffsets]
            .reverse()
            .map((offset) =>
                createBottomSurfacePad(
                    componentIndex,
                    cx - sideOffset,
                    cy + offset
                )
            ),
        ...pinOffsets.map((offset) =>
            createBottomSurfacePad(componentIndex, cx + offset, cy - sideOffset)
        )
    ]
}

/**
 * Builds bottom-side perimeter pads for a large aQFN-like footprint.
 * @param {number} componentIndex Owning component index.
 * @param {number} cx Component center X.
 * @param {number} cy Component center Y.
 * @returns {object[]}
 */
function createBottomAqfnPads(componentIndex, cx, cy) {
    const sideOffset = 210
    const pinOffsets = [-180, -120, -60, 0, 60, 120, 180]

    return [
        ...pinOffsets.map((offset) =>
            createBottomSurfacePad(componentIndex, cx + sideOffset, cy + offset)
        ),
        ...[...pinOffsets]
            .reverse()
            .map((offset) =>
                createBottomSurfacePad(
                    componentIndex,
                    cx + offset,
                    cy + sideOffset
                )
            ),
        ...[...pinOffsets]
            .reverse()
            .map((offset) =>
                createBottomSurfacePad(
                    componentIndex,
                    cx - sideOffset,
                    cy + offset
                )
            ),
        ...pinOffsets.map((offset) =>
            createBottomSurfacePad(componentIndex, cx + offset, cy - sideOffset)
        )
    ]
}

/**
 * Builds a perimeter-only square QFP-style footprint.
 * @param {number} componentIndex Owning component index.
 * @param {number} cx Component center X.
 * @param {number} cy Component center Y.
 * @returns {object[]}
 */
function createPerimeterQfpPads(componentIndex, cx, cy) {
    const sideOffset = 165
    const pinOffsets = [-108, -89, -69, -49, -30, -10, 10, 30, 49, 69, 89, 108]

    return [
        ...pinOffsets.map((offset) =>
            createSurfacePad(componentIndex, cx - sideOffset, cy + offset)
        ),
        ...pinOffsets.map((offset) =>
            createSurfacePad(componentIndex, cx + offset, cy + sideOffset)
        ),
        ...pinOffsets.map((offset) =>
            createSurfacePad(componentIndex, cx + sideOffset, cy + offset)
        ),
        ...pinOffsets.map((offset) =>
            createSurfacePad(componentIndex, cx + offset, cy - sideOffset)
        )
    ]
}

/**
 * Builds one fake surface-mount pad.
 * @param {number} componentIndex Owning component index.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @param {number} [width=12] Pad width.
 * @param {number} [depth=33] Pad depth.
 * @returns {object}
 */
function createSurfacePad(componentIndex, x, y, width = 12, depth = 33) {
    return {
        componentIndex,
        x,
        y,
        sizeTopX: width,
        sizeTopY: depth,
        sizeMidX: width,
        sizeMidY: depth,
        hasTopPasteMaskOpening: true
    }
}

/**
 * Builds one fake bottom-side surface-mount pad.
 * @param {number} componentIndex Owning component index.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createBottomSurfacePad(componentIndex, x, y) {
    return {
        componentIndex,
        x,
        y,
        sizeBottomX: 12,
        sizeBottomY: 33,
        sizeMidX: 12,
        sizeMidY: 33,
        hasTopPasteMaskOpening: false,
        hasBottomPasteMaskOpening: true
    }
}

test('Altium ordered QFN perimeter pads receive pin-one half-turn', () => {
    const { scene, documentModel } = createOrderedQfnPinOnePackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U9')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})

test('Altium flat aligned QFN keeps source yaw', () => {
    const { scene, documentModel } = createFlatAlignedQfnPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U10')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
})

test('Altium flat aligned model-bounds QFN keeps source yaw', () => {
    const { scene, documentModel } = createFlatAlignedModelBoundsQfnPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U14')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
})

test('Altium model-bounds QFN uses embedded source yaw for pin one', () => {
    const { scene, documentModel } =
        createModelBoundsQfnSourceYawConflictPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U15')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})

test('Altium flat aligned model-bounds QFP keeps source yaw', () => {
    const { scene, documentModel } = createFlatAlignedModelBoundsQfpPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U13')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 0)
})

test('Altium bottom UQFN half-turn source frames preserve authored pin-one yaw', () => {
    const { scene, documentModel } = createBottomUqfnHalfTurnPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U11')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
})

test('Altium bottom model-bounds aQFN package keeps authored half-turn yaw', () => {
    const { scene, documentModel } = createBottomModelBoundsAqfnPackage()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U12')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
    assert.deepEqual(repaired.externalPlacements[0].positionMil, {
        x: 800,
        y: 600,
        z: -31.5
    })
    assert.deepEqual(
        repaired.externalPlacements[0].modelTransform.ownerAnchorOffsetMil,
        { x: 226, y: 226 }
    )
    assert.deepEqual(repaired.externalPlacements[0].modelTransform.offsetMil, {
        x: 0,
        y: 0,
        z: 0
    })
})
