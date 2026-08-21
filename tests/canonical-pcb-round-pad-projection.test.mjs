// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-FileCopyrightText: 2026 Ahmed Alshaybani
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { AltiumParser } from '../src/core/altium/AltiumParser.mjs'
import { CircuitJsonModelAdapter } from '../src/core/circuit-json/CircuitJsonModelAdapter.mjs'
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
 * @param {{ includeSchematic?: boolean }} [options] Fixture shape options.
 * @returns {Record<string, any>} Synthetic native renderer model.
 */
function createRendererModel({ includeSchematic = true } = {}) {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'neutral-board.PcbDoc',
        summary: { title: 'Neutral board' },
        diagnostics: [],
        ...(includeSchematic
            ? {
                  schematic: {
                      sheet: { width: 100, height: 50 },
                      components: [],
                      pins: [],
                      nets: [],
                      lines: [],
                      texts: []
                  }
              }
            : {}),
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            components: [
                {
                    componentIndex: 0,
                    designator: 'U1',
                    x: 100,
                    y: 100,
                    layer: 'Top Layer'
                }
            ],
            pads: [
                {
                    x: 100,
                    y: 100,
                    componentIndex: 0,
                    name: 'A1',
                    shapeTopName: 'ROUND',
                    sizeTopX: 27.5591,
                    sizeTopY: 98.4252,
                    rotation: 0,
                    layer: 'Top Layer'
                },
                {
                    x: 200,
                    y: 100,
                    componentIndex: 0,
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
                    componentIndex: 0,
                    name: 'A2',
                    shapeTopName: 'ROUND',
                    sizeTopX: 27.5591,
                    sizeTopY: 98.4252,
                    rotation: 0.0000005,
                    layer: 'Top Layer'
                },
                {
                    x: 400,
                    y: 100,
                    componentIndex: 0,
                    name: 'A3',
                    shapeTopName: 'CIRCLE',
                    sizeTopX: 27.5591,
                    sizeTopY: 98.4252,
                    rotation: 90,
                    layer: 'Top Layer'
                },
                {
                    x: 500,
                    y: 100,
                    componentIndex: 0,
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
    const originalParser = AltiumParser.parseArrayBufferToRendererModel
    const originalAdapter = CircuitJsonModelAdapter.fromRendererModel
    let originalProjectedPad
    AltiumParser.parseArrayBufferToRendererModel = () => createRendererModel()
    CircuitJsonModelAdapter.fromRendererModel = (rendererModel) =>
        originalAdapter(rendererModel).map((element) => {
            if (element?.type !== 'pcb_smtpad' || originalProjectedPad) {
                return element
            }
            originalProjectedPad = {
                ...element,
                metadata: { source: 'neutral-pad-metadata' }
            }
            return originalProjectedPad
        })

    try {
        const document = Parser.parse({
            fileName: 'neutral-board.PcbDoc',
            data: new Uint8Array([0])
        })
        const smtPads = document.model.filter(
            (element) => element.type === 'pcb_smtpad'
        )

        assert.ok(
            document.model.some((element) => element.type === 'schematic_sheet')
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
        assert.deepEqual(
            {
                pcb_smtpad_id: smtPads[0].pcb_smtpad_id,
                pcb_component_id: smtPads[0].pcb_component_id,
                pcb_port_id: smtPads[0].pcb_port_id,
                x: smtPads[0].x,
                y: smtPads[0].y,
                layer: smtPads[0].layer,
                port_hints: smtPads[0].port_hints,
                metadata: smtPads[0].metadata
            },
            {
                pcb_smtpad_id: originalProjectedPad.pcb_smtpad_id,
                pcb_component_id: originalProjectedPad.pcb_component_id,
                pcb_port_id: originalProjectedPad.pcb_port_id,
                x: originalProjectedPad.x,
                y: originalProjectedPad.y,
                layer: originalProjectedPad.layer,
                port_hints: originalProjectedPad.port_hints,
                metadata: originalProjectedPad.metadata
            }
        )
    } finally {
        AltiumParser.parseArrayBufferToRendererModel = originalParser
        CircuitJsonModelAdapter.fromRendererModel = originalAdapter
    }
})

test('public parser projects anisotropic round SMT pads without a schematic', () => {
    const originalParser = AltiumParser.parseArrayBufferToRendererModel
    AltiumParser.parseArrayBufferToRendererModel = () =>
        createRendererModel({ includeSchematic: false })

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
        assert.equal(
            document.model.some(
                (element) => element.type === 'schematic_sheet'
            ),
            false
        )
    } finally {
        AltiumParser.parseArrayBufferToRendererModel = originalParser
    }
})
