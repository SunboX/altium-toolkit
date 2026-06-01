// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { CircuitJsonModelAdapter } from '../../src/parser.mjs'

/**
 * Verifies renderer models convert to Circuit JSON arrays while preserving
 * compatibility fields used by existing renderers.
 */
test('CircuitJsonModelAdapter converts PCB renderer models to Circuit JSON arrays', () => {
    const rendererModel = {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'neutral-board.PcbDoc',
        summary: {
            title: 'Neutral Board',
            boardWidthMil: 1000,
            boardHeightMil: 500,
            layerCount: 2
        },
        diagnostics: [],
        pcb: {
            boardOutline: {
                widthMil: 1000,
                heightMil: 500,
                minX: 0,
                minY: 0,
                segments: [
                    { x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            components: [
                {
                    componentIndex: 1,
                    designator: 'U1',
                    x: 100,
                    y: 200,
                    layer: 'TOP',
                    rotation: 90,
                    pattern: 'SOIC',
                    source: 'SOIC',
                    value: 'DRV'
                }
            ],
            pads: [
                {
                    componentIndex: 1,
                    name: '1',
                    x: 90,
                    y: 200,
                    sizeTopX: 50,
                    sizeTopY: 30,
                    holeDiameter: 0,
                    shapeTopName: 'rect',
                    layer: 'TOP',
                    netName: 'GND',
                    netIndex: 1
                }
            ],
            tracks: [
                {
                    x1: 90,
                    y1: 200,
                    x2: 150,
                    y2: 200,
                    width: 10,
                    layerId: 1,
                    netName: 'GND',
                    netIndex: 1
                }
            ],
            vias: []
        },
        bom: [{ designators: ['U1'], quantity: 1, value: 'DRV' }]
    }

    const circuitJson = CircuitJsonModelAdapter.fromRendererModel(rendererModel)

    assert.equal(Array.isArray(circuitJson), true)
    assert.equal(circuitJson.kind, 'pcb')
    assert.equal(circuitJson.pcb.components.length, 1)
    assert.equal(
        circuitJson.some(
            (element) => element.type === 'source_project_metadata'
        ),
        true
    )
    assert.equal(
        circuitJson.some((element) => element.type === 'source_component'),
        true
    )
    assert.equal(
        circuitJson.some((element) => element.type === 'pcb_component'),
        true
    )
    assert.equal(
        circuitJson.some((element) => element.type === 'pcb_smtpad'),
        true
    )
    assert.equal(
        circuitJson.some((element) => element.type === 'pcb_trace'),
        true
    )
    assert.equal(
        JSON.parse(JSON.stringify(circuitJson)).every(
            (element) => element.type
        ),
        true
    )
})
