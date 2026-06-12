// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies long connector pins keep their generated numbers away from the
 * body border and inset their names inside the symbol body.
 */
test('renderSchematicSvg spaces horizontal connector pin labels from the body', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Connector label schematic' },
        schematic: {
            sheet: {
                width: 220,
                height: 140,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [
                {
                    x: 100,
                    y: 80,
                    length: 30,
                    name: 'PIN_A',
                    designator: '5',
                    orientation: 'left',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                },
                {
                    x: 140,
                    y: 60,
                    length: 30,
                    name: 'PIN_B',
                    designator: '6',
                    orientation: 'right',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<text class="schematic-pin-number" x="90" y="59" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">5<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="108" y="63" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">PIN_A<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="150" y="79" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">6<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="132" y="83" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">PIN_B<\/text>/
    )
})

/**
 * Verifies short owner-body pin names leave clearance for colored side strips
 * before their generated labels begin.
 */
test('renderSchematicSvg gives short horizontal pin names side-strip clearance', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Short pin label schematic' },
        schematic: {
            sheet: {
                width: 180,
                height: 120,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [
                {
                    x: 50,
                    y: 70,
                    length: 7,
                    name: 'IN_A',
                    designator: '1',
                    orientation: 'left',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                },
                {
                    x: 130,
                    y: 70,
                    length: 7,
                    name: 'OUT_A',
                    designator: '2',
                    orientation: 'right',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<text class="schematic-pin-name" x="57" y="53" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">IN_A<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="123" y="53" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">OUT_A<\/text>/
    )
})

/**
 * Verifies rectangular owner bodies separate numeric labels drawn inside the
 * component body from the matching pin numbers shown outside the pin stubs.
 */
test('renderSchematicSvg separates rectangular owner pin numbers inside and outside', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Numeric body pin schematic' },
        schematic: {
            sheet: {
                width: 240,
                height: 160,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            rectangles: [
                {
                    x: 80,
                    y: 40,
                    width: 80,
                    height: 80,
                    color: '#804000',
                    fill: '#ffeeaa',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    ownerIndex: '500'
                }
            ],
            texts: [],
            components: [],
            pins: [
                {
                    x: 80,
                    y: 110,
                    length: 15,
                    name: '6',
                    designator: '6',
                    orientation: 'left',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '500'
                },
                {
                    x: 80,
                    y: 60,
                    length: 15,
                    name: '4',
                    designator: '4',
                    orientation: 'left',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '500'
                },
                {
                    x: 160,
                    y: 110,
                    length: 15,
                    name: '1',
                    designator: '1',
                    orientation: 'right',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '500'
                },
                {
                    x: 160,
                    y: 60,
                    length: 15,
                    name: '3',
                    designator: '3',
                    orientation: 'right',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '500'
                },
                {
                    x: 160,
                    y: 50,
                    length: 15,
                    name: '2',
                    designator: '2',
                    orientation: 'right',
                    symbolOuter: 6,
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '500'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<text class="schematic-pin-name" x="90" y="53"[^>]*text-anchor="middle"[^>]*>6<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="71"[^>]*text-anchor="end"[^>]*>6<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="150" y="53"[^>]*text-anchor="middle"[^>]*>1<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="169"[^>]*text-anchor="start"[^>]*>1<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="150" y="113"[^>]*text-anchor="middle"[^>]*>2<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="169"[^>]*text-anchor="start"[^>]*>2<\/text>/
    )
})

/**
 * Verifies plain connector-style bodies do not duplicate generated pin
 * numbers into a route label lane that already contains visible net text.
 */
test('renderSchematicSvg suppresses external connector pin numbers that overlap net labels', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Connector net label schematic' },
        schematic: {
            sheet: {
                width: 260,
                height: 150,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [
                {
                    x1: 20,
                    y1: 110,
                    x2: 100,
                    y2: 110,
                    color: '#000080',
                    width: 1
                },
                {
                    x1: 160,
                    y1: 110,
                    x2: 240,
                    y2: 110,
                    color: '#000080',
                    width: 1
                }
            ],
            rectangles: [
                {
                    x: 100,
                    y: 40,
                    width: 60,
                    height: 90,
                    color: '#804000',
                    fill: '#ffeeaa',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    ownerIndex: '520'
                }
            ],
            texts: [
                {
                    x: 42,
                    y: 110,
                    text: 'FPGA_GPIO0',
                    color: '#800000',
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    anchor: 'start'
                },
                {
                    x: 172,
                    y: 110,
                    text: 'FPGA_GPIO1',
                    color: '#800000',
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    anchor: 'start'
                }
            ],
            components: [],
            pins: [
                {
                    x: 100,
                    y: 110,
                    length: 20,
                    name: '1',
                    designator: '1',
                    orientation: 'left',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '520'
                },
                {
                    x: 160,
                    y: 110,
                    length: 20,
                    name: '2',
                    designator: '2',
                    orientation: 'right',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '520'
                },
                {
                    x: 100,
                    y: 70,
                    length: 20,
                    name: '3',
                    designator: '3',
                    orientation: 'left',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '520'
                },
                {
                    x: 160,
                    y: 70,
                    length: 20,
                    name: '4',
                    designator: '4',
                    orientation: 'right',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '520'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<text class="schematic-pin-name" x="110" y="43"[^>]*text-anchor="middle"[^>]*>1<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="150" y="43"[^>]*text-anchor="middle"[^>]*>2<\/text>/
    )
    assert.doesNotMatch(
        markup,
        /<text class="schematic-pin-number"[^>]*>1<\/text>/
    )
    assert.doesNotMatch(
        markup,
        /<text class="schematic-pin-number"[^>]*>2<\/text>/
    )
})

/**
 * Verifies non-numeric pins whose name and designator match still render the
 * owner-body name while keeping the external contact designator visible.
 */
test('renderSchematicSvg keeps nonnumeric matching pin names inside owner bodies', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Body label schematic' },
        schematic: {
            sheet: {
                width: 180,
                height: 120,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            rectangles: [
                {
                    x: 70,
                    y: 30,
                    width: 70,
                    height: 70,
                    color: '#804000',
                    fill: '#ffeeaa',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    ownerIndex: '510'
                }
            ],
            texts: [],
            components: [],
            pins: [
                {
                    x: 70,
                    y: 50,
                    length: 15,
                    name: 'PAD',
                    designator: 'PAD',
                    orientation: 'left',
                    electrical: 4,
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number',
                    ownerIndex: '510'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<text class="schematic-pin-number" x="68" y="69"[^>]*text-anchor="end"[^>]*>PAD<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="77" y="73"[^>]*text-anchor="start"[^>]*>PAD<\/text>/
    )
})

/**
 * Verifies authored junction dots inherit their connected wire color and do
 * not receive a second synthesized junction dot at the same point.
 */
test('renderSchematicSvg resolves authored wire junctions from connected routes', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Junction label schematic' },
        schematic: {
            sheet: { width: 120, height: 100 },
            lines: [
                {
                    x1: 10,
                    y1: 50,
                    x2: 40,
                    y2: 50,
                    color: '#000080',
                    width: 1
                },
                {
                    x1: 40,
                    y1: 50,
                    x2: 90,
                    y2: 50,
                    color: '#000080',
                    width: 1
                },
                {
                    x1: 40,
                    y1: 20,
                    x2: 40,
                    y2: 80,
                    color: '#000080',
                    width: 1
                }
            ],
            junctions: [{ x: 40, y: 50, color: '#800000' }],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<circle class="schematic-authored-junction" cx="40" cy="50" r="2\.4" fill="var\(--schematic-default-ink-color\)" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<circle class="schematic-junction" cx="40" cy="50"/
    )
})
