import test from 'node:test'
import assert from 'node:assert/strict'
import { PcbScene3dComponentGeometryResolver } from '../../src/ui/PcbScene3dComponentGeometryResolver.mjs'
import { AltiumScene3dBodyPlacementIndex } from '../../src/ui/AltiumScene3dBodyPlacementIndex.mjs'

test('pad indexing preserves numeric owners and explicit mounted-surface preference', () => {
    const component = { componentIndex: 0, layer: 'TOP' }
    const top = { componentIndex: '0', hasTopPasteMaskOpening: true }
    const bottom = { componentIndex: null, hasBottomPasteMaskOpening: true }
    const drilled = { componentIndex: '', holeDiameter: 20 }
    const unowned = { componentIndex: undefined }
    const resolver = new PcbScene3dComponentGeometryResolver(
        [component],
        [top, bottom, drilled, unowned]
    )

    assert.deepEqual(resolver.componentPads(component), [top])
    assert.deepEqual(resolver.componentPads(component, 'BOTTOM'), [bottom])
    assert.deepEqual(resolver.componentPads({ componentIndex: 7 }), [])
    assert.deepEqual(resolver.componentPads({}), [])
    assert.equal(resolver.componentHasThroughHolePads(component), false)
})

test('drilled-pad owner recovery preserves distance and source-order ties', () => {
    const first = { componentIndex: 2, x: 30, y: 0 }
    const second = { componentIndex: 1, x: -30, y: 0 }
    const pads = [
        { componentIndex: 1, x: 0, y: 0, holeDiameter: 20 },
        { componentIndex: 2, x: 0, y: 0, holeGeometry: { slotLength: 20 } }
    ]
    const resolver = new PcbScene3dComponentGeometryResolver(
        [first, second],
        pads
    )

    assert.equal(
        resolver.resolveComponentFromOwnedDrilledPad({ x: 0, y: 0 }),
        first
    )
    assert.equal(
        resolver.resolveComponentFromOwnedDrilledPad({ x: -11, y: 0 }),
        second
    )
    assert.equal(
        resolver.resolveComponentFromOwnedDrilledPad({ x: -11.001, y: 0 }),
        null
    )
    assert.equal(
        resolver.resolveComponentFromOwnedDrilledPad({ x: NaN, y: 0 }),
        null
    )
})

test('new geometry contexts see pad ownership and geometry edits', () => {
    const first = { componentIndex: 1, x: 0, y: 0 }
    const second = { componentIndex: 2, x: 100, y: 0 }
    const pad = { componentIndex: 1, x: 0, y: 0, holeDiameter: 20 }
    const initial = new PcbScene3dComponentGeometryResolver(
        [first, second],
        [pad]
    )
    assert.equal(
        initial.resolveComponentFromOwnedDrilledPad({ x: 0, y: 0 }),
        first
    )

    pad.componentIndex = 2
    pad.x = 100
    const next = new PcbScene3dComponentGeometryResolver([first, second], [pad])
    assert.deepEqual(next.componentPads(first), [])
    assert.equal(
        next.resolveComponentFromOwnedDrilledPad({ x: 100, y: 0 }),
        second
    )
})

test('body indexes preserve source ordering across cell boundaries', () => {
    const first = { name: 'FAKE_BODY.step', positionMil: { x: 0.005, y: 0 } }
    const second = { name: 'FAKE_BODY.step', positionMil: { x: -0.005, y: 0 } }
    const placement = {
        externalModel: { name: 'FAKE_BODY.step' },
        bodyPositionMil: { x: 0, y: 0 }
    }
    const index = new AltiumScene3dBodyPlacementIndex([first, second])
    assert.equal(index.resolve(placement), first)
})

test('body indexes prefer matching identity within tolerance and rebuild after edits', () => {
    const near = { name: 'FAKE_NEAR.step', positionMil: { x: 0, y: 0 } }
    const matching = {
        name: 'FAKE_BODY.step',
        positionMil: { x: -0.009, y: 0 }
    }
    const outside = { name: 'FAKE_BODY.step', positionMil: { x: 0.011, y: 0 } }
    const placement = {
        externalModel: { name: 'FAKE_BODY.step' },
        bodyPositionMil: { x: 0, y: 0 }
    }
    assert.equal(
        new AltiumScene3dBodyPlacementIndex([near, matching, outside]).resolve(
            placement
        ),
        matching
    )

    matching.positionMil.x = -1
    assert.equal(
        new AltiumScene3dBodyPlacementIndex([near, matching, outside]).resolve(
            placement
        ),
        near
    )
})
