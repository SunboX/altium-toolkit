import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'
import { PcbScene3dModelRegistry } from '../../src/ui/PcbScene3dModelRegistry.mjs'

/**
 * Builds a rectangular board outline for repeated full-footprint body tests.
 * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: object[] }}
 */
function buildBoardOutline() {
    return {
        minX: 0,
        minY: 0,
        widthMil: 1000,
        heightMil: 500,
        segments: [
            { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
            { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
            { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
            { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
        ]
    }
}

/**
 * Builds a fake model registry that resolves every component body.
 * @returns {{ resolveComponentModel: () => null, resolveComponentBodyModel: (componentBody: object) => object }}
 */
function buildModelRegistry() {
    return {
        resolveComponentModel() {
            return null
        },
        resolveComponentBodyModel(componentBody) {
            return {
                origin: 'embedded',
                name: String(componentBody.name || ''),
                format: 'step',
                sourceStream: String(componentBody.sourceStream || '')
            }
        }
    }
}

/**
 * Builds a minimal embedded STEP payload with a one-pitch-wide body envelope.
 * @returns {string}
 */
function buildSubFootprintStepPayload() {
    return [
        'ISO-10303-21;',
        'DATA;',
        "#1=CARTESIAN_POINT('',(-0.635,-1.2,-2.3));",
        "#2=CARTESIAN_POINT('',(1.905,1.2,5.0));",
        "#3=CARTESIAN_POINT('',(0.0,0.0,0.0));",
        '#4=SI_UNIT(.MILLI.,.METRE.);',
        'ENDSEC;',
        'END-ISO-10303-21;'
    ].join('\n')
}

/**
 * Builds a minimal embedded STEP payload with a full-footprint body envelope.
 * @returns {string}
 */
function buildFullFootprintStepPayload() {
    return [
        'ISO-10303-21;',
        'DATA;',
        "#1=CARTESIAN_POINT('',(0.0,0.0,0.0));",
        "#2=CARTESIAN_POINT('',(6.096,2.286,5.0));",
        '#3=SI_UNIT(.MILLI.,.METRE.);',
        'ENDSEC;',
        'END-ISO-10303-21;'
    ].join('\n')
}

/**
 * Builds a real registry with an embedded STEP model payload.
 * @param {string} [payloadText] Embedded STEP payload.
 * @returns {PcbScene3dModelRegistry}
 */
function buildEmbeddedStepModelRegistry(
    payloadText = buildSubFootprintStepPayload()
) {
    return PcbScene3dModelRegistry.create(
        [],
        [
            {
                id: '{MODEL-FIXTURE-HEADER}',
                checksum: 456,
                name: 'fixture-pin-header-body.step',
                format: 'step',
                payloadText,
                sourceStream: 'Models/4'
            }
        ]
    )
}

/**
 * Builds one drilled through-hole pad.
 * @param {number} x Pad X position in mil.
 * @param {number} y Pad Y position in mil.
 * @returns {object}
 */
function buildPad(x, y) {
    return {
        componentIndex: 11,
        x,
        y,
        sizeTopX: 40,
        sizeTopY: 40,
        sizeMidX: 40,
        sizeMidY: 40,
        holeDiameter: 24
    }
}

/**
 * Builds one duplicate full-footprint component-body row.
 * @param {{ x: number, y: number }} position Body anchor position in mil.
 * @returns {object}
 */
function buildDuplicateBody(position) {
    return {
        sourceStream: 'ShapeBasedComponentBodies/Data',
        layer: 'MECHANICAL13',
        identifier: 'fixture_pin_header_body',
        modelId: '{MODEL-FIXTURE-HEADER}',
        checksum: 456,
        embedded: true,
        name: 'fixture-pin-header-body.step',
        positionMil: position,
        rotationDeg: 0,
        modelRotationDeg: { x: 0, y: 0, z: 0 },
        dzMil: 0,
        overallHeightMil: 196,
        standoffHeightMil: -90
    }
}

/**
 * Verifies duplicated shape rows for one full-footprint through-hole model are
 * collapsed to a single pad-fallback source-origin placement.
 */
test('PcbScene3dBuilder collapses repeated full-footprint body rows', () => {
    const padColumns = [400, 450, 500, 550, 600]
    const padRows = [200, 250]
    const duplicateBodyPositions = [
        { x: 400, y: 200 },
        { x: 400, y: 250 },
        { x: 450, y: 250 },
        { x: 450, y: 200 },
        { x: 550, y: 250 },
        { x: 550, y: 200 }
    ]
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: buildBoardOutline(),
                pads: padColumns.flatMap((x) =>
                    padRows.map((y) => buildPad(x, y))
                ),
                tracks: [],
                arcs: [],
                fills: [],
                vias: [],
                polygons: [],
                componentBodies: duplicateBodyPositions.map((position) =>
                    buildDuplicateBody(position)
                ),
                components: [
                    {
                        componentIndex: 11,
                        designator: 'J1',
                        x: 500,
                        y: 225,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'FIXTURE_HEADER_5X2',
                        source: 'CON/FIXTURE_HEADER',
                        height: 80
                    }
                ]
            }
        },
        { modelRegistry: buildModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 1)
    const placement = scene.externalPlacements[0]
    const absolutePosition = {
        x: placement.positionMil.x + scene.board.centerX,
        y: placement.positionMil.y + scene.board.centerY
    }

    assert.equal(placement.designator, 'J1')
    assert.equal(placement.mountSide, 'top')
    assert.equal(placement.projection.source, 'pad-fallback')
    assert.equal(placement.projection.preservePadFallbackCentering, true)
    assert.equal(placement.projection.duplicateBodyCount, 6)
    assert.deepEqual(placement.projection.boundsMil, {
        width: 240,
        depth: 90,
        height: 80
    })
    assert.deepEqual(absolutePosition, placement.bodyPositionMil)
    assert.ok(
        Math.hypot(absolutePosition.x - 500, absolutePosition.y - 225) > 1
    )
    assert.equal(placement.modelTransform.ownerAnchorOffsetMil, undefined)
})

/**
 * Verifies repeated rows are not collapsed when the embedded STEP envelope is
 * smaller than the full drilled-pad footprint.
 */
test('PcbScene3dBuilder keeps repeated sub-footprint STEP body rows', () => {
    const padColumns = [400, 450, 500, 550, 600]
    const padRows = [200, 250]
    const duplicateBodyPositions = [
        { x: 400, y: 200 },
        { x: 400, y: 250 },
        { x: 450, y: 250 },
        { x: 450, y: 200 },
        { x: 550, y: 250 },
        { x: 550, y: 200 }
    ]
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: buildBoardOutline(),
                pads: padColumns.flatMap((x) =>
                    padRows.map((y) => buildPad(x, y))
                ),
                tracks: [],
                arcs: [],
                fills: [],
                vias: [],
                polygons: [],
                componentBodies: duplicateBodyPositions.map((position) =>
                    buildDuplicateBody(position)
                ),
                components: [
                    {
                        componentIndex: 11,
                        designator: 'J1',
                        x: 500,
                        y: 225,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'FIXTURE_HEADER_5X2',
                        source: 'CON/FIXTURE_HEADER',
                        height: 80
                    }
                ]
            }
        },
        { modelRegistry: buildEmbeddedStepModelRegistry() }
    )

    assert.equal(scene.externalPlacements.length, 6)
    assert.deepEqual(
        scene.externalPlacements.map(
            (placement) => placement.projection.source
        ),
        [
            'model-bounds',
            'model-bounds',
            'model-bounds',
            'model-bounds',
            'model-bounds',
            'model-bounds'
        ]
    )
    scene.externalPlacements.forEach((placement) => {
        assert.equal(
            placement.projection.preservePadFallbackCentering,
            undefined
        )
        assert.equal(placement.projection.duplicateBodyCount, undefined)
        assert.ok(Math.abs(placement.projection.boundsMil.width - 100) < 1e-9)
        assert.ok(
            Math.abs(placement.projection.boundsMil.depth - 94.4881889764) <
                1e-9
        )
    })
})

/**
 * Verifies repeated rows still collapse when the resolved STEP envelope matches
 * the full drilled-pad footprint.
 */
test('PcbScene3dBuilder collapses repeated full-footprint STEP body rows', () => {
    const padColumns = [400, 450, 500, 550, 600]
    const padRows = [200, 250]
    const duplicateBodyPositions = [
        { x: 400, y: 200 },
        { x: 400, y: 250 },
        { x: 450, y: 250 },
        { x: 450, y: 200 },
        { x: 550, y: 250 },
        { x: 550, y: 200 }
    ]
    const scene = PcbScene3dBuilder.build(
        {
            fileName: 'demo.PcbDoc',
            pcb: {
                boardOutline: buildBoardOutline(),
                pads: padColumns.flatMap((x) =>
                    padRows.map((y) => buildPad(x, y))
                ),
                tracks: [],
                arcs: [],
                fills: [],
                vias: [],
                polygons: [],
                componentBodies: duplicateBodyPositions.map((position) =>
                    buildDuplicateBody(position)
                ),
                components: [
                    {
                        componentIndex: 11,
                        designator: 'J1',
                        x: 500,
                        y: 225,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'FIXTURE_HEADER_5X2',
                        source: 'CON/FIXTURE_HEADER',
                        height: 80
                    }
                ]
            }
        },
        {
            modelRegistry: buildEmbeddedStepModelRegistry(
                buildFullFootprintStepPayload()
            )
        }
    )

    assert.equal(scene.externalPlacements.length, 1)
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'J1')
    assert.equal(placement.projection.source, 'model-bounds')
    assert.equal(placement.projection.preservePadFallbackCentering, undefined)
    assert.equal(placement.projection.duplicateBodyCount, 6)
    assert.ok(Math.abs(placement.projection.boundsMil.width - 240) < 1e-9)
    assert.ok(Math.abs(placement.projection.boundsMil.depth - 90) < 1e-9)
})
