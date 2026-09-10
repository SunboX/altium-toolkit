// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parsers } from 'prettier/plugins/acorn'

/** Verifies the complete source graph used by historical benchmark baselines. */
export class AltiumHistoricalSourceVerifier {
    /**
     * Checks source integrity before following any dependency from that source.
     * @param {string} root Repository root.
     * @param {{ files: { path: string, sha256: string }[] }} manifest Approved manifest.
     * @param {string[]} entryPoints Baseline module paths relative to the root.
     * @returns {Promise<string[]>} Verified repository-relative paths.
     */
    static async verify(root, manifest, entryPoints) {
        const expected = new Map(
            manifest.files.map((row) => [row.path, row.sha256])
        )
        const queue = entryPoints.map((path) => resolve(root, path))
        const verified = new Set()
        while (queue.length) {
            const path = queue.pop()
            const name = relative(root, path).split(sep).join('/')
            if (verified.has(name)) continue
            if (!expected.has(name)) {
                throw new Error(
                    `Historical native source is not in the manifest: ${name}`
                )
            }
            const bytes = await readFile(path)
            const checksum = createHash('sha256').update(bytes).digest('hex')
            if (checksum !== expected.get(name)) {
                throw new Error(`Historical native source changed: ${name}`)
            }
            verified.add(name)
            const ast = await parsers.acorn.parse(bytes.toString('utf8'), {})
            for (const specifier of AltiumHistoricalSourceVerifier.#imports(
                ast,
                name
            )) {
                if (
                    specifier.startsWith('.') ||
                    specifier.startsWith('/') ||
                    specifier.startsWith('file:')
                ) {
                    queue.push(
                        fileURLToPath(new URL(specifier, pathToFileURL(path)))
                    )
                }
            }
        }
        return [...verified]
    }

    /**
     * Reads literal ESM edges and fails closed on computed dynamic imports.
     * @param {object} ast Parsed JavaScript syntax tree.
     * @param {string} name Source path for diagnostics.
     * @returns {string[]} Module specifiers.
     */
    static #imports(ast, name) {
        const queue = [ast]
        const specifiers = new Set()
        while (queue.length) {
            const node = queue.pop()
            if (node.type === 'ImportExpression') {
                if (
                    node.source?.type !== 'Literal' ||
                    typeof node.source.value !== 'string'
                ) {
                    throw new Error(
                        `Computed dynamic import in historical native source: ${name}`
                    )
                }
                specifiers.add(node.source.value)
            } else if (
                [
                    'ImportDeclaration',
                    'ExportNamedDeclaration',
                    'ExportAllDeclaration'
                ].includes(node.type) &&
                node.source
            ) {
                specifiers.add(node.source.value)
            }
            for (const value of Object.values(node)) {
                if (Array.isArray(value))
                    queue.push(
                        ...value.filter(
                            (entry) => entry && typeof entry === 'object'
                        )
                    )
                else if (value && typeof value === 'object') queue.push(value)
            }
        }
        return [...specifiers]
    }
}
