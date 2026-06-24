// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dModelRegistry } from '../../src/ui/PcbScene3dModelRegistry.mjs'

/**
 * Verifies the model registry resolves explicit references before basename
 * heuristics.
 */
test('PcbScene3dModelRegistry resolves explicit and heuristic model matches', () => {
    const registry = PcbScene3dModelRegistry.create([
        {
            name: 'QFN32.wrl',
            relativePath: 'Models/QFN32.wrl'
        },
        {
            name: 'sot23.step',
            relativePath: 'Mechanical/sot23.step'
        }
    ])

    const explicitMatch = registry.resolveComponentModel({
        designator: 'U1',
        pattern: 'QFN32',
        modelPath: 'Models/QFN32.wrl'
    })
    const heuristicMatch = registry.resolveComponentModel({
        designator: 'Q1',
        pattern: 'SOT-23'
    })
    const missingMatch = registry.resolveComponentModel({
        designator: 'X1',
        pattern: 'UNKNOWN'
    })

    assert.equal(explicitMatch?.format, 'wrl')
    assert.equal(explicitMatch?.relativePath, 'Models/QFN32.wrl')
    assert.equal(heuristicMatch?.format, 'step')
    assert.equal(heuristicMatch?.relativePath, 'Mechanical/sot23.step')
    assert.equal(missingMatch, null)
})

test('PcbScene3dModelRegistry resolves exact GLB session models', () => {
    const registry = PcbScene3dModelRegistry.create([
        {
            name: 'Module.glb',
            relativePath: 'Models/Module.glb'
        }
    ])

    const match = registry.resolveComponentModel({
        designator: 'U1',
        pattern: 'MODULE',
        modelPath: 'Models/Module.glb'
    })

    assert.equal(match?.origin, 'session')
    assert.equal(match?.format, 'glb')
    assert.equal(match?.relativePath, 'Models/Module.glb')
})

/**
 * Verifies embedded model payloads resolve by authored model identity before
 * falling back to session basenames.
 */
test('PcbScene3dModelRegistry resolves embedded body references before session basenames', () => {
    const registry = PcbScene3dModelRegistry.create(
        [
            {
                name: 'SOT-23_Y.stp',
                relativePath: 'Mechanical/SOT-23_Y.stp'
            },
            {
                name: 'QFN32.wrl',
                relativePath: 'Models/QFN32.wrl'
            }
        ],
        [
            {
                id: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
                checksum: 3467130030,
                name: 'SOT-23_Y.stp',
                format: 'step',
                payloadText: 'ISO-10303-21;',
                sourceStream: 'Models/0',
                transform: {
                    rotationDeg: { x: 0, y: 0, z: 270 },
                    dzMil: 11.811
                }
            }
        ]
    )

    const embeddedMatch = registry.resolveComponentBodyModel({
        modelId: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
        checksum: 3467130030,
        embedded: true,
        name: 'SOT-23_Y.stp'
    })
    const sessionMatch = registry.resolveComponentBodyModel({
        modelId: '{00000000-0000-0000-0000-000000000000}',
        checksum: 12,
        embedded: false,
        name: 'QFN32.wrl'
    })

    assert.equal(embeddedMatch?.origin, 'embedded')
    assert.equal(embeddedMatch?.payloadText, 'ISO-10303-21;')
    assert.equal(embeddedMatch?.sourceStream, 'Models/0')
    assert.equal(sessionMatch?.origin, 'session')
    assert.equal(sessionMatch?.relativePath, 'Models/QFN32.wrl')
})

/**
 * Verifies exact project-level board assembly models can be distinguished from
 * ordinary component model assets.
 */
test('PcbScene3dModelRegistry resolves exact board assembly model matches', () => {
    const registry = PcbScene3dModelRegistry.create([
        {
            name: 'FixtureBoard.step',
            relativePath: '3D Bodies/FixtureBoard.step'
        },
        {
            name: 'UnrelatedBoard.step',
            relativePath: '3D Bodies/UnrelatedBoard.step'
        }
    ])

    const assemblyMatch = registry.resolveBoardAssemblyModel({
        fileName: 'PCB/FixtureBoard.PcbDoc'
    })
    const missingMatch = registry.resolveBoardAssemblyModel({
        fileName: 'PCB/OtherBoard.PcbDoc'
    })

    assert.equal(assemblyMatch?.origin, 'board-assembly')
    assert.equal(assemblyMatch?.name, 'FixtureBoard.step')
    assert.equal(assemblyMatch?.relativePath, '3D Bodies/FixtureBoard.step')
    assert.equal(assemblyMatch?.format, 'step')
    assert.equal(missingMatch, null)
})

test('PcbScene3dModelRegistry preserves session model source metadata', () => {
    const registry = PcbScene3dModelRegistry.create([
        {
            name: 'QFN32.step',
            relativePath: 'Models/QFN32.step',
            source: 'model-search'
        }
    ])

    const match = registry.resolveComponentModel({
        designator: 'U1',
        pattern: 'QFN32'
    })

    assert.equal(match?.origin, 'session')
    assert.equal(match?.source, 'model-search')
})
