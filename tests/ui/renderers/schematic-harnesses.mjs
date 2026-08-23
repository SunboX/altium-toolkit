// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies normalized signal harnesses render their trunk, connector,
 * entries, and type label through the existing schematic theme tokens.
 */
test('renderSchematicSvg renders complete signal harness geometry', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Harness schematic' },
        schematic: {
            sheet: { width: 300, height: 200 },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            harnesses: {
                connectors: [
                    {
                        x: 80,
                        y: 140,
                        width: 70,
                        height: 40,
                        side: 'left',
                        primaryConnectionPosition: 20,
                        lineWidth: 1,
                        color: '#9fc5e8',
                        fill: '#ffffff',
                        entries: [
                            {
                                name: 'DATA_P',
                                side: 'right',
                                distanceFromTop: 10,
                                textColor: '#000080'
                            },
                            {
                                name: 'DATA_N',
                                side: 'right',
                                distanceFromTop: 30,
                                textColor: '#000080'
                            }
                        ],
                        typeLabel: {
                            text: 'DATA_BUS',
                            x: 105,
                            y: 145,
                            color: '#000080'
                        }
                    }
                ],
                signalHarnesses: [
                    {
                        points: [
                            { x: 20, y: 120 },
                            { x: 80, y: 120 }
                        ],
                        color: '#9fc5e8',
                        lineWidth: 2
                    }
                ]
            }
        }
    })

    assert.match(markup, /class="schematic-signal-harness"/)
    assert.match(markup, /points="20,80 80,80"/)
    assert.match(markup, /class="schematic-harness-connector"/)
    assert.match(markup, /class="schematic-harness-entry"/)
    assert.match(markup, />DATA_P</)
    assert.match(markup, />DATA_N</)
    assert.match(markup, /class="schematic-harness-type"/)
    assert.match(markup, />DATA_BUS</)
    assert.match(markup, /stroke="#9fc5e8"/)
    assert.doesNotMatch(markup, /style="[^";]*color:/)
})
