// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/parser.mjs'

/**
 * Creates a minimal printable PCB record.
 * @param {string} sourceStream Source stream name.
 * @param {Record<string, string>} fields Printable fields.
 * @returns {{ raw: string, sourceStream: string, fields: Record<string, string> }}
 */
function record(sourceStream, fields) {
    return {
        raw: Object.entries(fields)
            .map(([key, value]) => key + '=' + value)
            .join('|'),
        sourceStream,
        fields
    }
}

test('PcbModelParser exposes routed-net analysis by net class and pair', () => {
    const model = PcbModelParser.parse(
        'route-analysis.PcbDoc',
        [
            record('Board6/Data', {
                KIND0: 'Board',
                X1: '0',
                Y1: '0',
                X2: '400',
                Y2: '300',
                V7_LAYER_1_NAME: 'Top Layer'
            }),
            record('Nets6/Data', {
                NAME: 'USB_P',
                NETINDEX: '0',
                UNIQUEID: 'NET-P'
            }),
            record('Nets6/Data', {
                NAME: 'USB_N',
                NETINDEX: '1',
                UNIQUEID: 'NET-N'
            }),
            record('Classes6/Data', {
                NAME: 'USB Nets',
                KIND: '0',
                MEMBERCOUNT: '2',
                MEMBER0: 'USB_P',
                MEMBER1: 'USB_N'
            }),
            record('Classes6/Data', {
                NAME: 'USB Pair Class',
                KIND: '6',
                MEMBERCOUNT: '1',
                MEMBER0: 'USB_DP'
            }),
            record('DifferentialPairs6/Data', {
                NAME: 'USB_DP',
                POSITIVENETNAME: 'USB_P',
                NEGATIVENETNAME: 'USB_N'
            })
        ],
        {
            streamNames: ['Tracks6/Data', 'Vias6/Data'],
            binaryPrimitives: {
                tracks: [
                    {
                        x1: 20,
                        y1: 40,
                        x2: 120,
                        y2: 40,
                        width: 6,
                        layerId: 1,
                        netIndex: 0
                    },
                    {
                        x1: 120,
                        y1: 40,
                        x2: 120,
                        y2: 90,
                        width: 6,
                        layerId: 1,
                        netIndex: 0
                    },
                    {
                        x1: 20,
                        y1: 70,
                        x2: 120,
                        y2: 70,
                        width: 6,
                        layerId: 1,
                        netIndex: 1
                    }
                ],
                arcs: [],
                vias: [
                    {
                        x: 120,
                        y: 40,
                        diameter: 24,
                        holeDiameter: 10,
                        layerId: 1,
                        netIndex: 0
                    }
                ],
                pads: [],
                fills: [],
                texts: [],
                regions: [],
                shapeBasedRegions: [],
                boardRegions: []
            },
            diagnostics: {
                printableRecordCount: 6,
                printableStreamCount: 4,
                binaryPrimitiveCount: 4
            }
        }
    )

    assert.equal(
        model.pcb.routeAnalysis.schema,
        'altium-toolkit.pcb.route-analysis.a1'
    )
    assert.deepEqual(model.pcb.routeAnalysis.summary, {
        netCount: 2,
        routedNetCount: 2,
        totalLengthMil: 250,
        trackCount: 3,
        arcCount: 0,
        viaCount: 1,
        connectedRouteGroupCount: 2,
        differentialPairCount: 1
    })
    assert.deepEqual(
        model.pcb.routeAnalysis.byNet.map((net) => ({
            netName: net.netName,
            totalLengthMil: net.totalLengthMil,
            viaCount: net.viaCount,
            layers: net.layers,
            groupLengths: net.connectedRouteGroups.map(
                (group) => group.lengthMil
            )
        })),
        [
            {
                netName: 'USB_N',
                totalLengthMil: 100,
                viaCount: 0,
                layers: ['L1'],
                groupLengths: [100]
            },
            {
                netName: 'USB_P',
                totalLengthMil: 150,
                viaCount: 1,
                layers: ['L1'],
                groupLengths: [150]
            }
        ]
    )
    assert.deepEqual(model.pcb.routeAnalysis.classes, [
        {
            name: 'USB Nets',
            kindName: 'net',
            members: ['USB_P', 'USB_N'],
            netNames: ['USB_N', 'USB_P'],
            totalLengthMil: 250
        }
    ])
    assert.deepEqual(model.pcb.routeAnalysis.differentialPairs, [
        {
            name: 'USB_DP',
            positiveNetName: 'USB_P',
            negativeNetName: 'USB_N',
            positiveLengthMil: 150,
            negativeLengthMil: 100,
            skewLengthMil: 50,
            classes: ['USB Pair Class']
        }
    ])
    assert.equal(model.summary.routedNetCount, 2)
    assert.equal(model.summary.routedLengthMil, 250)
})
