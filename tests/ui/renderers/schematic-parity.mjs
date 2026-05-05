import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

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
                    x: 110,
                    y: 40,
                    cornerX: 170,
                    cornerY: 90,
                    mimeType: '',
                    dataBase64: '',
                    diagnosticState: 'missing-embedded-payload'
                }
            ]
        }
    })

    assert.match(markup, /class="schematic-embedded-image"/)
    assert.match(markup, /href="data:image\/png;base64,AAAA"/)
    assert.match(markup, /class="schematic-image-placeholder"/)
})
