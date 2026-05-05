// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies normalized larger sheets scale schematic primitives into the
 * expanded inner frame without moving the sheet chrome.
 */
test('renderSchematicSvg scales schematic content into the normalized inner frame', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Scaled schematic' },
        schematic: {
            sheet: {
                width: 1654,
                height: 1169,
                sourceWidth: 1500,
                sourceHeight: 950,
                marginWidth: 20,
                titleBlockOn: true,
                paperSize: 'A3',
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    },
                    8: {
                        size: 18,
                        family: 'Times New Roman',
                        bold: true
                    }
                }
            },
            lines: [
                {
                    x1: 130,
                    y1: 1017,
                    x2: 1262,
                    y2: 1017,
                    color: '#000080',
                    width: 1
                },
                {
                    x1: 130,
                    y1: 109,
                    x2: 1262,
                    y2: 109,
                    color: '#000080',
                    width: 1
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
        /<defs><clipPath id="schematic-content-clip-[^"]+"><rect x="20" y="20" width="1614" height="1129" \/><\/clipPath><\/defs><g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(130 25\.10\) scale\(1\.11\) translate\(-130 -152\)">/
    )
})

/**
 * Verifies normalized larger sheets anchor against the dominant drawing box
 * instead of tiny primitives that sit slightly above it.
 */
test('renderSchematicSvg biases normalized-sheet placement toward the dominant drawing box', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Dominant box anchor' },
        schematic: {
            sheet: {
                width: 1654,
                height: 1169,
                sourceWidth: 1500,
                sourceHeight: 950,
                marginWidth: 20,
                titleBlockOn: true,
                paperSize: 'A3',
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    },
                    8: {
                        size: 18,
                        family: 'Times New Roman',
                        bold: true
                    }
                }
            },
            lines: [],
            rectangles: [
                {
                    x: 130,
                    y: 300,
                    width: 1050,
                    height: 699,
                    color: '#ff6699',
                    fill: 'transparent',
                    isSolid: false,
                    transparent: true,
                    lineWidth: 1
                }
            ],
            texts: [
                {
                    x: 130,
                    y: 1017,
                    text: 'small top outlier',
                    color: '#000080',
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400
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
        /<defs><clipPath id="schematic-content-clip-[^"]+"><rect x="20" y="20" width="1614" height="1129" \/><\/clipPath><\/defs><g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(130 5\.20\) scale\(1\.11\) translate\(-130 -152\)">/
    )
})

/**
 * Verifies sparse content on preserved custom sheets scales from the
 * bottom-left inner-frame origin so authored geometry does not appear tiny on
 * large custom pages.
 */
test('renderSchematicSvg scales sparse custom-sheet content from the bottom-left frame origin', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Custom sheet fit' },
        schematic: {
            sheet: {
                width: 1500,
                height: 950,
                sourceWidth: 1500,
                sourceHeight: 950,
                marginWidth: 20,
                borderOn: true,
                titleBlockOn: true,
                xZones: 4,
                yZones: 4,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    }
                }
            },
            lines: [
                {
                    x1: 225,
                    y1: 353,
                    x2: 881,
                    y2: 353,
                    color: '#000080',
                    width: 1
                },
                {
                    x1: 225,
                    y1: 630,
                    x2: 881,
                    y2: 630,
                    color: '#000080',
                    width: 1
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
        /<defs><clipPath id="schematic-content-clip-[^"]+"><rect x="20" y="20" width="1460" height="910" \/><\/clipPath><\/defs><g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(20 930\) scale\(1\.29\) translate\(-20 -930\)">/
    )
})
