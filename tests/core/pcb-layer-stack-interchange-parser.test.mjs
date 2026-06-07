// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbLayerStackInterchangeParser } from '../../src/parser.mjs'

test('PcbLayerStackInterchangeParser reads synthetic stackup text', () => {
    const model = PcbLayerStackInterchangeParser.parseText(
        'fixture.stackup',
        `[Layer1]
Name=Top Layer
LayerId=1
Kind=signal
Material=Copper
CopperThickness=1.4mil
SurfaceFinish=ENIG

[Layer2]
Name=Flex Core
LayerId=2
Kind=dielectric
Material=Polyimide
Thickness=2mil
Dk=3.4
Df=0.004
IsAdhesive=true

[Substack0]
Id={MAIN}
Name=Main Stack
IsFlex=false
Layers=1,2

[ImpedanceProfile0]
Id={Z0}
Name=Single 50
TargetImpedance=50
Tolerance=10%

[TransmissionLine0]
Id={TL0}
Name=Top Trace
ProfileId={Z0}
LayerId=1
Width=5mil
Gap=6mil

[ViaSpan0]
Id={VS0}
Name=Through
StartLayer=1
EndLayer=2
`
    )

    assert.equal(model.schema, 'altium-toolkit.pcb.layer-stack.a1')
    assert.deepEqual(model.source, {
        fileName: 'fixture.stackup',
        nativeStreams: [],
        hasNativeBoardData: false,
        hasBoardRegionsData: false,
        interchangeFormat: 'stackup'
    })
    assert.deepEqual(model.summary, {
        layerCount: 2,
        substackCount: 1,
        boardRegionCount: 0,
        branchCount: 0,
        impedanceProfileCount: 1,
        transmissionLineCount: 1,
        viaSpanCount: 1,
        backdrillSpanCount: 0,
        topLevelBendLineCount: 0,
        cavityRegionCount: 0,
        stiffenerLayerCount: 0,
        adhesiveLayerCount: 1,
        diagnosticCount: 0
    })
    assert.deepEqual(model.layers, [
        {
            index: 1,
            layerId: 1,
            layerKey: 'L1',
            name: 'Top Layer',
            kind: 'signal',
            material: 'Copper',
            copperThicknessMil: 1.4,
            surfaceFinish: 'ENIG'
        },
        {
            index: 2,
            layerId: 2,
            layerKey: 'L2',
            name: 'Flex Core',
            kind: 'dielectric',
            material: 'Polyimide',
            thicknessMil: 2,
            dielectricConstant: 3.4,
            dissipationFactor: 0.004,
            isAdhesive: true
        }
    ])
    assert.deepEqual(model.substacks, [
        {
            index: 0,
            id: '{MAIN}',
            name: 'Main Stack',
            isFlex: false,
            layerIds: [1, 2],
            layerKeys: ['L1', 'L2'],
            boardRegionIndexes: [],
            boardRegionNames: [],
            bendingLineCount: 0
        }
    ])
})

test('PcbLayerStackInterchangeParser reads synthetic stackupx XML', () => {
    const model = PcbLayerStackInterchangeParser.parseText(
        'fixture.stackupx',
        `<LayerStack>
    <Layer Index="1" Name="Top Layer" LayerId="1" Kind="signal" SourceRecordId="{L1}" SourceKeys="Stack;Layer1" StackupxProperties="Process=Etch|Material=Copper" />
    <Layer Index="2" Name="Stiffener" LayerId="90" Kind="mechanical" IsStiffener="true" />
    <Substack Index="0" Id="{MAIN}" Name="Main Stack" IsFlex="false" Layers="1,2" StackType="Rigid" />
    <Branch Index="0" Id="{BRANCH}" Name="Branch">
        <Section Index="0" Id="{SEC}" Name="Entry" ParentId="{ROOT}">
            <Stack Index="0" Ref="{MAIN}" MaterialUsage="base" IntrusionLeftBottom="4mil" IntrusionRightTop="7mil" />
        </Section>
    </Branch>
    <BackdrillSpan Index="0" Id="{BD}" Name="Backdrill" StartLayer="90" EndLayer="1" TargetStub="9mil" />
</LayerStack>`
    )

    assert.equal(model.source.interchangeFormat, 'stackupx')
    assert.deepEqual(model.sourceMap, {
        registryEntryCount: 0,
        sourceKeyCount: 2,
        topLevelBendLineCount: 0,
        cavityRegionCount: 0,
        stiffenerLayerCount: 1,
        adhesiveLayerCount: 0,
        surfaceFinishCount: 0
    })
    assert.deepEqual(model.branches, [
        {
            index: 0,
            id: '{BRANCH}',
            name: 'Branch',
            stackRefs: [],
            sections: [
                {
                    index: 0,
                    id: '{SEC}',
                    name: 'Entry',
                    parentSectionId: '{ROOT}',
                    stacks: [
                        {
                            index: 0,
                            stackRef: '{MAIN}',
                            materialUsage: 'base',
                            intrusionLeftBottom: '4mil',
                            intrusionRightTop: '7mil'
                        }
                    ]
                }
            ]
        }
    ])
    assert.deepEqual(model.backdrillSpans, [
        {
            index: 0,
            id: '{BD}',
            name: 'Backdrill',
            startLayerId: 90,
            startLayerKey: 'L90',
            endLayerId: 1,
            endLayerKey: 'L1',
            targetStubMil: 9
        }
    ])
})
