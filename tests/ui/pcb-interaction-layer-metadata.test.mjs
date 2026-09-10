// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionLayerModel } from '../../src/ui/PcbInteractionLayerModel.mjs'

/**
 * Creates fake layer metadata covering category, source order, and ID rules.
 * @returns {object}
 */
function createDocument() {
    return {
        pcb: {
            layers: [
                { name: 'Top Layer', layerId: 1, legacyLayerId: '1' },
                { name: 'Bottom Layer', layerId: 32 },
                { layer: 'Auxiliary', layerId: 33 },
                { name: 'Top Layer', layerId: 999 }
            ],
            primitiveLayers: [
                { name: 'Overlay', layerId: 33 },
                { name: 'Top Layer', layerId: 1 },
                { name: 'Inner', layerId: 2 }
            ],
            tracks: [
                { layer: ' Inner ', x1: 0, y1: 0, x2: 1, y2: 1 },
                { layerId: '1', x1: 0, y1: 0, x2: 1, y2: 1 },
                { layerCode: '33', x1: 0, y1: 0, x2: 1, y2: 1 },
                { layerId: null, x1: 0, y1: 0, x2: 1, y2: 1 }
            ],
            pads: [
                { layerId: 32, x: 0, y: 0 },
                { layer: ' Top Layer ', x: 0, y: 0 },
                { layerId: 1, x: 0, y: 0 }
            ],
            vias: [{ layerId: 32, x: 0, y: 0 }],
            components: [{ layer: 'TOP', x: 0, y: 0 }],
            regions: [
                { layerId: 2, points: triangle() },
                { layerId: 1, points: triangle().slice(0, 2) }
            ],
            shapeBasedRegions: [
                {
                    layerCode: 33,
                    segments: triangle().map((point) => ({
                        x1: point.x,
                        y1: point.y
                    }))
                }
            ],
            polygons: [
                { layerId: 32, x1: null, y1: '', x2: '3', y2: 4 },
                { layerId: 1, x1: Infinity, y1: 0, x2: 1, y2: 1 },
                { layer: 'Direct', points: [{ x: NaN }, {}, {}] }
            ],
            texts: [
                { visible: false, layer: 'Hidden', x: 0, y: 0 },
                { visible: 0, layerId: 33, x: 0, y: 0 },
                { layer: 'Top Layer', x: 0, y: 0 },
                { visible: true, layerId: 2, x: 0, y: 0 }
            ]
        }
    }
}

/** Returns the vertices of a synthetic triangular zone. @returns {object[]} */
function triangle() {
    return [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
    ]
}

test('interaction layer metadata preserves source order and eligible object categories', () => {
    assert.deepEqual(PcbInteractionLayerModel.resolve(createDocument()), {
        physicalLayers: [
            {
                key: 'Top Layer',
                label: 'Top Layer',
                layerId: 1,
                legacyLayerId: 1
            },
            { key: 'Bottom Layer', label: 'Bottom Layer', layerId: 32 },
            { key: 'Auxiliary', label: 'Auxiliary', layerId: 33 },
            { key: 'Overlay', label: 'Overlay', layerId: 33 },
            { key: 'Inner', label: 'Inner', layerId: 2 }
        ],
        virtualLayers: [
            {
                key: 'tracks',
                label: 'Tracks',
                physicalLayerKeys: ['Inner', 'Top Layer', 'Overlay']
            },
            { key: 'vias', label: 'Vias', physicalLayerKeys: [] },
            {
                key: 'pads',
                label: 'Pads',
                physicalLayerKeys: ['Bottom Layer', 'Top Layer']
            },
            {
                key: 'holes',
                label: 'Holes',
                physicalLayerKeys: ['Bottom Layer', 'Top Layer']
            },
            {
                key: 'zones',
                label: 'Zones',
                physicalLayerKeys: [
                    'Inner',
                    'Overlay',
                    'Bottom Layer',
                    'Direct'
                ]
            },
            {
                key: 'footprint-text',
                label: 'Footprint text',
                physicalLayerKeys: ['Overlay', 'Top Layer', 'Inner']
            }
        ]
    })
})

test('interaction layer metadata reads no selectable geometry or component ownership', () => {
    const document = createDocument()
    let geometryReads = 0
    for (const source of [
        ...document.pcb.tracks,
        ...document.pcb.pads,
        ...document.pcb.texts,
        ...document.pcb.components,
        ...document.pcb.regions[0].points
    ]) {
        for (const key of ['x', 'x1', 'componentIndex']) {
            const value = source[key]
            Object.defineProperty(source, key, {
                enumerable: true,
                /** Returns a primitive field while tracking unnecessary traversal. */
                get() {
                    geometryReads += 1
                    return value
                }
            })
        }
    }
    const result = PcbInteractionLayerModel.resolve(document)

    assert.deepEqual(result.virtualLayers[0].physicalLayerKeys, [
        'Inner',
        'Top Layer',
        'Overlay'
    ])
    assert.equal(geometryReads, 0)
})

test('interaction layer metadata reflects mutable layers and primitives on every resolve', () => {
    const document = {
        pcb: {
            layers: [{ name: 'Top Layer', layerId: 1 }],
            tracks: [{ layerId: 1 }],
            pads: [{ layerId: 32 }],
            texts: [{ layer: 'Overlay', visible: false }]
        }
    }
    const first = PcbInteractionLayerModel.resolve(document)
    assert.deepEqual(
        first.virtualLayers.map((layer) => layer.physicalLayerKeys),
        [['Top Layer'], [], [], [], [], []]
    )

    document.pcb.layers[0].name = 'Front Copper'
    document.pcb.layers.push({ name: 'Bottom Layer', layerId: 32 })
    document.pcb.tracks.push({ layer: 'Direct' })
    document.pcb.texts[0].visible = true
    const second = PcbInteractionLayerModel.resolve(document)

    assert.deepEqual(
        second.physicalLayers.map((layer) => layer.key),
        ['Front Copper', 'Bottom Layer']
    )
    assert.deepEqual(
        second.virtualLayers.map((layer) => layer.physicalLayerKeys),
        [
            ['Front Copper', 'Direct'],
            [],
            ['Bottom Layer'],
            ['Bottom Layer'],
            [],
            ['Overlay']
        ]
    )
})

test('interaction layer metadata accepts empty and absent source collections', () => {
    const result = PcbInteractionLayerModel.resolve({
        pcb: { tracks: {}, pads: null }
    })

    assert.deepEqual(result.physicalLayers, [])
    assert.deepEqual(
        result.virtualLayers.map((layer) => layer.physicalLayerKeys),
        [[], [], [], [], [], []]
    )
})
