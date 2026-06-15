// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { GeometryBoundsReportBuilder } from '../../src/core/altium/GeometryBoundsReportBuilder.mjs'

/**
 * Verifies PCB primitive bounds are deterministic and include rotation/stroke.
 */
test('GeometryBoundsReportBuilder builds deterministic PCB geometry bounds', () => {
    const report = GeometryBoundsReportBuilder.build({
        documentModels: [
            {
                kind: 'pcb',
                fileName: 'bounds.PcbDoc',
                pcb: {
                    pads: [
                        {
                            x: 0,
                            y: 0,
                            sizeTopX: 100,
                            sizeTopY: 20,
                            rotation: 45
                        }
                    ],
                    arcs: [
                        {
                            x: 0,
                            y: 0,
                            radius: 100,
                            startAngle: 0,
                            endAngle: 90,
                            width: 10
                        }
                    ],
                    tracks: [
                        {
                            x1: 0,
                            y1: 0,
                            x2: 100,
                            y2: 0,
                            width: 10
                        }
                    ],
                    texts: [
                        {
                            text: 'REF',
                            x: 0,
                            y: 0,
                            height: 50,
                            rotation: 90
                        }
                    ]
                }
            }
        ]
    })

    const byFamily = Object.fromEntries(
        report.entries.map((entry) => [entry.family, entry.bounds])
    )

    assert.equal(report.schema, 'altium-toolkit.geometry-bounds.a1')
    assert.deepEqual(report.summary, {
        documentCount: 1,
        entryCount: 4,
        missingBoundsCount: 0,
        minX: -42.4264,
        minY: -45,
        maxX: 105,
        maxY: 105,
        width: 147.4264,
        height: 150
    })
    assert.deepEqual(byFamily.pads, {
        minX: -42.4264,
        minY: -42.4264,
        maxX: 42.4264,
        maxY: 42.4264,
        width: 84.8528,
        height: 84.8528
    })
    assert.deepEqual(byFamily.arcs, {
        minX: -5,
        minY: -5,
        maxX: 105,
        maxY: 105,
        width: 110,
        height: 110
    })
    assert.deepEqual(byFamily.tracks, {
        minX: 0,
        minY: -5,
        maxX: 100,
        maxY: 5,
        width: 100,
        height: 10
    })
    assert.deepEqual(byFamily.texts, {
        minX: -25,
        minY: -45,
        maxX: 25,
        maxY: 45,
        width: 50,
        height: 90
    })
})
