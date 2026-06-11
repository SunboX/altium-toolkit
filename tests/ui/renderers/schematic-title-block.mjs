// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies source-provided footer hints replace the generic title-block grid
 * with the corrected A3 footer layout and label placement.
 */
test('renderSchematicSvg uses footer title-block hints for A3 footer placement', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: 'footer-hints.SchDoc',
        summary: { title: 'Footer hints schematic' },
        schematic: {
            sheet: {
                width: 1654,
                height: 1169,
                sourceWidth: 1500,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 20,
                xZones: 8,
                yZones: 4,
                paperSize: 'A3',
                titleBlock: {
                    title: 'EMBER-UNIT Power',
                    documentNumber: 'CORE-MOD',
                    revision: '03',
                    sheetNumber: '2',
                    sheetTotal: '7',
                    date: '3/17/2026',
                    drawnBy: '',
                    footerHints: {
                        title: {
                            x: 1225,
                            y: 75,
                            color: '#000080',
                            fontSize: 14,
                            fontFamily: 'Times New Roman',
                            fontWeight: 700
                        },
                        documentNumber: {
                            x: 1420,
                            y: 80,
                            color: '#ff0000',
                            fontSize: 14,
                            fontFamily: 'Times New Roman',
                            fontWeight: 700
                        },
                        revision: {
                            x: 1455,
                            y: 50,
                            color: '#000080',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        },
                        sheetNumber: {
                            x: 1405,
                            y: 30,
                            color: '#000080',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        },
                        sheetTotal: {
                            x: 1435,
                            y: 30,
                            color: '#000080',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        }
                    }
                }
            },
            lines: [],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /<rect x="1259" y="1071" width="375" height="78" \/>/)
    assert.match(markup, /<line x1="1259" y1="1110" x2="1634" y2="1110" \/>/)
    assert.match(
        markup,
        /<line x1="1259" y1="1129.50" x2="1634" y2="1129.50" \/>/
    )
    assert.match(
        markup,
        /<line x1="1259" y1="1139.25" x2="1634" y2="1139.25" \/>/
    )
    assert.match(
        markup,
        /<line x1="1510.25" y1="1071" x2="1510.25" y2="1110" \/>/
    )
    assert.match(markup, /<line x1="1319" y1="1110" x2="1319" y2="1129.50" \/>/)
    assert.match(markup, /<line x1="1529" y1="1110" x2="1529" y2="1129.50" \/>/)
    assert.match(
        markup,
        /<line x1="1472.75" y1="1129.50" x2="1472.75" y2="1149" \/>/
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1270.25" y="1083.48" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Title</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1277.75" y="1114.88" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Size</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1331" y="1114.88" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Number</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1537" y="1114.88" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Revision</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1267" y="1135.84" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Date:</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1267" y="1145.59" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">File:</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1480.75" y="1145.59" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Drawn By:</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1379" y="1094" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">EMBER-UNIT Power</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1574" y="1089" fill="var\(--schematic-alert-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">CORE-MOD</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1609" y="1122.19" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">03</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1289" y="1124.63" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">A3</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1480.75" y="1135.84" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Sheet</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1559" y="1135.84" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">2</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1569" y="1135.84" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">of</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1589" y="1135.84" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">7</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1349" y="1135.84" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">3\/17\/2026</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1349" y="1145.59" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">footer-hints\.SchDoc</
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-value" x="1574" y="1139" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">Sheet 2 of 7</
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-value" x="1349" y="1141.20" fill="var\(--schematic-text-color\)" text-anchor="start">3\/17\/2026</
    )
})

/**
 * Verifies expanded A2 footer hints use the corrected footer grid instead of
 * the generic fallback block, keeping the box flush to the right sheet edge.
 */
test('renderSchematicSvg uses footer title-block hints for promoted A2 placement', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: 'expanded-footer-hints.SchDoc',
        summary: { title: 'Expanded footer hints schematic' },
        schematic: {
            sheet: {
                width: 2339,
                height: 1654,
                sourceWidth: 1500,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 20,
                xZones: 8,
                yZones: 4,
                paperSize: 'A2',
                titleBlock: {
                    title: 'SKYLACE-CINDER',
                    revision: '01',
                    documentNumber: 'SIGIL-VAULT',
                    sheetNumber: '8',
                    sheetTotal: '8',
                    date: '3/19/2026',
                    drawnBy: 'OR',
                    footerHints: {
                        title: {
                            x: 1900,
                            y: 90,
                            color: '#000080',
                            fontSize: 14,
                            fontFamily: 'Times New Roman',
                            fontWeight: 700
                        },
                        documentNumber: {
                            x: 2130,
                            y: 90,
                            color: '#ff0000',
                            fontSize: 14,
                            fontFamily: 'Times New Roman',
                            fontWeight: 700
                        },
                        revision: {
                            x: 2125,
                            y: 60,
                            color: '#000080',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        }
                    }
                }
            },
            lines: [],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /<rect x="1780" y="1546" width="539" height="88" \/>/)
    assert.match(markup, /<line x1="1780" y1="1590" x2="2319" y2="1590" \/>/)
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1878.24" y="1595.50" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Number</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="2176.08" y="1595.50" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Revision</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1947.09" y="1564" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">SKYLACE-CINDER</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="2232.76" y="1564" fill="var\(--schematic-alert-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">SIGIL-VAULT</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="2281.27" y="1603.75" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">01</
    )
    assert.doesNotMatch(
        markup,
        /<rect x="1780" y="1546" width="390" height="88" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-label" x="2041.30" y="1560.08" fill="var\(--schematic-sheet-label-color\)" text-anchor="start">Number</
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-value" x="1900" y="1564" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">SKYLACE-CINDER</
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-value" x="2130" y="1564" fill="var\(--schematic-alert-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">SIGIL-VAULT</
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-value" x="2125" y="1603.75" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">01</
    )
})

/**
 * Verifies sparse A4 footer hints still switch to the compact hinted footer
 * layout when sheet numbering sits above a separate drawn-by row.
 */
test('renderSchematicSvg uses sparse A4 footer hints for compact footer placement', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: 'footer-row-a4.SchDoc',
        summary: { title: 'Sparse footer A4 schematic' },
        schematic: {
            sheet: {
                width: 1360,
                height: 800,
                sourceWidth: 1360,
                sourceHeight: 800,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 20,
                xZones: 4,
                yZones: 4,
                titleBlock: {
                    title: 'EMBER-TRIGGER Board',
                    documentNumber: '',
                    revision: '01',
                    sheetNumber: '1',
                    sheetTotal: '8',
                    drawnBy: 'NR',
                    footerHints: {
                        title: {
                            x: 1040,
                            y: 80,
                            color: '#800000',
                            fontSize: 14,
                            fontFamily: 'Times New Roman',
                            fontWeight: 700
                        },
                        revision: {
                            x: 1250,
                            y: 45,
                            color: '#800000',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        },
                        sheetNumber: {
                            x: 1205,
                            y: 30,
                            color: '#800000',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        },
                        sheetTotal: {
                            x: 1235,
                            y: 30,
                            color: '#800000',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        }
                    }
                }
            },
            lines: [],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /<rect x="920" y="742" width="420" height="78" \/>/)
    assert.match(markup, /<line x1="920" y1="781" x2="1340" y2="781" \/>/)
    assert.match(markup, /<line x1="920" y1="800.50" x2="1340" y2="800.50" \/>/)
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1050.20" y="760" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">EMBER-TRIGGER Board</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1310.60" y="793.19" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">01</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1256" y="806.84" fill="var\(--schematic-default-ink-color\)" text-anchor="middle">1</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1289.60" y="806.84" fill="var\(--schematic-default-ink-color\)" text-anchor="middle">8</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1310.60" y="816.59" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">NR</
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-value" x="1094" y="749.64" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">Sheet 1 of 8</
    )
})
