// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import {
    ToolkitContractFixtures,
    runToolkitContract
} from 'circuitjson-toolkit/testing'
import * as sharedToolkit from 'circuitjson-toolkit'
import * as toolkit from '../src/index.mjs'

test('Altium root exposes the exact shared toolkit surface', () => {
    assert.deepEqual(
        Object.keys(toolkit).sort(),
        Object.keys(sharedToolkit).sort()
    )
})

test('Altium package passes the shared observable toolkit contract', async () => {
    const report = await runToolkitContract(toolkit, {
        fixtures: ToolkitContractFixtures.altium()
    })

    assert.equal(report.schema, 'ecad-toolkit.contract-report.v1')
    assert.deepEqual(report.failures, [])
    assert.equal(
        report.checks.every((row) => row.status === 'passed'),
        true
    )
})
