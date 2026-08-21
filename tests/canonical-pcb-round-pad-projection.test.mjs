// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-FileCopyrightText: 2026 Ahmed Alshaybani
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { AltiumParser } from '../src/core/altium/AltiumParser.mjs'
import { Parser } from '../src/convergence/Parser.mjs'

const MILS_PER_MM = 39.37007874015748

/**
 * Converts a native mil dimension to the precision used by CircuitJSON.
 * @param {number} mils Native dimension in mils.
 * @returns {number} Canonical dimension in millimetres.
 */
function millimetres(mils) {
    return Math.round((mils / MILS_PER_MM) * 1_000_000) / 1_000_000
}

/**
 * Converts one native mil radius through the canonical millimetre rounding.
 * @param {number} mils Native diameter in mils.
 * @returns {number} Canonical radius in millimetres.
 */
function radiusMillimetres(mils) {
    return Math.round((millimetres(mils) / 2) * 1_000_000) / 1_000_000
}

/**
 * Builds the neutral renderer model used by the public parser regression.
 * @returns {Record<string, any>} Synthetic native renderer model.
 */
function createRendererModel() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'neutral-board.PcbDoc',
        summary: { title: 'Neutral board' },
        diagnostics: [],
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            pads: [
                {
                    x: 100,
                    y: 100,
                    shapeTopName: 'ROUND',
                    sizeTopX: 27.5591,
                    sizeTopY: 98.4252,
                    rotation: 0,
                    layer: 'Top Layer'
                },
                {
                    x: 200,
                    y: 100,
                    shapeTopName: 'ROUND',
                    sizeTopX: 90,
                    sizeTopY: 90,
                    holeDiameter: 40,
                    isPlated: true,
                    rotation: 0,
                    layer: 'Top Layer'
                },
                {
                    x: 300,
                    y: 100,
                    shapeTopName: 'ROUND',
                    sizeTopX: 27.5591,
                    sizeTopY: 98.4252,
                    rotation: 0.0000005,
                    layer: 'Top Layer'
                },
                {
                    x: 400,
                    y: 100,
                    shapeTopName: 'ROUND',
                    sizeTopX: 27.5591,
                    sizeTopY: 98.4252,
                    rotation: 90,
                    layer: 'Top Layer'
                },
                {
                    x: 500,
                    y: 100,
                    shapeTopName: 'ROUND',
                    sizeTopX: 27.5591,
                    sizeTopY: 27.5591,
                    rotation: 0,
                    layer: 'Top Layer'
                }
            ]
        }
    }
}

test('public parser preserves anisotropic round SMT pad geometry', () => {
    const original = AltiumParser.parseArrayBufferToRendererModel
    AltiumParser.parseArrayBufferToRendererModel = () => createRendererModel()

    try {
        const document = Parser.parse({
            fileName: 'neutral-board.PcbDoc',
            data: new Uint8Array([0])
        })
        const smtPads = document.model.filter(
            (element) => element.type === 'pcb_smtpad'
        )

        assert.deepEqual(
            smtPads.map((pad) => pad.shape),
            ['pill', 'pill', 'rotated_pill', 'circle']
        )
        assert.deepEqual(
            smtPads.slice(0, 3).map(({ width, height }) => [width, height]),
            [
                [millimetres(27.5591), millimetres(98.4252)],
                [millimetres(27.5591), millimetres(98.4252)],
                [millimetres(27.5591), millimetres(98.4252)]
            ]
        )
        assert.equal(smtPads[0].radius, radiusMillimetres(27.5591))
        assert.equal(smtPads[1].radius, radiusMillimetres(27.5591))
        assert.equal(smtPads[2].radius, radiusMillimetres(27.5591))
        assert.equal('ccw_rotation' in smtPads[1], false)
        assert.equal(smtPads[2].ccw_rotation, 90)
    } finally {
        AltiumParser.parseArrayBufferToRendererModel = original
    }
})
