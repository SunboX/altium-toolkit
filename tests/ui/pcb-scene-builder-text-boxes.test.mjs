// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

/**
 * Builds a small board with one top-overlay text primitive.
 * @param {object} text Text primitive overrides.
 * @returns {object}
 */
function buildSceneWithText(text) {
    return PcbScene3dBuilder.build({
        fileName: 'demo.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 400,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 500, y2: 0 },
                    { type: 'line', x1: 500, y1: 0, x2: 500, y2: 400 },
                    { type: 'line', x1: 500, y1: 400, x2: 0, y2: 400 },
                    { type: 'line', x1: 0, y1: 400, x2: 0, y2: 0 }
                ]
            },
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            pads: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            polygons: [],
            components: [],
            texts: [
                {
                    text: 'A',
                    layerId: 33,
                    x: 200,
                    y: 120,
                    height: 60,
                    fontTypeName: 'TrueType',
                    isInverted: true,
                    ...text
                }
            ]
        }
    })
}

/**
 * Verifies compact implicit inverted text boxes expose their authored
 * rectangle with the margin border included as the render bounds.
 */
test('PcbScene3dBuilder exposes compact implicit text-box margin layout', () => {
    const scene = buildSceneWithText({
        marginBorderWidth: 7,
        useInvertedRectangle: false,
        textboxRectWidth: 110,
        textboxRectHeight: 40,
        textboxRectJustification: 5
    })

    assert.deepEqual(scene.detail.silkscreen.top.texts[0].textBox, {
        source: 'altium-textbox',
        mode: 'implicit',
        compact: true,
        widthMil: 110,
        heightMil: 40,
        marginMil: 7,
        renderWidthMil: 124,
        renderHeightMil: 54,
        justification: { column: 1, row: 1 }
    })
})

/**
 * Verifies wide implicit boxes keep their authored dimensions so broad label
 * panels do not gain border expansion meant for compact pin labels.
 */
test('PcbScene3dBuilder leaves wide implicit text-box dimensions unexpanded', () => {
    const scene = buildSceneWithText({
        text: 'PANEL',
        marginBorderWidth: 20,
        useInvertedRectangle: false,
        textboxRectWidth: 380,
        textboxRectHeight: 68,
        textboxRectJustification: 5
    })

    assert.deepEqual(scene.detail.silkscreen.top.texts[0].textBox, {
        source: 'altium-textbox',
        mode: 'implicit',
        compact: false,
        widthMil: 380,
        heightMil: 68,
        marginMil: 20,
        renderWidthMil: 380,
        renderHeightMil: 68,
        justification: { column: 1, row: 1 }
    })
})
