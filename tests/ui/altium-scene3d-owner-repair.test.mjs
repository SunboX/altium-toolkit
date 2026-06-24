import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds a fake scene where a metadata-owned body has a nearby unrelated
 * footprint anchor.
 * @returns {{ scene: object, documentModel: object }}
 */
function createMetadataOwnedOffsetBodyCase() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { centerX: 500, centerY: 250, thicknessMil: 80 },
            externalPlacements: [
                {
                    designator: 'U1',
                    mountSide: 'bottom',
                    rotationDeg: 180,
                    positionMil: { x: 300, y: 120, z: -40 },
                    bodyPositionMil: { x: 900, y: 320 },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0
                    },
                    projection: { source: 'pad-fallback' },
                    externalModel: {
                        origin: 'embedded',
                        name: 'FAKE_MAIN_123.step',
                        format: 'step'
                    }
                }
            ]
        },
        documentModel: {
            sourceFormat: 'altium',
            kind: 'pcb',
            fileName: 'owner-repair-fake.PcbDoc',
            pcb: {
                components: [
                    {
                        designator: 'U1',
                        x: 500,
                        y: 320,
                        layer: 'BOTTOM',
                        pattern: 'FAKE_MAIN_123',
                        source: 'FAKE_MAIN_123_SOURCE',
                        rotation: 180,
                        parameters: {
                            'Package Token': 'FAKE_MAIN_123'
                        }
                    },
                    {
                        designator: 'L1',
                        x: 910,
                        y: 320,
                        layer: 'TOP',
                        pattern: 'FAKE_NEARBY_ANCHOR',
                        source: 'FAKE_NEARBY_SOURCE',
                        rotation: 270
                    }
                ],
                componentBodies: [
                    {
                        identifier: 'FAKE_MAIN_123',
                        name: 'FAKE_MAIN_123.step',
                        layer: 'MECHANICAL13',
                        positionMil: { x: 900, y: 320 },
                        rotationDeg: 180,
                        modelRotationDeg: { x: -90, y: 0, z: 0 },
                        dzMil: 0,
                        standoffHeightMil: 0,
                        overallHeightMil: 40,
                        embedded: true
                    }
                ],
                pads: []
            }
        }
    }
}

/**
 * Builds a fake scene with an authored mechanical model whose body anchor is
 * offset from the owning hardware component center.
 * @returns {{ scene: object, documentModel: object }}
 */
function createMechanicalOffsetBodyCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'MECH1',
            mountSide: 'top',
            positionMil: { x: 120, y: 180, z: 40 },
            bodyPositionMil: { x: 620, y: 430 },
            projection: { source: 'pad-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'FAKE_BOX_123.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'MECH1',
                    x: 900,
                    y: 150,
                    layer: 'TOP',
                    pattern: 'FAKE_SHIELD_FRAME',
                    source: 'FAKE_MECHANICAL_HARDWARE',
                    rotation: 0
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_BOX_123',
                    name: 'FAKE_BOX_123.step',
                    positionMil: { x: 620, y: 430 },
                    modelRotationDeg: { x: -90, y: 0, z: 0 },
                    overallHeightMil: 80
                }
            ]
        })
    }
}

/**
 * Builds a fake shield-cover scene whose source model origin is a cover corner.
 * @returns {{ scene: object, documentModel: object }}
 */
function createShieldCoverSourceOriginCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'SH1',
            mountSide: 'top',
            positionMil: { x: -115, y: 465, z: 40 },
            bodyPositionMil: { x: 385, y: 715 },
            projection: {
                source: 'pad-fallback',
                boundsMil: { width: 160, depth: 160, height: 40 }
            },
            externalModel: {
                origin: 'embedded',
                name: 'GENERIC_RF_SHIELD_COVER.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'SH1',
                    x: 700,
                    y: 400,
                    layer: 'TOP',
                    pattern: 'GENERIC_RF_SHIELD_COVER',
                    source: 'GENERIC_RF_SHIELD_COVER',
                    rotation: 0,
                    parameters: {
                        Length: '16mm',
                        Width: '16mm'
                    }
                }
            ],
            componentBodies: [
                {
                    identifier: 'GENERIC_RF_SHIELD_COVER',
                    name: 'GENERIC_RF_SHIELD_COVER.step',
                    positionMil: { x: 385, y: 715 },
                    modelRotationDeg: { x: -90, y: 0, z: 0 },
                    overallHeightMil: 40
                }
            ]
        })
    }
}

/**
 * Builds a fake scene with a model-anchor body near an unrelated passive.
 * @returns {{ scene: object, documentModel: object }}
 */
function createModelAnchorNearPassiveCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'FAKE_CONNECTOR_BODY',
            mountSide: 'top',
            positionMil: { x: 160, y: 120, z: 40 },
            bodyPositionMil: { x: 660, y: 370 },
            projection: { source: 'model-anchor-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'FAKE_CONNECTOR_BODY.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'R1',
                    x: 670,
                    y: 370,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_PASSIVE_0402',
                    source: 'FAKE_PASSIVE_SOURCE',
                    rotation: 90
                }
            ]
        })
    }
}

/**
 * Builds a fake scene where an unmatched model-anchor pin-header body is just
 * outside the exact-anchor tolerance but close to a compatible header owner.
 * @returns {{ scene: object, documentModel: object }}
 */
function createModelAnchorNearHeaderCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'FAKE_PIN_HEADER_BODY',
            mountSide: 'bottom',
            rotationDeg: 270,
            positionMil: { x: 225, y: 155, z: -40 },
            bodyPositionMil: { x: 725, y: 405 },
            projection: { source: 'model-anchor-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'FAKE_PINHEADER_2P.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'JP1',
                    x: 725,
                    y: 380,
                    layer: 'TOP',
                    pattern: 'FAKE_HEADER_2X1_TH',
                    source: 'FAKE_HEADER_2X1',
                    rotation: 270
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_PINHEADER_2P',
                    name: 'FAKE_PINHEADER_2P.step',
                    positionMil: { x: 725, y: 405 },
                    modelRotationDeg: { x: -90, y: 0, z: 270 },
                    overallHeightMil: 80
                }
            ]
        })
    }
}

/**
 * Builds a fake model-anchor connector recovered by part-code metadata.
 * @returns {{ scene: object, documentModel: object }}
 */
function createGenericDescriptorTokenCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'GENERIC_CRYSTAL_SERIES',
            mountSide: 'top',
            positionMil: { x: 180, y: 130, z: 40 },
            bodyPositionMil: { x: 680, y: 380 },
            projection: { source: 'model-anchor-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'GENERIC_CRYSTAL_7M_SERIES.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'U1',
                    x: 720,
                    y: 380,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_CLOCK_BUFFER',
                    source: 'FAKE_CLOCK_SOURCE',
                    rotation: 0,
                    parameters: {
                        Input: 'Crystal'
                    }
                }
            ]
        })
    }
}

/**
 * Builds a fake scene where passive package-size text would otherwise steal a
 * far body from its weak current owner.
 * @returns {{ scene: object, documentModel: object }}
 */
function createPassivePackageMetadataCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'R1',
            mountSide: 'top',
            positionMil: { x: 120, y: 120, z: 40 },
            bodyPositionMil: { x: 620, y: 430 },
            projection: { source: 'pad-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'FAKE_RES_0402_1005.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'R1',
                    x: 500,
                    y: 260,
                    layer: 'TOP',
                    pattern: 'FAKE_RES0201',
                    source: 'FAKE_RES0402',
                    rotation: 90
                },
                {
                    designator: 'R2',
                    x: 900,
                    y: 430,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_RES01005',
                    source: 'FAKE_RES0402',
                    rotation: 180,
                    parameters: {
                        Package: 'FAKE_RES0402 1005'
                    }
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_RES_0402_1005',
                    name: 'FAKE_RES_0402_1005.step',
                    positionMil: { x: 620, y: 430 },
                    modelRotationDeg: { x: 0, y: 0, z: 0 },
                    overallHeightMil: 40
                }
            ]
        })
    }
}

/**
 * Builds a fake scene where a generic passive body is assigned to its owner
 * but still carries a moderate source-body offset.
 * @returns {{ scene: object, documentModel: object }}
 */
function createPassiveOffsetOwnerCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'R1',
            mountSide: 'top',
            positionMil: { x: 270, y: 130, z: 40 },
            bodyPositionMil: { x: 770, y: 380 },
            projection: { source: 'pad-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'FAKE_RES_0402.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'R1',
                    x: 700,
                    y: 380,
                    layer: 'TOP',
                    pattern: 'FAKE_RES0402',
                    source: 'FAKE_RES0402',
                    rotation: 90
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_RES_0402',
                    name: 'FAKE_RES_0402.step',
                    positionMil: { x: 770, y: 380 },
                    modelRotationDeg: { x: 0, y: 0, z: 0 },
                    overallHeightMil: 20
                }
            ]
        })
    }
}

/**
 * Builds a fake scene where a single IC body is assigned to its owner but its
 * model source origin is offset from the footprint center.
 * @returns {{ scene: object, documentModel: object }}
 */
function createIcOffsetOwnerCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'U1',
            mountSide: 'top',
            rotationDeg: 180,
            positionMil: { x: 360, y: 320, z: 40 },
            bodyPositionMil: { x: 860, y: 570 },
            projection: { source: 'pad-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'FAKE_CONTROLLER_123.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'U1',
                    x: 620,
                    y: 390,
                    layer: 'TOP',
                    pattern: 'FAKE_CONTROLLER_123_QFN',
                    source: 'FAKE_CONTROLLER_123',
                    rotation: 180,
                    parameters: {
                        Package: 'QFN'
                    }
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_CONTROLLER_123',
                    name: 'FAKE_CONTROLLER_123.step',
                    positionMil: { x: 860, y: 570 },
                    modelRotationDeg: { x: 0, y: 0, z: 180 },
                    overallHeightMil: 40
                }
            ]
        })
    }
}

/**
 * Builds a fake scene where a compact IC package has a small but visible
 * model source-origin offset from its footprint center.
 * @returns {{ scene: object, documentModel: object }}
 */
function createSmallIcOffsetOwnerCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'U2',
            mountSide: 'bottom',
            rotationDeg: 180,
            positionMil: { x: 217, y: 142, z: -40 },
            bodyPositionMil: { x: 717, y: 392 },
            projection: { source: 'pad-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'FAKE_LEVEL_SHIFTER_QFN.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'U2',
                    x: 700,
                    y: 380,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_LEVEL_SHIFTER_QFN16',
                    source: 'FAKE_LEVEL_SHIFTER',
                    rotation: 180,
                    parameters: {
                        Package: 'QFN-16'
                    }
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_LEVEL_SHIFTER_QFN',
                    name: 'FAKE_LEVEL_SHIFTER_QFN.step',
                    positionMil: { x: 717, y: 392 },
                    modelRotationDeg: { x: 180, y: 0, z: 180 },
                    overallHeightMil: 22
                }
            ]
        })
    }
}

/**
 * Builds a fake scene with a pad-fallback connector body whose source origin
 * is offset from the footprint center.
 * @returns {{ scene: object, documentModel: object }}
 */
function createPadFallbackConnectorOriginOffsetCase() {
    return {
        scene: createSinglePlacementScene({
            designator: 'J1',
            mountSide: 'bottom',
            rotationDeg: 0,
            positionMil: { x: 180, y: 110, z: -40 },
            bodyPositionMil: { x: 680, y: 360 },
            projection: { source: 'pad-fallback' },
            externalModel: {
                origin: 'embedded',
                name: 'FAKE_FLEX_SOCKET_BODY.step',
                format: 'step'
            }
        }),
        documentModel: createOwnerRepairDocument({
            components: [
                {
                    designator: 'J1',
                    x: 680,
                    y: 430,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_FLEX_SOCKET_CONN',
                    source: 'FAKE_FLEX_CONNECTOR',
                    rotation: 0,
                    parameters: {
                        Description:
                            'Fake FPC connector contacts, surface mount'
                    }
                }
            ],
            componentBodies: [
                {
                    identifier: 'FAKE_FLEX_SOCKET_BODY',
                    name: 'FAKE_FLEX_SOCKET_BODY.step',
                    positionMil: { x: 680, y: 360 },
                    modelRotationDeg: { x: 90, y: 0, z: 0 },
                    overallHeightMil: 40
                }
            ]
        })
    }
}

/**
 * Builds a fake scene with repeated unnamed connector bodies whose source
 * origin is offset from compatible footprint centers by a shared vector.
 * @returns {{ scene: object, documentModel: object }}
 */
function createRepeatedConnectorOriginOffsetCase() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { centerX: 1000, centerY: 500, thicknessMil: 80 },
            externalPlacements: [
                createOffsetConnectorPlacement(0, 1200, 700, 90),
                createOffsetConnectorPlacement(1, 1400, 700, 90),
                createOffsetConnectorPlacement(2, 1600, 700, 90)
            ]
        },
        documentModel: createOwnerRepairDocument({
            components: [
                createFakeConnectorComponent('K1', 1200, 580),
                createFakeConnectorComponent('K2', 1400, 580),
                createFakeConnectorComponent('K3', 1600, 580)
            ]
        })
    }
}

/**
 * Builds a fake scene with repeated timing-package bodies whose source origin
 * is offset from compatible footprint centers by a shared vector.
 * @returns {{ scene: object, documentModel: object }}
 */
function createRepeatedTimingPackageOriginOffsetCase() {
    return {
        scene: {
            sourceFormat: 'altium',
            board: { centerX: 1000, centerY: 500, thicknessMil: 80 },
            externalPlacements: [
                createOffsetTimingPlacement(0, 1275, 730),
                createOffsetTimingPlacement(1, 1475, 730)
            ]
        },
        documentModel: createOwnerRepairDocument({
            components: [
                createFakeTimingComponent('Y1', 1300, 680),
                createFakeTimingComponent('Y2', 1500, 680)
            ]
        })
    }
}

/**
 * Builds one fake connector placement at an authored offset from the owner.
 * @param {number} index Sequence index.
 * @param {number} x Component center X.
 * @param {number} bodyY Authored body Y.
 * @param {number} rotation Rotation in degrees.
 * @returns {object}
 */
function createOffsetConnectorPlacement(index, x, bodyY, rotation) {
    return {
        designator: 'FAKE_SHARED_RF_SOCKET',
        mountSide: 'top',
        rotationDeg: rotation,
        positionMil: { x: x - 1000, y: bodyY - 500, z: 40 },
        bodyPositionMil: { x, y: bodyY },
        projection: { source: 'model-anchor-fallback' },
        modelTransform: {
            rotationDeg: { x: -180, y: 0, z: 0 },
            dzMil: 0
        },
        externalModel: {
            origin: 'embedded',
            name: 'FAKE_SHARED_RF_SOCKET.step',
            format: 'step',
            sourceStream: 'Models/' + index
        }
    }
}

/**
 * Builds one fake connector component.
 * @param {string} designator Component designator.
 * @param {number} x Component center X.
 * @param {number} y Component center Y.
 * @returns {object}
 */
function createFakeConnectorComponent(designator, x, y) {
    return {
        designator,
        x,
        y,
        layer: 'TOP',
        pattern: 'FAKE_RF_SOCKET_CONN',
        source: 'FAKE_RF_CONNECTOR',
        rotation: 90,
        parameters: {
            Description: 'Fake RF connector socket'
        }
    }
}

/**
 * Builds one fake timing-package placement at an authored owner offset.
 * @param {number} index Sequence index.
 * @param {number} bodyX Authored body X.
 * @param {number} bodyY Authored body Y.
 * @returns {object}
 */
function createOffsetTimingPlacement(index, bodyX, bodyY) {
    return {
        designator: 'FAKE_TIMING_BODY',
        mountSide: 'top',
        rotationDeg: 270,
        positionMil: { x: bodyX - 1000, y: bodyY - 500, z: 40 },
        bodyPositionMil: { x: bodyX, y: bodyY },
        projection: { source: 'model-anchor-fallback' },
        modelTransform: {
            rotationDeg: { x: 0, y: 0, z: 0 },
            dzMil: 0
        },
        externalModel: {
            origin: 'embedded',
            name: 'FAKE_TIMING_OSCILLATOR.step',
            format: 'step',
            sourceStream: 'Models/Timing/' + index
        }
    }
}

/**
 * Builds one fake timing-package component.
 * @param {string} designator Component designator.
 * @param {number} x Component center X.
 * @param {number} y Component center Y.
 * @returns {object}
 */
function createFakeTimingComponent(designator, x, y) {
    return {
        designator,
        x,
        y,
        layer: 'TOP',
        pattern: 'FAKE_TIMING_OSC',
        source: 'FAKE_OSCILLATOR_PACKAGE',
        rotation: 270,
        parameters: {
            Description: 'Synthetic timing oscillator package'
        }
    }
}

/**
 * Builds a one-placement fake Altium scene.
 * @param {object} placement External model placement overrides.
 * @returns {object}
 */
function createSinglePlacementScene(placement) {
    return {
        sourceFormat: 'altium',
        board: { centerX: 500, centerY: 250, thicknessMil: 80 },
        externalPlacements: [
            {
                rotationDeg: 0,
                modelTransform: {
                    rotationDeg: { x: -90, y: 0, z: 0 },
                    dzMil: 0
                },
                ...placement
            }
        ]
    }
}

/**
 * Builds a fake Altium document for owner repair tests.
 * @param {{ components?: object[], componentBodies?: object[] }} pcb PCB data.
 * @returns {object}
 */
function createOwnerRepairDocument(pcb) {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'owner-repair-fake.PcbDoc',
        pcb: {
            components: pcb.components || [],
            componentBodies: pcb.componentBodies || [],
            pads: []
        }
    }
}

/**
 * Verifies nearby unrelated anchors do not take ownership from a far body whose
 * current owner is confirmed by source metadata.
 */
test('Altium 3D owner repair keeps metadata-confirmed offset bodies', () => {
    const { scene, documentModel } = createMetadataOwnedOffsetBodyCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(placement.designator, 'U1')
    assert.equal(placement.mountSide, 'bottom')
    assert.equal(placement.positionMil.z, -40)
})

/**
 * Verifies authored mechanical hardware bodies survive even when their body
 * anchor is not near the component center.
 */
test('Altium 3D owner repair keeps authored mechanical offset bodies', () => {
    const { scene, documentModel } = createMechanicalOffsetBodyCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(placement.designator, 'MECH1')
    assert.equal(placement.mountSide, 'top')
    assert.equal(placement.positionMil.z, 40)
})

/**
 * Verifies shield covers whose source origin sits at a package corner are
 * centered on the cover owner instead of preserved as authored offsets.
 */
test('Altium 3D owner repair centers shield cover source-origin offsets', () => {
    const { scene, documentModel } = createShieldCoverSourceOriginCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(placement.designator, 'SH1')
    assert.equal(placement.mountSide, 'top')
    assert.deepEqual(placement.positionMil, { x: 200, y: 150, z: 40 })
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: -315,
        y: 315
    })
    assert.deepEqual(placement.modelTransform.offsetMil, {
        x: -315,
        y: 315,
        z: 0
    })
})

/**
 * Verifies model-anchor placements are not reassigned by loose proximity to an
 * unrelated nearby footprint.
 */
test('Altium 3D owner repair keeps model-anchor bodies on their authored side', () => {
    const { scene, documentModel } = createModelAnchorNearPassiveCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(placement.designator, 'FAKE_CONNECTOR_BODY')
    assert.equal(placement.mountSide, 'top')
    assert.equal(placement.positionMil.z, 40)
})

/**
 * Verifies near model-anchor headers can attach to compatible footprint
 * owners instead of remaining on the wrong side.
 */
test('Altium 3D owner repair centers near model-anchor headers', () => {
    const { scene, documentModel } = createModelAnchorNearHeaderCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(placement.designator, 'JP1')
    assert.equal(placement.mountSide, 'top')
    assert.deepEqual(placement.positionMil, { x: 225, y: 130, z: 40 })
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: 0,
        y: 25
    })
})

test('Altium 3D owner repair ignores generic descriptor metadata tokens', () => {
    const { scene, documentModel } = createGenericDescriptorTokenCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(repaired.externalPlacements.length, 1)
    assert.equal(placement.designator, 'GENERIC_CRYSTAL_SERIES')
    assert.equal(placement.mountSide, 'top')
    assert.equal(placement.positionMil.z, 40)
})

/**
 * Verifies generic passive package-size metadata does not move a weak body to
 * an unrelated component.
 */
test('Altium 3D owner repair drops weak passive package-size owners', () => {
    const { scene, documentModel } = createPassivePackageMetadataCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.equal(repaired.externalPlacements.length, 0)
})

/**
 * Verifies generic passive bodies are centered on their resolved owner when
 * the source body carries a moderate offset.
 */
test('Altium 3D owner repair centers generic passive owner offsets', () => {
    const { scene, documentModel } = createPassiveOffsetOwnerCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(placement.designator, 'R1')
    assert.equal(placement.positionMil.x, 200)
    assert.equal(placement.positionMil.y, 130)
})

/**
 * Verifies single IC bodies use the same owner-centered placement when the
 * source model origin is offset from the confirmed footprint center.
 */
test('Altium 3D owner repair centers single IC owner offsets', () => {
    const { scene, documentModel } = createIcOffsetOwnerCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(placement.designator, 'U1')
    assert.equal(placement.positionMil.x, 120)
    assert.equal(placement.positionMil.y, 140)
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: 240,
        y: 180
    })
})

/**
 * Verifies compact IC package source-origin biases remain anchored to the
 * authored body position when the offset is below the owner-repair threshold.
 */
test('Altium 3D owner repair keeps small IC owner offsets', () => {
    const { scene, documentModel } = createSmallIcOffsetOwnerCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(placement.designator, 'U2')
    assert.equal(placement.positionMil.x, 217)
    assert.equal(placement.positionMil.y, 142)
    assert.equal(placement.modelTransform.ownerAnchorOffsetMil, undefined)
})

/**
 * Verifies pad-fallback connector bodies keep their authored model anchor
 * because their source origin can be intentionally offset from the footprint.
 */
test('Altium 3D owner repair keeps pad-fallback connector owner offsets', () => {
    const { scene, documentModel } =
        createPadFallbackConnectorOriginOffsetCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )
    const placement = repaired.externalPlacements[0]

    assert.equal(placement.designator, 'J1')
    assert.equal(placement.mountSide, 'bottom')
    assert.equal(placement.positionMil.x, 180)
    assert.equal(placement.positionMil.y, 110)
    assert.equal(placement.modelTransform.ownerAnchorOffsetMil, undefined)
})

/**
 * Verifies repeated unnamed connector bodies are matched by their shared
 * source-origin offset instead of being left on the authored body anchor.
 */
test('Altium 3D owner repair centers repeated connector bodies on owners', () => {
    const { scene, documentModel } = createRepeatedConnectorOriginOffsetCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.deepEqual(
        repaired.externalPlacements.map((placement) => placement.designator),
        ['K1', 'K2', 'K3']
    )
    assert.deepEqual(
        repaired.externalPlacements.map((placement) => placement.positionMil.y),
        [80, 80, 80]
    )
})

/**
 * Verifies repeated timing-package bodies use the same shared-offset owner
 * repair as connector bodies when metadata identifies compatible footprints.
 */
test('Altium 3D owner repair centers repeated timing-package bodies on owners', () => {
    const { scene, documentModel } =
        createRepeatedTimingPackageOriginOffsetCase()
    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.deepEqual(
        repaired.externalPlacements.map((placement) => placement.designator),
        ['Y1', 'Y2']
    )
    assert.deepEqual(
        repaired.externalPlacements.map((placement) => placement.positionMil.x),
        [300, 500]
    )
    assert.deepEqual(
        repaired.externalPlacements.map((placement) => placement.positionMil.y),
        [180, 180]
    )
    assert.deepEqual(
        repaired.externalPlacements.map(
            (placement) => placement.modelTransform.offsetMil
        ),
        [
            { x: -50, y: -25, z: 0 },
            { x: -50, y: -25, z: 0 }
        ]
    )
})
