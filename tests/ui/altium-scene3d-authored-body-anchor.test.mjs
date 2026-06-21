import assert from 'node:assert/strict'
import test from 'node:test'
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
