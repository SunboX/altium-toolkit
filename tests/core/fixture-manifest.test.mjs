// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const MANIFEST_URL = new URL(
    '../fixtures/fixture-manifest.json',
    import.meta.url
)

test('fixture manifest catalogs only repo-owned synthetic coverage targets', async () => {
    const manifest = JSON.parse(await readFile(MANIFEST_URL, 'utf8'))

    assert.equal(manifest.schema, 'altium-toolkit.fixture-manifest.a1')
    assert.equal(manifest.assetPolicy, 'repo-owned-synthetic-only')
    assert.ok(Array.isArray(manifest.fixtures))
    assert.ok(manifest.fixtures.length >= 3)
    assert.ok(
        manifest.fixtures.every(
            (fixture) =>
                fixture.key &&
                fixture.kind &&
                fixture.assetPolicy === 'repo-owned-synthetic-only' &&
                Array.isArray(fixture.coverage) &&
                fixture.coverage.length > 0 &&
                fixture.nativeAsset === false &&
                fixture.source === 'inline-synthetic-records' &&
                fixture.contracts &&
                Array.isArray(fixture.contracts.parser) &&
                Array.isArray(fixture.contracts.svg) &&
                Array.isArray(fixture.contracts.schemas) &&
                Array.isArray(fixture.contracts.diagnostics)
        )
    )
    assert.ok(
        manifest.fixtures.some((fixture) =>
            fixture.coverage.includes('schematic.curves')
        )
    )
    assert.ok(
        manifest.fixtures.some((fixture) =>
            fixture.coverage.includes('pcb.layer-stack-statistics')
        )
    )
    assert.ok(
        manifest.fixtures.some((fixture) =>
            fixture.coverage.includes('library.asset-manifest')
        )
    )
    assert.ok(
        manifest.fixtures.some((fixture) =>
            fixture.contracts.parser.includes('schematic.rounded-rectangles')
        )
    )
    assert.ok(
        manifest.fixtures.some((fixture) =>
            fixture.contracts.svg.includes('schematic.svg.semantics')
        )
    )
})
