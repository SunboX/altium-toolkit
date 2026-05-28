// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Extracts visible placeholder text lines from rendered SVG markup.
 * @param {string} markup
 * @returns {string[]}
 */
function extractPlaceholderTextLines(markup) {
    const placeholderMarkup =
        markup.match(
            /<g class="schematic-image-placeholder">[\s\S]*?<\/g>/
        )?.[0] || ''

    return [...placeholderMarkup.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(
        (match) => match[1]
    )
}

/**
 * Estimates the rendered width of one placeholder text line.
 * @param {string} text
 * @param {number} fontSize
 * @returns {number}
 */
function estimatePlaceholderLineWidth(text, fontSize) {
    return [...text].reduce(
        (width, character) =>
            width + estimatePlaceholderCharacterWidth(character, fontSize),
        0
    )
}

/**
 * Estimates one Times-like placeholder glyph width.
 * @param {string} character
 * @param {number} fontSize
 * @returns {number}
 */
function estimatePlaceholderCharacterWidth(character, fontSize) {
    if (/[^\x00-\x7F]/u.test(character)) return fontSize
    if (/[A-Z]/.test(character)) return fontSize * 0.62
    if (/[a-z]/.test(character)) return fontSize * 0.45
    if (/[0-9]/.test(character)) return fontSize * 0.5
    if (/[\\/]/.test(character)) return fontSize * 0.32
    if (/[.:\-_]/.test(character)) return fontSize * 0.28

    return fontSize * 0.35
}

/**
 * Verifies the schematic renderer emits first-class hierarchy and authored
 * connectivity markers from the normalized parser model.
 */
test('renderSchematicSvg renders sheet symbols, sheet entries, bus entries, and explicit junctions', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Parity schematic' },
        schematic: {
            sheet: { width: 300, height: 200 },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            sheetSymbols: [
                {
                    x: 80,
                    y: 180,
                    width: 140,
                    height: 90,
                    color: '#000080',
                    fill: '#ffff80',
                    isSolid: true,
                    transparent: false,
                    renderOrder: 7
                }
            ],
            sheetEntries: [
                {
                    ownerIndex: '7',
                    name: 'SIG_OUT',
                    side: 'left',
                    direction: 'output',
                    style: 2,
                    x: 80,
                    y: 150,
                    color: '#800000',
                    fill: '#ffff80',
                    textColor: '#800000',
                    harnessType: '',
                    renderOrder: 8
                }
            ],
            junctions: [
                {
                    x: 140,
                    y: 120,
                    color: '#ff0000',
                    renderOrder: 3
                }
            ],
            busEntries: [
                {
                    x1: 40,
                    y1: 80,
                    x2: 60,
                    y2: 100,
                    color: '#ff0000',
                    width: 1,
                    renderOrder: 9
                }
            ]
        }
    })

    assert.match(markup, /class="schematic-sheet-symbol"/)
    assert.match(markup, />SIG_OUT</)
    assert.match(markup, /class="schematic-sheet-entry"/)
    assert.match(markup, /class="schematic-authored-junction"/)
    assert.match(markup, /class="schematic-bus-entry"/)
})

/**
 * Verifies embedded schematic images render as SVG image nodes and unresolved
 * image records fall back to visible placeholders.
 */
test('renderSchematicSvg renders schematic images and placeholders', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Image schematic' },
        schematic: {
            sheet: { width: 240, height: 160 },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            images: [
                {
                    x: 20,
                    y: 30,
                    cornerX: 80,
                    cornerY: 70,
                    mimeType: 'image/png',
                    dataBase64: 'AAAA',
                    diagnosticState: 'embedded'
                },
                {
                    x: 90,
                    y: 40,
                    cornerX: 229,
                    cornerY: 179,
                    fileName:
                        'C:\\Forge\\Library\\Blueprints\\ControlPanel\\Artwork\\PanelBadge.png',
                    mimeType: '',
                    dataBase64: '',
                    diagnosticState: 'missing-embedded-payload'
                }
            ]
        }
    })
    const placeholderMarkup =
        markup.match(
            /<g class="schematic-image-placeholder">[\s\S]*?<\/g>/
        )?.[0] || ''
    const textContent = placeholderMarkup.replace(/<[^>]+>/g, '')

    assert.match(markup, /class="schematic-embedded-image"/)
    assert.match(markup, /href="data:image\/png;base64,AAAA"/)
    assert.match(placeholderMarkup, /class="schematic-image-placeholder"/)
    assert.match(textContent, /Cannot open file/)
    assert.match(placeholderMarkup, /C:\\Forge\\Library\\Blueprints/)
    assert.match(placeholderMarkup, /PanelBadge\.png<\/tspan>/)
    assert.doesNotMatch(placeholderMarkup, /<rect\b/)
    assert.match(textContent, /\. File does not exist\./)
    assert.doesNotMatch(placeholderMarkup, /<line\b/)
})

/**
 * Verifies unresolved image placeholder paths wrap by rendered width rather
 * than by raw character count, including wide non-ASCII glyphs.
 */
test('renderSchematicSvg wraps unresolved image placeholder text inside its bounds', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Narrow image schematic' },
        schematic: {
            sheet: { width: 260, height: 200 },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            images: [
                {
                    x: 40,
                    y: 20,
                    cornerX: 179,
                    cornerY: 159,
                    fileName:
                        'C:\\Workspace\\Packages\\Hardware\\Design\\2026年模块设计\\Module\\Module_LongName\\ArtworkBadge.png',
                    mimeType: '',
                    dataBase64: '',
                    diagnosticState: 'missing-embedded-payload'
                }
            ]
        }
    })
    const fontSize = Math.max(139 / 18, 5)
    const usableWidth = 139 - 12
    const lines = extractPlaceholderTextLines(markup)

    assert.ok(lines.length >= 5)
    assert.equal(lines.at(0), 'Cannot open file')
    assert.equal(lines.at(-1), '. File does not exist.')

    for (const line of lines.slice(1, -1)) {
        assert.ok(
            estimatePlaceholderLineWidth(line, fontSize) <= usableWidth,
            'Expected "' + line + '" to fit inside the placeholder'
        )
    }
})
