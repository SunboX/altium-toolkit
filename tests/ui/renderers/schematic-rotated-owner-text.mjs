// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies right-side vertical passive annotations clear the owner body while
 * the left-side designator retains its authored column.
 */
test('renderSchematicSvg separates rotated passive text columns from the body', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Rotated passive annotations' },
        schematic: {
            sheet: { width: 240, height: 180 },
            lines: [],
            rectangles: [
                {
                    x: 100,
                    y: 70,
                    width: 8,
                    height: 30,
                    ownerIndex: '42',
                    color: '#000080',
                    fill: '#ffff80',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                }
            ],
            texts: [
                {
                    x: 99,
                    y: 70,
                    text: 'R42',
                    ownerIndex: '42',
                    recordType: '34',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                },
                {
                    x: 109,
                    y: 70,
                    text: '62R',
                    ownerIndex: '42',
                    recordType: '41',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                },
                {
                    x: 119,
                    y: 70,
                    text: '0.5W',
                    ownerIndex: '42',
                    recordType: '41',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(markup, /class="schematic-label" x="99"[^>]*>R42</)
    assert.match(markup, /class="schematic-label" x="118"[^>]*>62R</)
    assert.match(markup, /class="schematic-label" x="128"[^>]*>0\.5W</)
})
