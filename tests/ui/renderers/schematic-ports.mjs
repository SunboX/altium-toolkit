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
 * Verifies top and bottom pin numbers stay centered on each pin axis instead
 * of left-aligning into neighboring pin labels.
 */
test('renderSchematicSvg centers vertical pin numbers on the pin axis', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Pin axis schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 120,
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
                    x: 80,
                    y: 60,
                    length: 12,
                    name: 'IO13',
                    designator: '16',
                    orientation: 'bottom',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                },
                {
                    x: 100,
                    y: 60,
                    length: 12,
                    name: 'EN',
                    designator: '3',
                    orientation: 'top',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: []
        }
    })

    assert.match(
        markup,
        /text class="schematic-pin-number" x="78" y="67" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 78 67\)">16</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="84" y="56" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 84 56\)">IO13</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="98" y="54" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400">3</
    )
})

/**
 * Verifies dense multi-side number-only connector symbols rotate top pin
 * numbers so multi-digit labels follow the pin axis instead of rendering
 * horizontally into nearby power-port graphics.
 */
test('renderSchematicSvg rotates top numbers for dense number-only connectors', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Connector top pin rotation' },
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
                    x: 80,
                    y: 40,
                    length: 12,
                    name: '',
                    designator: '14',
                    orientation: 'left',
                    ownerIndex: 'J7',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 80,
                    y: 50,
                    length: 12,
                    name: '',
                    designator: '15',
                    orientation: 'left',
                    ownerIndex: 'J7',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 80,
                    y: 60,
                    length: 12,
                    name: '',
                    designator: '16',
                    orientation: 'left',
                    ownerIndex: 'J7',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 80,
                    y: 70,
                    length: 12,
                    name: '',
                    designator: '17',
                    orientation: 'left',
                    ownerIndex: 'J7',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 100,
                    y: 60,
                    length: 12,
                    name: '',
                    designator: '19',
                    orientation: 'top',
                    ownerIndex: 'J7',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 100,
                    y: 20,
                    length: 12,
                    name: '',
                    designator: '20',
                    orientation: 'bottom',
                    ownerIndex: 'J7',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                }
            ],
            ports: []
        }
    })

    assert.match(
        markup,
        /text class="schematic-pin-number" x="98" y="74" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 98 74\)">19</
    )
})

/**
 * Verifies tall connector symbols whose numbered contacts sit on one side plus
 * a top row still rotate multi-digit top numbers along the pin axis.
 */
test('renderSchematicSvg rotates top numbers for one-sided number-only connectors', () => {
    const leftPins = Array.from({ length: 6 }, (_, index) => ({
        x: 120,
        y: 40 + index * 10,
        length: 10,
        name: String(index + 1),
        designator: String(index + 1),
        orientation: 'left',
        ownerIndex: 'J26',
        color: '#0000ff',
        labelColor: '#1f1f1f',
        labelMode: 'number-only'
    }))
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Connector side-plus-top rotation' },
        schematic: {
            sheet: {
                width: 260,
                height: 180,
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
                ...leftPins,
                {
                    x: 120,
                    y: 120,
                    length: 10,
                    name: '16',
                    designator: '16',
                    orientation: 'top',
                    ownerIndex: 'J26',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 140,
                    y: 120,
                    length: 10,
                    name: '15',
                    designator: '15',
                    orientation: 'top',
                    ownerIndex: 'J26',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                }
            ],
            ports: []
        }
    })

    assert.match(
        markup,
        /text class="schematic-pin-number" x="118" y="54" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 118 54\)">16</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="138" y="54" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 138 54\)">15</
    )
})

/**
 * Verifies ground power ports rotate away from the connected wire direction.
 */
test('renderSchematicSvg rotates ground ports from attached wire direction', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Ground orientation' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                { x1: 120, y1: 50, x2: 150, y2: 50, color: '#000080', width: 1 }
            ],
            texts: [
                {
                    x: 150,
                    y: 50,
                    text: 'GND',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 4,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: []
        }
    })

    assert.match(markup, /schematic-power-port--ground/)
    assert.match(markup, /x1="150" y1="50" x2="157" y2="50"/)
    assert.match(markup, /x1="157" y1="43" x2="157" y2="57"/)
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="168" y="53.24" fill="var\(--schematic-power-color\)" text-anchor="start" font-size="9"/
    )
})

/**
 * Verifies explicit Altium power-port direction overrides attached-wire
 * heuristics when the source specifies an orientation.
 */
test('renderSchematicSvg prefers explicit power-port direction over wire inference', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Power orientation' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                { x1: 120, y1: 50, x2: 150, y2: 50, color: '#000080', width: 1 }
            ],
            texts: [
                {
                    x: 150,
                    y: 50,
                    text: 'AURA_3V3',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 2,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    powerPortDirection: 'up',
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: []
        }
    })

    assert.match(markup, /schematic-power-port--rail/)
    assert.match(markup, /x1="150" y1="50" x2="150" y2="38"/)
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="150" y="34" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="9"/
    )
    assert.doesNotMatch(markup, /x1="150" y1="50" x2="138" y2="50"/)
})

/**
 * Verifies CSS does not override recovered schematic text metrics.
 */
test('schematic stylesheet leaves typography to recovered SVG attributes', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    assert.doesNotMatch(css, /\.schematic-label\s*\{/)
    assert.doesNotMatch(css, /\.schematic-pin-name\s*[,{]/)
    assert.doesNotMatch(css, /\.schematic-pin-number\s*[,{]/)
    assert.doesNotMatch(css, /\.schematic-port-label\s*\{/)
})

/**
 * Verifies real schematic renders do not duplicate port labels from both text
 * and port primitives.
 */
test('renderSchematicSvg renders rune off-sheet ports only once per label', async () => {
    const documentModel = await AltiumFixtureLoader.parseMoonSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal((markup.match(/>RUNE_CTL</g) || []).length, 1)
    assert.equal((markup.match(/>RUNE_FLOW</g) || []).length, 1)
    assert.match(
        markup,
        /<polygon points="680,332 688,327 740,327 740,337 688,337" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="680,342 688,337 740,337 740,347 688,347" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="714" y="334\.34" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="6\.50" font-family="Times New Roman" font-weight="400">RUNE_CTL</
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="714" y="344\.34" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="6\.50" font-family="Times New Roman" font-weight="400">RUNE_FLOW</
    )
    assert.equal((markup.match(/<g class="schematic-port">/g) || []).length, 1)
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="915" cy="562" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="915" cy="542" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
})

/**
 * Verifies the dawn-sheet off-sheet ports keep the corrected pointed side in
 * the final SVG output.
 */
test('renderSchematicSvg keeps dawn-sheet off-sheet ports pointed the right way', async () => {
    const documentModel = await AltiumFixtureLoader.parseDawnSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<polygon points="85,724 93,719 145,719 145,729 93,729" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="85,734 93,729 145,729 145,739 93,739" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="85,789 137,789 145,794 137,799 85,799" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
})

/**
 * Verifies style-4 off-sheet ports render as vertical callouts with rotated
 * labels instead of the default horizontal left/right port geometry.
 */
test('renderSchematicSvg rotates style-4 off-sheet ports vertically', async () => {
    const dawnDocument = await AltiumFixtureLoader.parseDawnSheet()
    const dawnMarkup = SchematicSvgRenderer.render(dawnDocument)
    const cinderDocument = await AltiumFixtureLoader.parseCinderSheet()
    const cinderMarkup = SchematicSvgRenderer.render(cinderDocument)

    assert.match(
        dawnMarkup,
        /<polygon points="470,989 480,989 480,1011 475,1019 470,1011" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        dawnMarkup,
        /text class="schematic-port-label" x="476\.89" y="1004" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="5\.25" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 476\.89 1004\)">GLYPH_1</
    )
    assert.match(
        cinderMarkup,
        /<polygon points="910,494 915,502 915,519 905,519 905,502" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        cinderMarkup,
        /text class="schematic-port-label" x="911\.46" y="506\.50" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="4\.05" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 911\.46 506\.50\)">GLYPH_0</
    )
    assert.match(
        cinderMarkup,
        /<circle class="schematic-junction" cx="910" cy="494" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
})

/**
 * Verifies dawn-sheet off-sheet port labels shrink from the default sheet
 * font size so they fit within the yellow port outline.
 */
test('renderSchematicSvg scales dawn-sheet off-sheet port labels to fit their boxes', async () => {
    const documentModel = await AltiumFixtureLoader.parseDawnSheet()
    const markup = SchematicSvgRenderer.render(documentModel)
    const resolvePortLabelFontSize = (name) =>
        Number(
            markup.match(
                new RegExp(
                    '<text class="schematic-port-label"[^>]*font-size="([^"]+)"[^>]*>' +
                        name +
                        '<'
                )
            )?.[1]
        )

    const auraResetSize = resolvePortLabelFontSize('AURA_RST')
    const sigilSelectSize = resolvePortLabelFontSize('SIGIL_SEL')
    const emberResetSize = resolvePortLabelFontSize('EMBER_RST')
    const emberSenseSize = resolvePortLabelFontSize('EMBER_SENSE')

    assert.equal(auraResetSize < 10, true)
    assert.equal(sigilSelectSize < 10, true)
    assert.equal(emberResetSize < 10, true)
    assert.equal(emberSenseSize <= emberResetSize, true)
})

/**
 * Verifies the dawn-sheet MD/DRDM bus breakout labels and adjacent resistor
 * designators keep reading left-to-right like the Altium reference.
 */
test('renderSchematicSvg keeps dawn-sheet bus breakout labels left-to-right', async () => {
    const documentModel = await AltiumFixtureLoader.parseDawnSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="300" y="349" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>MIST11</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="300" y="389" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>MIST7</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="300" y="429" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>MIST3</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="310" y="479" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>VEIL1</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="310" y="489" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>VEIL0</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="335" y="349" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>GLINT97</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="330" y="389" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>GLINT154</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="330" y="429" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>GLINT162</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="340" y="479" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>GLINT53</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="340" y="489" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>GLINT18</
    )
})
