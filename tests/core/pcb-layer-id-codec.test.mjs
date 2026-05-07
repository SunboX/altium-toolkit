// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbLayerIdCodec } from '../../src/core/altium/PcbLayerIdCodec.mjs'

/**
 * Verifies V7 saved-layer ids decode into legacy PCB layer ids.
 */
test('PcbLayerIdCodec decodes V7 saved layer ids', () => {
    assert.equal(PcbLayerIdCodec.legacyLayerIdFromV7SaveId(0x01000001), 1)
    assert.equal(PcbLayerIdCodec.legacyLayerIdFromV7SaveId(0x0100ffff), 32)
    assert.equal(PcbLayerIdCodec.legacyLayerIdFromV7SaveId(0x01030006), 33)
    assert.equal(PcbLayerIdCodec.legacyLayerIdFromV7SaveId(0x0103000f), 74)
    assert.equal(PcbLayerIdCodec.legacyLayerIdFromV7SaveId(0), null)
})

/**
 * Verifies legacy PCB layer ids encode into V7 saved-layer ids.
 */
test('PcbLayerIdCodec encodes legacy layer ids as V7 saved layer ids', () => {
    assert.equal(PcbLayerIdCodec.v7SaveIdFromLegacyLayerId(1), 0x01000001)
    assert.equal(PcbLayerIdCodec.v7SaveIdFromLegacyLayerId(32), 0x0100ffff)
    assert.equal(PcbLayerIdCodec.v7SaveIdFromLegacyLayerId(33), 0x01030006)
    assert.equal(PcbLayerIdCodec.v7SaveIdFromLegacyLayerId(74), 0x0103000f)
    assert.equal(PcbLayerIdCodec.v7SaveIdFromLegacyLayerId(null), null)
})
