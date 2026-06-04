// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'
import { PrjPcbModelParser } from '../../src/core/altium/PrjPcbModelParser.mjs'

/**
 * Encodes one synthetic project file into an ArrayBuffer.
 * @param {string} text
 * @returns {ArrayBuffer}
 */
function encodeProject(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

/**
 * Builds a synthetic project with mixed documents, parameters, variants, and
 * output sections.
 * @returns {string}
 */
function createProjectText() {
    return `\ufeff[Design]
Version=1.0
HierarchyMode=2
CurrentVariant=Assembly B
OutputPath=Generated Outputs

[Document1]
DocumentPath=Main.SchDoc
AnnotationEnabled=1
AnnotateOrder=0
DocumentUniqueId=SCHONE
ClassGenGenerateNetClasses=0
ClassGenGenerateRooms=1

[Document2]
DocumentPath=Boards\\MainBoard.PcbDoc
AnnotationEnabled=1
AnnotateOrder=-1
DocumentUniqueId=PCBONE

[Document3]
DocumentPath=Libraries\\Device.PcbLib
DocumentUniqueId=LIBONE

[Document4]
DocumentPath=Unused.SchDoc
DocumentUniqueId=STUBSCH

[Document5]
DocumentPath=Manufacturing.OutJob
DocumentUniqueId=

[Parameter1]
Name=PROJECT_TITLE
Value=Demo Project

[Parameter2]
Name=PCB_PART_NUMBER
Value=PN-1000

[PrjClassGen]
GenerateNetClasses=1
GenerateComponentClasses=T
GenerateDifferentialPairClasses=True
GenerateRooms=0
ClassNamePrefix=SCH_

[DocumentClassGen1]
DocumentPath=Main.SchDoc
GenerateNetClasses=0
GenerateDifferentialPairClasses=1
TransferRoomDirectives=F

[ProjectVariant1]
UniqueId=VAR-A
Description=Assembly A
AllowFabrication=1
ParameterCount=1
Parameter1=ParameterName=PROJECT_TITLE|VariantValue=Demo Assembly A
VariationCount=1
Variation1=Designator=R1|UniqueId=UID-R1|Kind=1|AlternatePart=
ParamVariationCount=0

[ProjectVariant2]
UniqueId=VAR-B
Description=Assembly B
AllowFabrication=0
ParameterCount=0
VariationCount=1
Variation1=Designator=C2|UniqueId=UID-C2|Kind=0|AlternatePart=ALT-C2
ParamVariationCount=1
ParamDesignator1=U1
ParamVariation1=ParameterName=Comment|VariantValue=MCU_ALT

[Configuration1]
Name=Default Configuration
Variant=[No Variations]

[OutputGroup1]
Name=Fabrication
OutputType1=Gerber
OutputName1=Gerber Files
OutputDocumentPath1=Boards\\MainBoard.PcbDoc
OutputVariantName1=Assembly B
`
}

test('PrjPcbModelParser normalizes project documents, parameters, and variants', () => {
    const model = PrjPcbModelParser.parse(
        'synthetic-project.PrjPcb',
        encodeProject(createProjectText())
    )

    assert.equal(model.kind, 'project')
    assert.equal(model.fileType, 'PrjPcb')
    assert.equal(model.summary.documentCount, 5)
    assert.equal(model.summary.schematicCount, 2)
    assert.equal(model.summary.reachableSchematicCount, 1)
    assert.equal(model.summary.pcbCount, 1)
    assert.equal(model.summary.pcbLibraryCount, 1)
    assert.equal(model.summary.outJobCount, 1)
    assert.equal(model.summary.variantCount, 2)
    assert.equal(model.summary.parameterCount, 2)
    assert.equal(model.summary.currentVariant, 'Assembly B')

    assert.deepEqual(
        model.project.documentGroups.reachableSchematics.map(
            (document) => document.path
        ),
        ['Main.SchDoc']
    )
    assert.deepEqual(
        model.project.documentGroups.schematics.map(
            (document) => document.path
        ),
        ['Main.SchDoc', 'Unused.SchDoc']
    )
    assert.deepEqual(
        model.project.documentGroups.pcbs.map((document) => document.path),
        ['Boards\\MainBoard.PcbDoc']
    )
    assert.equal(
        model.project.documents[1].normalizedPath,
        'Boards/MainBoard.PcbDoc'
    )
    assert.equal(model.project.documents[2].kind, 'pcb-library')
    assert.equal(model.project.documents[3].isStub, true)
    assert.deepEqual(model.project.classGeneration.policies, {
        generateNetClasses: true,
        generateComponentClasses: true,
        generateDifferentialPairClasses: true,
        generateRooms: false
    })
    assert.deepEqual(model.project.classGeneration.documents, [
        {
            index: 1,
            section: 'DocumentClassGen1',
            documentIndex: 1,
            documentPath: 'Main.SchDoc',
            normalizedPath: 'Main.SchDoc',
            policies: {
                generateNetClasses: false,
                generateDifferentialPairClasses: true,
                transferRoomDirectives: false
            },
            options: {
                DocumentPath: 'Main.SchDoc',
                GenerateNetClasses: '0',
                GenerateDifferentialPairClasses: '1',
                TransferRoomDirectives: 'F'
            }
        }
    ])
    assert.deepEqual(model.project.documents[0].classGeneration.policies, {
        generateNetClasses: false,
        generateRooms: true,
        generateDifferentialPairClasses: true,
        transferRoomDirectives: false
    })

    assert.equal(model.project.parameters.map.PROJECT_TITLE, 'Demo Project')
    assert.equal(model.project.parameters.map.PCB_PART_NUMBER, 'PN-1000')
    assert.equal(model.project.design.HierarchyMode, '2')

    assert.equal(model.project.variants.length, 2)
    assert.equal(model.project.variants[0].description, 'Assembly A')
    assert.equal(model.project.variants[0].allowFabrication, true)
    assert.deepEqual(model.project.variants[0].dnp, ['R1'])
    assert.deepEqual(model.project.variants[0].parameters, [
        {
            ParameterName: 'PROJECT_TITLE',
            VariantValue: 'Demo Assembly A'
        }
    ])
    assert.equal(model.project.variants[1].isCurrent, true)
    assert.deepEqual(model.project.variants[1].parameterOverrides, {
        U1: {
            Comment: 'MCU_ALT'
        }
    })

    assert.equal(model.project.outputGroups[0].name, 'Fabrication')
    assert.deepEqual(model.project.outputGroups[0].outputs, [
        {
            index: 1,
            type: 'Gerber',
            name: 'Gerber Files',
            documentPath: 'Boards\\MainBoard.PcbDoc',
            variantName: 'Assembly B',
            isDefault: false
        }
    ])
    assert.deepEqual(model.project.outJobDigest, {
        schema: 'altium-toolkit.project.outjob-digest.a1',
        summary: {
            outJobDocumentCount: 1,
            outputGroupCount: 1,
            outputCount: 1
        },
        documents: [
            {
                documentIndex: 5,
                path: 'Manufacturing.OutJob',
                normalizedPath: 'Manufacturing.OutJob',
                fileName: 'Manufacturing.OutJob'
            }
        ],
        outputGroups: [
            {
                index: 1,
                name: 'Fabrication',
                outputCount: 1,
                outputs: [
                    {
                        index: 1,
                        type: 'Gerber',
                        name: 'Gerber Files',
                        documentPath: 'Boards\\MainBoard.PcbDoc',
                        normalizedDocumentPath: 'Boards/MainBoard.PcbDoc',
                        variantName: 'Assembly B',
                        isDefault: false
                    }
                ]
            }
        ],
        outputsByDocumentPath: {
            'Boards/MainBoard.PcbDoc': [
                {
                    outputGroupName: 'Fabrication',
                    outputGroupIndex: 1,
                    outputIndex: 1,
                    type: 'Gerber',
                    name: 'Gerber Files',
                    variantName: 'Assembly B',
                    isDefault: false
                }
            ]
        }
    })
    assert.equal(model.bom.length, 0)
})

test('AltiumParser routes PrjPcb buffers into project models', () => {
    const model = AltiumParser.parseArrayBuffer(
        'synthetic-project.PrjPcb',
        encodeProject(createProjectText())
    )

    assert.equal(model.kind, 'project')
    assert.equal(model.fileType, 'PrjPcb')
    assert.equal(model.project.name, 'synthetic-project')
    assert.equal(model.project.documents[0].path, 'Main.SchDoc')
})
