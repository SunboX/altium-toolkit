// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

import { captureExportContract } from '../scripts/capture-api-baseline.mjs'

const APPROVED_PROVENANCE = {
    sourceCommit: '9fa22e1028d96e583275093279bf6e03e8619588',
    sourceTree: '1ddc290f5fc034454c5f33dac4de56b917070174',
    testTree: '00be0165c10e69611c8c571c9befef24b48273ae'
}

/**
 * Reads one repository JSON artifact.
 * @param {string} path Repository-relative artifact path.
 * @returns {Promise<Record<string, any>>} Parsed JSON value.
 */
async function readJson(path) {
    return JSON.parse(
        await readFile(new URL(`../${path}`, import.meta.url), 'utf8')
    )
}

/**
 * Hashes one JSON body using its stable serialized property order.
 * @param {Record<string, any>} value JSON-compatible body.
 * @returns {string} SHA-256 checksum.
 */
function checksum(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

test('Altium 1.1.41 baseline is pinned to the immutable source and test trees', async () => {
    const baseline = await readJson('spec/api-baseline-v1.1.41.json')
    const { artifactChecksum, ...body } = baseline

    assert.equal(baseline.schema, 'altium-toolkit.api-baseline.v1')
    assert.equal(baseline.package, 'altium-toolkit')
    assert.equal(baseline.packageVersion, '1.1.41')
    assert.deepEqual(baseline.provenance, APPROVED_PROVENANCE)
    assert.equal(artifactChecksum, checksum(body))
    assert.deepEqual(
        baseline.entrypoints.map((entrypoint) => [
            entrypoint.entrypoint,
            entrypoint.exports.length
        ]),
        [
            ['.', 161],
            ['./parser', 135],
            ['./netlist-query', 6],
            ['./renderers', 20],
            ['./scene3d', 7]
        ]
    )
})

test('native implementation manifest covers every historical core and UI module', async () => {
    const manifest = await readJson('spec/native-source-manifest-v1.1.41.json')
    const { artifactChecksum, ...body } = manifest

    assert.equal(manifest.schema, 'altium-toolkit.source-manifest.v1')
    assert.deepEqual(manifest.provenance, APPROVED_PROVENANCE)
    assert.equal(artifactChecksum, checksum(body))
    assert.equal(manifest.files.length > 150, true)
    assert.equal(
        manifest.files.every(
            (entry) =>
                /^(?:src\/core|src\/ui)\/.+\.mjs$/u.test(entry.path) &&
                /^[0-9a-f]{64}$/u.test(entry.sha256)
        ),
        true
    )
})

test('legacy worker and stylesheet assets have immutable content contracts', async () => {
    const baseline = await readJson('spec/asset-baseline-v1.1.41.json')
    const { artifactChecksum, ...body } = baseline

    assert.equal(baseline.schema, 'altium-toolkit.asset-baseline.v1')
    assert.deepEqual(baseline.provenance, APPROVED_PROVENANCE)
    assert.equal(artifactChecksum, checksum(body))
    assert.deepEqual(
        baseline.assets.map((asset) => [asset.entrypoint, asset.target]),
        [
            [
                './styles/altium-renderers.css',
                './src/styles/altium-renderers.css'
            ],
            [
                './workers/altium-parser.worker.mjs',
                './src/workers/altium-parser.worker.mjs'
            ]
        ]
    )
    assert.equal(
        baseline.assets.every((asset) => /^[0-9a-f]{64}$/u.test(asset.sha256)),
        true
    )
})

test('preservation ledger maps every frozen feature to a real extension target', async () => {
    const baseline = await readJson('spec/api-baseline-v1.1.41.json')
    const assets = await readJson('spec/asset-baseline-v1.1.41.json')
    const sourceManifest = await readJson(
        'spec/native-source-manifest-v1.1.41.json'
    )
    const ledger = await readJson('spec/feature-preservation.json')
    const features = ledger.map((row) => row.feature)

    assert.equal(ledger.length, 1302)
    assert.equal(new Set(features).size, ledger.length)
    assert.equal(
        ledger.every(
            (row) =>
                row.package === 'altium-toolkit@1.1.41' &&
                row.disposition === 'native-extension' &&
                row.availability['altium-toolkit'] === 'native' &&
                row.replacement.startsWith('altium-toolkit/extensions') &&
                row.evidence.apiArtifactChecksum ===
                    baseline.artifactChecksum &&
                row.evidence.assetArtifactChecksum ===
                    assets.artifactChecksum &&
                row.evidence.sourceManifestChecksum ===
                    sourceManifest.artifactChecksum
        ),
        true
    )
})

test('extension entrypoint preserves every historical export as an exact subset', async () => {
    const baseline = await readJson('spec/api-baseline-v1.1.41.json')
    const extensions = await import('../src/extensions.mjs')
    const expected = new Map()
    for (const entrypoint of baseline.entrypoints) {
        for (const contract of entrypoint.exports) {
            const previous = expected.get(contract.name)
            if (previous) assert.deepEqual(contract, previous)
            else expected.set(contract.name, contract)
        }
    }

    assert.equal(
        [...expected.keys()].every((name) => Object.hasOwn(extensions, name)),
        true
    )
    for (const [name, contract] of expected) {
        assert.deepEqual(
            captureExportContract(name, extensions[name]),
            contract
        )
    }
})

test('generated migration pages remain exhaustive and below the file cap', async () => {
    const ledger = await readJson('spec/feature-preservation.json')
    const directory = new URL('../docs/migration/', import.meta.url)
    const pages = (await readdir(directory))
        .filter((name) => name.endsWith('.md'))
        .sort()
    const contents = await Promise.all(
        pages.map((name) => readFile(new URL(name, directory), 'utf8'))
    )
    const allText = contents.join('\n')

    assert.equal(pages.length > 1, true)
    assert.equal(
        contents.every((content) => content.split('\n').length < 1000),
        true
    )
    assert.equal(
        ledger.every((row) => allText.includes(`| ${row.feature} |`)),
        true
    )
})
