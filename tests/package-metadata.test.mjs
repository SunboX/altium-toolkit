// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Verifies npmjs and GitHub Packages publishing metadata remain compatible.
 */
test('package metadata keeps npm identity and GitHub Packages publishing target', async () => {
    const packageJson = JSON.parse(
        await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8')
    )
    const npmrc = await readFile(resolve(REPO_ROOT, '.npmrc'), 'utf8')
    const workflow = await readFile(
        resolve(REPO_ROOT, '.github/workflows/publish-github-packages.yml'),
        'utf8'
    )

    assert.equal(packageJson.name, 'altium-toolkit')
    assert.deepEqual(packageJson.repository, {
        type: 'git',
        url: 'git+https://github.com/SunboX/altium-toolkit.git'
    })
    assert.match(npmrc, /^@sunbox:registry=https:\/\/npm\.pkg\.github\.com$/m)
    assert.match(workflow, /packages:\s+write/)
    assert.match(workflow, /registry-url: 'https:\/\/npm\.pkg\.github\.com'/)
    assert.match(workflow, /scope: '@sunbox'/)
    assert.match(workflow, /packageJson\.name = '@sunbox\/altium-toolkit'/)
    assert.match(workflow, /registry: 'https:\/\/npm\.pkg\.github\.com'/)
    assert.match(workflow, /NODE_AUTH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
})
