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
