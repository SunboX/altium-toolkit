// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Verifies that a package contains exactly the maintained candidate source. */
export class AltiumCandidateSourceVerifier {
    /**
     * Captures source bytes independently of packing, retaining historical paths.
     * Historical hashes remain baseline evidence, not mutable release hashes.
     * @param {string} root Candidate repository root.
     * @param {{ files: { path: string }[] }} historical Historical source manifest.
     * @returns {Promise<ReadonlyArray<{ path: string, sha256: string }>>} Snapshot.
     */
    static async capture(root, historical) {
        const files = await AltiumCandidateSourceVerifier.#files(root)
        const paths = new Set(files.map((entry) => entry.path))
        for (const entry of historical.files) {
            if (!paths.has(entry.path)) {
                throw new Error(
                    `Historical source path is missing: ${entry.path}`
                )
            }
        }
        return Object.freeze(files.map((entry) => Object.freeze(entry)))
    }

    /**
     * Rejects missing, extra, changed, or linked source in a packed candidate.
     * @param {string} root Package root to verify.
     * @param {ReadonlyArray<{ path: string, sha256: string }>} expected Snapshot.
     * @returns {Promise<void>}
     */
    static async verify(root, expected) {
        const actual = new Map(
            (await AltiumCandidateSourceVerifier.#files(root)).map((entry) => [
                entry.path,
                entry.sha256
            ])
        )
        for (const entry of expected) {
            if (actual.get(entry.path) !== entry.sha256) {
                throw new Error(`Candidate source differs: ${entry.path}`)
            }
            actual.delete(entry.path)
        }
        if (actual.size) {
            throw new Error(
                `Unexpected candidate source: ${actual.keys().next().value}`
            )
        }
    }

    /**
     * Preserves public asset targets and verifies their maintained release bytes.
     * @param {string} root Packed package root.
     * @param {{ assets: { entrypoint: string, target: string }[] }} baseline Historical assets.
     * @param {ReadonlyArray<{ path: string, sha256: string }>} expected Candidate snapshot.
     * @returns {Promise<void>}
     */
    static async verifyAssets(root, baseline, expected) {
        const pkg = JSON.parse(
            await readFile(resolve(root, 'package.json'), 'utf8')
        )
        const hashes = new Map(
            expected.map((entry) => [`./${entry.path}`, entry.sha256])
        )
        for (const asset of baseline.assets) {
            const entrypoint = `./extensions${asset.entrypoint.slice(1)}`
            const target = pkg.exports?.[entrypoint]
            if (target !== asset.target) {
                throw new Error(`Public asset target differs: ${entrypoint}`)
            }
            const expectedHash = hashes.get(target)
            if (!expectedHash) {
                throw new Error(
                    `Public asset is outside candidate source: ${entrypoint}`
                )
            }
            const actualHash = createHash('sha256')
                .update(await readFile(resolve(root, target)))
                .digest('hex')
            if (actualHash !== expectedHash) {
                throw new Error(`Candidate asset differs: ${entrypoint}`)
            }
        }
    }

    /**
     * Enumerates every source asset, including new helpers and worker modules.
     * @param {string} root Package root.
     * @param {string} [directory] Package-relative directory.
     * @returns {Promise<{ path: string, sha256: string }[]>} Sorted file hashes.
     */
    static async #files(root, directory = 'src') {
        const absolute = resolve(root, directory)
        if (!(await lstat(absolute)).isDirectory()) {
            throw new Error(
                `Candidate source is not a regular directory: ${directory}`
            )
        }
        const files = []
        for (const entry of await readdir(absolute, { withFileTypes: true })) {
            const path = `${directory}/${entry.name}`
            if (entry.isDirectory()) {
                files.push(
                    ...(await AltiumCandidateSourceVerifier.#files(root, path))
                )
            } else if (entry.isFile()) {
                files.push({
                    path,
                    sha256: createHash('sha256')
                        .update(await readFile(resolve(root, path)))
                        .digest('hex')
                })
            } else {
                throw new Error(
                    `Candidate source is not a regular file: ${path}`
                )
            }
        }
        return files.sort((left, right) =>
            left.path < right.path ? -1 : left.path > right.path ? 1 : 0
        )
    }
}
