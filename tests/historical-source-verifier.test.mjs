import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { AltiumHistoricalSourceVerifier } from '../benchmarks/AltiumHistoricalSourceVerifier.mjs'

/** Creates immutable expected checksums before each synthetic source edit. */
async function fixture(t, sources) {
    const root = await mkdtemp(resolve(tmpdir(), 'altium-historical-'))
    t.after(() => rm(root, { recursive: true, force: true }))
    const manifest = { files: [] }
    for (const [path, source] of Object.entries(sources)) {
        await writeFile(resolve(root, path), source)
        manifest.files.push({
            path,
            sha256: createHash('sha256').update(source).digest('hex')
        })
    }
    return { root, manifest }
}

test('historical source verification follows ESM imports and re-exports through cycles', async (t) => {
    const { root, manifest } = await fixture(t, {
        'entry.mjs':
            "import './effect.mjs'; export { value } from './value.mjs'; export * from './all.mjs'; const next = () => import('./lazy.mjs')",
        'effect.mjs': "import './entry.mjs'",
        'value.mjs': 'export const value = 1',
        'all.mjs': "export * as group from './value.mjs'",
        'lazy.mjs': "import fs from 'node:fs'; export default fs",
        'unused.mjs': 'export const unused = true'
    })
    const paths = await AltiumHistoricalSourceVerifier.verify(root, manifest, [
        'entry.mjs'
    ])
    assert.deepEqual([...paths].sort(), [
        'all.mjs',
        'effect.mjs',
        'entry.mjs',
        'lazy.mjs',
        'value.mjs'
    ])
})

test('historical source verification rejects modified transitive dependencies', async (t) => {
    const { root, manifest } = await fixture(t, {
        'entry.mjs': "export * from './child.mjs'",
        'child.mjs': 'export const value = 1'
    })
    await writeFile(resolve(root, 'child.mjs'), 'export const value = 2')
    await assert.rejects(
        AltiumHistoricalSourceVerifier.verify(root, manifest, ['entry.mjs']),
        /Historical native source changed: child\.mjs/
    )
})

test('historical source verification rejects dependencies absent from the manifest', async (t) => {
    const { root, manifest } = await fixture(t, {
        'entry.mjs': "import './child.mjs'",
        'child.mjs': 'export const value = 1'
    })
    manifest.files = manifest.files.filter(
        (entry) => entry.path !== 'child.mjs'
    )
    await assert.rejects(
        AltiumHistoricalSourceVerifier.verify(root, manifest, ['entry.mjs']),
        /Historical native source is not in the manifest: child\.mjs/
    )
})

test('historical source verification permits edits outside the measured dependency graph', async (t) => {
    const { root, manifest } = await fixture(t, {
        'entry.mjs': 'export const value = 1',
        'unused.mjs': 'export const unrelated = 1'
    })
    await writeFile(resolve(root, 'unused.mjs'), 'export const unrelated = 2')
    assert.deepEqual(
        await AltiumHistoricalSourceVerifier.verify(root, manifest, [
            'entry.mjs'
        ]),
        ['entry.mjs']
    )
})

test('historical source verification rejects computed dynamic imports', async (t) => {
    const { root, manifest } = await fixture(t, {
        'entry.mjs': 'export const load = (name) => import(name)'
    })
    await assert.rejects(
        AltiumHistoricalSourceVerifier.verify(root, manifest, ['entry.mjs']),
        /Computed dynamic import in historical native source: entry\.mjs/
    )
})

test('historical source verification checks integrity before parsing dependency syntax', async (t) => {
    const { root, manifest } = await fixture(t, {
        'entry.mjs': 'export const value = 1'
    })
    await writeFile(resolve(root, 'entry.mjs'), 'export const ???')
    await assert.rejects(
        AltiumHistoricalSourceVerifier.verify(root, manifest, ['entry.mjs']),
        /Historical native source changed: entry\.mjs/
    )
})
