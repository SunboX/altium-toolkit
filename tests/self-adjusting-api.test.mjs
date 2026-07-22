import assert from 'node:assert/strict'
import test from 'node:test'

import { SelfAdjustingComputation as CanonicalRuntime } from 'circuitjson-toolkit'
import { SelfAdjustingComputation } from '../src/index.mjs'

test('root API re-exports the canonical self-adjusting runtime', () => {
    assert.equal(SelfAdjustingComputation, CanonicalRuntime)
})
