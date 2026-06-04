// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbCustomPadShapeParser } from '../../src/core/altium/PcbCustomPadShapeParser.mjs'
import { PcbExtendedPrimitiveInformationParser } from '../../src/core/altium/PcbExtendedPrimitiveInformationParser.mjs'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'
import { PcbSidecarTestFactory } from './PcbSidecarTestFactory.mjs'

/**
 * Builds a compact board record with a rectangular outline.
 * @returns {{ fields: Record<string, string>, sourceStream: string }[]}
 */
function createBoardRecords() {
    return [
        {
            sourceStream: 'Board6/Data',
            fields: {
                KIND0: '0',
                VX0: '0mil',
                VY0: '0mil',
                CX0: '0mil',
                CY0: '0mil',
                SA0: '0',
                EA0: '0',
                R0: '0mil',
                KIND1: '0',
                VX1: '200mil',
                VY1: '0mil',
                CX1: '0mil',
                CY1: '0mil',
                SA1: '0',
                EA1: '0',
                R1: '0mil',
                KIND2: '0',
                VX2: '200mil',
                VY2: '100mil',
                CX2: '0mil',
                CY2: '0mil',
                SA2: '0',
                EA2: '0',
                R2: '0mil',
                KIND3: '0',
                VX3: '0mil',
                VY3: '100mil',
                CX3: '0mil',
                CY3: '0mil',
                SA3: '0',
                EA3: '0',
                R3: '0mil',
                TRACKWIDTH: '8mil',
                VIAHOLESIZE: '12mil',
                VIADIAMETER: '24mil',
                SOLDERMASKEXPANSION: '4mil',
                PASTEMASKEXPANSION: '-0.5mil',
                CLEARANCE: '6mil',
                DEFAULTFONTNAME: 'Arial'
            }
        }
    ]
}

/**
 * Verifies model assembly propagates sidecar parser outputs into the normalized
 * PCB contract after geometry normalization.
 */
test('PcbModelParser exposes sidecar metadata and resolved PCB text metadata', () => {
    const pad = {
        primitiveIndex: 0,
        x: 100,
        y: 20,
        rotation: 0,
        solderMaskExpansionMode: 1,
        solderMaskExpansion: 2.25
    }
    const via = {
        primitiveIndex: 1,
        x: 120,
        y: 40,
        diameter: 24,
        holeDiameter: 12,
        solderMaskExpansionMode: 0
    }
    const extendedPrimitiveInformation =
        PcbExtendedPrimitiveInformationParser.parse(
            PcbSidecarTestFactory.createLengthPrefixedRecords([
                '|PRIMITIVEINDEX=0|PRIMITIVEOBJECTID=2|TYPE=Pad|PASTEMASKEXPANSIONMODE=2|PASTEMASKEXPANSION_MANUAL=-1.5mil'
            ])
        )
    PcbExtendedPrimitiveInformationParser.attachToPrimitives(
        { pads: [pad] },
        extendedPrimitiveInformation
    )

    const model = PcbModelParser.parse(
        'sidecar-check.PcbDoc',
        createBoardRecords(),
        {
            streamNames: [],
            binaryPrimitives: {
                arcs: [],
                tracks: [],
                vias: [via],
                fills: [],
                pads: [pad],
                texts: [
                    {
                        text: '.VariantName',
                        x: 30,
                        y: 40,
                        height: 8,
                        rotation: 0
                    }
                ],
                regions: [
                    {
                        points: [
                            { x: 90, y: 10 },
                            { x: 110, y: 10 },
                            { x: 110, y: 30 },
                            { x: 90, y: 30 }
                        ],
                        holes: []
                    }
                ],
                shapeBasedRegions: [],
                boardRegions: []
            },
            customPadShapes: PcbCustomPadShapeParser.parse(
                PcbSidecarTestFactory.createLengthPrefixedRecords([
                    '|PRIMITIVEINDEX=0|LAYER=Top Layer|LAYERID=1|REGIONINDEX=0'
                ])
            ),
            extendedPrimitiveInformation,
            unions: {
                userUnions: [],
                smartUnions: [],
                byIndex: {},
                smartByIndex: {},
                membersByPrimitiveKey: {}
            },
            viaStructures: {
                structures: [],
                links: [],
                byPrimitiveIndex: {}
            },
            specialStringParameters: {
                VariantName: 'Assembly B'
            },
            diagnostics: {
                printableRecordCount: 0,
                printableStreamCount: 0,
                binaryPrimitiveCount: 3
            }
        }
    )

    assert.equal(model.pcb.pads[0].y, 80)
    assert.equal(
        model.pcb.pads[0].customShape.layers[0].regions[0].points[0].y,
        90
    )
    assert.equal(
        model.pcb.pads[0].extendedPrimitiveInformation.maskExpansion.paste
            .manualExpansion,
        -1.5
    )
    assert.equal(model.pcb.texts[0].text, '.VariantName')
    assert.equal(model.pcb.texts[0].rawText, '.VariantName')
    assert.equal(model.pcb.texts[0].resolvedText, 'Assembly B')
    assert.equal(model.summary.customPadShapeCount, 1)
    assert.equal(model.summary.extendedPrimitiveInformationCount, 1)
    assert.deepEqual(model.pcb.defaults, {
        schema: 'altium-toolkit.pcb.defaults.a1',
        source: 'pcb-document',
        board: {
            defaultFontName: 'Arial'
        },
        primitiveStyles: {
            trackWidthMil: 8,
            viaHoleSizeMil: 12,
            viaDiameterMil: 24
        },
        maskPaste: {
            solder: {
                expansionMil: 4
            },
            paste: {
                expansionMil: -0.5
            }
        },
        clearances: {
            defaultClearanceMil: 6
        }
    })
    assert.deepEqual(model.pcb.maskPaste.summary, {
        primitiveCount: 2,
        manualCount: 1,
        ruleCount: 1,
        defaultCount: 2,
        unresolvedCount: 0
    })
    assert.equal(
        model.pcb.pads[0].effectiveMaskPaste.paste.source,
        'sidecar-manual'
    )
    assert.equal(model.pcb.pads[0].effectiveMaskPaste.paste.expansionMil, -1.5)
    assert.equal(model.pcb.pads[0].effectiveMaskPaste.solder.source, 'rule')
    assert.equal(model.pcb.pads[0].effectiveMaskPaste.solder.expansionMil, 2.25)
    assert.equal(
        model.pcb.vias[0].effectiveMaskPaste.solder.source,
        'document-default'
    )
    assert.equal(model.pcb.vias[0].effectiveMaskPaste.solder.expansionMil, 4)
})
