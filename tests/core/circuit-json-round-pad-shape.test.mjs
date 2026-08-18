// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { AltiumCircuitJsonProjection } from '../../src/convergence/AltiumCircuitJsonProjection.mjs'
import { CircuitJsonModelAdapter } from '../../src/legacy-parser.mjs'

test('AltiumCircuitJsonProjection preserves anisotropic round SMT pad geometry', () => {
    const rendererModel = {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'neutral-round-pads.PcbDoc',
        summary: {
            title: 'Neutral round pads',
            boardWidthMil: 400,
            boardHeightMil: 300,
            layerCount: 2
        },
        diagnostics: [],
        pcb: {
            boardOutline: {
                widthMil: 400,
                heightMil: 300,
                minX: 0,
                minY: 0
            },
            components: [
                {
                    componentIndex: 1,
                    designator: 'U1',
                    x: 200,
                    y: 150,
                    layer: 'TOP',
                    rotation: 0
                }
            ],
            pads: [
                {
                    componentIndex: 1,
                    name: '1',
                    x: 150,
                    y: 100,
                    sizeTopX: 27.5591,
                    sizeTopY: 98.4252,
                    holeDiameter: 0,
                    shapeTopName: 'ROUND',
                    layer: 'TOP'
                },
                {
                    componentIndex: 1,
                    name: '2',
                    x: 200,
                    y: 100,
                    sizeTopX: 27.5591,
                    sizeTopY: 98.4252,
                    holeDiameter: 0,
                    shapeTopName: 'ROUND',
                    layer: 'TOP',
                    rotation: 90
                },
                {
                    componentIndex: 1,
                    name: '3',
                    x: 250,
                    y: 100,
                    sizeTopX: 27.5591,
                    sizeTopY: 27.5591,
                    holeDiameter: 0,
                    shapeTopName: 'ROUND',
                    layer: 'TOP'
                }
            ],
            tracks: [],
            vias: []
        },
        bom: []
    }

    const adapted = CircuitJsonModelAdapter.fromRendererModel(rendererModel)
    const pads = AltiumCircuitJsonProjection.project(
        adapted,
        rendererModel
    ).filter((element) => element.type === 'pcb_smtpad')

    assert.deepEqual(
        pads.map(({ shape, width, height, radius, ccw_rotation }) => ({
            shape,
            width,
            height,
            radius,
            ccw_rotation
        })),
        [
            {
                shape: 'pill',
                width: 0.700001,
                height: 2.5,
                radius: 0.350001,
                ccw_rotation: undefined
            },
            {
                shape: 'rotated_pill',
                width: 0.700001,
                height: 2.5,
                radius: 0.350001,
                ccw_rotation: 90
            },
            {
                shape: 'circle',
                width: undefined,
                height: undefined,
                radius: 0.350001,
                ccw_rotation: undefined
            }
        ]
    )
})
