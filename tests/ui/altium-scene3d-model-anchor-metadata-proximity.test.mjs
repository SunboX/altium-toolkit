import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/ui/AltiumScene3dExternalPlacementAdapter.mjs'

/**
 * Builds one repeated model-anchor placement with synthetic metadata.
 * @param {{ x: number, y: number }} bodyPositionMil Source body position.
 * @returns {object}
 */
function buildPlacement(bodyPositionMil) {
    return {
        designator: 'AX_02-1111-TG',
        mountSide: 'bottom',
        rotationDeg: 180,
        positionMil: {
            x: bodyPositionMil.x - 500,
            y: bodyPositionMil.y - 300,
            z: -40
        },
        bodyPositionMil,
        modelTransform: {
            rotationDeg: { x: -90, y: 0, z: 0 },
            dzMil: -120
        },
        projection: { source: 'model-anchor-fallback' },
        externalModel: {
            origin: 'embedded',
            name: 'AX_02-1111-TG.step',
            format: 'step'
        }
    }
}

/**
 * Builds one fake bottom-side connector component.
 * @param {number} componentIndex Component index.
 * @param {string} designator Component designator.
 * @param {string} pattern Footprint pattern.
 * @param {{ x: number, y: number }} position Component position.
 * @returns {object}
 */
function buildConnector(componentIndex, designator, pattern, position) {
    return {
        componentIndex,
        designator,
        x: position.x,
        y: position.y,
        layer: 'BOTTOM',
        rotation: 180,
        pattern,
        source: pattern,
        description: 'Pin Header Connector'
    }
}

/**
 * Builds two simple owned pads so metadata-resolved owners can be centered.
 * @param {number} componentIndex Owning component index.
 * @param {{ x: number, y: number }} position Component center.
 * @returns {object[]}
 */
function buildPads(componentIndex, position) {
    return [-20, 20].map((dx) => ({
        componentIndex,
        x: position.x + dx,
        y: position.y,
        sizeTopX: 40,
        sizeTopY: 40,
        sizeBottomX: 40,
        sizeBottomY: 40
    }))
}

/**
 * Verifies repeated connector sub-models choose the nearest same-family owner
 * instead of assigning every body to the exact part-code owner.
 */
test('Altium 3D owner repair keeps repeated connector sub-models on nearest metadata owners', () => {
    const componentPositions = [
        { x: 700, y: 120 },
        { x: 700, y: 250 },
        { x: 700, y: 380 }
    ]
    const components = [
        buildConnector(0, 'J1', 'AX_04-1111-TG', componentPositions[0]),
        buildConnector(1, 'J2', 'AX_04-1111-TG', componentPositions[1]),
        buildConnector(2, 'J3', 'AX_02-1111-TG', componentPositions[2])
    ]
    const bodyPositions = componentPositions.map((position) => ({
        x: position.x - 100,
        y: position.y
    }))
    const scene = {
        sourceFormat: 'altium',
        board: { centerX: 500, centerY: 300, thicknessMil: 80 },
        externalPlacements: bodyPositions.map((position) =>
            buildPlacement(position)
        )
    }
    const documentModel = {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'model-anchor-metadata-fake.PcbDoc',
        pcb: {
            components,
            componentBodies: bodyPositions.map((position) => ({
                identifier: 'AX_02-1111-TG',
                name: 'AX_02-1111-TG.step',
                positionMil: position,
                modelRotationDeg: { x: -90, y: 0, z: 0 },
                overallHeightMil: 120,
                standoffHeightMil: -120,
                embedded: true
            })),
            pads: components.flatMap((component) =>
                buildPads(component.componentIndex, component)
            )
        }
    }

    const repaired = AltiumScene3dExternalPlacementAdapter.apply(
        scene,
        documentModel
    )

    assert.deepEqual(
        repaired.externalPlacements.map((placement) => placement.designator),
        ['J1', 'J2', 'J3']
    )
    assert.deepEqual(
        repaired.externalPlacements.map((placement) => placement.positionMil),
        [
            { x: 200, y: -180, z: -40 },
            { x: 200, y: -50, z: -40 },
            { x: 200, y: 80, z: -40 }
        ]
    )
})
