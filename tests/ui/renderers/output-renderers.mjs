// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { BomTableRenderer } from '../../../src/ui/BomTableRenderer.mjs'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'
import { PcbScene3dSummaryRenderer } from '../../../src/scene3d.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies PCB renderer emits board geometry, copper primitives, and placements.
 */
test('renderPcbSvg renders board outline, copper primitives, and placements', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Demo board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            polygons: [
                {
                    layer: 'TOP',
                    segments: [
                        { type: 'line', x1: 100, y1: 100, x2: 300, y2: 100 },
                        { type: 'line', x1: 300, y1: 100, x2: 300, y2: 250 },
                        { type: 'line', x1: 300, y1: 250, x2: 100, y2: 250 },
                        { type: 'line', x1: 100, y1: 250, x2: 100, y2: 100 }
                    ]
                }
            ],
            fills: [
                {
                    x1: 340,
                    y1: 120,
                    x2: 420,
                    y2: 180,
                    layerCode: 256,
                    layerId: 1
                }
            ],
            tracks: [
                {
                    x1: 130,
                    y1: 320,
                    x2: 520,
                    y2: 320,
                    width: 12,
                    layerCode: 256,
                    layerId: 1
                }
            ],
            vias: [{ x: 520, y: 320, diameter: 24, holeDiameter: 10 }],
            pads: [
                {
                    x: 120,
                    y: 120,
                    sizeTopX: 126,
                    sizeTopY: 67,
                    sizeMidX: 126,
                    sizeMidY: 67,
                    sizeBottomX: 126,
                    sizeBottomY: 67,
                    holeDiameter: 80,
                    shapeTop: 1,
                    shapeMid: 1,
                    shapeBottom: 1,
                    rotation: 270,
                    isPlated: true,
                    holeShape: 2,
                    holeSlotLength: 98,
                    holeRotation: 0,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                }
            ],
            components: [
                {
                    designator: 'U1',
                    x: 200,
                    y: 250,
                    rotation: 90,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ]
        }
    })

    assert.match(markup, /<svg/)
    assert.doesNotMatch(markup, />U1<\/text>/)
    assert.match(markup, /Top Layer/)
    assert.match(markup, /board-outline/)
    assert.match(markup, /pcb-polygon/)
    assert.match(markup, /pcb-fill/)
    assert.match(markup, /pcb-track/)
    assert.match(markup, /pcb-via/)
    assert.match(markup, /pcb-pad/)
    assert.match(markup, /pcb-pad__hole/)
    assert.match(markup, /pcb-pad__hole--slot/)
    assert.match(markup, /pcb-pad pcb-pad--shaped/)
})

/**
 * Verifies the rendered board outline is addressable as the Edge.Cuts layer so
 * host layer controls can hide both outline paths.
 */
test('renderPcbSvg tags board outline paths as the Edge.Cuts layer', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Edge cuts board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 80,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
                    { type: 'line', x1: 100, y1: 0, x2: 100, y2: 80 },
                    { type: 'line', x1: 100, y1: 80, x2: 0, y2: 80 },
                    { type: 'line', x1: 0, y1: 80, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            polygons: [],
            fills: [],
            tracks: [],
            vias: [],
            pads: [],
            texts: [],
            components: []
        }
    })
    const outlinePaths = markup.match(/<path class="board-outline[^"]*"[^>]*>/g)

    assert.equal(outlinePaths?.length, 2)
    for (const outlinePath of outlinePaths) {
        assert.match(outlinePath, /class="[^"]*pcb-layer[^"]*"/)
        assert.match(outlinePath, /class="[^"]*pcb-layer--edge-cuts[^"]*"/)
        assert.match(outlinePath, /data-layer-name="Edge\.Cuts"/)
    }
})

/**
 * Verifies PCB renderer uses primitive layer names when the formal board stack
 * is absent.
 */
test('renderPcbSvg summarizes primitive layers when stack layers are absent', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Layer fallback' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
                    { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100 },
                    { type: 'line', x1: 100, y1: 100, x2: 0, y2: 100 },
                    { type: 'line', x1: 0, y1: 100, x2: 0, y2: 0 }
                ]
            },
            layers: [],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 33, name: 'Top Overlay' }
            ],
            polygons: [],
            fills: [],
            tracks: [],
            vias: [],
            pads: [],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /0 placements, 2 layers/)
    assert.match(markup, /<li>Top Layer<\/li>/)
    assert.match(markup, /<li>Top Overlay<\/li>/)
})

/**
 * Verifies embedded PCB fonts are emitted as SVG font faces and applied to
 * TrueType text primitives.
 */
test('renderPcbSvg embeds recovered PCB fonts for text rendering', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Font board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 300,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 500, y2: 0 },
                    { type: 'line', x1: 500, y1: 0, x2: 500, y2: 300 },
                    { type: 'line', x1: 500, y1: 300, x2: 0, y2: 300 },
                    { type: 'line', x1: 0, y1: 300, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Overlay' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            embeddedFonts: [
                {
                    name: 'Synthetic Sans',
                    style: 'Bold Italic',
                    format: 'truetype',
                    mimeType: 'font/ttf',
                    payloadBase64: 'AAEAAA==',
                    metrics: {
                        weightClass: 700
                    }
                }
            ],
            texts: [
                {
                    text: 'FONT_MARK',
                    x: 100,
                    y: 150,
                    height: 18,
                    rotation: 0,
                    layerId: 33,
                    fontFamily: 'Synthetic Sans',
                    fontWeight: 700,
                    fontStyle: 'italic'
                }
            ],
            components: []
        }
    })

    assert.match(markup, /@font-face/)
    assert.match(markup, /font-family: 'Synthetic Sans'/)
    assert.match(markup, /src: url\('data:font\/ttf;base64,AAEAAA=='\)/)
    assert.match(markup, /font-family="Synthetic Sans"/)
    assert.match(markup, /font-weight="700"/)
    assert.match(markup, /font-style="italic"/)
})

/**
 * Verifies PCB renderer draws authored text primitives and leaves hidden text
 * out of the SVG.
 */
test('renderPcbSvg renders authored PCB text primitives', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Marked board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            texts: [
                {
                    text: 'PCB-ID',
                    x: 180,
                    y: 240,
                    height: 32,
                    rotation: 0,
                    layerId: 33
                },
                {
                    text: 'HIDDEN-ID',
                    x: 220,
                    y: 260,
                    height: 32,
                    rotation: 0,
                    layerId: 33,
                    visible: false
                }
            ],
            components: [
                {
                    designator: 'U1',
                    x: 200,
                    y: 250,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ]
        }
    })

    assert.match(markup, /class="pcb-text[^"]*"[^>]*>PCB-ID<\/text>/)
    assert.doesNotMatch(markup, /HIDDEN-ID/)
    assert.doesNotMatch(markup, />U1<\/text>/)
})

/**
 * Verifies Altium component-parameter placeholders are suppressed only when
 * text metadata identifies them as component annotations.
 */
test('renderPcbSvg suppresses PCB annotation placeholder text primitives', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Placeholder board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Overlay' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            texts: [
                {
                    text: 'Comment',
                    x: 180,
                    y: 240,
                    height: 32,
                    rotation: 0,
                    layerId: 33,
                    role: 'comment',
                    isComment: true,
                    isPlaceholder: true
                },
                {
                    text: 'Comment',
                    x: 190,
                    y: 245,
                    height: 32,
                    rotation: 0,
                    layerId: 33
                },
                {
                    text: 'Designator1',
                    x: 200,
                    y: 250,
                    height: 32,
                    rotation: 0,
                    layerId: 33,
                    role: 'designator',
                    isPlaceholder: true
                },
                {
                    text: 'BOARD-ID',
                    x: 220,
                    y: 260,
                    height: 32,
                    rotation: 0,
                    layerId: 33
                }
            ],
            components: []
        }
    })

    assert.match(markup, />Comment<\/text>/)
    assert.equal(markup.match(/>Comment<\/text>/gu)?.length, 1)
    assert.doesNotMatch(markup, />Designator1<\/text>/)
    assert.match(markup, />BOARD-ID<\/text>/)
})

/**
 * Verifies rounded board-outline corners use the short wrapped SVG arc sweep
 * instead of flipping outward or inward at the page corners.
 */
test('renderPcbSvg keeps wrapped board-outline corner arcs on the short sweep', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Rounded board' },
        pcb: {
            boardOutline: {
                minX: 3031.4961,
                minY: 2362.2047,
                widthMil: 1220.4724,
                heightMil: 1299.2126,
                segments: [
                    {
                        type: 'line',
                        x1: 3031.4961,
                        y1: 3611.4173,
                        x2: 3031.4961,
                        y2: 2412.2047
                    },
                    {
                        type: 'arc',
                        x1: 3031.4961,
                        y1: 2412.2047,
                        x2: 3081.4961,
                        y2: 2362.2047,
                        cx: 3081.4961,
                        cy: 2412.2047,
                        radius: 50,
                        startAngle: 270,
                        endAngle: 180
                    },
                    {
                        type: 'line',
                        x1: 3081.4961,
                        y1: 2362.2047,
                        x2: 4201.9685,
                        y2: 2362.2047
                    },
                    {
                        type: 'arc',
                        x1: 4201.9685,
                        y1: 2362.2047,
                        x2: 4251.9685,
                        y2: 2412.2047,
                        cx: 4201.9685,
                        cy: 2412.2047,
                        radius: 50,
                        startAngle: 0,
                        endAngle: 270
                    },
                    {
                        type: 'line',
                        x1: 4251.9685,
                        y1: 2412.2047,
                        x2: 4251.9685,
                        y2: 3611.4173
                    },
                    {
                        type: 'arc',
                        x1: 4251.9685,
                        y1: 3611.4173,
                        x2: 4201.9685,
                        y2: 3661.4173,
                        cx: 4201.9685,
                        cy: 3611.4173,
                        radius: 50,
                        startAngle: 90,
                        endAngle: 0
                    },
                    {
                        type: 'line',
                        x1: 4201.9685,
                        y1: 3661.4173,
                        x2: 3081.4961,
                        y2: 3661.4173
                    },
                    {
                        type: 'arc',
                        x1: 3081.4961,
                        y1: 3661.4173,
                        x2: 3031.4961,
                        y2: 3611.4173,
                        cx: 3081.4961,
                        cy: 3611.4173,
                        radius: 50,
                        startAngle: 180,
                        endAngle: 90
                    },
                    {
                        type: 'line',
                        x1: 3031.4961,
                        y1: 3611.4173,
                        x2: 3031.4961,
                        y2: 3611.4173
                    }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            components: []
        }
    })

    assert.match(
        markup,
        /<path class="board-outline[^"]*"[^>]*d="M 3031\.50 3611\.42 L 3031\.50 2412\.20 A 50 50 0 0 1 3081\.50 2362\.20 L 4201\.97 2362\.20 A 50 50 0 0 1 4251\.97 2412\.20 L 4251\.97 3611\.42 A 50 50 0 0 1 4201\.97 3661\.42 L 3081\.50 3661\.42 A 50 50 0 0 1 3031\.50 3611\.42 L 3031\.50 3611\.42 Z" \/>/
    )
    assert.doesNotMatch(markup, /A 50 50 0 0 0/)
})

/**
 * Verifies PCB renderer separates top-facing and buried copper primitives.
 */
test('renderPcbSvg groups surface and subsurface copper separately', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Layered board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'L1_TOP' }, { name: 'L2_P' }, { name: 'L4_BOT' }],
            polygons: [
                {
                    layer: 'TOP',
                    segments: [
                        { type: 'line', x1: 100, y1: 100, x2: 300, y2: 100 },
                        { type: 'line', x1: 300, y1: 100, x2: 300, y2: 250 },
                        { type: 'line', x1: 300, y1: 250, x2: 100, y2: 250 },
                        { type: 'line', x1: 100, y1: 250, x2: 100, y2: 100 }
                    ]
                },
                {
                    layer: 'BOTTOM',
                    segments: [
                        { type: 'line', x1: 500, y1: 120, x2: 750, y2: 120 },
                        { type: 'line', x1: 750, y1: 120, x2: 750, y2: 240 },
                        { type: 'line', x1: 750, y1: 240, x2: 500, y2: 240 },
                        { type: 'line', x1: 500, y1: 240, x2: 500, y2: 120 }
                    ]
                }
            ],
            fills: [
                {
                    x1: 340,
                    y1: 120,
                    x2: 420,
                    y2: 180,
                    layerCode: 256,
                    layerId: 1
                },
                {
                    x1: 600,
                    y1: 280,
                    x2: 680,
                    y2: 340,
                    layerCode: 259,
                    layerId: 32
                }
            ],
            tracks: [
                {
                    x1: 130,
                    y1: 320,
                    x2: 520,
                    y2: 320,
                    width: 12,
                    layerCode: 256,
                    layerId: 1
                },
                {
                    x1: 130,
                    y1: 360,
                    x2: 520,
                    y2: 360,
                    width: 12,
                    layerCode: 259,
                    layerId: 32
                }
            ],
            vias: [{ x: 520, y: 320, diameter: 24, holeDiameter: 10 }],
            components: []
        }
    })

    assert.match(markup, /pcb-copper pcb-copper--subsurface/)
    assert.match(markup, /pcb-copper pcb-copper--surface/)
    assert.match(markup, /pcb-polygon pcb-polygon--surface/)
    assert.match(markup, /pcb-polygon pcb-polygon--subsurface/)
    assert.match(markup, /pcb-fill pcb-fill--surface/)
    assert.match(markup, /pcb-fill pcb-fill--subsurface/)
    assert.match(markup, /pcb-track pcb-track--surface/)
    assert.match(markup, /pcb-track pcb-track--subsurface/)
})

/**
 * Verifies PCB renderer excludes mechanical drawing tracks from the copper
 * presentation so fabrication layers do not distort the view.
 */
test('renderPcbSvg ignores non-copper mechanical tracks and fills', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Filtered board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'L1_TOP' }, { name: 'L4_BOT' }],
            polygons: [],
            fills: [
                {
                    x1: 340,
                    y1: 120,
                    x2: 420,
                    y2: 180,
                    layerCode: 256,
                    layerId: 1
                },
                {
                    x1: -800,
                    y1: -200,
                    x2: 2200,
                    y2: -120,
                    layerCode: 258,
                    layerId: 68
                }
            ],
            tracks: [
                {
                    x1: 130,
                    y1: 320,
                    x2: 520,
                    y2: 320,
                    width: 12,
                    layerCode: 256,
                    layerId: 1
                },
                {
                    x1: -1200,
                    y1: -400,
                    x2: 2400,
                    y2: -400,
                    width: 12,
                    layerCode: 258,
                    layerId: 68
                }
            ],
            vias: [],
            components: []
        }
    })

    assert.match(markup, /x1="130"/)
    assert.doesNotMatch(markup, /x1="-1200"/)
    assert.doesNotMatch(markup, /x="-800"/)
})

/**
 * Verifies PCB renderer prefers authored footprint detail from SMD pads and
 * top-side documentation layers over the synthetic component-body fallback.
 */
test('renderPcbSvg renders authored footprint detail for top-side packages', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Detailed footprint board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [
                { layerId: 59, name: 'M3 Placement Outline' },
                { layerId: 71, name: 'M15 Top RefDes' }
            ],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 160,
                    y1: 180,
                    x2: 240,
                    y2: 180,
                    width: 6,
                    layerCode: 258,
                    layerId: 59
                },
                {
                    x1: 240,
                    y1: 180,
                    x2: 240,
                    y2: 260,
                    width: 6,
                    layerCode: 258,
                    layerId: 59
                },
                {
                    x1: 240,
                    y1: 260,
                    x2: 160,
                    y2: 260,
                    width: 6,
                    layerCode: 258,
                    layerId: 59
                },
                {
                    x1: 160,
                    y1: 260,
                    x2: 160,
                    y2: 180,
                    width: 6,
                    layerCode: 258,
                    layerId: 59
                }
            ],
            vias: [],
            pads: [
                {
                    x: 180,
                    y: 220,
                    sizeTopX: 28,
                    sizeTopY: 18,
                    sizeMidX: 28,
                    sizeMidY: 18,
                    sizeBottomX: 28,
                    sizeBottomY: 18,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                },
                {
                    x: 220,
                    y: 220,
                    sizeTopX: 28,
                    sizeTopY: 18,
                    sizeMidX: 28,
                    sizeMidY: 18,
                    sizeBottomX: 28,
                    sizeBottomY: 18,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                }
            ],
            components: [
                {
                    designator: 'U1',
                    x: 200,
                    y: 220,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ]
        }
    })

    assert.match(markup, /pcb-pad [^"]*pcb-pad--smd/)
    assert.match(markup, /pcb-footprint-track/)
    assert.doesNotMatch(
        markup,
        /class="pcb-component pcb-component--top"[^>]*><rect/
    )
    assert.doesNotMatch(markup, />U1<\/text>/)
})

/**
 * Verifies authored footprint arcs render from top-side documentation layers
 * and suppress the synthetic fallback body even when no tracks or pads exist.
 */
test('renderPcbSvg renders authored footprint arcs for rounded package outlines', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Rounded footprint board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [
                {
                    x: 200,
                    y: 220,
                    radius: 48,
                    startAngle: 90,
                    endAngle: 180,
                    width: 6,
                    layerCode: 33,
                    layerId: 33
                }
            ],
            vias: [],
            pads: [],
            components: [
                {
                    designator: 'J3',
                    x: 200,
                    y: 220,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'GENERIC-ARC'
                }
            ]
        }
    })

    assert.match(markup, /pcb-footprint-arc/)
    assert.doesNotMatch(
        markup,
        /class="pcb-component pcb-component--top"[^>]*><rect class="pcb-component__body"/
    )
    assert.doesNotMatch(markup, />J3<\/text>/)
})

/**
 * Verifies wrapped PCB arc angles render as the short rounded corner and that
 * equal start and end angles still render authored circles instead of dots.
 */
test('renderPcbSvg normalizes wrapped footprint arcs and start-equals-end circles', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Wrapped footprint arcs' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [
                {
                    x: 3964.2125,
                    y: 2576.5812,
                    radius: 25.0001,
                    startAngle: 0,
                    endAngle: 296,
                    width: 5,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 3899.2126,
                    y: 2572.8976,
                    radius: 25,
                    startAngle: 0,
                    endAngle: 0,
                    width: 5,
                    layerCode: 33,
                    layerId: 33
                }
            ],
            vias: [],
            pads: [],
            components: [
                {
                    designator: 'J3',
                    x: 3920,
                    y: 2580,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'WRAPPED-ARC'
                }
            ]
        }
    })

    assert.match(
        markup,
        /<path class="pcb-footprint-arc" d="M 3989\.21 2576\.58 A 25 25 0 0 0 3975\.17 2554\.11" stroke-width="5" fill="none"[^>]* \/>/
    )
    assert.match(
        markup,
        /<circle class="pcb-footprint-arc" cx="3899\.21" cy="2572\.90" r="25" stroke-width="5" fill="none"[^>]* \/>/
    )
})

/**
 * Verifies large pad-defined packages do not render a synthetic center body
 * when real footprint pads are already present near the component origin.
 */
test('renderPcbSvg omits synthetic bodies for pad-defined packages', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Molded inductor board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 65,
                    y1: 95,
                    x2: 335,
                    y2: 95,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 335,
                    y1: 95,
                    x2: 335,
                    y2: 305,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 335,
                    y1: 305,
                    x2: 65,
                    y2: 305,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 65,
                    y1: 305,
                    x2: 65,
                    y2: 95,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                }
            ],
            vias: [],
            pads: [
                {
                    x: 82,
                    y: 200,
                    sizeTopX: 70,
                    sizeTopY: 94,
                    sizeMidX: 70,
                    sizeMidY: 94,
                    sizeBottomX: 70,
                    sizeBottomY: 94,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                },
                {
                    x: 318,
                    y: 200,
                    sizeTopX: 70,
                    sizeTopY: 94,
                    sizeMidX: 70,
                    sizeMidY: 94,
                    sizeBottomX: 70,
                    sizeBottomY: 94,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                }
            ],
            components: [
                {
                    designator: 'L1',
                    x: 200,
                    y: 200,
                    rotation: 270,
                    layer: 'TOP',
                    pattern: 'SMD7*7'
                }
            ]
        }
    })

    assert.match(markup, /pcb-footprint-track/)
    assert.doesNotMatch(
        markup,
        /class="pcb-component pcb-component--top"[^>]*><rect class="pcb-component__body"/
    )
    assert.doesNotMatch(markup, />L1<\/text>/)
})

/**
 * Verifies component-owned pad geometry suppresses fallback bodies even when
 * recovered component origins land outside the board outline.
 */
test('renderPcbSvg omits synthetic bodies for off-board component origins with owned pads', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Indexed test board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [],
            polygons: [],
            fills: [],
            tracks: [],
            vias: [],
            pads: [
                {
                    componentIndex: 7,
                    x: 500,
                    y: 250,
                    sizeTopX: 40,
                    sizeTopY: 40,
                    sizeMidX: 40,
                    sizeMidY: 40,
                    sizeBottomX: 40,
                    sizeBottomY: 40,
                    holeDiameter: 0,
                    shapeTop: 1,
                    shapeMid: 1,
                    shapeBottom: 1,
                    rotation: 0,
                    isPlated: true,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                }
            ],
            components: [
                {
                    componentIndex: 7,
                    designator: 'TP1',
                    x: 1400,
                    y: 250,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'TP2'
                }
            ]
        }
    })

    assert.match(markup, /pcb-pad [^"]*pcb-pad--smd/)
    assert.doesNotMatch(
        markup,
        /class="pcb-component pcb-component--top"[^>]*><rect class="pcb-component__body"/
    )
})

/**
 * Verifies larger unknown packages still suppress the synthetic component body
 * when authored pads define the footprint beyond the small fallback heuristic.
 */
test('renderPcbSvg omits synthetic bodies for large unknown packages with authored pads', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Wide regulator board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [],
            polygons: [],
            fills: [],
            tracks: [],
            vias: [],
            pads: [
                {
                    x: 160,
                    y: 200,
                    sizeTopX: 92,
                    sizeTopY: 130,
                    sizeMidX: 92,
                    sizeMidY: 130,
                    sizeBottomX: 92,
                    sizeBottomY: 130,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                },
                {
                    x: 440,
                    y: 200,
                    sizeTopX: 92,
                    sizeTopY: 130,
                    sizeMidX: 92,
                    sizeMidY: 130,
                    sizeBottomX: 92,
                    sizeBottomY: 130,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                }
            ],
            components: [
                {
                    designator: 'U9',
                    x: 300,
                    y: 200,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'GENERIC-WIDE'
                }
            ]
        }
    })

    assert.match(markup, /pcb-pad [^"]*pcb-pad--smd/)
    assert.doesNotMatch(
        markup,
        /class="pcb-component pcb-component--top"[^>]*><rect class="pcb-component__body"/
    )
    assert.doesNotMatch(markup, />U9<\/text>/)
})

/**
 * Verifies PCB renderer prefers the top overlay layer over broader fallback
 * documentation layers so one footprint does not render as stacked duplicates.
 */
test('renderPcbSvg prefers top overlay over fallback footprint layers', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Overlay-priority board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [
                { layerId: 33, name: 'Top Overlay' },
                { layerId: 59, name: 'M3 Placement Outline' },
                { layerId: 67, name: 'M11 Top Mechanic' }
            ],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 120,
                    y1: 180,
                    x2: 220,
                    y2: 180,
                    width: 6,
                    layerCode: 258,
                    layerId: 33
                },
                {
                    x1: 320,
                    y1: 180,
                    x2: 420,
                    y2: 180,
                    width: 6,
                    layerCode: 258,
                    layerId: 59
                },
                {
                    x1: 520,
                    y1: 180,
                    x2: 620,
                    y2: 180,
                    width: 6,
                    layerCode: 258,
                    layerId: 67
                }
            ],
            vias: [],
            pads: [],
            components: [
                {
                    designator: 'R1',
                    x: 170,
                    y: 180,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: '0402'
                }
            ]
        }
    })

    assert.match(markup, /class="pcb-footprint-track" x1="120"/)
    assert.doesNotMatch(markup, /class="pcb-footprint-track" x1="320"/)
    assert.doesNotMatch(markup, /class="pcb-footprint-track" x1="520"/)
})

/**
 * Verifies authored footprint documentation can extend beyond the board edge
 * while copper primitives remain clipped to the outline.
 */
test('renderPcbSvg does not clip authored footprint outlines to the board edge', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Edge connector board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 59, name: 'M3 Placement Outline' }],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: -180,
                    y1: 180,
                    x2: 120,
                    y2: 180,
                    width: 6,
                    layerCode: 258,
                    layerId: 59
                },
                {
                    x1: 100,
                    y1: 250,
                    x2: 300,
                    y2: 250,
                    width: 8,
                    layerCode: 256,
                    layerId: 1
                }
            ],
            vias: [],
            pads: [],
            components: []
        }
    })

    assert.match(
        markup,
        /<g class="pcb-copper-layers" clip-path="url\(#pcb-board-clip\)">/
    )
    assert.match(markup, /<g class="pcb-footprints">/)
    assert.doesNotMatch(markup, /<g class="pcb-footprints" clip-path=/)
    assert.match(markup, /class="pcb-footprint-track" x1="-180"/)
})

/**
 * Verifies PCB viewer colors come from PCB theme variables.
 */
test('pcb viewer stylesheet defines PCB theme variables', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')
    const boardOutlineBlock = css.match(/\.board-outline\s*\{[^}]*\}/)?.[0]

    assert.ok(boardOutlineBlock)
    assert.match(css, /--pcb-board-fill:/)
    assert.match(css, /--pcb-copper-fill:/)
    assert.match(
        css,
        /--pcb-footprint-track-color:\s*rgba\(237,\s*172,\s*36,\s*1(?:\.0)?\);/
    )
    assert.match(boardOutlineBlock, /fill:\s*var\(--pcb-board-fill\);/)
    assert.match(boardOutlineBlock, /stroke:\s*var\(--pcb-board-stroke\);/)
})

/**
 * Verifies overlay silkscreen paths and text use the footprint overlay color
 * instead of default SVG black styling.
 */
test('pcb viewer stylesheet colors overlay silkscreen regions and text', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    assert.match(
        css,
        /\.pcb-footprint-region\s*\{[\s\S]*fill:\s*var\(--pcb-footprint-track-color\);/
    )
    assert.match(
        css,
        /\.pcb-text\s*\{[\s\S]*fill:\s*var\(--pcb-footprint-track-color\);/
    )
})

/**
 * Verifies schematic viewer colors use ECAD Forge defaults.
 */
test('schematic viewer stylesheet aligns schematic theme variables with ECAD Forge colors', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')
    const schematicSvgBlock = css.match(/\.schematic-svg\s*\{[^}]*\}/)?.[0]

    assert.ok(schematicSvgBlock)
    assert.match(schematicSvgBlock, /--schematic-default-ink-color:\s*#008aa3;/)
    assert.match(schematicSvgBlock, /--schematic-accent-ink-color:\s*#009bb2;/)
    assert.match(schematicSvgBlock, /--schematic-text-color:\s*#121b22;/)
    assert.match(schematicSvgBlock, /--schematic-sheet-label-color:\s*#405662;/)
    assert.match(schematicSvgBlock, /--schematic-power-color:\s*#a44a1b;/)
    assert.match(schematicSvgBlock, /--schematic-port-color:\s*#a44a1b;/)
    assert.match(schematicSvgBlock, /--schematic-alert-color:\s*#c43a68;/)
    assert.match(schematicSvgBlock, /--schematic-fill-color:\s*#f1d8bd;/)
    assert.match(schematicSvgBlock, /--schematic-note-fill-color:\s*#efe4d1;/)
    assert.match(schematicSvgBlock, /--schematic-fill-light-color:\s*#fffaf5;/)
    assert.match(schematicSvgBlock, /--schematic-pin-marker-fill:\s*#edf4f3;/)
    assert.match(schematicSvgBlock, /--schematic-note-border-color:\s*#8a725c;/)
})

/**
 * Verifies the packaged stylesheet is limited to toolkit renderer output.
 */
test('renderer stylesheet excludes ECAD Forge app-shell selectors', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    for (const selector of [
        '.dropzone',
        '.hero-grid',
        '.document-rail',
        '.document-preview',
        '.view-tab',
        '.viewer-stage',
        '.scene-3d',
        '.diagnostic'
    ]) {
        assert.doesNotMatch(css, new RegExp(selector.replace('.', '\\.')))
    }
})

/**
 * Verifies PCB viewer authored text uses the reduced in-view font size.
 */
test('pcb viewer stylesheet reduces board text by one point', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')
    const pcbComponentTextBlock = css.match(/\.pcb-text\s*\{[^}]*\}/)?.[0]

    assert.ok(pcbComponentTextBlock)
    assert.match(pcbComponentTextBlock, /font-size:\s*29px;/)
})

/**
 * Verifies PCB viewer stylesheet differentiates surface and subsurface copper.
 */
test('pcb viewer stylesheet defines surface and subsurface copper styling', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    assert.match(css, /--pcb-surface-copper-fill:/)
    assert.match(css, /--pcb-subsurface-copper-fill:/)
    assert.match(css, /--pcb-surface-track-color:/)
    assert.match(css, /--pcb-subsurface-track-color:/)
    assert.match(css, /\.pcb-copper--surface \.pcb-polygon\s*\{/)
    assert.match(css, /\.pcb-copper--subsurface \.pcb-polygon\s*\{/)
})

/**
 * Verifies copper track artwork exposes an opacity variable that host controls
 * can adjust without rewriting the recovered stroke colors.
 */
test('pcb viewer stylesheet exposes copper track opacity controls', async () => {
    const cssPath = new URL(
        '../../../src/styles/altium-renderers.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    assert.match(
        css,
        /\.pcb-track,\s*\.pcb-arc\s*\{[\s\S]*opacity:\s*var\(--pcb-track-opacity,\s*1\);/
    )
})

/**
 * Verifies BOM renderer groups rows into a table.
 */
test('renderBomTable renders grouped BOM rows', () => {
    const markup = BomTableRenderer.render([
        {
            designators: ['R1', 'R2'],
            quantity: 2,
            pattern: '0603',
            source: 'RES/10K',
            value: '10K'
        }
    ])

    assert.match(markup, /<table/)
    assert.match(markup, /R1, R2/)
    assert.match(markup, />2</)
    assert.match(markup, /0603/)
})

/**
 * Verifies the 3D summary renderer emits a non-interactive board summary.
 */
test('PcbScene3dSummaryRenderer renders a board summary scene', () => {
    const markup = PcbScene3dSummaryRenderer.render({
        pcb: {
            boardOutline: { widthMil: 1200, heightMil: 800, segments: [] },
            components: [{ designator: 'U1' }, { designator: 'R1' }]
        },
        bom: [{ quantity: 2 }]
    })

    assert.match(markup, /3D/)
    assert.match(markup, /1200/)
    assert.match(markup, /2 components/)
})
