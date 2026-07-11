// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser, PrjScrModelParser } from '../../src/legacy-parser.mjs'

/**
 * Encodes one script-project text payload.
 * @param {string} text Source text.
 * @returns {ArrayBuffer}
 */
function encodeText(text) {
    const bytes = new TextEncoder().encode(text)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

/**
 * Builds a synthetic script project.
 * @returns {string}
 */
function createScriptProjectText() {
    return `[Design]
Version=1.0
HierarchyMode=0
OutputPath=Scripts

[Document1]
DocumentPath=Scripts\\AuditOne.pas
AnnotationEnabled=1
ClassGenCCAutoEnabled=1
ClassGenNCAutoScope=None
DocumentUniqueId=SCRIPT-A

[Document2]
DocumentPath=Missing\\AuditTwo.pas
AnnotationEnabled=0
DoLibraryUpdate=1
DoDatabaseUpdate=0

[Document3]
DocumentPath=Notes.txt
`
}

test('PrjScrModelParser exposes a read-only script-project digest', () => {
    const model = PrjScrModelParser.parseText(
        'script-project.PrjScr',
        createScriptProjectText(),
        {
            existingPaths: ['Scripts/AuditOne.pas']
        }
    )

    assert.equal(model.kind, 'project-script')
    assert.equal(model.fileType, 'PrjScr')
    assert.deepEqual(model.summary, {
        title: 'script-project',
        documentCount: 3,
        scriptCount: 2,
        missingPathCount: 1,
        diagnosticCount: 2
    })
    assert.deepEqual(model.projectScript.scripts, [
        {
            index: 1,
            section: 'Document1',
            path: 'Scripts\\AuditOne.pas',
            normalizedPath: 'Scripts/AuditOne.pas',
            fileName: 'AuditOne.pas',
            extension: '.pas',
            exists: true,
            annotationEnabled: true,
            classGeneration: {
                classGenCcAutoEnabled: true,
                classGenNcAutoScope: 'None'
            },
            options: {
                DocumentPath: 'Scripts\\AuditOne.pas',
                AnnotationEnabled: '1',
                ClassGenCCAutoEnabled: '1',
                ClassGenNCAutoScope: 'None',
                DocumentUniqueId: 'SCRIPT-A'
            }
        },
        {
            index: 2,
            section: 'Document2',
            path: 'Missing\\AuditTwo.pas',
            normalizedPath: 'Missing/AuditTwo.pas',
            fileName: 'AuditTwo.pas',
            extension: '.pas',
            exists: false,
            annotationEnabled: false,
            updatePolicies: {
                doLibraryUpdate: true,
                doDatabaseUpdate: false
            },
            options: {
                DocumentPath: 'Missing\\AuditTwo.pas',
                AnnotationEnabled: '0',
                DoLibraryUpdate: '1',
                DoDatabaseUpdate: '0'
            }
        }
    ])
    assert.deepEqual(
        model.diagnostics.map((diagnostic) => diagnostic.code),
        [
            'project-script.missing-document-path',
            'project-script.unsupported-document-kind'
        ]
    )
})

test('AltiumParser routes PrjScr buffers into script-project models', () => {
    const model = AltiumParser.parseArrayBufferToRendererModel(
        'script-project.PrjScr',
        encodeText(createScriptProjectText())
    )

    assert.equal(model.kind, 'project-script')
    assert.equal(model.projectScript.scripts.length, 2)
})
