// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbSpecialStringResolver } from '../../src/core/altium/PcbSpecialStringResolver.mjs'

/**
 * Verifies parameter-backed PCB special strings preserve authored text and
 * expose deterministic resolved text.
 */
test('PcbSpecialStringResolver resolves project parameter expressions', () => {
    const resolved = PcbSpecialStringResolver.resolveText(
        '.Title + " / " + .Revision',
        {
            Title: 'Fixture Board',
            Revision: 'A2'
        }
    )

    assert.deepEqual(resolved, {
        rawText: '.Title + " / " + .Revision',
        resolvedText: 'Fixture Board / A2',
        parameterNames: ['Title', 'Revision'],
        expressionParts: [
            { type: 'parameter', name: 'Title', value: 'Fixture Board' },
            { type: 'literal', value: ' / ' },
            { type: 'parameter', name: 'Revision', value: 'A2' }
        ]
    })
})

/**
 * Verifies unresolved parameter references remain visible instead of being
 * erased.
 */
test('PcbSpecialStringResolver preserves unknown special string segments', () => {
    const resolved = PcbSpecialStringResolver.resolveText(
        '.Known + "-" + .Missing',
        {
            Known: 'K'
        }
    )

    assert.equal(resolved.resolvedText, 'K-.Missing')
    assert.deepEqual(resolved.parameterNames, ['Known'])
})

/**
 * Verifies text primitive annotation keeps the raw text field stable.
 */
test('PcbSpecialStringResolver annotates PCB text primitives without replacing text', () => {
    const texts = PcbSpecialStringResolver.annotateTexts(
        [{ text: '.VariantName' }, { text: 'Plain label' }],
        {
            VariantName: 'Assembly B'
        }
    )

    assert.deepEqual(texts, [
        {
            text: '.VariantName',
            rawText: '.VariantName',
            resolvedText: 'Assembly B',
            specialString: {
                parameterNames: ['VariantName'],
                expressionParts: [
                    {
                        type: 'parameter',
                        name: 'VariantName',
                        value: 'Assembly B'
                    }
                ]
            }
        },
        { text: 'Plain label' }
    ])
})
