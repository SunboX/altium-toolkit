// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies compact one-line Altium notes keep the source text size instead of
 * being miniaturized to satisfy the tight note rectangle height.
 */
test('renderSchematicSvg keeps compact one-line notes readable', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Compact note schematic' },
        schematic: {
            sheet: { width: 220, height: 120 },
            lines: [
                {
                    x1: 40,
                    y1: 30,
                    x2: 190,
                    y2: 30,
                    color: '#a44a1b',
                    width: 1,
                    lineStyle: 1
                },
                {
                    x1: 40,
                    y1: 30,
                    x2: 40,
                    y2: 50,
                    color: '#a44a1b',
                    width: 1,
                    lineStyle: 1
                },
                {
                    x1: 40,
                    y1: 50,
                    x2: 190,
                    y2: 50,
                    color: '#a44a1b',
                    width: 1,
                    lineStyle: 1
                },
                {
                    x1: 190,
                    y1: 50,
                    x2: 190,
                    y2: 30,
                    color: '#a44a1b',
                    width: 1,
                    lineStyle: 1
                }
            ],
            texts: [
                {
                    x: 47,
                    y: 34,
                    text: 'Use this marker only in low mode',
                    color: '#000000',
                    hidden: false,
                    recordType: '28',
                    style: 0,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'start',
                    cornerX: 177,
                    cornerY: 46,
                    fill: '#ffffff',
                    borderColor: '#7b7753',
                    isSolid: false,
                    showBorder: false,
                    textMargin: 4,
                    noteLines: ['Use this marker only in low mode']
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<rect class="schematic-note-box" x="47" y="74" width="130" height="12" fill="transparent" stroke="none" \/>/
    )
    assert.match(
        markup,
        /<text class="schematic-note-text" x="51" y="84.50"[^>]*font-size="9"[^>]*>Use this marker only in low mode</
    )
    assert.match(
        markup,
        /stroke="var\(--schematic-port-color\)"[^>]*stroke-dasharray="8 5"/
    )
    assert.doesNotMatch(markup, />Use this marker only</)
})
