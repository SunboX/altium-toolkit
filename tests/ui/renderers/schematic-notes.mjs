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
        /<text class="schematic-note-text" x="47" y="83.15"[^>]*font-size="9"[^>]*>Use this marker only in low mode</
    )
    assert.match(
        markup,
        /stroke="var\(--schematic-port-color\)"[^>]*stroke-dasharray="8 5"/
    )
    assert.doesNotMatch(markup, />Use this marker only</)
})

/**
 * Verifies short borderless marker notes render around the authored note box
 * center instead of treating the box as a left-aligned prose callout.
 */
test('renderSchematicSvg centers compact marker notes in their note box', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Compact marker note schematic' },
        schematic: {
            sheet: { width: 220, height: 120 },
            lines: [],
            texts: [
                {
                    x: 80,
                    y: 40,
                    text: 'NF',
                    color: '#ff0000',
                    hidden: false,
                    recordType: '28',
                    style: 0,
                    fontSize: 14,
                    fontFamily: 'Times New Roman',
                    fontWeight: 700,
                    rotation: 0,
                    anchor: 'start',
                    cornerX: 116,
                    cornerY: 56,
                    fill: '#ffffff',
                    borderColor: '#ff0000',
                    isSolid: false,
                    showBorder: false,
                    textMargin: 4,
                    noteLines: ['NF']
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
        /<text class="schematic-note-text" x="98" y="76.55" fill="var\(--schematic-alert-color\)" text-anchor="middle" font-size="13" font-family="Times New Roman" font-weight="700" xml:space="preserve">NF</
    )
})

/**
 * Verifies single-token borderless text frames retain their authored text size
 * even when the frame is only slightly taller than the requested font.
 */
test('renderSchematicSvg keeps compact symbol text-frame labels at source size', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Symbol label frame schematic' },
        schematic: {
            sheet: { width: 180, height: 120 },
            lines: [],
            texts: [
                {
                    x: 120,
                    y: 44,
                    text: 'PORTX',
                    color: '#000000',
                    hidden: false,
                    recordType: '28',
                    style: 0,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 700,
                    rotation: 0,
                    anchor: 'middle',
                    cornerX: 153,
                    cornerY: 58,
                    fill: '#ffffff',
                    borderColor: '#000000',
                    isSolid: false,
                    showBorder: false,
                    textMargin: 4,
                    noteLines: ['PORTX']
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
        /<text class="schematic-note-text" x="136\.50" y="72\.15" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="700" xml:space="preserve">PORTX</
    )
})
