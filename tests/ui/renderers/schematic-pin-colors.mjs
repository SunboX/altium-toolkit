// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies default black pin stubs use the non-text pin color path without
 * changing pin-owned label or marker colors.
 */
test('renderSchematicSvg colors default black vertical pin stubs as schematic pins', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Pin color schematic' },
        schematic: {
            sheet: { width: 140, height: 120 },
            lines: [],
            texts: [],
            components: [],
            pins: [
                {
                    x: 70,
                    y: 70,
                    length: 20,
                    name: 'PINA',
                    designator: '1',
                    orientation: 'top',
                    electrical: 1,
                    color: '#000000',
                    labelMode: 'name-and-number'
                },
                {
                    x: 40,
                    y: 50,
                    length: 20,
                    name: 'PINB',
                    designator: '2',
                    orientation: 'left',
                    electrical: 1,
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<line class="schematic-pin-line" x1="70" y1="50" x2="70" y2="30" stroke="var\(--schematic-accent-ink-color\)" \/>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="68" y="44" fill="var\(--schematic-text-color\)"[^>]*>1<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="70" y="54" fill="var\(--schematic-text-color\)"[^>]*>PINA<\/text>/
    )
    assert.match(
        markup,
        /<g class="schematic-pin-marker"><polygon points="35,67 35,73 40,70" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75"/
    )
})

/**
 * Verifies compact owner marker linework attached to a hidden single pin keeps
 * the pin accent stroke and is not mistaken for footer title-block chrome.
 */
test('renderSchematicSvg colors compact owner pin marker strokes as schematic pins', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Compact marker color schematic' },
        schematic: {
            sheet: {
                width: 120,
                height: 120,
                marginWidth: 20,
                borderOn: true
            },
            lines: [
                {
                    x1: 60,
                    y1: 34,
                    x2: 62,
                    y2: 30,
                    color: '#a44a1b',
                    width: 1,
                    ownerIndex: 'MK1'
                },
                {
                    x1: 58,
                    y1: 30,
                    x2: 60,
                    y2: 34,
                    color: '#a44a1b',
                    width: 1,
                    ownerIndex: 'MK1'
                },
                {
                    x1: 58,
                    y1: 30,
                    x2: 62,
                    y2: 30,
                    color: '#000000',
                    width: 1,
                    ownerIndex: 'MK1',
                    recordType: '6'
                }
            ],
            texts: [],
            components: [],
            pins: [
                {
                    x: 60,
                    y: 34,
                    length: 10,
                    name: '',
                    designator: '1',
                    orientation: 'bottom',
                    electrical: 4,
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'hidden',
                    ownerIndex: 'MK1'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.equal(
        (markup.match(/class="schematic-pin-number"/g) || []).length,
        0
    )
    assert.match(
        markup,
        /<line x1="60" y1="86" x2="62" y2="90" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="58" y1="90" x2="60" y2="86" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="58" y1="90" x2="62" y2="90" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
})
