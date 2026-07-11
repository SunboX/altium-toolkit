// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual, promisify } from 'node:util'

import {
    captureApiBaseline,
    captureExportContract
} from './capture-api-baseline.mjs'
import { buildFeaturePreservationRows } from './generate-feature-preservation.mjs'

const execFileAsync = promisify(execFile)
const repositoryRoot = resolve(fileURLToPath(new URL('../', import.meta.url)))
const APPROVED_PROVENANCE = Object.freeze({
    sourceCommit: '9fa22e1028d96e583275093279bf6e03e8619588',
    sourceTree: '1ddc290f5fc034454c5f33dac4de56b917070174',
    testTree: '00be0165c10e69611c8c571c9befef24b48273ae'
})
const CANONICAL_EXPORTS = Object.freeze([
    'BomTableRenderer',
    'CircuitJsonDocument',
    'CircuitJsonDocumentContext',
    'CircuitJsonIndexer',
    'CircuitJsonUnits',
    'ManufacturingService',
    'Parser',
    'PcbInteractionIndex',
    'PcbScene3dBuilder',
    'PcbScene3dPreparator',
    'PcbSvgRenderer',
    'ProjectLoader',
    'QueryService',
    'SchematicSvgRenderer',
    'SimulationService',
    'ToolkitCapabilities',
    'ToolkitError'
])
const SHARED_EXTENSION_EXPORTS = Object.freeze([
    'CircuitJsonBomBuilder',
    'CircuitJsonElementValidator',
    'CircuitJsonManufacturingBuilder',
    'CircuitJsonManufacturingDownloadBuilder',
    'CircuitJsonParser',
    'CircuitJsonPcbClearanceDiagnostics',
    'CircuitJsonPcbCopperGeometry',
    'CircuitJsonPcbDrawingStyle',
    'CircuitJsonPcbHolePrimitiveModel',
    'CircuitJsonPcbNetMetadata',
    'CircuitJsonPcbPadPrimitiveModel',
    'CircuitJsonPcbPrimitiveArtwork',
    'CircuitJsonPcbPrimitiveAttributeRenderer',
    'CircuitJsonPcbPrimitiveBuilder',
    'CircuitJsonPcbPrimitiveFields',
    'CircuitJsonPcbPrimitiveGeometry',
    'CircuitJsonPcbPrimitiveGroups',
    'CircuitJsonPcbPrimitiveIndex',
    'CircuitJsonPcbPrimitiveOverlays',
    'CircuitJsonPcbSvgRenderer',
    'CircuitJsonPcbTraceLengthModel',
    'CircuitJsonPcbViaSvgRenderer',
    'CircuitJsonPcbZonePrimitiveBuilder',
    'CircuitJsonSchematicSvgArcPath',
    'CircuitJsonSchematicSvgPortMetadata',
    'CircuitJsonSchematicSvgPrimitiveAttributes',
    'CircuitJsonSchematicSvgRenderer',
    'CircuitJsonSchematicTableSvgRenderer',
    'CircuitJsonSourceMetadata',
    'CircuitJsonSupportMatrixBuilder',
    'PcbBoundsSelectionModel',
    'PcbCandidateSelectionModel',
    'PcbDiagnosticFocusModel',
    'PcbInteractionPrimitiveModel',
    'SelectedPartCircuitJsonExportAdapter',
    'SpiceCompatibilityPreprocessor',
    'SpiceSimulationService'
])
const CONVERGENCE_EXTENSION_EXPORTS = Object.freeze(['AltiumExtensionResolver'])

/**
 * Validates the local or packed candidate against the immutable 1.1.41 tree.
 * @param {{ strict?: boolean }} [options] Validation options.
 * @returns {Promise<{ featureCount: number, legacyExportCount: number, extensionExportCount: number, strict: boolean }>} Validation summary.
 */
export async function checkFeaturePreservation(options = {}) {
    await captureApiBaseline()
    const [baseline, assets, manifest, ledger] = await Promise.all([
        readJson('spec/api-baseline-v1.1.41.json'),
        readJson('spec/asset-baseline-v1.1.41.json'),
        readJson('spec/native-source-manifest-v1.1.41.json'),
        readJson('spec/feature-preservation.json')
    ])
    validateArtifact(baseline, 'API baseline')
    validateArtifact(assets, 'asset baseline')
    validateArtifact(manifest, 'native source manifest')
    validatePinnedIdentity(baseline, assets, manifest)
    validateLedger(ledger, baseline, assets, manifest)
    await validateNativeSources(repositoryRoot, manifest)

    if (options.strict) {
        return await validatePackedCandidate({
            assets,
            baseline,
            ledger,
            manifest
        })
    }
    const [extensions, sharedExtensions, canonical, sharedCanonical] =
        await Promise.all([
            import(
                `${pathToFileURL(resolve(repositoryRoot, 'src/extensions.mjs')).href}?preservation=${Date.now()}`
            ),
            import('circuitjson-toolkit/extensions'),
            import(
                `${pathToFileURL(resolve(repositoryRoot, 'src/index.mjs')).href}?canonical=${Date.now()}`
            ),
            import('circuitjson-toolkit')
        ])
    const extensionCounts = validateExtensionNamespace(
        extensions,
        baseline,
        sharedExtensions
    )
    validateCanonicalNamespace(canonical, sharedCanonical)
    return {
        featureCount: ledger.length,
        legacyExportCount: extensionCounts.legacy,
        extensionExportCount: extensionCounts.total,
        strict: false
    }
}

/**
 * Validates the candidate tarball in an isolated install fixture.
 * @param {{ assets: Record<string, any>, baseline: Record<string, any>, ledger: Record<string, any>[], manifest: Record<string, any> }} artifacts Immutable artifacts.
 * @returns {Promise<{ featureCount: number, legacyExportCount: number, extensionExportCount: number, strict: true }>} Packed summary.
 */
async function validatePackedCandidate(artifacts) {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'altium-strict-pack-'))
    try {
        const tarball = await packCandidate(temporaryRoot)
        const fixture = resolve(temporaryRoot, 'fixture')
        await mkdir(fixture, { recursive: true })
        await writeFile(
            resolve(fixture, 'package.json'),
            `${JSON.stringify({ private: true, type: 'module' })}\n`
        )
        const coreTarball = resolve(
            repositoryRoot,
            '..',
            'release-candidates',
            'circuitjson-toolkit-1.1.0.tgz'
        )
        for (const dependency of [coreTarball, tarball]) {
            await execFileAsync(
                process.env.npm_execpath || 'npm',
                [
                    'install',
                    '--ignore-scripts',
                    '--no-audit',
                    '--no-fund',
                    '--package-lock=false',
                    dependency
                ],
                { cwd: fixture, env: process.env, maxBuffer: 10 * 1024 * 1024 }
            )
        }
        const packageRoot = resolve(fixture, 'node_modules/altium-toolkit')
        const extensions = await import(
            `${pathToFileURL(resolve(packageRoot, 'src/extensions.mjs')).href}?packed=${Date.now()}`
        )
        const sharedExtensions = await import(
            `${pathToFileURL(resolve(fixture, 'node_modules/circuitjson-toolkit/src/extensions.mjs')).href}?packed-shared=${Date.now()}`
        )
        const canonical = await import(
            `${pathToFileURL(resolve(packageRoot, 'src/index.mjs')).href}?packed=${Date.now()}`
        )
        const sharedCanonical = await import(
            `${pathToFileURL(resolve(fixture, 'node_modules/circuitjson-toolkit/src/index.mjs')).href}?packed-shared-root=${Date.now()}`
        )
        const extensionCounts = validateExtensionNamespace(
            extensions,
            artifacts.baseline,
            sharedExtensions
        )
        validateCanonicalNamespace(canonical, sharedCanonical)
        await validateCanonicalSubpaths(packageRoot)
        const testing = await import(
            `${pathToFileURL(resolve(packageRoot, 'src/testing.mjs')).href}?packed-testing=${Date.now()}`
        )
        const contract = await testing.runToolkitContract(canonical, {
            fixtures: testing.ToolkitContractFixtures.altium()
        })
        if (contract.failures.length) {
            throw new Error(
                `Packed Altium contract failed: ${contract.failures.join(', ')}`
            )
        }
        await validateNativeSources(packageRoot, artifacts.manifest)
        await validatePackedAssets(packageRoot, artifacts.assets)
        await validatePackedManifest(packageRoot)
        return {
            featureCount: artifacts.ledger.length,
            legacyExportCount: extensionCounts.legacy,
            extensionExportCount: extensionCounts.total,
            strict: true
        }
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
    }
}

/**
 * Packs the active release candidate into a temporary directory.
 * @param {string} destination Pack destination.
 * @returns {Promise<string>} Absolute tarball path.
 */
async function packCandidate(destination) {
    const { stdout } = await execFileAsync(
        process.env.npm_execpath || 'npm',
        ['pack', '--json', '--pack-destination', destination],
        { cwd: repositoryRoot, env: process.env, maxBuffer: 10 * 1024 * 1024 }
    )
    const result = JSON.parse(stdout)
    const filename = result?.[0]?.filename
    if (typeof filename !== 'string') {
        throw new Error('npm pack did not return an Altium candidate filename.')
    }
    return resolve(destination, filename)
}

/**
 * Verifies one artifact checksum without trusting its declared value.
 * @param {Record<string, any>} artifact Artifact record.
 * @param {string} label Error label.
 * @returns {void}
 */
function validateArtifact(artifact, label) {
    const { artifactChecksum, ...body } = artifact
    if (
        typeof artifactChecksum !== 'string' ||
        artifactChecksum !== checksum(body)
    ) {
        throw new Error(`${label} checksum differs from its body.`)
    }
}

/**
 * Binds every baseline artifact to the independently pinned Git provenance.
 * @param {...Record<string, any>} artifacts Baseline artifacts.
 * @returns {void}
 */
function validatePinnedIdentity(...artifacts) {
    for (const artifact of artifacts) {
        if (
            artifact.package !== 'altium-toolkit' ||
            artifact.packageVersion !== '1.1.41' ||
            !isDeepStrictEqual(artifact.provenance, APPROVED_PROVENANCE)
        ) {
            throw new Error(
                'Altium baseline identity differs from the approved Git tree.'
            )
        }
    }
}

/**
 * Verifies exact ledger identity, evidence, and truthful replacement grammar.
 * @param {Record<string, any>[]} ledger Preservation rows.
 * @param {Record<string, any>} baseline API baseline.
 * @param {Record<string, any>} assets Asset baseline.
 * @param {Record<string, any>} manifest Native source manifest.
 * @returns {void}
 */
function validateLedger(ledger, baseline, assets, manifest) {
    const expected = buildFeaturePreservationRows(baseline, assets, manifest)
    if (!isDeepStrictEqual(ledger, expected)) {
        throw new Error(
            'Altium preservation ledger differs from the pinned contracts.'
        )
    }
    const features = new Set()
    for (const row of ledger) {
        if (
            features.has(row.feature) ||
            row.package !== 'altium-toolkit@1.1.41' ||
            row.disposition !== 'native-extension' ||
            !String(row.replacement).startsWith('altium-toolkit/extensions') ||
            row.availability?.['altium-toolkit'] !== 'native' ||
            row.evidence?.mode !== 'pinned-historical-contract' ||
            row.evidence.apiArtifactChecksum !== baseline.artifactChecksum ||
            row.evidence.assetArtifactChecksum !== assets.artifactChecksum ||
            row.evidence.sourceManifestChecksum !== manifest.artifactChecksum
        ) {
            throw new Error(
                `Invalid Altium preservation mapping: ${String(row.feature)}`
            )
        }
        features.add(row.feature)
    }
}

/**
 * Verifies the exact historical export contracts on the extension namespace.
 * @param {Record<string, any>} extensions Extension module namespace.
 * @param {Record<string, any>} baseline API baseline.
 * @param {Record<string, any>} shared Shared CircuitJSON extension namespace.
 * @returns {{ legacy: number, shared: number, total: number }} Export counts.
 */
function validateExtensionNamespace(extensions, baseline, shared) {
    const contracts = new Map()
    for (const entrypoint of baseline.entrypoints) {
        for (const contract of entrypoint.exports) {
            const existing = contracts.get(contract.name)
            if (existing && !isDeepStrictEqual(existing, contract)) {
                throw new Error(
                    `Historical export contracts disagree: ${contract.name}`
                )
            }
            contracts.set(contract.name, contract)
        }
    }
    const legacyNames = [...contracts.keys()].sort()
    const sharedNames = Object.keys(shared).sort()
    if (!isDeepStrictEqual(sharedNames, [...SHARED_EXTENSION_EXPORTS].sort())) {
        throw new Error(
            'CircuitJSON extensions differ from the pinned shared inventory.'
        )
    }
    const collisions = sharedNames.filter((name) => contracts.has(name))
    if (collisions.length) {
        throw new Error(
            `Shared and native Altium extensions collide: ${collisions.join(', ')}`
        )
    }
    const expectedNames = [
        ...legacyNames,
        ...sharedNames,
        ...CONVERGENCE_EXTENSION_EXPORTS
    ].sort()
    if (!isDeepStrictEqual(Object.keys(extensions).sort(), expectedNames)) {
        throw new Error(
            'Altium extension export inventory differs from the native, shared, and convergence union.'
        )
    }
    for (const [name, expected] of contracts) {
        const actual = captureExportContract(name, extensions[name])
        if (!isDeepStrictEqual(actual, expected)) {
            throw new Error(`Altium extension contract differs: ${name}`)
        }
    }
    for (const name of sharedNames) {
        if (extensions[name] !== shared[name]) {
            throw new Error(
                `Altium shared extension is not re-exported: ${name}`
            )
        }
    }
    for (const name of CONVERGENCE_EXTENSION_EXPORTS) {
        if (typeof extensions[name] !== 'function') {
            throw new Error(`Altium convergence extension is missing: ${name}`)
        }
    }
    return {
        legacy: legacyNames.length,
        shared: sharedNames.length,
        total: expectedNames.length
    }
}

/**
 * Verifies the exact shared root namespace and pinned 17-class inventory.
 * @param {Record<string, any>} namespace Package root namespace.
 * @param {Record<string, any>} shared Shared CircuitJSON root namespace.
 * @returns {void}
 */
function validateCanonicalNamespace(namespace, shared) {
    if (
        !isDeepStrictEqual(
            Object.keys(shared).sort(),
            [...CANONICAL_EXPORTS].sort()
        )
    ) {
        throw new Error(
            'CircuitJSON root differs from the pinned shared class inventory.'
        )
    }
    if (
        !isDeepStrictEqual(
            Object.keys(namespace).sort(),
            Object.keys(shared).sort()
        )
    ) {
        throw new Error(
            'Altium root differs from the canonical class inventory.'
        )
    }
    for (const name of CANONICAL_EXPORTS) {
        if (typeof namespace[name] !== 'function') {
            throw new Error(`Altium canonical export is not a class: ${name}`)
        }
    }
}

/**
 * Verifies every historical native implementation hash.
 * @param {string} packageRoot Candidate package root.
 * @param {Record<string, any>} manifest Source manifest.
 * @returns {Promise<void>}
 */
async function validateNativeSources(packageRoot, manifest) {
    for (const entry of manifest.files) {
        const actual = createHash('sha256')
            .update(await readFile(resolve(packageRoot, entry.path)))
            .digest('hex')
        if (actual !== entry.sha256) {
            throw new Error(`Native Altium source differs: ${entry.path}`)
        }
    }
}

/**
 * Verifies packed extension asset hashes at their declared replacement paths.
 * @param {string} packageRoot Packed package root.
 * @param {Record<string, any>} baseline Asset baseline.
 * @returns {Promise<void>}
 */
async function validatePackedAssets(packageRoot, baseline) {
    const pkg = JSON.parse(
        await readFile(resolve(packageRoot, 'package.json'), 'utf8')
    )
    for (const asset of baseline.assets) {
        const extensionEntrypoint = `./extensions${asset.entrypoint.slice(1)}`
        const target = pkg.exports?.[extensionEntrypoint]
        if (typeof target !== 'string') {
            throw new Error(
                `Packed Altium extension asset is missing: ${extensionEntrypoint}`
            )
        }
        const actual = createHash('sha256')
            .update(await readFile(resolve(packageRoot, target)))
            .digest('hex')
        if (actual !== asset.sha256) {
            throw new Error(
                `Packed Altium asset differs: ${extensionEntrypoint}`
            )
        }
    }
}

/**
 * Verifies the packed dependency and common subpath manifest.
 * @param {string} packageRoot Packed package root.
 * @returns {Promise<void>}
 */
async function validatePackedManifest(packageRoot) {
    const pkg = JSON.parse(
        await readFile(resolve(packageRoot, 'package.json'), 'utf8')
    )
    const required = [
        '.',
        './parser',
        './project',
        './renderers',
        './interaction',
        './query',
        './manufacturing',
        './simulation',
        './scene3d',
        './capabilities',
        './extensions',
        './testing',
        './workers/parser.worker.mjs',
        './styles/renderers.css',
        './extensions/workers/altium-parser.worker.mjs',
        './extensions/styles/altium-renderers.css'
    ]
    if (
        pkg.dependencies?.['circuitjson-toolkit'] !== '^1.1.0' ||
        !isDeepStrictEqual(Object.keys(pkg.exports), required) ||
        required.some(
            (entrypoint) => typeof pkg.exports?.[entrypoint] !== 'string'
        )
    ) {
        throw new Error(
            'Packed Altium manifest omits the shared dependency or subpaths.'
        )
    }
}

/**
 * Verifies common packed subpaths expose the same names as CircuitJSON.
 * @param {string} packageRoot Packed Altium package root.
 * @returns {Promise<void>}
 */
async function validateCanonicalSubpaths(packageRoot) {
    const coreRoot = resolve(packageRoot, '..', 'circuitjson-toolkit')
    for (const subpath of [
        'parser',
        'project',
        'renderers',
        'interaction',
        'query',
        'manufacturing',
        'simulation',
        'scene3d',
        'capabilities',
        'testing'
    ]) {
        const [actual, expected] = await Promise.all([
            import(
                `${pathToFileURL(resolve(packageRoot, `src/${subpath}.mjs`)).href}?altium-subpath=${Date.now()}`
            ),
            import(
                `${pathToFileURL(resolve(coreRoot, `src/${subpath}.mjs`)).href}?core-subpath=${Date.now()}`
            )
        ])
        if (
            !isDeepStrictEqual(
                Object.keys(actual).sort(),
                Object.keys(expected).sort()
            )
        ) {
            throw new Error(`Packed canonical subpath differs: ${subpath}`)
        }
    }
}

/**
 * Reads one repository JSON artifact.
 * @param {string} path Repository-relative path.
 * @returns {Promise<any>} Parsed value.
 */
async function readJson(path) {
    return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8'))
}

/**
 * Hashes one JSON-compatible body.
 * @param {Record<string, any>} value Body value.
 * @returns {string} SHA-256 checksum.
 */
function checksum(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
    const result = await checkFeaturePreservation({
        strict: process.argv.includes('--strict')
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
}
