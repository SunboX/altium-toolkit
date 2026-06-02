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
