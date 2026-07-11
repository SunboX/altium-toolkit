// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const COMMON_EXPORTS = [
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
    './styles/renderers.css'
]
const SHARED_EXTENSION_EXPORTS = [
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
]
const ALTIUM_CONVERGENCE_EXTENSION_EXPORTS = ['AltiumExtensionResolver']

test('package exposes the common layout plus namespaced native assets only', async () => {
    const pkg = JSON.parse(
        await readFile(new URL('../package.json', import.meta.url), 'utf8')
    )
    const exports = Object.keys(pkg.exports)
    assert.deepEqual(
        exports.filter((entry) => !entry.startsWith('./extensions/')),
        COMMON_EXPORTS
    )
    assert.deepEqual(
        exports.filter((entry) => entry.startsWith('./extensions/')),
        [
            './extensions/workers/altium-parser.worker.mjs',
            './extensions/styles/altium-renderers.css'
        ]
    )
})

test('common forwarding subpaths expose the exact CircuitJSON contracts', async () => {
    for (const subpath of [
        'parser',
        'project',
        'renderers',
        'interaction',
        'query',
        'manufacturing',
        'simulation',
        'scene3d',
        'testing'
    ]) {
        const [actual, expected] = await Promise.all([
            import(`../src/${subpath}.mjs`),
            import(`circuitjson-toolkit/${subpath}`)
        ])
        assert.deepEqual(
            Object.keys(actual).sort(),
            Object.keys(expected).sort(),
            subpath
        )
    }
})

test('extension surface is the collision-free union of native and shared contracts', async () => {
    const [
        actual,
        shared,
        legacyParser,
        legacyRenderers,
        legacyQuery,
        legacyScene
    ] = await Promise.all([
        import('../src/extensions.mjs'),
        import('circuitjson-toolkit/extensions'),
        import('../src/legacy-parser.mjs'),
        import('../src/legacy-renderers.mjs'),
        import('../src/legacy-netlist-query.mjs'),
        import('../src/legacy-scene3d.mjs')
    ])
    const nativeNames = new Set(
        [legacyParser, legacyRenderers, legacyQuery, legacyScene].flatMap(
            (namespace) => Object.keys(namespace)
        )
    )
    const sharedNames = Object.keys(shared)
    assert.deepEqual(sharedNames.sort(), [...SHARED_EXTENSION_EXPORTS].sort())
    assert.deepEqual(
        sharedNames.filter((name) => nativeNames.has(name)),
        []
    )
    assert.equal(nativeNames.size, 167)
    assert.deepEqual(
        Object.keys(actual).sort(),
        [
            ...nativeNames,
            ...sharedNames,
            ...ALTIUM_CONVERGENCE_EXTENSION_EXPORTS
        ].sort()
    )
})
