// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { FixtureCoverageMatrixBuilder } from '../../src/core/altium/FixtureCoverageMatrixBuilder.mjs'

/**
 * Verifies coverage matrix reports covered and missing fixture contracts.
 */
test('FixtureCoverageMatrixBuilder builds required coverage matrix', () => {
    const manifest = {
        schema: 'altium-toolkit.fixture-manifest.a1',
        assetPolicy: 'repo-owned-synthetic-only',
        fixtures: [
            {
                key: 'sch-a1',
                kind: 'schematic',
                assetPolicy: 'repo-owned-synthetic-only',
                nativeAsset: false,
                coverage: ['schematic.curves'],
                contracts: {
                    parser: ['schematic.beziers'],
                    schemas: ['altium-toolkit.normalized-model.a1']
                }
            },
            {
                key: 'pcb-a1',
                kind: 'pcb',
                assetPolicy: 'repo-owned-synthetic-only',
                nativeAsset: false,
                coverage: ['pcb.layers'],
                contracts: {
                    parser: ['pcb.layer-stack'],
                    schemas: ['altium-toolkit.pcb.layer-stack.a1']
                }
            }
        ]
    }

    const report = FixtureCoverageMatrixBuilder.build({
        manifest,
        requiredCoverage: ['schematic.curves', 'parser.safe-parse'],
        requiredContracts: {
            parser: ['schematic.beziers', 'parser.safe-parse'],
            schemas: [
                'altium-toolkit.normalized-model.a1',
                'altium-toolkit.geometry-bounds.a1'
            ]
        }
    })

    const safeParseCoverage = report.coverage.find(
        (entry) => entry.tag === 'parser.safe-parse'
    )
    const missingSchema = report.contracts.find(
        (entry) =>
            entry.group === 'schemas' &&
            entry.contract === 'altium-toolkit.geometry-bounds.a1'
    )

    assert.equal(report.schema, 'altium-toolkit.fixture-coverage-matrix.a1')
    assert.equal(report.summary.fixtureCount, 2)
    assert.equal(report.summary.missingCoverageCount, 1)
    assert.equal(report.summary.missingContractCount, 2)
    assert.equal(report.summary.status, 'gap')
    assert.deepEqual(report.policy, {
        assetPolicy: 'repo-owned-synthetic-only',
        nativeAssetCount: 0,
        compliant: true
    })
    assert.deepEqual(safeParseCoverage, {
        tag: 'parser.safe-parse',
        fixtureKeys: [],
        count: 0,
        required: true,
        covered: false
    })
    assert.deepEqual(missingSchema, {
        group: 'schemas',
        contract: 'altium-toolkit.geometry-bounds.a1',
        fixtureKeys: [],
        count: 0,
        required: true,
        covered: false
    })
})

/**
 * Verifies the repository fixture manifest remains synthetic and reportable.
 */
test('FixtureCoverageMatrixBuilder reports repository synthetic fixture manifest', () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            new URL('../fixtures/fixture-manifest.json', import.meta.url),
            'utf8'
        )
    )
    const report = FixtureCoverageMatrixBuilder.build({
        manifest,
        requiredCoverage: [
            'schematic.curves',
            'pcb.layer-stack-statistics',
            'parser.fuzz-record-ordering'
        ],
        requiredContracts: {
            parser: [
                'schematic.beziers',
                'pcb.layer-stack',
                'parser.compatibility-fuzz'
            ]
        }
    })

    assert.equal(report.summary.status, 'pass')
    assert.equal(report.policy.compliant, true)
    assert.equal(report.policy.nativeAssetCount, 0)
    assert.deepEqual(report.missingCoverage, [])
    assert.deepEqual(report.missingContracts, [])
})
