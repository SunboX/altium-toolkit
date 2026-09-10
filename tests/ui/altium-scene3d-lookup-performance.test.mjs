import test from 'node:test'
import assert from 'node:assert/strict'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/** Creates a synthetic board with distinct, two-pad footprint owners. */
function createBoard(count = 24) {
    const components = Array.from({ length: count }, (_, index) => ({
        componentIndex: index,
        designator: `X${index + 1}`,
        x: index * 500 + 200,
        y: 200,
        rotation: 0,
        layer: 'TOP',
        pattern: 'FAKE_BODY'
    }))
    return {
        sourceFormat: 'altium',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: count * 500,
                heightMil: 500
            },
            components,
            pads: components.flatMap((component) =>
                [-30, 30].map((offset) => ({
                    componentIndex: component.componentIndex,
                    x: component.x + offset,
                    y: component.y,
                    sizeTopX: 20,
                    sizeTopY: 20,
                    hasTopPasteMaskOpening: true
                }))
            )
        }
    }
}

/** Counts source owner reads while retaining the real numeric pad data. */
function countOwnerReads(pads) {
    const counter = { reads: 0 }
    for (const pad of pads) {
        const owner = pad.componentIndex
        Object.defineProperty(pad, 'componentIndex', {
            enumerable: true,
            get() {
                counter.reads += 1
                return owner
            }
        })
    }
    return counter
}

test('scene footprint preparation does not rescan every pad for every owner', () => {
    const document = createBoard()
    const counter = countOwnerReads(document.pcb.pads)
    const scene = PcbScene3dBuilder.build(document)

    assert.equal(scene.components.length, 24)
    assert.equal(scene.components[0].rotationDeg, 0)
    assert.equal(scene.components[23].designator, 'X24')
    assert.ok(
        counter.reads <= document.pcb.pads.length * 20,
        `expected bounded pad owner reads, observed ${counter.reads}`
    )
})

test('placement matching only reads identity for bodies near its anchor', () => {
    const document = createBoard(1)
    let distantIdentityReads = 0
    document.pcb.componentBodies = Array.from({ length: 80 }, (_, index) => ({
        positionMil: { x: 1000 + index * 100, y: 200 },
        get identifier() {
            distantIdentityReads += 1
            return 'FAKE_REMOTE'
        },
        name: 'FAKE_REMOTE.step'
    }))
    document.pcb.componentBodies.push({
        identifier: 'FAKE_LOCAL',
        name: 'FAKE_LOCAL.step',
        positionMil: { x: 200, y: 200 },
        modelRotationDeg: { x: 90, y: 0, z: 0 }
    })
    const source = {
        sourceFormat: 'altium',
        board: { thicknessMil: 80 },
        externalPlacements: [
            {
                designator: 'X1',
                mountSide: 'top',
                bodyPositionMil: { x: 200, y: 200 },
                positionMil: { x: 200, y: 200, z: 40 },
                modelTransform: { rotationDeg: { x: 0, y: 0, z: 0 } },
                externalModel: { name: 'FAKE_LOCAL.step', origin: 'embedded' }
            }
        ]
    }

    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        source,
        document
    )

    assert.equal(repaired.externalPlacements[0].designator, 'X1')
    assert.equal(repaired.externalPlacements[0].modelTransform.rotationDeg.x, 0)
    assert.equal(distantIdentityReads, 0)
})
