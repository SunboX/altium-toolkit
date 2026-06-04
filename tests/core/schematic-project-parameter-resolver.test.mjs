// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { SchematicProjectParameterResolver } from '../../src/core/altium/SchematicProjectParameterResolver.mjs'

/**
 * Verifies schematic project parameters resolve through the same expression
 * forms used by visible schematic fields and title-block strings.
 */
test('SchematicProjectParameterResolver resolves schematic special strings', () => {
    const resolved = SchematicProjectParameterResolver.resolveText(
        '.ProjectName + " / " + .Revision + " " + =DocumentNumber',
        {
            ProjectName: 'RUNE BOARD',
            Revision: 'B2',
            DocumentNumber: 'DOC-42'
        }
    )

    assert.deepEqual(resolved, {
        rawText: '.ProjectName + " / " + .Revision + " " + =DocumentNumber',
        resolvedText: 'RUNE BOARD / B2 DOC-42',
        parameterNames: ['ProjectName', 'Revision', 'DocumentNumber'],
        expressionParts: [
            { kind: 'parameter', name: 'ProjectName', value: 'RUNE BOARD' },
            { kind: 'literal', value: ' / ' },
            { kind: 'parameter', name: 'Revision', value: 'B2' },
            { kind: 'literal', value: ' ' },
            { kind: 'parameter', name: 'DocumentNumber', value: 'DOC-42' }
        ]
    })
})

/**
 * Verifies project parameter resolution can annotate a schematic model without
 * mutating the caller-owned object.
 */
test('SchematicProjectParameterResolver annotates schematic text and title block', () => {
    const schematic = {
        texts: [{ text: '.ProjectTitle', x: 10, y: 20 }],
        sheet: {
            titleBlock: {
                title: '.ProjectTitle',
                documentNumber: '=DocumentNumber'
            }
        }
    }

    const resolved = SchematicProjectParameterResolver.applyToSchematic(
        schematic,
        {
            ProjectTitle: 'FROST MODULE',
            DocumentNumber: 'DWG-9'
        }
    )

    assert.equal(schematic.texts[0].resolvedText, undefined)
    assert.equal(resolved.texts[0].text, '.ProjectTitle')
    assert.equal(resolved.texts[0].resolvedText, 'FROST MODULE')
    assert.equal(resolved.texts[0].rawText, '.ProjectTitle')
    assert.equal(resolved.sheet.titleBlock.title, '.ProjectTitle')
    assert.equal(
        resolved.sheet.titleBlock.specialStrings.title.resolvedText,
        'FROST MODULE'
    )
    assert.equal(
        resolved.sheet.titleBlock.specialStrings.documentNumber.resolvedText,
        'DWG-9'
    )
})
