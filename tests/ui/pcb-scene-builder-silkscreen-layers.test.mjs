// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../src/ui/PcbScene3dBuilder.mjs'

test('PcbScene3dBuilder accepts compact overlay layer names for silkscreen detail', () => {
    const scene = PcbScene3dBuilder.build({
        fileName: 'compact-overlay-names.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 300,
                segments: []
            },
            primitiveLayers: [
                { layerId: 33, name: 'TopOverlay' },
                { layerId: 34, name: 'BottomOverlay' }
            ],
            pads: [],
            tracks: [
                { x1: 10, y1: 20, x2: 70, y2: 20, width: 6, layerId: 33 },
                { x1: 15, y1: 250, x2: 75, y2: 250, width: 6, layerId: 34 }
            ],
            arcs: [],
            fills: [],
            texts: [
                { text: 'TOP', x: 120, y: 40, height: 40, layerId: 33 },
                { text: 'BOT', x: 120, y: 240, height: 40, layerId: 34 }
            ],
            vias: [],
            polygons: [],
            components: []
        }
    })

    assert.equal(scene.detail.silkscreen.top.tracks.length, 1)
    assert.equal(scene.detail.silkscreen.bottom.tracks.length, 1)
    assert.equal(scene.detail.silkscreen.top.texts[0].text, 'TOP')
    assert.equal(scene.detail.silkscreen.bottom.texts[0].text, 'BOT')
})
