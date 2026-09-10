// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { AltiumCandidateSourceVerifier } from '../scripts/AltiumCandidateSourceVerifier.mjs'
import { checkFeaturePreservation } from '../scripts/check-feature-preservation.mjs'

test('feature preservation accepts maintained implementations with historical APIs', async () => {
    await assert.doesNotReject(async () => {
        const report = await checkFeaturePreservation()
        assert.equal(report.featureCount, 1302)
        assert.equal(report.legacyExportCount, 167)
        assert.equal(report.strict, false)
    })
})

/**
 * Creates an independent source/package pair containing a maintained helper.
 * @param {import('node:test').TestContext} t Test cleanup owner.
 * @returns {Promise<{ source: string, packed: string, historical: object }>}
 */
async function fixture(t) {
    const root = await mkdtemp(join(tmpdir(), 'altium-source-candidate-'))
    t.after(() => rm(root, { recursive: true, force: true }))
    const source = join(root, 'source')
    const packed = join(root, 'packed')
    await mkdir(join(source, 'src', 'core'), { recursive: true })
    await mkdir(join(source, 'src', 'helpers'), { recursive: true })
    await writeFile(
        join(source, 'src/core/Record.mjs'),
        'export const value = 2\n'
    )
    await writeFile(
        join(source, 'src/helpers/Geometry.mjs'),
        'export const size = 3\n'
    )
    await cp(source, packed, { recursive: true })
    return {
        source,
        packed,
        historical: {
            files: [{ path: 'src/core/Record.mjs', sha256: 'historical-bytes' }]
        }
    }
}

test('candidate snapshot accepts maintained source without changing historical evidence', async (t) => {
    const { source, packed, historical } = await fixture(t)
    const original = structuredClone(historical)
    const snapshot = await AltiumCandidateSourceVerifier.capture(
        source,
        historical
    )
    assert.deepEqual(
        snapshot.map((entry) => entry.path),
        ['src/core/Record.mjs', 'src/helpers/Geometry.mjs']
    )
    await AltiumCandidateSourceVerifier.verify(packed, snapshot)
    assert.deepEqual(historical, original)
})

for (const path of ['src/core/Record.mjs', 'src/helpers/Geometry.mjs']) {
    test(`packed byte changes are rejected for ${path}`, async (t) => {
        const { source, packed, historical } = await fixture(t)
        const snapshot = await AltiumCandidateSourceVerifier.capture(
            source,
            historical
        )
        await writeFile(join(packed, path), 'export const value = 99\n')
        await assert.rejects(
            AltiumCandidateSourceVerifier.verify(packed, snapshot),
            /Candidate source differs/u
        )
    })
}

test('missing and extra packed source files are rejected', async (t) => {
    const { source, packed, historical } = await fixture(t)
    const snapshot = await AltiumCandidateSourceVerifier.capture(
        source,
        historical
    )
    await writeFile(join(packed, 'src/Unexpected.mjs'), 'export {}\n')
    await assert.rejects(
        AltiumCandidateSourceVerifier.verify(packed, snapshot),
        /Unexpected candidate source/u
    )
    await rm(join(packed, 'src/Unexpected.mjs'))
    await rm(join(packed, 'src/helpers/Geometry.mjs'))
    await assert.rejects(
        AltiumCandidateSourceVerifier.verify(packed, snapshot),
        /Candidate source differs/u
    )
})

test('capture requires every historical implementation path', async (t) => {
    const { source, historical } = await fixture(t)
    await rm(join(source, 'src/core/Record.mjs'))
    await assert.rejects(
        AltiumCandidateSourceVerifier.capture(source, historical),
        /Historical source path is missing/u
    )
})

test('a later checkout edit cannot change the independent source snapshot', async (t) => {
    const { source, packed, historical } = await fixture(t)
    const snapshot = await AltiumCandidateSourceVerifier.capture(
        source,
        historical
    )
    await writeFile(
        join(source, 'src/helpers/Geometry.mjs'),
        'export const size = 9\n'
    )
    await AltiumCandidateSourceVerifier.verify(packed, snapshot)
    await assert.rejects(
        AltiumCandidateSourceVerifier.verify(source, snapshot),
        /Candidate source differs/u
    )
})

for (const path of ['src/core/Record.mjs', 'src/helpers', 'src']) {
    test(`source symlinks are rejected at ${path}`, async (t) => {
        const { source, packed, historical } = await fixture(t)
        await rm(join(packed, path), { recursive: true, force: true })
        await symlink(join(source, path), join(packed, path))
        await assert.rejects(
            AltiumCandidateSourceVerifier.capture(packed, historical),
            /Candidate source is not a regular/u
        )
    })
}

for (const filename of ['renderers.css', 'parser.worker.mjs']) {
    test(`maintained public asset ${filename} preserves its entrypoint and candidate bytes`, async (t) => {
        const { source, packed, historical } = await fixture(t)
        const path = `src/${filename}`
        const entrypoint = `./assets/${filename}`
        const exported = `./extensions/assets/${filename}`
        await writeFile(join(source, path), 'maintained asset\n')
        await cp(join(source, path), join(packed, path))
        const baseline = {
            assets: [
                {
                    entrypoint,
                    target: `./${path}`,
                    sha256: 'historical-asset-bytes'
                }
            ]
        }
        const manifest = { exports: { [exported]: `./${path}` } }
        await writeFile(join(packed, 'package.json'), JSON.stringify(manifest))
        const snapshot = await AltiumCandidateSourceVerifier.capture(
            source,
            historical
        )
        await AltiumCandidateSourceVerifier.verifyAssets(
            packed,
            baseline,
            snapshot
        )
        await writeFile(join(packed, path), 'changed after capture\n')
        await assert.rejects(
            AltiumCandidateSourceVerifier.verifyAssets(
                packed,
                baseline,
                snapshot
            ),
            /Candidate asset differs/u
        )
        await cp(join(source, path), join(packed, path))
        manifest.exports[exported] = './src/helpers/Geometry.mjs'
        await writeFile(join(packed, 'package.json'), JSON.stringify(manifest))
        await assert.rejects(
            AltiumCandidateSourceVerifier.verifyAssets(
                packed,
                baseline,
                snapshot
            ),
            /Public asset target differs/u
        )
        delete manifest.exports[exported]
        await writeFile(join(packed, 'package.json'), JSON.stringify(manifest))
        await assert.rejects(
            AltiumCandidateSourceVerifier.verifyAssets(
                packed,
                baseline,
                snapshot
            ),
            /Public asset target differs/u
        )
    })
}
