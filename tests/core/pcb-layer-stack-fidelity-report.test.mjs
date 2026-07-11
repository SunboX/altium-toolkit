// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbLayerStackFidelityReportBuilder } from '../../src/legacy-parser.mjs'

test('PcbLayerStackFidelityReportBuilder classifies source fidelity capabilities', () => {
    const report = PcbLayerStackFidelityReportBuilder.build({
        source: {
            fileName: 'stack-fidelity.PcbDoc',
            nativeStreams: ['Board6/Data'],
            hasNativeBoardData: true,
            hasBoardRegionsData: true
        },
        sourceMap: {
            registryEntryCount: 1,
            sourceKeyCount: 2,
            topLevelBendLineCount: 1,
            cavityRegionCount: 1,
            stiffenerLayerCount: 1,
            adhesiveLayerCount: 0,
            surfaceFinishCount: 1
        },
        layers: [
            {
                index: 1,
                layerId: 1,
                name: 'Top Layer',
                material: 'Copper',
                registryRef: '{layer-top}',
                sourceKeys: ['top', 'signal'],
                surfaceFinish: 'ENIG'
            },
            {
                index: 2,
                layerId: 2,
                name: 'Core',
                material: 'FR-4',
                dielectricConstant: 4.1,
                stackupxShared: true,
                stackupxProperties: {
                    supplier: 'generic'
                }
            }
        ],
        substacks: [{ id: 'STACK_A' }],
        branches: [{ id: 'BRANCH_A' }],
        topLevelBendLines: [{ index: 1 }],
        impedanceProfiles: [{ id: 'IMP1' }],
        diagnostics: [
            {
                code: 'pcb.layer-stack.unresolved-branch-substack',
                severity: 'warning'
            }
        ]
    })

    assert.deepEqual(report, {
        schema: 'altium-toolkit.pcb.layer-stack-fidelity.a1',
        sourceDocument: 'stack-fidelity.PcbDoc',
        summary: {
            semanticLayerCount: 2,
            nativeCacheFeatureCount: 5,
            interchangeOnlyFeatureCount: 2,
            unsupportedRegenerationCount: 2,
            diagnosticCount: 1
        },
        capabilities: {
            semanticRead: true,
            nativeCacheRead: true,
            interchangeRead: true,
            deterministicReport: true,
            nativeRegeneration: false
        },
        semanticSections: [
            'layers',
            'substacks',
            'branches',
            'impedanceProfiles'
        ],
        nativeCacheSections: [
            'source.registry',
            'source.keys',
            'bendLines',
            'cavities',
            'surfaceFinish'
        ],
        interchangeOnlySections: [
            'layers.stackupxShared',
            'layers.stackupxProperties'
        ],
        unsupportedRegeneration: [
            {
                section: 'native-cache',
                reason: 'Native cache metadata is preserved for review but not regenerated.'
            },
            {
                section: 'diagnostics',
                reason: 'Unresolved references prevent equivalent native regeneration.'
            }
        ],
        diagnostics: [
            {
                code: 'pcb.layer-stack.unresolved-branch-substack',
                severity: 'warning'
            }
        ]
    })
})
