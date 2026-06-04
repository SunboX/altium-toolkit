// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbCustomPadShapeParser } from '../../src/core/altium/PcbCustomPadShapeParser.mjs'
import { PcbExtendedPrimitiveInformationParser } from '../../src/core/altium/PcbExtendedPrimitiveInformationParser.mjs'
import { PcbUnionParser } from '../../src/core/altium/PcbUnionParser.mjs'
import { PcbSidecarTestFactory } from './PcbSidecarTestFactory.mjs'

/**
 * Verifies sidecar mask and paste records keep primitive-indexed manual values.
 */
test('PcbExtendedPrimitiveInformationParser parses mask expansion sidecars', () => {
    const parsed = PcbExtendedPrimitiveInformationParser.parse(
        PcbSidecarTestFactory.createLengthPrefixedRecords([
            '|PRIMITIVEINDEX=0|PRIMITIVEOBJECTID=2|TYPE=Pad|PASTEMASKEXPANSIONMODE=2|PASTEMASKEXPANSION_MANUAL=-3.5mil|SOLDERMASKEXPANSIONMODE=1|SOLDERMASKEXPANSION_MANUAL=4mil'
        ])
    )
    const primitives = { pads: [{}] }

    PcbExtendedPrimitiveInformationParser.attachToPrimitives(primitives, parsed)

    assert.equal(parsed.entries.length, 1)
    assert.deepEqual(parsed.byPrimitiveIndex['0'].maskExpansion, {
        paste: {
            mode: 2,
            source: 'manual',
            manualExpansion: -3.5
        },
        solder: {
            mode: 1,
            source: 'rule',
            manualExpansion: 4
        }
    })
    assert.deepEqual(primitives.pads[0].extendedPrimitiveInformation, {
        primitiveIndex: 0,
        primitiveObjectId: 2,
        primitiveType: 'pad',
        type: 'Pad',
        sourceStream: 'ExtendedPrimitiveInformation/Data',
        maskExpansion: parsed.byPrimitiveIndex['0'].maskExpansion
    })
})

/**
 * Verifies custom pad shape records link an anchor pad to region and arc
 * geometry without copying unrelated primitive arrays.
 */
test('PcbCustomPadShapeParser links anchor pads to custom geometry', () => {
    const parsed = PcbCustomPadShapeParser.parse(
        PcbSidecarTestFactory.createLengthPrefixedRecords([
            '|PRIMITIVEINDEX=0|LAYER=Top Layer|LAYERID=1|REGIONINDEX=0|ARCINDEX=0|PASTEMASK=TRUE|SOLDERMASK=FALSE'
        ])
    )
    const pads = [{ x: 100, y: 200 }]
    const geometry = {
        regions: [
            {
                points: [
                    { x: 90, y: 190 },
                    { x: 110, y: 190 },
                    { x: 110, y: 210 },
                    { x: 90, y: 210 }
                ]
            }
        ],
        arcs: [{ x: 100, y: 200, radius: 12 }]
    }

    PcbCustomPadShapeParser.attachToPads(pads, parsed, geometry)

    assert.equal(parsed.entries.length, 1)
    assert.deepEqual(pads[0].customShape, {
        primitiveIndex: 0,
        sourceStream: 'CustomShapes/Data',
        layers: [
            {
                layer: 'Top Layer',
                layerId: 1,
                pasteMask: true,
                solderMask: false,
                regions: [geometry.regions[0]],
                arcs: [geometry.arcs[0]],
                tracks: [],
                fills: []
            }
        ]
    })
})

/**
 * Verifies PCB union streams expose names, smart-union semantics, and primitive
 * memberships for grouped objects.
 */
test('PcbUnionParser parses union names and smart-union memberships', () => {
    const parsed = PcbUnionParser.extractFromStreams(
        new Map([
            [
                'UnionNames/Data',
                PcbSidecarTestFactory.createLengthPrefixedRecords([
                    '|UNIONINDEX=5|NAME=Group A'
                ])
            ],
            [
                'SmartUnions/Data',
                PcbSidecarTestFactory.createLengthPrefixedRecords([
                    '|UNIONINDEX=9|NAME=Shield Rows|UNIONTYPE=6|PRIMITIVEOBJECTID0=3|PRIMITIVEINDEX0=0|PRIMITIVEOBJECTID1=4|PRIMITIVEINDEX1=1'
                ])
            ]
        ])
    )
    const primitives = {
        vias: [{}],
        tracks: [{}, {}]
    }

    PcbUnionParser.attachToPrimitives(primitives, parsed)

    assert.deepEqual(parsed.userUnions[0], {
        index: 5,
        name: 'Group A',
        sourceStream: 'UnionNames/Data',
        fields: {
            UNIONINDEX: '5',
            NAME: 'Group A'
        }
    })
    assert.deepEqual(parsed.smartUnions[0], {
        index: 9,
        name: 'Shield Rows',
        type: 6,
        typeName: 'via-shielding',
        sourceStream: 'SmartUnions/Data',
        members: [
            { primitiveObjectId: 3, primitiveIndex: 0 },
            { primitiveObjectId: 4, primitiveIndex: 1 }
        ],
        fields: {
            UNIONINDEX: '9',
            NAME: 'Shield Rows',
            UNIONTYPE: '6',
            PRIMITIVEOBJECTID0: '3',
            PRIMITIVEINDEX0: '0',
            PRIMITIVEOBJECTID1: '4',
            PRIMITIVEINDEX1: '1'
        }
    })
    assert.deepEqual(primitives.vias[0].unionMemberships, [
        {
            index: 9,
            name: 'Shield Rows',
            type: 6,
            typeName: 'via-shielding',
            sourceStream: 'SmartUnions/Data'
        }
    ])
    assert.deepEqual(primitives.tracks[1].unionMemberships, [
        {
            index: 9,
            name: 'Shield Rows',
            type: 6,
            typeName: 'via-shielding',
            sourceStream: 'SmartUnions/Data'
        }
    ])
})
