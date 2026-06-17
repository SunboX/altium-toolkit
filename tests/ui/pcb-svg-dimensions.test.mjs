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
 * Builds a compact PCB document with dimension primitives.
 * @returns {object}
 */
function dimensionBoard() {
    return {
        summary: { title: 'Dimension board' },
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
            layers: [{ layerId: 57, name: 'Mechanical 1' }],
            primitiveLayers: [{ layerId: 57, name: 'Mechanical 1' }],
            nets: [],
            classes: [],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            texts: [],
            components: [],
            dimensions: [
                {
                    dimensionIndex: 0,
                    kind: 'linear',
                    name: 'D1',
                    layer: 'Mechanical 1',
                    text: '100 mil',
                    measuredValue: 100,
                    unit: 'mil',
                    references: [
                        { index: 0, x: 10, y: -520 },
                        { index: 1, x: 110, y: -520 }
                    ],
                    textLocation: { x: 60, y: -560 }
                },
                {
                    dimensionIndex: 1,
                    kind: 'angular',
                    name: 'A1',
                    layer: 'Mechanical 1',
                    text: '45 deg',
                    angleValue: 45,
                    references: [
                        { index: 0, x: 180, y: 120 },
                        { index: 1, x: 220, y: 160 },
                        { index: 2, x: 260, y: 120 }
                    ],
                    textLocation: { x: 220, y: 90 }
                },
                {
                    dimensionIndex: 2,
                    kind: 'diameter',
                    name: 'DR1',
                    layer: 'Mechanical 1',
                    text: 'dia 40 mil',
                    measuredValue: 40,
                    unit: 'mil',
                    references: [
                        { index: 0, x: 300, y: 170 },
                        { index: 1, x: 340, y: 170 }
                    ],
                    textLocation: { x: 360, y: 150 }
                }
            ]
        }
    }
}

/**
 * Verifies PCB dimensions render as deterministic SVG primitives with semantic
 * metadata and extend the viewport when dimensions sit outside the board.
 */
test('PcbSvgRenderer renders dimension primitives and metadata', () => {
    const markup = PcbSvgRenderer.render(dimensionBoard())

    assert.match(markup, /viewBox="-240 -800 /)
    assert.match(markup, /<g class="pcb-dimensions">/)
    assert.match(
        markup,
        /<g class="pcb-dimension pcb-dimension--linear"[^>]*data-primitive="dimension"[^>]*data-element-key="pcb-dimension-0"[^>]*data-dimension-kind="linear"/
    )
    assert.match(
        markup,
        /<line class="pcb-dimension__measure" x1="10" y1="-520" x2="110" y2="-520"/
    )
    assert.match(
        markup,
        /<text class="pcb-dimension__label"[^>]*>100 mil<\/text>/
    )
    assert.match(markup, /<path class="pcb-dimension__arc" d="M /)
    assert.match(
        markup,
        /<g class="pcb-dimension pcb-dimension--diameter"[^>]*data-element-key="pcb-dimension-2"/
    )

    const metadata = readMetadata(markup, 'pcb-semantic-metadata')
    const dimensionEntries = metadata.elements.filter(
        (entry) => entry.primitive === 'dimension'
    )

    assert.deepEqual(
        dimensionEntries.map((entry) => ({
            elementKey: entry.elementKey,
            dimensionKind: entry.dimensionKind,
            layerDisplayName: entry.layerDisplayName,
            measuredValue: entry.measuredValue,
            text: entry.text
        })),
        [
            {
                elementKey: 'pcb-dimension-0',
                dimensionKind: 'linear',
                layerDisplayName: 'Mechanical 1',
                measuredValue: 100,
                text: '100 mil'
            },
            {
                elementKey: 'pcb-dimension-1',
                dimensionKind: 'angular',
                layerDisplayName: 'Mechanical 1',
                measuredValue: undefined,
                text: '45 deg'
            },
            {
                elementKey: 'pcb-dimension-2',
                dimensionKind: 'diameter',
                layerDisplayName: 'Mechanical 1',
                measuredValue: 40,
                text: 'dia 40 mil'
            }
        ]
    )
})
