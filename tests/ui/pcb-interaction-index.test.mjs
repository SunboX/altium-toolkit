// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    PcbInteractionIndex,
    PcbInteractionLayerModel
} from '../../src/renderers.mjs'

test('PcbInteractionIndex returns overlapping Altium PCB items by selection priority', () => {
    const documentModel = createDocument()
    const candidates = PcbInteractionIndex.hitTest(
        documentModel,
        { x: 50, y: 50 },
        { side: 'top' }
    )

    assert.deepEqual(
        candidates.map((item) => item.type),
        ['track', 'pad', 'via', 'component', 'zone']
    )
    assert.equal(
        PcbInteractionIndex.pick(documentModel, { x: 50, y: 50 })?.type,
        'track'
    )
    assert.equal(candidates[0].netName, 'SENSE')
    assert.equal(candidates[1].componentKey, 'U1')
})

test('PcbInteractionIndex respects hidden object categories before choosing an Altium candidate', () => {
    const candidate = PcbInteractionIndex.pick(
        createDocument(),
        { x: 50, y: 50 },
        {
            hiddenObjects: ['tracks'],
            side: 'top'
        }
    )

    assert.equal(candidate?.type, 'pad')
    assert.equal(candidate?.componentKey, 'U1')
})

test('PcbInteractionIndex resolves explicit component ownership before row order', () => {
    const documentModel = createExplicitComponentIndexDocument()
    const candidate = PcbInteractionIndex.pick(
        documentModel,
        { x: 330, y: 200 },
        { side: 'top' }
    )

    assert.equal(candidate?.type, 'pad')
    assert.equal(candidate?.componentKey, 'U2')
})

test('PcbInteractionLayerModel separates physical Altium layers from virtual controls', () => {
    const model = PcbInteractionLayerModel.resolve(createDocument())

    assert.deepEqual(
        model.physicalLayers.map((layer) => layer.key),
        ['Top Layer', 'Bottom Layer', 'Top Overlay']
    )
    assert.deepEqual(
        model.virtualLayers.map((layer) => layer.key),
        ['tracks', 'vias', 'pads', 'holes', 'zones', 'footprint-text']
    )
    assert.equal(
        model.virtualLayers[0].physicalLayerKeys.includes('Top Layer'),
        true
    )
})

/**
 * Builds a fake Altium PCB document with intentionally overlapping selectable
 * items.
 * @returns {object}
 */
function createDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'interaction.PcbDoc',
        summary: { title: 'Interaction Board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
                    { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100 },
                    { type: 'line', x1: 100, y1: 100, x2: 0, y2: 100 },
                    { type: 'line', x1: 0, y1: 100, x2: 0, y2: 0 }
                ]
            },
            layers: [
                { name: 'Top Layer', layerId: 1 },
                { name: 'Bottom Layer', layerId: 32 }
            ],
            primitiveLayers: [{ name: 'Top Overlay', layerId: 33 }],
            tracks: [
                {
                    x1: 0,
                    y1: 50,
                    x2: 100,
                    y2: 50,
                    width: 10,
                    layerId: 1,
                    netName: 'SENSE'
                }
            ],
            vias: [
                {
                    x: 50,
                    y: 50,
                    diameter: 24,
                    holeDiameter: 10,
                    netName: 'SENSE'
                }
            ],
            pads: [
                {
                    x: 50,
                    y: 50,
                    sizeTopX: 30,
                    sizeTopY: 30,
                    rotation: 0,
                    componentIndex: 0,
                    layerId: 1,
                    netName: 'SENSE'
                }
            ],
            regions: [
                {
                    layerId: 1,
                    netName: 'SENSE',
                    points: [
                        { x: 0, y: 0 },
                        { x: 100, y: 0 },
                        { x: 100, y: 100 },
                        { x: 0, y: 100 }
                    ]
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'U1',
                    x: 50,
                    y: 50,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ],
            texts: [
                {
                    text: 'U1',
                    x: 50,
                    y: 64,
                    height: 8,
                    layerId: 33,
                    visible: true,
                    componentIndex: 0
                }
            ]
        }
    }
}

/**
 * Builds a fake board where a component's explicit index collides with a
 * different component's array position.
 * @returns {object}
 */
function createExplicitComponentIndexDocument() {
    const documentModel = createDocument()
    documentModel.pcb.tracks = []
    documentModel.pcb.vias = []
    documentModel.pcb.regions = []
    documentModel.pcb.pads = [
        {
            x: 330,
            y: 200,
            sizeTopX: 40,
            sizeTopY: 80,
            rotation: 0,
            componentIndex: 13,
            layerId: 1,
            netName: 'BUS'
        }
    ]
    documentModel.pcb.components = Array.from({ length: 15 }, (_, index) => ({
        componentIndex: 100 + index,
        designator: index === 13 ? 'LED1' : 'K' + index,
        x: 20 + index * 10,
        y: 20,
        rotation: 0,
        layer: 'TOP',
        pattern: 'SMT_R_0402'
    }))
    documentModel.pcb.components.push({
        componentIndex: 13,
        designator: 'U2',
        x: 330,
        y: 200,
        rotation: 0,
        layer: 'TOP',
        pattern: 'SOP-16'
    })

    return documentModel
}
