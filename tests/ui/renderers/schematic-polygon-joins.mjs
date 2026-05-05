// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies schematic polygons use rounded joins so filled symbol bodies and
 * standalone polygons match the rounded-corner stroke treatment used for
 * other schematic primitives.
 */
test('renderSchematicSvg rounds schematic polygon stroke joins', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Rounded polygon joins' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [],
            polygons: [
                {
                    points: [
                        { x: 20, y: 20 },
                        { x: 36, y: 20 },
                        { x: 28, y: 36 }
                    ],
                    color: '#0000ff',
                    fill: '#800000',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                },
                {
                    points: [
                        { x: 60, y: 20 },
                        { x: 76, y: 20 },
                        { x: 68, y: 36 }
                    ],
                    color: '#0000ff',
                    fill: '#800000',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    ownerIndex: '42',
                    renderOrder: 10
                }
            ],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<g class="schematic-polygons"><polygon class="schematic-polygon" points="20,80 36,80 28,64" fill="var\(--schematic-power-color\)" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-linejoin="round" \/><\/g>/
    )
    assert.match(
        markup,
        /<g class="schematic-owner-geometry" stroke-linecap="round"><polygon class="schematic-polygon" points="60,80 76,80 68,64" fill="var\(--schematic-power-color\)" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-linejoin="round" \/><\/g>/
    )
})
