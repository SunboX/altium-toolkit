// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    rm,
    symlink,
    writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual, promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = resolve(fileURLToPath(new URL('../', import.meta.url)))
const APPROVED = Object.freeze({
    packageVersion: '1.1.41',
    sourceCommit: '9fa22e1028d96e583275093279bf6e03e8619588',
    sourceTree: '1ddc290f5fc034454c5f33dac4de56b917070174',
    testTree: '00be0165c10e69611c8c571c9befef24b48273ae'
})
const IMPORTED_ENTRYPOINTS = Object.freeze([
    '.',
    './parser',
    './netlist-query',
    './renderers',
    './scene3d'
])

/**
 * Captures the immutable Altium 1.1.41 public and native-source baselines.
 * @returns {Promise<{ assetCount: number, exportCount: number, sourceFileCount: number }>} Capture summary.
 */
export async function captureApiBaseline() {
    const provenance = await captureProvenance()
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'altium-api-baseline-'))
    const archivePath = join(temporaryRoot, 'source.tar')
    const sourceRoot = join(temporaryRoot, 'source')
    try {
        await execFileAsync(
            'git',
            [
                'archive',
                '--format=tar',
                `--output=${archivePath}`,
                APPROVED.sourceCommit,
                'package.json',
                'src'
            ],
            { cwd: repositoryRoot, maxBuffer: 10 * 1024 * 1024 }
        )
        await mkdir(sourceRoot, { recursive: true })
        await execFileAsync('tar', ['-xf', archivePath, '-C', sourceRoot], {
            maxBuffer: 10 * 1024 * 1024
        })
        await symlink(
            resolve(repositoryRoot, 'node_modules'),
            join(sourceRoot, 'node_modules')
        )

        const pkg = JSON.parse(
            await readFile(join(sourceRoot, 'package.json'), 'utf8')
        )
        if (
            pkg.name !== 'altium-toolkit' ||
            pkg.version !== APPROVED.packageVersion
        ) {
            throw new Error(
                'Historical Altium package identity differs from the approved baseline.'
            )
        }
        const entrypoints = await captureEntrypoints(sourceRoot, pkg.exports)
        const apiBody = {
            schema: 'altium-toolkit.api-baseline.v1',
            package: pkg.name,
            packageVersion: pkg.version,
            provenance,
            exportMap: pkg.exports,
            entrypoints
        }
        const manifestBody = {
            schema: 'altium-toolkit.source-manifest.v1',
            package: pkg.name,
            packageVersion: pkg.version,
            provenance,
            files: await captureNativeFiles(sourceRoot)
        }
        const assetBody = {
            schema: 'altium-toolkit.asset-baseline.v1',
            package: pkg.name,
            packageVersion: pkg.version,
            provenance,
            assets: await captureAssets(sourceRoot, pkg.exports)
        }
        await writeImmutableJson(
            resolve(repositoryRoot, 'spec/api-baseline-v1.1.41.json'),
            withChecksum(apiBody)
        )
        await writeImmutableJson(
            resolve(repositoryRoot, 'spec/native-source-manifest-v1.1.41.json'),
            withChecksum(manifestBody)
        )
        await writeImmutableJson(
            resolve(repositoryRoot, 'spec/asset-baseline-v1.1.41.json'),
            withChecksum(assetBody)
        )
        return {
            assetCount: assetBody.assets.length,
            exportCount: entrypoints.reduce(
                (count, entrypoint) => count + entrypoint.exports.length,
                0
            ),
            sourceFileCount: manifestBody.files.length
        }
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
    }
}

/**
 * Captures exact content hashes for non-importable public assets.
 * @param {string} sourceRoot Extracted historical package root.
 * @param {Record<string, string>} exportMap Historical package export map.
 * @returns {Promise<Record<string, string>[]>} Sorted public asset contracts.
 */
async function captureAssets(sourceRoot, exportMap) {
    const entrypoints = [
        './styles/altium-renderers.css',
        './workers/altium-parser.worker.mjs'
    ]
    const assets = []
    for (const entrypoint of entrypoints) {
        const target = exportMap[entrypoint]
        if (typeof target !== 'string') {
            throw new Error(`Historical asset target is missing: ${entrypoint}`)
        }
        assets.push({
            entrypoint,
            target,
            sha256: createHash('sha256')
                .update(await readFile(resolve(sourceRoot, target)))
                .digest('hex')
        })
    }
    return assets
}

/**
 * Verifies the immutable source commit, source tree, and test tree.
 * @returns {Promise<Record<string, string>>} Approved provenance record.
 */
async function captureProvenance() {
    const [sourceCommit, sourceTree, testTree] = await Promise.all([
        git('rev-parse', 'v1.1.41^{}'),
        git('rev-parse', `${APPROVED.sourceCommit}:src`),
        git('rev-parse', `${APPROVED.sourceCommit}:tests`)
    ])
    const provenance = { sourceCommit, sourceTree, testTree }
    if (
        sourceCommit !== APPROVED.sourceCommit ||
        sourceTree !== APPROVED.sourceTree ||
        testTree !== APPROVED.testTree
    ) {
        throw new Error(
            'Altium v1.1.41 provenance differs from the approved baseline.'
        )
    }
    return provenance
}

/**
 * Captures every importable historical package entrypoint.
 * @param {string} sourceRoot Extracted historical package root.
 * @param {Record<string, string>} exportMap Historical package export map.
 * @returns {Promise<Record<string, any>[]>} Stable entrypoint contracts.
 */
async function captureEntrypoints(sourceRoot, exportMap) {
    const entrypoints = []
    for (const entrypoint of IMPORTED_ENTRYPOINTS) {
        const target = exportMap[entrypoint]
        if (typeof target !== 'string') {
            throw new Error(
                `Historical export target is missing: ${entrypoint}`
            )
        }
        const namespace = await import(
            `${pathToFileURL(resolve(sourceRoot, target)).href}?baseline=${APPROVED.sourceCommit}`
        )
        entrypoints.push({
            entrypoint,
            target,
            exports: Object.keys(namespace)
                .sort()
                .map((name) => captureExportContract(name, namespace[name]))
        })
    }
    return entrypoints
}

/**
 * Captures one module export without constructing or invoking it.
 * @param {string} name Export name.
 * @param {unknown} value Export value.
 * @returns {Record<string, any>} Stable export contract.
 */
export function captureExportContract(name, value) {
    const contract = { name, valueType: value === null ? 'null' : typeof value }
    if (typeof value !== 'function') {
        contract.value = stableValue(value)
        return contract
    }
    contract.functionName = value.name
    contract.arity = value.length
    contract.staticMembers = memberContracts(value, [
        'arguments',
        'caller',
        'length',
        'name',
        'prototype'
    ])
    contract.instanceMembers = value.prototype
        ? memberContracts(value.prototype, ['constructor'])
        : []
    return contract
}

/**
 * Captures own member descriptors without invoking accessors.
 * @param {object | Function} owner Member owner.
 * @param {string[]} ignored Ignored intrinsic names.
 * @returns {Record<string, any>[]} Stable member contracts.
 */
function memberContracts(owner, ignored) {
    return Reflect.ownKeys(owner)
        .filter((name) => typeof name === 'string' && !ignored.includes(name))
        .sort()
        .map((name) => {
            const descriptor = Object.getOwnPropertyDescriptor(owner, name)
            const member = {
                name,
                configurable: descriptor.configurable,
                enumerable: descriptor.enumerable
            }
            if (Object.hasOwn(descriptor, 'value')) {
                member.kind =
                    typeof descriptor.value === 'function' ? 'method' : 'value'
                member.writable = descriptor.writable
                if (typeof descriptor.value === 'function') {
                    member.arity = descriptor.value.length
                } else {
                    member.value = stableValue(descriptor.value)
                }
            } else {
                member.kind = 'accessor'
                member.get = typeof descriptor.get === 'function'
                member.set = typeof descriptor.set === 'function'
            }
            return member
        })
}

/**
 * Produces a bounded data-only snapshot for exported constants.
 * @param {unknown} value Exported value.
 * @param {number} [depth] Current recursion depth.
 * @returns {unknown} Stable bounded value.
 */
function stableValue(value, depth = 0) {
    if (
        value === null ||
        ['boolean', 'number', 'string'].includes(typeof value)
    ) {
        return value
    }
    if (typeof value === 'undefined') return { type: 'undefined' }
    if (depth >= 8) return { type: 'depth-limit' }
    if (Array.isArray(value)) {
        return value.map((entry) => stableValue(entry, depth + 1))
    }
    if (value instanceof Set) {
        return {
            type: 'Set',
            values: [...value].map((entry) => stableValue(entry, depth + 1))
        }
    }
    if (value instanceof Map) {
        return {
            type: 'Map',
            entries: [...value].map(([key, entry]) => [
                stableValue(key, depth + 1),
                stableValue(entry, depth + 1)
            ])
        }
    }
    if (typeof value !== 'object') return { type: typeof value }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
        return { type: prototype?.constructor?.name || 'object' }
    }
    const result = {}
    for (const key of Object.keys(value).sort()) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        result[key] =
            descriptor && Object.hasOwn(descriptor, 'value')
                ? stableValue(descriptor.value, depth + 1)
                : { type: 'accessor' }
    }
    return result
}

/**
 * Hashes every historical native core and UI implementation module.
 * @param {string} sourceRoot Extracted historical package root.
 * @returns {Promise<Record<string, string>[]>} Sorted source manifest.
 */
async function captureNativeFiles(sourceRoot) {
    const roots = [join(sourceRoot, 'src/core'), join(sourceRoot, 'src/ui')]
    const files = []
    for (const root of roots) {
        for (const path of await recursiveFiles(root)) {
            if (!path.endsWith('.mjs')) continue
            files.push({
                path: relative(sourceRoot, path).split('\\').join('/'),
                sha256: createHash('sha256')
                    .update(await readFile(path))
                    .digest('hex')
            })
        }
    }
    return files.sort((left, right) => left.path.localeCompare(right.path))
}

/**
 * Lists files recursively in deterministic name order.
 * @param {string} root Directory root.
 * @returns {Promise<string[]>} Absolute file paths.
 */
async function recursiveFiles(root) {
    const paths = []
    for (const entry of (await readdir(root, { withFileTypes: true })).sort(
        (left, right) => left.name.localeCompare(right.name)
    )) {
        const path = join(root, entry.name)
        if (entry.isDirectory()) paths.push(...(await recursiveFiles(path)))
        else if (entry.isFile()) paths.push(path)
    }
    return paths
}

/**
 * Adds a stable SHA-256 body checksum.
 * @param {Record<string, any>} body Artifact body.
 * @returns {Record<string, any>} Checksummed artifact.
 */
function withChecksum(body) {
    return {
        ...body,
        artifactChecksum: createHash('sha256')
            .update(JSON.stringify(body))
            .digest('hex')
    }
}

/**
 * Creates an immutable compact JSON artifact or accepts byte-identical data.
 * @param {string} path Output path.
 * @param {Record<string, any>} value Artifact value.
 * @returns {Promise<void>}
 */
async function writeImmutableJson(path, value) {
    const serialized = `${JSON.stringify(value)}\n`
    try {
        const existing = JSON.parse(await readFile(path, 'utf8'))
        if (!isDeepStrictEqual(existing, value)) {
            throw new Error(
                `Refusing to overwrite immutable baseline: ${basename(path)}`
            )
        }
        return
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error
    }
    await writeFile(path, serialized, { flag: 'wx' })
}

/**
 * Executes one Git command in the live repository.
 * @param {...string} args Git arguments.
 * @returns {Promise<string>} Trimmed stdout.
 */
async function git(...args) {
    const { stdout } = await execFileAsync('git', args, {
        cwd: repositoryRoot,
        maxBuffer: 10 * 1024 * 1024
    })
    return stdout.trim()
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
    const result = await captureApiBaseline()
    process.stdout.write(`${JSON.stringify(result)}\n`)
}
