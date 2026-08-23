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
    assert.deepEqual(embeddedMatch?.transform, {
        rotationDeg: { x: 0, y: 0, z: 270 },
        dzMil: 11.811
    })
    assert.equal(sessionMatch?.origin, 'session')
    assert.equal(sessionMatch?.relativePath, 'Models/QFN32.wrl')
})

test('PcbScene3dModelRegistry derives embedded STEP payload bounds', () => {
    const registry = PcbScene3dModelRegistry.create(
        [],
        [
            {
                id: '{FIXTURE-STEP-BODY}',
                checksum: 98,
                name: 'fixture-body.step',
                format: 'step',
                payloadText: [
                    'ISO-10303-21;',
                    'DATA;',
                    "#1=CARTESIAN_POINT('',(-0.635,-1.2,-2.3));",
                    "#2=CARTESIAN_POINT('',(1.905,1.2,5.0));",
                    "#3=CARTESIAN_POINT('',(0.0,0.0,0.0));",
                    '#4=SI_UNIT(.MILLI.,.METRE.);',
                    'ENDSEC;',
                    'END-ISO-10303-21;'
                ].join('\n'),
                sourceStream: 'Models/3'
            }
        ]
    )

    const match = registry.resolveComponentBodyModel({
        modelId: '{FIXTURE-STEP-BODY}',
        checksum: 98,
        embedded: true,
        name: 'fixture-body.step'
    })

    assert.equal(match?.origin, 'embedded')
    assert.deepEqual(Object.keys(match.boundsMil).sort(), [
        'depth',
        'height',
        'width'
    ])
    assert.ok(Math.abs(match.boundsMil.width - 100) < 1e-9)
    assert.ok(Math.abs(match.boundsMil.depth - 94.4881889764) < 1e-9)
    assert.ok(Math.abs(match.boundsMil.height - 287.4015748031) < 1e-9)
    assert.ok(Math.abs(match.sourceBoundsMil.minX + 25) < 1e-9)
    assert.ok(Math.abs(match.sourceBoundsMil.maxX - 75) < 1e-9)
    assert.ok(Math.abs(match.sourceBoundsMil.minY + 47.2440944882) < 1e-9)
    assert.ok(Math.abs(match.sourceBoundsMil.maxY - 47.2440944882) < 1e-9)
    assert.ok(Math.abs(match.sourceBoundsMil.minZ + 90.5511811024) < 1e-9)
    assert.ok(Math.abs(match.sourceBoundsMil.maxZ - 196.8503937008) < 1e-9)
})

test('PcbScene3dModelRegistry honors embedded STEP inch payload bounds', () => {
    const registry = PcbScene3dModelRegistry.create(
        [],
        [
            {
                id: '{FIXTURE-INCH-BODY}',
                checksum: 99,
                name: 'fixture-inch-body.step',
                format: 'step',
                payloadText: [
                    'ISO-10303-21;',
                    'DATA;',
                    "#1=CARTESIAN_POINT('',(0.0,0.0,0.0));",
                    "#2=CARTESIAN_POINT('',(0.1,0.2,0.3));",
                    "#3=CONVERSION_BASED_UNIT('INCH',#4);",
                    '#4=SI_UNIT($,.METRE.);',
                    'ENDSEC;',
                    'END-ISO-10303-21;'
                ].join('\n'),
                sourceStream: 'Models/4'
            }
        ]
    )

    const match = registry.resolveComponentBodyModel({
        modelId: '{FIXTURE-INCH-BODY}',
        checksum: 99,
        embedded: true,
        name: 'fixture-inch-body.step'
    })

    assert.equal(match?.origin, 'embedded')
    assert.equal(match.boundsMil.width, 100)
    assert.equal(match.boundsMil.depth, 200)
    assert.equal(match.boundsMil.height, 300)
})

test('PcbScene3dModelRegistry skips unsupported embedded body payloads', () => {
    const registry = PcbScene3dModelRegistry.create(
        [
            {
                name: 'fixture-body.step',
                relativePath: 'Models/fixture-body.step'
            }
        ],
        [
            {
                id: '{FIXTURE-BODY}',
                checksum: 72,
                name: 'fixture-body.sldprt',
                format: 'solidworks',
                payloadText: 'solidworks-binary-ish',
                sourceStream: 'Models/4'
            }
        ]
    )

    const match = registry.resolveComponentBodyModel({
        modelId: '{FIXTURE-BODY}',
        checksum: 72,
        embedded: true,
        name: 'fixture-body.sldprt'
    })

    assert.equal(match?.origin, 'session')
    assert.equal(match?.format, 'step')
    assert.equal(match?.relativePath, 'Models/fixture-body.step')
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
