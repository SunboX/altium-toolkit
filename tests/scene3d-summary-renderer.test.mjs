// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dSummaryRenderer } from '../src/scene3d.mjs'

test('PcbScene3dSummaryRenderer renders static board summary markup', () => {
    const markup = PcbScene3dSummaryRenderer.render({
        pcb: {
            boardOutline: {
                widthMil: 1200,
                heightMil: 800
            },
            components: [{ designator: 'U1' }, { designator: 'C1' }]
        },
        bom: [{ quantity: 1 }]
    })

    assert.match(markup, /3D summary/)
    assert.match(markup, /1200 x 800 mil/)
    assert.match(markup, /2 components/)
    assert.doesNotMatch(markup, /button/i)
    assert.doesNotMatch(markup, /data-scene-3d-preset/)
})

test('PcbScene3dSummaryRenderer renders an empty state without PCB data', () => {
    assert.match(
        PcbScene3dSummaryRenderer.render({ kind: 'schematic' }),
        /3D summary is available after parsing a PCB document/
    )
})
