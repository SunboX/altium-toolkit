// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'

/**
 * Verifies screw glyphs keep their authored shafts while only tip-facing
 * head corrections change the rendered semicircle side.
 */
test('renderPcbSvg keeps authored screw shafts while correcting tip-facing heads', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Edge-adjacent screw glyph board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 1000 },
                    { type: 'line', x1: 1000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 100,
                    y1: 180,
                    x2: 180,
                    y2: 180,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 100,
                    y1: 220,
                    x2: 180,
                    y2: 220,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 100,
                    y1: 180,
                    x2: 100,
                    y2: 220,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 110,
                    y1: 182,
                    x2: 120,
                    y2: 218,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 130,
                    y1: 182,
                    x2: 140,
                    y2: 218,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 150,
                    y1: 182,
                    x2: 160,
                    y2: 218,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 180,
                    y1: 200,
                    x2: 220,
                    y2: 175,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 180,
                    y1: 200,
                    x2: 220,
                    y2: 225,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 100,
                    y1: 380,
                    x2: 180,
                    y2: 380,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 100,
                    y1: 420,
                    x2: 180,
                    y2: 420,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 180,
                    y1: 380,
                    x2: 180,
                    y2: 420,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 120,
                    y1: 382,
                    x2: 130,
                    y2: 418,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 140,
                    y1: 382,
                    x2: 150,
                    y2: 418,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 160,
                    y1: 382,
                    x2: 170,
                    y2: 418,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 60,
                    y1: 375,
                    x2: 100,
                    y2: 400,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 60,
                    y1: 425,
                    x2: 100,
                    y2: 400,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 380,
                    y1: 100,
                    x2: 420,
                    y2: 100,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 380,
                    y1: 120,
                    x2: 420,
                    y2: 120,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 380,
                    y1: 100,
                    x2: 380,
                    y2: 120,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 382,
                    y1: 90,
                    x2: 418,
                    y2: 80,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 382,
                    y1: 110,
                    x2: 418,
                    y2: 100,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 382,
                    y1: 130,
                    x2: 418,
                    y2: 120,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 400,
                    y1: 120,
                    x2: 375,
                    y2: 160,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x1: 400,
                    y1: 120,
                    x2: 425,
                    y2: 160,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                }
            ],
            arcs: [
                {
                    x: 180,
                    y: 200,
                    radius: 28,
                    startAngle: 90,
                    endAngle: 270,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 40,
                    y: 200,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 100,
                    y: 400,
                    radius: 28,
                    startAngle: 270,
                    endAngle: 90,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 260,
                    y: 400,
                    radius: 30,
                    startAngle: 0,
                    endAngle: 0,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                },
                {
                    x: 400,
                    y: 120,
                    radius: 28,
                    startAngle: 180,
                    endAngle: 0,
                    width: 8,
                    layerCode: 33,
                    layerId: 33
                }
            ],
            vias: [],
            pads: [],
            components: [
                {
                    designator: 'J1',
                    x: 150,
                    y: 200,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'EDGE-GLYPH'
                },
                {
                    designator: 'J2',
                    x: 120,
                    y: 400,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'EDGE-GLYPH'
                }
            ]
        }
    })

    assert.match(
        markup,
        /<path class="pcb-footprint-arc" d="M 180 228 A 28 28 0 0 0 180 172" stroke-width="8" fill="none" \/>/
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="180" y1="200" x2="220" y2="175"/
    )
    assert.match(
        markup,
        /<path class="pcb-footprint-arc" d="M 100 372 A 28 28 0 0 0 100 428" stroke-width="8" fill="none" \/>/
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="60" y1="375" x2="100" y2="400"/
    )
    assert.match(
        markup,
        /<path class="pcb-footprint-arc" d="M 372 120 A 28 28 0 0 0 428 120" stroke-width="8" fill="none" \/>/
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="400" y1="120" x2="375" y2="160"/
    )
    assert.doesNotMatch(
        markup,
        /<path class="pcb-footprint-arc" d="M 180 228 A 28 28 0 0 1 180 172" stroke-width="8" fill="none" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<path class="pcb-footprint-arc" d="M 100 372 A 28 28 0 0 1 100 428" stroke-width="8" fill="none" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<path class="pcb-footprint-arc" d="M 372 120 A 28 28 0 0 1 428 120" stroke-width="8" fill="none" \/>/
    )
})

test('renderPcbSvg mirrors PCB text around its local insertion point', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Mirrored label board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 300,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 400, y2: 0 },
                    { type: 'line', x1: 400, y1: 0, x2: 400, y2: 300 },
                    { type: 'line', x1: 400, y1: 300, x2: 0, y2: 300 },
                    { type: 'line', x1: 0, y1: 300, x2: 0, y2: 0 }
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
                    text: 'FAKE_LABEL',
                    x: 140,
                    y: 160,
                    height: 42,
                    rotation: 90,
                    layerId: 33,
                    mirrored: true,
                    visible: true
                }
            ],
            components: []
        }
    })

    assert.match(
        markup,
        /transform="translate\(140 160\) rotate\(90\) scale\(-1 1\)"/
    )
})

test('renderPcbSvg renders inverted TrueType PCB text as knockout artwork', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Knockout label board' },
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
                    text: 'FAKE_KNOCKOUT',
                    x: 180,
                    y: 160,
                    height: 100,
                    rotation: 90,
                    layerId: 33,
                    mirrored: true,
                    fontTypeName: 'TrueType',
                    fontFamily: 'Consolas',
                    isInverted: true,
                    marginBorderWidth: 12,
                    visible: true
                }
            ],
            components: []
        }
    })

    assert.match(
        markup,
        /class="pcb-text pcb-text--layer-33 pcb-text--inverted"/
    )
    assert.match(
        markup,
        /<mask id="pcb-text-knockout-0"[^>]*mask-type="luminance"/
    )
    assert.match(markup, /class="pcb-text__knockout-fill"/)
    assert.match(markup, /class="pcb-text__knockout-glyphs"/)
    assert.match(markup, /font-size="89\.5"/)
    assert.match(
        markup,
        /<rect class="pcb-text__knockout-fill" x="-12" y="-85\.39"/
    )
    assert.doesNotMatch(
        markup,
        /<text class="pcb-text pcb-text--layer-33"[^>]*>FAKE_KNOCKOUT<\/text>/
    )
})

test('renderPcbSvg keeps embedded metric text boxes independent from browser fallback fonts', () => {
    const originalDocument = globalThis.document
    globalThis.document = {
        createElement(tagName) {
            if (tagName !== 'canvas') {
                return null
            }

            return {
                getContext() {
                    return {
                        font: '',
                        measureText() {
                            return {
                                width: 333,
                                actualBoundingBoxAscent: 90,
                                actualBoundingBoxDescent: 10
                            }
                        }
                    }
                }
            }
        }
    }

    try {
        const markup = PcbSvgRenderer.render({
            summary: { title: 'Metric-stable label board' },
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
                        text: 'GLYPH_BOX',
                        x: 120,
                        y: 140,
                        height: 100,
                        layerId: 33,
                        fontTypeName: 'TrueType',
                        fontFamily: 'Synthetic Mono',
                        fontMetrics: {
                            emScaleFromPcbHeight: 0.5,
                            averageAdvanceWidth: 500,
                            unitsPerEm: 1000
                        },
                        isInverted: true,
                        marginBorderWidth: 5,
                        visible: true
                    }
                ],
                components: []
            }
        })

        assert.match(
            markup,
            /<rect class="pcb-text__knockout-fill" x="-5" y="-46" width="235" height="60"/
        )
        assert.doesNotMatch(markup, /width="343" height="110"/)
    } finally {
        if (originalDocument) {
            globalThis.document = originalDocument
        } else {
            delete globalThis.document
        }
    }
})

test('renderPcbSvg mirrors the bottom text layer without moving text anchors', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Mirrored text group board' },
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
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            texts: [
                {
                    text: 'FAKE_BOTTOM_MARK',
                    x: 20,
                    y: 30,
                    height: 8,
                    layerId: 33,
                    rotation: 90,
                    mirrored: true,
                    visible: true
                }
            ],
            components: [],
            textGroupTransform: {
                translateX: 100,
                translateY: 0,
                scaleX: -1,
                scaleY: 1
            }
        }
    })

    assert.match(
        markup,
        /<g class="pcb-texts"[^>]*transform="translate\(100 0\) scale\(-1 1\)"/
    )
    assert.match(
        markup,
        /transform="translate\(20 30\) rotate\(90\) scale\(-1 1\)"/
    )
})

test('renderPcbSvg keeps PCB labels above simplified component overlays', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Overlay order board' },
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
                    text: 'FAKE_FRONT_MARK',
                    x: 180,
                    y: 160,
                    height: 48,
                    layerId: 33,
                    visible: true
                }
            ],
            components: [
                {
                    designator: 'U1',
                    x: 180,
                    y: 160,
                    rotation: 0,
                    layer: 'Top Layer',
                    pattern: 'QFN'
                }
            ]
        }
    })

    assert.ok(
        markup.indexOf('<g class="pcb-components">') <
            markup.indexOf('<g class="pcb-texts"')
    )
})

test('renderPcbSvg skips inverted TrueType duplicates when native knockout artwork exists', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Native knockout board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 1000 },
                    { type: 'line', x1: 1000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: Array.from({ length: 260 }, (_, index) => ({
                layerId: 33,
                x1: 100 + index,
                y1: 120,
                x2: 100 + index,
                y2: 880,
                width: 1
            })),
            arcs: [],
            vias: [],
            pads: [],
            shapeBasedRegions: [
                {
                    layerId: 33,
                    points: [
                        { x: 50, y: 80 },
                        { x: 950, y: 80 },
                        { x: 950, y: 760 },
                        { x: 50, y: 760 }
                    ],
                    holes: [
                        [
                            { x: 200, y: 200 },
                            { x: 300, y: 200 },
                            { x: 300, y: 260 },
                            { x: 200, y: 260 }
                        ]
                    ]
                }
            ],
            texts: [
                {
                    text: 'FAKE_NATIVE_DUPLICATE',
                    x: 180,
                    y: 160,
                    height: 100,
                    rotation: 90,
                    layerId: 33,
                    mirrored: true,
                    fontTypeName: 'TrueType',
                    fontFamily: 'Consolas',
                    isInverted: true,
                    marginBorderWidth: 12,
                    visible: true
                }
            ],
            components: []
        }
    })

    assert.match(markup, /class="pcb-footprint-region"/)
    assert.doesNotMatch(markup, /FAKE_NATIVE_DUPLICATE/)
    assert.doesNotMatch(markup, /pcb-text__knockout-fill/)
})
