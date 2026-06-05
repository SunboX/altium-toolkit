// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    PrjPcbModelParser,
    ProjectDocumentGraphBuilder
} from '../../src/parser.mjs'

/**
 * Encodes project text into an ArrayBuffer.
 * @param {string} text Project text.
 * @returns {ArrayBuffer}
 */
function encodeProject(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

/**
 * Creates a synthetic project with source, library, harness, and output rows.
 * @returns {object}
 */
function createProjectModel() {
    return PrjPcbModelParser.parse(
        'graph-check.PrjPcb',
        encodeProject(`[Design]
OutputPath=Generated Outputs

[Document1]
DocumentPath=Source\\Main.SchDoc
DocumentUniqueId=SCH-1

[Document2]
DocumentPath=Board.PcbDoc
DocumentUniqueId=PCB-1

[Document3]
DocumentPath=Libraries\\Symbols.SchLib
DocumentUniqueId=SCHLIB-1

[Document4]
DocumentPath=Libraries\\Footprints.PcbLib
DocumentUniqueId=PCBLIB-1

[Document5]
DocumentPath=Libraries\\Bundle.IntLib
DocumentUniqueId=INTLIB-1

[Document6]
DocumentPath=Signals.Harness
DocumentUniqueId=HAR-1

[Document7]
DocumentPath=Manufacturing.OutJob
DocumentUniqueId=OUT-1

[OutputGroup1]
Name=Review
OutputType1=Pdf
OutputName1=Schematic PDF
OutputDocumentPath1=Source\\Main.SchDoc
OutputTargetPath1=Generated Outputs\\Main.pdf
OutputType2=PickPlace
OutputName2=Pick Place
OutputDocumentPath2=Board.PcbDoc
OutputTargetPath2=Generated Outputs\\Board.csv
`)
    )
}

test('PrjPcbModelParser exposes a normalized project document graph', () => {
    const model = createProjectModel()

    assert.equal(
        model.project.documentGraph.schema,
        'altium-toolkit.project.document-graph.a1'
    )
    assert.equal(model.project.documentGraph.summary.documentCount, 7)
    assert.equal(model.project.documentGraph.summary.sourceSheetCount, 1)
    assert.equal(model.project.documentGraph.summary.linkedLibraryCount, 3)
    assert.equal(model.project.documentGraph.summary.harnessFileCount, 1)
    assert.equal(model.project.documentGraph.summary.outJobReferenceCount, 1)
    assert.equal(model.project.documentGraph.summary.generatedOutputCount, 2)
    assert.deepEqual(
        model.project.documentGroups.harnessFiles.map(
            (document) => document.normalizedPath
        ),
        ['Signals.Harness']
    )
    assert.deepEqual(model.project.documentGraph.groups.linkedLibraries, [
        'Libraries/Symbols.SchLib',
        'Libraries/Footprints.PcbLib',
        'Libraries/Bundle.IntLib'
    ])
    assert.deepEqual(model.project.documentGraph.groups.generatedOutputs, [
        'Generated Outputs/Main.pdf',
        'Generated Outputs/Board.csv'
    ])
    assert.deepEqual(
        model.project.documentGraph.indexes.outputsByDocumentPath[
            'Source/Main.SchDoc'
        ].map((output) => output.targetPath),
        ['Generated Outputs/Main.pdf']
    )
})

test('ProjectDocumentGraphBuilder can mark missing project paths without host IO', () => {
    const projectModel = createProjectModel()
    const graph = ProjectDocumentGraphBuilder.build(projectModel.project, {
        availablePaths: ['Source/Main.SchDoc', 'Board.PcbDoc']
    })

    assert.equal(graph.summary.missingPathCount, 5)
    assert.deepEqual(graph.groups.missingPaths, [
        'Libraries/Symbols.SchLib',
        'Libraries/Footprints.PcbLib',
        'Libraries/Bundle.IntLib',
        'Signals.Harness',
        'Manufacturing.OutJob'
    ])
    assert.equal(graph.documents[0].exists, true)
    assert.equal(graph.documents[2].exists, false)
})
