// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { ToolkitCapabilities as SharedCapabilities } from 'circuitjson-toolkit'

import { ToolkitCapabilities } from '../src/convergence/ToolkitCapabilities.mjs'

test('capability inventory keeps common ids and truthful Altium entrypoints', () => {
    const shared = SharedCapabilities.inventory()
    const actual = ToolkitCapabilities.inventory()
    assert.deepEqual(
        actual.map((row) => row.id),
        shared.map((row) => row.id)
    )

    const byId = new Map(actual.map((row) => [row.id, row]))
    assert.equal(byId.get('parse.document').status, 'native')
    assert.equal(byId.get('project.load').status, 'native')
    assert.equal(
        byId.get('worker.parse').entrypoint,
        'altium-toolkit/workers/parser.worker.mjs'
    )
    assert.equal(
        byId.get('export.selected-part').entrypoint,
        'altium-toolkit/extensions'
    )
})

test('capability inventory returns independent clone-safe rows', () => {
    const first = ToolkitCapabilities.inventory()
    first[0].summary = 'mutated'
    const second = ToolkitCapabilities.inventory()
    assert.notEqual(second[0].summary, 'mutated')
    assert.doesNotThrow(() => structuredClone(second))
})
