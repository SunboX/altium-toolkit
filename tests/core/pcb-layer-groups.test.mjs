// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies public PCB layer group predicates classify standard Altium layer
 * identifiers for parser and renderer consumers.
 */
test('PcbLayerGroups classifies common PCB layer IDs', async () => {
    const { PcbLayerGroups } = await import('../../src/parser.mjs')

    assert.equal(typeof PcbLayerGroups, 'function')
    assert.equal(PcbLayerGroups.isTopCopper(1), true)
    assert.equal(PcbLayerGroups.isBottomCopper(32), true)
    assert.equal(PcbLayerGroups.isMidCopper(2), true)
    assert.equal(PcbLayerGroups.isCopper(31), true)
    assert.equal(PcbLayerGroups.isInternalPlane(39), true)
    assert.equal(PcbLayerGroups.isOverlay(33), true)
    assert.equal(PcbLayerGroups.isPaste(35), true)
    assert.equal(PcbLayerGroups.isSolderMask(37), true)
    assert.equal(PcbLayerGroups.isMechanical(57), true)
    assert.equal(PcbLayerGroups.isKeepout(56), true)
    assert.equal(PcbLayerGroups.isDrill(55), true)
    assert.equal(PcbLayerGroups.isMultiLayer(74), true)
})

/**
 * Verifies higher-level grouping is deterministic and useful for reports.
 */
test('PcbLayerGroups resolves stable group names and signal-or-silk visibility', async () => {
    const { PcbLayerGroups } = await import('../../src/parser.mjs')

    assert.deepEqual(
        [1, 2, 32, 33, 35, 37, 39, 55, 56, 57, 73, 74, 81, 82, 999].map(
            (layerId) => PcbLayerGroups.groupForLayerId(layerId)
        ),
        [
            'top-copper',
            'mid-copper',
            'bottom-copper',
            'overlay',
            'paste',
            'solder-mask',
            'internal-plane',
            'drill',
            'keepout',
            'mechanical',
            'drill',
            'multi-layer',
            'drill-hole',
            'drill-hole',
            'unknown'
        ]
    )
    assert.equal(PcbLayerGroups.isSignalOrSilk(1), true)
    assert.equal(PcbLayerGroups.isSignalOrSilk(39), true)
    assert.equal(PcbLayerGroups.isSignalOrSilk(33), true)
    assert.equal(PcbLayerGroups.isSignalOrSilk(74), true)
    assert.equal(PcbLayerGroups.isSignalOrSilk(35), false)
    assert.equal(PcbLayerGroups.isSignalOrSilk(57), false)
    assert.deepEqual(PcbLayerGroups.describeLayer(33), {
        layerId: 33,
        group: 'overlay',
        side: 'top',
        signalOrSilk: true
    })
})

/**
 * Verifies report and renderer consumers can use deterministic layer
 * presentation metadata without duplicating palette or draw-order tables.
 */
test('PcbLayerGroups resolves deterministic presentation metadata', async () => {
    const { PcbLayerGroups } = await import('../../src/parser.mjs')

    assert.equal(PcbLayerGroups.colorForLayerId(1), '#c05032')
    assert.equal(PcbLayerGroups.colorForLayerId(32), '#2f6f9f')
    assert.equal(PcbLayerGroups.colorForLayerId(57), '#7f8c8d')
    assert.equal(PcbLayerGroups.colorForLayerId(999), '#9aa0a6')
    assert.equal(PcbLayerGroups.drawPriorityForLayerId(1), 600)
    assert.equal(PcbLayerGroups.drawPriorityForLayerId(33), 900)
    assert.deepEqual(PcbLayerGroups.presentationForLayerId(37), {
        layerId: 37,
        group: 'solder-mask',
        side: 'top',
        signalOrSilk: false,
        color: '#2ca25f',
        drawPriority: 700
    })
    assert.deepEqual(
        PcbLayerGroups.sortByDrawPriority([33, 1, 57, 32]),
        [57, 32, 1, 33]
    )
})
