// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { BomTableRenderer } from '../../../src/ui/BomTableRenderer.mjs'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies schematic renderer emits an SVG scene.
 */
test('renderSchematicSvg renders lines and labels', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Demo schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                { x1: 0, y1: 0, x2: 200, y2: 0, color: '#000000', width: 1 }
            ],
            texts: [
                { x: 20, y: 20, text: 'R1', color: '#111111', hidden: false }
            ],
            components: []
        }
    })

    assert.match(markup, /<svg/)
    assert.match(markup, /Demo schematic/)
    assert.match(markup, /<line/)
    assert.match(markup, />R1</)
})

/**
 * Verifies imported schematic colors are normalized to theme variables so the
 * rendered SVG can switch palettes without rewriting document data.
 */
test('renderSchematicSvg maps imported schematic colors to theme variables', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Theme schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                { x1: 10, y1: 50, x2: 60, y2: 50, color: '#000080', width: 1 }
            ],
            rectangles: [
                {
                    x: 80,
                    y: 40,
                    width: 20,
                    height: 10,
                    color: '#800000',
                    fill: '#ffffb0',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                }
            ],
            texts: [
                { x: 20, y: 20, text: 'MD11', color: '#800000', hidden: false }
            ],
            components: [],
            pins: [
                {
                    x: 120,
                    y: 60,
                    length: 10,
                    name: 'EN',
                    designator: '1',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: [
                {
                    x: 140,
                    y: 30,
                    width: 30,
                    height: 10,
                    name: 'UART',
                    fill: '#ffe16f',
                    color: '#8d2b2b'
                }
            ],
            crosses: [{ x: 180, y: 20, size: 6, color: '#ff0000' }]
        }
    })

    assert.match(markup, /stroke="var\(--schematic-default-ink-color\)"/)
    assert.match(
        markup,
        /fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>MD11</
    )
    assert.match(
        markup,
        /class="schematic-pin-line"[^>]*stroke="var\(--schematic-accent-ink-color\)"/
    )
    assert.match(
        markup,
        /class="schematic-pin-name"[^>]*fill="var\(--schematic-text-color\)"/
    )
    assert.match(
        markup,
        /<rect class="schematic-rectangle"[^>]*fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)"/
    )
    assert.match(
        markup,
        /<polygon points="140,65 162,65 170,70 162,75 140,75" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-port-color\)" \/>/
    )
    assert.match(
        markup,
        /class="schematic-cross"><line[^>]*stroke="var\(--schematic-alert-color\)"/
    )
    assert.doesNotMatch(
        markup,
        /#000080|#0000ff|#1f1f1f|#800000|#8d2b2b|#ffffb0|#ffe16f|#ff0000/
    )
})

/**
 * Verifies solid schematic polygons render source fills, mapping known colors
 * to theme variables and preserving unknown normalized hex values.
 */
test('renderSchematicSvg renders filled polygons from source AreaColor values', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Polygon fill schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [],
            polygons: [
                {
                    points: [
                        { x: 20, y: 20 },
                        { x: 36, y: 20 },
                        { x: 28, y: 36 }
                    ],
                    color: '#0000ff',
                    fill: '#800000',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                },
                {
                    points: [
                        { x: 60, y: 20 },
                        { x: 76, y: 20 },
                        { x: 68, y: 36 }
                    ],
                    color: '#0000ff',
                    fill: '#00c0c0',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                }
            ],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(markup, /<g class="schematic-polygons">/)
    assert.match(
        markup,
        /<polygon class="schematic-polygon" points="20,80 36,80 28,64" fill="var\(--schematic-power-color\)" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-linejoin="round" \/>/
    )
    assert.match(
        markup,
        /<polygon class="schematic-polygon" points="60,80 76,80 68,64" fill="#00c0c0" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-linejoin="round" \/>/
    )
})

/**
 * Verifies schematic bus trunks render thicker than ordinary wires so grouped
 * routes remain visually distinct.
 */
test('renderSchematicSvg renders bus lines with a thicker stroke', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Bus schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                {
                    x1: 10,
                    y1: 70,
                    x2: 60,
                    y2: 70,
                    color: '#000080',
                    width: 1
                },
                {
                    x1: 80,
                    y1: 70,
                    x2: 80,
                    y2: 20,
                    color: '#000080',
                    width: 1,
                    isBus: true
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
        /<line x1="10" y1="30" x2="60" y2="30" stroke="var\(--schematic-default-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="80" y1="30" x2="80" y2="80" stroke="var\(--schematic-default-ink-color\)" stroke-width="3" \/>/
    )
})

/**
 * Verifies rounded stroke caps apply only to open schematic drawing
 * primitives, not the entire SVG scene.
 */
test('renderSchematicSvg rounds symbol and wire primitive stroke caps', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Rounded schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 100,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 10,
                xZones: 4,
                yZones: 4
            },
            lines: [
                { x1: 10, y1: 60, x2: 80, y2: 60, color: '#000080', width: 1 }
            ],
            arcs: [
                {
                    x: 100,
                    y: 50,
                    radius: 8,
                    startAngle: 0,
                    endAngle: 180,
                    color: '#000080',
                    width: 1
                }
            ],
            texts: [
                {
                    x: 140,
                    y: 30,
                    text: 'GND',
                    color: '#800000',
                    recordType: '17',
                    style: 4,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    anchor: 'middle',
                    powerPortDirection: 'down'
                }
            ],
            components: [],
            pins: [
                {
                    x: 50,
                    y: 30,
                    length: 12,
                    name: 'IO',
                    designator: '1',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: [],
            crosses: [{ x: 170, y: 60, size: 6, color: '#ff0000' }]
        }
    })

    assert.match(markup, /<g class="schematic-lines" stroke-linecap="round">/)
    assert.match(markup, /<g class="schematic-arcs" stroke-linecap="round">/)
    assert.match(markup, /<g class="schematic-pins" stroke-linecap="round">/)
    assert.match(markup, /<g class="schematic-crosses" stroke-linecap="round">/)
    assert.match(
        markup,
        /<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round">/
    )
    assert.doesNotMatch(markup, /<svg[^>]*stroke-linecap="round"/)
})

/**
 * Verifies electrical tee junctions render a dot while simple owner linework
 * corners do not.
 */
test('renderSchematicSvg renders junction dots only for connected wire tees', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Junction schematic' },
        schematic: {
            sheet: { width: 120, height: 100 },
            lines: [
                { x1: 25, y1: 30, x2: 25, y2: 50, color: '#0000ff', width: 1 },
                { x1: 25, y1: 50, x2: 25, y2: 70, color: '#0000ff', width: 1 },
                { x1: 25, y1: 50, x2: 45, y2: 50, color: '#0000ff', width: 1 },
                {
                    x1: 70,
                    y1: 20,
                    x2: 70,
                    y2: 40,
                    color: '#0000ff',
                    width: 1,
                    ownerIndex: 'U1'
                },
                {
                    x1: 70,
                    y1: 40,
                    x2: 90,
                    y2: 40,
                    color: '#0000ff',
                    width: 1,
                    ownerIndex: 'U1'
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
        /<circle class="schematic-junction" cx="25" cy="50" r="2" fill="var\(--schematic-accent-ink-color\)" \/>/
    )
    assert.equal((markup.match(/class="schematic-junction"/g) || []).length, 1)
})

/**
 * Verifies title-block and other graphic line crossings do not synthesize
 * electrical junction dots.
 */
test('renderSchematicSvg skips junction dots on graphic table linework', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Graphic table schematic' },
        schematic: {
            sheet: { width: 180, height: 140 },
            lines: [
                {
                    x1: 100,
                    y1: 40,
                    x2: 140,
                    y2: 40,
                    color: '#a44a1b',
                    width: 2,
                    recordType: '6'
                },
                {
                    x1: 100,
                    y1: 70,
                    x2: 140,
                    y2: 70,
                    color: '#a44a1b',
                    width: 2,
                    recordType: '6'
                },
                {
                    x1: 100,
                    y1: 30,
                    x2: 100,
                    y2: 90,
                    color: '#a44a1b',
                    width: 2,
                    recordType: '6'
                },
                {
                    x1: 20,
                    y1: 110,
                    x2: 60,
                    y2: 110,
                    color: '#000080',
                    width: 1,
                    recordType: '27'
                },
                {
                    x1: 60,
                    y1: 110,
                    x2: 90,
                    y2: 110,
                    color: '#000080',
                    width: 1,
                    recordType: '27'
                },
                {
                    x1: 60,
                    y1: 90,
                    x2: 60,
                    y2: 110,
                    color: '#000080',
                    width: 1,
                    recordType: '27'
                }
            ],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.doesNotMatch(markup, /class="schematic-junction" cx="100" cy="70"/)
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="60" cy="30" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
    assert.equal((markup.match(/class="schematic-junction"/g) || []).length, 1)
})

/**
 * Verifies schematic SVG output projects document-space Y into screen-space Y
 * and renders schematic primitives around the sheet.
 */
test('renderSchematicSvg inverts schematic Y coordinates for SVG', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: AltiumFixtureLoader.moonSheetFileName,
        summary: { title: 'Projected schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 100,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 10,
                xZones: 4,
                yZones: 4,
                titleBlock: {
                    title: 'SKYLACE-ARC',
                    revision: '01',
                    documentNumber: '',
                    sheetNumber: '4',
                    sheetTotal: '6',
                    date: '3/09/2026',
                    drawnBy: ''
                }
            },
            lines: [
                { x1: 20, y1: 80, x2: 50, y2: 80, color: '#000080', width: 1 }
            ],
            texts: [
                {
                    x: 20,
                    y: 80,
                    text: 'Zephyr Node',
                    color: '#000080',
                    hidden: false,
                    recordType: '4',
                    style: 0,
                    fontSize: 22,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'middle'
                },
                {
                    x: 120,
                    y: 70,
                    text: 'AURA_3V3',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 2,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'middle'
                },
                {
                    x: 160,
                    y: 60,
                    text: 'WYRN',
                    color: '#8d2b2b',
                    hidden: false,
                    recordType: '25',
                    style: 0,
                    fontSize: 12,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 90,
                    anchor: 'start'
                }
            ],
            components: [{ x: 40, y: 80, designator: 'U6' }],
            pins: [
                {
                    x: 20,
                    y: 80,
                    length: 10,
                    name: 'EN',
                    designator: '3',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                },
                {
                    x: 140,
                    y: 80,
                    length: 10,
                    name: '1',
                    designator: '1',
                    orientation: 'right',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 70,
                    y: 40,
                    length: 10,
                    name: 'A',
                    designator: '1',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-only'
                },
                {
                    x: 90,
                    y: 30,
                    length: 10,
                    name: '2',
                    designator: '2',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'hidden'
                }
            ],
            ports: [
                {
                    x: 90,
                    y: 60,
                    width: 30,
                    height: 10,
                    name: 'RUNE_CTL',
                    fill: '#ffe16f',
                    color: '#8d2b2b'
                }
            ],
            crosses: [{ x: 150, y: 60, size: 6, color: '#ff0000' }]
        }
    })

    assert.match(markup, /<line x1="20" y1="20" x2="50" y2="20"/)
    assert.match(
        markup,
        /<text class="schematic-label" x="20" y="20" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="21" font-family="Times New Roman"/
    )
    assert.match(markup, /schematic-power-port--rail/)
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="120" y="14" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="9"/
    )
    assert.match(markup, /transform="rotate\(-90 160 40\)"/)
    assert.match(
        markup,
        /text class="schematic-designator" x="48" y="12" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>U6</
    )
    assert.match(markup, /sheet-frame/)
    assert.match(markup, /sheet-title-block/)
    assert.match(markup, /schematic-pin-name/)
    assert.match(
        markup,
        /class="schematic-pin-line" x1="20" y1="20" x2="10" y2="20"/
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="24" y="23" fill="var\(--schematic-text-color\)"[^>]*>EN</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="142" y="19" fill="var\(--schematic-text-color\)" text-anchor="start"[^>]*>1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="80" y="63" fill="var\(--schematic-text-color\)" text-anchor="start"[^>]*>A</
    )
    assert.doesNotMatch(
        markup,
        /text class="schematic-pin-number" x="76" y="58"/
    )
    assert.match(markup, /x1="90" y1="70" x2="80" y2="70"/)
    assert.doesNotMatch(markup, /class="schematic-pin-number"[^>]*>2</)
    assert.match(markup, /SKYLACE-ARC/)
    assert.match(markup, /Sheet 4 of 6/)
    assert.match(markup, /sheet-zone-label/)
    assert.equal(
        (markup.match(/class="sheet-zone-separator"/g) || []).length,
        12
    )
    assert.match(
        markup,
        /<line class="sheet-zone-separator" x1="55" y1="0" x2="55" y2="10" \/>/
    )
    assert.match(
        markup,
        /<line class="sheet-zone-separator" x1="55" y1="90" x2="55" y2="100" \/>/
    )
    assert.match(
        markup,
        /<line class="sheet-zone-separator" x1="0" y1="30" x2="10" y2="30" \/>/
    )
    assert.match(
        markup,
        /<line class="sheet-zone-separator" x1="190" y1="30" x2="200" y2="30" \/>/
    )
    assert.match(markup, /File/)
    assert.match(markup, /Number/)
    assert.match(markup, /Date:/)
    assert.match(markup, /Drawn By:/)
    assert.match(markup, /Skylace-Moon\.SchDoc/)
    assert.match(markup, /schematic-port/)
    assert.match(markup, /schematic-cross/)
})

/**
 * Verifies four-pin crystal-style owners rotate top number-only pin labels
 * along the vertical pin axis instead of leaving them horizontal.
 */
test('renderSchematicSvg rotates top crystal pin numbers for four-pin owners', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Crystal pin schematic' },
        schematic: {
            sheet: {
                width: 120,
                height: 100,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [
                {
                    x: 60,
                    y: 50,
                    length: 20,
                    name: '4',
                    designator: '4',
                    orientation: 'right',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '8001'
                },
                {
                    x: 60,
                    y: 60,
                    length: 20,
                    name: '2',
                    designator: '2',
                    orientation: 'right',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '8001'
                },
                {
                    x: 50,
                    y: 45,
                    length: 20,
                    name: '3',
                    designator: '3',
                    orientation: 'bottom',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '8001'
                },
                {
                    x: 50,
                    y: 65,
                    length: 20,
                    name: '1',
                    designator: '1',
                    orientation: 'top',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '8001'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /text class="schematic-pin-number" x="48" y="29" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 48 29\)">1</
    )
})

/**
 * Verifies compact number-only pins with authored double markers place their
 * numbers outside the marker glyph instead of overlapping either triangle.
 */
test('renderSchematicSvg clears double outer pin markers from pin numbers', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Compact marker schematic' },
        schematic: {
            sheet: {
                width: 220,
                height: 140,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [
                {
                    x: 110,
                    y: 80,
                    length: 20,
                    name: 'A',
                    designator: '1',
                    orientation: 'left',
                    symbolOuter: 34,
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: 'P42'
                },
                {
                    x: 150,
                    y: 80,
                    length: 20,
                    name: 'B',
                    designator: '2',
                    orientation: 'right',
                    symbolOuter: 34,
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: 'P42'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<polygon points="104,57 104,63 110,60"[\s\S]+<polygon points="101,57 101,63 95,60"[\s\S]+<text class="schematic-pin-number" x="93" y="59" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">1<\/text>/
    )
    assert.match(
        markup,
        /<polygon points="156,57 156,63 150,60"[\s\S]+<polygon points="159,57 159,63 165,60"[\s\S]+<text class="schematic-pin-number" x="167" y="59" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">2<\/text>/
    )
})

/**
 * Verifies normalized schematic arcs render as SVG path arc commands instead
 * of being ignored like unsupported geometry.
 */
test('renderSchematicSvg renders normalized schematic arcs as SVG paths', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Arc schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [],
            arcs: [
                {
                    x: 20,
                    y: 20,
                    radius: 5,
                    startAngle: 0,
                    endAngle: 180,
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
        /<path class="schematic-arc" d="M [^"]*A 5 5 0 [01] [01] [^"]*" stroke="var\(--schematic-default-ink-color\)" stroke-width="1" fill="none" \/>/
    )
})

/**
 * Verifies the synthesized title block uses the resolved sheet paper size
 * instead of a hard-coded A4 label.
 */
test('renderSchematicSvg renders the resolved paper size in the title block', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: AltiumFixtureLoader.dawnSheetFileName,
        summary: { title: 'Dawn schematic' },
        schematic: {
            sheet: {
                width: 300,
                height: 180,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 10,
                paperSize: 'A3',
                titleBlock: {
                    title: 'SKYLACE-ARC',
                    revision: '01',
                    documentNumber: '',
                    sheetNumber: '1',
                    sheetTotal: '6',
                    date: '3/09/2026',
                    drawnBy: ''
                }
            },
            lines: [],
            texts: [],
            components: []
        }
    })

    assert.match(markup, />A3</)
})

/**
 * Verifies already-expanded footer hints stay on-sheet after custom-page
 * promotion instead of being shifted by the old source-width delta again.
 */
test('renderSchematicSvg keeps expanded A2 footer hints on-sheet and renders drawn-by', () => {
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
                xZones: 4,
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
    assert.match(markup, />SKYLACE-CINDER</)
    assert.match(markup, />SIGIL-VAULT</)
    assert.match(markup, />01</)
    assert.match(markup, />OR</)
    assert.doesNotMatch(
        markup,
        /<rect x="1780" y="1546" width="390" height="88" \/>/
    )
})

/**
 * Verifies fallback component markers disappear when the schematic already
 * contains a visible designator, and synthetic labels inherit sheet fonts.
 */
test('renderSchematicSvg uses sheet fonts for synthetic labels and skips duplicate component markers', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Duplicate-free schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 100,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [
                {
                    x: 40,
                    y: 80,
                    text: 'U6',
                    color: '#000080',
                    hidden: false,
                    name: 'Designator',
                    recordType: '34',
                    style: 0,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'start'
                }
            ],
            components: [{ x: 40, y: 80, designator: 'U6' }],
            pins: [
                {
                    x: 20,
                    y: 80,
                    length: 10,
                    name: 'EN',
                    designator: '3',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: [
                {
                    x: 90,
                    y: 60,
                    width: 30,
                    height: 10,
                    name: 'RUNE_CTL',
                    fill: '#ffe16f',
                    color: '#8d2b2b',
                    direction: 'left'
                }
            ]
        }
    })

    assert.doesNotMatch(markup, /class="schematic-node"/)
    assert.match(
        markup,
        /text class="schematic-pin-name" x="24" y="23" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">EN</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="18" y="19" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">3</
    )
    assert.match(
        markup,
        /<polygon points="90,40 98,35 120,35 120,45 98,45" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-port-color\)" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="41\.55" fill="var\(--schematic-port-color\)" text-anchor="middle" font-size="4\.31" font-family="Times New Roman" font-weight="400">RUNE_CTL</
    )
})

/**
 * Verifies resolved fallback component labels stay visible without rendering
 * the synthetic teal marker circle.
 */
test('renderSchematicSvg renders fallback component designators without node circles', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Fallback designator schematic' },
        schematic: {
            sheet: {
                width: 120,
                height: 100,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [{ x: 40, y: 80, designator: 'U6' }],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.doesNotMatch(markup, /class="schematic-node"/)
    assert.match(
        markup,
        /text class="schematic-designator" x="48" y="12" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">U6</
    )
})

/**
 * Verifies unresolved fallback component placements do not render the
 * synthetic green node marker or a placeholder U? designator.
 */
test('renderSchematicSvg skips unresolved fallback component markers', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Unresolved component schematic' },
        schematic: {
            sheet: { width: 120, height: 100 },
            lines: [],
            texts: [],
            components: [{ x: 40, y: 80, designator: 'U?' }],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.doesNotMatch(markup, /class="schematic-node"/)
    assert.doesNotMatch(markup, />U\?</)
})

/**
 * Verifies vertically adjacent off-sheet ports render as one stacked symbol
 * with a shared pointed outline and divider line.
 */
test('renderSchematicSvg stacks adjacent off-sheet ports into one symbol', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Stacked ports schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 100,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [
                {
                    x: 90,
                    y: 60,
                    width: 30,
                    height: 10,
                    name: 'RUNE_CTL',
                    fill: '#ffe16f',
                    color: '#8d2b2b',
                    direction: 'left'
                },
                {
                    x: 90,
                    y: 50,
                    width: 30,
                    height: 10,
                    name: 'RUNE_FLOW',
                    fill: '#ffe16f',
                    color: '#8d2b2b',
                    direction: 'left'
                }
            ]
        }
    })

    assert.match(
        markup,
        /<polygon points="90,40 98,35 120,35 120,45 98,45" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-port-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="90,50 98,45 120,45 120,55 98,55" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-port-color\)" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="41\.55" fill="var\(--schematic-port-color\)" text-anchor="middle" font-size="4\.31" font-family="Times New Roman" font-weight="400">RUNE_CTL</
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="51\.28" fill="var\(--schematic-port-color\)" text-anchor="middle" font-size="3\.55" font-family="Times New Roman" font-weight="400">RUNE_FLOW</
    )
    assert.equal((markup.match(/<g class="schematic-port">/g) || []).length, 1)
})
