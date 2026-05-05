// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicStandaloneCalloutNormalizer } from '../../src/core/altium/SchematicStandaloneCalloutNormalizer.mjs'

/**
 * Verifies standalone dashed note expansion stays attached to the nearby
 * bootstrap resistor cluster instead of swallowing a second resistor network
 * that happens to sit to the right in the same vertical band.
 */
test('normalize keeps standalone callouts scoped to the nearby owner cluster', () => {
    const lines = [
        {
            x1: 305,
            y1: 570,
            x2: 405,
            y2: 570,
            color: '#0000ff',
            width: 1,
            lineStyle: 1
        },
        {
            x1: 405,
            y1: 570,
            x2: 405,
            y2: 530,
            color: '#0000ff',
            width: 1,
            lineStyle: 1
        },
        {
            x1: 405,
            y1: 530,
            x2: 305,
            y2: 530,
            color: '#0000ff',
            width: 1,
            lineStyle: 1
        },
        {
            x1: 305,
            y1: 530,
            x2: 305,
            y2: 570,
            color: '#0000ff',
            width: 1,
            lineStyle: 1
        },
        {
            x1: 345,
            y1: 540,
            x2: 383,
            y2: 540,
            color: '#0000ff',
            width: 1,
            ownerIndex: '533'
        },
        {
            x1: 325,
            y1: 540,
            x2: 335,
            y2: 540,
            color: '#000080',
            width: 1
        },
        {
            x1: 395,
            y1: 540,
            x2: 395,
            y2: 510,
            color: '#000080',
            width: 1
        },
        {
            x1: 395,
            y1: 510,
            x2: 500,
            y2: 510,
            color: '#000080',
            width: 1
        },
        {
            x1: 480,
            y1: 470,
            x2: 480,
            y2: 560,
            color: '#000080',
            width: 1
        },
        {
            x1: 490,
            y1: 560,
            x2: 530,
            y2: 560,
            color: '#0000ff',
            width: 1,
            ownerIndex: '3075'
        },
        {
            x1: 490,
            y1: 575,
            x2: 530,
            y2: 575,
            color: '#0000ff',
            width: 1,
            ownerIndex: '3136'
        },
        {
            x1: 560,
            y1: 575,
            x2: 585,
            y2: 575,
            color: '#000080',
            width: 1
        }
    ]
    const texts = [
        {
            x: 395,
            y: 560,
            text: 'Needed for Safe ROM Boot',
            color: '#000080',
            hidden: false,
            name: '',
            recordType: '4',
            fontSize: 8,
            fontFamily: 'Times New Roman',
            fontWeight: 700,
            rotation: 0,
            anchor: 'middle'
        },
        {
            x: 344,
            y: 547,
            text: 'R76',
            color: '#000080',
            hidden: false,
            name: 'Designator',
            ownerIndex: '533',
            recordType: '34',
            fontSize: 10,
            fontFamily: 'Times New Roman',
            fontWeight: 400,
            rotation: 0,
            anchor: 'start'
        },
        {
            x: 325,
            y: 540,
            text: 'AURA_3V3',
            color: '#800000',
            hidden: false,
            name: '',
            recordType: '17',
            fontSize: 10,
            fontFamily: 'Times New Roman',
            fontWeight: 400,
            rotation: 0,
            anchor: 'middle'
        },
        {
            x: 475,
            y: 560,
            text: 'R81',
            color: '#000080',
            hidden: false,
            name: 'Designator',
            ownerIndex: '3075',
            recordType: '34',
            fontSize: 10,
            fontFamily: 'Times New Roman',
            fontWeight: 400,
            rotation: 0,
            anchor: 'start'
        },
        {
            x: 475,
            y: 575,
            text: 'R83',
            color: '#000080',
            hidden: false,
            name: 'Designator',
            ownerIndex: '3136',
            recordType: '34',
            fontSize: 10,
            fontFamily: 'Times New Roman',
            fontWeight: 400,
            rotation: 0,
            anchor: 'start'
        },
        {
            x: 585,
            y: 575,
            text: 'AURA_3V3',
            color: '#800000',
            hidden: false,
            name: '',
            recordType: '17',
            fontSize: 10,
            fontFamily: 'Times New Roman',
            fontWeight: 400,
            rotation: 0,
            anchor: 'middle'
        }
    ]

    const normalized = SchematicStandaloneCalloutNormalizer.normalize(
        lines,
        texts
    )
    const dashedBounds = normalized.lines
        .filter((line) => Number(line.lineStyle || 0) === 1)
        .reduce(
            (bounds, line) => ({
                minX: Math.min(bounds.minX, line.x1, line.x2),
                minY: Math.min(bounds.minY, line.y1, line.y2),
                maxX: Math.max(bounds.maxX, line.x1, line.x2),
                maxY: Math.max(bounds.maxY, line.y1, line.y2)
            }),
            {
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY
            }
        )
    const note = normalized.texts.find(
        (text) => text.text === 'Needed for Safe ROM Boot'
    )

    assert.deepEqual(dashedBounds, {
        minX: 282,
        minY: 526,
        maxX: 403,
        maxY: 590
    })
    assert.deepEqual(
        {
            x: note?.x,
            y: note?.y,
            anchor: note?.anchor
        },
        {
            x: 343,
            y: 576,
            anchor: 'middle'
        }
    )
})
