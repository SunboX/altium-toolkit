import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Creates a generic Altium PCB model with one body anchor offset from its
 * matching footprint owner.
 * @returns {object}
 */
function createOffsetBodyDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'body-anchor-board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: []
            },
            primitiveLayers: [],
            pads: [
                {
                    componentIndex: 4,
                    x: 420,
                    y: 500,
                    sizeTopX: 60,
                    sizeTopY: 40,
                    hasTopPasteMaskOpening: true
                },
                {
                    componentIndex: 4,
                    x: 580,
                    y: 500,
                    sizeTopX: 60,
                    sizeTopY: 40,
                    hasTopPasteMaskOpening: true
                }
            ],
            tracks: [],
            arcs: [],
            vias: [],
            componentBodies: [
                {
                    identifier: 'Fixture Edge Connector',
                    name: 'Fixture-Edge-Connector.step',
                    layer: 'MECHANICAL13',
                    modelId: 'fixture-offset-model',
                    positionMil: { x: 500, y: 300 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 0, y: 0, z: 0 }
                }
            ],
            components: [
                {
                    componentIndex: 4,
                    designator: 'U4',
                    x: 500,
                    y: 500,
                    layer: 'TOP',
                    pattern: 'Fixture Edge Connector',
                    source: 'Connector Fixture Edge Connector',
                    rotation: 0
                }
            ]
        },
        bom: []
    }
}

/**
 * Creates a fake model registry for embedded Altium component bodies.
 * @returns {object}
 */
function createModelRegistry() {
    return {
        resolveComponentModel() {
            return null
        },
        resolveComponentBodyModel(componentBody) {
            return {
                origin: 'embedded',
                name: String(componentBody?.name || ''),
                format: 'step',
                payloadText: 'ISO-10303-21;',
                sourceStream: 'Models/4'
            }
        }
    }
}

test('PcbScene3dBuilder preserves off-anchor Altium body placements', () => {
    const scene = PcbScene3dBuilder.build(createOffsetBodyDocument(), {
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U4')
    assert.deepEqual(placement.positionMil, { x: 0, y: -200, z: 31.5 })
    assert.equal(placement.projection.source, 'authored-body-anchor')
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: 0,
        y: -200
    })
})

/**
 * Creates a generic Altium PCB model with an IC body source origin offset from
 * its matching owner footprint.
 * @returns {object}
 */
function createOffsetIcBodyDocument() {
    const documentModel = createOffsetBodyDocument()
    documentModel.pcb.componentBodies[0] = {
        ...documentModel.pcb.componentBodies[0],
        identifier: 'Fixture QFN Body',
        name: 'Fixture-QFN-Body.step'
    }
    documentModel.pcb.components[0] = {
        ...documentModel.pcb.components[0],
        pattern: 'Fixture QFN 48',
        source: 'IC Fixture QFN 48',
        parameters: {
            Package: 'QFN'
        }
    }

    return documentModel
}

/**
 * Creates a fake module body whose source origin is intentionally offset from
 * the owning footprint center.
 * @returns {object}
 */
function createOffsetModuleBodyDocument() {
    const documentModel = createOffsetBodyDocument()
    documentModel.pcb.componentBodies[0] = {
        ...documentModel.pcb.componentBodies[0],
        identifier: 'Fixture Radio Device',
        name: 'Fixture-Radio-Device.step',
        positionMil: { x: 500, y: 300 }
    }
    documentModel.pcb.components[0] = {
        ...documentModel.pcb.components[0],
        pattern: 'Fixture_RF',
        source: 'Fixture Wireless Device',
        description: 'Fake wireless module with antenna keepout',
        parameters: {
            Description: 'Fake wireless module'
        }
    }

    return documentModel
}

/**
 * Creates a fake compact IC body whose model source origin is slightly offset
 * from the owning footprint center.
 * @returns {object}
 */
function createSmallOffsetIcBodyDocument() {
    const documentModel = createOffsetIcBodyDocument()
    documentModel.pcb.componentBodies[0] = {
        ...documentModel.pcb.componentBodies[0],
        positionMil: { x: 517, y: 512 },
        modelRotationDeg: { x: 180, y: 0, z: 180 }
    }
    documentModel.pcb.components[0] = {
        ...documentModel.pcb.components[0],
        layer: 'BOTTOM',
        rotation: 180,
        pattern: 'Fixture UQFN 16',
        source: 'Fixture Level Shifter UQFN'
    }
    documentModel.pcb.pads = documentModel.pcb.pads.map((pad) => ({
        ...pad,
        hasBottomPasteMaskOpening: true,
        sizeBottomX: pad.sizeTopX,
        sizeBottomY: pad.sizeTopY
    }))

    return documentModel
}

/**
 * Creates a fake wide IC whose source description contains USB but whose
 * SOP-style footprint still defines the placement center.
 * @returns {object}
 */
function createOffsetUsbInterfaceIcDocument() {
    const documentModel = createOffsetBodyDocument()
    documentModel.pcb.componentBodies[0] = {
        ...documentModel.pcb.componentBodies[0],
        identifier: 'Fixture Library-SOP-16',
        name: 'Fixture-Library-SOP-16.step',
        positionMil: { x: 674, y: 394 },
        modelRotationDeg: { x: 90, y: 0, z: 90 }
    }
    documentModel.pcb.components[0] = {
        ...documentModel.pcb.components[0],
        pattern: 'Fixture SOP-16',
        source: 'Fixture Interface Bridge',
        description: 'Fake USB interface bridge IC',
        rotation: 90
    }
    documentModel.pcb.pads = [
        createWideIcPad(4, 325, 404),
        createWideIcPad(4, 375, 404),
        createWideIcPad(4, 425, 404),
        createWideIcPad(4, 475, 404),
        createWideIcPad(4, 525, 404),
        createWideIcPad(4, 575, 404),
        createWideIcPad(4, 625, 404),
        createWideIcPad(4, 675, 404),
        createWideIcPad(4, 325, 596),
        createWideIcPad(4, 375, 596),
        createWideIcPad(4, 425, 596),
        createWideIcPad(4, 475, 596),
        createWideIcPad(4, 525, 596),
        createWideIcPad(4, 575, 596),
        createWideIcPad(4, 625, 596),
        createWideIcPad(4, 675, 596)
    ]

    return documentModel
}

/**
 * Builds one fake wide IC surface pad.
 * @param {number} componentIndex Owning component index.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createWideIcPad(componentIndex, x, y) {
    return {
        componentIndex,
        x,
        y,
        rotation: 0,
        sizeTopX: 28,
        sizeTopY: 98,
        sizeMidX: 28,
        sizeMidY: 98,
        hasTopPasteMaskOpening: true
    }
}

/**
 * Creates a bottom-side embedded connector whose model source anchor is near
 * but not coincident with its footprint owner.
 * @returns {object}
 */
function createBottomEmbeddedConnectorSourceDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'body-anchor-board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: []
            },
            primitiveLayers: [],
            pads: [
                {
                    componentIndex: 5,
                    x: 460,
                    y: 500,
                    sizeBottomX: 20,
                    sizeBottomY: 40,
                    hasBottomPasteMaskOpening: true
                },
                {
                    componentIndex: 5,
                    x: 540,
                    y: 500,
                    sizeBottomX: 20,
                    sizeBottomY: 40,
                    hasBottomPasteMaskOpening: true
                }
            ],
            tracks: [],
            arcs: [],
            vias: [],
            componentBodies: [
                {
                    identifier: 'Fixture Board Connector',
                    name: 'Fixture-Board-Connector.step',
                    layer: 'MECHANICAL14',
                    modelId: 'fixture-bottom-connector-model',
                    positionMil: { x: 470, y: 490 },
                    rotationDeg: 0,
                    modelRotationDeg: { x: 180, y: 0, z: 90 }
                }
            ],
            components: [
                {
                    componentIndex: 5,
                    designator: 'J5',
                    x: 500,
                    y: 500,
                    layer: 'BOTTOM',
                    pattern: 'Fixture Board Connector',
                    source: 'Connector Fixture Board Connector',
                    rotation: 90
                }
            ]
        },
        bom: []
    }
}

/**
 * Creates scene data for a bottom-side embedded model anchor near its owner.
 * @returns {object}
 */
function createBottomEmbeddedConnectorScene() {
    return {
        sourceFormat: 'altium',
        board: {
            minX: 0,
            minY: 0,
            widthMil: 1000,
            heightMil: 1000,
            centerX: 500,
            centerY: 500,
            thicknessMil: 63
        },
        externalPlacements: [
            {
                designator: 'Fixture Board Connector',
                mountSide: 'bottom',
                rotationDeg: 90,
                positionMil: { x: -30, y: -10, z: -31.5 },
                bodyPositionMil: { x: 470, y: 490 },
                bodyRotationDeg: 0,
                modelTransform: {
                    rotationDeg: { x: -180, y: 0, z: 0 },
                    dzMil: 0,
                    offsetMil: { z: 0 }
                },
                projection: {
                    source: 'model-anchor-fallback',
                    reason: 'Projection used the model anchor because no owner geometry was available.',
                    boundsMil: { width: 0, depth: 0, height: 0 }
                },
                externalModel: {
                    origin: 'embedded',
                    name: 'Fixture-Board-Connector.step',
                    format: 'step',
                    payloadText: 'ISO-10303-21;',
                    sourceStream: 'Models/5'
                }
            }
        ]
    }
}

test('PcbScene3dBuilder centers IC body placements on the owner', () => {
    const scene = PcbScene3dBuilder.build(createOffsetIcBodyDocument(), {
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U4')
    assert.deepEqual(placement.positionMil, { x: 0, y: 0, z: 31.5 })
    assert.equal(placement.projection.source, 'pad-fallback')
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: 0,
        y: -200
    })
})

test('PcbScene3dBuilder preserves offset module body anchors', () => {
    const scene = PcbScene3dBuilder.build(createOffsetModuleBodyDocument(), {
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U4')
    assert.deepEqual(placement.positionMil, { x: 0, y: -200, z: 31.5 })
    assert.equal(placement.projection.source, 'authored-body-anchor')
    assert.equal(placement.modelTransform.offsetMil, undefined)
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: 0,
        y: -200
    })
})

test('PcbScene3dBuilder leaves compact IC package bodies pad-fallback aligned', () => {
    const scene = PcbScene3dBuilder.build(createSmallOffsetIcBodyDocument(), {
        modelRegistry: createModelRegistry()
    })
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U4')
    assert.deepEqual(placement.positionMil, { x: 17, y: 12, z: -31.5 })
    assert.equal(placement.projection.source, 'pad-fallback')
    assert.equal(placement.modelTransform.ownerAnchorOffsetMil, undefined)
})

test('PcbScene3dBuilder centers two-row IC bodies from SOP pad geometry', () => {
    const scene = PcbScene3dBuilder.build(
        createOffsetUsbInterfaceIcDocument(),
        {
            modelRegistry: createModelRegistry()
        }
    )
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'U4')
    assert.equal(placement.rotationDeg, 270)
    assert.deepEqual(placement.positionMil, { x: 0, y: 0, z: 31.5 })
    assert.equal(placement.projection.source, 'pad-fallback')
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: 174,
        y: -106
    })
    assert.deepEqual(placement.modelTransform.offsetMil, {
        x: 106,
        y: 174,
        z: 0
    })
})

test('AltiumScene3dExternalPlacementAdapter maps bottom embedded owner offsets through the source frame', () => {
    const scene = AltiumScene3dExternalPlacementAdapter.apply(
        createBottomEmbeddedConnectorScene(),
        createBottomEmbeddedConnectorSourceDocument()
    )
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'J5')
    assert.deepEqual(placement.positionMil, { x: 0, y: 0, z: -31.5 })
    assert.equal(placement.projection.source, 'model-anchor-fallback')
    assert.deepEqual(placement.modelTransform.ownerAnchorOffsetMil, {
        x: -30,
        y: -10
    })
    assert.deepEqual(placement.modelTransform.offsetMil, {
        x: 10,
        y: -30,
        z: 0
    })
})
