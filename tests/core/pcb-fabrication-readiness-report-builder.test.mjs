// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbFabricationReadinessReportBuilder } from '../../src/parser.mjs'

test('PcbFabricationReadinessReportBuilder summarizes pad and via fabrication review items', () => {
    const report = PcbFabricationReadinessReportBuilder.build({
        pcb: {
            pads: [
                {
                    designator: '1',
                    netName: 'PWR_A',
                    padMode: 2,
                    padModeName: 'full-stack',
                    holeDiameter: 18,
                    holeSlotLength: 42,
                    holeGeometry: {
                        shapeName: 'slot',
                        diameter: 18,
                        slotLength: 42
                    },
                    isPlated: false,
                    pasteMaskExpansionMode: 2,
                    pasteMaskExpansion: -2,
                    solderMaskExpansionMode: 2,
                    solderMaskExpansion: 5,
                    thermalReliefAirGap: 9,
                    thermalReliefConductorWidth: 7,
                    localStack: {
                        layers: [
                            {
                                layerKey: 'L1',
                                offsetX: 3,
                                offsetY: 0
                            },
                            {
                                layerKey: 'L32',
                                offsetX: 0,
                                offsetY: 0
                            }
                        ]
                    }
                },
                {
                    designator: '2',
                    netName: 'SIG_A',
                    padMode: 0,
                    padModeName: 'simple'
                }
            ],
            vias: [
                {
                    netName: 'PWR_A',
                    diameter: 20,
                    holeDiameter: 6,
                    drillLayerPairType: 7,
                    diameterByLayer: [
                        {
                            layerId: 1,
                            sizeOnLayer: 20
                        },
                        {
                            layerId: 2,
                            sizeOnLayer: 12
                        }
                    ],
                    solderMaskExpansionMode: 2,
                    solderMaskExpansion: 3,
                    thermalReliefAirGap: 8,
                    viaProtection: {
                        ipc4761Type: 7,
                        structureType: 7
                    }
                },
                {
                    netName: 'SIG_A',
                    diameter: 24,
                    holeDiameter: 12
                }
            ]
        }
    })

    assert.equal(report.schema, 'altium-toolkit.pcb.fabrication-readiness.a1')
    assert.deepEqual(report.summary, {
        padCount: 2,
        viaCount: 2,
        reviewItemCount: 12,
        nonSimplePadModeCount: 1,
        offsetPadCount: 1,
        slottedHoleCount: 1,
        nonPlatedHoleCount: 1,
        pasteOverrideCount: 1,
        maskOverrideCount: 2,
        thermalReliefCount: 2,
        viaSpanCount: 1,
        protectedViaCount: 1,
        microviaLikeCount: 1
    })
    assert.deepEqual(
        report.items.map((item) => ({
            code: item.code,
            ownerKey: item.ownerKey,
            severity: item.severity
        })),
        [
            {
                code: 'pcb.fabrication.pad.non-simple-mode',
                ownerKey: 'pad-0',
                severity: 'info'
            },
            {
                code: 'pcb.fabrication.pad.offset-center',
                ownerKey: 'pad-0',
                severity: 'warning'
            },
            {
                code: 'pcb.fabrication.pad.slotted-hole',
                ownerKey: 'pad-0',
                severity: 'info'
            },
            {
                code: 'pcb.fabrication.pad.non-plated-hole',
                ownerKey: 'pad-0',
                severity: 'warning'
            },
            {
                code: 'pcb.fabrication.pad.paste-mask-override',
                ownerKey: 'pad-0',
                severity: 'info'
            },
            {
                code: 'pcb.fabrication.pad.solder-mask-override',
                ownerKey: 'pad-0',
                severity: 'info'
            },
            {
                code: 'pcb.fabrication.pad.thermal-relief',
                ownerKey: 'pad-0',
                severity: 'info'
            },
            {
                code: 'pcb.fabrication.via.layer-span',
                ownerKey: 'via-0',
                severity: 'warning'
            },
            {
                code: 'pcb.fabrication.via.protected-hole',
                ownerKey: 'via-0',
                severity: 'info'
            },
            {
                code: 'pcb.fabrication.via.solder-mask-override',
                ownerKey: 'via-0',
                severity: 'info'
            },
            {
                code: 'pcb.fabrication.via.thermal-relief',
                ownerKey: 'via-0',
                severity: 'info'
            },
            {
                code: 'pcb.fabrication.via.microvia-like',
                ownerKey: 'via-0',
                severity: 'warning'
            }
        ]
    )
})
