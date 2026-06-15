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

test('PcbLayerStackInterchangeParser reads StackupDocument XML', () => {
    const model = PcbLayerStackInterchangeParser.parseText(
        'fixture.stackupx',
        `<StackupDocument SerializerVersion="1.1.0.0" RevisionId="{REV-A}">
    <FeatureSet>
        <Feature Id="{5277e6a4-9e5f-4f54-951f-dc18cfeb7530}">Localized Feature</Feature>
    </FeatureSet>
    <Stackup Type="Standard" RoughnessType="HuraySnowball" RoughnessFactor="10">
        <Stacks>
            <Stack Id="{STACK-A}" Name="Board Stack" IsFlex="false">
                <Layers>
                    <Layer Id="{LAYER-A}" Name="Top Signal" TypeId="{f4eccd87-2cfb-4f37-be50-4f3a272b4d01}" IsShared="true">
                        <Properties>
                            <Property Name="Material" Type="System.String">Copper</Property>
                            <Property Name="Weight" Type="System.String">1oz</Property>
                        </Properties>
                    </Layer>
                    <Layer Id="{LAYER-B}" Name="Core A" TypeId="{136c62ef-1fa6-4897-ae71-7e797b632b92}">
                        <Properties>
                            <Property Name="Material" Type="System.String">FR-4</Property>
                            <Property Name="Thickness" Type="System.String">58mil</Property>
                            <Property Name="DielectricConstant" Type="System.Double">4.2</Property>
                            <Property Name="LossTangent" Type="System.Double">0.018</Property>
                        </Properties>
                    </Layer>
                </Layers>
            </Stack>
        </Stacks>
    </Stackup>
</StackupDocument>`
    )

    assert.deepEqual(model.stackup, {
        serializerVersion: '1.1.0.0',
        revisionId: '{REV-A}',
        type: 'Standard',
        roughnessType: 'HuraySnowball',
        roughnessFactor: '10',
        features: [
            {
                index: 0,
                id: '{5277e6a4-9e5f-4f54-951f-dc18cfeb7530}',
                name: 'Localized Feature',
                kind: 'rigid-flex'
            }
        ]
    })
    assert.deepEqual(model.layers, [
        {
            index: 1,
            layerId: 1,
            layerKey: 'L1',
            name: 'Top Signal',
            kind: 'signal',
            material: 'Copper',
            copperWeight: '1oz',
            sourceRecordId: '{LAYER-A}',
            stackupxShared: true,
            stackupxProperties: {
                Material: 'Copper',
                Weight: '1oz'
            }
        },
        {
            index: 2,
            layerId: 2,
            layerKey: 'L2',
            name: 'Core A',
            kind: 'dielectric',
            material: 'FR-4',
            thicknessMil: 58,
            dielectricConstant: 4.2,
            dissipationFactor: 0.018,
            sourceRecordId: '{LAYER-B}',
            stackupxProperties: {
                Material: 'FR-4',
                Thickness: '58mil',
                DielectricConstant: '4.2',
                LossTangent: '0.018'
            }
        }
    ])
    assert.deepEqual(model.substacks, [
        {
            index: 0,
            id: '{STACK-A}',
            name: 'Board Stack',
            isFlex: false,
            layerIds: [1, 2],
            layerKeys: ['L1', 'L2'],
            boardRegionIndexes: [],
            boardRegionNames: [],
            bendingLineCount: 0
        }
    ])
})

test('PcbLayerStackInterchangeParser promotes StackupDocument layer properties', () => {
    const model = PcbLayerStackInterchangeParser.parseText(
        'fixture.stackupx',
        `<StackupDocument SerializerVersion="1.1.0.0" RevisionId="{REV-B}">
    <Stackup Type="Standard">
        <Stacks>
            <Stack Id="{STACK-B}" Name="Material Stack">
                <Layers>
                    <Layer Id="{LAYER-C}" Name="Foil A" TypeId="{31e48829-e750-4c28-95e0-1a8313f0158e}">
                        <Properties>
                            <Property Name="Process" Type="System.String">ED</Property>
                            <Property Name="PullbackDistance" Type="System.String">5mil</Property>
                            <Property Name="CopperOrientation" Type="System.String">Above</Property>
                            <Property Name="Orientation" Type="System.String">Top</Property>
                            <Property Name="Note" Type="System.String">Primary foil</Property>
                            <Property Name="Comment" Type="System.String">Checked</Property>
                            <Property Name="Material.Manufacturer" Type="System.String">Maker A</Property>
                            <Property Name="Material.Description" Type="System.String">Copper Foil</Property>
                            <Property Name="Material.GlassTransitionTemp" Type="System.String">180C</Property>
                            <Property Name="GlassTransTemp" Type="System.String">175C</Property>
                            <Property Name="DielectricStrength" Type="System.String">42kV/mm</Property>
                            <Property Name="VolumeResistivity" Type="System.String">1E12Ohm-m</Property>
                            <Property Name="Resin" Type="System.String">48%</Property>
                            <Property Name="Solid" Type="System.String">52%</Property>
                            <Property Name="Material.Frequency" Type="System.String">1GHz</Property>
                            <Property Name="Frequency" Type="System.String">2GHz</Property>
                            <Property Name="Constructions" Type="System.String">1080</Property>
                        </Properties>
                    </Layer>
                </Layers>
            </Stack>
        </Stacks>
    </Stackup>
</StackupDocument>`
    )

    assert.deepEqual(model.layers[0], {
        index: 1,
        layerId: 1,
        layerKey: 'L1',
        name: 'Foil A',
        kind: 'signal',
        sourceRecordId: '{LAYER-C}',
        process: 'ED',
        pullbackDistance: '5mil',
        copperOrientation: 'Above',
        orientation: 'Top',
        note: 'Primary foil',
        comment: 'Checked',
        materialManufacturer: 'Maker A',
        materialDescription: 'Copper Foil',
        materialGlassTransitionTemp: '180C',
        glassTransitionTemp: '175C',
        dielectricStrength: '42kV/mm',
        volumeResistivity: '1E12Ohm-m',
        resin: '48%',
        solid: '52%',
        materialFrequency: '1GHz',
        frequency: '2GHz',
        constructions: '1080',
        stackupxProperties: {
            Process: 'ED',
            PullbackDistance: '5mil',
            CopperOrientation: 'Above',
            Orientation: 'Top',
            Note: 'Primary foil',
            Comment: 'Checked',
            'Material.Manufacturer': 'Maker A',
            'Material.Description': 'Copper Foil',
            'Material.GlassTransitionTemp': '180C',
            GlassTransTemp: '175C',
            DielectricStrength: '42kV/mm',
            VolumeResistivity: '1E12Ohm-m',
            Resin: '48%',
            Solid: '52%',
            'Material.Frequency': '1GHz',
            Frequency: '2GHz',
            Constructions: '1080'
        }
    })
})
