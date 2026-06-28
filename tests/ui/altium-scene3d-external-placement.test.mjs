import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a fake Altium PCB document with one generic package body.
 * @returns {object}
 */
function createExactBodyAnchorDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'exact-body-anchor-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                {
                    designator: 'SB1',
                    x: 100,
                    y: 100,
                    layer: 'BOTTOM',
                    pattern: 'SOLDER_BRIDGE_TRIANGULAR',
                    source: 'SOLDER_BRIDGE',
                    rotation: 0
                },
                {
                    designator: 'C1',
                    x: 450,
                    y: 100,
                    layer: 'BOTTOM',
                    pattern: 'CAP0402',
                    source: 'Cap_0402',
                    rotation: 180
                }
            ],
            componentBodies: [
                {
                    identifier: 'RES 0402',
                    name: 'RES 0402.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 100.004, y: 99.997 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 270 },
                    dzMil: 0,
                    standoffHeightMil: 0,
                    overallHeightMil: 16,
                    embedded: true
                }
            ],
            embeddedModels: [],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds a fake Altium PCB document with exact body rotations.
 * @returns {object}
 */
function createExactRotationDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'exact-rotation-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                {
                    designator: 'U1',
                    x: 300,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'FAKE_SOT',
                    source: 'FAKE_REFERENCE',
                    rotation: 0
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_SOT_BODY',
                    name: 'FAKE_SOT_BODY.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 300.001, y: 250.002 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 90 },
                    dzMil: 0,
                    standoffHeightMil: 0,
                    overallHeightMil: 16,
                    embedded: true
                }
            ],
            embeddedModels: [],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds a fake Altium PCB document with a square pin-1 IC package.
 * @returns {object}
 */
function createSquarePinOnePackageDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'square-pin-one-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                {
                    designator: 'U1',
                    x: 300,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'FAKE_QFN',
                    source: 'FAKE_PIN_ONE_IC',
                    rotation: 90,
                    parameters: {
                        'Package / Case': '64-QFN Exposed Pad'
                    }
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_PIN_ONE_IC',
                    name: 'FAKE_PIN_ONE_IC.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 300, y: 250 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 90 },
                    dzMil: 0,
                    standoffHeightMil: 0,
                    overallHeightMil: 40,
                    embedded: true
                }
            ],
            embeddedModels: [],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds a fake Altium PCB document with a tilted exact body.
 * @returns {object}
 */
function createTiltedExactRotationDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'tilted-rotation-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                {
                    designator: 'J1',
                    x: 800,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'FAKE_EDGE',
                    source: 'FAKE_EDGE_SOURCE',
                    rotation: 270
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_EDGE_BODY',
                    name: 'FAKE_EDGE_BODY.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 870, y: 250 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 90, y: 0, z: 270 },
                    dzMil: 0,
                    standoffHeightMil: 0,
                    overallHeightMil: 100,
                    embedded: true
                }
            ],
            embeddedModels: [],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds a fake Altium PCB document with an offset body identified by metadata.
 * @returns {object}
 */
function createMetadataMatchedOffsetDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'metadata-offset-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                {
                    designator: 'J2',
                    x: 250,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'OFFSET_CONNECTOR',
                    source: 'CONNECTOR_SOURCE',
                    rotation: 270,
                    parameters: {
                        'Manufacturer Part Number': 'PN123ABC'
                    }
                }
            ],
            componentBodies: [
                {
                    identifier: 'PN123ABC',
                    name: 'PN123ABC.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 50, y: 250 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 90 },
                    dzMil: 0,
                    standoffHeightMil: 0,
                    overallHeightMil: 80,
                    embedded: true
                }
            ],
            embeddedModels: [],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds a fake Altium PCB document with a far weak owner and near anchor.
 * @returns {object}
 */
function createNearAnchorRecoveryDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'near-anchor-recovery-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                {
                    designator: 'U1',
                    x: 112,
                    y: 250,
                    layer: 'BOTTOM',
                    pattern: 'UNRELATED_NEAR',
                    source: 'NEAR_SOURCE',
                    rotation: 180
                },
                {
                    designator: 'U2',
                    x: 450,
                    y: 250,
                    layer: 'BOTTOM',
                    pattern: 'OFFSET_DFN',
                    source: 'OFFSET_DFN_SOURCE',
                    rotation: 90
                }
            ],
            componentBodies: [
                {
                    identifier: 'OFFSET_DFN',
                    name: 'OFFSET_DFN.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 100, y: 250 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 90 },
                    dzMil: 0,
                    standoffHeightMil: 0,
                    overallHeightMil: 16,
                    embedded: true
                }
            ],
            embeddedModels: [],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds a fake Altium PCB document whose authored body standoff is negative.
 * @returns {object}
 */
function createNegativeStandoffDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'negative-standoff-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                {
                    designator: 'J1',
                    x: 300,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'EDGE_SOCKET',
                    source: 'EDGE_SOURCE',
                    rotation: 270
                },
                {
                    designator: 'J2',
                    x: 700,
                    y: 250,
                    layer: 'BOTTOM',
                    pattern: 'EDGE_SOCKET',
                    source: 'EDGE_SOURCE',
                    rotation: 90
                },
                {
                    designator: 'J3',
                    x: 850,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'EDGE_SOCKET',
                    source: 'EDGE_SOURCE',
                    rotation: 270
                }
            ],
            componentBodies: [
                {
                    identifier: 'EDGE_SOCKET_BODY',
                    name: 'EDGE_SOCKET_BODY.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 300, y: 250 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 90, y: 0, z: 270 },
                    dzMil: -120,
                    standoffHeightMil: -120,
                    overallHeightMil: 80,
                    embedded: true
                },
                {
                    identifier: 'EDGE_SOCKET_BODY',
                    name: 'EDGE_SOCKET_BODY.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 700, y: 250 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 90, y: 0, z: 90 },
                    dzMil: -40,
                    standoffHeightMil: -40,
                    overallHeightMil: 140,
                    embedded: true
                },
                {
                    identifier: 'EDGE_SOCKET_BODY',
                    name: 'EDGE_SOCKET_BODY.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 936, y: 250 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 90, y: 0, z: 270 },
                    dzMil: -40,
                    standoffHeightMil: -40,
                    overallHeightMil: 140,
                    embedded: true
                }
            ],
            embeddedModels: [],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds a fake Altium PCB document whose authored body standoff is positive.
 * @returns {object}
 */
function createPositiveStandoffDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'positive-standoff-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [
                {
                    designator: 'L1',
                    x: 300,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'RAISED_COIL',
                    source: 'RAISED_SOURCE',
                    rotation: 90
                }
            ],
            componentBodies: [
                {
                    identifier: 'RAISED_COIL_BODY',
                    name: 'RAISED_COIL_BODY.step',
                    layer: 'MECHANICAL13',
                    positionMil: { x: 300.003, y: 249.998 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 0 },
                    dzMil: 25,
                    standoffHeightMil: 25,
                    overallHeightMil: 90,
                    embedded: true
                }
            ],
            embeddedModels: [],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds a scene with a far body assigned by weak package affinity only.
 * @returns {{ scene: object, documentModel: object }}
 */
function createFarWeakUnmatchedPlacement() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'U1',
                    mountSide: 'top',
                    rotationDeg: 315,
                    positionMil: { x: 100, y: 100, z: 40 },
                    bodyPositionMil: { x: 100, y: 100 },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'ALT_BODY.step',
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
                        x: 450,
                        y: 100,
                        layer: 'TOP',
                        pattern: 'UNRELATED_BODY',
                        source: 'UNRELATED_SOURCE',
                        rotation: 0
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'ALT_BODY',
                        name: 'ALT_BODY.step',
                        positionMil: { x: 100, y: 100 },
                        modelRotationDeg: { x: 0, y: 0, z: 315 },
                        standoffHeightMil: 0,
                        overallHeightMil: 20
                    }
                ]
            }
        }
    }
}

/**
 * Builds a scene with a far body whose delimited part token proves ownership.
 * @returns {{ scene: object, documentModel: object }}
 */
function createFarDelimitedMetadataPlacement() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'U1',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 100, y: 100, z: 40 },
                    bodyPositionMil: { x: 100, y: 100 },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'AB1234CD_10x20.step',
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
                        x: 450,
                        y: 100,
                        layer: 'TOP',
                        pattern: 'FAKE_MAIN_PACKAGE',
                        source: 'AB1234CD',
                        rotation: 180
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'AB1234CD_10x20',
                        name: 'AB1234CD_10x20.step',
                        positionMil: { x: 100, y: 100 },
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 40
                    }
                ]
            }
        }
    }
}

/**
 * Builds a scene with a far body whose generic source prefix should not hide
 * the package token shared with the owning component.
 * @returns {{ scene: object, documentModel: object }}
 */
function createFarLibraryPackagePlacement() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'U7',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 180, y: 120, z: 40 },
                    bodyPositionMil: { x: 180, y: 120 },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'FAKE_LIBRARY-PKG-16.step',
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
                        x: 430,
                        y: 250,
                        layer: 'TOP',
                        pattern: 'PKG-16',
                        source: 'BRIDGE_PART',
                        rotation: 270
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'FAKE_LIBRARY-PKG-16',
                        name: 'FAKE_LIBRARY-PKG-16.step',
                        positionMil: { x: 180, y: 120 },
                        modelRotationDeg: { x: 90, y: 0, z: 90 },
                        standoffHeightMil: 0,
                        overallHeightMil: 60
                    }
                ]
            }
        }
    }
}

/**
 * Builds a minimal prepared STEP box payload.
 * @returns {{ positions: Float32Array, normals: Float32Array, indices: Uint32Array, faceColors: object[] }}
 */
function createPreparedBoxPayload() {
    return {
        positions: new Float32Array([
            -0.05, 0, 0, 0.05, 0, 0, 0.05, 0.1, 0, -0.05, 0.1, 0, -0.05, 0,
            0.02, 0.05, 0, 0.02, 0.05, 0.1, 0.02, -0.05, 0.1, 0.02
        ]),
        normals: new Float32Array(),
        indices: new Uint32Array([
            0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6,
            2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0
        ]),
        faceColors: []
    }
}

/**
 * Creates a registry that resolves every embedded component body.
 * @returns {object}
 */
function createModelRegistry(preparedMeshPayloads = null) {
    return {
        /**
         * @returns {null}
         */
        resolveComponentModel() {
            return null
        },

        /**
         * @param {object} componentBody Component body.
         * @returns {object}
         */
        resolveComponentBodyModel(componentBody) {
            return {
                origin: 'embedded',
                name: componentBody.name,
                format: 'step',
                preparedMeshPayloads
            }
        }
    }
}

/**
 * Verifies exact body anchors beat weak package-token affinity.
 */
test('ECAD 3D service keeps exact Altium body anchors on their footprint side', () => {
    const scene = PcbScene3dBuilder.build(createExactBodyAnchorDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'SB1')
    assert.equal(placement.mountSide, 'bottom')
    assert.equal(placement.rotationDeg, 270)
    assert.equal(placement.positionMil.z, -40)
})

/**
 * Verifies exact Altium body owners keep the authored body yaw.
 */
test('ECAD 3D service preserves Altium body yaw for exact body owners', () => {
    const scene = PcbScene3dBuilder.build(createExactRotationDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U1')
    assert.equal(placement.rotationDeg, 90)
})

/**
 * Verifies square pin-1 IC bodies use the same corner convention as rendered
 * Altium footprints.
 */
test('ECAD 3D service corrects exact square IC pin-one body yaw', () => {
    const scene = PcbScene3dBuilder.build(createSquarePinOnePackageDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U1')
    assert.equal(placement.rotationDeg, 270)
})

/**
 * Verifies tilted Altium body transforms stay in the renderer's signed local
 * convention.
 */
test('ECAD 3D service preserves signed Altium local tilt rotations', () => {
    const scene = PcbScene3dBuilder.build(createTiltedExactRotationDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'J1')
    assert.equal(placement.rotationDeg, 270)
    assert.deepEqual(placement.modelTransform.rotationDeg, {
        x: -90,
        y: -0,
        z: 0
    })
})

/**
 * Verifies offset Altium connector bodies can recover their component owner.
 */
test('ECAD 3D service matches offset Altium bodies from part metadata', () => {
    const scene = PcbScene3dBuilder.build(
        createMetadataMatchedOffsetDocument(),
        {
            boardThicknessMil: 80,
            modelRegistry: createModelRegistry()
        }
    )
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'J2')
    assert.equal(placement.mountSide, 'top')
    assert.equal(placement.rotationDeg, 270)
    assert.equal(placement.positionMil.z, 40)
})

/**
 * Verifies a near anchor beats a far weak package-name owner.
 */
test('ECAD 3D service repairs far Altium owners from near anchors', () => {
    const scene = PcbScene3dBuilder.build(createNearAnchorRecoveryDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U1')
    assert.equal(placement.mountSide, 'bottom')
    assert.equal(placement.rotationDeg, 90)
    assert.equal(placement.positionMil.z, -40)
})

/**
 * Verifies overlarge negative Altium body standoffs cannot sink seated STEP
 * models below the PCB face.
 */
test('ECAD 3D service clamps overlarge Altium negative standoffs', () => {
    const scene = PcbScene3dBuilder.build(createNegativeStandoffDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry([createPreparedBoxPayload()])
    })

    assert.equal(scene.externalPlacements[0].modelTransform.dzMil, 0)
})

/**
 * Verifies in-envelope bottom Altium body standoffs do not override viewer
 * seating for matched embedded models.
 */
test('ECAD 3D service seats in-envelope bottom Altium standoffs from bounds', () => {
    const scene = PcbScene3dBuilder.build(createNegativeStandoffDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry([createPreparedBoxPayload()])
    })

    assert.equal(scene.externalPlacements[1].mountSide, 'bottom')
    assert.equal(scene.externalPlacements[1].modelTransform.dzMil, 0)
})

/**
 * Verifies top-side tilted edge connectors face away from the board edge after
 * their authored in-envelope standoff is preserved.
 */
test('ECAD 3D service flips top tilted Altium edge connector yaw outward', () => {
    const scene = PcbScene3dBuilder.build(createNegativeStandoffDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry([createPreparedBoxPayload()])
    })

    assert.equal(scene.externalPlacements[2].modelTransform.dzMil, -40)
    assert.equal(scene.externalPlacements[2].rotationDeg, 90)
})

/**
 * Verifies positive Altium body standoffs are not blindly added after the
 * shared model loader already seats a source-origin body on the board face.
 */
test('ECAD 3D service does not add positive Altium body standoffs', () => {
    const scene = PcbScene3dBuilder.build(createPositiveStandoffDocument(), {
        boardThicknessMil: 80,
        modelRegistry: createModelRegistry([createPreparedBoxPayload()])
    })

    assert.equal(scene.externalPlacements[0].modelTransform.dzMil, 0)
})

/**
 * Verifies a far weak package match is removed when neither anchor nor
 * metadata confirms ownership.
 */
test('ECAD 3D service drops far Altium bodies without reliable ownership', () => {
    const { scene, documentModel } = createFarWeakUnmatchedPlacement()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 0)
})

/**
 * Verifies package dimensions after a part token do not make a far but
 * metadata-confirmed body look unreliable.
 */
test('ECAD 3D service keeps far Altium bodies matched by delimited part tokens', () => {
    const { scene, documentModel } = createFarDelimitedMetadataPlacement()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U1')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 180)
})

/**
 * Verifies generic source-library prefixes do not prevent package-token body
 * ownership recovery for offset Altium models.
 */
test('ECAD 3D service keeps far Altium bodies matched by library package tokens', () => {
    const { scene, documentModel } = createFarLibraryPackagePlacement()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(repaired.externalPlacements[0].designator, 'U7')
    assert.equal(repaired.externalPlacements[0].rotationDeg, 270)
})
