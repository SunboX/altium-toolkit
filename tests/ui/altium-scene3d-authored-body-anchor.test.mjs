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
                    identifier: 'Fixture Offset Anchor',
                    name: 'Fixture-Offset-Anchor.step',
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
                    pattern: 'Fixture Offset Anchor',
                    source: 'Fixture Offset Anchor',
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
        resolveComponentBodyModel() {
            return {
                origin: 'embedded',
                name: 'Fixture-Offset-Anchor.step',
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
