// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionIndex } from '../../src/ui/PcbInteractionIndex.mjs'

/**
 * Creates synthetic component rows and pad/text ownership queries.
 * @param {unknown[]} owners Explicit component identities.
 * @param {unknown[]} queries Primitive component references.
 * @returns {object}
 */
function createDocument(owners, queries) {
    return {
        pcb: {
            components: owners.map((componentIndex, index) => ({
                componentIndex,
                designator: `X${index + 1}`,
                x: index * 100,
                y: 0
            })),
            pads: queries.map((componentIndex) => ({
                componentIndex,
                x: 0,
                y: 0,
                width: 10,
                height: 10
            })),
            texts: queries.map((componentIndex) => ({
                componentIndex,
                x: 0,
                y: 0,
                text: 'X',
                height: 10
            }))
        }
    }
}

/**
 * Returns ownership labels in source order for each primitive group.
 * @param {object} document Source model.
 * @returns {string[][]}
 */
function primitiveOwners(document) {
    const items = PcbInteractionIndex.build(document)
    return ['pad', 'text'].map((type) =>
        items
            .filter((item) => item.type === type)
            .map((item) => item.componentKey)
    )
}

test('interaction ownership retains first explicit matches before positional fallback', () => {
    const document = createDocument(
        [9, '9', undefined, 3.5, 'invalid', -7, null],
        [9, '9', 0, null, '', false, 1, true, 2, 3, 4, 6, -7, -1, 8]
    )
    const expected = [
        'X1',
        'X1',
        'X7',
        'X7',
        'X7',
        'X7',
        'X2',
        'X2',
        'X3',
        'X4',
        'X5',
        'X7',
        'X6',
        '',
        ''
    ]

    assert.deepEqual(primitiveOwners(document), [expected, expected])
})

test('interaction ownership ignores noninteger and nonnumeric primitive references', () => {
    const document = createDocument(
        [NaN, Infinity, 1.5, 'invalid', 5],
        [undefined, NaN, Infinity, -Infinity, 1.5, 'invalid']
    )

    assert.deepEqual(primitiveOwners(document), [
        ['', '', '', '', '', ''],
        ['', '', '', '', '', '']
    ])
})

test('interaction ownership retains numeric coercion of zero and one identities', () => {
    const document = createDocument(
        [false, '', null, true, '1', -0],
        [0, -0, null, undefined, '', false, 1, '1', true, 5]
    )
    const expected = ['X1', 'X1', 'X1', '', 'X1', 'X1', 'X4', 'X4', 'X4', 'X6']

    assert.deepEqual(primitiveOwners(document), [expected, expected])
})

test('interaction positional fallback only resolves component array positions', () => {
    const document = createDocument([20], [-1, 50, 0])
    document.pcb.components[-1] = { designator: 'FAKE_OUTSIDE' }

    assert.deepEqual(primitiveOwners(document), [
        ['', '', 'X1'],
        ['', '', 'X1']
    ])
})

test('interaction ownership reflects component edits on the next build', () => {
    const document = createDocument([7, 8], [7, 8, 2])
    assert.deepEqual(primitiveOwners(document), [
        ['X1', 'X2', ''],
        ['X1', 'X2', '']
    ])
    document.pcb.components[0].componentIndex = 8
    document.pcb.components[1].componentIndex = 7
    document.pcb.components.push({ componentIndex: 2, designator: 'X3' })

    assert.deepEqual(primitiveOwners(document), [
        ['X2', 'X1', 'X3'],
        ['X2', 'X1', 'X3']
    ])
})

test('interaction ownership reads component identities in proportion to component count', () => {
    const owners = Array.from({ length: 40 }, (_, index) => index + 100)
    const queries = owners.flatMap((owner, index) => [owner, index, -1])
    const document = createDocument(owners, queries)
    let identityReads = 0
    for (const component of document.pcb.components) {
        const owner = component.componentIndex
        Object.defineProperty(component, 'componentIndex', {
            enumerable: true,
            /** Returns the owner while tracking identity traversal. */
            get() {
                identityReads += 1
                return owner
            }
        })
    }
    const [pads, texts] = primitiveOwners(document)

    assert.deepEqual(pads.slice(0, 6), ['X1', 'X1', '', 'X2', 'X2', ''])
    assert.deepEqual(texts, pads)
    assert.ok(
        identityReads <= owners.length * 2,
        `expected bounded component identity reads, observed ${identityReads}`
    )
})

test('interaction visibility normalizes each hidden filter once per hit test', () => {
    const document = createDocument([1, 2], Array(30).fill(1))
    document.pcb.pads.forEach((pad) => {
        pad.layer = 'Top Layer'
    })
    const items = PcbInteractionIndex.build(document)
    let filterReads = 0
    const options = {
        hiddenObjects: [
            {
                /** Coerces a hidden object key while tracking normalization. */
                toString() {
                    filterReads += 1
                    return 'components'
                }
            }
        ],
        hiddenLayers: [
            {
                /** Coerces a hidden layer key while tracking normalization. */
                toString() {
                    filterReads += 1
                    return 'Top Layer'
                }
            }
        ]
    }
    const hits = PcbInteractionIndex.hitTestItems(
        items,
        { x: 0, y: 0 },
        options
    )

    assert.equal(hits.length, 30)
    assert.ok(hits.every((item) => item.type === 'text'))
    assert.ok(
        filterReads <= 2,
        `expected two filter reads, observed ${filterReads}`
    )
    options.hiddenObjects.splice(0, 1, 'footprint-text')
    options.hiddenLayers.length = 0

    const updated = PcbInteractionIndex.hitTestItems(
        items,
        { x: 0, y: 0 },
        options
    )
    assert.equal(updated.length, 31)
    assert.equal(updated[0].type, 'pad')
    assert.equal(updated.at(-1).type, 'component')
})
