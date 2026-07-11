// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbLayerStackQueryHelper } from '../../src/legacy-parser.mjs'

test('PcbLayerStackQueryHelper resolves source refs, region joins, and branch refs', () => {
    const readModel = {
        layers: [
            { layerId: 1, layerKey: 'L1', name: 'Top Layer' },
            { layerId: 2, layerKey: 'L2', name: 'Core' },
            { layerId: 32, layerKey: 'L32', name: 'Bottom Layer' }
        ],
        substacks: [
            {
                id: 'STACK_A',
                name: 'Rigid',
                layerIds: [1, 2, 32],
                boardRegionIndexes: [0],
                boardRegionNames: ['Rigid Region']
            },
            {
                id: '{STACK_B}',
                name: 'Flex',
                layerIds: [1, 32],
                boardRegionIndexes: [1],
                boardRegionNames: ['Flex Region']
            }
        ],
        boardRegions: [
            {
                index: 0,
                name: 'Rigid Region',
                layerStackId: '{STACK_A}'
            },
            {
                index: 1,
                name: 'Flex Region',
                layerStackId: 'STACK_B'
            }
        ],
        branches: [
            {
                id: 'BRANCH_A',
                rootStackRef: '{STACK_A}',
                stackRefs: ['STACK_B']
            }
        ]
    }

    assert.equal(
        PcbLayerStackQueryHelper.substackBySourceRef(readModel, '{stack-a}')
            .name,
        'Rigid'
    )
    assert.deepEqual(
        PcbLayerStackQueryHelper.layersForSubstack(readModel, 'STACK_B').map(
            (layer) => layer.layerKey
        ),
        ['L1', 'L32']
    )
    assert.deepEqual(
        PcbLayerStackQueryHelper.boardRegionsForLayerStackId(
            readModel,
            'stack_a'
        ),
        [
            {
                index: 0,
                name: 'Rigid Region',
                layerStackId: '{STACK_A}'
            }
        ]
    )
    assert.deepEqual(
        PcbLayerStackQueryHelper.layersForBoardRegion(readModel, {
            layerStackId: 'STACK_A'
        }).map((layer) => layer.name),
        ['Top Layer', 'Core', 'Bottom Layer']
    )
    assert.deepEqual(
        PcbLayerStackQueryHelper.branchesForStackRef(readModel, '{stack-b}'),
        [
            {
                id: 'BRANCH_A',
                rootStackRef: '{STACK_A}',
                stackRefs: ['STACK_B']
            }
        ]
    )
})
