import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/legacy-scene3d.mjs'

/**
 * Builds a compact fake PCB with a top-side timing carrier near an unrelated
 * bottom-side clock component.
 * @returns {object}
 */
function createCrossSideTimingStackDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'fake-timing-stack-side.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2000,
                heightMil: 1600,
                segments: []
            },
            primitiveLayers: [],
            components: [
                {
                    componentIndex: 1,
                    designator: 'Y1',
                    x: 1002,
                    y: 1000,
                    layer: 'TOP',
                    pattern: 'FAKE_RESONATOR',
                    source: 'FAKE_TIMING_UNIT',
                    rotation: 0,
                    parameters: {
                        'Part Description': 'Clock oscillator'
                    }
                },
                {
                    componentIndex: 2,
                    designator: 'U9',
                    x: 1040,
                    y: 1000,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_CLOCK_BUFFER',
                    source: 'FAKE_CLOCK_SOURCE',
                    rotation: 0,
                    parameters: {
                        'Part Description': 'Clock distribution buffer',
                        'Supplier Part Number 1': 'FAKE-1',
                        Category: 'Integrated circuit',
                        Function: 'Clock fanout'
                    }
                }
            ],
            componentBodies: [
                createCarrierBaseBody(30),
                createCarrierBaseBody(60)
            ],
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
 * Builds one fake shape-based carrier base at the shared timing-package anchor.
 * @param {number} heightMil Body height.
 * @returns {object}
 */
function createCarrierBaseBody(heightMil) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        identifier: 'FAKE_TIMING_CARRIER',
        embedded: false,
        positionMil: {
            x: 1000,
            y: 1000
        },
        rotationDeg: 0,
        standoffHeightMil: 0,
        overallHeightMil: heightMil,
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'complete',
            units: 'mil',
            minZMil: 0,
            maxZMil: heightMil,
            heightMil,
            standoffHeightMil: 0,
            verticesMil: [
                { x: 930, y: 960 },
                { x: 1070, y: 960 },
                { x: 1070, y: 1040 },
                { x: 930, y: 1040 }
            ]
        }
    }
}

/**
 * Builds a compact fake PCB where package-named carrier bases locate two
 * raised timing bodies.
 * @returns {object}
 */
function createPackageCarrierTimingStackDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'fake-timing-stack-package-carrier.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2000,
                heightMil: 1600,
                segments: []
            },
            primitiveLayers: [],
            components: [
                createTimingOwner('Y1'),
                createTimingOwner('Y2'),
                createNearbyDiscreteOwner()
            ],
            componentBodies: [
                createPackageCarrierBaseBody(40),
                createRaisedTimingBody(40),
                createRaisedPassiveStackDetail(40),
                createNearbyDiscreteBody(40),
                createAmbiguousTimingBody(40),
                createAmbiguousOppositeSideBody(40),
                createPackageCarrierBaseBody(64),
                createRaisedTimingBody(64),
                createRaisedPassiveStackDetail(64)
            ],
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
 * Builds one fake timing owner.
 * @param {string} designator Component designator.
 * @returns {object}
 */
function createTimingOwner(designator) {
    return {
        componentIndex: designator === 'Y1' ? 1 : 2,
        designator,
        x: 1000,
        y: 1000,
        layer: 'TOP',
        pattern: 'FAKE_CLOCK_UNIT',
        source: 'FAKE_CLOCK_UNIT',
        rotation: 270,
        parameters: {
            'Part Description': 'Clock oscillator'
        }
    }
}

/**
 * Builds a nearby discrete component that should keep its own raised body.
 * @returns {object}
 */
function createNearbyDiscreteOwner() {
    return {
        componentIndex: 3,
        designator: 'R1',
        x: 1060,
        y: 1010,
        layer: 'BOTTOM',
        pattern: 'FAKE_RESISTOR_0201',
        source: 'FAKE_RESISTOR_0201',
        rotation: 0,
        parameters: {
            'Part Description': 'Small resistor'
        }
    }
}

/**
 * Builds one package-named carrier base used only to locate raised sub-bodies.
 * @param {number} heightMil Body height.
 * @returns {object}
 */
function createPackageCarrierBaseBody(heightMil) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        identifier: 'QFN50P350X450X80-24_FAKE_PACKAGE',
        embedded: false,
        positionMil: {
            x: 1000,
            y: 1000
        },
        rotationDeg: 0,
        standoffHeightMil: 0,
        overallHeightMil: heightMil,
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'complete',
            units: 'mil',
            minZMil: 0,
            maxZMil: heightMil,
            heightMil,
            standoffHeightMil: 0,
            verticesMil: [
                { x: -120, y: -90 },
                { x: 120, y: -90 },
                { x: 120, y: 90 },
                { x: -120, y: 90 }
            ]
        }
    }
}

/**
 * Builds one raised body that is close to the carrier but belongs to another
 * component at its own anchor.
 * @param {number} standoffMil Body standoff.
 * @returns {object}
 */
function createNearbyDiscreteBody(standoffMil) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        identifier: 'RES 0201 fake',
        embedded: true,
        name: 'RES 0201 fake.step',
        layer: 'TOP',
        positionMil: {
            x: 1060,
            y: 1010
        },
        rotationDeg: 0,
        modelTypeName: 'cone',
        standoffHeightMil: standoffMil,
        overallHeightMil: standoffMil + 12
    }
}

/**
 * Builds a raised timing detail that is part of the carrier stack even though
 * an unrelated opposite-side component is slightly closer in XY.
 * @param {number} standoffMil Body standoff.
 * @returns {object}
 */
function createAmbiguousTimingBody(standoffMil) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        identifier: 'Crystal timing detail',
        embedded: true,
        name: 'Crystal timing detail.step',
        positionMil: {
            x: 1050,
            y: 1010
        },
        rotationDeg: 0,
        modelTypeName: 'cone',
        standoffHeightMil: standoffMil,
        overallHeightMil: standoffMil + 30
    }
}

/**
 * Builds an ambiguous raised timing-like body that is closer to an opposite
 * side component but not exactly anchored on that component.
 * @param {number} standoffMil Body standoff.
 * @returns {object}
 */
function createAmbiguousOppositeSideBody(standoffMil) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        identifier: 'Generic raised duplicate',
        embedded: true,
        name: 'Generic raised duplicate.step',
        positionMil: {
            x: 1050,
            y: 1010
        },
        rotationDeg: 0,
        modelTypeName: 'cone',
        standoffHeightMil: standoffMil,
        overallHeightMil: standoffMil + 30
    }
}

/**
 * Builds one raised timing body seated on a package carrier.
 * @param {number} standoffMil Body standoff.
 * @returns {object}
 */
function createRaisedTimingBody(standoffMil) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        identifier: 'Crystal timing body',
        embedded: true,
        name: 'Crystal timing body.step',
        positionMil: {
            x: 980,
            y: 1030
        },
        rotationDeg: 0,
        modelTypeName: 'cone',
        standoffHeightMil: standoffMil,
        overallHeightMil: standoffMil + 30
    }
}

/**
 * Builds one raised passive-named detail that belongs to the carrier stack.
 * @param {number} standoffMil Body standoff.
 * @returns {object}
 */
function createRaisedPassiveStackDetail(standoffMil) {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        identifier: 'CAP 0402 (1005 metric)',
        embedded: true,
        name: 'CAP 0402 (1005 metric).STEP',
        positionMil: {
            x: 1050,
            y: 1010
        },
        rotationDeg: 0,
        modelTypeName: 'cone',
        standoffHeightMil: standoffMil,
        overallHeightMil: standoffMil + 12
    }
}

/**
 * Builds a registry for fake embedded timing body models.
 * @returns {object}
 */
function createEmbeddedModelRegistry() {
    return {
        resolveComponentModel() {
            return null
        },
        resolveComponentBodyModel(componentBody) {
            return componentBody?.embedded
                ? {
                      origin: 'embedded',
                      name: componentBody.name,
                      format: 'step',
                      payloadText: 'ISO-10303-21;',
                      sourceStream: 'Models/fake'
                  }
                : null
        }
    }
}

/**
 * Verifies timing carrier stacks stay on the nearest board side instead of
 * spreading to timing-looking components on the opposite side.
 */
test('Altium 3D timing shape stacks do not claim nearby opposite-side owners', () => {
    const scene = PcbScene3dBuilder.build(createCrossSideTimingStackDocument())
    const topOwner = scene.components.find((item) => item.designator === 'Y1')
    const bottomNeighbor = scene.components.find(
        (item) => item.designator === 'U9'
    )

    assert.equal(topOwner.renderFallbackBody, false)
    assert.equal(bottomNeighbor.renderFallbackBody, undefined)
    assert.deepEqual(
        scene.staticBodyPlacements.map((placement) => placement.designator),
        ['Y1', 'Y1']
    )
    assert.deepEqual(
        new Set(
            scene.staticBodyPlacements.map((placement) => placement.mountSide)
        ),
        new Set(['top'])
    )
})

/**
 * Verifies package-named carrier bases are used as ownership metadata when
 * timing STEP bodies represent the visible stack package.
 */
test('Altium 3D timing stacks keep carriers and raised details when available', () => {
    const scene = PcbScene3dBuilder.build(
        createPackageCarrierTimingStackDocument(),
        { modelRegistry: createEmbeddedModelRegistry() }
    )
    const owners = scene.components.filter((component) =>
        ['Y1', 'Y2'].includes(component.designator)
    )
    const raisedBodies = scene.externalPlacements
        .filter(
            (placement) =>
                placement.externalModel.name === 'Crystal timing body.step'
        )
        .sort(
            (left, right) =>
                left.modelTransform.dzMil - right.modelTransform.dzMil
        )

    assert.deepEqual(
        owners.map((component) => component.renderFallbackBody),
        [false, false]
    )
    assert.equal(
        owners[0].coLocatedVariantGroupKey,
        owners[1].coLocatedVariantGroupKey
    )
    assert.deepEqual(
        scene.staticBodyPlacements
            .filter((placement) => ['Y1', 'Y2'].includes(placement.designator))
            .map((placement) => [
                placement.designator,
                placement.geometry.heightMil,
                placement.coLocatedVariantGroupKey
            ]),
        [
            ['Y1', 40, owners[0].coLocatedVariantGroupKey],
            ['Y2', 64, owners[0].coLocatedVariantGroupKey]
        ]
    )
    assert.deepEqual(
        raisedBodies.map((placement) => [
            placement.designator,
            placement.modelTransform.dzMil,
            placement.coLocatedVariantGroupKey
        ]),
        [
            ['Y1', 40, owners[0].coLocatedVariantGroupKey],
            ['Y2', 64, owners[0].coLocatedVariantGroupKey]
        ]
    )
    assert.deepEqual(
        scene.externalPlacements
            .filter(
                (placement) =>
                    placement.externalModel.name ===
                    'Crystal timing detail.step'
            )
            .map((placement) => [
                placement.designator,
                placement.modelTransform.dzMil,
                placement.coLocatedVariantGroupKey
            ]),
        [['Y1', 40, owners[0].coLocatedVariantGroupKey]]
    )
    assert.deepEqual(
        scene.externalPlacements
            .filter(
                (placement) =>
                    placement.externalModel.name ===
                    'CAP 0402 (1005 metric).STEP'
            )
            .sort(
                (left, right) =>
                    left.modelTransform.dzMil - right.modelTransform.dzMil
            )
            .map((placement) => [
                placement.designator,
                placement.modelTransform.dzMil,
                placement.coLocatedVariantGroupKey
            ]),
        [
            ['Y1', 40, owners[0].coLocatedVariantGroupKey],
            ['Y2', 64, owners[0].coLocatedVariantGroupKey]
        ]
    )
    assert.deepEqual(
        scene.externalPlacements
            .filter(
                (placement) =>
                    placement.externalModel.name === 'RES 0201 fake.step'
            )
            .map((placement) => [
                placement.designator,
                placement.coLocatedVariantGroupKey
            ]),
        [['R1', undefined]]
    )
    assert.deepEqual(
        scene.externalPlacements.filter(
            (placement) =>
                placement.externalModel.name === 'Generic raised duplicate.step'
        ),
        []
    )
})
