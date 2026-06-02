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
        /<defs><clipPath id="schematic-content-clip-[^"]+"><rect x="20" y="20" width="1614" height="1129" \/><\/clipPath><\/defs><g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(130 25\.10\) scale\(1\.1055\) translate\(-130 -152\)">/
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
        /<defs><clipPath id="schematic-content-clip-[^"]+"><rect x="20" y="20" width="1614" height="1129" \/><\/clipPath><\/defs><g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(130 5\.20\) scale\(1\.1055\) translate\(-130 -152\)">/
    )
})

/**
 * Verifies preserved custom border sheets render the authored Y extent as the
 * inner sheet frame instead of flattening the surrounding zone bands into it.
 */
test('renderSchematicSvg adds zone bands around custom border sheet height', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Custom sheet bands' },
        schematic: {
            sheet: {
                width: 1500,
                height: 950,
                sourceWidth: 1500,
                sourceHeight: 950,
                marginWidth: 20,
                borderOn: true,
                titleBlockOn: false,
                xZones: 4,
                yZones: 4
            },
            lines: [
                {
                    x1: 30,
                    y1: 30,
                    x2: 1120,
                    y2: 30,
                    color: '#000080',
                    width: 2
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
        /<svg class="schematic-svg" viewBox="0 0 1500 990" preserveAspectRatio="xMidYMid meet"/
    )
    assert.match(
        markup,
        /<rect class="sheet-backdrop" x="0" y="0" width="1500" height="990" rx="18" \/>/
    )
    assert.match(
        markup,
        /<rect class="sheet-frame" x="20" y="20" width="1460" height="950" \/>/
    )
})

/**
 * Verifies sparse content on preserved custom sheets scales into the
 * horizontally centered inner frame so authored geometry does not leave
 * one-sided page slack on large custom pages.
 */
test('renderSchematicSvg horizontally centers sparse custom-sheet content after scaling', () => {
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
        /<defs><clipPath id="schematic-content-clip-[^"]+"><rect x="20" y="20" width="1460" height="950" \/><\/clipPath><\/defs><g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(325\.84 571\.79\) scale\(1\.2932\) translate\(-225 -340\)">/
    )
})

/**
 * Verifies non-rendered component placeholders do not prevent sparse custom
 * sheets from scaling visible schematic content into the authored frame.
 */
test('renderSchematicSvg scales sparse custom sheets with hidden origin placeholders', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Hidden placeholder fit' },
        schematic: {
            sheet: {
                width: 1500,
                height: 950,
                sourceWidth: 1500,
                sourceHeight: 950,
                marginWidth: 20,
                borderOn: true,
                titleBlockOn: false,
                xZones: 4,
                yZones: 4,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    },
                    6: {
                        size: 36,
                        family: 'Times New Roman',
                        bold: false
                    }
                }
            },
            lines: [
                {
                    x1: 740,
                    y1: 730,
                    x2: 1120,
                    y2: 730,
                    color: '#000080',
                    width: 2
                },
                {
                    x1: 30,
                    y1: 30,
                    x2: 1120,
                    y2: 30,
                    color: '#000080',
                    width: 2
                }
            ],
            texts: [
                {
                    x: 50,
                    y: 690,
                    text: 'EMBER NODE',
                    color: '#000080',
                    fontSize: 36,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400
                }
            ],
            components: [
                {
                    x: 0,
                    y: 580,
                    designator: 'U?'
                }
            ],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(39\.55 37\.50\) scale\(1\.3036\) translate\(-30 -240\)">/
    )
})

/**
 * Verifies large free-text section headings lift clear of same-coordinate
 * dash-dot frame lines instead of rendering their baseline on the border.
 */
test('renderSchematicSvg lifts large section headings above dash-dot frame lines', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Section title clearance' },
        schematic: {
            sheet: {
                width: 400,
                height: 300,
                sourceWidth: 400,
                sourceHeight: 300,
                marginWidth: 20,
                borderOn: false,
                titleBlockOn: false,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    },
                    2: {
                        size: 24,
                        family: 'Times New Roman',
                        bold: false
                    }
                }
            },
            lines: [
                {
                    x1: 20,
                    y1: 100,
                    x2: 220,
                    y2: 100,
                    color: '#11037f',
                    width: 2,
                    lineStyle: 3
                }
            ],
            texts: [
                {
                    x: 40,
                    y: 100,
                    text: 'FAKE TITLE',
                    color: '#11037f',
                    recordType: '4',
                    fontSize: 24,
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
        /<line x1="20" y1="200" x2="220" y2="200" stroke="var\(--schematic-default-ink-color\)" stroke-width="2" stroke-dasharray="16 10 3 10"/
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="40" y="191\.72" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="23" font-family="Times New Roman" font-weight="400">FAKE TITLE<\/text>/
    )
})
