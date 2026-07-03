// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies default black artwork uses schematic ink while text stays dark.
 */
test('renderSchematicSvg colors black artwork as schematic ink without recoloring text', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Neutral artwork color schematic' },
        schematic: {
            sheet: { width: 160, height: 120 },
            lines: [
                {
                    x1: 20,
                    y1: 70,
                    x2: 70,
                    y2: 70,
                    color: '#000000',
                    width: 1,
                    ownerIndex: 'A1',
                    recordType: '6'
                }
            ],
            polygons: [
                {
                    points: [
                        { x: 80, y: 62 },
                        { x: 92, y: 70 },
                        { x: 80, y: 78 }
                    ],
                    color: '#000000',
                    fill: '#000000',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    ownerIndex: 'A1'
                }
            ],
            arcs: [
                {
                    x: 105,
                    y: 70,
                    radius: 8,
                    startAngle: 0,
                    endAngle: 180,
                    color: '#000000',
                    width: 1,
                    ownerIndex: 'A1'
                }
            ],
            texts: [
                {
                    x: 40,
                    y: 40,
                    text: 'Q1',
                    color: '#000000',
                    hidden: false
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
        /<line x1="20" y1="50" x2="70" y2="50" stroke="var\(--schematic-default-ink-color\)"/
    )
    assert.match(
        markup,
        /<polygon class="schematic-polygon" points="80,58 92,50 80,42" fill="var\(--schematic-default-ink-color\)" stroke="var\(--schematic-default-ink-color\)"/
    )
    assert.match(
        markup,
        /<path class="schematic-arc"[^>]+stroke="var\(--schematic-default-ink-color\)"/
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="40" y="80" fill="var\(--schematic-text-color\)"[^>]*>Q1<\/text>/
    )
})

/**
 * Verifies near-black owner artwork does not pass through the muted source
 * color branch used by long color-strip rails.
 */
test('renderSchematicSvg colors near-black owner artwork as schematic ink', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Near black artwork color schematic' },
        schematic: {
            sheet: { width: 120, height: 120 },
            lines: [
                {
                    x1: 60,
                    y1: 80,
                    x2: 60,
                    y2: 53,
                    color: '#080d02',
                    width: 1,
                    ownerIndex: 'A2',
                    recordType: '6'
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
        /<line x1="60" y1="40" x2="60" y2="67" stroke="var\(--schematic-default-ink-color\)" stroke-width="1" \/>/
    )
    assert.doesNotMatch(markup, /stroke="#506f2a"/)
})

/**
 * Verifies source colors that are close to Altium's default schematic navy are
 * treated as semantic schematic ink, even when the source value is not exactly
 * the canonical `#000080` token.
 */
test('renderSchematicSvg colors default-navy free graphic lines as schematic ink', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Default navy free graphic schematic' },
        schematic: {
            sheet: { width: 180, height: 120 },
            lines: [
                {
                    x1: 20,
                    y1: 80,
                    x2: 160,
                    y2: 80,
                    color: '#11037f',
                    width: 2,
                    lineStyle: 3,
                    recordType: '6'
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
        /<line x1="20" y1="40" x2="160" y2="40" stroke="var\(--schematic-default-ink-color\)" stroke-width="2" stroke-dasharray="16 10 3 10" stroke-linecap="round" \/>/
    )
    assert.doesNotMatch(markup, /stroke="#11037f"/)
})

/**
 * Verifies non-electrical free graphics preserve authored dark gray section
 * frame colors instead of collapsing into the default wire color.
 */
test('renderSchematicSvg preserves unknown free graphic line colors', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Free graphic color schematic' },
        schematic: {
            sheet: { width: 180, height: 120 },
            lines: [
                {
                    x1: 20,
                    y1: 80,
                    x2: 160,
                    y2: 80,
                    color: '#443c3e',
                    width: 1,
                    recordType: '6'
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
        /<line x1="20" y1="40" x2="160" y2="40" stroke="#443c3e" stroke-width="1" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<line x1="20" y1="40" x2="160" y2="40" stroke="var\(--schematic-default-ink-color\)"/
    )
})
