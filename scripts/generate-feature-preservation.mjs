// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(fileURLToPath(new URL('../', import.meta.url)))
const PAGE_SIZE = 300

/**
 * Generates the exact legacy preservation ledger and paged migration appendix.
 * @returns {Promise<{ featureCount: number, pageCount: number }>} Generation summary.
 */
export async function generateFeaturePreservation() {
    const [baseline, assets, sourceManifest] = await Promise.all([
        readJson('spec/api-baseline-v1.1.41.json'),
        readJson('spec/asset-baseline-v1.1.41.json'),
        readJson('spec/native-source-manifest-v1.1.41.json')
    ])
    const rows = buildFeaturePreservationRows(baseline, assets, sourceManifest)
    const pages = pageRows(rows)
    await writeMigrationPages(pages)
    await writeFile(
        resolve(repositoryRoot, 'spec/feature-preservation.json'),
        `${JSON.stringify(rows)}\n`
    )
    await writeFile(
        resolve(repositoryRoot, 'docs/migration.md'),
        migrationIndex(pages)
    )
    return { featureCount: rows.length, pageCount: pages.length }
}

/**
 * Derives the complete preservation ledger from pinned baseline artifacts.
 * @param {Record<string, any>} baseline API baseline.
 * @param {Record<string, any>} assets Asset baseline.
 * @param {Record<string, any>} sourceManifest Native source manifest.
 * @returns {Record<string, any>[]} Complete deterministic rows.
 */
export function buildFeaturePreservationRows(baseline, assets, sourceManifest) {
    const evidence = Object.freeze({
        mode: 'pinned-historical-contract',
        apiArtifactChecksum: baseline.artifactChecksum,
        assetArtifactChecksum: assets.artifactChecksum,
        sourceManifestChecksum: sourceManifest.artifactChecksum
    })
    const rows = [
        ...apiRows(baseline, evidence),
        ...assetRows(assets, evidence),
        sourceManifestRow(sourceManifest, evidence)
    ]
    pageRows(rows)
    return rows
}

/**
 * Creates preservation rows for every historical export and own member.
 * @param {Record<string, any>} baseline Historical API baseline.
 * @param {Record<string, string>} evidence Pinned evidence identity.
 * @returns {Record<string, any>[]} API preservation rows.
 */
function apiRows(baseline, evidence) {
    const rows = []
    for (const entrypoint of baseline.entrypoints) {
        for (const exported of entrypoint.exports) {
            const feature = `${entrypoint.entrypoint}#${exported.name}`
            rows.push(
                preservationRow({
                    evidence,
                    feature,
                    kind: 'export',
                    replacement: `altium-toolkit/extensions#${exported.name}`,
                    sourceContract: exported
                })
            )
            for (const member of exported.staticMembers || []) {
                rows.push(
                    memberRow({
                        evidence,
                        exported,
                        feature,
                        member,
                        placement: 'static'
                    })
                )
            }
            for (const member of exported.instanceMembers || []) {
                rows.push(
                    memberRow({
                        evidence,
                        exported,
                        feature,
                        member,
                        placement: 'instance'
                    })
                )
            }
        }
    }
    return rows
}

/**
 * Creates one static or prototype-member preservation row.
 * @param {{ evidence: Record<string, string>, exported: Record<string, any>, feature: string, member: Record<string, any>, placement: 'instance' | 'static' }} input Member inputs.
 * @returns {Record<string, any>} Member preservation row.
 */
function memberRow(input) {
    const instance = input.placement === 'instance'
    const callable = input.member.kind === 'method'
    const suffix = `${instance ? '.prototype' : ''}.${input.member.name}${callable ? '()' : ''}`
    return preservationRow({
        evidence: input.evidence,
        feature: `${input.feature}${suffix}`,
        kind: callable ? 'method' : 'property',
        replacement: `altium-toolkit/extensions#${input.exported.name}${suffix}`,
        sourceContract: {
            placement: input.placement,
            ...input.member
        }
    })
}

/**
 * Creates preservation rows for the legacy worker and stylesheet assets.
 * @param {Record<string, any>} baseline Historical asset baseline.
 * @param {Record<string, string>} evidence Pinned evidence identity.
 * @returns {Record<string, any>[]} Asset preservation rows.
 */
function assetRows(baseline, evidence) {
    return baseline.assets.map((asset) =>
        preservationRow({
            evidence,
            feature: `${asset.entrypoint}#asset`,
            kind: 'asset',
            replacement: `altium-toolkit/extensions${asset.entrypoint.slice(1)}`,
            sourceContract: asset
        })
    )
}

/**
 * Creates one row binding all native implementation details to the source tree.
 * @param {Record<string, any>} manifest Historical source manifest.
 * @param {Record<string, string>} evidence Pinned evidence identity.
 * @returns {Record<string, any>} Native source preservation row.
 */
function sourceManifestRow(manifest, evidence) {
    return preservationRow({
        evidence,
        feature: 'native-source#core-ui-implementation',
        kind: 'behavior',
        replacement: 'altium-toolkit/extensions',
        sourceContract: {
            fileCount: manifest.files.length,
            sourceTree: manifest.provenance.sourceTree
        }
    })
}

/**
 * Creates one complete native-extension mapping row.
 * @param {{ evidence: Record<string, string>, feature: string, kind: string, replacement: string, sourceContract: Record<string, any> }} input Row inputs.
 * @returns {Record<string, any>} Complete preservation row.
 */
function preservationRow(input) {
    return {
        package: 'altium-toolkit@1.1.41',
        feature: input.feature,
        kind: input.kind,
        disposition: 'native-extension',
        replacement: input.replacement,
        availability: {
            'altium-toolkit': 'native',
            'circuitjson-toolkit': 'unavailable',
            'gerber-toolkit': 'unavailable',
            'kicad-toolkit': 'unavailable'
        },
        reason: 'The exact Altium-native contract remains available from the explicit extension surface.',
        evidence: input.evidence,
        sourceContract: input.sourceContract,
        documentation: []
    }
}

/**
 * Assigns deterministic documentation pages without exceeding the file cap.
 * @param {Record<string, any>[]} rows Preservation rows.
 * @returns {{ name: string, rows: Record<string, any>[] }[]} Page records.
 */
function pageRows(rows) {
    const pages = []
    for (let offset = 0; offset < rows.length; offset += PAGE_SIZE) {
        const name = `legacy-${String(pages.length + 1).padStart(3, '0')}.md`
        const page = rows.slice(offset, offset + PAGE_SIZE)
        for (const row of page) {
            row.documentation = [`docs/migration/${name}`]
        }
        pages.push({ name, rows: page })
    }
    return pages
}

/**
 * Replaces only generated legacy pages and writes current page content.
 * @param {{ name: string, rows: Record<string, any>[] }[]} pages Page records.
 * @returns {Promise<void>}
 */
async function writeMigrationPages(pages) {
    const directory = resolve(repositoryRoot, 'docs/migration')
    await mkdir(directory, { recursive: true })
    for (const name of await readdir(directory)) {
        if (/^legacy-\d+\.md$/u.test(name)) {
            await unlink(resolve(directory, name))
        }
    }
    for (const page of pages) {
        await writeFile(resolve(directory, page.name), migrationPage(page))
    }
}

/**
 * Renders one exhaustive migration page.
 * @param {{ name: string, rows: Record<string, any>[] }} page Page record.
 * @returns {string} Markdown page.
 */
function migrationPage(page) {
    const rows = page.rows.map(
        (row) =>
            `| ${markdown(row.feature)} | ${row.kind} | ${markdown(row.replacement)} |`
    )
    return [
        '<!--',
        'SPDX-FileCopyrightText: 2026 André Fiedler',
        'SPDX-License-Identifier: CC-BY-SA-4.0',
        '-->',
        '',
        `# Altium 1.1.41 legacy mapping ${page.name.slice(7, 10)}`,
        '',
        '| Frozen feature | Kind | 1.2.0 extension target |',
        '| --- | --- | --- |',
        ...rows,
        ''
    ].join('\n')
}

/**
 * Renders the concise migration guide and page index.
 * @param {{ name: string, rows: Record<string, any>[] }[]} pages Page records.
 * @returns {string} Markdown guide.
 */
function migrationIndex(pages) {
    const links = pages.map(
        (page, index) =>
            `- [Legacy mapping ${String(index + 1).padStart(3, '0')}](migration/${page.name}) (${page.rows.length} rows)`
    )
    return [
        '<!--',
        'SPDX-FileCopyrightText: 2026 André Fiedler',
        'SPDX-License-Identifier: CC-BY-SA-4.0',
        '-->',
        '',
        '# Migration from 1.1.41 to 1.2.0',
        '',
        'Version 1.2.0 adds the canonical ECAD toolkit API. Existing Altium',
        'exports are retained under `altium-toolkit/extensions`; the native',
        '`src/core` and `src/ui` implementations remain byte-identical to the',
        'pinned 1.1.41 source tree.',
        '',
        'The paged appendix maps every frozen export, static member, prototype',
        'member, public asset, and the native implementation tree:',
        '',
        ...links,
        ''
    ].join('\n')
}

/**
 * Escapes Markdown table separators and newlines.
 * @param {unknown} value Cell value.
 * @returns {string} Safe table text.
 */
function markdown(value) {
    return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

/**
 * Reads one compact JSON artifact.
 * @param {string} path Repository-relative path.
 * @returns {Promise<Record<string, any>>} Parsed artifact.
 */
async function readJson(path) {
    return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8'))
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
    const result = await generateFeaturePreservation()
    process.stdout.write(`${JSON.stringify(result)}\n`)
}
