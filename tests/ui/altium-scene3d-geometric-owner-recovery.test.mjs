import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/convergence/PcbScene3dBuilder.mjs'
import { AltiumScene3dGeometricOwnerRecovery } from '../../src/ui/AltiumScene3dGeometricOwnerRecovery.mjs'

/**
 * Builds one external placement for geometric owner recovery.
 * @param {object} overrides Placement overrides.
 * @returns {object}
 */
function buildPlacement(overrides = {}) {
    return {
        designator: 'PKG_BODY',
        mountSide: 'top',
        rotationDeg: 0,
        positionMil: { x: 0, y: 0, z: 40 },
        bodyPositionMil: { x: 0, y: 0 },
        modelTransform: {
            rotationDeg: { x: 0, y: 0, z: 0 },
            dzMil: 0
        },
        projection: {
            source: 'model-bounds',
            boundsMil: { width: 100, depth: 80, height: 40 }
        },
        externalModel: {
            origin: 'embedded',
            name: 'PKG_BODY.step',
            format: 'step'
        },
        ...overrides
    }
}

/**
 * Builds one source component body matching a placement position.
 * @param {object} placement External placement.
 * @param {object} overrides Body overrides.
 * @returns {object}
 */
function buildBody(placement, overrides = {}) {
    return {
        identifier: placement.designator,
        name: placement.externalModel.name,
        positionMil: { ...placement.bodyPositionMil },
        modelRotationDeg: { x: 0, y: 0, z: placement.rotationDeg },
        overallHeightMil: placement.projection.boundsMil.height,
        standoffHeightMil: 0,
        ...overrides
    }
}

/**
 * Builds one PCB component.
 * @param {object} overrides Component fields.
 * @returns {object}
 */
function buildComponent(overrides = {}) {
    return {
        componentIndex: 1,
        designator: 'U1',
        x: 1000,
        y: 1000,
        layer: 'TOP',
        rotation: 0,
        pattern: 'PKG_A',
        source: 'LIB_A',
        description: 'Generic package',
        height: 40,
        ...overrides
    }
}

/**
 * Builds one square pad owned by a component.
 * @param {number} componentIndex Owner index.
 * @param {number} x Pad X position.
 * @param {number} y Pad Y position.
 * @param {number} [size] Pad size.
 * @param {object} [overrides] Additional pad fields.
 * @returns {object}
 */
function buildPad(componentIndex, x, y, size = 30, overrides = {}) {
    return {
        componentIndex,
        x,
        y,
        sizeTopX: size,
        sizeTopY: size,
        sizeMidX: size,
        sizeMidY: size,
        layerCode: 1,
        hasTopPasteMaskOpening: true,
        ...overrides
    }
}

/**
 * Applies the placement adapter to a synthetic PCB.
 * @param {object} placement External placement.
 * @param {object[]} components PCB components.
 * @param {object[]} bodies Source component bodies.
 * @param {object[]} pads PCB pads.
 * @returns {object}
 */
function repair(placement, components, bodies, pads) {
    return AltiumScene3dGeometricOwnerRecovery.apply(
        {
            sourceFormat: 'altium',
            board: {
                centerX: 500,
                centerY: 500,
                thicknessMil: 80
            },
            externalPlacements: [placement]
        },
        {
            pcb: { components, componentBodies: bodies, pads }
        }
    ).externalPlacements[0]
}

test('geometric owner recovery preserves an authored pad-centroid anchor', () => {
    const component = buildComponent({
        designator: 'D7',
        x: 1000,
        y: 1000,
        description: 'Four-lead protection package'
    })
    const pads = [
        buildPad(1, 1000, 1000),
        buildPad(1, 1000, 1060),
        buildPad(1, 1040, 1060),
        buildPad(1, 1120, 1000)
    ]
    const placement = buildPlacement({
        bodyPositionMil: { x: 1040, y: 1030 },
        positionMil: { x: 540, y: 530, z: 40 }
    })
    const repaired = repair(
        placement,
        [component],
        [buildBody(placement)],
        pads
    )

    assert.equal(repaired.designator, 'D7')
    assert.equal(repaired.mountSide, 'top')
    assert.deepEqual(repaired.positionMil, { x: 540, y: 530, z: 40 })
    assert.equal(repaired.modelTransform.ownerAnchorOffsetMil, undefined)
})

test('geometric owner recovery centers a proven model-corner origin', () => {
    const component = buildComponent({
        designator: 'X4',
        x: 2000,
        y: 2000,
        description: 'Frequency-control package',
        height: 42
    })
    const pads = [
        buildPad(1, 1930, 1960, 50),
        buildPad(1, 2070, 1960, 50),
        buildPad(1, 1930, 2040, 50),
        buildPad(1, 2070, 2040, 50)
    ]
    const placement = buildPlacement({
        bodyPositionMil: { x: 2098, y: 1937 },
        positionMil: { x: 1598, y: 1437, z: 40 },
        projection: {
            source: 'model-bounds',
            boundsMil: { width: 196, depth: 42, height: 126 }
        }
    })
    const repaired = repair(
        placement,
        [component],
        [buildBody(placement, { overallHeightMil: 42 })],
        pads
    )

    assert.equal(repaired.designator, 'X4')
    assert.deepEqual(repaired.positionMil, { x: 1500, y: 1500, z: 40 })
    assert.deepEqual(repaired.modelTransform.ownerAnchorOffsetMil, {
        x: 98,
        y: -63
    })
})

test('geometric owner recovery centers a multi-row package source origin', () => {
    const component = buildComponent({
        componentIndex: 9,
        designator: 'J9',
        x: 3000,
        y: 3000,
        rotation: 180,
        description: 'Dual-row through-hole header',
        height: 250
    })
    const pads = []
    for (let column = -3; column <= 3; column += 1) {
        pads.push(buildPad(9, 3000 + column * 100, 2950, 68))
        pads.push(buildPad(9, 3000 + column * 100, 3050, 68))
    }
    const placement = buildPlacement({
        designator: 'MECH_DUAL_ROW_7',
        mountSide: 'bottom',
        rotationDeg: 180,
        bodyPositionMil: { x: 2750, y: 3000 },
        positionMil: { x: 2250, y: 2500, z: -40 },
        projection: {
            source: 'model-bounds',
            boundsMil: { width: 700, depth: 458, height: 200 }
        },
        externalModel: {
            origin: 'embedded',
            name: 'MECH_DUAL_ROW_7.step',
            format: 'step'
        }
    })
    const repaired = repair(
        placement,
        [component],
        [
            buildBody(placement, {
                overallHeightMil: 337,
                standoffHeightMil: -108,
                modelRotationDeg: { x: 90, y: 0, z: 180 }
            })
        ],
        pads
    )

    assert.equal(repaired.designator, 'J9')
    assert.equal(repaired.mountSide, 'top')
    assert.deepEqual(repaired.positionMil, { x: 2500, y: 2500, z: 40 })
    assert.deepEqual(repaired.modelTransform.ownerAnchorOffsetMil, {
        x: -250,
        y: 0
    })
    assert.equal(repaired.modelTransform.dzMil, -108)
    assert.deepEqual(repaired.modelTransform.offsetMil, {
        x: 0,
        y: 0,
        z: -108
    })
})

test('geometric owner recovery uses height only with nearby footprint support', () => {
    const component = buildComponent({
        componentIndex: 10,
        designator: 'J10',
        x: 3500,
        y: 3500,
        description: 'Two-position board terminal',
        height: 196
    })
    const pads = [
        buildPad(10, 3360, 3500, 90),
        buildPad(10, 3640, 3500, 90),
        buildPad(10, 3450, 3690, 60),
        buildPad(10, 3550, 3690, 60)
    ]
    const placement = buildPlacement({
        designator: 'MECH_PACKAGE_A',
        rotationDeg: 90,
        bodyPositionMil: { x: 3390, y: 3406 },
        positionMil: { x: 2890, y: 2906, z: 40 },
        externalModel: {
            origin: 'embedded',
            name: 'MECH_PACKAGE_A.step',
            format: 'step'
        }
    })
    const repaired = repair(
        placement,
        [component],
        [buildBody(placement, { overallHeightMil: 196 })],
        pads
    )

    assert.equal(repaired.designator, 'J10')
    assert.deepEqual(repaired.positionMil, { x: 3000, y: 3000, z: 40 })
})

test('geometric owner recovery declines equally supported owners', () => {
    const left = buildComponent({
        componentIndex: 20,
        designator: 'U20',
        x: 5000,
        y: 5000
    })
    const right = buildComponent({
        componentIndex: 21,
        designator: 'U21',
        x: 5080,
        y: 5000
    })
    const pads = [
        buildPad(20, 5020, 5000),
        buildPad(20, 5060, 5000),
        buildPad(21, 5020, 5000),
        buildPad(21, 5060, 5000)
    ]
    const placement = buildPlacement({
        bodyPositionMil: { x: 5040, y: 5000 },
        positionMil: { x: 4540, y: 4500, z: 40 }
    })
    const repaired = repair(
        placement,
        [left, right],
        [buildBody(placement)],
        pads
    )

    assert.equal(repaired.designator, 'PKG_BODY')
    assert.deepEqual(repaired.positionMil, { x: 4540, y: 4500, z: 40 })
})

test('geometric owner recovery rejects absent height evidence', () => {
    const component = buildComponent({
        componentIndex: 30,
        designator: 'U30',
        x: 6000,
        y: 6000,
        height: null
    })
    const pads = [
        buildPad(30, 5880, 6000, 40),
        buildPad(30, 6120, 6000, 40),
        buildPad(30, 5940, 6160, 40),
        buildPad(30, 6060, 6160, 40)
    ]
    const placement = buildPlacement({
        bodyPositionMil: { x: 5910, y: 5910 },
        positionMil: { x: 5410, y: 5410, z: 40 }
    })
    const repaired = repair(
        placement,
        [component],
        [buildBody(placement, { overallHeightMil: null })],
        pads
    )

    assert.equal(repaired.designator, 'PKG_BODY')
})

test('geometric owner recovery rejects tied source-body rows', () => {
    const component = buildComponent({ designator: 'U31' })
    const pads = [buildPad(1, 980, 1000), buildPad(1, 1020, 1000)]
    const placement = buildPlacement({
        bodyPositionMil: { x: 1000, y: 1000 }
    })
    const body = buildBody(placement)
    const repaired = repair(placement, [component], [body, { ...body }], pads)

    assert.equal(repaired.designator, 'PKG_BODY')
})

test('geometric owner recovery corrects four-pad tactile-switch yaw', () => {
    const component = buildComponent({
        componentIndex: 12,
        designator: 'SW4',
        x: 4000,
        y: 4000,
        rotation: 270,
        description: 'Surface-mount tactile switch',
        height: 200
    })
    const pads = [
        buildPad(12, 3920, 3890, 50, { netName: 'A' }),
        buildPad(12, 4080, 3890, 50, { netName: 'B' }),
        buildPad(12, 3920, 4110, 50, { netName: 'A' }),
        buildPad(12, 4080, 4110, 50, { netName: 'B' })
    ]
    const placement = buildPlacement({
        designator: 'SW4',
        rotationDeg: 270,
        bodyPositionMil: { x: 4000, y: 4000 },
        positionMil: { x: 3500, y: 3500, z: 40 }
    })
    const repaired = repair(
        placement,
        [component],
        [
            buildBody(placement, {
                modelRotationDeg: { x: 90, y: 0, z: 270 }
            })
        ],
        pads
    )

    assert.equal(repaired.designator, 'SW4')
    assert.equal(repaired.rotationDeg, 90)
})

test('geometric owner recovery corrects a newly recovered tactile owner', () => {
    const component = buildComponent({
        componentIndex: 13,
        designator: 'SW5',
        x: 4500,
        y: 4500,
        rotation: 270,
        description: 'Low-force tactile pushbutton'
    })
    const pads = [
        buildPad(13, 4420, 4390, 50, { netIndex: 1 }),
        buildPad(13, 4580, 4390, 50, { netIndex: 2 }),
        buildPad(13, 4420, 4610, 50, { netIndex: 1 }),
        buildPad(13, 4580, 4610, 50, { netIndex: 2 })
    ]
    const placement = buildPlacement({
        designator: 'MECH_BUTTON',
        rotationDeg: 270,
        bodyPositionMil: { x: 4500, y: 4500 },
        positionMil: { x: 4000, y: 4000, z: 40 }
    })
    const repaired = repair(
        placement,
        [component],
        [
            buildBody(placement, {
                modelRotationDeg: { x: 90, y: 0, z: 270 }
            })
        ],
        pads
    )

    assert.equal(repaired.designator, 'SW5')
    assert.equal(repaired.rotationDeg, 90)
})

test('geometric owner recovery corrects rotated tactile topology', () => {
    const component = buildComponent({
        componentIndex: 15,
        designator: 'SW15',
        x: 5000,
        y: 5000,
        rotation: 45,
        description: 'Tactile pushbutton'
    })
    const radians = Math.PI / 4
    const rotate = (x, y) => ({
        x: 5000 + x * Math.cos(radians) - y * Math.sin(radians),
        y: 5000 + x * Math.sin(radians) + y * Math.cos(radians)
    })
    const localPads = [
        { x: -80, y: -110, netIndex: 1 },
        { x: 80, y: -110, netIndex: 2 },
        { x: -80, y: 110, netIndex: 1 },
        { x: 80, y: 110, netIndex: 2 }
    ]
    const pads = localPads.map((pad) => {
        const point = rotate(pad.x, pad.y)
        return buildPad(15, point.x, point.y, 50, {
            netIndex: pad.netIndex
        })
    })
    const placement = buildPlacement({
        designator: 'SW15',
        rotationDeg: 45,
        bodyPositionMil: { x: 5000, y: 5000 }
    })
    const repaired = repair(
        placement,
        [component],
        [
            buildBody(placement, {
                modelRotationDeg: { x: 90, y: 0, z: 45 }
            })
        ],
        pads
    )

    assert.equal(repaired.rotationDeg, 225)
})

test('geometric owner recovery does not rotate generic four-pad switches', () => {
    const component = buildComponent({
        componentIndex: 14,
        designator: 'S1',
        x: 4800,
        y: 4800,
        rotation: 270,
        description: 'Four-position rotary switch'
    })
    const pads = [
        buildPad(14, 4720, 4690, 50, { netIndex: 1 }),
        buildPad(14, 4880, 4690, 50, { netIndex: 2 }),
        buildPad(14, 4720, 4910, 50, { netIndex: 1 }),
        buildPad(14, 4880, 4910, 50, { netIndex: 2 })
    ]
    const placement = buildPlacement({
        designator: 'S1',
        rotationDeg: 270,
        bodyPositionMil: { x: 4800, y: 4800 }
    })
    const repaired = repair(
        placement,
        [component],
        [
            buildBody(placement, {
                modelRotationDeg: { x: 90, y: 0, z: 270 }
            })
        ],
        pads
    )

    assert.equal(repaired.rotationDeg, 270)
})

test('convergence scene builder applies geometric owner recovery', () => {
    const component = buildComponent({
        componentIndex: 40,
        designator: 'J40',
        x: 3000,
        y: 3000,
        rotation: 180,
        description: 'Dual-row through-hole header',
        height: 250
    })
    const pads = []
    for (let column = -3; column <= 3; column += 1) {
        pads.push(buildPad(40, 3000 + column * 100, 2950, 68))
        pads.push(buildPad(40, 3000 + column * 100, 3050, 68))
    }
    const body = {
        identifier: 'MECH_GRID_BODY',
        name: 'MECH_GRID_BODY.step',
        positionMil: { x: 2750, y: 3000 },
        modelRotationDeg: { x: 90, y: 0, z: 180 },
        modelBoundsMil: { width: 700, depth: 458, height: 200 },
        overallHeightMil: 337,
        standoffHeightMil: -108,
        embedded: true
    }
    const scene = PcbScene3dBuilder.build(
        {
            sourceFormat: 'altium',
            kind: 'pcb',
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 5000,
                    heightMil: 5000,
                    segments: []
                },
                components: [component],
                componentBodies: [body],
                pads,
                embeddedModels: [],
                tracks: [],
                arcs: [],
                fills: [],
                vias: [],
                texts: []
            }
        },
        {
            boardThicknessMil: 80,
            modelRegistry: {
                /**
                 * @returns {null}
                 */
                resolveComponentModel() {
                    return null
                },

                /**
                 * @param {object} componentBody Source body.
                 * @returns {object}
                 */
                resolveComponentBodyModel(componentBody) {
                    return {
                        origin: 'embedded',
                        name: componentBody.name,
                        format: 'step',
                        boundsMil: componentBody.modelBoundsMil
                    }
                }
            }
        }
    )
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'J40')
    assert.equal(placement.mountSide, 'top')
    assert.deepEqual(placement.positionMil, { x: 500, y: 500, z: 40 })
    assert.equal(placement.modelTransform.dzMil, -108)
})
