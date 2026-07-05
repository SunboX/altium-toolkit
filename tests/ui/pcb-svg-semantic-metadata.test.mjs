// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbSvgRenderer } from '../../src/ui/PcbSvgRenderer.mjs'

/**
 * Decodes one SVG metadata JSON block.
 * @param {string} markup SVG markup.
 * @param {string} id Metadata element id.
 * @returns {object}
 */
function readMetadata(markup, id) {
    const match = markup.match(
        new RegExp('<metadata id="' + id + '"[^>]*>([^<]+)</metadata>', 'u')
    )
    assert.ok(match, 'metadata block is present')

    return JSON.parse(
        match[1]
            .replace(/&quot;/gu, '"')
            .replace(/&amp;/gu, '&')
            .replace(/&lt;/gu, '<')
            .replace(/&gt;/gu, '>')
    )
}

/**
 * Verifies PCB SVG output exposes stable semantic metadata for downstream
 * review and highlighting tools.
 */
test('PcbSvgRenderer emits semantic data attributes and metadata sidecar', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Semantic board' },
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
            layers: [{ index: 0, name: 'Top Layer', layerId: 1 }],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 33, name: 'Top Overlay' }
            ],
            nets: [{ netIndex: 5, name: 'SIG_A', uniqueId: 'NET-5' }],
            classes: [
                {
                    classIndex: 0,
                    name: 'Fast Nets',
                    kindName: 'net',
                    members: ['SIG_A']
                }
            ],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 40,
                    y1: 60,
                    x2: 200,
                    y2: 60,
                    width: 8,
                    layerId: 1,
                    netIndex: 5,
                    netName: 'SIG_A'
                }
            ],
            arcs: [],
            vias: [
                {
                    x: 230,
                    y: 60,
                    diameter: 24,
                    holeDiameter: 10,
                    layerId: 1,
                    netIndex: 5,
                    netName: 'SIG_A'
                }
            ],
            pads: [
                {
                    x: 100,
                    y: 120,
                    sizeTopX: 50,
                    sizeTopY: 30,
                    layerId: 1,
                    componentIndex: 0,
                    netIndex: 5,
                    netName: 'SIG_A',
                    padNumber: '1',
                    designator: '1',
                    holeDiameter: 12
                }
            ],
            texts: [
                {
                    text: 'SIG_A',
                    x: 120,
                    y: 180,
                    height: 20,
                    layerId: 33,
                    role: 'free',
                    netIndex: 5,
                    netName: 'SIG_A'
                }
            ],
            components: [
                {
                    componentIndex: 0,
                    designator: 'U1',
                    uniqueId: 'COMP-1',
                    x: 100,
                    y: 120,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'QFN-FAKE'
                }
            ]
        }
    })

    assert.match(
        markup,
        /<metadata id="pcb-semantic-metadata" data-schema="altium-toolkit\.pcb\.svg\.semantics\.a1">/
    )
    assert.match(markup, /data-feature="board-outline"/)
    assert.match(markup, /data-primitive="track"/)
    assert.match(markup, /data-element-key="pcb-track-0"/)
    assert.match(markup, /data-layer-key="L1"/)
    assert.match(markup, /data-layer-display-name="Top Layer"/)
    assert.match(markup, /data-net="SIG_A"/)
    assert.match(markup, /data-net-class="Fast Nets"/)
    assert.match(markup, /data-component="U1"/)
    assert.match(markup, /data-pad-number="1"/)
    assert.match(markup, /data-hole-owner="pad"/)
    assert.match(markup, /data-hole-owner="via"/)
    assert.match(markup, /data-text-role="free"/)

    const metadata = readMetadata(markup, 'pcb-semantic-metadata')

    assert.deepEqual(metadata.lookups, {
        netsByIndex: { 5: 'SIG_A' },
        netIndexByName: { SIG_A: 5 },
        netClassesByName: { SIG_A: ['Fast Nets'] },
        componentsByIndex: {
            0: {
                designator: 'U1',
                uniqueId: 'COMP-1',
                pattern: 'QFN-FAKE'
            }
        },
        componentIndexByDesignator: { U1: 0 },
        layersByKey: {
            L1: {
                layerId: 1,
                layerKey: 'L1',
                displayName: 'Top Layer',
                role: 'copper'
            },
            L33: {
                layerId: 33,
                layerKey: 'L33',
                displayName: 'Top Overlay',
                role: 'overlay'
            }
        },
        layerKeyByDisplayName: {
            'Top Layer': 'L1',
            'Top Overlay': 'L33'
        }
    })
})

/**
 * Verifies PCB SVG metadata describes the rendered view and drill rendering
 * state, not just individual primitive ownership.
 */
test('PcbSvgRenderer emits view metadata and drill render states', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'View metadata board' },
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
                ],
                cutouts: [
                    {
                        id: 'cutout-1',
                        kind: 'board-cutout',
                        segments: [
                            {
                                type: 'line',
                                x1: 100,
                                y1: 100,
                                x2: 130,
                                y2: 100
                            },
                            {
                                type: 'line',
                                x1: 130,
                                y1: 100,
                                x2: 130,
                                y2: 130
                            },
                            {
                                type: 'line',
                                x1: 130,
                                y1: 130,
                                x2: 100,
                                y2: 130
                            },
                            { type: 'line', x1: 100, y1: 130, x2: 100, y2: 100 }
                        ]
                    }
                ]
            },
            layers: [{ index: 0, name: 'Top Layer', layerId: 1 }],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer', role: 'copper' },
                { layerId: 33, name: 'Top Overlay', role: 'overlay' }
            ],
            nets: [],
            classes: [],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [
                {
                    x: 230,
                    y: 60,
                    diameter: 24,
                    holeDiameter: 10,
                    layerId: 1,
                    isPlated: true,
                    viaProtection: {
                        ipc4761Type: 4,
                        structureType: 4,
                        features: [
                            { type: 'plugged', side: 'top' },
                            { type: 'capped', side: 'bottom' }
                        ]
                    }
                }
            ],
            pads: [
                {
                    x: 100,
                    y: 120,
                    sizeTopX: 50,
                    sizeTopY: 30,
                    layerId: 1,
                    padNumber: '1',
                    designator: '1',
                    holeDiameter: 12,
                    isPlated: false
                }
            ],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /data-view-kind="top-composite"/)
    assert.match(markup, /data-included-layer-ids="1,33"/)
    assert.match(markup, /data-hole-kind="via"/)
    assert.match(markup, /data-hole-kind="pad"/)
    assert.match(markup, /data-plating="plated"/)
    assert.match(markup, /data-plating="non-plated"/)
    assert.match(markup, /data-drill-render-state="capped"/)
    assert.match(markup, /data-drill-render-state="open"/)

    const metadata = readMetadata(markup, 'pcb-semantic-metadata')

    assert.deepEqual(metadata.view.board.centroid, { x: 200, y: 150 })
    assert.equal(metadata.view.board.outlineOnly, false)
    assert.deepEqual(metadata.view.layerSet.includedLayerIds, [1, 33])
    assert.deepEqual(
        metadata.view.layerSet.roles.map((role) => ({
            layerId: role.layerId,
            role: role.role
        })),
        [
            { layerId: 1, role: 'copper' },
            { layerId: 33, role: 'overlay' }
        ]
    )
    assert.deepEqual(metadata.view.cutouts, [
        {
            id: 'cutout-1',
            kind: 'board-cutout',
            elementKey: 'pcb-board-cutout-0'
        }
    ])
    assert.deepEqual(metadata.view.drills, [
        {
            elementKey: 'pcb-via-hole-0',
            owner: 'via',
            holeKind: 'via',
            plating: 'plated',
            renderState: 'capped',
            ipc4761Type: 4
        },
        {
            elementKey: 'pcb-pad-hole-0',
            owner: 'pad',
            holeKind: 'pad',
            plating: 'non-plated',
            renderState: 'open'
        }
    ])
})

/**
 * Verifies PCB SVG export profiles can omit the root viewBox, preserve
 * document identity, and emit deterministic text geometry sidecars.
 */
test('PcbSvgRenderer supports export profile metadata and text geometry sidecars', () => {
    const markup = PcbSvgRenderer.render(
        {
            summary: { title: 'Profile board' },
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 200,
                    heightMil: 100,
                    segments: [
                        { type: 'line', x1: 0, y1: 0, x2: 200, y2: 0 },
                        { type: 'line', x1: 200, y1: 0, x2: 200, y2: 100 },
                        { type: 'line', x1: 200, y1: 100, x2: 0, y2: 100 },
                        { type: 'line', x1: 0, y1: 100, x2: 0, y2: 0 }
                    ]
                },
                layers: [{ layerId: 33, name: 'Top Overlay' }],
                primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
                polygons: [],
                fills: [],
                tracks: [],
                arcs: [],
                vias: [],
                pads: [],
                texts: [
                    {
                        recordId: 'silk-1',
                        text: 'PROFILE',
                        x: 20,
                        y: 40,
                        height: 10,
                        layerId: 33
                    }
                ],
                components: []
            }
        },
        {
            include_view_box: false,
            documentId: 'pcb-profile-1',
            documentVersion: 'rev-b',
            includeTextGeometrySidecar: true
        }
    )

    assert.doesNotMatch(markup, /<svg class="pcb-svg" viewBox=/)
    assert.match(markup, /data-doc-id="pcb-profile-1"/)
    assert.match(markup, /data-doc-ver="rev-b"/)
    assert.match(
        markup,
        /<metadata id="pcb-text-geometry" data-schema="altium-toolkit\.text-geometry\.a1">/
    )

    const geometry = readMetadata(markup, 'pcb-text-geometry')

    assert.deepEqual(geometry.entries, [
        {
            elementKey: 'pcb-text-0',
            recordId: 'silk-1',
            text: 'PROFILE',
            fontSize: 10,
            fontWeight: 400,
            geometryKind: 'estimated-bounds-polygon',
            polygon: [
                { x: 20, y: 40 },
                { x: 62, y: 40 },
                { x: 62, y: 28 },
                { x: 20, y: 28 }
            ]
        }
    ])
})

/**
 * Verifies callers can request deterministic one-layer PCB SVGs for visual
 * diffing without manually filtering the normalized model first.
 */
test('PcbSvgRenderer renders deterministic per-layer SVG exports', () => {
    const layerSvgs = PcbSvgRenderer.renderLayerSvgs({
        summary: { title: 'Layer export board' },
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
            layers: [],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer', role: 'copper' },
                { layerId: 33, name: 'Top Overlay', role: 'overlay' }
            ],
            nets: [],
            classes: [],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 40,
                    y1: 60,
                    x2: 200,
                    y2: 60,
                    width: 8,
                    layerId: 1
                }
            ],
            arcs: [],
            vias: [],
            pads: [],
            texts: [
                {
                    text: 'REF_A',
                    x: 120,
                    y: 180,
                    height: 20,
                    layerId: 33,
                    role: 'designator'
                }
            ],
            components: []
        }
    })

    assert.deepEqual(
        layerSvgs.map((entry) => ({
            layerId: entry.layerId,
            layerKey: entry.layerKey,
            displayName: entry.displayName,
            role: entry.role
        })),
        [
            {
                layerId: 1,
                layerKey: 'L1',
                displayName: 'Top Layer',
                role: 'copper'
            },
            {
                layerId: 33,
                layerKey: 'L33',
                displayName: 'Top Overlay',
                role: 'overlay'
            }
        ]
    )
    assert.match(layerSvgs[0].svg, /data-view-kind="layer"/)
    assert.match(layerSvgs[0].svg, /data-layer-view-key="L1"/)
    assert.match(layerSvgs[0].svg, /data-included-layer-ids="1"/)
    assert.match(layerSvgs[0].svg, /data-primitive="track"/)
    assert.doesNotMatch(layerSvgs[0].svg, /REF_A/)
    assert.match(layerSvgs[1].svg, /data-layer-view-key="L33"/)
    assert.match(layerSvgs[1].svg, /REF_A/)
    assert.doesNotMatch(layerSvgs[1].svg, /data-primitive="track"/)
})

/**
 * Verifies layer views use decoded legacy aliases when stack rows keep native
 * saved-layer IDs but primitive geometry is still keyed by legacy layer IDs.
 */
test('PcbSvgRenderer maps native internal layer views to legacy primitives', () => {
    const layerSvgs = PcbSvgRenderer.renderLayerSvgs({
        summary: { title: 'Internal layer export board' },
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
            layers: [
                {
                    layerId: 0x01000001,
                    legacyLayerId: 1,
                    name: 'Top Layer',
                    role: 'copper'
                },
                {
                    layerId: 0x01000002,
                    legacyLayerId: 2,
                    name: 'Internal1',
                    role: 'copper'
                },
                {
                    layerId: 0x01000003,
                    legacyLayerId: 3,
                    name: 'Internal2',
                    role: 'copper'
                },
                {
                    layerId: 0x0100ffff,
                    legacyLayerId: 32,
                    name: 'Bottom Layer',
                    role: 'copper'
                }
            ],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 2, name: 'Mid-Layer 1' },
                { layerId: 3, name: 'Mid-Layer 2' },
                { layerId: 32, name: 'Bottom Layer' }
            ],
            nets: [],
            classes: [],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 40,
                    y1: 60,
                    x2: 200,
                    y2: 60,
                    width: 8,
                    layerId: 2
                },
                {
                    x1: 40,
                    y1: 90,
                    x2: 200,
                    y2: 90,
                    width: 8,
                    layerId: 3
                }
            ],
            arcs: [],
            vias: [],
            pads: [],
            texts: [],
            components: []
        }
    })

    assert.deepEqual(
        layerSvgs.map((entry) => ({
            layerId: entry.layerId,
            legacyLayerId: entry.legacyLayerId,
            displayName: entry.displayName
        })),
        [
            {
                layerId: 0x01000001,
                legacyLayerId: 1,
                displayName: 'Top Layer'
            },
            {
                layerId: 0x01000002,
                legacyLayerId: 2,
                displayName: 'Internal1'
            },
            {
                layerId: 0x01000003,
                legacyLayerId: 3,
                displayName: 'Internal2'
            },
            {
                layerId: 0x0100ffff,
                legacyLayerId: 32,
                displayName: 'Bottom Layer'
            }
        ]
    )
    assert.match(layerSvgs[1].svg, /data-layer-view-display-name="Internal1"/)
    assert.match(layerSvgs[1].svg, /data-included-layer-ids="16777218,2"/)
    assert.match(layerSvgs[1].svg, /data-layer-key="L16777218"/)
    assert.match(
        layerSvgs[1].svg,
        /data-primitive="track"[^>]*data-layer-display-name="Internal1"/
    )
    assert.doesNotMatch(layerSvgs[1].svg, /data-layer-display-name="Internal2"/)
    assert.match(layerSvgs[2].svg, /data-layer-view-display-name="Internal2"/)
    assert.match(
        layerSvgs[2].svg,
        /data-primitive="track"[^>]*data-layer-display-name="Internal2"/
    )
})

/**
 * Verifies layer-only consumers can identify polygon pours and region copper by
 * the same semantic layer attributes as tracks, fills, arcs, pads, and vias.
 */
test('PcbSvgRenderer emits layer metadata for polygon aliases and regions', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Layered region metadata board' },
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
            layers: [
                {
                    layerId: 0x01000001,
                    legacyLayerId: 1,
                    name: 'Top Layer',
                    role: 'copper'
                },
                {
                    layerId: 0x01000002,
                    legacyLayerId: 2,
                    name: 'Internal1',
                    role: 'copper'
                },
                {
                    layerId: 0x01000003,
                    legacyLayerId: 3,
                    name: 'Internal2',
                    role: 'copper'
                }
            ],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 2, name: 'Mid-Layer 1' },
                { layerId: 3, name: 'Mid-Layer 2' }
            ],
            nets: [],
            classes: [],
            polygons: [
                {
                    layer: 'MID2',
                    segments: [
                        { type: 'line', x1: 40, y1: 40, x2: 120, y2: 40 },
                        { type: 'line', x1: 120, y1: 40, x2: 120, y2: 120 },
                        { type: 'line', x1: 120, y1: 120, x2: 40, y2: 120 },
                        { type: 'line', x1: 40, y1: 120, x2: 40, y2: 40 }
                    ]
                }
            ],
            fills: [],
            tracks: [],
            arcs: [],
            regions: [
                {
                    layerId: 3,
                    points: [
                        { x: 180, y: 40 },
                        { x: 260, y: 40 },
                        { x: 260, y: 120 },
                        { x: 180, y: 120 }
                    ]
                }
            ],
            vias: [],
            pads: [],
            texts: [],
            components: []
        }
    })

    assert.match(
        markup,
        /class="pcb-polygon pcb-polygon--subsurface"[^>]*data-primitive="polygon"[^>]*data-layer-display-name="Internal2"/
    )
    assert.match(
        markup,
        /class="pcb-region pcb-region--subsurface"[^>]*data-primitive="region"[^>]*data-layer-display-name="Internal2"/
    )
})

/**
 * Verifies fabrication primitives are emitted as addressable layer artwork
 * instead of being dropped when they are not chosen as footprint outlines.
 */
test('PcbSvgRenderer emits semantic artwork for paste mask layers', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Paste mask metadata board' },
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
            layers: [
                { layerId: 1, name: 'Top Layer', role: 'copper' },
                { layerId: 35, name: 'Top Paste', role: 'paste' }
            ],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 35, name: 'Top Paste' }
            ],
            polygons: [],
            fills: [
                {
                    x1: 60,
                    y1: 80,
                    x2: 110,
                    y2: 130,
                    layerId: 35
                }
            ],
            tracks: [
                {
                    x1: 150,
                    y1: 90,
                    x2: 240,
                    y2: 90,
                    width: 10,
                    layerId: 35
                }
            ],
            arcs: [
                {
                    x: 280,
                    y: 100,
                    radius: 24,
                    startAngle: 0,
                    endAngle: 90,
                    width: 8,
                    layerId: 35
                }
            ],
            regions: [
                {
                    layerId: 35,
                    points: [
                        { x: 80, y: 180 },
                        { x: 130, y: 180 },
                        { x: 130, y: 230 },
                        { x: 80, y: 230 }
                    ]
                }
            ],
            vias: [],
            pads: [],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /<g class="pcb-detail-layers"/)
    assert.match(
        markup,
        /class="pcb-detail-fill pcb-detail-fill--paste"[^>]*data-primitive="fill"[^>]*data-layer-display-name="Top Paste"/
    )
    assert.match(
        markup,
        /class="pcb-detail-track pcb-detail-track--paste"[^>]*data-primitive="track"[^>]*data-layer-display-name="Top Paste"/
    )
    assert.match(
        markup,
        /class="pcb-detail-arc pcb-detail-arc--paste"[^>]*data-primitive="arc"[^>]*data-layer-display-name="Top Paste"/
    )
    assert.match(
        markup,
        /class="pcb-detail-region pcb-detail-region--paste"[^>]*data-primitive="region"[^>]*data-layer-display-name="Top Paste"/
    )
    assert.doesNotMatch(markup, /class="pcb-fill pcb-fill--surface"/)
    assert.doesNotMatch(markup, /class="pcb-track pcb-track--surface"/)
})

/**
 * Verifies SMT pad paste openings become addressable paste-layer artwork even
 * when the file stores them as pad mask metadata, not free paste primitives.
 */
test('PcbSvgRenderer emits pad-derived paste apertures as layer artwork', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Pad paste aperture board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 300,
                heightMil: 180,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 300, y2: 0 },
                    { type: 'line', x1: 300, y1: 0, x2: 300, y2: 180 },
                    { type: 'line', x1: 300, y1: 180, x2: 0, y2: 180 },
                    { type: 'line', x1: 0, y1: 180, x2: 0, y2: 0 }
                ]
            },
            layers: [
                { layerId: 1, name: 'Top Layer', role: 'copper' },
                { layerId: 35, name: 'Top Paste', role: 'paste' },
                { layerId: 36, name: 'Bottom Paste', role: 'paste' }
            ],
            primitiveLayers: [
                { layerId: 1, name: 'Top Layer' },
                { layerId: 35, name: 'Top Paste' },
                { layerId: 36, name: 'Bottom Paste' }
            ],
            nets: [{ netIndex: 2, name: 'SIG_A' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            regions: [],
            vias: [],
            pads: [
                {
                    x: 120,
                    y: 90,
                    sizeTopX: 44,
                    sizeTopY: 28,
                    sizeMidX: 44,
                    sizeMidY: 28,
                    sizeBottomX: 44,
                    sizeBottomY: 28,
                    shapeTop: 2,
                    shapeBottom: 2,
                    rotation: 15,
                    layerId: 1,
                    padNumber: '1',
                    netIndex: 2,
                    hasTopPasteMaskOpening: true,
                    hasBottomPasteMaskOpening: false,
                    effectivePasteMaskExpansion: -2
                }
            ],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /<g class="pcb-pad-mask-layers">/)
    assert.match(
        markup,
        /class="pcb-detail-fill pcb-detail-fill--paste pcb-pad-mask-aperture pcb-pad-mask-aperture--paste"[^>]*width="40"[^>]*height="24"[^>]*data-primitive="pad-paste"[^>]*data-layer-display-name="Top Paste"/
    )
    assert.match(markup, /data-mask-side="top"/)
    assert.match(markup, /data-source-pad-element-key="pcb-pad-0"/)
    assert.match(markup, /data-pad-number="1"/)
    assert.match(markup, /data-net="SIG_A"/)
    assert.doesNotMatch(markup, /data-layer-display-name="Bottom Paste"/)
})
