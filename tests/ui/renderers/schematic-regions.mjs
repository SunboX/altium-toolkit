// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies authored sheet overlay regions render as faded boxed overlays with
 * an alert border above the rest of the sheet chrome.
 */
test('renderSchematicSvg draws authored sheet overlay regions above sheet chrome', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: 'sheet-overlay-region.SchDoc',
        summary: { title: 'Overlay region schematic' },
        schematic: {
            sheet: {
                width: 500,
                height: 300,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 20,
                xZones: 4,
                yZones: 4,
                titleBlock: {
                    title: 'EMBER-TRIGGER Board',
                    revision: '01',
                    sheetNumber: '1',
                    sheetTotal: '8',
                    drawnBy: 'NR'
                }
            },
            lines: [
                {
                    x1: 170,
                    y1: 120,
                    x2: 300,
                    y2: 120,
                    color: '#000080',
                    width: 1
                }
            ],
            regions: [
                {
                    x: 160,
                    y: 60,
                    width: 160,
                    height: 100,
                    color: '#ff0000',
                    fill: '#ffffcf',
                    renderOrder: 24
                }
            ],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /<g class="schematic-regions">/)
    assert.match(
        markup,
        /<g class="schematic-region"><rect class="schematic-region__fill" x="160" y="140" width="160" height="100" fill="#ffffcf" fill-opacity="0.72" \/><rect class="schematic-region__border" x="160" y="140" width="160" height="100" fill="none" stroke="var\(--schematic-alert-color\)" stroke-width="1" \/><polygon class="schematic-region__marker" points="164,144 176,144 164,156" fill="var\(--schematic-alert-color\)" fill-opacity="0.25" stroke="var\(--schematic-alert-color\)" stroke-width="1" \/><\/g>/
    )
    assert.ok(
        markup.indexOf('sheet-title-block') <
            markup.indexOf('schematic-regions')
    )
})
