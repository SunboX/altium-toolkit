// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a model registry that forces procedural and static scene output.
 * @returns {object}
 */
function buildNullModelRegistry() {
    return {
        resolveComponentModel() {
            return null
        },
        resolveComponentBodyModel() {
            return null
        }
    }
}

/**
 * Builds a fake document with one compact static carrier fragment.
 * @param {object} ownerComponent Candidate stack owner component.
 * @returns {object}
 */
function buildShapeStackOwnerDocument(ownerComponent) {
    return {
        fileName: 'shape-stack-owner-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: []
            },
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            componentBodies: [buildCarrierBody()],
            components: [
                ownerComponent,
                {
                    componentIndex: 2,
                    designator: 'R1',
                    x: 540,
                    y: 491,
                    rotation: 90,
                    layer: 'BOTTOM',
                    pattern: 'RES0201',
                    source: 'RES_FAKE_UNIT',
                    height: 10
                }
            ]
        }
    }
}

/**
 * Builds a compact authored carrier body close to the bottom-side fragment.
 * @returns {object}
 */
function buildCarrierBody() {
    return {
        sourceStream: 'ShapeBasedComponentBodies6/Data',
        layer: 'MECHANICAL13',
        identifier: 'CARRIER_BODY',
        modelId: '{00000000-0000-0000-0000-000000000501}',
        checksum: 501,
        embedded: false,
        name: '',
        positionMil: { x: 540, y: 500 },
        rotationDeg: 0,
        modelTypeName: 'extruded-polygon',
        overallHeightMil: 10,
        standoffHeightMil: 0,
        staticGeometry: {
            kind: 'extruded-polygon',
            status: 'complete',
            units: 'mil',
            heightMil: 10,
            standoffHeightMil: 0,
            verticesMil: [
                { x: -6, y: -3 },
                { x: 6, y: -3 },
                { x: 6, y: 3 },
                { x: -6, y: 3 }
            ]
        }
    }
}

/**
 * Builds one fake connector whose material text contains "Crystal".
 * @returns {object}
 */
function buildConnectorComponent() {
    return {
        componentIndex: 1,
        designator: 'J1',
        x: 500,
        y: 500,
        rotation: 0,
        layer: 'TOP',
        pattern: 'UFL_CONN_FAKE',
        source: 'RF_CONNECTOR_FAKE',
        description: 'Surface mount RF connector',
        parameters: {
            'Dielectric Material': 'Liquid Crystal Polymer (LCP)',
            'Part Description': 'Surface mount coax connector'
        },
        height: 48
    }
}

/**
 * Builds one fake timing owner near a compact carrier fragment.
 * @returns {object}
 */
function buildTimingComponent() {
    return {
        componentIndex: 1,
        designator: 'Y1',
        x: 500,
        y: 500,
        rotation: 0,
        layer: 'TOP',
        pattern: 'CLOCK_UNIT_FAKE',
        source: 'CLOCK_UNIT_FAKE',
        parameters: {
            'Part Description': 'Clock source'
        },
        height: 48
    }
}

test('PcbScene3dBuilder does not treat connector material as a timing-stack owner', () => {
    const scene = PcbScene3dBuilder.build(
        buildShapeStackOwnerDocument(buildConnectorComponent()),
        { modelRegistry: buildNullModelRegistry() }
    )
    const connector = scene.components.find(
        (component) => component.designator === 'J1'
    )
    const placement = scene.staticBodyPlacements[0]

    assert.notEqual(connector.renderFallbackBody, false)
    assert.equal(connector.coLocatedVariantGroupKey, undefined)
    assert.equal(placement.designator, 'R1')
    assert.equal(placement.selectionKey, 'R1')
    assert.equal(placement.mountSide, 'bottom')
})

test('PcbScene3dBuilder repairs static carrier selection and side with the stack owner', () => {
    const scene = PcbScene3dBuilder.build(
        buildShapeStackOwnerDocument(buildTimingComponent()),
        { modelRegistry: buildNullModelRegistry() }
    )
    const timingOwner = scene.components.find(
        (component) => component.designator === 'Y1'
    )
    const placement = scene.staticBodyPlacements[0]

    assert.equal(timingOwner.renderFallbackBody, false)
    assert.equal(placement.designator, 'Y1')
    assert.equal(placement.selectionKey, 'Y1')
    assert.equal(placement.mountSide, 'top')
    assert.ok(placement.positionMil.z > 0)
    assert.equal(
        placement.coLocatedVariantGroupKey,
        timingOwner.coLocatedVariantGroupKey
    )
})
