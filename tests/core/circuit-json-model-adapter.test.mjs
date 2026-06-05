// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { CircuitJsonModelAdapter } from '../../src/parser.mjs'

/**
 * Returns the first Circuit JSON element of a type.
 * @param {object[]} circuitJson
 * @param {string} type
 * @returns {Record<string, unknown>}
 */
function firstElement(circuitJson, type) {
    const element = circuitJson.find((candidate) => candidate.type === type)
    assert.ok(element, `Expected ${type} element`)
    return element
}

/**
 * Asserts a value is a Circuit JSON point.
 * @param {unknown} value
 * @returns {void}
 */
function assertPoint(value) {
    assert.equal(typeof value?.x, 'number')
    assert.equal(typeof value?.y, 'number')
}

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
    assert.equal(circuitJson.circuitJsonVersion, '0.0.433')
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

/**
 * Verifies PCB elements use the required upstream Circuit JSON field shapes.
 */
test('CircuitJsonModelAdapter emits upstream-compatible PCB element fields', () => {
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
                minY: 0
            },
            components: [
                {
                    componentIndex: 1,
                    designator: 'U1',
                    x: 100,
                    y: 200,
                    layer: 'TOP',
                    rotation: 90,
                    widthMil: 80,
                    heightMil: 60
                }
            ],
            nets: [{ name: 'GND' }],
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
                    netName: 'GND'
                },
                {
                    componentIndex: 1,
                    name: '2',
                    x: 160,
                    y: 200,
                    sizeTopX: 60,
                    sizeTopY: 60,
                    holeDiameter: 25,
                    shapeTopName: 'round',
                    layer: 'TOP',
                    netName: 'GND'
                }
            ],
            tracks: [
                {
                    x1: 90,
                    y1: 200,
                    x2: 160,
                    y2: 200,
                    width: 10,
                    layerId: 1,
                    netName: 'GND'
                }
            ],
            vias: [
                {
                    x: 130,
                    y: 200,
                    diameter: 40,
                    holeDiameter: 15,
                    netName: 'GND'
                }
            ]
        },
        bom: []
    }

    const circuitJson = CircuitJsonModelAdapter.fromRendererModel(rendererModel)
    const sourceNet = firstElement(circuitJson, 'source_net')
    const sourceTrace = firstElement(circuitJson, 'source_trace')
    const pcbComponent = firstElement(circuitJson, 'pcb_component')
    const pcbPort = firstElement(circuitJson, 'pcb_port')
    const pcbSmtpad = firstElement(circuitJson, 'pcb_smtpad')
    const pcbPlatedHole = firstElement(circuitJson, 'pcb_plated_hole')
    const pcbVia = firstElement(circuitJson, 'pcb_via')

    assert.deepEqual(sourceNet.member_source_group_ids, [])
    assert.deepEqual(sourceTrace.connected_source_port_ids, [])
    assert.deepEqual(sourceTrace.connected_source_net_ids, [
        sourceNet.source_net_id
    ])
    assert.equal(typeof pcbPort.x, 'number')
    assert.equal(typeof pcbPort.y, 'number')
    assert.deepEqual(pcbPort.layers, ['top'])
    assert.equal(pcbPort.pcb_component_id, pcbComponent.pcb_component_id)
    assert.equal(typeof pcbSmtpad.pcb_smtpad_id, 'string')
    assert.equal(pcbSmtpad.pcb_component_id, pcbComponent.pcb_component_id)
    assert.equal(typeof pcbSmtpad.x, 'number')
    assert.equal(typeof pcbSmtpad.y, 'number')
    assert.equal(typeof pcbPlatedHole.pcb_plated_hole_id, 'string')
    assert.equal(pcbPlatedHole.pcb_component_id, pcbComponent.pcb_component_id)
    assert.equal(typeof pcbPlatedHole.x, 'number')
    assert.equal(typeof pcbPlatedHole.y, 'number')
    assert.deepEqual(pcbPlatedHole.layers, ['top', 'bottom'])
    assert.deepEqual(pcbVia.layers, ['top', 'bottom'])
})

/**
 * Verifies schematic elements use the required upstream Circuit JSON shapes.
 */
test('CircuitJsonModelAdapter emits upstream-compatible schematic element fields', () => {
    const rendererModel = {
        sourceFormat: 'altium',
        kind: 'schematic',
        fileType: 'SchDoc',
        fileName: 'neutral-sheet.SchDoc',
        summary: { title: 'Neutral Sheet' },
        diagnostics: [],
        schematic: {
            components: [
                {
                    designator: 'U1',
                    x: 10,
                    y: 20,
                    width: 4,
                    height: 6
                }
            ],
            pins: [
                {
                    ownerDesignator: 'U1',
                    name: 'A',
                    pinNumber: '1',
                    x: 8,
                    y: 20,
                    orientation: 'left'
                }
            ],
            nets: [{ name: 'SIG' }],
            lines: [
                {
                    kind: 'wire',
                    netName: 'SIG',
                    x1: 8,
                    y1: 20,
                    x2: 0,
                    y2: 20,
                    width: 1
                }
            ],
            texts: [
                {
                    kind: 'note',
                    text: 'label',
                    x: 10,
                    y: 10
                },
                {
                    kind: 'net',
                    text: 'SIG',
                    x: 0,
                    y: 20
                }
            ]
        },
        bom: []
    }

    const circuitJson = CircuitJsonModelAdapter.fromRendererModel(rendererModel)
    const sourceNet = firstElement(circuitJson, 'source_net')
    const sourcePort = firstElement(circuitJson, 'source_port')
    const sourceTrace = firstElement(circuitJson, 'source_trace')
    const schematicTrace = firstElement(circuitJson, 'schematic_trace')
    const schematicText = firstElement(circuitJson, 'schematic_text')
    const schematicNetLabel = firstElement(circuitJson, 'schematic_net_label')

    assert.deepEqual(sourceNet.member_source_group_ids, [])
    assert.equal(typeof sourcePort.pin_number, 'number')
    assert.deepEqual(sourceTrace.connected_source_port_ids, [])
    assert.deepEqual(sourceTrace.connected_source_net_ids, [
        sourceNet.source_net_id
    ])
    assert.deepEqual(schematicTrace.junctions, [])
    assertPoint(schematicTrace.edges[0].from)
    assertPoint(schematicTrace.edges[0].to)
    assertPoint(schematicText.position)
    assertPoint(schematicNetLabel.center)
    assert.equal(schematicNetLabel.anchor_side, 'top')
})
